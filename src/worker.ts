import { Env } from "./types";
import { cors } from "./utils/cors";
import { json } from "./utils/response";
import { handleGetReviews, handlePostReview, handleDeleteReview } from "./handlers/reviewsHandler";
import { handleGitHubProxy } from "./handlers/githubProxyHandler";
import { GH_MODELS_URL, GH_API_VERSION, DEFAULT_MODEL } from "./config";

/**
 * 🚀 Cloudflare Worker Entrypoint — routes API requests
 */
const worker: ExportedHandler<Env> = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

    // Health check endpoint
    if (req.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        proxy: "github-models",
        to: GH_MODELS_URL,
        default_model: DEFAULT_MODEL,
        version: GH_API_VERSION,
      });
    }

    // Reviews endpoints
    if (url.pathname === "/reviews") {
      if (req.method === "GET") return handleGetReviews(env);
      if (req.method === "POST") return handlePostReview(req, env);
      if (req.method === "DELETE") return handleDeleteReview(req, env);
    }

    // GitHub proxy endpoint
    if (req.method === "POST") {
      return handleGitHubProxy(req, env);
    }

    return new Response("Not Found", { status: 404, headers: cors() });
  },
};

export default worker;
