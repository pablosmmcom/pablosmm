package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"pablosmm/backend/internal/db/sqlc"
)

// RefundOrder refunds an order manually
func (h *Handler) RefundOrder(w http.ResponseWriter, r *http.Request) {
	orderIDStr := chi.URLParam(r, "id")
	orderID, _ := strconv.Atoi(orderIDStr)

	// Parse optional body for partial refund
	var req struct {
		Amount float64 `json:"amount"` // Optional amount to refund
	}
	// Ignore error if body is empty (full refund default)
	_ = json.NewDecoder(r.Body).Decode(&req)

	// Transaction
	tx, err := h.db.Pool.Begin(context.Background())
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	qtx := h.db.Queries.WithTx(tx)

	// 1. Get current status, amount, and already refunded amount
	orderRow, err := qtx.GetOrderForRefundAdmin(context.Background(), int32(orderID))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Order not found"})
		return
	}
	status := orderRow.Status
	amountCents := int(orderRow.AmountCents)
	refundedCents := int(orderRow.RefundedAmount)
	userID := int(orderRow.UserID)

	// Calculate remaining refundable amount
	remainingCents := amountCents - refundedCents
	if remainingCents <= 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Order is already fully refunded"})
		return
	}

	// Build Refund Amount
	refundAmountCents := remainingCents // Default to full remaining
	isPartial := false

	if req.Amount > 0 {
		reqCents := int(req.Amount * 100)
		if reqCents < remainingCents {
			refundAmountCents = reqCents
			isPartial = true
		} else if reqCents > remainingCents {
			// Cap at remaining
			refundAmountCents = remainingCents
		}
	}

	// 2. Credit Wallet
	err = qtx.UpsertWalletBalance(context.Background(), sqlc.UpsertWalletBalanceParams{
		UserID:  int32(userID),
		Balance: int32(refundAmountCents),
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to refund wallet"})
		return
	}

	// 3. Log Transaction
	desc := fmt.Sprintf("Refund for Order #%d", orderID)
	if isPartial {
		desc = fmt.Sprintf("Partial Refund for Order #%d", orderID)
	}
	err = qtx.InsertTransaction(context.Background(), sqlc.InsertTransactionParams{
		UserID:      pgtype.Int4{Int32: int32(userID), Valid: true},
		Amount:      func() pgtype.Numeric { n := pgtype.Numeric{}; n.Scan(fmt.Sprintf("%f", float64(refundAmountCents)/100.0)); return n }(),
		Type:        "credit",
		Description: pgtype.Text{String: desc, Valid: true},
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to log transaction"})
		return
	}

	// 4. Update Order
	// Update refunded_amount. Only mark 'refunded' if fully refunded.
	newRefundedTotal := refundedCents + refundAmountCents
	newStatus := status
	if newRefundedTotal >= amountCents {
		newStatus = "refunded"
	} else if status != "refunded" && status != "canceled" {
		// Keep existing status if partial, or maybe mark 'partial_refunded'?
		// For now keep original status (e.g. 'completed' or 'processing') unless fully refunded.
	}

	providerOrderID, err := qtx.UpdateOrderRefundAdmin(context.Background(), sqlc.UpdateOrderRefundAdminParams{
		Status:         newStatus,
		RefundedAmount: pgtype.Int4{Int32: int32(newRefundedTotal), Valid: true},
		ID:             int32(orderID),
	})

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to update order status"})
		return
	}

	if err := tx.Commit(context.Background()); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Commit failed"})
		return
	}

	// 5. Provider Cancellation (Only on Full Refund/Cancellation)
	// Only attempt if fully refunded and status changed to refunded
	if newStatus == "refunded" && providerOrderID != "" {
		go func(pKey, pID string) {
			log.Printf("Attempting to cancel Order #%s on provider %s side...", pID, pKey)
			resp, err := h.smm.CancelOrder(pKey, pID)
			if err != nil {
				log.Printf("Provider cancel failed for %s #%s: %v", pKey, pID, err)
			} else {
				log.Printf("Provider cancel response for %s #%s: %v", pKey, pID, resp)
			}
		}(orderRow.ProviderKey, providerOrderID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Refunded %.2f successfully", float64(refundAmountCents)/100.0),
	})
}

