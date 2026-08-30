package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load(".env")
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	ctx := context.Background()
	rows, err := pool.Query(ctx, "SELECT id, name, platform, category, provider_id, provider_service_id FROM pablo_catalog WHERE is_active = true")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	type Item struct {
		id int
		name, platform, category, prov, provSvc string
	}
	var items []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.id, &it.name, &it.platform, &it.category, &it.prov, &it.provSvc); err == nil {
			items = append(items, it)
		}
	}

	fmt.Printf("Total active catalog items: %d\n", len(items))

	fixedCount := 0
	for _, it := range items {
		lower := strings.ToLower(it.name)
		targetPlat := it.platform
		targetCat := it.category

		if strings.Contains(lower, "youtube") {
			targetPlat = "youtube"
			if strings.Contains(lower, "subscriber") || strings.Contains(lower, "subscribers") {
				targetCat = "followers"
			} else if strings.Contains(lower, "view") || strings.Contains(lower, "views") {
				targetCat = "views"
			} else if strings.Contains(lower, "like") || strings.Contains(lower, "likes") {
				targetCat = "likes"
			} else if strings.Contains(lower, "comment") || strings.Contains(lower, "comments") {
				targetCat = "comments"
			} else if strings.Contains(lower, "share") || strings.Contains(lower, "shares") {
				targetCat = "shares"
			}
		} else if strings.Contains(lower, "telegram") {
			targetPlat = "telegram"
			if strings.Contains(lower, "view") || strings.Contains(lower, "views") {
				targetCat = "views"
			} else if strings.Contains(lower, "member") || strings.Contains(lower, "members") {
				targetCat = "followers"
			} else if strings.Contains(lower, "reaction") || strings.Contains(lower, "reactions") {
				targetCat = "reactions"
			} else if strings.Contains(lower, "share") || strings.Contains(lower, "shares") {
				targetCat = "shares"
			}
		} else if strings.Contains(lower, "facebook") {
			targetPlat = "facebook"
			if strings.Contains(lower, "share") || strings.Contains(lower, "shares") {
				targetCat = "shares"
			} else if strings.Contains(lower, "member") || strings.Contains(lower, "members") || strings.Contains(lower, "follower") {
				targetCat = "followers"
			} else if strings.Contains(lower, "like") || strings.Contains(lower, "likes") {
				targetCat = "likes"
			}
		}

		if targetPlat != it.platform || targetCat != it.category {
			fmt.Printf("Fixing #%d: '%s' | was: [%s / %s] -> now: [%s / %s]\n", it.id, it.name, it.platform, it.category, targetPlat, targetCat)
			_, err := pool.Exec(ctx, "UPDATE pablo_catalog SET platform = $1, category = $2 WHERE id = $3", targetPlat, targetCat, it.id)
			if err != nil {
				log.Printf("Error updating #%d: %v", it.id, err)
			} else {
				fixedCount++
			}
		}
	}

	fmt.Printf("✅ Successfully fixed %d miscategorized catalog items!\n", fixedCount)
}
