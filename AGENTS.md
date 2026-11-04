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

## Project rules
- The custom domain unifygentsgroup.co.ke is NOT connected to this project — its DNS points at an old, separate deployment running the retired backend. The published app lives at https://youth-finance-nexus.lovable.app. `SITE_URL` in `src/lib/site-config.ts` temporarily points there so auth-email and invite links land on the working site; switch it back to the custom domain once the user connects unifygentsgroup.co.ke (requires a paid plan).
- The generated Supabase client files (`src/integrations/supabase/client.ts`, `auth-middleware.ts`) carried stale pre-remix fallback URLs; their fallbacks were corrected to the current backend. Re-check those fallbacks after any remix.
