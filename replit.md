# X20 Content OS

## Overview

Full-stack Master Marketing Planner for X20/Times 20 Consulting (x20.io). pnpm workspace monorepo with TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui
- **Auth**: Replit Auth (OIDC) with session-based auth

## X20 Design System

Brand colors and tokens (from `attached_assets/Times_20_Design_System_1776615372389.zip`):

- **Primary**: `#0b3b92` (X20 Blue) → `hsl(219 86% 31%)`
- **Sidebar bg**: `#06265d` (X20 Blue Darker) → `hsl(218 88% 19%)`
- **Background**: `#f4f8fd` (X20 Surface) → `hsl(213 69% 97%)`
- **Foreground**: `#0f1923` (X20 Ink) → `hsl(210 40% 10%)`
- **Border**: `#c8d9ee` → `hsl(213 53% 86%)`
- **Accent**: `#62a8db` (Mid Blue)
- **Success**: `#1a8c5b` | **Warning**: `#c97d0e` | **Danger**: `#c93d2e`

Fonts:
- **Display/Headlines**: Barlow Condensed (700/800) — applied to h1 and `.text-display`
- **Headings**: Barlow (600) — applied to h2–h4
- **Body/UI**: DM Sans (400/500/600) — base `--font-sans`

Shadows: Blue-tinted only — `rgba(11,59,146,…)`. Never black/gray.

Admin email (hardcoded gate): `wil.kirwan@gmail.com`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Feature Status (Phase 1)

- ✅ 7-lane planner (Board/Calendar/List views)
- ✅ HighLevel Social Planner sync
- ✅ Blog Post sync from HL
- ✅ Campaigns manager
- ✅ Templates
- ✅ Dashboard analytics
- ✅ Webhook handler (Ed25519 + RSA signature verification)
- ✅ Admin portal (webhook log, user list, HL setup)
- ✅ Replit Auth (OIDC)
- ✅ X20 Design System applied

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
