# Daymark — Vercel edition

A Next.js 16 + TypeScript + Tailwind CSS task and notes app with shadcn UI. This edition uses Neon Postgres instead of Cloudflare D1, so it can run on Vercel. Visitor workspaces are separated by a long-lived, HttpOnly browser cookie. Data persists after reload in the same browser. It is a public demo, not an account-based app; clearing cookies loses access to that browser's earlier records, and data does not sync across devices. Do not use it for sensitive information.

## 1. Create a Neon database

Create a project at https://neon.com and copy its Postgres connection string. Use the pooled connection string when Neon offers one. Keep it secret.

In VS Code, open this folder, then in PowerShell:

```powershell
pnpm install
Copy-Item .env.example .env.local
```

Edit `.env.local` and replace the example `DATABASE_URL` with your Neon connection string. Never commit `.env.local`.

## 2. Create tables and test locally

```powershell
pnpm db:migrate
pnpm dev
```

Open the localhost URL printed in the terminal. Create a task, reload, and check it is still present. `pnpm db:migrate` is safe to run again; it creates missing tables and indexes but does not erase records. Run `pnpm typecheck` and `pnpm build` before deployment.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository. Keep `.env.local` out of Git (it is in `.gitignore`).
2. In Vercel, **Add New → Project**, import the repository, and keep the **Next.js** framework preset and default build settings.
3. Add `DATABASE_URL` under the project's environment variables for **Production** (and Preview if you want preview deployments to work). Use the same Neon database you migrated, or migrate a separate preview database if you want isolation.
4. Deploy. Vercel will provide a public `.vercel.app` URL. After adding or changing environment variables, redeploy so the new deployment receives them.

The database tables must be created before people can save tasks or notes. There are no Cloudflare bindings or Sites-specific build scripts in this edition. Data in the existing ChatGPT Sites app is not transferred into Neon.

## Project scripts

- `pnpm dev` — local Next.js development server
- `pnpm db:migrate` — create Postgres tables and indexes using `.env.local`
- `pnpm typecheck` — TypeScript check
- `pnpm build` — production build
- `pnpm start` — run the built app locally
