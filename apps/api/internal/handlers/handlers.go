package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"pablosmm/backend/internal/config"
	"pablosmm/backend/internal/db"
	"pablosmm/backend/internal/service/metadata"
	"pablosmm/backend/internal/service/smm"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"pablosmm/backend/internal/db/sqlc"
)

type Handler struct {
	db       *db.DB
	cfg      *config.Config
	smm      *smm.ProviderService
	metadata *metadata.Service
}

func New(database *db.DB, cfg *config.Config, smmSvc *smm.ProviderService, metaSvc *metadata.Service) *Handler {
	return &Handler{
		db:       database,
		cfg:      cfg,
		smm:      smmSvc,
		metadata: metaSvc,
	}
}

func (h *Handler) GetServices(w http.ResponseWriter, r *http.Request) {
	services, err := h.smm.FetchServices()
	if err != nil {
		log.Printf("DEBUG: FetchServices error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if r.URL.Query().Get("all") == "true" {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"services": services,
		})
		return
	}

	activeServices := make([]smm.NormalizedSmmService, 0)
	for _, s := range services {
		if !s.IsHidden {
			activeServices = append(activeServices, s)
		}
	}
	log.Printf("DEBUG: GetServices returned %d active services out of %d total", len(activeServices), len(services))

	json.NewEncoder(w).Encode(map[string]interface{}{
		"services": activeServices,
	})
}

func (h *Handler) RefreshServices(w http.ResponseWriter, r *http.Request) {
	h.smm.InvalidateCache()
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Cache invalidated"})
}

func (h *Handler) GetMetadata(w http.ResponseWriter, r *http.Request) {
	url := r.URL.Query().Get("url")
	if url == "" {
		http.Error(w, "URL is required", http.StatusBadRequest)
		return
	}

	data, err := h.metadata.Fetch(url)
	if err != nil {
		http.Error(w, "Failed to fetch metadata", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(data)
}

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	email := r.Header.Get("x-user-email")
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var user struct {
		ID     int    `json:"id"`
		Name   string `json:"name"`
		Email  string `json:"email"`
		Role   string `json:"role"`
		APIKey string `json:"apiKey"`
	}
	var wallet struct {
		Balance int `json:"balance"`
	}

	profile, err := h.db.Queries.GetUserProfile(context.Background(), pgtype.Text{String: email, Valid: email != ""})
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	user.ID = int(profile.ID)
	user.Name = profile.Name.String
	user.Email = profile.Email.String
	user.Role = profile.Role
	user.APIKey = profile.ApiKey
	wallet.Balance = int(profile.Balance)

	// Fetch detailed order stats
	var stats struct {
		Active    int `json:"active"`
		Completed int `json:"completed"`
		Failed    int `json:"failed"`
	}

	statsRow, err := h.db.Queries.GetProfileStats(context.Background(), profile.ID)
	if err == nil {
		stats.Active = int(statsRow.ActiveCount)
		stats.Completed = int(statsRow.CompletedCount)
		stats.Failed = int(statsRow.FailedCount)
	} else {
		log.Printf("Failed to fetch order stats for user %d: %v", user.ID, err)
	}

	// Fetch total spend as well
	totalSpendCents, _ := h.db.Queries.GetProfileTotalSpend(context.Background(), profile.ID)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"user": map[string]interface{}{
			"id":         user.ID,
			"name":       user.Name,
			"email":      user.Email,
			"role":       user.Role,
			"apiKey":     user.APIKey,
			"balance":    float64(wallet.Balance) / 100.0,
			"totalSpend": float64(totalSpendCents) / 100.0,
			"stats":      stats,
		},
	})
}

