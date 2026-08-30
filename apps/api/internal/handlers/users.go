package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"pablosmm/backend/internal/db/sqlc"
)

type AdminUser struct {
	ID         int     `json:"id"`
	Name       string  `json:"name"`
	Username   string  `json:"username"`
	Email      string  `json:"email"`
	Mobile     string  `json:"mobile"`
	Role       string  `json:"role"`
	Balance    float64 `json:"balance"` // Converted from cents
	OrderCount int     `json:"orderCount"`
	TotalSpend float64 `json:"totalSpend"` // Converted from cents
	Currency   string  `json:"currency"`
	CreatedAt  string  `json:"createdAt"`
}

type WalletUpdateReq struct {
	Amount      float64 `json:"amount"` // Amount in main currency unit (e.g. USD)
	Type        string  `json:"type"`   // "credit" or "debit"
	Description string  `json:"description"`
}

type UserUpdateReq struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Mobile   string `json:"mobile"`
	Currency string `json:"currency"`
}

// GetUsers lists all users with pagination and search
func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
	// Parse query params
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")
	search := r.URL.Query().Get("search")

	page := 1
	limit := 50
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	offset := (page - 1) * limit

	// Execute using sqlc
	usersRow, err := h.db.Queries.GetUsers(context.Background(), sqlc.GetUsersParams{
		Search: search,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		log.Printf("Error fetching users: %v", err)
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}

	users := []AdminUser{}
	for _, row := range usersRow {
		var u AdminUser
		u.ID = int(row.ID)
		u.Name = row.Name.String
		u.Username = row.Username
		u.Email = row.Email.String
		u.Mobile = row.Mobile
		u.Role = row.Role
		u.Currency = row.Currency
		u.CreatedAt = fmt.Sprintf("%v", row.CreatedAt.Time)
		u.Balance = float64(row.Balance) / 100.0
		u.OrderCount = int(row.OrderCount)
		u.TotalSpend = float64(row.TotalSpend) / 100.0
		users = append(users, u)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"users": users,
		"page":  page,
		"limit": limit,
	})
}

// GetUser returns detailed info for a single user
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Fetch basic info using sqlc
	uRow, err := h.db.Queries.GetUserAdmin(context.Background(), int32(id))
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	
	var u AdminUser
	u.ID = int(uRow.ID)
	u.Name = uRow.Name.String
	u.Username = uRow.Username
	u.Email = uRow.Email.String
	u.Mobile = uRow.Mobile
	u.Role = uRow.Role
	u.Currency = uRow.Currency
	u.CreatedAt = fmt.Sprintf("%v", uRow.CreatedAt.Time)
	u.Balance = float64(uRow.Balance) / 100.0
	u.OrderCount = int(uRow.OrderCount)
	u.TotalSpend = float64(uRow.TotalSpend) / 100.0

	// Fetch recent orders (last 5)
	type OrderSummary struct {
		ID        int     `json:"id"`
		ServiceID string  `json:"serviceId"`
		Amount    float64 `json:"amount"`
		Status    string  `json:"status"`
		CreatedAt string  `json:"createdAt"`
	}

	orders := []OrderSummary{}
	ordersRow, err := h.db.Queries.GetUserOrdersAdmin(context.Background(), int32(id))
	if err == nil {
		for _, row := range ordersRow {
			orders = append(orders, OrderSummary{
				ID:        int(row.ID),
				ServiceID: row.ServiceID,
				Amount:    float64(row.AmountCents) / 100.0,
				Status:    row.Status,
				CreatedAt: fmt.Sprintf("%v", row.CreatedAt.Time),
			})
		}
	}

	// Fetch recent transactions (last 10)
	type TransactionSummary struct {
		ID          int     `json:"id"`
		Amount      float64 `json:"amount"`
		Type        string  `json:"type"`
		Description string  `json:"description"`
		CreatedAt   string  `json:"createdAt"`
	}

	transactions := []TransactionSummary{}
	txsRow, err := h.db.Queries.GetUserTransactionsAdmin(context.Background(), pgtype.Int4{Int32: int32(id), Valid: true})
	if err == nil {
		for _, row := range txsRow {
			var amt float64
			if row.Amount.Valid {
				// PgNumeric has Int, wait, Amount is pgtype.Numeric. Since it's float, we can just use float parsing.
				val, _ := row.Amount.Float64Value()
				amt = val.Float64
			}
			transactions = append(transactions, TransactionSummary{
				ID:          int(row.ID),
				Amount:      amt,
				Type:        row.Type,
				Description: row.Description.String,
				CreatedAt:   row.CreatedAt.Time.Format(time.RFC3339),
			})
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"user":         u,
		"orders":       orders,
		"transactions": transactions,
	})
}

