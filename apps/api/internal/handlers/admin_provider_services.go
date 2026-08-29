package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	"pablosmm/backend/internal/provider"
	"pablosmm/backend/internal/service/smm"
)

type ProviderTarget struct {
	Key      string
	Name     string
	ApiUrl   string
	ApiKey   string
	Currency string
}

type RawWithProvider struct {
	smm.PanelV2Service
	ProviderKey string   `json:"providerKey"`
	Tags        []string `json:"tags,omitempty"`
}

type rawServicesCache struct {
	mu         sync.RWMutex
	data       []RawWithProvider
	lastUpdate time.Time
}

var rawCache rawServicesCache

func (h *Handler) GetRawProviderServices(w http.ResponseWriter, r *http.Request) {
	forceRefresh := r.URL.Query().Get("refresh") == "true"

	rawCache.mu.RLock()
	if !forceRefresh && time.Since(rawCache.lastUpdate) < 5*time.Minute && len(rawCache.data) > 0 {
		cached := rawCache.data
		rawCache.mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cached)
		return
	}
	rawCache.mu.RUnlock()

	var targets []ProviderTarget

	if dbProviders, err := h.db.Queries.GetActiveSmmProviders(r.Context()); err == nil && len(dbProviders) > 0 {
		for _, p := range dbProviders {
			targets = append(targets, ProviderTarget{
				Key:      p.Key,
				Name:     p.Name,
				ApiUrl:   p.ApiUrl,
				ApiKey:   p.ApiKey,
				Currency: p.Currency,
			})
		}
	} else {
		// Fallback
		targets = append(targets, ProviderTarget{
			Key:      provider.DefaultKey,
			Name:     provider.DefaultName,
			ApiUrl:   h.cfg.SMMAPIURL,
			ApiKey:   h.cfg.SMMAPIKey,
			Currency: provider.DefaultCurrency,
		})
	}

	overridesMap := make(map[string][]string)
	rows, err := h.db.Pool.Query(r.Context(), "SELECT source_service_id, COALESCE(tags, '{}'::text[]) FROM service_overrides")
	if err == nil {
		for rows.Next() {
			var sid string
			var tags []string
			if err := rows.Scan(&sid, &tags); err == nil {
				overridesMap[sid] = tags
			}
		}
		rows.Close()
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	var allRaw []RawWithProvider

	for _, target := range targets {
		if target.ApiUrl == "" || target.ApiKey == "" {
			continue
		}

		wg.Add(1)
		go func(tgt ProviderTarget) {
			defer wg.Done()

			formData := url.Values{}
			formData.Set("key", tgt.ApiKey)
			formData.Add("action", "services")

			resp, err := client.PostForm(tgt.ApiUrl, formData)
			if err != nil {
				log.Printf("ERROR: failed to fetch services for provider %s: %v", tgt.Key, err)
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return
			}

			var rawServices []smm.PanelV2Service
			if err := json.NewDecoder(resp.Body).Decode(&rawServices); err == nil {
				mu.Lock()
				defer mu.Unlock()
				for _, raw := range rawServices {
					fullID := tgt.Key + ":" + fmt.Sprint(raw.Service)
					tags := overridesMap[fullID]
					if tags == nil {
						tags = overridesMap[fmt.Sprint(raw.Service)]
					}

					allRaw = append(allRaw, RawWithProvider{
						PanelV2Service: raw,
						ProviderKey:    tgt.Key,
						Tags:           tags,
					})
				}
			}
		}(target)
	}

	wg.Wait()

	if allRaw == nil {
		allRaw = []RawWithProvider{}
	}

	rawCache.mu.Lock()
	rawCache.data = allRaw
	rawCache.lastUpdate = time.Now()
	rawCache.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(allRaw)
}
