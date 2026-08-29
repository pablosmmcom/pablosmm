# PabloSMM API Makefile
# Go backend build and run targets

# Force Windows Make to use cmd.exe
SHELL := cmd.exe

.PHONY: dev build run clean migrate docker help

APP_NAME  = server
MAIN_PATH = ./cmd/server/main.go

# ─── Development ─────────────────────────────────────────────

## Run the API server in development mode
dev:
	go run $(MAIN_PATH)

# ─── Build ───────────────────────────────────────────────────

## Build the Go binary
build:
	set CGO_ENABLED=0&& go build -o $(APP_NAME) $(MAIN_PATH)

## Build and run
run: build
	./$(APP_NAME)

# ─── Database ────────────────────────────────────────────────

## Run database migrations
migrate:
	go run ./cmd/goose/main.go up

## Backup catalog, overrides, and settings to JSON
backup:
	go run ./cmd/backup/main.go

## Restore catalog, overrides, and settings from latest JSON backup
restore:
	go run ./cmd/backup/main.go -restore latest

# ─── Docker ──────────────────────────────────────────────────

## Build Docker image
docker:
	docker build -t pablosmm-api .

# ─── Cleanup ─────────────────────────────────────────────────

## Remove build artifacts
clean:
	rm -f $(APP_NAME) $(APP_NAME).exe *.log

# ─── Help ────────────────────────────────────────────────────

## Show this help
help:
	@echo ""
	@echo "PabloSMM API"
	@echo "============"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  dev       Run server in dev mode (go run)"
	@echo "  build     Build Go binary"
	@echo "  run       Build and run"
	@echo "  migrate   Run database migrations"
	@echo "  docker    Build Docker image"
	@echo "  clean     Remove build artifacts"
	@echo "  help      Show this help"
	@echo ""
