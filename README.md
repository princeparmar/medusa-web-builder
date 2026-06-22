# Medusa Web Builder

Production drag-and-drop storefront builder for Medusa commerce, integrated with `@pradip1995/create-storefront-app`, `medusa-storefronts` GitHub org, and BullMQ workers.

## Quick start

```bash
cp .env.example .env
# Start infrastructure
docker compose -f docker/docker-compose.yml up postgres redis mailpit -d

pnpm install
pnpm db:migrate:deploy   # apply migrations (use db:migrate for new schema changes in dev)

# Terminal 1
pnpm dev:web

# Terminal 2
pnpm dev:worker
```

Open http://localhost:3000

## Database migrations

Schema changes are managed with **Prisma Migrate** (versioned SQL in `packages/db/prisma/migrations/`).

```bash
# After editing packages/db/prisma/schema.prisma (development)
pnpm db:migrate --name describe_your_change

# Apply pending migrations (production / CI / first-time setup)
pnpm db:migrate:deploy

# Check status
pnpm db:migrate:status
```

See [packages/db/prisma/MIGRATIONS.md](packages/db/prisma/MIGRATIONS.md) for the full workflow, Docker integration, and recovery steps.

**Makefile shortcuts:** `make db-migrate`, `make db-migrate-dev`, `make db-migrate-status`, `make db-migrate-docker`

## Architecture

- **apps/web** — Next.js 15 builder UI + API routes (enqueues background jobs to Redis)
- **apps/worker** — BullMQ job processor (scaffold, git, publish, GitHub provision, registry sync, deploy)
- **packages/db** — Prisma + PostgreSQL
- **packages/core** — GitHub App, git, scaffold, queue, RBAC, crypto
- **packages/registry** — Section & plugin catalog

### Background job queues (BullMQ + Redis)

There is no separate “queue” Docker service. **Redis** is the broker; the **`worker`** container consumes jobs.

| Queue | Job | Triggered by | Worker handler |
|-------|-----|--------------|----------------|
| `project` | `scaffold` | Create project | Scaffold workspace + optional GitHub repo |
| `project` | `git.commit` | Save draft | Commit & push draft branch |
| `project` | `publish` | Publish | Merge, tag `v*`, create deployment |
| `project` | `github.provision` | “Create GitHub repository” | Create/link `medusa-storefronts/storefront-{id}` |
| `registry` | `sections`, `plugins`, `github-repo`, `github-plugins-repo`, `refresh-versions` | Registry sync / custom repo registration | Sync section & plugin catalog |
| `deploy` | `trigger` | GitHub `workflow_run` / release webhook | POST to `DEPLOY_WEBHOOK_URL` (K8s deploy agent or local stub) |

**Local dev (pnpm):** run `pnpm dev:worker` in a second terminal alongside `pnpm dev:web`.

**Docker:** `docker compose -f docker/docker-compose.yml up --build` starts `redis`, `worker`, `web`, and `deploy-stub` (local deploy webhook on port 9090).

Verify the worker is running:

```bash
docker compose -f docker/docker-compose.yml logs -f worker
# Should show: Workers listening on queues: project, registry, deploy
```

GitHub repo creation and publish require `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` in `.env` (loaded into **worker** via `env_file`). Restart after changing them:

```bash
docker compose -f docker/docker-compose.yml up -d --build worker
```

## GitHub setup

Project repos are created under [medusa-storefronts](https://github.com/medusa-storefronts) as `storefront-{uuid}`.

Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_ORG=medusa-storefronts` in `.env`.

## Docker (full stack)

Starts postgres, redis, mailpit, **worker** (queue processor), **web**, and **deploy-stub** (local deploy webhook).

```bash
docker compose -f docker/docker-compose.yml up --build
```

Or via Makefile: `make up` (infra + full stack).

Infrastructure only (no worker — background jobs will not run):

```bash
docker compose -f docker/docker-compose.yml up postgres redis mailpit -d
```

## Publish flow

1. Edit storefront in builder → section fields driven by each package's `builder.settings.json`
2. Save draft → writes `storefront/builder/sections.config.json` + `segment-data.json` (build input) and `backend/plugins.config.json` `pluginOptions`
3. Publish → tag `v*` pushed to GitHub
4. `release.yml` builds artifacts using committed config files (no `medusa-plugin-dynamic-config`)
5. GitHub webhook → deploy worker → Kubernetes webhook
