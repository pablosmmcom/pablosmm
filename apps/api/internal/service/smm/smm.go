package smm

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"pablosmm/backend/internal/config"
	"pablosmm/backend/internal/db"
	"pablosmm/backend/internal/provider"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// PanelV2Service represents the raw service response from an SMM panel API v2
type PanelV2Service struct {
	Service     json.Number `json:"service"`
	Name        string      `json:"name"`
	Type        string      `json:"type"`
	Category    string      `json:"category"`
	Rate        json.Number `json:"rate"`
	Min         json.Number `json:"min"`
	Max         json.Number `json:"max"`
	Refill      interface{} `json:"refill"`
	Dripfeed    interface{} `json:"dripfeed"`
	Cancel      interface{} `json:"cancel"`
	AverageTime json.Number `json:"average_time"`
	Description string      `json:"description"`
	Desc        string      `json:"desc"`
}

// NormalizedSmmService matches the frontend structure in types/smm.ts
type NormalizedSmmService struct {
	ID                  string      `json:"id"`
	Source              string      `json:"source"`
	SourceServiceID     string      `json:"sourceServiceId"`
	Platform            string      `json:"platform"`
	ServiceType         string      `json:"type"`
	Variant             string      `json:"variant"`
	Name                string      `json:"name"`
	ProviderName        string      `json:"providerName"`
	Description         string      `json:"description"`
	Category            string      `json:"category"`
	ProviderCategory    string      `json:"providerCategory"`
	RatePer1000         float64     `json:"ratePer1000"`
	BaseRatePer1000     float64     `json:"baseRatePer1000"`    // Raw cost from provider in USD
	OriginalMultiplier  float64     `json:"originalMultiplier"` // The raw rate_multiplier from the DB
	ProviderCurrency    string      `json:"providerCurrency"`
	DisplayName         string      `json:"displayName,omitempty"`
	DisplayDescription  string      `json:"displayDescription,omitempty"`
	Min                 int         `json:"min"`
	Max                 int         `json:"max"`
	Refill              bool        `json:"refill"`
	Dripfeed            bool        `json:"dripfeed"`
	Cancel              bool        `json:"cancel"`
	AverageTime         *int        `json:"averageTime"`
	Tags                []string    `json:"tags"`
	RawProviderCategory string      `json:"rawProviderCategory"`
	PurchaseCount       int         `json:"purchaseCount"`
	DisplayID           string      `json:"displayId"`
	Raw                 interface{} `json:"raw"`
	Targeting           string      `json:"targeting"`
	Quality             string      `json:"quality"`
	Stability           string      `json:"stability"`
	Badge               string      `json:"badge"`
	RefillLimit         int         `json:"refillLimit"`
	IsHidden                     bool        `json:"isHidden"`
	Status                       string      `json:"status"`
	CustomInputRequired          bool        `json:"customInputRequired"`
	CustomInputLabel             string      `json:"customInputLabel"`
	HasPendingProviderSubmission bool        `json:"hasPendingProviderSubmission"`
	PendingProviderStatus        string      `json:"pendingProviderStatus"`
	ProposedStatus               string      `json:"proposedStatus,omitempty"`
	ProposedMin                  int         `json:"proposedMin,omitempty"`
	ProposedMax                  int         `json:"proposedMax,omitempty"`
	ProposedRefillTag            string      `json:"proposedRefillTag,omitempty"`
	ProposedQuality              string      `json:"proposedQuality,omitempty"`
	ProposedCancel               *bool       `json:"proposedCancel,omitempty"`
}

type ProviderService struct {
	db         *db.DB
	cfg        *config.Config
	mu         sync.RWMutex
	cache      []NormalizedSmmService
	lastUpdate time.Time
}

func New(database *db.DB, cfg *config.Config) *ProviderService {
	return &ProviderService{db: database, cfg: cfg}
}

