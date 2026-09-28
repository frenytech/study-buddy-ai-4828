<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Backend is the user's own Supabase project (not Lovable Cloud); schema lives in `supabase/schema.sql`, run manually in the Supabase SQL editor — no migration tool access.
- Browser client in `src/lib/supabase.ts` reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from `.env` — anon key is publishable.
- Server endpoints are TanStack server routes under `src/routes/api/*` that verify the Supabase bearer token via `src/lib/server-auth.server.ts` — keeps auth explicit without Cloud middleware.
- CBT answers never reach students before submission: questions table is admin-only; students use `start_cbt`/`get_cbt_questions`/`submit_cbt`/`get_cbt_review` security-definer RPCs.
- AI Tutor uses OpenRouter (user requirement) with daily limits enforced by `consume_ai_credit` RPC.
- Paystack writes subscriptions only server-side with STUDYAI_SERVICE_ROLE_KEY after verifying the transaction with Paystack.
