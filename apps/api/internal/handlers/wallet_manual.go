package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"pablosmm/backend/internal/db/sqlc"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type DepositReq struct {
	Amount        float64 `json:"amount"`
	Method        string  `json:"method"`
	TransactionID string  `json:"transaction_id"`
}

type WalletRequest struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	UserEmail     string    `json:"user_email"`
	Amount        float64   `json:"amount"`
	UniqueAmount  *float64  `json:"unique_amount,omitempty"`
	Method        string    `json:"method"`
	TransactionID string    `json:"transaction_id"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

// RequestDeposit allows user to submit a manual UPI payment request
func (h *Handler) RequestDeposit(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)
	var req DepositReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Amount < 50 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Minimum deposit amount is ₹50"})
		return
	}

	// Rate limit: max 10 pending requests per user
	pendingCount, _ := h.db.Queries.CheckPendingRequestCount(context.Background(), pgtype.Int4{Int32: int32(userID), Valid: true})

	if pendingCount >= 10 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		json.NewEncoder(w).Encode(map[string]string{"error": "Too many pending requests. Please wait for existing ones to be processed."})
		return
	}

	ctx := context.Background()
	var upiID string

	if req.Method == "UPI" {
		// Check global_settings first
		setting, err := h.db.Queries.GetSetting(ctx, "upi_id")
		if err == nil && setting != "" {
			// Found in DB
			ids := strings.Split(setting, ",")
			for i := range ids {
				ids[i] = strings.TrimSpace(ids[i])
			}
			if len(ids) > 0 {
				upiID = ids[rand.Intn(len(ids))]
			}
		} else if h.cfg.UPIIDs != "" {
			// Fallback to env config
			ids := strings.Split(h.cfg.UPIIDs, ",")
			for i := range ids {
				ids[i] = strings.TrimSpace(ids[i])
			}
			if len(ids) > 0 {
				upiID = ids[rand.Intn(len(ids))]
			}
		}
	}

	// Double check duplicate UTR (only if UTR provided)
	if req.TransactionID != "" {
		_, err := h.db.Queries.CheckTransactionIDExists(ctx, pgtype.Text{String: req.TransactionID, Valid: true})
		if err == nil {
			http.Error(w, "Transaction ID already used", http.StatusConflict)
			return
		}
	}

	// Insert with or without transaction_id (UTR may come later via notification)
	var txnID pgtype.Text
	if req.TransactionID != "" {
		txnID = pgtype.Text{String: req.TransactionID, Valid: true}
	}

	// UniqueAmount is no longer used, we just pass NULL (invalid pgtype.Numeric)
	var ua pgtype.Numeric

	requestID, err := h.db.Queries.InsertWalletRequest(ctx, sqlc.InsertWalletRequestParams{
		UserID:        pgtype.Int4{Int32: int32(userID), Valid: true},
		Amount:        func() pgtype.Numeric { n := pgtype.Numeric{}; n.Scan(fmt.Sprintf("%f", req.Amount)); return n }(),
		UniqueAmount:  ua,
		Method:        req.Method,
		TransactionID: txnID,
	})

	if err != nil {
		log.Printf("Deposit request failed: %v", err)
		http.Error(w, "Failed to submit request", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"message":    "Deposit request submitted successfully",
		"request_id": requestID,
	}

	if upiID != "" {
		response["upi_id"] = upiID
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// UpdateDepositUTR allows user to attach a UTR to an existing pending UPI deposit request
func (h *Handler) UpdateDepositUTR(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)

	var req struct {
		RequestID     int    `json:"request_id"`
		TransactionID string `json:"transaction_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.RequestID <= 0 || req.TransactionID == "" {
		http.Error(w, "Missing request_id or transaction_id", http.StatusBadRequest)
		return
	}

	// Check duplicate UTR
	_, err := h.db.Queries.CheckTransactionIDExists(context.Background(), pgtype.Text{String: req.TransactionID, Valid: true})
	if err == nil {
		http.Error(w, "Transaction ID already used", http.StatusConflict)
		return
	}

	// Update only if the request belongs to this user and is still pending
	rowsAffected, err := h.db.Queries.UpdateDepositUTR(context.Background(), sqlc.UpdateDepositUTRParams{
		TransactionID: pgtype.Text{String: req.TransactionID, Valid: true},
		ID:            int32(req.RequestID),
		UserID:        pgtype.Int4{Int32: int32(userID), Valid: true},
	})

	if err != nil {
		log.Printf("Failed to update UTR: %v", err)
		http.Error(w, "Failed to update", http.StatusInternalServerError)
		return
	}

	if rowsAffected == 0 {
		http.Error(w, "Request not found or already processed", http.StatusNotFound)
		return
	}

	// NEW: Check if this UTR was already received by the Android app
	notification, err := h.db.Queries.GetUnmatchedUPINotification(context.Background(), pgtype.Text{String: req.TransactionID, Valid: true})
	if err == nil {
		// Found it! Let's verify the amount
		reqAmount, err := h.db.Queries.GetWalletRequestAmount(context.Background(), int32(req.RequestID))
		if err == nil {
			reqAmtFloat, _ := reqAmount.Float64Value()
			notifAmtFloat, _ := notification.Amount.Float64Value()

			// If amount matches within tolerance, auto-approve!
			if math.Abs(reqAmtFloat.Float64-notifAmtFloat.Float64) < 0.02 {
				log.Printf("[UPI-NOTIFY] Late match! Request %d matched with UTR %s", req.RequestID, req.TransactionID)

				tx, err := h.db.Pool.Begin(context.Background())
				if err == nil {
					defer tx.Rollback(context.Background())
					qtx := h.db.Queries.WithTx(tx)

					// Update request status
					qtx.UpdateWalletRequestStatusAndTxn(context.Background(), sqlc.UpdateWalletRequestStatusAndTxnParams{
						Status:        pgtype.Text{String: "approved", Valid: true},
						TransactionID: pgtype.Text{String: req.TransactionID, Valid: true},
						ID:            int32(req.RequestID),
					})

					// Credit wallet (with 10% bonus if >= 100)
					creditedAmount := reqAmtFloat.Float64
					desc := "UPI Deposit (Auto-Verified)"
					if creditedAmount >= 100 {
						bonus := creditedAmount * 0.10
						creditedAmount += bonus
						desc = fmt.Sprintf("UPI Deposit (Auto-Verified + 10%% Bonus ₹%.2f)", bonus)
					}
					amountCents := int(math.Round(creditedAmount * 100))
					qtx.UpsertWalletBalance(context.Background(), sqlc.UpsertWalletBalanceParams{
						UserID:  int32(userID),
						Balance: int32(amountCents),
					})

					// Log transaction
					qtx.InsertTransaction(context.Background(), sqlc.InsertTransactionParams{
						UserID:      pgtype.Int4{Int32: int32(userID), Valid: true},
						Amount:      func() pgtype.Numeric { n := pgtype.Numeric{}; n.Scan(fmt.Sprintf("%f", creditedAmount)); return n }(),
						Type:        "credit",
						Description: pgtype.Text{String: desc, Valid: true},
					})

					// Update notification status
					qtx.MarkUPINotificationMatched(context.Background(), sqlc.MarkUPINotificationMatchedParams{
						MatchedRequestID: pgtype.Int4{Int32: int32(req.RequestID), Valid: true},
						ID:               notification.ID,
					})

					tx.Commit(context.Background())
					json.NewEncoder(w).Encode(map[string]string{"message": "Payment verified automatically!", "status": "approved"})
					return
				}
			}
		}
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "UTR updated successfully", "status": "pending"})
}

