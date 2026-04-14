# DevLaunch — AI-Powered App Generator Platform

## Overview

A self-hostable developer platform where users describe an app idea, Claude generates complete production-ready code, and the platform deploys it instantly as a live URL. Built to run on your own Hetzner server, and migrated to run in the Replit development environment without changing the core project structure.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React + Vite + Tailwind (dark terminal aesthetic)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: Claude (Anthropic) via `@workspace/integrations-anthropic-ai`
- **Container management**: dockerode (Docker SDK)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Replit Runtime

The project runs on Replit as two workflows:

- `Start application` — starts the Vite frontend at `/` with `PORT=25494` and `BASE_PATH=/`.
- `API Server` — builds and starts the Express API with `PORT=8080`, serving routes under `/api`.

The Replit development PostgreSQL database is provisioned and the Drizzle schema has been pushed with `pnpm --filter @workspace/db run push`. Frontend and API traffic are kept separate by service path routing, with browser API requests going to `/api`.

AI generation uses the user's own Anthropic key from Replit Secrets via `ANTHROPIC_API_KEY`. The server also accepts `MYANTHROPIC_API_KEY`, `MY_ANTHROPIC_API_KEY`, or `CLAUDE_API_KEY` as aliases, but it does not fall back to Replit Anthropic integration variables. Generated app files are stored in the `project_files` database table linked to the project ID.

Generated project detail pages include a `Preview` tab. The preview renders the generated files from the database inside a sandboxed iframe so users can inspect what Claude built even when Docker is unavailable in the Replit development environment.

## Key Features

- Describe an app idea → Claude generates complete code (all files)
- Every generated app includes: Dockerfile, docker-compose.yml, GitHub Actions CI/CD
- Deploy generated apps as isolated Docker containers (on Hetzner)
- Automatic subdomain routing per deployed app
- AI chat assistant for developer questions
- Redeploy (CI/CD trigger) support

## Hetzner Deployment

Everything needed to self-host is included:

- `Dockerfile` — multi-stage build for API + frontend
- `docker-compose.yml` — runs platform + postgres + caddy together
- `deploy/Caddyfile` — automatic HTTPS + wildcard subdomain routing
- `.env.example` — fill in domain, Anthropic API key, DB password
- `.github/workflows/deploy.yml` — GitHub Actions CI/CD auto-redeploy on push
- `deploy/README.md` — full step-by-step Hetzner setup guide

### Deploy on Hetzner (3 steps)

```bash
# 1. SSH into your Hetzner server
ssh root@YOUR_SERVER_IP

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Copy project, fill .env, and launch
cp .env.example .env && nano .env
docker compose up -d
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/code-gen run dev` — run frontend locally

## Environment Variables

For Hetzner deployment (fill in `.env`):
- `PLATFORM_DOMAIN` — your domain (e.g. myplatform.com)
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID used by backend token verification and frontend Google sign-in
- `JWT_SECRET` — random server-side secret for issuing app login tokens after Google sign-in
- `POSTGRES_PASSWORD` — strong DB password
- `SESSION_SECRET` — random secret (openssl rand -hex 32)