// Regex definitions for detection (ported from original TypeScript)
var (
	platformRegex = map[string]*regexp.Regexp{
		"instagram": regexp.MustCompile("(?i)(\\binstagram\\b|\\big\\b|\\binsta\\b)"),
		"facebook":  regexp.MustCompile("(?i)\\bfacebook\\b|\\bfb\\b"),
		"x":         regexp.MustCompile("(?i)\\btwitter\\b|\\bX\\b"),
		"telegram":  regexp.MustCompile("(?i)\\btelegram\\b|\\btg\\b"),
		"tiktok":    regexp.MustCompile("(?i)\\btiktok\\b|\\btt\\b"),
		"youtube":   regexp.MustCompile("(?i)\\byoutube\\b|\\byt\\b"),
	}

	typeRegex = map[string]*regexp.Regexp{
		"comments":  regexp.MustCompile("(?i)\\bcomment(s)?\\b|\\brepl(y|ies)\\b|\\breview(s)?\\b"),
		"likes":     regexp.MustCompile("(?i)\\blike(s)?\\b|\\bheart(s)?\\b"),
		"followers": regexp.MustCompile("(?i)\\bfollow(er)?(s)?\\b|\\bsubscriber(s)?\\b|\\bmember(s)?\\b"),
		"views":     regexp.MustCompile("(?i)\\bview(s)?\\b|\\bplay(s)?\\b|\\bwatch(es)?\\b|\\bimpression(s)?\\b|\\breach\\b"),
		"shares":    regexp.MustCompile("(?i)\\bshare(s)?\\b|\\bretweet(s)?\\b|\\bforward(s)?\\b"),
		"repost":    regexp.MustCompile("(?i)\\brepost(s)?\\b"),
		"votes":     regexp.MustCompile("(?i)\\bvote(s)?\\b|\\bpoll(s)?\\b|\\banswer(s)?\\b"),
		"saves":     regexp.MustCompile("(?i)\\bsave(s)?\\b|\\bbookmark(s)?\\b|\\bsaved\\b"),
		"reactions": regexp.MustCompile("(?i)\\breaction(s)?\\b|\\breact(s)?\\b|\\bemoji(s)?\\b"),
	}

	variantRegex = map[string][]struct {
		variant string
		rx      *regexp.Regexp
	}{
		"instagram": {
			{"custom", regexp.MustCompile("(?i)\\bcustom\\b")},
			{"random", regexp.MustCompile("(?i)\\brandom\\b")},
			{"comments", regexp.MustCompile("(?i)\\bcomment(s)?\\b")},
			{"reel", regexp.MustCompile("(?i)\\breel(s)?\\b")},
			{"story", regexp.MustCompile("(?i)\\bstory|stories|poll\\b")},
			{"igtv", regexp.MustCompile("(?i)\\bigtv\\b")},
			{"live", regexp.MustCompile("(?i)\\blive|livestream\\b")},
			{"video", regexp.MustCompile("(?i)\\bvideo\\b")},
			{"post", regexp.MustCompile("(?i)\\bpost|photo|image\\b")},
			{"channel", regexp.MustCompile("(?i)\\bchannel|broadcast\\b")},
		},
		"facebook": {
			{"video", regexp.MustCompile("(?i)\\bvideo\\b")},
			{"post", regexp.MustCompile("(?i)\\bpost\\b")},
			{"live", regexp.MustCompile("(?i)\\blive\\b")},
		},
		"x": {
			{"post", regexp.MustCompile("(?i)tweet|post")},
			{"video", regexp.MustCompile("(?i)video")},
		},
		"telegram": {
			{"post", regexp.MustCompile("(?i)post|channel|group")},
		},
		"tiktok": {
			{"video", regexp.MustCompile("(?i)video")},
			{"live", regexp.MustCompile("(?i)live")},
			{"post", regexp.MustCompile("(?i)post")},
		},
		"youtube": {
			{"short", regexp.MustCompile("(?i)short")},
			{"video", regexp.MustCompile("(?i)video")},
			{"live", regexp.MustCompile("(?i)live")},
			{"post", regexp.MustCompile("(?i)post|community")},
		},
	}

	hardExcludeRx = regexp.MustCompile("(?i)(\\bdm\\b|direct\\s*message|inbox)")
)

func (s *ProviderService) InvalidateCache() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache = nil
	s.lastUpdate = time.Time{}
}