// UPINotification is the payload sent by the Android notification listener app
type UPINotification struct {
	Amount    float64 `json:"amount"`
	UTR       string  `json:"utr"`
	SenderUPI string  `json:"sender_upi"`
	RawText   string  `json:"raw_text"`
}

// AutoVerifyDeposit is called by the Android notification listener app
// to automatically verify and approve UPI deposits
func (h *Handler) AutoVerifyDeposit(w http.ResponseWriter, r *http.Request) {
	// 1. Validate API key
	apiKey := r.Header.Get("X-Notify-Key")
	expectedKey := h.cfg.UPINotifyKey

	// Debug: log key comparison (safely, only first/last 4 chars)
	safeKey := func(k string) string {
		if len(k) <= 8 {
			return "***"
		}
		return k[:4] + "..." + k[len(k)-4:]
	}
	log.Printf("[UPI-NOTIFY] Auth check: received=%s expected=%s match=%v",
		safeKey(apiKey), safeKey(expectedKey), apiKey == expectedKey)

	if apiKey == "" || apiKey != expectedKey {
		log.Printf("[UPI-NOTIFY] 401 Unauthorized — key mismatch")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// 2. Parse request
	var notif UPINotification
	if err := json.NewDecoder(r.Body).Decode(&notif); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if notif.Amount <= 0 {
		http.Error(w, "Invalid amount", http.StatusBadRequest)
		return
	}

	log.Printf("[UPI-NOTIFY] Received: amount=%.2f, utr=%s, sender=%s", notif.Amount, notif.UTR, notif.SenderUPI)

	ctx := context.Background()

	// 3. Check for duplicate UTR first (idempotency)
	if notif.UTR != "" {
		_, err := h.db.Queries.CheckUPINotificationExists(ctx, pgtype.Text{String: notif.UTR, Valid: true})
		if err == nil {
			// Already processed this notification
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":  "duplicate",
				"message": "This notification was already processed",
			})
			return
		}
	}

	// 4. Try to match against pending wallet_requests by UTR
	matchRow, err := h.db.Queries.FindMatchingWalletRequestByUTR(ctx, pgtype.Text{String: notif.UTR, Valid: true})

	if err != nil {
		// No matching pending request found — log as unmatched
		log.Printf("[UPI-NOTIFY] No matching pending request for amount=%.2f", notif.Amount)

		h.db.Queries.InsertUPINotificationUnmatched(ctx, sqlc.InsertUPINotificationUnmatchedParams{
			Amount:    func() pgtype.Numeric { n := pgtype.Numeric{}; n.Scan(fmt.Sprintf("%f", notif.Amount)); return n }(),
			Utr:       pgtype.Text{String: notif.UTR, Valid: true},
			SenderUpi: pgtype.Text{String: notif.SenderUPI, Valid: true},
			RawText:   pgtype.Text{String: notif.RawText, Valid: true},
		})

		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "no_match",
			"message": "No matching pending request found",
		})
		return
	}

	reqID := int(matchRow.ID)
	userID := int(matchRow.UserID.Int32)
	reqAmount, _ := matchRow.Amount.Float64Value()

	// 5. Found a match! Auto-approve in a transaction
	log.Printf("[UPI-NOTIFY] Matched request %d (user %d, amount %.2f) with notification amount %.2f", reqID, userID, reqAmount.Float64, notif.Amount)

	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)
	qtx := h.db.Queries.WithTx(tx)

	// 5a. Lock and verify still pending
	currentStatus, err := qtx.GetWalletRequestStatusForUpdate(ctx, int32(reqID))
	if err != nil || currentStatus.String != "pending" {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "already_processed",
			"message": "Request was already processed",
		})
		return
	}

	// 5b. Update request status + set the UTR
	txnID := notif.UTR
	if txnID == "" {
		// Generate unique auto-verify transaction ID when no UTR available
		txnID = fmt.Sprintf("auto_%d_%d", time.Now().UnixMilli(), reqID)
	}
	err = qtx.UpdateWalletRequestStatusAndTxn(ctx, sqlc.UpdateWalletRequestStatusAndTxnParams{
		Status:        pgtype.Text{String: "approved", Valid: true},
		TransactionID: pgtype.Text{String: txnID, Valid: true},
		ID:            int32(reqID),
	})
	if err != nil {
		log.Printf("[UPI-NOTIFY] Failed to update request: %v", err)
		http.Error(w, "Failed to update", http.StatusInternalServerError)
		return
	}

	// 5c. Credit user wallet (with 10% bonus if >= 100)
	creditedAmount := reqAmount.Float64
	desc := "UPI Deposit (Auto-Verified)"
	if creditedAmount >= 100 {
		bonus := creditedAmount * 0.10
		creditedAmount += bonus
		desc = fmt.Sprintf("UPI Deposit (Auto-Verified + 10%% Bonus ₹%.2f)", bonus)
	}
	amountCents := int(math.Round(creditedAmount * 100))
	err = qtx.UpsertWalletBalance(ctx, sqlc.UpsertWalletBalanceParams{
		UserID:  int32(userID),
		Balance: int32(amountCents),
	})
	if err != nil {
		log.Printf("[UPI-NOTIFY] Failed to credit wallet: %v", err)
		http.Error(w, "Failed to credit wallet", http.StatusInternalServerError)
		return
	}

	// 5d. Log transaction
	err = qtx.InsertTransaction(ctx, sqlc.InsertTransactionParams{
		UserID:      pgtype.Int4{Int32: int32(userID), Valid: true},
		Amount:      func() pgtype.Numeric { n := pgtype.Numeric{}; n.Scan(fmt.Sprintf("%f", creditedAmount)); return n }(),
		Type:        "credit",
		Description: pgtype.Text{String: desc, Valid: true},
	})
	if err != nil {
		log.Printf("[UPI-NOTIFY] Failed to log transaction: %v", err)
	}

	// 5e. Commit
	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "Commit failed", http.StatusInternalServerError)
		return
	}

	// 6. Log the notification as matched
	h.db.Queries.InsertUPINotificationMatched(ctx, sqlc.InsertUPINotificationMatchedParams{
		Amount:           func() pgtype.Numeric { n := pgtype.Numeric{}; n.Scan(fmt.Sprintf("%f", notif.Amount)); return n }(),
		Utr:              pgtype.Text{String: notif.UTR, Valid: true},
		SenderUpi:        pgtype.Text{String: notif.SenderUPI, Valid: true},
		RawText:          pgtype.Text{String: notif.RawText, Valid: true},
		MatchedRequestID: pgtype.Int4{Int32: int32(reqID), Valid: true},
	})

	log.Printf("[UPI-NOTIFY] ✅ Auto-approved request %d for user %d, amount ₹%.2f", reqID, userID, reqAmount.Float64)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "approved",
		"message":    fmt.Sprintf("Auto-approved ₹%.2f for user %d", reqAmount.Float64, userID),
		"request_id": reqID,
	})
}

