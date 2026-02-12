UNAME_S := $(shell uname -s 2>/dev/null || echo "Windows_NT")
UNAME_M := $(shell uname -m 2>/dev/null || echo "x86_64")

.PHONY: help dev build install setup clean clean-binaries

help:
	@echo "WordFormatUI Commands"
	@echo "   make dev      # Start development server"
	@echo "   make build    # Build production version"
	@echo "   make install  # Install dependencies"
	@echo "   make setup    # Fetch latest WordFormat backend binary"
	@echo "   make clean    # Clean node_modules and Rust build cache"

dev:
	npm run tauri dev

build:
	npm run tauri build

install:
	npm install

setup: clean-binaries
	node scripts/setup.js

clean-binaries:
	node scripts/cleanbinary.js
	@echo "Cleaned binaries directory."

clean:
	@echo "Cleaning..."
	node scripts/clean.js
	@echo "Clean complete."