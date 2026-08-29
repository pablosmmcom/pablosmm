package syncer

import (
	"context"
	"fmt"
	"log"
	"pablosmm/backend/internal/db"
	"pablosmm/backend/internal/provider"
	"pablosmm/backend/internal/service/smm"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"pablosmm/backend/internal/db/sqlc"
)

type OrderSyncer struct {
	db  *db.DB
	smm *smm.ProviderService
}

func New(database *db.DB, smmSvc *smm.ProviderService) *OrderSyncer {
	return &OrderSyncer{db: database, smm: smmSvc}
}

func (s *OrderSyncer) Start(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Minute)
	// Run once immediately
	go s.SyncOrders(ctx)

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.SyncOrders(ctx)
			}
		}
	}()
}

func (s *OrderSyncer) SyncOrders(ctx context.Context) {
	log.Println("Starting Order Sync...")

	// 1. Fetch pending/processing orders + recently canceled/failed to catch provider corrections
	rows, err := s.db.Queries.GetOrdersForSync(ctx)
	if err != nil {
		log.Printf("Sync fetch error: %v", err)
		return
	}

		// provider_key -> []orderIDs
	providerGroups := make(map[string][]string)
	orderMap := make(map[string]int) // providerID -> localID

	for _, row := range rows {
		providerKey := row.ProviderKey
		if providerKey == "" {
			providerKey = provider.DefaultKey
		}
		providerGroups[providerKey] = append(providerGroups[providerKey], row.ProviderOrderID.String)
		orderMap[row.ProviderOrderID.String] = int(row.ID)
	}

	if len(orderMap) == 0 {
		log.Println("No orders found to sync.")
		return
	}
	log.Printf("Syncing %d orders across %d providers", len(orderMap), len(providerGroups))

	statusData := make(map[string]interface{})

	// 2. Fetch from Providers
	for providerKey, orderIDs := range providerGroups {
		providerStatus, err := s.smm.GetOrderStatus(providerKey, orderIDs)
		if err != nil {
			log.Printf("Sync provider error for %s: %v", providerKey, err)
			continue
		}
		log.Printf("Provider %s returned status for %d orders", providerKey, len(providerStatus))
		
		for k, v := range providerStatus {
			statusData[k] = v
		}
	}

	// 3. Update DB
	for pID, localID := range orderMap {
		if raw, ok := statusData[pID]; ok {
			if data, ok := raw.(map[string]interface{}); ok {
				// Get status string robustly
				var pStatus string
				if s, ok := data["status"].(string); ok {
					pStatus = s
				} else {
					pStatus = fmt.Sprintf("%v", data["status"])
				}

				// Get remains and start_count robustly
				remains := parseInterfaceInt(data["remains"])
				startCount := parseInterfaceInt(data["start_count"])

				if pStatus != "" {
					localStatus := mapProviderStatus(pStatus)

					// CRITICAL: Do NOT overwrite refunded or canceled orders
					// These are terminal states set manually by admins
					// Fetch the order data so we can calculate refunds if topsmm canceled it
					orderRow, err := s.db.Queries.GetOrderForSyncUpdate(ctx, int32(localID))
					if err != nil {
						log.Printf("Failed to read order %d for refund sync: %v", localID, err)
						continue
					}

					amountCents := int(orderRow.AmountCents)
					uID := int(orderRow.UserID)
					quantity := int(orderRow.Quantity)
					currentStatus := orderRow.Status

					// Proceed if the DB status is not already terminal
					if currentStatus != "refunded" && currentStatus != "canceled" {
						tx, txErr := s.db.Pool.Begin(ctx)
						if txErr == nil {
							qtx := s.db.Queries.WithTx(tx)
							refundCents := 0
							if localStatus == "canceled" {
								refundCents = amountCents // 100% refund
							} else if localStatus == "partial" && quantity > 0 && remains > 0 {
								// Safe integer math: fraction of amount to refund
								refundCents = (amountCents * remains) / quantity
							}

							if refundCents > 0 {
								// Refund Wallet
								qtx.CreditWallet(ctx, sqlc.CreditWalletParams{
									Balance: int32(refundCents),
									UserID:  int32(uID),
								})

								// Log Transaction
								qtx.InsertTransaction(ctx, sqlc.InsertTransactionParams{
									UserID:      pgtype.Int4{Int32: int32(uID), Valid: true},
									Amount:      func() pgtype.Numeric { n := pgtype.Numeric{}; n.Scan(fmt.Sprintf("%f", float64(refundCents)/100.0)); return n }(),
									Type:        "credit",
									Description: pgtype.Text{String: fmt.Sprintf("Auto-Refund for provider status '%s' Order #%d", localStatus, localID), Valid: true},
								})

								// Update Order with Refund Amount
								qtx.UpdateOrderSyncWithRefund(ctx, sqlc.UpdateOrderSyncWithRefundParams{
									Status:         localStatus,
									Remains:        pgtype.Int4{Int32: int32(remains), Valid: true},
									StartCount:     pgtype.Int4{Int32: int32(startCount), Valid: true},
									RefundedAmount: pgtype.Int4{Int32: int32(refundCents), Valid: true},
									ID:             int32(localID),
								})
							} else {
								// Just update the status normally
								qtx.UpdateOrderSyncNoRefund(ctx, sqlc.UpdateOrderSyncNoRefundParams{
									Status:     localStatus,
									Remains:    pgtype.Int4{Int32: int32(remains), Valid: true},
									StartCount: pgtype.Int4{Int32: int32(startCount), Valid: true},
									ID:         int32(localID),
								})
							}

							// If order is completed, canceled, refunded or failed, resolve any pending cancel requests
							if localStatus == "completed" || localStatus == "canceled" || localStatus == "refunded" || localStatus == "failed" {
								_, _ = s.db.Pool.Exec(ctx, "UPDATE order_requests SET status = 'processed', updated_at = NOW() WHERE order_id = $1 AND status = 'pending'", localID)
							}

							tx.Commit(ctx)
						}
					}
				}
			}
		}
	}
	log.Println("Order Sync Complete")
}

func parseInterfaceInt(v interface{}) int {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case string:
		i, _ := strconv.Atoi(val)
		return i
	case float64:
		return int(val)
	case int:
		return val
	case int32:
		return int(val)
	}
	// Fallback
	s := fmt.Sprintf("%v", v)
	if s == "<nil>" || s == "" {
		return 0
	}
	f, _ := strconv.ParseFloat(s, 64)
	return int(f)
}

func mapProviderStatus(s string) string {
	s = strings.ToLower(s)
	switch s {
	case "completed", "complete":
		return "completed"
	case "pending":
		return "pending"
	case "processing":
		return "processing"
	case "inprogress", "in progress", "active":
		return "active"
	case "canceled", "cancelled":
		return "canceled"
	case "partial", "partially completed":
		return "partial"
	case "failed", "fail":
		return "failed"
	default:
		return "active"
	}
}

func jsonString(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
