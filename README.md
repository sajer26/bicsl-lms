# BICSL LMS — Enterprise Healthcare Learning Management System

Bilingual (Arabic/English) LMS for the Basic Infection Control Skills License, built on
React + TypeScript + Tailwind + Supabase, per the project's SRS and UI/UX Design Specification.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, react-router, i18next (AR/EN + RTL)
- **Backend:** Supabase (Postgres + Auth + Storage), Row Level Security on every table
- **Video hosting:** YouTube (Unlisted) referenced by ID, rendered through an in-app embedded
  player — keeps Supabase Storage usage (free tier) to just PDFs/posters/images
- **Auth:** Supabase Auth, email + password (registration collects National ID/DOB as profile
  fields for records, per SRS, but they are not used as login credentials)

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the migrations **in order**:
   - `supabase/migrations/0001_init_schema.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_seed_bicsl_course.sql`
   - `supabase/migrations/0004_quiz_grading_and_unlock.sql`
   - `supabase/migrations/0005_storage_setup.sql`
   - `supabase/migrations/0006_audit_logging.sql`
   - `supabase/migrations/0007_platform_settings.sql`
3. Copy your Project URL and anon public key from **Project Settings → API**.

### Create the first Super Admin

Self-registration always creates a `learner` account (enforced by RLS — see
`0002_rls_policies.sql`). To create the first Super Admin:

1. Register normally through the app (or Supabase Auth dashboard) with the admin's email.
2. In the Supabase SQL Editor, run:
   ```sql
   update public.profiles set role = 'super_admin', hospital_id = null
   where id = '<the new user's auth.users id>';
   ```
3. That account can now sign in at `/super-admin/sign-in` and, from the CMS, create Hospital
   Admin accounts going forward.

## 2. Run the app locally

```bash
cp .env.example .env      # then fill in your Supabase URL + anon key
npm install
npm run dev
```

## 3. Project structure

```
src/
  components/
    layout/        shared chrome (AppHeader, etc.)
    learning/       video player, quiz components (next iteration)
    ui/             Button/Card-level primitives
  contexts/
    AuthContext.tsx session + profile + role, available app-wide
  i18n/
    locales/en.json, ar.json
  lib/
    supabaseClient.ts
    types.ts        TypeScript types mirroring the DB schema
  pages/
    auth/           Register, SignIn, SuperAdminSignIn
    learner/         Welcome, LearnerDashboard, (Module/Quiz/Certificate — next)
    hospital/        HospitalAdminDashboard
    admin/            SuperAdminDashboard (CMS)
    errors/          Unauthorized, NotFound
  routes/
    ProtectedRoute.tsx   role-based guard (UX only — RLS is the real boundary)
supabase/
  migrations/        schema, RLS policies, seed data
```

## 4. Build status

**Done:**
- Full database schema + RLS policies for all 13 entities, including a hardened
  security model for quizzes: learners can never read correct answers directly
  (masked via `quiz_questions_public`), and module completion can only be set
  by the server-side `submit_quiz_attempt()` function — never by a direct
  client write (enforced by a guard trigger on `learner_progress`)
- Auth flow: Registration, Sign In, Super Admin Sign In, role-based routing
- i18n (AR/EN) with RTL support, design tokens matching the UI/UX spec
  (Healthcare Blue palette, Times New Roman, card/button system)
- **Full learning flow:** Welcome → Learner Dashboard → Module screen
  (Pre-Quiz → Video → Resources → Post-Quiz → Completion celebration),
  resuming exactly where the learner left off via `learner_progress.stage`
- Embedded YouTube (Unlisted) video player with custom chrome — no redirect
  off-platform
- Quiz engine: question/choice fetch, navigation, scored server-side via RPC,
  unlimited retries on the Post-Quiz, 80% passing threshold enforced in SQL
- Automatic module unlocking, badge awarding, and certificate issuance
  (all inside the same trusted transaction, in `submit_quiz_attempt()`)
- Certificate screen with client-side PDF download (`jspdf` + `html2canvas`)
  and the IPC/Fit Test reminder text
- **Super Admin CMS:** Hospitals (create/edit/disable/reactivate), Learners
  (search/filter, activate/deactivate, reset progress, CSV export), Modules
  (publish/unpublish + full per-module content editor: video, PDF/poster/
  image/file/external-link resources, and quiz question bank), Reports
  (hospital-filterable completion report with CSV + PDF export), Audit Log
  (searchable, shows every logged action platform-wide), and Platform
  Settings (name, passing score, certificate validity, session timeout)
- **Audit trail wired in for real:** registration, login/logout, quiz
  submissions, module completions, certificate issuance (all logged inside
  the trusted SQL function itself — can't be skipped by the client), plus
  every admin content change (hospitals, modules, resources, questions,
  learner status/progress resets, settings changes)
- **Hospital Admin dashboard** wired to real data: total/active/completed
  learners, completion rate, per-learner progress + certificate table, CSV
  export — automatically scoped to the admin's own hospital via RLS
- Error boundary (no blank pages / raw errors) + 404 / Unauthorized pages

**Not yet built (smaller, lower-priority items):**
1. Course-level management UI (the BICSL course + 7 modules are seeded
   directly in SQL; a generic "Create Course" UI isn't needed for Phase 1
   since BICSL is the only course, but would matter for Future Phases)
2. Video skip-prevention — deferred by product decision until the platform
   is stable in production
3. YouTube IFrame API integration for true "video ended" auto-detection
   (currently a manual "Mark as watched" fallback is used)
4. True binary .xlsx export (current "Excel" export is CSV, which Excel
   opens natively — upgrading to the `xlsx`/SheetJS library is a drop-in
   change if a real .xlsx file is required)

## 5. Deployment (when ready)

Any static host works since this is a Vite SPA — Vercel or Netlify free tier is recommended
(matches the "100% free, no paid dependencies" requirement). Set the same two environment
variables in the host's dashboard.


