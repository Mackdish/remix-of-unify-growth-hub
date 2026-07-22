# Unify Youth Group — Build Plan

This is a large system (public site + member portal + admin panel + full financial ledger). I'll deliver it in phases so you can review as we go, rather than shipping everything at once.

## Phase 1 — Public website + branding (this turn)
- Enable Lovable Cloud (needed for auth + database in later phases).
- Design system: fresh palette reflecting unity/growth (deep green + gold accents on warm neutral), custom typography — no default purple/Inter.
- Generated logo (light + dark friendly).
- Routes:
  - `/` Home (hero, mission, stats placeholders, featured projects, contact CTA)
  - `/about` (Who we are, history, vision, mission, values, leadership)
  - `/projects` (project cards)
  - `/gallery` (grid + lightbox)
  - `/contact` (info + form, Wote/Makueni, 0703977431)
  - `/auth` (member/admin sign-in)
- Public stats on home use the imported summary totals (11 members, KSh 228,757 total+interest) as static seed values, clearly editable later.
- Sitemap.xml + robots.txt + per-route SEO metadata.

## Phase 2 — Auth, members, roles
- Supabase auth (email + password; admin-provisioned accounts).
- `profiles` table + `user_roles` table with enum `super_admin | treasurer | secretary | project_manager | member` and `has_role()` security-definer function.
- Protected routes under `_authenticated/` (member dashboard) and `_authenticated/_admin/` (admin panel).
- Seed 11 members from the 15/07/2026 summary.

## Phase 3 — Financial ledger
Tables (all RLS-scoped, member sees own rows, admins see all):
- `monthly_contributions`, `account_boosting`, `fines`, `loans`, `loan_repayments`, `shirts_loans`, `dues`, `interest_charges`, `projects`, `project_expenses`, `gallery_images`, `announcements`, `audit_log`.
- Import 15/07/2026 opening balances via migration, flagged `source = 'imported_2026_07_15'`.
- Member dashboard cards + statement download (PDF).

## Phase 4 — Admin panel
- CRUD for all financial modules, member management, password reset, project/gallery/CMS editing of About page, announcements.
- Reports (PDF/CSV/Excel export) with organization header.
- Audit log for sensitive actions.

## Phase 5 — Polish
- Charts (contribution trends, loan repayment, outstanding).
- M-Pesa integration stub (Daraja) — deferred until you provide credentials.

## Technical notes
- Stack: TanStack Start + Tailwind + Shadcn + Lovable Cloud (Supabase under the hood).
- Roles stored in separate `user_roles` table (never on profiles) to prevent privilege escalation.
- Interest calculation rules for Shirts Loan will be admin-configurable; imported KSh 170 / KSh 987 preserved as-is.
- No M-Pesa integration in initial build (schema will be ready for it).

## Question before I start Phase 1
Want me to proceed phase-by-phase (I ship Phase 1 now, you review, then Phase 2), or push straight through Phases 1–4 in one long build session?
