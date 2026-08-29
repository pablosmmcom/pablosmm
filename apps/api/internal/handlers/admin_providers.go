package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"pablosmm/backend/internal/db/sqlc"
	"pablosmm/backend/internal/provider"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func maskAPIKey(key string) string {
	if len(key) == 0 {
		return ""
	}
	if len(key) <= 4 {
		return "••••••••"
	}
	return "••••••••" + key[len(key)-4:]
}

type SanitizedSmmProvider struct {
	ID        int32              `json:"id"`
	Key       string             `json:"key"`
	Name      string             `json:"name"`
	ApiUrl    string             `json:"api_url"`
	ApiKey    string             `json:"api_key"`
	Currency  string             `json:"currency"`
	IsActive  bool               `json:"is_active"`
	CreatedAt pgtype.Timestamptz `json:"created_at"`
	UpdatedAt pgtype.Timestamptz `json:"updated_at"`
}

func (h *Handler) GetAdminServices(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("refresh") == "true" {
		h.smm.InvalidateCache()
	}
	services, err := h.smm.FetchServices()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"services": services,
	})
}

func (h *Handler) ListProvidersAdmin(w http.ResponseWriter, r *http.Request) {
	providers, err := h.db.Queries.ListSmmProvidersAdmin(context.Background())
	if err != nil {
		log.Printf("ERROR: ListSmmProvidersAdmin query failed: %v", err)
		providers = []sqlc.SmmProvider{}
	}

	if len(providers) == 0 {
		apiUrl := h.cfg.SMMAPIURL
		if apiUrl == "" {
			apiUrl = provider.DefaultAPIURL
		}
		apiKey := h.cfg.SMMAPIKey
		if apiKey == "" {
			apiKey = "configured_in_env"
		}
		p, err := h.db.Queries.UpsertSmmProvider(context.Background(), sqlc.UpsertSmmProviderParams{
			Key:      provider.DefaultKey,
			Name:     provider.DefaultName,
			ApiUrl:   apiUrl,
			ApiKey:   apiKey,
			Currency: provider.DefaultCurrency,
			IsActive: true,
		})
		if err != nil {
			log.Printf("ERROR: Failed to auto-seed default TOPSMM provider to DB: %v", err)
			providers = []sqlc.SmmProvider{
				{
					ID:       1,
					Key:      provider.DefaultKey,
					Name:     provider.DefaultName,
					ApiUrl:   apiUrl,
					ApiKey:   apiKey,
					Currency: provider.DefaultCurrency,
					IsActive: true,
				},
			}
		} else {
			providers = []sqlc.SmmProvider{p}
		}
	}

	sanitized := make([]SanitizedSmmProvider, len(providers))
	for i, p := range providers {
		sanitized[i] = SanitizedSmmProvider{
			ID:        p.ID,
			Key:       p.Key,
			Name:      p.Name,
			ApiUrl:    p.ApiUrl,
			ApiKey:    maskAPIKey(p.ApiKey),
			Currency:  p.Currency,
			IsActive:  p.IsActive,
			CreatedAt: p.CreatedAt,
			UpdatedAt: p.UpdatedAt,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sanitized)
}

func (h *Handler) UpsertProviderAdmin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Key      string `json:"key"`
		Name     string `json:"name"`
		ApiUrl   string `json:"api_url"`
		ApiKey   string `json:"api_key"`
		Currency string `json:"currency"`
		IsActive bool   `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	finalApiKey := strings.TrimSpace(body.ApiKey)
	if strings.Contains(finalApiKey, "•") || finalApiKey == "" {
		existing, err := h.db.Queries.GetSmmProviderByKey(context.Background(), body.Key)
		if err == nil && existing.ApiKey != "" {
			finalApiKey = existing.ApiKey
		}
	}

	if body.Key == "" || body.Name == "" || body.ApiUrl == "" || finalApiKey == "" {
		http.Error(w, "Key, Name, ApiUrl, and valid ApiKey are required", http.StatusBadRequest)
		return
	}

	if body.Currency == "" {
		body.Currency = "USD"
	}

	provider, err := h.db.Queries.UpsertSmmProvider(context.Background(), sqlc.UpsertSmmProviderParams{
		Key:      body.Key,
		Name:     body.Name,
		ApiUrl:   body.ApiUrl,
		ApiKey:   finalApiKey,
		Currency: body.Currency,
		IsActive: body.IsActive,
	})

	if err != nil {
		http.Error(w, "Failed to save provider: "+err.Error(), http.StatusInternalServerError)
		return
	}

	h.smm.InvalidateCache()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SanitizedSmmProvider{
		ID:        provider.ID,
		Key:       provider.Key,
		Name:      provider.Name,
		ApiUrl:    provider.ApiUrl,
		ApiKey:    maskAPIKey(provider.ApiKey),
		Currency:  provider.Currency,
		IsActive:  provider.IsActive,
		CreatedAt: provider.CreatedAt,
		UpdatedAt: provider.UpdatedAt,
	})
}

func (h *Handler) DeleteProviderAdmin(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid provider ID", http.StatusBadRequest)
		return
	}

	err = h.db.Queries.DeleteSmmProvider(context.Background(), int32(id))
	if err != nil {
		http.Error(w, "Failed to delete provider: "+err.Error(), http.StatusInternalServerError)
		return
	}

	h.smm.InvalidateCache()
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

type CurateServiceUpdate struct {
	ID                        string   `json:"id"`
	Name                      *string  `json:"name,omitempty"`
	Status                    string   `json:"status"`
	DisplayName               *string  `json:"displayName,omitempty"`
	Description               *string  `json:"description,omitempty"`
	DisplayDescription        *string  `json:"displayDescription,omitempty"`
	Min                       *int64   `json:"min,omitempty"`
	Max                       *int64   `json:"max,omitempty"`
	Refill                    *bool    `json:"refill,omitempty"`
	Cancel                    *bool    `json:"cancel,omitempty"`
	Quality                   *string  `json:"quality,omitempty"`
	Stability                 *string  `json:"stability,omitempty"`
	Badge                     *string  `json:"badge,omitempty"`
	RefillTag                 *string  `json:"refillTag,omitempty"` // legacy, soon to be VariantName
	VariantName               *string  `json:"variantName,omitempty"`
	Variant                   *string  `json:"variant,omitempty"`
	SellPriceINR              *float64 `json:"sellPriceInr,omitempty"`
	Platform                  string   `json:"platform,omitempty"`
	Category                  string   `json:"category,omitempty"`
	IsProviderSubmission      bool     `json:"isProviderSubmission,omitempty"`
	ApproveProviderSubmission bool     `json:"approveProviderSubmission,omitempty"`
	RejectProviderSubmission  bool     `json:"rejectProviderSubmission,omitempty"`
}

func (h *Handler) CurateServicesAdmin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var body struct {
		ProviderName string                 `json:"providerName"`
		Updates      []CurateServiceUpdate  `json:"updates"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body: " + err.Error()})
		return
	}

	if len(body.Updates) == 0 {
		json.NewEncoder(w).Encode(map[string]string{"status": "success", "count": "0"})
		return
	}

	providerID := body.ProviderName
	if providerID == "" || providerID == "pablosmm" {
		providerID = "topsmm"
	}

	queryCatalogUpsert := `INSERT INTO pablo_catalog (
		name, variant_name, sell_price_inr, platform, category, provider_id, provider_service_id, is_active, description, tags, updated_at
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP
	)
	ON CONFLICT (provider_id, provider_service_id)
	DO UPDATE SET
		name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE pablo_catalog.name END,
		variant_name = CASE WHEN EXCLUDED.variant_name != '' THEN EXCLUDED.variant_name ELSE pablo_catalog.variant_name END,
		sell_price_inr = CASE WHEN EXCLUDED.sell_price_inr > 0 THEN EXCLUDED.sell_price_inr ELSE pablo_catalog.sell_price_inr END,
		platform = CASE WHEN EXCLUDED.platform != '' THEN EXCLUDED.platform ELSE pablo_catalog.platform END,
		category = CASE WHEN EXCLUDED.category != '' THEN EXCLUDED.category ELSE pablo_catalog.category END,
		is_active = EXCLUDED.is_active,
		description = CASE WHEN EXCLUDED.description != '' THEN EXCLUDED.description ELSE pablo_catalog.description END,
		tags = CASE WHEN cardinality(EXCLUDED.tags) > 0 THEN EXCLUDED.tags ELSE pablo_catalog.tags END,
		updated_at = CURRENT_TIMESTAMP;`

	// Query for direct/approved edits (modifies live store status)
	queryDirect := `INSERT INTO service_overrides (
		source_service_id, display_name, display_description, rate_multiplier, is_hidden, 
		category, tags, provider_category, display_id, 
		refill, cancel, dripfeed, service_type,
		targeting, quality, stability, refill_limit, custom_input_required, custom_input_label, updated_at
	)
	VALUES ($1, COALESCE($2, ''), COALESCE($11, ''), CASE WHEN $3 > 0 THEN $3 ELSE 1.0 END, $4::boolean, COALESCE($9, ''), COALESCE($5, '{}'::text[]), '', '', $6::boolean, $7::boolean, false, '', '', COALESCE($8, ''), COALESCE($10, ''), 3, false, '', CURRENT_TIMESTAMP)
	ON CONFLICT (source_service_id) 
	DO UPDATE SET 
		display_name = CASE WHEN EXCLUDED.display_name != '' THEN EXCLUDED.display_name ELSE service_overrides.display_name END,
		display_description = CASE WHEN EXCLUDED.display_description != '' THEN EXCLUDED.display_description ELSE service_overrides.display_description END,
		is_hidden = EXCLUDED.is_hidden,
		category = CASE WHEN EXCLUDED.category != '' THEN EXCLUDED.category ELSE service_overrides.category END,
		tags = EXCLUDED.tags,
		refill = CASE WHEN $6::boolean IS NOT NULL THEN EXCLUDED.refill ELSE service_overrides.refill END,
		cancel = CASE WHEN $7::boolean IS NOT NULL THEN EXCLUDED.cancel ELSE service_overrides.cancel END,
		quality = CASE WHEN EXCLUDED.quality != '' THEN EXCLUDED.quality ELSE service_overrides.quality END,
		stability = CASE WHEN EXCLUDED.stability != '' THEN EXCLUDED.stability ELSE service_overrides.stability END,
		updated_at = CURRENT_TIMESTAMP;`

	// Single item approval query: promotes proposed tags to live tags and sets is_hidden
	queryApproveSingle := `UPDATE service_overrides 
	SET is_hidden = $2::boolean,
	    tags = ARRAY(
			SELECT DISTINCT 
				CASE 
					WHEN elem LIKE 'proposed_min:%' THEN replace(elem, 'proposed_min:', 'min:')
					WHEN elem LIKE 'proposed_max:%' THEN replace(elem, 'proposed_max:', 'max:')
					WHEN elem LIKE 'proposed_refill:%' THEN replace(elem, 'proposed_refill:', 'refill:')
					WHEN elem LIKE 'proposed_quality:%' THEN replace(elem, 'proposed_quality:', 'quality:')
					ELSE elem
				END
			FROM unnest(array_cat(
				ARRAY(SELECT elem FROM unnest(tags) elem WHERE elem NOT LIKE 'proposed_%' AND elem != 'provider_pending:true' AND elem NOT LIKE 'provider_status:%'),
				$3::text[]
			)) elem
	    ),
	    updated_at = CURRENT_TIMESTAMP
	WHERE source_service_id = $1;`

	// Single item rejection query: strips all proposed_* and provider_pending tags, and sets is_hidden
	queryRejectSingle := `INSERT INTO service_overrides (
		source_service_id, is_hidden, tags, updated_at
	)
	VALUES ($1, $2::boolean, '{}'::text[], CURRENT_TIMESTAMP)
	ON CONFLICT (source_service_id)
	DO UPDATE SET 
		is_hidden = EXCLUDED.is_hidden,
		tags = ARRAY(
			SELECT elem FROM unnest(COALESCE(service_overrides.tags, '{}'::text[])) elem 
			WHERE elem NOT LIKE 'proposed_%' 
			  AND elem != 'provider_pending:true'
			  AND elem NOT LIKE 'provider_status:%'
		),
		updated_at = CURRENT_TIMESTAMP;`

	queryProviderStaging := `INSERT INTO service_overrides (
		source_service_id, display_name, display_description, rate_multiplier, is_hidden, 
		category, tags, provider_category, display_id, 
		refill, cancel, dripfeed, service_type,
		targeting, quality, stability, refill_limit, custom_input_required, custom_input_label, updated_at
	)
	VALUES ($1, COALESCE($2, ''), COALESCE($11, ''), CASE WHEN $3 > 0 THEN $3 ELSE 1.0 END, $4::boolean, COALESCE($9, ''), COALESCE($5, '{}'::text[]), '', '', $6::boolean, $7::boolean, false, '', '', COALESCE($8, ''), COALESCE($10, ''), 3, false, '', CURRENT_TIMESTAMP)
	ON CONFLICT (source_service_id) 
	DO UPDATE SET 
		display_description = CASE WHEN EXCLUDED.display_description != '' THEN EXCLUDED.display_description ELSE service_overrides.display_description END,
		tags = ARRAY(
			SELECT DISTINCT elem FROM unnest(array_cat(service_overrides.tags, EXCLUDED.tags)) elem
		),
		refill = CASE WHEN $6::boolean IS NOT NULL THEN EXCLUDED.refill ELSE service_overrides.refill END,
		cancel = CASE WHEN $7::boolean IS NOT NULL THEN EXCLUDED.cancel ELSE service_overrides.cancel END,
		quality = CASE WHEN EXCLUDED.quality != '' THEN EXCLUDED.quality ELSE service_overrides.quality END,
		stability = CASE WHEN EXCLUDED.stability != '' THEN EXCLUDED.stability ELSE service_overrides.stability END,
		updated_at = CURRENT_TIMESTAMP;`

	batch := &pgx.Batch{}

	for _, item := range body.Updates {
		isHidden := item.Status == "hidden"
		var tags []string

		if item.IsProviderSubmission {
			tags = append(tags, "provider_pending:true", "proposed_status:"+item.Status)
			if item.RefillTag != nil && *item.RefillTag != "auto" {
				tags = append(tags, "proposed_refill:"+*item.RefillTag)
			}
			if item.Quality != nil && *item.Quality != "default" {
				tags = append(tags, "proposed_quality:"+*item.Quality)
			}
			if item.Min != nil && *item.Min > 0 {
				tags = append(tags, fmt.Sprintf("proposed_min:%d", *item.Min))
			}
			if item.Max != nil && *item.Max > 0 {
				tags = append(tags, fmt.Sprintf("proposed_max:%d", *item.Max))
			}
			if item.Cancel != nil {
				tags = append(tags, fmt.Sprintf("proposed_cancel:%t", *item.Cancel))
			}
		} else {
			if item.RefillTag != nil && *item.RefillTag != "auto" {
				tags = append(tags, "refill:"+*item.RefillTag)
			}
			if item.Quality != nil && *item.Quality != "default" {
				tags = append(tags, "quality:"+*item.Quality)
			}
			if item.Min != nil && *item.Min > 0 {
				tags = append(tags, fmt.Sprintf("min:%d", *item.Min))
			}
			if item.Max != nil && *item.Max > 0 {
				tags = append(tags, fmt.Sprintf("max:%d", *item.Max))
			}
		}

		if item.Platform != "" && item.Platform != "other" {
			tags = append(tags, "platform:"+item.Platform)
		}
		if item.Category != "" && item.Category != "other" && item.Category != "default" {
			tags = append(tags, "category:"+item.Category)
		}
		
		if item.VariantName != nil && *item.VariantName != "" {
			tags = append(tags, "variant_name:"+*item.VariantName)
		}
		if item.Variant != nil && *item.Variant != "" {
			tags = append(tags, "variant:"+*item.Variant)
		}
		if item.SellPriceINR != nil {
			tags = append(tags, fmt.Sprintf("sell_price_inr:%.2f", *item.SellPriceINR))
		}
		if item.Stability != nil && *item.Stability != "" && *item.Stability != "auto" {
			tags = append(tags, "stability:"+*item.Stability)
		}
		if item.Badge != nil && *item.Badge != "" && *item.Badge != "auto" {
			tags = append(tags, "badge:"+*item.Badge)
		}

		displayNameVal := ""
		if item.DisplayName != nil {
			displayNameVal = *item.DisplayName
		}

		descriptionVal := ""
		if item.DisplayDescription != nil && *item.DisplayDescription != "" {
			descriptionVal = *item.DisplayDescription
		} else if item.Description != nil {
			descriptionVal = *item.Description
		}

		qualityVal := ""
		if item.Quality != nil {
			qualityVal = *item.Quality
		}

		stabilityVal := ""
		if item.Stability != nil {
			stabilityVal = *item.Stability
		}

		var refillVal *bool
		if item.Refill != nil {
			refillVal = item.Refill
		}

		var cancelVal *bool
		if item.Cancel != nil {
			cancelVal = item.Cancel
		}

		if item.ApproveProviderSubmission {
			batch.Queue(queryApproveSingle, item.ID, isHidden, tags)
			if strings.Contains(item.ID, ":") {
				parts := strings.SplitN(item.ID, ":", 2)
				batch.Queue(queryApproveSingle, parts[1], isHidden, tags)
			} else {
				fullID := "topsmm:" + item.ID
				batch.Queue(queryApproveSingle, fullID, isHidden, tags)
			}
		} else if item.RejectProviderSubmission {
			batch.Queue(queryRejectSingle, item.ID, isHidden)
			if strings.Contains(item.ID, ":") {
				parts := strings.SplitN(item.ID, ":", 2)
				batch.Queue(queryRejectSingle, parts[1], isHidden)
			} else {
				fullID := "topsmm:" + item.ID
				batch.Queue(queryRejectSingle, fullID, isHidden)
			}
		} else {
			targetQuery := queryDirect
			effectiveIsHidden := isHidden
			if item.IsProviderSubmission {
				targetQuery = queryProviderStaging
				effectiveIsHidden = false
			}

			// Queue primary ID
			batch.Queue(targetQuery, item.ID, displayNameVal, float64(1.0), effectiveIsHidden, tags, refillVal, cancelVal, qualityVal, item.Category, stabilityVal, descriptionVal)

			// Queue counterpart ID (raw vs provider-prefixed)
			if strings.Contains(item.ID, ":") {
				parts := strings.SplitN(item.ID, ":", 2)
				batch.Queue(targetQuery, parts[1], displayNameVal, float64(1.0), effectiveIsHidden, tags, refillVal, cancelVal, qualityVal, item.Category, stabilityVal, descriptionVal)
			} else {
				fullID := "topsmm:" + item.ID
				batch.Queue(targetQuery, fullID, displayNameVal, float64(1.0), effectiveIsHidden, tags, refillVal, cancelVal, qualityVal, item.Category, stabilityVal, descriptionVal)
			}
		}

		// Sanity check to prevent cross-platform contamination
		cleanSvcID := item.ID
		provID := providerID
		if strings.Contains(cleanSvcID, ":") {
			parts := strings.SplitN(cleanSvcID, ":", 2)
			provID = parts[0]
			cleanSvcID = parts[1]
		}
		if provID == "pablosmm" || provID == "" {
			provID = "topsmm"
		}

		platVal := strings.ToLower(strings.TrimSpace(item.Platform))
		if platVal == "" {
			platVal = "instagram"
		}
		catVal := strings.ToLower(strings.TrimSpace(item.Category))
		if catVal == "" {
			catVal = "followers"
		}

		if isHidden {
			batch.Queue(`DELETE FROM pablo_catalog WHERE (LOWER(provider_id) = LOWER($1) OR LOWER(provider_id) = 'topsmm' OR LOWER(provider_id) = 'pablosmm' OR provider_id IS NULL OR provider_id = '') AND (provider_service_id = $2 OR provider_service_id = $3);`, provID, cleanSvcID, fmt.Sprintf("%s:%s", provID, cleanSvcID))
		} else {
			catNameVal := displayNameVal
			if catNameVal == "" {
				catNameVal = fmt.Sprintf("Service #%s", cleanSvcID)
			}

			catVariantVal := "Default"
			if item.VariantName != nil && *item.VariantName != "" {
				catVariantVal = *item.VariantName
			} else if item.RefillTag != nil && *item.RefillTag != "" {
				catVariantVal = *item.RefillTag
			}

			catSellPriceVal := float64(0.0)
			if item.SellPriceINR != nil {
				catSellPriceVal = *item.SellPriceINR
			}

			batch.Queue(queryCatalogUpsert, catNameVal, catVariantVal, catSellPriceVal, platVal, catVal, provID, cleanSvcID, true, descriptionVal, tags)
		}
	}

	br := h.db.Pool.SendBatch(r.Context(), batch)
	defer br.Close()

	for i := 0; i < batch.Len(); i++ {
		_, err := br.Exec()
		if err != nil {
			log.Printf("ERROR: Curate batch item %d failed: %v", i, err)
		}
	}

	h.smm.InvalidateCache()
	InvalidateAdminCatalogCache()
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "count": fmt.Sprintf("%d", len(body.Updates))})
}