func (s *ProviderService) FetchServices() ([]NormalizedSmmService, error) {
	s.mu.RLock()
	if !s.lastUpdate.IsZero() && time.Since(s.lastUpdate) < 10*time.Minute {
		defer s.mu.RUnlock()
		return s.cache, nil
	}
	s.mu.RUnlock()

	s.mu.Lock()
	defer s.mu.Unlock()

	// Re-check after acquiring lock
	if !s.lastUpdate.IsZero() && time.Since(s.lastUpdate) < 10*time.Minute {
		return s.cache, nil
	}

	type ProviderTarget struct {
		Key      string
		Name     string
		ApiUrl   string
		ApiKey   string
		Currency string
	}

	var targets []ProviderTarget

	if dbProviders, err := s.db.Queries.GetActiveSmmProviders(context.Background()); err == nil && len(dbProviders) > 0 {
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
		// Fallback to default env provider if DB table is empty
		targets = append(targets, ProviderTarget{
			Key:      provider.DefaultKey,
			Name:     provider.DefaultName,
			ApiUrl:   s.cfg.SMMAPIURL,
			ApiKey:   s.cfg.SMMAPIKey,
			Currency: s.cfg.SmmCurrency,
		})
	}

	type FetchedServiceList struct {
		Provider ProviderTarget
		Services []PanelV2Service
	}

	var allFetched []FetchedServiceList

	for _, target := range targets {
		if target.ApiUrl == "" || target.ApiKey == "" {
			continue
		}
		formData := url.Values{}
		formData.Set("key", target.ApiKey)
		formData.Add("action", "services")

		resp, err := http.PostForm(target.ApiUrl, formData)
		if err != nil {
			log.Printf("ERROR: failed to fetch services for provider %s: %v", target.Key, err)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			log.Printf("ERROR: provider %s returned status %d", target.Key, resp.StatusCode)
			continue
		}

		var rawServices []PanelV2Service
		if err := json.NewDecoder(resp.Body).Decode(&rawServices); err != nil {
			resp.Body.Close()
			log.Printf("ERROR: failed to decode services for provider %s: %v", target.Key, err)
			continue
		}
		resp.Body.Close()

		allFetched = append(allFetched, FetchedServiceList{
			Provider: target,
			Services: rawServices,
		})
	}

		// Build live provider map
	liveData := make(map[string]PanelV2Service)
	for _, batch := range allFetched {
		providerKey := batch.Provider.Key
		for _, raw := range batch.Services {
			fullSID := fmt.Sprintf("%s:%s", providerKey, raw.Service.String())
			liveData[fullSID] = raw
		}
	}

	catalog, err := s.db.Queries.GetActiveCatalogServices(context.Background())
	if err != nil {
		log.Printf("ERROR: Query pablo_catalog failed: %v", err)
		catalog = nil
	}

	overridesMap := make(map[string][]string)
	rows, err := s.db.Pool.Query(context.Background(), "SELECT source_service_id, tags FROM service_overrides")
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

	normalized := make([]NormalizedSmmService, 0)
	for _, catSvc := range catalog {
		providerKey := ""
		if catSvc.ProviderID.Valid {
			providerKey = catSvc.ProviderID.String
		}
		providerServiceID := ""
		if catSvc.ProviderServiceID.Valid {
			providerServiceID = catSvc.ProviderServiceID.String
		}

		fullSID := fmt.Sprintf("%s:%s", providerKey, providerServiceID)
		
		raw, hasLive := liveData[fullSID]
		
		minVal := 50
		maxVal := 10000
		refill := false
		cancel := false
		dripfeed := false
		desc := ""
		providerCategory := ""
		
		if hasLive {
			minVal = int(toNumber(raw.Min))
			maxVal = int(toNumber(raw.Max))
			refill = toBool(raw.Refill)
			cancel = toBool(raw.Cancel)
			dripfeed = toBool(raw.Dripfeed)
			desc = raw.Description
			providerCategory = raw.Category
		}

		sellPrice, _ := catSvc.SellPriceInr.Float64Value()

		platform := ""
		if catSvc.Platform.Valid {
			platform = catSvc.Platform.String
		}
		category := ""
		if catSvc.Category.Valid {
			category = catSvc.Category.String
		}
		variant := ""
		if catSvc.VariantName.Valid {
			variant = catSvc.VariantName.String
		}

		var badge, stability, quality string
		tags := overridesMap[fullSID]
		if tags == nil {
			tags = overridesMap[providerServiceID]
		}

		for _, t := range tags {
			if strings.HasPrefix(t, "badge:") {
				badge = strings.TrimPrefix(t, "badge:")
			} else if strings.HasPrefix(t, "stability:") {
				stability = strings.TrimPrefix(t, "stability:")
			} else if strings.HasPrefix(t, "quality:") {
				quality = strings.TrimPrefix(t, "quality:")
			}
		}

		n := NormalizedSmmService{
			ID:                           fmt.Sprintf("%d", catSvc.ID), // PabloSMM Catalog ID
			Source:                       providerKey,
			SourceServiceID:              providerServiceID,
			Platform:                     platform,
			ServiceType:                  category,
			Variant:                      variant,
			Name:                         catSvc.Name,
			ProviderName:                 catSvc.Name,
			Description:                  desc,
			Category:                     category,
			ProviderCategory:             providerCategory,
			DisplayName:                  catSvc.Name,
			DisplayDescription:           desc,
			BaseRatePer1000:              0, 
			RatePer1000:                  sellPrice.Float64, 
			OriginalMultiplier:           1.0,
			ProviderCurrency:             "INR",
			Min:                          minVal,
			Max:                          maxVal,
			Refill:                       refill,
			Dripfeed:                     dripfeed,
			Cancel:                       cancel,
			Tags:                         tags, 
			RawProviderCategory:          providerCategory,
			PurchaseCount:                0,
			DisplayID:                    fmt.Sprintf("%04d", catSvc.ID),
			Raw:                          raw,
			Targeting:                    "",
			Quality:                      quality,
			Stability:                    stability,
			RefillLimit:                  func() int { if refill { return 3 }; return 0 }(),
			Badge:                        badge,
			IsHidden:                     !catSvc.IsActive.Bool,
			Status:                       func() string { if !catSvc.IsActive.Bool { return "hidden" } else { return "active" } }(),
			CustomInputRequired:          false,
			CustomInputLabel:             "",
			HasPendingProviderSubmission: false,
			PendingProviderStatus:        "",
			ProposedStatus:               "",
			ProposedMin:                  0,
			ProposedMax:                  0,
			ProposedRefillTag:            "",
			ProposedQuality:              "",
			ProposedCancel:               nil,
		}

		if hasLive {
			avgTime := int(toNumber(raw.AverageTime))
			if avgTime > 0 {
				n.AverageTime = &avgTime
			}
		}

		normalized = append(normalized, n)
	}

	s.cache = normalized
	s.lastUpdate = time.Now()

	return normalized, nil
}

