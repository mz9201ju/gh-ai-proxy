import { Env, Review } from "../types";
import { json } from "../utils/response";
import { getJsonUtf8, putJsonUtf8 } from "../utils/kv";

/**
 * 📥 Fetch all stored reviews from KV.
 * Auto-seeds with default reviews if empty.
 */
export async function handleGetReviews(env: Env): Promise<Response> {
    let stored = await getJsonUtf8<Review[]>(env.REVIEWS_DB, "reviews");

    if (!stored || stored.length === 0) {
        const seed: Review[] = [
            {
                name: "Jennifer D.",
                text: "My 3 children went to Deebas Daycare over the past 16yrs...",
                rating: 5,
            },
            {
                name: "",
                text: "We are very grateful for the care and support provided...",
                rating: 5,
            },
            {
                name: "",
                text: "I highly recommend Deeba’s daycare. My son loves it there...",
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
export async function handlePostReview(req: Request, env: Env): Promise<Response> {
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

        const stored = (await getJsonUtf8<Review[]>(env.REVIEWS_DB, "reviews")) || [];
        stored.unshift(newReview);

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
export async function handleDeleteReview(req: Request, env: Env): Promise<Response> {
    try {
        const body: { name?: string } = await req.json();
        if (!body.name) return json({ ok: false, error: "Missing name field" }, 400);

        const reviews = (await getJsonUtf8<Review[]>(env.REVIEWS_DB, "reviews")) || [];
        const filtered = reviews.filter(
            (r) => r.name?.toLowerCase() !== body.name!.toLowerCase()
        );

        if (filtered.length === reviews.length) {
            return json({ ok: false, error: `No reviews found for ${body.name}` }, 404);
        }

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
