package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

type CatalogBackup struct {
	Timestamp        string                   `json:"timestamp"`
	PabloCatalog     []map[string]interface{} `json:"pablo_catalog"`
	ServiceOverrides []map[string]interface{} `json:"service_overrides"`
	GlobalSettings   []map[string]interface{} `json:"global_settings"`
	SmmProviders     []map[string]interface{} `json:"smm_providers"`
}

func fetchTable(ctx context.Context, pool *pgxpool.Pool, tableName string) ([]map[string]interface{}, error) {
	rows, err := pool.Query(ctx, fmt.Sprintf("SELECT * FROM %s;", tableName))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fields := rows.FieldDescriptions()
	var result []map[string]interface{}

	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, err
		}
		rowMap := make(map[string]interface{})
		for i, field := range fields {
			val := values[i]
			if b, ok := val.([]byte); ok {
				rowMap[string(field.Name)] = string(b)
			} else {
				rowMap[string(field.Name)] = val
			}
		}
		result = append(result, rowMap)
	}
	return result, nil
}

func doBackup(pool *pgxpool.Pool, backupDir string) string {
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	fmt.Printf("\n📦 Creating Full Catalog & Overrides Backup [%s]...\n", timestamp)

	backup := CatalogBackup{Timestamp: timestamp}

	if data, err := fetchTable(context.Background(), pool, "pablo_catalog"); err == nil {
		backup.PabloCatalog = data
		fmt.Printf("  • pablo_catalog: %d services exported\n", len(data))
	}

	if data, err := fetchTable(context.Background(), pool, "service_overrides"); err == nil {
		backup.ServiceOverrides = data
		fmt.Printf("  • service_overrides: %d overrides & badges exported\n", len(data))
	}

	if data, err := fetchTable(context.Background(), pool, "global_settings"); err == nil {
		backup.GlobalSettings = data
		fmt.Printf("  • global_settings: %d settings exported\n", len(data))
	}

	if data, err := fetchTable(context.Background(), pool, "smm_providers"); err == nil {
		backup.SmmProviders = data
		fmt.Printf("  • smm_providers: %d providers exported\n", len(data))
	}

	jsonData, err := json.MarshalIndent(backup, "", "  ")
	if err != nil {
		log.Fatalf("JSON marshal error: %v", err)
	}

	datedFile := filepath.Join(backupDir, fmt.Sprintf("pablo_catalog_backup_%s.json", timestamp))
	latestFile := filepath.Join(backupDir, "pablo_catalog_backup_latest.json")

	if err := os.WriteFile(datedFile, jsonData, 0644); err != nil {
		log.Fatalf("Write file error: %v", err)
	}
	if err := os.WriteFile(latestFile, jsonData, 0644); err != nil {
		log.Fatalf("Write file error: %v", err)
	}

	fmt.Printf("\n✅ Backup successfully saved!\n")
	fmt.Printf("   1. %s\n", datedFile)
	fmt.Printf("   2. %s\n\n", latestFile)
	return datedFile
}

func doRestore(pool *pgxpool.Pool, filePath string) {
	fmt.Printf("\n🔄 Restoring catalog from backup file: %s\n", filePath)

	data, err := os.ReadFile(filePath)
	if err != nil {
		log.Fatalf("Failed to read backup file: %v", err)
	}

	var backup CatalogBackup
	if err := json.Unmarshal(data, &backup); err != nil {
		log.Fatalf("Failed to parse backup JSON: %v", err)
	}

	ctx := context.Background()

	// 1. Restore pablo_catalog
	if len(backup.PabloCatalog) > 0 {
		pool.Exec(ctx, "TRUNCATE TABLE pablo_catalog RESTART IDENTITY CASCADE;")
		for _, row := range backup.PabloCatalog {
			_, err := pool.Exec(ctx, `
				INSERT INTO pablo_catalog (
					id, provider_id, provider_service_id, platform, category, 
					variant_name, name, description, sell_price_inr, 
					is_active, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
			`, row["id"], row["provider_id"], row["provider_service_id"], row["platform"], row["category"],
				row["variant_name"], row["name"], row["description"], row["sell_price_inr"],
				row["is_active"], row["created_at"], row["updated_at"])
			if err != nil {
				log.Printf("Error restoring pablo_catalog row %v: %v", row["id"], err)
			}
		}
		// Reset serial sequence
		pool.Exec(ctx, "SELECT setval(pg_get_serial_sequence('pablo_catalog', 'id'), COALESCE(MAX(id), 1)) FROM pablo_catalog;")
		fmt.Printf("  ✅ Restored %d services to pablo_catalog\n", len(backup.PabloCatalog))
	}

	// 2. Restore service_overrides
	if len(backup.ServiceOverrides) > 0 {
		pool.Exec(ctx, "TRUNCATE TABLE service_overrides RESTART IDENTITY CASCADE;")
		for _, row := range backup.ServiceOverrides {
			var tags []string
			if tagArr, ok := row["tags"].([]interface{}); ok {
				for _, t := range tagArr {
					tags = append(tags, fmt.Sprintf("%v", t))
				}
			}
			_, err := pool.Exec(ctx, `
				INSERT INTO service_overrides (
					service_id, display_name, display_description, 
					category, sub_category, tags, is_hidden, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
			`, row["service_id"], row["display_name"], row["display_description"],
				row["category"], row["sub_category"], tags, row["is_hidden"],
				row["created_at"], row["updated_at"])
			if err != nil {
				log.Printf("Error restoring service_overrides row %v: %v", row["service_id"], err)
			}
		}
		fmt.Printf("  ✅ Restored %d overrides & badges to service_overrides\n", len(backup.ServiceOverrides))
	}

	// 3. Restore global_settings
	if len(backup.GlobalSettings) > 0 {
		for _, row := range backup.GlobalSettings {
			pool.Exec(ctx, `
				INSERT INTO global_settings (key, value, updated_at) 
				VALUES ($1, $2, $3)
				ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
			`, row["key"], row["value"], row["updated_at"])
		}
		fmt.Printf("  ✅ Restored %d settings to global_settings\n", len(backup.GlobalSettings))
	}

	fmt.Printf("\n🎉 Full Restore Completed Successfully!\n\n")
}

func main() {
	restoreFlag := flag.String("restore", "", "Path to backup JSON file to restore (or 'latest' for most recent backup)")
	flag.Parse()

	godotenv.Load(".env")
	godotenv.Load("../../.env")

	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	pool, err := pgxpool.New(context.Background(), dbUrl)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()

	backupDir := "../../backups"
	if _, err := os.Stat(backupDir); os.IsNotExist(err) {
		backupDir = "backups"
	}
	os.MkdirAll(backupDir, 0755)

	if *restoreFlag != "" {
		targetFile := *restoreFlag
		if targetFile == "latest" {
			targetFile = filepath.Join(backupDir, "pablo_catalog_backup_latest.json")
		}
		doRestore(pool, targetFile)
	} else {
		doBackup(pool, backupDir)
	}
}
