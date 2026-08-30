package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}
	defer db.Close()

	ctx := context.Background()

	// 1. Alter users table column default to INR
	_, err = db.ExecContext(ctx, "ALTER TABLE users ALTER COLUMN currency SET DEFAULT 'INR';")
	if err != nil {
		log.Printf("Alter default error: %v", err)
	} else {
		fmt.Println("✅ Altered users table default currency to INR")
	}

	// 2. Update existing users with USD, empty, or NULL to INR
	res, err := db.ExecContext(ctx, "UPDATE users SET currency = 'INR' WHERE currency = 'USD' OR currency IS NULL OR currency = '';")
	if err != nil {
		log.Fatalf("Update users failed: %v", err)
	}
	rows, _ := res.RowsAffected()
	fmt.Printf("✅ Updated %d user records from USD/NULL to INR\n", rows)
}
