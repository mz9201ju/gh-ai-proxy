export interface Review {
  name: string;
  text: string;
  rating: number;
  date?: string;
}

/**
 * 🌍 Cloudflare Environment bindings
 * - REVIEWS_DB is your KV Namespace
 * - GITHUB_MODELS_TOKEN is used for GitHub AI proxy calls
 */
export interface Env {
  GITHUB_MODELS_TOKEN: string;
  REVIEWS_DB: KVNamespace; // ✅ defined in wrangler.jsonc
}

/**
 * 🚀 Main Worker entrypoint
 */
const worker: ExportedHandler<Env> = {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (req.method === "OPTIONS") {
      // 🧠 Handle CORS preflight requests
      return new Response(null, { status: 204, headers: cors() });
    }

    const url = new URL(req.url);

    // 🩺 Health check endpoint for monitoring / uptime
    if (req.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        proxy: "github-models",
        to: GH_MODELS_URL,
        default_model: DEFAULT_MODEL,
        version: GH_API_VERSION,
      });
    }

    // ⚠️ ADMIN ONLY — delete ALL reviews from KV
    // if (req.method === "DELETE" && url.pathname === "/reviews/all") {
    //   await env.REVIEWS_DB.delete("reviews");
    //   return json({ ok: true, message: "🧹 All reviews deleted successfully." });
    // }

    // 🗑️ Delete a specific review by name (admin)
    if (url.pathname === "/reviews" && req.method === "DELETE") {
      return handleDeleteReview(req, env);
    }

    // 💬 Reviews API endpoints
    if (url.pathname === "/reviews") {
      if (req.method === "GET") return handleGetReviews(env);
      if (req.method === "POST") return handlePostReview(req, env);
    }

    // 🚀 GitHub Models proxy handler
    if (req.method === "POST") {
      try {
        let data: any = {};
        const rawBody = await req.text();

        try {
          data = JSON.parse(rawBody);
        } catch {
          data = {};
        }

        if (!data.model) data.model = DEFAULT_MODEL;

        const gh = await fetch(GH_MODELS_URL, {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${env.GITHUB_MODELS_TOKEN}`,
            "X-GitHub-Api-Version": GH_API_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        const text = await gh.text();

        return new Response(text, {
          status: gh.status,
          headers: {
            "Content-Type": gh.headers.get("Content-Type") ?? "application/json",
            ...cors(),
          },
        });
      } catch (err: any) {
        console.error("⚠️ Worker caught error:", err.stack || err);
        return json({ ok: false, error: err.message || "Unknown error" }, 500);
      }
    }

    // Fallback: route not found
    return new Response("Not Found", { status: 404, headers: cors() });
  },
};

/* =====================================================
   💾 Reviews API logic (KV-based)
   ===================================================== */

/**
 * 📥 Fetch all stored reviews from KV.
 * Auto-seeds with default reviews if empty.
 */
async function handleGetReviews(env: Env): Promise<Response> {
  let stored = await getJsonUtf8<Review[]>(env.REVIEWS_DB, "reviews");

  // 🌱 Seed default reviews if none exist
  if (!stored || stored.length === 0) {
    const seed: Review[] = [
      {
        name: "Jennifer D.",
        text: "My 3 children went to Deebas Daycare over the past 16yrs. They are like family to us. They always took excellent care of my children and my children love them. They are wonderful people and an amazing Daycare. I highly recommend Deebas Daycare!",
        rating: 5,
      },
      {
        name: "",
        text: "We are very grateful for the care and support provided to our son by Deeba’s daycare. He was there from the age of 4 months until he started kindergarten. They did a fantastic job of preparing him for school.",
        rating: 5,
      },
      {
        name: "",
        text: "I highly recommend Deeba’s daycare. My son loves it there. They are loving and provide exceptional care!",
        rating: 5,
      },
    ];

    await putJsonUtf8(env.REVIEWS_DB, "reviews", seed);
    return json({ ok: true, reviews: seed });
  }

  return json({ ok: true, reviews: stored });
}

/**
 * ✍️ Add a new review to KV.
 * Supports emoji and multilingual text safely.
 */
async function handlePostReview(req: Request, env: Env): Promise<Response> {
  try {
    const body: Partial<Review> = await req.json();

    if (!body.name || !body.text) {
      return json({ ok: false, error: "Missing name or text" }, 400);
    }

    // 🧠 Construct a new review object
    const newReview: Review = {
      name: body.name,
      text: body.text, // Emoji-safe text
      rating: body.rating ?? 5,
      date: new Date().toISOString(),
    };

    // ⬇️ Read existing reviews safely (UTF-8 decoded)
    const stored = (await getJsonUtf8<Review[]>(env.REVIEWS_DB, "reviews")) || [];
    stored.unshift(newReview); // prepend latest review first

    // 💾 Write updated array with UTF-8 encoding
    await putJsonUtf8(env.REVIEWS_DB, "reviews", stored);

    return json({ ok: true, review: newReview });
  } catch (err: any) {
    console.error("❌ Failed to add review:", err);
    return json({ ok: false, error: "Server error" }, 500);
  }
}

/**
 * 🗑️ Delete reviews by reviewer name (case-insensitive).
 * Admin-only usage via curl or internal tooling.
 */
async function handleDeleteReview(req: Request, env: Env): Promise<Response> {
  try {
    const body: { name?: string } = await req.json();

    if (!body.name) {
      return json({ ok: false, error: "Missing name field" }, 400);
    }

    // 📖 Load all reviews
    const reviews = (await getJsonUtf8<Review[]>(env.REVIEWS_DB, "reviews")) || [];

    // 🧹 Remove reviews matching provided name
    const filtered = reviews.filter(
      (r) => r.name?.toLowerCase() !== body.name!.toLowerCase()
    );

    // If nothing deleted, return error
    if (filtered.length === reviews.length) {
      return json({ ok: false, error: `No reviews found for ${body.name}` }, 404);
    }

    // ✅ Save updated list
    await putJsonUtf8(env.REVIEWS_DB, "reviews", filtered);

    return json({
      ok: true,
      message: `Deleted ${reviews.length - filtered.length} review(s) for ${body.name}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    console.error("❌ Delete by name failed:", message);
    return json({ ok: false, error: message }, 500);
  }
}

/* =====================================================
   🧠 GitHub Models configuration (unchanged)
   ===================================================== */
const GH_MODELS_URL = "https://models.github.ai/inference/chat/completions";
const GH_API_VERSION = "2022-11-28";
const DEFAULT_MODEL = "microsoft/phi-4-mini-instruct";

/* =====================================================
   🧱 Utility helpers (UTF-8 + Emoji Safe)
   ===================================================== */

/**
 * 🧩 JSON Response Helper — ensures UTF-8 output
 */
function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8", // ✅ ensures emoji-safe output
      ...cors(),
    },
  });
}

/**
 * 🌐 CORS Helper — allows browser + curl access
 */
function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-GitHub-Api-Version",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS,DELETE",
  };
}

/**
 * 💾 Safe JSON storage for KV — UTF-8 encoded
 * This avoids emoji corruption in Cloudflare KV.
 */
async function putJsonUtf8(kv: KVNamespace, key: string, obj: any) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(JSON.stringify(obj));
  await kv.put(key, bytes);
}

/**
 * 📖 Safe JSON retrieval from KV — UTF-8 decoded
 */
async function getJsonUtf8<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key, "arrayBuffer");
  if (!raw) return null;
  const decoder = new TextDecoder("utf-8");
  return JSON.parse(decoder.decode(raw));
}

export default worker;
