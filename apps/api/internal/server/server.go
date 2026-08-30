package server

import (
	"log"
	"net/http"
	"strings"

	"pablosmm/backend/internal/config"
	"pablosmm/backend/internal/db"
	"pablosmm/backend/internal/handlers"
	"pablosmm/backend/internal/service/metadata"
	"pablosmm/backend/internal/service/smm"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func New(cfg *config.Config, database *db.DB, smmSvc *smm.ProviderService) *http.Server {
	metaSvc := metadata.New()
	h := handlers.New(database, cfg, smmSvc, metaSvc)
	h.EnsureDefaultAdminUser()

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			if origin == "http://localhost:3000" || origin == "http://127.0.0.1:3000" {
				return true
			}
			if strings.HasPrefix(origin, "http://192.168.") || strings.HasPrefix(origin, "http://10.") || strings.HasPrefix(origin, "http://172.") {
				return true
			}
			if origin == "https://pablosmm.com" || origin == "https://www.pablosmm.com" || origin == "https://api.pablosmm.com" || strings.HasSuffix(origin, ".vercel.app") {
				return true
			}
			if origin != "" {
				log.Printf("[CORS] rejected origin: %s", origin)
			}
			return false
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "x-user-email"},
		AllowCredentials: true,
	}))

	r.Route("/api", func(r chi.Router) {
		handlers.InitAuth()

		r.Get("/health", h.HealthCheck)
		r.Post("/webhooks/cryptomus", h.CryptomusWebhook)

		r.Get("/v2", h.SmmApiV2)
		r.Post("/v2", h.SmmApiV2)

		r.Post("/notify/upi", h.AutoVerifyDeposit)

		r.Post("/auth/register", h.Register)
		r.Post("/auth/login", h.Login)
		r.Post("/auth/logout", h.Logout)
		r.Get("/auth/google/login", h.GoogleLogin)
		r.Get("/auth/google/callback", h.GoogleCallback)

		r.Group(func(r chi.Router) {
			r.Use(h.AuthMiddleware)
			r.Get("/auth/me", h.Me)
			r.Post("/wallet/deposit", h.RequestDeposit)
			r.Put("/wallet/deposit/utr", h.UpdateDepositUTR)
			r.Get("/wallet/deposit/status", h.GetDepositStatus)
			r.Post("/wallet/cryptomus/create", h.CreateCryptomusPayment)
			r.Get("/wallet/transactions/recent", h.GetRecentTransactions)
			r.Get("/orders", h.GetOrders)
			r.Post("/orders/{id}/cancel", h.CancelOrder)
			r.Post("/orders/{id}/refill", h.RefillOrder)
			r.Post("/orders", h.CreateOrder)
			r.Get("/orders/{id}", h.GetSingleOrder)
			r.Post("/auth/change-password", h.ChangePassword)
			r.Put("/profile", h.UpdateProfile)
			r.Post("/profile/api-key", h.GenerateAPIKey)
		})

		r.Get("/services", h.GetServices)
		r.Get("/profile", h.GetProfile)
		r.Get("/metadata", h.GetMetadata)

		r.Get("/provider/services", h.GetRawProviderServices)
		r.Post("/provider/services/curate", h.CurateServicesAdmin)

		r.Post("/admin/login", h.AdminLogin)

		r.Group(func(r chi.Router) {
			r.Use(h.AdminAuthMiddleware)

			r.Get("/admin/services", h.GetAdminServices)
			r.Get("/admin/services/refresh", h.RefreshServices)
			r.Post("/admin/services/override", h.UpdateServiceOverride)
			r.Post("/admin/services/bulk-override", h.BulkUpdateServiceOverrides)

			r.Get("/admin/catalog", h.GetCatalogServicesAdmin)
			r.Post("/admin/catalog", h.CreateCatalogServiceAdmin)
			r.Put("/admin/catalog/{id}", h.UpdateCatalogServiceAdmin)
			r.Delete("/admin/catalog/{id}", h.DeleteCatalogServiceAdmin)
			r.Get("/admin/provider-services", h.GetRawProviderServices)

			r.Post("/admin/services/curate", h.CurateServicesAdmin)
			r.Post("/admin/services/clear-pending-provider-submissions", h.ClearPendingProviderSubmissions)
			r.Post("/admin/services/ai-rewrite", h.AIRewriteService)

			r.Get("/admin/providers", h.ListProvidersAdmin)
			r.Post("/admin/providers", h.UpsertProviderAdmin)
			r.Delete("/admin/providers/{id}", h.DeleteProviderAdmin)

			r.Get("/admin/users", h.GetUsers)
			r.Get("/admin/users/{id}", h.GetUser)
			r.Post("/admin/users/{id}/wallet", h.UpdateUserWallet)
			r.Patch("/admin/users/{id}", h.UpdateUser)
			r.Post("/admin/users/{id}/impersonate", h.ImpersonateUser)

			r.Get("/admin/orders", h.GetAdminOrders)
			r.Post("/admin/orders/{id}/refund", h.RefundOrder)
			r.Patch("/admin/orders/{id}/refills", h.UpdateOrderRefills)

			r.Get("/admin/order-requests", h.GetAdminOrderRequests)
			r.Post("/admin/order-requests/{id}/approve", h.ApproveOrderRequest)
			r.Post("/admin/order-requests/{id}/reject", h.RejectOrderRequest)

			r.Get("/admin/wallet-requests", h.ListWalletRequests)
			r.Post("/admin/wallet-requests/{id}/approve", h.ApproveWalletRequest)
			r.Post("/admin/wallet-requests/{id}/reject", h.RejectWalletRequest)

			r.Get("/admin/settings", h.GetSettings)
			r.Post("/admin/settings", h.UpdateSettings)
			r.Post("/admin/taxonomy", h.UpdateTaxonomy)
		})

		r.Get("/taxonomy", h.GetPublicTaxonomy)
	})

	return &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}
}