// UpdateUserWallet adds or removes funds
func (h *Handler) UpdateUserWallet(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	userID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var req WalletUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Amount <= 0 {
		http.Error(w, "Amount must be positive", http.StatusBadRequest)
		return
	}

	amountCents := int(req.Amount * 100)
	if req.Type == "debit" {
		amountCents = -amountCents
	} else if req.Type != "credit" {
		http.Error(w, "Invalid transaction type", http.StatusBadRequest)
		return
	}

	// Update wallet logic (upsert wallet if not exists)
	tx, err := h.db.Pool.Begin(context.Background())
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	qtx := h.db.Queries.WithTx(tx)

	// Ensure wallet exists and update balance
	err = qtx.UpsertWalletBalance(context.Background(), sqlc.UpsertWalletBalanceParams{
		UserID:  int32(userID),
		Balance: int32(amountCents),
	})
	if err != nil {
		log.Printf("Failed to update wallet: %v", err)
		http.Error(w, "Failed to update balance", http.StatusInternalServerError)
		return
	}

	newBalance, err := qtx.GetWalletBalance(context.Background(), int32(userID))
	if err != nil {
		log.Printf("Failed to get wallet balance: %v", err)
		http.Error(w, "Failed to get new balance", http.StatusInternalServerError)
		return
	}

	// Log Transaction
	err = qtx.InsertTransaction(context.Background(), sqlc.InsertTransactionParams{
		UserID:      pgtype.Int4{Int32: int32(userID), Valid: true},
		Amount:      func() pgtype.Numeric { n := pgtype.Numeric{}; n.Scan(fmt.Sprintf("%f", req.Amount)); return n }(),
		Type:        req.Type,
		Description: pgtype.Text{String: req.Description, Valid: true},
	})

	if err != nil {
		log.Printf("Failed to log transaction: %v", err)
		http.Error(w, "Transaction logging failed", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(context.Background()); err != nil {
		http.Error(w, "Transaction failed", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "success",
		"newBalance": float64(newBalance) / 100.0,
	})
}

// UpdateUser updates profile info
func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var req UserUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.db.Queries.UpdateUser(context.Background(), sqlc.UpdateUserParams{
		Name:     pgtype.Text{String: req.Name, Valid: req.Name != ""},
		Email:    pgtype.Text{String: req.Email, Valid: req.Email != ""},
		Role:     pgtype.Text{String: req.Role, Valid: req.Role != ""},
		Mobile:   pgtype.Text{String: req.Mobile, Valid: req.Mobile != ""},
		Currency: pgtype.Text{String: req.Currency, Valid: req.Currency != ""},
		ID:       int32(id),
	})
	if err != nil {
		log.Printf("Update user failed: %v", err)
		http.Error(w, "Failed to update user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// UpdateProfile updates the authenticated user's profile (restricted fields)
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userIDVal := r.Context().Value("userID")
	if userIDVal == nil {
		log.Printf("❌ [UpdateProfile] No userID in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := userIDVal.(int)

	var req UserUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Check if req is empty
	if req.Name == "" && req.Mobile == "" && req.Currency == "" {
		http.Error(w, "No fields to update", http.StatusBadRequest)
		return
	}

	err := h.db.Queries.UpdateProfile(context.Background(), sqlc.UpdateProfileParams{
		Name:     pgtype.Text{String: req.Name, Valid: req.Name != ""},
		Mobile:   pgtype.Text{String: req.Mobile, Valid: req.Mobile != ""},
		Currency: pgtype.Text{String: req.Currency, Valid: req.Currency != ""},
		ID:       int32(userID),
	})
	if err != nil {
		log.Printf("Update profile failed: %v", err)
		http.Error(w, "Failed to update profile", http.StatusInternalServerError)
		return
	}

	// Fetch updated user to return
	// Or just return success
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// ImpersonateUser generates a valid user authentication session for admin speculation/investigation
func (h *Handler) ImpersonateUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	uRow, err := h.db.Queries.GetUserAdmin(context.Background(), int32(id))
	if err != nil {
		log.Printf("Error fetching user for impersonation: %v", err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Generate JWT for the target user
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID: int(uRow.ID),
		Role:   uRow.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		http.Error(w, "Server error generating session", http.StatusInternalServerError)
		return
	}

	// Set auth_token cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    tokenString,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
		HttpOnly: false,
		Expires:  expirationTime,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": tokenString,
		"user": map[string]interface{}{
			"id":       uRow.ID,
			"name":     uRow.Name.String,
			"email":    uRow.Email.String,
			"username": uRow.Username,
			"role":     uRow.Role,
			"currency": uRow.Currency,
			"balance":  float64(uRow.Balance) / 100.0,
		},
		"impersonated": true,
	})
}
