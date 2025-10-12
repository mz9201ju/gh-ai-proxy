export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors(),
      });
    }

    const url = new URL(req.url);

    // 🩺 Health check endpoint
    if (req.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        proxy: "github-models",
        to: GH_MODELS_URL,
        default_model: DEFAULT_MODEL,
        version: GH_API_VERSION,
      });
    }

    // 🚀 POST — forward to GitHub Models
    if (req.method === "POST") {
      try {
        let data: any = {};
        const rawBody = await req.text();

        // Parse and inject default model if missing
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = {};
        }
        if (!data.model) {
          data.model = DEFAULT_MODEL; // ✅ fallback
        }

        const gh = await fetch(GH_MODELS_URL, {
          method: "POST",
          headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${env.GITHUB_MODELS_TOKEN}`, // ✅ secret from Cloudflare
            "X-GitHub-Api-Version": GH_API_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        const text = await gh.text();

        // 🧩 Return clean structured response
        return new Response(text, {
          status: gh.status,
          headers: {
            "Content-Type": gh.headers.get("Content-Type") ?? "application/json",
            ...cors(),
          },
        });
      } catch (err: any) {
        console.error("⚠️ Worker caught error:", err.stack || err);
        return json(
          { ok: false, error: err.message || "Unknown error" },
          500
        );
      }
    }

    // ❌ Fallback
    return new Response("Not Found", { status: 404, headers: cors() });
  },
};

// 🧠 GitHub Models configuration
const GH_MODELS_URL = "https://models.github.ai/inference/chat/completions";
const GH_API_VERSION = "2022-11-28";
const DEFAULT_MODEL = "microsoft/phi-4-mini-instruct"; // ✅ Auto fallback model

// 🧱 Utility: JSON response helper
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

// 🌐 Utility: CORS headers
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-GitHub-Api-Version",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

// 🔐 Cloudflare secret bindings
interface Env {
  GITHUB_MODELS_TOKEN: string; // stored with `wrangler secret put`
}
