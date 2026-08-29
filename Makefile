# PabloSMM Monorepo Makefile
# Usage: make <target>

# Force Windows Make to use cmd.exe instead of looking for /bin/bash
SHELL := cmd.exe

.PHONY: dev dev-web dev-api build build-web build-api install lint clean docker-api help

# ─── Development ─────────────────────────────────────────────

## Start both frontend and backend in parallel
dev:
	@echo "Starting frontend and backend..."
	@$(MAKE) dev-api & $(MAKE) dev-web

## Start Next.js dev server
dev-web:
	cd apps/web && npm run dev

## Start Go backend server
dev-api:
	cd apps/api && $(MAKE) dev

## Backup catalog, overrides, and settings to JSON
backup:
	cd apps/api && $(MAKE) backup

## Restore catalog, overrides, and settings from latest JSON backup
restore:
	cd apps/api && $(MAKE) restore

# ─── Build ───────────────────────────────────────────────────

## Build all
build: build-web build-api

## Build Next.js production bundle
build-web:
	cd apps/web && npm run build

## Build Go binary
build-api:
	cd apps/api && $(MAKE) build

# ─── Setup ───────────────────────────────────────────────────

## Install all dependencies
install:
	cd apps/web && npm install

## Lint frontend code
lint:
	cd apps/web && npm run lint

# ─── Docker ──────────────────────────────────────────────────

## Build API Docker image
docker-api:
	cd apps/api && $(MAKE) docker

# ─── Cleanup ─────────────────────────────────────────────────

## Clean all build artifacts
clean:
	cd apps/web && rm -rf .next node_modules
	cd apps/api && $(MAKE) clean

# ─── Help ────────────────────────────────────────────────────

## Show this help
help:
	@echo ""
	@echo "PabloSMM Monorepo"
	@echo "================="
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Development:"
	@echo "  dev          Start frontend + backend (parallel)"
	@echo "  dev-web      Start Next.js dev server only"
	@echo "  dev-api      Start Go backend only"
	@echo ""
	@echo "Build:"
	@echo "  build        Build all"
	@echo "  build-web    Build Next.js production bundle"
	@echo "  build-api    Build Go binary"
	@echo ""
	@echo "Setup:"
	@echo "  install      Install web dependencies (npm install)"
	@echo "  lint         Lint frontend code"
	@echo ""
	@echo "Docker:"
	@echo "  docker-api   Build API Docker image"
	@echo ""
	@echo "Other:"
	@echo "  clean        Clean all build artifacts"
	@echo "  help         Show this help"
	@echo ""
