# Rishikesh Bastakoti Personal Agent

Frontend-only personal AI assistant UI with:
- ChatGPT-style layout
- Chat history sidebar
- Sign-in UI (frontend mock)
- Provider/model selector (Gemini and Groq)

## Local Run

Because this is a static frontend, you can run it directly:
- Open `index.html` in your browser

Or use any simple static server.

## Secrets and Git Safety

- Use `.env.example` as a template and create your local `.env`.
- Keep real keys only in `.env` (never in code).
- `.gitignore` is configured to ignore `.env` and other secret/key files.
- `.env.example` is safe to commit and share.

## Deploy To Vercel

1. Push this repo to GitHub.
2. Open Vercel and click **Add New Project**.
3. Import `Rishikesh-Bastakoti-Personal-Agent` repository.
4. Framework preset: **Other**.
5. Build command: leave empty.
6. Output directory: leave empty (root static files).
7. Click **Deploy**.

Then add environment variables in Vercel project settings:
- `GEMINI_API_KEY`
- `GROQ_API_KEY`

## Current Scope

- Frontend + Vercel serverless API proxy (`/api/chat`)
- Frontend sign-in is still mock UI only
- API keys are read from server environment variables
- Personal-agent backend context with basic intent routing (`career`, `study`, `task`, `portfolio`, `general`)

## Next Planned Phase

- Real authentication and persistent cloud chat history

## Resources Needed From You (For Next Upgrade)

- Supabase project URL
- Supabase anon key
- Supabase service role key (server use only)
- Preferred auth provider choice (Clerk, Supabase Auth, or Firebase)
- Calendar integration choice (Google Calendar or none for now)

## Important Security Note

If a real API key was ever pasted into `.env.example` or committed to GitHub, rotate it immediately in the provider dashboard and replace with a new key.