func detectPlatform(s PanelV2Service) string {
	hay := strings.ToLower(s.Category + " " + s.Name)
	platforms := []string{"instagram", "facebook", "x", "telegram", "tiktok", "youtube"}
	for _, p := range platforms {
		if platformRegex[p].MatchString(hay) {
			return p
		}
	}
	return ""
}

func detectType(s PanelV2Service) string {
	hay := strings.ToLower(s.Category + " " + s.Name)
	if hardExcludeRx.MatchString(hay) {
		return ""
	}

	best := ""
	bestScore := 0
	catHay := strings.ToLower(s.Category)

	types := []string{"comments", "likes", "followers", "views", "shares", "votes", "saves"}
	for _, t := range types {
		score := countMatches(typeRegex[t], hay)*2 + countMatches(typeRegex[t], catHay)*10
		if score > bestScore {
			best = t
			bestScore = score
		}
	}

	if bestScore > 0 {
		return best
	}
	return ""
}

func detectVariant(platform string, s PanelV2Service) string {
	hay := strings.ToLower(s.Category + " " + s.Name)
	if variants, ok := variantRegex[platform]; ok {
		for _, v := range variants {
			if v.rx.MatchString(hay) {
				return v.variant
			}
		}
	}
	return "any"
}

func countMatches(rx *regexp.Regexp, text string) int {
	return len(rx.FindAllString(text, -1))
}

