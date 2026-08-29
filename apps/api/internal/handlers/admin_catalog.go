package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/go-chi/chi/v5"
)

type CatalogServicePayload struct {
	Name              string   `json:"name"`
	VariantName       string   `json:"variantName"`
	SellPriceInr      float64  `json:"sellPriceInr"`
	Platform          string   `json:"platform"`
	Category          string   `json:"category"`
	ProviderID        string   `json:"providerId"`
	ProviderServiceID string   `json:"providerServiceId"`
	IsActive          bool     `json:"isActive"`
	Description       string   `json:"description,omitempty"`
	Tags              []string `json:"tags,omitempty"`
}

type CatalogServiceResponse struct {
	ID                int32    `json:"id"`
	Name              string   `json:"name"`
	VariantName       string   `json:"variant_name"`
	SellPriceInr      float64  `json:"sell_price_inr"`
	Platform          string   `json:"platform"`
	Category          string   `json:"category"`
	Variant           string   `json:"variant,omitempty"`
	Description       string   `json:"description,omitempty"`
	Tags              []string `json:"tags,omitempty"`
	IsActive          bool     `json:"is_active"`
	ProviderID        string   `json:"provider_id"`
	ProviderServiceID string   `json:"provider_service_id"`
}

type catalogCache struct {
	mu         sync.RWMutex
	data       []CatalogServiceResponse
	lastUpdate time.Time
}

var adminCatalogCache catalogCache

func InvalidateAdminCatalogCache() {
	adminCatalogCache.mu.Lock()
	adminCatalogCache.data = nil
	adminCatalogCache.lastUpdate = time.Time{}
	adminCatalogCache.mu.Unlock()
}

func (h *Handler) GetCatalogServicesAdmin(w http.ResponseWriter, r *http.Request) {
	forceRefresh := r.URL.Query().Get("refresh") == "true"

	adminCatalogCache.mu.RLock()
	if !forceRefresh && time.Since(adminCatalogCache.lastUpdate) < 5*time.Minute && len(adminCatalogCache.data) > 0 {
		cached := adminCatalogCache.data
		adminCatalogCache.mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cached)
		return
	}
	adminCatalogCache.mu.RUnlock()

	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT 
			id, 
			name, 
			COALESCE(variant_name, ''), 
			COALESCE(sell_price_inr, 0), 
			COALESCE(platform, ''), 
			COALESCE(category, ''), 
			COALESCE(is_active, true), 
			COALESCE(NULLIF(provider_id, ''), 'topsmm'), 
			COALESCE(provider_service_id, ''),
			COALESCE(description, ''),
			COALESCE(tags, '{}'::text[])
		FROM pablo_catalog
		WHERE is_active = true
		ORDER BY created_at DESC;
	`)
	if err != nil {
		log.Printf("ERROR [GetCatalogServicesAdmin] Query failed: %v", err)
		http.Error(w, fmt.Sprintf("Failed to load catalog services: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	res := make([]CatalogServiceResponse, 0)
	for rows.Next() {
		var id int32
		var name, variantName, platform, category, provID, cleanSvcID, desc string
		var priceNumeric pgtype.Numeric
		var isActive bool
		var tags []string

		if err := rows.Scan(&id, &name, &variantName, &priceNumeric, &platform, &category, &isActive, &provID, &cleanSvcID, &desc, &tags); err != nil {
			log.Printf("ERROR [GetCatalogServicesAdmin] Scan failed: %v", err)
			continue
		}

		var price float64
		if priceNumeric.Valid {
			f, _ := priceNumeric.Float64Value()
			price = f.Float64
		}

		var subCatVariant string
		for _, t := range tags {
			if strings.HasPrefix(t, "variant:") {
				subCatVariant = strings.TrimPrefix(t, "variant:")
			}
		}

		res = append(res, CatalogServiceResponse{
			ID:                id,
			Name:              name,
			VariantName:       variantName,
			SellPriceInr:      price,
			Platform:          platform,
			Category:          category,
			Variant:           subCatVariant,
			Description:       desc,
			Tags:              tags,
			IsActive:          isActive,
			ProviderID:        provID,
			ProviderServiceID: cleanSvcID,
		})
	}

	adminCatalogCache.mu.Lock()
	adminCatalogCache.data = res
	adminCatalogCache.lastUpdate = time.Now()
	adminCatalogCache.mu.Unlock()

	json.NewEncoder(w).Encode(res)
	log.Printf("⏱️ [GetCatalogServicesAdmin] Loaded %d items in %v and cached in memory", len(res), time.Since(start))
}

func (h *Handler) CreateCatalogServiceAdmin(w http.ResponseWriter, r *http.Request) {
	var p CatalogServicePayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	priceNumeric := pgtype.Numeric{}
	priceNumeric.Scan(strconv.FormatFloat(p.SellPriceInr, 'f', 2, 64))

	provKey := p.ProviderID
	if provKey == "" {
		provKey = "topsmm"
	}

	var newID int32
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO pablo_catalog (
			name, variant_name, sell_price_inr, platform, category, provider_id, provider_service_id, is_active, description, tags, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP
		)
		RETURNING id;
	`, p.Name, p.VariantName, priceNumeric, p.Platform, p.Category, provKey, p.ProviderServiceID, p.IsActive, p.Description, p.Tags).Scan(&newID)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if p.Description != "" && p.ProviderServiceID != "" {
		fullSID := fmt.Sprintf("%s:%s", provKey, p.ProviderServiceID)
		_, _ = h.db.Pool.Exec(r.Context(), `
			INSERT INTO service_overrides (source_service_id, display_name, display_description, updated_at)
			VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
			ON CONFLICT (source_service_id)
			DO UPDATE SET display_description = EXCLUDED.display_description, updated_at = CURRENT_TIMESTAMP;
		`, fullSID, p.Name, p.Description)
		_, _ = h.db.Pool.Exec(r.Context(), `
			INSERT INTO service_overrides (source_service_id, display_name, display_description, updated_at)
			VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
			ON CONFLICT (source_service_id)
			DO UPDATE SET display_description = EXCLUDED.display_description, updated_at = CURRENT_TIMESTAMP;
		`, p.ProviderServiceID, p.Name, p.Description)
	}

	h.smm.InvalidateCache()
	InvalidateAdminCatalogCache()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":                  newID,
		"name":                p.Name,
		"variant_name":        p.VariantName,
		"sell_price_inr":      p.SellPriceInr,
		"platform":            p.Platform,
		"category":            p.Category,
		"is_active":           p.IsActive,
		"provider_id":         provKey,
		"provider_service_id": p.ProviderServiceID,
		"description":         p.Description,
		"tags":                p.Tags,
	})
}

