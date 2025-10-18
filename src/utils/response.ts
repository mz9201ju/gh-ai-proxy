import { cors } from "./cors";

/**
 * 🧩 JSON Response Helper — ensures UTF-8 output and safe headers
 */
export function json(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8", // ✅ emoji-safe
            ...cors(),
        },
    });
}