func (h *Handler) ClearPendingProviderSubmissions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	action := r.URL.Query().Get("action") // "accept_all" or "reject_all"

	if action == "accept_all" {
		// Promote proposed tags to live tags and clear pending flags
		query := `UPDATE service_overrides 
		SET is_hidden = CASE 
				WHEN 'proposed_status:hidden' = ANY(tags) THEN true 
				WHEN 'proposed_status:active' = ANY(tags) THEN false 
				ELSE is_hidden 
		    END,
		    tags = ARRAY(
				SELECT DISTINCT 
					CASE 
						WHEN elem LIKE 'proposed_min:%' THEN replace(elem, 'proposed_min:', 'min:')
						WHEN elem LIKE 'proposed_max:%' THEN replace(elem, 'proposed_max:', 'max:')
						WHEN elem LIKE 'proposed_refill:%' THEN replace(elem, 'proposed_refill:', 'refill:')
						WHEN elem LIKE 'proposed_quality:%' THEN replace(elem, 'proposed_quality:', 'quality:')
						ELSE elem
					END
				FROM unnest(tags) elem 
				WHERE elem NOT LIKE 'proposed_status:%' 
				  AND elem NOT LIKE 'proposed_cancel:%' 
				  AND elem != 'provider_pending:true'
				  AND elem != 'provider_status:active'
				  AND elem != 'provider_status:hidden'
		    ),
		    updated_at = CURRENT_TIMESTAMP
		WHERE 'provider_pending:true' = ANY(tags);`
		_, err := h.db.Pool.Exec(context.Background(), query)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Failed to accept pending submissions: " + err.Error()})
			return
		}
	} else {
		// Reject all: simply strip all proposed_* and provider_pending tags
		query := `UPDATE service_overrides 
		SET tags = ARRAY(
				SELECT elem FROM unnest(tags) elem 
				WHERE elem NOT LIKE 'proposed_%' 
				  AND elem != 'provider_pending:true'
				  AND elem NOT LIKE 'provider_status:%'
		    ),
		    updated_at = CURRENT_TIMESTAMP
		WHERE 'provider_pending:true' = ANY(tags);`
		_, err := h.db.Pool.Exec(context.Background(), query)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Failed to clear pending submissions: " + err.Error()})
			return
		}
	}

	h.smm.InvalidateCache()
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}