func toNumber(n json.Number) float64 {
	if n == "" {
		return 0
	}
	f, err := n.Float64()
	if err != nil {
		// Try cleaning it
		s := regexp.MustCompile("[^0-9.]").ReplaceAllString(n.String(), "")
		f, _ = strconv.ParseFloat(s, 64)
	}
	return f
}

func toBool(v interface{}) bool {
	if v == nil {
		return false
	}
	switch val := v.(type) {
	case bool:
		return val
	case string:
		const s = "1trueyesavailable"
		lower := strings.ToLower(val)
		if strings.Contains(s, lower) {
			return true
		}
	case float64:
		return val == 1
	case int:
		return val == 1
	case json.Number:
		return val.String() == "1"
	}
	return false
}


func (s *ProviderService) getProviderCreds(providerKey string) (string, string, error) {
	if providerKey == "" || providerKey == provider.DefaultKey {
		return s.cfg.SMMAPIURL, s.cfg.SMMAPIKey, nil
	}
	dbProviders, err := s.db.Queries.GetActiveSmmProviders(context.Background())
	if err == nil {
		for _, p := range dbProviders {
			if p.Key == providerKey {
				return p.ApiUrl, p.ApiKey, nil
			}
		}
	}
	return s.cfg.SMMAPIURL, s.cfg.SMMAPIKey, nil
}

func (s *ProviderService) PlaceOrder(providerKey, serviceID, quantity, link string) (map[string]interface{}, error) {
	apiURL, apiKey, err := s.getProviderCreds(providerKey)
	if err != nil {
		return nil, err
	}

	formData := url.Values{}
	formData.Set("key", apiKey)
	formData.Set("action", "add")
	formData.Set("service", serviceID)
	formData.Set("link", link)
	formData.Set("quantity", quantity)

	resp, err := http.PostForm(apiURL, formData)
	if err != nil {
		return nil, fmt.Errorf("failed to place order: %v", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode SMM response: %v", err)
	}

	if errorMsg, ok := result["error"].(string); ok {
		return nil, fmt.Errorf("SMM Provider Error: %s", errorMsg)
	}

	return result, nil
}

func (s *ProviderService) CancelOrder(providerKey, orderID string) (map[string]interface{}, error) {
	apiURL, apiKey, err := s.getProviderCreds(providerKey)
	if err != nil {
		return nil, err
	}
	
	formData := url.Values{}
	formData.Set("key", apiKey)
	formData.Set("action", "cancel")
	formData.Set("order", orderID)

	resp, err := http.PostForm(apiURL, formData)
	if err != nil {
		return nil, fmt.Errorf("failed to cancel order: %v", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode cancel response: %v", err)
	}

	return result, nil
}

func (s *ProviderService) RefillOrder(providerKey, orderID string) (map[string]interface{}, error) {
	apiURL, apiKey, err := s.getProviderCreds(providerKey)
	if err != nil {
		return nil, err
	}
	
	formData := url.Values{}
	formData.Set("key", apiKey)
	formData.Set("action", "refill")
	formData.Set("order", orderID)

	resp, err := http.PostForm(apiURL, formData)
	if err != nil {
		return nil, fmt.Errorf("failed to refill order: %v", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode refill response: %v", err)
	}

	return result, nil
}

func (s *ProviderService) GetOrderStatus(providerKey string, orderIDs []string) (map[string]interface{}, error) {
	apiURL, apiKey, err := s.getProviderCreds(providerKey)
	if err != nil {
		return nil, err
	}

	formData := url.Values{}
	formData.Set("key", apiKey)
	formData.Set("action", "status")
	formData.Set("orders", strings.Join(orderIDs, ","))

	resp, err := http.PostForm(apiURL, formData)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch order status: %v", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode status response: %v", err)
	}

	return result, nil
}