// GetAdminOrders lists all orders for admin
func (h *Handler) GetAdminOrders(w http.ResponseWriter, r *http.Request) {
	// Filter params
	statusFilter := r.URL.Query().Get("status")
	userFilter := r.URL.Query().Get("user_id")

	var sqlStatusFilter pgtype.Text
	if statusFilter == "" || statusFilter == "all" {
		sqlStatusFilter = pgtype.Text{Valid: false}
	} else {
		sqlStatusFilter = pgtype.Text{String: statusFilter, Valid: true}
	}

	var sqlUserFilter pgtype.Int4
	if userFilter != "" {
		if uid, err := strconv.Atoi(userFilter); err == nil {
			sqlUserFilter = pgtype.Int4{Int32: int32(uid), Valid: true}
		}
	}

	ordersRow, err := h.db.Queries.GetAdminOrders(context.Background(), sqlc.GetAdminOrdersParams{
		StatusFilter: sqlStatusFilter,
		UserID:       sqlUserFilter,
	})
	if err != nil {
		log.Printf("Error fetching admin orders: %v", err)
		http.Error(w, "Failed to fetch orders", http.StatusInternalServerError)
		return
	}

	type AdminOrderRes struct {
		ID                   int     `json:"id"`
		ServiceID            string  `json:"serviceId"`
		DisplayID            string  `json:"displayId"`
		SourceServiceID      string  `json:"sourceServiceId"`
		DisplayName          string  `json:"serviceName"`
		UserEmail            string  `json:"userEmail"`
		Amount               float64 `json:"charge"`
		Quantity             int     `json:"quantity"`
		Status               string  `json:"status"`
		Date                 string  `json:"date"`
		Link                 string  `json:"link"`
		Remains              int     `json:"remains"`
		StartCount           int     `json:"startCount"`
		RefundedAmount       float64 `json:"refundedAmount"`
		ProviderOrderID      string  `json:"providerOrderId"`
		RefillsRemaining     int     `json:"refillsRemaining"`
		ServiceRefillLimit   int     `json:"serviceRefillLimit"`
		ServiceRefillEnabled bool    `json:"serviceRefillEnabled"`
	}

	orders := []AdminOrderRes{}
	for _, row := range ordersRow {
		var o AdminOrderRes
		o.ID = int(row.ID)
		o.ServiceID = row.ServiceID
		o.SourceServiceID = row.SourceServiceID
		o.Amount = float64(row.AmountCents) / 100.0
		o.Quantity = int(row.Quantity)
		o.Status = row.Status
		o.Date = row.CreatedAt.Time.Format(time.RFC3339)
		o.Link = row.Link
		o.Remains = int(row.Remains)
		o.StartCount = int(row.StartCount)
		o.UserEmail = row.Email.String
		o.RefundedAmount = float64(row.RefundedAmount) / 100.0
		o.ProviderOrderID = row.ProviderOrderID
		o.RefillsRemaining = int(row.RefillsRemaining)
		o.ServiceRefillLimit = int(row.ServiceRefillLimit)
		o.ServiceRefillEnabled = row.ServiceRefillEnabled

		o.DisplayID = row.DisplayID
		if o.DisplayID == "" {
			// Strip prefix if present (e.g., "topsmm:123" -> "123")
			if idx := strings.LastIndex(o.ServiceID, ":"); idx != -1 {
				o.DisplayID = o.ServiceID[idx+1:]
			} else {
				o.DisplayID = o.ServiceID
			}
		}

		if row.DisplayName != "" {
			o.DisplayName = row.DisplayName
		} else {
			o.DisplayName = "Service #" + o.DisplayID
		}

		orders = append(orders, o)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"orders": orders,
	})
}

// UpdateOrderRefills allows admin to manually set the refills_remaining
func (h *Handler) UpdateOrderRefills(w http.ResponseWriter, r *http.Request) {
	orderIDStr := chi.URLParam(r, "id")
	orderID, err := strconv.Atoi(orderIDStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid order ID"})
		return
	}

	var req struct {
		Refills int `json:"refills_remaining"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body"})
		return
	}

	err = h.db.Queries.UpdateOrderRefillsAdmin(context.Background(), sqlc.UpdateOrderRefillsAdminParams{
		ID:               int32(orderID),
		RefillsRemaining: pgtype.Int4{Int32: int32(req.Refills), Valid: true},
	})
	if err != nil {
		log.Printf("Failed to update refills: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to update refills"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Refills updated successfully",
	})
}
