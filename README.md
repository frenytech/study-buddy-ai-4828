# StudyAI — Your Smart Learning Partner

StudyAI is an AI-powered learning platform for Nigerian students preparing for JAMB and WAEC. Built by **FrenyTech**.

## Features
- Email/password and Google sign-in (Supabase Auth)
- AI Tutor (OpenRouter) with daily plan limits
- PDF upload → AI summaries, flashcards and quizzes
- JAMB & WAEC CBT engine (timer, navigation, review, AI performance analysis)
- Courses with video lessons, notes and progress tracking
- Study planner, progress dashboard, search, profile
- Paystack subscriptions (Pro ₦1,000 / Premium ₦1,200)
- Admin Control Room: users, questions, AI question generator, courses

## Tech stack
React 19, TanStack Start/Router, Vite, Tailwind CSS v4, shadcn/ui, Supabase (Auth, Postgres, Storage, RLS), OpenRouter, Paystack.

## Project structure
```
src/routes/            pages (public + _authenticated/*)
src/routes/api/*       server endpoints (AI, CBT analysis, Paystack)
src/lib/supabase.ts    browser Supabase client
src/lib/server-auth.server.ts  bearer-token verification for API routes
src/components/        UI and layout
supabase/schema.sql    full database, RLS and storage setup
```

## Local development
```
bun install
bun run dev
```

## Environment variables
Browser (`.env`, publishable):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server secrets (never prefix with `VITE_`):
- `OPENROUTER_API_KEY`
- `PAYSTACK_SECRET_KEY`
- `STUDYAI_SERVICE_ROLE_KEY` (Supabase service role key)

## Supabase setup
1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/schema.sql`, run it. It is safe to re-run.
3. This creates all tables, RLS policies, RPCs (`start_cbt`, `submit_cbt`, `consume_ai_credit`, …) and storage buckets (`materials` private, `avatars` public-read).

### Auth & Google OAuth
- Authentication → Providers → enable Email and Google.
- Create a Google OAuth client; authorised redirect URI: `https://<project>.supabase.co/auth/v1/callback`.
- Authentication → URL Configuration: add your site URL and `/auth` as redirect URLs.

### RLS
Every table has RLS. Students only see their own data; CBT answers stay hidden until submission via security-definer RPCs; admin rights come from the `user_roles` table.

### Edge Functions
Not used — server logic runs in the app's own API routes under `src/routes/api`.

## Admin setup
After signing up, run:
```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com' on conflict do nothing;
```

## OpenRouter setup
Create a key at openrouter.ai and store it as `OPENROUTER_API_KEY`.

## Paystack setup
- Store your secret key as `PAYSTACK_SECRET_KEY`.
- Webhook URL: `https://<your-domain>/api/paystack/webhook`.
- Subscriptions are written only server-side after Paystack verification.

## Deploying to Render
1. Push the code to GitHub.
2. Render → **New → Blueprint** → pick the repo. `render.yaml` sets everything up.
3. Fill in the secret values Render asks for: `VITE_SUPABASE_ANON_KEY`, `STUDYAI_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `PAYSTACK_SECRET_KEY`.
4. Build: `NITRO_PRESET=node-server bun run build` · Start: `node .output/server/index.mjs`.
5. After the first deploy, copy your `https://<name>.onrender.com` URL and:
   - Supabase → Authentication → URL Configuration: set Site URL to it and add `https://<name>.onrender.com/**` to Redirect URLs.
   - Paystack → Settings → Webhooks: `https://<name>.onrender.com/api/public/paystack-webhook`.
   - Paystack callback URL: `https://<name>.onrender.com/billing/callback`.
6. If you change a `VITE_` value, redeploy (they're baked in at build time).

Free Render instances sleep when idle; the first visit after a while can take ~30 seconds.

## Email (optional: Brevo)
Supabase sends sign-up and password-reset emails itself, but its built-in sender is limited to a few emails per hour. For real users, add Brevo SMTP in Supabase → Authentication → Emails → SMTP Settings (host `smtp-relay.brevo.com`, port 587, your Brevo login and SMTP key). No Brevo key is needed in the app.

## Security
- Service role key and secret keys stay server-side.
- API routes verify the Supabase bearer token.
- Disabled accounts are signed out and blocked from AI use.

## Troubleshooting
- **"supabaseUrl is required"**: `.env` is missing `VITE_SUPABASE_URL`.
- **Sign-up/profile errors**: re-run `supabase/schema.sql`.
- **AI not responding**: check `OPENROUTER_API_KEY` and daily limits.
- **Google login fails**: check provider settings and redirect URLs.

---
© StudyAI · Built by FrenyTech
