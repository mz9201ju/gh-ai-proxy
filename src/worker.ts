export interface Review {
  name: string;
  text: string;
  rating: number;
  date?: string;
}

/**
 * Cloudflare Environment bindings
 */
export interface Env {
  GITHUB_MODELS_TOKEN: string;
  REVIEWS_DB: KVNamespace; // ✅ KV namespace defined in wrangler.jsonc
}

/**
 * Main Worker entrypoint
 */
const worker: ExportedHandler<Env> = {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    const url = new URL(req.url);

    // 🩺 Health check
    if (req.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        proxy: "github-models",
        to: GH_MODELS_URL,
        default_model: DEFAULT_MODEL,
        version: GH_API_VERSION,
      });
    }

    // DELETE — remove a review (admin use only)
    if (url.pathname === "/reviews" && req.method === "DELETE") {
      return handleDeleteReview(req, env);
    }

    // ✅ Reviews API endpoints
    if (url.pathname === "/reviews") {
      if (req.method === "GET") return handleGetReviews(env);
      if (req.method === "POST") return handlePostReview(req, env);
    }

    // 🚀 Existing GitHub proxy logic
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

    return new Response("Not Found", { status: 404, headers: cors() });
  },
};

/* =====================================================
   💾 Reviews API logic (KV-based)
   ===================================================== */

async function handleGetReviews(env: Env): Promise<Response> {
  let stored = await env.REVIEWS_DB.get("reviews");

  // 🌱 Seed default reviews if missing or empty
  if (!stored || stored === "[]" || stored.trim() === "") {
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

    await env.REVIEWS_DB.put("reviews", JSON.stringify(seed));
    return json({ ok: true, reviews: seed });
  }

  const reviews: Review[] = JSON.parse(stored);
  return json({ ok: true, reviews });
}

async function handlePostReview(req: Request, env: Env): Promise<Response> {
  try {
    const body: Partial<Review> = await req.json();

    if (!body.name || !body.text) {
      return json({ ok: false, error: "Missing name or text" }, 400);
    }

    const newReview: Review = {
      name: body.name,
      text: body.text,
      rating: body.rating ?? 5,
      date: new Date().toISOString(),
    };

    const stored = (await env.REVIEWS_DB.get("reviews")) || "[]";
    const reviews: Review[] = JSON.parse(stored);
    reviews.unshift(newReview); // newest first

    await env.REVIEWS_DB.put("reviews", JSON.stringify(reviews));
    return json({ ok: true, review: newReview });
  } catch (err: any) {
    console.error("❌ Failed to add review:", err);
    return json({ ok: false, error: "Server error" }, 500);
  }
}

/**
 * 🗑️ Deletes one or more reviews by reviewer name.
 * Intended for admin-only usage via curl.
 */
async function handleDeleteReview(req: Request, env: Env): Promise<Response> {
  try {
    // Parse and validate request body
    const body: { name?: string } = await req.json();

    if (!body.name) {
      return json({ ok: false, error: "Missing name field" }, 400);
    }

    // Load all reviews from KV
    const stored: string = (await env.REVIEWS_DB.get("reviews")) || "[]";
    const reviews: Review[] = JSON.parse(stored);

    // Filter out all reviews with the specified name (case-insensitive)
    const filtered: Review[] = reviews.filter(
      (r) => r.name?.toLowerCase() !== body.name!.toLowerCase()
    );

    // If nothing changed, return not found
    if (filtered.length === reviews.length) {
      return json({ ok: false, error: `No reviews found for ${body.name}` }, 404);
    }

    // Update KV
    await env.REVIEWS_DB.put("reviews", JSON.stringify(filtered));

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
   🧱 Utility helpers
   ===================================================== */
function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-GitHub-Api-Version",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

export default worker;