func (h *Handler) UpdateCatalogServiceAdmin(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var p CatalogServicePayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	priceNumeric := pgtype.Numeric{}
	priceNumeric.Scan(strconv.FormatFloat(p.SellPriceInr, 'f', 2, 64))

	provKey := p.ProviderID
	if provKey == "" {
		provKey = "topsmm"
	}

	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE pablo_catalog
		SET 
			name = $2,
			variant_name = $3,
			sell_price_inr = $4,
			platform = $5,
			category = $6,
			provider_id = $7,
			provider_service_id = $8,
			is_active = $9,
			description = $10,
			tags = $11,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1;
	`, id, p.Name, p.VariantName, priceNumeric, p.Platform, p.Category, provKey, p.ProviderServiceID, p.IsActive, p.Description, p.Tags)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if p.Description != "" && p.ProviderServiceID != "" {
		fullSID := fmt.Sprintf("%s:%s", provKey, p.ProviderServiceID)
		_, _ = h.db.Pool.Exec(r.Context(), `
			INSERT INTO service_overrides (source_service_id, display_name, display_description, updated_at)
			VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
			ON CONFLICT (source_service_id)
			DO UPDATE SET display_description = EXCLUDED.display_description, updated_at = CURRENT_TIMESTAMP;
		`, fullSID, p.Name, p.Description)
		_, _ = h.db.Pool.Exec(r.Context(), `
			INSERT INTO service_overrides (source_service_id, display_name, display_description, updated_at)
			VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
			ON CONFLICT (source_service_id)
			DO UPDATE SET display_description = EXCLUDED.display_description, updated_at = CURRENT_TIMESTAMP;
		`, p.ProviderServiceID, p.Name, p.Description)
	}

	h.smm.InvalidateCache()
	InvalidateAdminCatalogCache()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":                  id,
		"name":                p.Name,
		"variant_name":        p.VariantName,
		"sell_price_inr":      p.SellPriceInr,
		"platform":            p.Platform,
		"category":            p.Category,
		"is_active":           p.IsActive,
		"provider_id":         provKey,
		"provider_service_id": p.ProviderServiceID,
		"description":         p.Description,
		"tags":                p.Tags,
	})
}

func (h *Handler) DeleteCatalogServiceAdmin(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)

	if err == nil && id > 0 {
		// Look up the row first to find its provider_service_id
		var provID, provSvcID pgtype.Text
		rowErr := h.db.Pool.QueryRow(context.Background(), `SELECT provider_id, provider_service_id FROM pablo_catalog WHERE id = $1`, id).Scan(&provID, &provSvcID)
		
		// Delete by primary key ID strictly
		_, err = h.db.Pool.Exec(context.Background(), `DELETE FROM pablo_catalog WHERE id = $1;`, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if rowErr == nil && provSvcID.Valid && provSvcID.String != "" {
			sid := provSvcID.String
			pid := "topsmm"
			if provID.Valid && provID.String != "" {
				pid = provID.String
			}
			fullSID := fmt.Sprintf("%s:%s", pid, sid)
			_, _ = h.db.Pool.Exec(context.Background(), `
				UPDATE service_overrides 
				SET is_hidden = true, updated_at = CURRENT_TIMESTAMP 
				WHERE source_service_id = $1 OR source_service_id = $2;
			`, sid, fullSID)
		}
	} else {
		// If non-numeric ID passed, delete strictly by provider_service_id
		cleanSID := idStr
		if strings.Contains(cleanSID, ":") {
			parts := strings.SplitN(cleanSID, ":", 2)
			cleanSID = parts[1]
		}
		_, err = h.db.Pool.Exec(context.Background(), `
			DELETE FROM pablo_catalog 
			WHERE provider_service_id = $1 
			   OR provider_service_id = 'topsmm:' || $1
			   OR provider_service_id = 'pablosmm:' || $1;
		`, cleanSID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		_, _ = h.db.Pool.Exec(context.Background(), `
			UPDATE service_overrides 
			SET is_hidden = true, updated_at = CURRENT_TIMESTAMP 
			WHERE source_service_id = $1 
			   OR source_service_id = 'topsmm:' || $1
			   OR source_service_id = 'pablosmm:' || $1;
		`, cleanSID)
	}

	h.smm.InvalidateCache()
	InvalidateAdminCatalogCache()
	w.WriteHeader(http.StatusOK)
}

