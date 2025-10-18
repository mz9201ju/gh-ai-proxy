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
    REVIEWS_DB: KVNamespace;
}
