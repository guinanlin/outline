up:
	docker compose up -d redis postgres
	yarn install-local-ssl
	yarn install --immutable
	yarn dev:watch

build:
	@echo "生成 SSL 证书..."
	@LOCAL_NETWORK=192.168.0.0/16 yarn install-local-ssl || true
	@echo "构建 Docker 镜像..."
	docker compose build --pull outline

test:
	docker compose up -d postgres
	NODE_ENV=test yarn sequelize db:drop
	NODE_ENV=test yarn sequelize db:create
	NODE_ENV=test yarn sequelize db:migrate
	yarn test

watch:
	docker compose up -d redis postgres
	NODE_ENV=test yarn sequelize db:drop
	NODE_ENV=test yarn sequelize db:create
	NODE_ENV=test yarn sequelize db:migrate
	yarn test:watch

destroy:
	docker compose stop
	docker compose rm -f

.PHONY: up build destroy test watch # let's go to reserve rules names
