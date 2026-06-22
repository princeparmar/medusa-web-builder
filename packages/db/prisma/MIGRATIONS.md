# Database migrations

This package uses [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate) for version-controlled schema changes.

Migrations live in `prisma/migrations/`. Always commit new migration folders with your schema changes.

## Commands (from repo root)

| Command | Purpose |
|---------|---------|
| `pnpm db:migrate` | Create + apply migration after editing `schema.prisma` (development) |
| `pnpm db:migrate:create --name add_foo` | Create migration SQL only, without applying |
| `pnpm db:migrate:deploy` | Apply pending migrations (production, Docker, CI) |
| `pnpm db:migrate:status` | Show which migrations are applied |
| `pnpm db:migrate:reset` | Drop DB and replay all migrations (**dev only**) |
| `pnpm db:migrate:diff` | Print SQL diff between migrations and current schema |
| `pnpm db:generate` | Regenerate Prisma Client after schema changes |
| `pnpm db:studio` | Open Prisma Studio |

All commands load `DATABASE_URL` from the root `.env` file via `scripts/db.mjs`.

## Typical workflow

### 1. Change the schema

Edit `prisma/schema.prisma`.

### 2. Create and apply a migration (local dev)

```bash
pnpm db:migrate --name describe_your_change
```

Example:

```bash
pnpm db:migrate --name add_project_domain
```

Prisma will:

1. Generate SQL in `prisma/migrations/<timestamp>_describe_your_change/`
2. Apply it to your local database
3. Regenerate the client (`postinstall` also runs `db:generate`)

### 3. Commit the migration

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "db: add project domain column"
```

### 4. Deploy to production / staging

```bash
pnpm db:migrate:deploy
```

Or in Docker Compose (runs automatically before `web` and `worker`):

```bash
docker compose -f docker/docker-compose.yml up migrate
```

## Docker

The `migrate` service applies pending migrations once, then exits. `web` and `worker` wait for it to succeed.

```bash
docker compose -f docker/docker-compose.yml up postgres redis -d
docker compose -f docker/docker-compose.yml run --rm migrate
```

## Recovery

If a migration failed mid-deploy:

```bash
# Mark as rolled back, fix SQL, redeploy
node scripts/db.mjs migrate resolve --rolled-back 20250622000000_init
pnpm db:migrate:deploy
```

## Avoid `db push` in shared environments

`pnpm db:push` syncs schema without migration history. Use only for quick local prototyping. Prefer `db:migrate` for any change that should reach production.
