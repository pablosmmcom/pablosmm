package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"pablosmm/backend/internal/config"
	"pablosmm/backend/internal/db/sqlc"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool    *pgxpool.Pool
	Queries *sqlc.Queries
}

func New(cfg *config.Config) (*DB, error) {
	ctx := context.Background()

	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse database url: %v", err)
	}

	// Neon Connection Pooler (PgBouncer) compatibility:
	// Use CacheDescribe to enable binary protocol streaming while remaining compatible with PgBouncer transaction pooling
	poolConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeCacheDescribe

	// Sizing and connection lifetime parameters
	poolConfig.MaxConns = 25
	poolConfig.MinConns = 3
	poolConfig.MaxConnLifetime = 1 * time.Hour
	poolConfig.MaxConnIdleTime = 15 * time.Minute
	poolConfig.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("unable to ping database: %v", err)
	}

	log.Println("Successfully connected to PostgreSQL")

	// Ensure critical performance indexes on startup
	go func() {
		initCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		_, _ = pool.Exec(initCtx, `
			CREATE INDEX IF NOT EXISTS idx_pablo_catalog_active ON pablo_catalog (is_active, created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_pablo_catalog_prov_svc ON pablo_catalog (provider_id, provider_service_id);
			CREATE INDEX IF NOT EXISTS idx_service_overrides_source_id ON service_overrides (source_service_id);
		`)
	}()

	queries := sqlc.New(pool)

	return &DB{Pool: pool, Queries: queries}, nil
}

func (db *DB) Close() {
	db.Pool.Close()
}

