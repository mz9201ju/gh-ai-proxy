# 🚀 GitHub Models Proxy (Cloudflare Worker)

A lightweight **Cloudflare Worker** that acts as a secure proxy between your frontend (like a website or chat widget) and the **GitHub Models API**.  
It automatically injects authentication, handles CORS, and provides a default model fallback — perfect for deploying AI chat to your own sites (like Space Copilot).

---

## 🌍 Features

✅ Forwards `POST` requests to [GitHub Models API](https://models.github.ai)  
✅ Injects your `GITHUB_MODELS_TOKEN` securely (never exposed to the browser)  
✅ Adds full CORS support for frontend apps  
✅ Includes health check endpoint  
✅ Auto-fallback to a default model (`microsoft/phi-4-mini-instruct`)  
✅ Works with `curl`, `fetch()`, or any HTTP client