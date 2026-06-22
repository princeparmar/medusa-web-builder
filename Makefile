.PHONY: up up-infra db-migrate db-migrate-status db-migrate-reset db-studio db-generate

COMPOSE = docker compose -f docker/docker-compose.yml

up-infra:
	$(COMPOSE) up postgres redis mailpit -d

up: up-infra
	$(COMPOSE) up --build

db-migrate:
	pnpm db:migrate:deploy

db-migrate-dev:
	pnpm db:migrate

db-migrate-status:
	pnpm db:migrate:status

db-migrate-reset:
	pnpm db:migrate:reset

db-studio:
	pnpm db:studio

db-generate:
	pnpm db:generate

# Run migrations inside Docker (same as compose migrate service)
db-migrate-docker:
	$(COMPOSE) run --rm migrate
