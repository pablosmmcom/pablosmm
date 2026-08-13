package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load("d:/Works/pablosmm/apps/api/.env")
	if err != nil {
		log.Println("No .env found, proceeding")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatal("Failed to connect:", err)
	}
	defer pool.Close()

	rows, err := pool.Query(context.Background(), "SELECT provider_id, provider_service_id, is_active FROM pablo_catalog LIMIT 5;")
	if err != nil {
		log.Fatal("Query failed:", err)
	}
	defer rows.Close()

	fmt.Println("--- pablo_catalog ---")
	for rows.Next() {
		var pid, psid string
		var isact bool
		if err := rows.Scan(&pid, &psid, &isact); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("pid=%s psid=%s active=%v\n", pid, psid, isact)
	}

	rows2, err := pool.Query(context.Background(), "SELECT source_service_id, tags FROM service_overrides ORDER BY updated_at DESC LIMIT 5;")
	if err != nil {
		log.Fatal("Query 2 failed:", err)
	}
	defer rows2.Close()

	fmt.Println("--- service_overrides ---")
	for rows2.Next() {
		var ssid string
		var tags []string
		if err := rows2.Scan(&ssid, &tags); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("ssid=%s tags=%v\n", ssid, tags)
	}
}
