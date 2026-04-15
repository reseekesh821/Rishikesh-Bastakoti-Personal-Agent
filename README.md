# Rishikesh Bastakoti Personal Agent

Frontend-only personal AI assistant UI with:
- ChatGPT-style layout
- Chat history sidebar
- Sign-in UI (frontend mock)
- Provider/model selector (Gemini, Groq, OpenAI placeholders)

## Local Run

Because this is a static frontend, you can run it directly:
- Open `index.html` in your browser

Or use any simple static server.

## Deploy To Vercel

1. Push this repo to GitHub.
2. Open Vercel and click **Add New Project**.
3. Import `Rishikesh-Bastakoti-Personal-Agent` repository.
4. Framework preset: **Other**.
5. Build command: leave empty.
6. Output directory: leave empty (root static files).
7. Click **Deploy**.

`vercel.json` is included for SPA-style rewrites so all routes open `index.html`.

## Current Scope

- Frontend only
- No backend or real auth yet
- No real provider key integration yet

## Next Planned Phase

- Backend API proxy for Gemini/Groq/OpenAI
- Secure key handling with environment variables
- Real authentication and persistent cloud chat history
