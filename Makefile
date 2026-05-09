.PHONY: help dev backend electron build install clean

help:
	@echo "WordFormatUI Commands"
	@echo "   make dev              # Start Vite dev server (browser only)"
	@echo "   make electron         # Start Electron dev mode"
	@echo "   make backend          # 构建后端 Python 运行时 (读取 .backend-version)"
	@echo "   make backend VER=github:v1.1.3  # 指定版本构建"
	@echo "   make build            # 构建并打包分发版"
	@echo "   make install          # Install dependencies"
	@echo "   make clean            # Clean build artifacts"

dev:
	npm run dev

electron:
	npm run electron:dev

backend:
	node scripts/build-backend.cjs $(if $(VER),--ver $(VER),)

build:
	npm run electron:build

install:
	npm install

clean:
	@echo "Cleaning..."
	rm -rf dist release node_modules/.vite
	@echo "Clean complete."
