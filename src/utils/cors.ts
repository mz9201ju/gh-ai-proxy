/**
 * 🌐 CORS Helper — allows browser + curl access
 */
export function cors(): Record<string, string> {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-GitHub-Api-Version",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS,DELETE",
    };
}