func validateLink(platform, serviceType, link string) error {
	link = strings.TrimSpace(link)
	if link == "" {
		return fmt.Errorf("link is required")
	}

	linkLower := strings.ToLower(link)

	switch platform {
	case "instagram":
		if !strings.Contains(linkLower, "instagram.com") {
			return fmt.Errorf("link must be an Instagram URL")
		}
	case "facebook":
		if !strings.Contains(linkLower, "facebook.com") && !strings.Contains(linkLower, "fb.watch") {
			return fmt.Errorf("link must be a Facebook URL")
		}
	case "youtube":
		if !strings.Contains(linkLower, "youtube.com") && !strings.Contains(linkLower, "youtu.be") {
			return fmt.Errorf("link must be a YouTube URL")
		}
	case "tiktok":
		if !strings.Contains(linkLower, "tiktok.com") {
			return fmt.Errorf("link must be a TikTok URL")
		}
	case "telegram":
		if !strings.Contains(linkLower, "t.me") && !strings.Contains(linkLower, "telegram.me") {
			return fmt.Errorf("link must be a Telegram URL (t.me/...)")
		}
	case "x", "twitter":
		if !strings.Contains(linkLower, "twitter.com") && !strings.Contains(linkLower, "x.com") {
			return fmt.Errorf("link must be an X (Twitter) URL")
		}
	case "linkedin":
		if !strings.Contains(linkLower, "linkedin.com") {
			return fmt.Errorf("link must be a LinkedIn URL")
		}
	case "spotify":
		if !strings.Contains(linkLower, "spotify.com") {
			return fmt.Errorf("link must be a Spotify URL")
		}
	case "twitch":
		if !strings.Contains(linkLower, "twitch.tv") {
			return fmt.Errorf("link must be a Twitch URL")
		}
	case "discord":
		if !strings.Contains(linkLower, "discord.gg") && !strings.Contains(linkLower, "discord.com") {
			return fmt.Errorf("link must be a Discord URL")
		}
	}

	return nil
}

func (h *Handler) GetSingleOrder(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)
	orderIDStr := chi.URLParam(r, "id")
	orderID, err := strconv.Atoi(orderIDStr)
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	var o struct {
		ID          int     `json:"id"`
		ServiceID   string  `json:"serviceId"`
		DisplayID   string  `json:"displayId"`
		DisplayName string  `json:"serviceName"`
		Amount      float64 `json:"charge"`
		Quantity    int     `json:"quantity"`
		Status      string  `json:"status"`
		Date        string  `json:"date"`
		UpdatedAt   string  `json:"updatedAt"`
		Link        string  `json:"link"`
		StartCount  int     `json:"startCount"`
		Remains     int     `json:"remains"`
		ServiceType string  `json:"serviceType"`
		Category    string  `json:"category"`
		PendingCancel bool  `json:"pendingCancel"`
		PendingRefill bool  `json:"pendingRefill"`
		RefillsRemaining int `json:"refillsRemaining"`
	}

	orderRow, err := h.db.Queries.GetSingleOrder(context.Background(), sqlc.GetSingleOrderParams{
		ID:     int32(orderID),
		UserID: int32(userID),
	})

	if err != nil {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	o.ID = int(orderRow.ID)
	o.ServiceID = orderRow.ServiceID
	o.Amount = float64(orderRow.AmountCents) / 100.0
	o.Quantity = int(orderRow.Quantity)
	o.Status = orderRow.Status
	o.Date = orderRow.CreatedAt.Time.Format(time.RFC3339)
	if orderRow.UpdatedAt.Valid {
		o.UpdatedAt = orderRow.UpdatedAt.Time.Format(time.RFC3339)
	}
	o.Link = orderRow.Link
	o.Remains = int(orderRow.Remains)
	o.StartCount = int(orderRow.StartCount)
	o.ServiceType = orderRow.ServiceType
	o.Category = orderRow.Category

	// Initialize new fields
	o.RefillsRemaining = int(orderRow.RefillsRemaining)
	
	// We'll fetch pending requests to check flags only if order is not in terminal state
	isTerminal := o.Status == "completed" || o.Status == "canceled" || o.Status == "refunded" || o.Status == "failed"
	if !isTerminal {
		pendingReqs, _ := h.db.Queries.GetPendingOrderRequestsByOrder(context.Background(), int32(orderID))
		for _, req := range pendingReqs {
			if req.RequestType == "cancel" {
				o.PendingCancel = true
			} else if req.RequestType == "refill" {
				o.PendingRefill = true
			}
		}
	}

	o.DisplayID = orderRow.DisplayID
	if o.DisplayID == "" {
		if idx := strings.LastIndex(o.ServiceID, ":"); idx != -1 {
			o.DisplayID = o.ServiceID[idx+1:]
		} else {
			o.DisplayID = o.ServiceID
		}
	}

	if orderRow.DisplayName != "" {
		o.DisplayName = orderRow.DisplayName
	}

	// Enrich from live service cache if DB values are missing
	type svcInfo struct {
		ServiceType  string
		Category     string
		Platform     string
		DisplayName  string
		ProviderName string
	}
	svcMap := make(map[string]svcInfo)
	if services, svcErr := h.smm.FetchServices(); svcErr == nil {
		for _, s := range services {
			info := svcInfo{
				ServiceType:  s.ServiceType,
				Category:     s.Category,
				Platform:     s.Platform,
				DisplayName:  s.DisplayName,
				ProviderName: s.ProviderName,
			}
			svcMap[s.ID] = info
			svcMap[s.SourceServiceID] = info
		}
	}

	if info, ok := svcMap[o.ServiceID]; ok {
		if o.ServiceType == "" {
			o.ServiceType = info.ServiceType
		}
		if o.Category == "" {
			o.Category = info.Category
		}
		if o.DisplayName == "" {
			if info.DisplayName != "" {
				o.DisplayName = info.DisplayName
			} else {
				o.DisplayName = info.ProviderName
			}
		}
	} else {
		parts := strings.SplitN(o.ServiceID, ":", 2)
		if len(parts) == 2 {
			if info, ok := svcMap[parts[1]]; ok {
				if o.ServiceType == "" {
					o.ServiceType = info.ServiceType
				}
				if o.Category == "" {
					o.Category = info.Category
				}
				if o.DisplayName == "" {
					if info.DisplayName != "" {
						o.DisplayName = info.DisplayName
					} else {
						o.DisplayName = info.ProviderName
					}
				}
			}
		}
	}

	if o.Status == "submitted" {
		o.Status = "active"
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"order": o,
	})
}

