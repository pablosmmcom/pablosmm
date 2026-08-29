package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"pablosmm/backend/internal/db/sqlc"
)

func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	// Only admin allowed, which should be protected by middleware in server.go
	
	settings, err := h.db.Queries.GetAllSettings(context.Background())
	if err != nil {
		http.Error(w, "Failed to get settings", http.StatusInternalServerError)
		return
	}

	// Map settings for easy JSON consumption
	resp := make(map[string]string)
	for _, s := range settings {
		resp[s.Key] = s.Value
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var payload map[string]string
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// Update each setting
	for key, value := range payload {
		err := h.db.Queries.UpsertSetting(ctx, sqlc.UpsertSettingParams{
			Key:   key,
			Value: value,
		})
		if err != nil {
			http.Error(w, "Failed to update setting: "+key, http.StatusInternalServerError)
			return
		}
	}

	h.GetSettings(w, r)
}

func (h *Handler) GetPublicTaxonomy(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	val, err := h.db.Queries.GetSetting(ctx, "catalog_taxonomy")
	w.Header().Set("Content-Type", "application/json")
	if err != nil || val == "" {
		w.Write([]byte("{}"))
		return
	}
	w.Write([]byte(val))
}

func (h *Handler) UpdateTaxonomy(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	bytes, err := json.Marshal(body)
	if err != nil {
		http.Error(w, "Failed to encode taxonomy", http.StatusInternalServerError)
		return
	}

	err = h.db.Queries.UpsertSetting(context.Background(), sqlc.UpsertSettingParams{
		Key:   "catalog_taxonomy",
		Value: string(bytes),
	})
	if err != nil {
		http.Error(w, "Failed to save taxonomy: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(bytes)
}
