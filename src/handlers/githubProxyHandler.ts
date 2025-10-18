import { Env } from "../types";
import { json } from "../utils/response";
import { cors } from "../utils/cors";
import { DEFAULT_MODEL, GH_MODELS_URL, GH_API_VERSION } from "../config";

/**
 * 🚀 GitHub Models proxy handler
 * Forwards POST to GitHub Models API with authentication.
 */
export async function handleGitHubProxy(req: Request, env: Env): Promise<Response> {
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