// Admin: List Requests
func (h *Handler) ListWalletRequests(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Queries.ListWalletRequestsAdmin(context.Background())
	if err != nil {
		http.Error(w, "Failed to fetch requests", http.StatusInternalServerError)
		return
	}

	var requests []WalletRequest
	for _, row := range rows {
		var req WalletRequest
		req.ID = int(row.ID)
		req.UserID = int(row.UserID.Int32)
		req.UserEmail = row.Email.String
		val, _ := row.Amount.Float64Value()
		req.Amount = val.Float64
		req.Method = row.Method
		req.TransactionID = row.TransactionID
		req.Status = row.Status.String
		req.CreatedAt = row.CreatedAt.Time
		requests = append(requests, req)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"requests": requests})
}

// Admin: Approve Request
func (h *Handler) ApproveWalletRequest(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.Atoi(idStr)

	ctx := context.Background()
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// 1. Get Request and Lock
	qtx := h.db.Queries.WithTx(tx)
	reqRow, err := qtx.GetWalletRequestForUpdateAdmin(ctx, int32(id))
	if err != nil {
		log.Printf("Error finding request %d: %v", id, err)
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	userID := int(reqRow.UserID.Int32)
	val, _ := reqRow.Amount.Float64Value()
	amount := val.Float64
	status := reqRow.Status

	if status.String != "pending" {
		log.Printf("Request %d not pending: %s", id, status.String)
		http.Error(w, "Request already processed", http.StatusBadRequest)
		return
	}

	// 2. Update Request Status
	err = qtx.UpdateWalletRequestStatusAndTxn(ctx, sqlc.UpdateWalletRequestStatusAndTxnParams{
		Status:        pgtype.Text{String: "approved", Valid: true},
		TransactionID: pgtype.Text{Valid: false},
		ID:            int32(id),
	})
	if err != nil {
		log.Printf("Error updating request status: %v", err)
		http.Error(w, "Failed to update status", http.StatusInternalServerError)
		return
	}

	// 3. Calculate 10% bonus if amount >= 100
	creditedAmount := amount
	desc := "Manual Deposit Approved"
	if amount >= 100 {
		bonus := amount * 0.10
		creditedAmount = amount + bonus
		desc = fmt.Sprintf("Manual Deposit Approved (₹%.0f + 10%% Bonus ₹%.2f)", amount, bonus)
	}

	// 4. Update User Balance (Upsert into wallets table)
	amountCents := int(math.Round(creditedAmount * 100))
	err = qtx.UpsertWalletBalance(ctx, sqlc.UpsertWalletBalanceParams{
		UserID:  int32(userID),
		Balance: int32(amountCents),
	})

	if err != nil {
		log.Printf("Error updating wallet balance: %v", err)
		http.Error(w, "Failed to update balance", http.StatusInternalServerError)
		return
	}

	// 5. Insert Transaction Log
	err = qtx.InsertTransaction(ctx, sqlc.InsertTransactionParams{
		UserID:      pgtype.Int4{Int32: int32(userID), Valid: true},
		Amount:      func() pgtype.Numeric { n := pgtype.Numeric{}; n.Scan(fmt.Sprintf("%f", creditedAmount)); return n }(),
		Type:        "credit",
		Description: pgtype.Text{String: desc, Valid: true},
	})
	if err != nil {
		http.Error(w, "Failed to log transaction", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "Commit failed", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Approved successfully"})
}

// Admin: Reject Request
func (h *Handler) RejectWalletRequest(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.Atoi(idStr)

	err := h.db.Queries.RejectWalletRequest(context.Background(), int32(id))
	if err != nil {
		http.Error(w, "Failed to reject", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Rejected successfully"})
}

// GetDepositStatus returns the current status of a wallet deposit request
// Used by the frontend to poll for auto-verification
func (h *Handler) GetDepositStatus(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "Missing request id", http.StatusBadRequest)
		return
	}

	reqID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid request id", http.StatusBadRequest)
		return
	}

	status, err := h.db.Queries.GetDepositStatus(context.Background(), sqlc.GetDepositStatusParams{
		ID:     int32(reqID),
		UserID: pgtype.Int4{Int32: int32(userID), Valid: true},
	})

	if err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": status.String})
}

// GetRecentTransactions returns money (credit) transactions for the authenticated user.
// By default returns 3 most recent. Pass ?all=true to get up to 50.
func (h *Handler) GetRecentTransactions(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)
	uid := pgtype.Int4{Int32: int32(userID), Valid: true}

	type txnResp struct {
		ID          int32   `json:"id"`
		Amount      float64 `json:"amount"`
		Type        string  `json:"type"`
		Description string  `json:"description"`
		CreatedAt   string  `json:"created_at"`
	}

	var result []txnResp

	if r.URL.Query().Get("all") == "true" {
		rows, err := h.db.Queries.GetAllMoneyTransactions(context.Background(), uid)
		if err != nil {
			log.Printf("Error fetching all transactions: %v", err)
			http.Error(w, "Failed to fetch transactions", http.StatusInternalServerError)
			return
		}
		result = make([]txnResp, 0, len(rows))
		for _, row := range rows {
			var amount float64
			if row.Amount.Valid {
				f, _ := row.Amount.Float64Value()
				amount = f.Float64
			}
			desc := ""
			if row.Description.Valid {
				desc = row.Description.String
			}
			createdAt := ""
			if row.CreatedAt.Valid {
				createdAt = row.CreatedAt.Time.Format(time.RFC3339)
			}
			result = append(result, txnResp{
				ID: row.ID, Amount: amount, Type: row.Type,
				Description: desc, CreatedAt: createdAt,
			})
		}
	} else {
		rows, err := h.db.Queries.GetRecentMoneyTransactions(context.Background(), uid)
		if err != nil {
			log.Printf("Error fetching recent transactions: %v", err)
			http.Error(w, "Failed to fetch transactions", http.StatusInternalServerError)
			return
		}
		result = make([]txnResp, 0, len(rows))
		for _, row := range rows {
			var amount float64
			if row.Amount.Valid {
				f, _ := row.Amount.Float64Value()
				amount = f.Float64
			}
			desc := ""
			if row.Description.Valid {
				desc = row.Description.String
			}
			createdAt := ""
			if row.CreatedAt.Valid {
				createdAt = row.CreatedAt.Time.Format(time.RFC3339)
			}
			result = append(result, txnResp{
				ID: row.ID, Amount: amount, Type: row.Type,
				Description: desc, CreatedAt: createdAt,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
