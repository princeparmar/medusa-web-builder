.DEFAULT_GOAL := help

.PHONY: help env-init setup-server deploy-local deploy logs status ssh health create-admin

help: ## Show available commands
	@grep -hE '^[a-zA-Z0-9_-]+:.*##' $(firstword $(MAKEFILE_LIST)) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Production (app.vyaparnext.com) — PM2, no Docker:"
	@echo "  1. cp .deploy.env.example .deploy.env   # SERVER_PASSWORD + ADMIN_PASSWORD"
	@echo "  2. Cloudflare: A app → SERVER_IP (proxied), SSL mode Full"
	@echo "  3. make setup-server"
	@echo "  4. make deploy-local"
	@echo "  5. make create-admin"
	@echo "  6. Open https://app.vyaparnext.com"

env-init: ## Create .deploy.env from example
	@test -f .deploy.env || cp .deploy.env.example .deploy.env
	@echo "Edit .deploy.env and set SERVER_PASSWORD + ADMIN_PASSWORD"

setup-server: ## Provision VPS: nginx + SSL + Postgres + Node/PM2
	@chmod +x scripts/*.sh
	./scripts/setup-server.sh

deploy-local: ## Build Next standalone locally and deploy to VPS (PM2)
	@chmod +x scripts/deploy-local.sh
	./scripts/deploy-local.sh

deploy: deploy-local ## Alias for deploy-local

create-admin: ## Create super admin on production
	@chmod +x scripts/create-admin-remote.sh
	./scripts/create-admin-remote.sh

logs: ## Tail PM2 web logs on VPS
	@chmod +x scripts/remote.sh
	./scripts/remote.sh 'pm2 logs medusa-web-builder-web --lines 80'

status: ## PM2 + nginx status on VPS
	@chmod +x scripts/remote.sh
	./scripts/remote.sh 'pm2 status; echo; systemctl is-active nginx; curl -sI http://127.0.0.1:$${WEB_PORT:-8020} | head -8'

ssh: ## SSH into the VPS
	@chmod +x scripts/remote.sh
	./scripts/remote.sh

health: ## Hit https://app.vyaparnext.com
	@curl -sI https://app.vyaparnext.com | head -15
