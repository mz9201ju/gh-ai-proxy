# 🚀 GitHub Models Proxy (Cloudflare Worker)

A lightweight **Cloudflare Worker** that acts as a secure proxy between your frontend (like a website or chat widget) and the **GitHub Models API**.  
It automatically injects authentication, handles CORS, provides a default model fallback, and now includes **Cloudflare KV Database integration** for storing and retrieving user reviews or comments.

---

## 🌍 Features

✅ Forwards `POST` requests to [GitHub Models API](https://models.github.ai)  
✅ Injects your `GITHUB_MODELS_TOKEN` securely (never exposed to the browser)  
✅ Adds full CORS support for frontend apps  
✅ Includes health check endpoint  
✅ Auto-fallback to a default model (`microsoft/phi-4-mini-instruct`)  
✅ Works with `curl`, `fetch()`, or any HTTP client  
✅ **KV Database Integration** — Persistent storage for user reviews, feedback, or form submissions

---

## 💾 KV Database Integration

This Worker now includes support for **Cloudflare KV**, enabling simple and scalable data storage directly at the edge.

### 🔧 Setup

1. **Bind your KV namespace** in `wrangler.jsonc`:

   ```toml
   [[kv_namespaces]]
   binding = "REVIEWS_DB"
   id = "your-kv-namespace-id"
   ```

2. **Access it in your Worker code:**

   ```js
   // Save a new review
   await REVIEWS_DB.put(`review:${Date.now()}`, JSON.stringify({
     name: "Parent Name",
     text: "Wonderful daycare, highly recommend!",
     rating: 5
   }));

   // Retrieve all reviews
   const list = await REVIEWS_DB.list();
   const reviews = await Promise.all(
     list.keys.map(async (key) => JSON.parse(await REVIEWS_DB.get(key.name)))
   );
   ```

3. **Use from frontend (example):**

   ```js
   // Submit review
   await fetch("https://your-worker-url/reviews", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ name, text, rating }),
   });

   // Get all reviews
   const res = await fetch("https://your-worker-url/reviews");
   const data = await res.json();
   ```

---

## 🧱 Example Endpoints

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/AI/chat` | Forwards AI chat to GitHub Models API |
| `POST` | `/reviews` | Saves user review to KV DB |
| `GET` | `/reviews` | Retrieves all reviews from KV DB |

---

## 🪄 Example curl Commands

```bash
# Save a new review
curl -X POST "https://your-worker-url/reviews"   -H "Content-Type: application/json"   -d '{"name": "Jane Doe", "text": "Loved the service!", "rating": 5}'

# Retrieve all reviews
curl -X GET "https://your-worker-url/reviews"
```

---

## ⚙️ Deployment

```bash
# Install wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Publish your Worker
wrangler publish
```

---

## 🧠 Tech Stack

| Tool | Purpose |
|------|----------|
| **Cloudflare Workers** | Serverless runtime |
| **Cloudflare KV** | Persistent key-value storage for reviews |
| **GitHub Models API** | AI inference endpoint |
| **Wrangler CLI** | Build & deploy tooling |

---

## 🩵 Credits

Built with ☁️ Cloudflare Workers, 💡 GitHub Models, and a touch of ❤️ from the community.