func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ServiceID       string `json:"serviceId"`
		SourceServiceID string `json:"sourceServiceId"`
		Quantity        int    `json:"quantity"`
		Link            string `json:"link"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// 1. Get user and wallet from Context (injected by AuthMiddleware)
	userID, ok := r.Context().Value("userID").(int)
	if !ok {
		// Should not happen if middleware is active, but safe guard
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized"})
		return
	}

	balanceCents32, err := h.db.Queries.GetWalletBalance(context.Background(), int32(userID))
	balanceCents := int(balanceCents32)

	if err != nil {
		// Create wallet if not exists (auto-repair) or return error
		// For now, assume 0 balance if not found
		balanceCents = 0
	}

	// 2. Compute price
	services, err := h.smm.FetchServices()
	if err != nil {
		http.Error(w, "Failed to retrieve service data", http.StatusInternalServerError)
		return
	}

	var selectedService *smm.NormalizedSmmService // Use pointer to smm package struct
	for _, s := range services {
		if s.ID == body.ServiceID || s.SourceServiceID == body.SourceServiceID {
			selectedService = &s
			break
		}
	}

	if selectedService == nil {
		http.Error(w, "Service not found", http.StatusBadRequest)
		return
	}

	// VALIDATE LINK
	if err := validateLink(selectedService.Platform, selectedService.ServiceType, body.Link); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Calculate Cost
	// RatePer1000 is in INR (from catalog). Wallet is in INR (Paisa).
	rateINR := selectedService.RatePer1000
	totalINR := (rateINR * float64(body.Quantity)) / 1000.0
	amountCents := int(totalINR * 100) // Convert to Paisa

	if amountCents <= 0 {
		amountCents = 1 // Minimum 1 paisa to prevent free orders due to rounding
	}

	if balanceCents < amountCents {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusPaymentRequired)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Insufficient balance. Required: ₹%.2f, Available: ₹%.2f", float64(amountCents)/100.0, float64(balanceCents)/100.0),
		})
		return
	}

	// 3. Transactional update: Create order and debit wallet
	tx, err := h.db.Pool.Begin(context.Background())
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	qtx := h.db.Queries.WithTx(tx)
	err = qtx.DebitWallet(context.Background(), sqlc.DebitWalletParams{
		Balance: int32(amountCents),
		UserID:  int32(userID),
	})
	if err != nil {
		http.Error(w, "Failed to debit wallet", http.StatusInternalServerError)
		return
	}

	orderID, err := qtx.InsertOrder(context.Background(), sqlc.InsertOrderParams{
		UserID:           int32(userID),
		ServiceID:        body.ServiceID,
		Quantity:         int32(body.Quantity),
		AmountCents:      int32(amountCents),
		Status:           "pending",
		Link:             pgtype.Text{String: body.Link, Valid: true},
		RefillsRemaining: pgtype.Int4{Int32: int32(selectedService.RefillLimit), Valid: true},
		ProviderKey:      pgtype.Text{String: selectedService.Source, Valid: true},
	})
	if err != nil {
		http.Error(w, "Failed to create order", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(context.Background()); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	// 4. Update sales count - Moved to after provider success to consolidate DB updates

	// 5. Forward to SMM Provider
	resp, placeErr := h.smm.PlaceOrder(selectedService.Source, body.SourceServiceID, strconv.Itoa(body.Quantity), body.Link)

	// Check for provider Error (API failure or Logic failure)
	var providerError string
	if placeErr != nil {
		providerError = placeErr.Error()
	} else if errStr, ok := resp["error"].(string); ok && errStr != "" {
		providerError = errStr
	}

	if providerError != "" {
		log.Printf("Provider failed for Order #%d: %s. Initiating Refund.", orderID, providerError)

		// REFUND LOGIC
		// We start a new transaction since the previous one passed
			rtx, rerr := h.db.Pool.Begin(context.Background())
		if rerr == nil {
			defer rtx.Rollback(context.Background())
			rqtx := h.db.Queries.WithTx(rtx)
			// 1. Credit Wallet back
			_ = rqtx.CreditWallet(context.Background(), sqlc.CreditWalletParams{
				Balance: int32(amountCents),
				UserID:  int32(userID),
			})
			// 2. Completely delete the order so it doesn't clutter history since it failed instantly
			_ = rqtx.DeleteOrder(context.Background(), int32(orderID))

			rtx.Commit(context.Background())
		}

		w.Header().Set("Content-Type", "application/json")
		// We return 200 OK because we handled it gracefully, but with error payload
		// Frontend will read order.error
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "failed",
			"order": map[string]interface{}{
				"error": providerError,
			},
		})
		return
	}

	// 5. Update order with provider response (Success)
	respJSON, _ := json.Marshal(resp)
	var providerOrderID string
	if id, ok := resp["order"].(string); ok {
		providerOrderID = id
	} else if id, ok := resp["order"].(float64); ok {
		providerOrderID = fmt.Sprintf("%.0f", id)
	} else {
		providerOrderID = fmt.Sprintf("%v", resp["order"])
	}

	if providerOrderID == "<nil>" {
		providerOrderID = ""
	}

	h.db.Queries.UpdateOrderProvider(context.Background(), sqlc.UpdateOrderProviderParams{
		ProviderResp:    respJSON,
		ProviderOrderID: pgtype.Text{String: providerOrderID, Valid: true},
		Status:          "submitted",
		ID:              int32(orderID),
	})

	// Increment purchase count in service_overrides
	if providerOrderID != "" {
		err = h.db.Queries.IncrementServicePurchaseCount(context.Background(), body.SourceServiceID)
		if err != nil {
			log.Printf("Failed to increment purchase count for service %s: %v", body.SourceServiceID, err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "success",
		"order_id": orderID,
		"order":    resp,
	})
}

func (h *Handler) UpdateServiceOverride(w http.ResponseWriter, r *http.Request) {
	// Read raw body for debugging
	rawBody, _ := io.ReadAll(r.Body)
	log.Printf("DEBUG: Raw body received: %s", string(rawBody))

	// Re-assign body to a new reader so it can be decoded
	r.Body = io.NopCloser(bytes.NewBuffer(rawBody))

	var body struct {
		SourceServiceID    string  `json:"sourceServiceId"`
		DisplayName        *string `json:"displayName"`
		DisplayDescription *string `json:"displayDescription"`
		RateMultiplier     float64 `json:"rateMultiplier"`
		IsHidden           bool    `json:"isHidden"`

		Category            *string  `json:"category"`
		Tags                []string `json:"tags"`
		ProviderCategory    *string  `json:"providerCategory"`
		DisplayID           string   `json:"displayId"`
		Refill              *bool    `json:"refill"`
		Cancel              *bool    `json:"cancel"`
		Dripfeed            *bool    `json:"dripfeed"`
		Type                *string  `json:"type"`
		Targeting           *string  `json:"targeting"`
		Quality             *string  `json:"quality"`
		Stability           *string  `json:"stability"`
		RefillLimit         *int32   `json:"refillLimit"`
		CustomInputRequired *bool    `json:"customInputRequired"`
		CustomInputLabel    *string  `json:"customInputLabel"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		syntaxErr, isSyntax := err.(*json.SyntaxError)
		unmarshalErr, isUnmarshal := err.(*json.UnmarshalTypeError)
		if isSyntax {
			log.Printf("DEBUG: JSON Syntax Error at offset %d: %v", syntaxErr.Offset, syntaxErr)
		} else if isUnmarshal {
			log.Printf("DEBUG: JSON Unmarshal Type Error: expected %v, got %v at offset %d", unmarshalErr.Type, unmarshalErr.Value, unmarshalErr.Offset)
		} else {
			log.Printf("DEBUG: Decode error: %v", err)
		}
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("DEBUG: Received override request for service %s: %+v", body.SourceServiceID, body)

	if body.SourceServiceID == "" {
		http.Error(w, "Source Service ID is required", http.StatusBadRequest)
		return
	}

	err := h.db.Queries.UpsertServiceOverride(context.Background(), sqlc.UpsertServiceOverrideParams{
		SourceServiceID:     body.SourceServiceID,
		DisplayName:         func() pgtype.Text { if body.DisplayName != nil { return pgtype.Text{String: *body.DisplayName, Valid: true} } else { return pgtype.Text{} } }(),
		DisplayDescription:  func() pgtype.Text { if body.DisplayDescription != nil { return pgtype.Text{String: *body.DisplayDescription, Valid: true} } else { return pgtype.Text{} } }(),
		RateMultiplier:      pgtype.Float8{Float64: body.RateMultiplier, Valid: true},
		IsHidden:            pgtype.Bool{Bool: body.IsHidden, Valid: true},
		Category:            func() pgtype.Text { if body.Category != nil { return pgtype.Text{String: *body.Category, Valid: true} } else { return pgtype.Text{} } }(),
		Tags:                body.Tags,
		ProviderCategory:    func() pgtype.Text { if body.ProviderCategory != nil { return pgtype.Text{String: *body.ProviderCategory, Valid: true} } else { return pgtype.Text{} } }(),
		DisplayID:           pgtype.Text{String: body.DisplayID, Valid: true},
		Refill:              func() pgtype.Bool { if body.Refill != nil { return pgtype.Bool{Bool: *body.Refill, Valid: true} } else { return pgtype.Bool{} } }(),
		Cancel:              func() pgtype.Bool { if body.Cancel != nil { return pgtype.Bool{Bool: *body.Cancel, Valid: true} } else { return pgtype.Bool{} } }(),
		Dripfeed:            func() pgtype.Bool { if body.Dripfeed != nil { return pgtype.Bool{Bool: *body.Dripfeed, Valid: true} } else { return pgtype.Bool{} } }(),
		ServiceType:         func() pgtype.Text { if body.Type != nil { return pgtype.Text{String: *body.Type, Valid: true} } else { return pgtype.Text{} } }(),
		Targeting:           func() pgtype.Text { if body.Targeting != nil { return pgtype.Text{String: *body.Targeting, Valid: true} } else { return pgtype.Text{} } }(),
		Quality:             func() pgtype.Text { if body.Quality != nil { return pgtype.Text{String: *body.Quality, Valid: true} } else { return pgtype.Text{} } }(),
		Stability:           func() pgtype.Text { if body.Stability != nil { return pgtype.Text{String: *body.Stability, Valid: true} } else { return pgtype.Text{} } }(),
		RefillLimit:         func() pgtype.Int4 { if body.RefillLimit != nil { return pgtype.Int4{Int32: *body.RefillLimit, Valid: true} } else { return pgtype.Int4{Int32: 3, Valid: true} } }(),
		CustomInputRequired: func() pgtype.Bool { if body.CustomInputRequired != nil { return pgtype.Bool{Bool: *body.CustomInputRequired, Valid: true} } else { return pgtype.Bool{} } }(),
		CustomInputLabel:    func() pgtype.Text { if body.CustomInputLabel != nil { return pgtype.Text{String: *body.CustomInputLabel, Valid: true} } else { return pgtype.Text{} } }(),
	})

	if err != nil {
		log.Printf("Failed to update override: %v", err)
		http.Error(w, "Failed to save override", http.StatusInternalServerError)
		return
	}

	// Invalidate cache immediately so changes appear
	h.smm.InvalidateCache()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func (h *Handler) BulkUpdateServiceOverrides(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SourceServiceIDs    interface{} `json:"sourceServiceIds"`
		DisplayName         *string     `json:"displayName"`
		DisplayDescription  *string     `json:"displayDescription"`
		RateMultiplier      float64     `json:"rateMultiplier"`
		IsHidden            *bool       `json:"isHidden"`
		Category            *string     `json:"category"`
		Tags                []string    `json:"tags"`
		ProviderCategory    *string     `json:"providerCategory"`
		DisplayID           *string     `json:"displayId"`
		Refill              *bool       `json:"refill"`
		Cancel              *bool       `json:"cancel"`
		Dripfeed            *bool       `json:"dripfeed"`
		Type                *string     `json:"type"`
		Targeting           *string     `json:"targeting"`
		Quality             *string     `json:"quality"`
		Stability           *string     `json:"stability"`
		RefillLimit         *int32      `json:"refillLimit"`
		CustomInputRequired *bool       `json:"customInputRequired"`
		CustomInputLabel    *string     `json:"customInputLabel"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var serviceIDs []string
	switch v := body.SourceServiceIDs.(type) {
	case []interface{}:
		for _, item := range v {
			if s, ok := item.(string); ok {
				serviceIDs = append(serviceIDs, s)
			} else if f, ok := item.(float64); ok {
				serviceIDs = append(serviceIDs, fmt.Sprintf("%.0f", f))
			}
		}
	case []string:
		serviceIDs = v
	}

	if len(serviceIDs) == 0 {
		http.Error(w, "Source Service IDs are required", http.StatusBadRequest)
		return
	}

	tx, err := h.db.Pool.Begin(context.Background())
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	qtx := h.db.Queries.WithTx(tx)

	for _, id := range serviceIDs {
		isHidden := false
		if body.IsHidden != nil {
			isHidden = *body.IsHidden
		}

		err = qtx.BulkUpsertServiceOverride(context.Background(), sqlc.BulkUpsertServiceOverrideParams{
			SourceServiceID: id,
			Column2:         body.DisplayName,
			Column3:         body.DisplayDescription,
			Column4:         body.RateMultiplier,
			Column5:         isHidden,
			Column6:         body.Category,
			Column7:         body.Tags,
			Column8:         body.ProviderCategory,
			Column9:         body.DisplayID,
			Column10:        body.Refill,
			Column11:        body.Cancel,
			Column12:        body.Dripfeed,
			Column13:        body.Type,
			Column14:        body.Targeting,
			Column15:        body.Quality,
			Column16:        body.Stability,
			Column17:        func() pgtype.Int4 { if body.RefillLimit != nil { return pgtype.Int4{Int32: *body.RefillLimit, Valid: true} } else { return pgtype.Int4{Int32: 3, Valid: true} } }(),
			Column18:        body.CustomInputRequired,
			Column19:        body.CustomInputLabel,
		})
		if err != nil {
			log.Printf("Bulk update failed for %s: %v", id, err)
			tx.Rollback(context.Background())
			http.Error(w, "Bulk update failed", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	h.smm.InvalidateCache()
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}
