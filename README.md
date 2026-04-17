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
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Current Scope

- Frontend + Vercel serverless API proxy (`/api/chat`)
- Frontend sign-in is still mock UI only
- API keys are read from server environment variables
- Personal-agent backend context with basic intent routing (`career`, `study`, `task`, `portfolio`, `general`)
- Supabase-backed persistent state API (`/api/state`) for chats/profile data

## Next Planned Phase

- Real authentication and persistent cloud chat history

## Resources Needed From You (For Next Upgrade)

- Preferred auth provider choice (Clerk, Supabase Auth, or Firebase)
- Calendar integration choice (Google Calendar or none for now)

## Supabase Setup

1. Open Supabase SQL Editor.
2. Run `supabase/schema.sql`.
3. Redeploy on Vercel after environment variables are set.

## Supabase Auth Setup

1. Open Supabase `Authentication -> Providers -> Email`.
2. Enable Email provider.
3. If using email confirmation, verify once before first sign in.

## Important Security Note

If a real API key was ever pasted into `.env.example` or committed to GitHub, rotate it immediately in the provider dashboard and replace with a new key.
