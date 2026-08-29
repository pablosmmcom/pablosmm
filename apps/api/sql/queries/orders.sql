-- name: GetOrders :many
SELECT 
	o.id, 
	o.service_id, 
	o.amount_cents, 
	o.quantity, 
	o.status, 
	o.created_at, 
	o.provider_order_id,
	COALESCE(pc.display_id, o.service_id)::text as display_id,
	COALESCE(pc.name, 'Service #' || o.service_id)::text as display_name,
	COALESCE(o.remains, 0)::int as remains,
	COALESCE(o.start_count, 0)::int as start_count,
	COALESCE(o.link, '')::text as link,
	(SELECT COALESCE(balance, 0)::int FROM wallets WHERE user_id = o.user_id) as user_balance,
	COALESCE(pc.platform, '')::text as service_type,
	COALESCE(pc.category, '')::text as category,
	(EXISTS(SELECT 1 FROM order_requests WHERE order_id = o.id AND request_type = 'cancel' AND status = 'pending') AND o.status NOT IN ('completed', 'canceled', 'refunded', 'failed'))::boolean as pending_cancel
FROM orders o
LEFT JOIN LATERAL (
    SELECT name, platform, category, id::text as display_id
    FROM pablo_catalog
    WHERE (o.service_id ~ '^[0-9]+$' AND id = o.service_id::int)
       OR (provider_service_id = o.service_id)
       OR (provider_id || ':' || provider_service_id = o.service_id)
    LIMIT 1
) pc ON true
WHERE o.user_id = $1
AND (sqlc.narg('status_filter')::text IS NULL OR 
     (sqlc.narg('status_filter') = 'active' AND o.status IN ('pending', 'processing', 'submitted', 'active', 'in_progress')) OR
     (sqlc.narg('status_filter') != 'active' AND o.status = sqlc.narg('status_filter'))
    )
ORDER BY o.created_at DESC;

-- name: GetOrderForCancel :one
SELECT status, amount_cents, COALESCE(provider_order_id, '')::text as provider_order_id, COALESCE(provider_key, '')::text as provider_key
FROM orders 
WHERE id=$1 AND user_id=$2 
FOR UPDATE;

-- name: CancelOrder :exec
UPDATE orders SET status='canceled' WHERE id=$1;

-- name: GetOrderForRefundAdmin :one
SELECT status, amount_cents, COALESCE(refunded_amount, 0)::int as refunded_amount, user_id, COALESCE(provider_key, '')::text as provider_key 
FROM orders WHERE id = $1 FOR UPDATE;

-- name: UpdateOrderRefundAdmin :one
UPDATE orders SET status = $1, refunded_amount = $2 WHERE id = $3 RETURNING COALESCE(provider_order_id, '')::text;

-- name: GetAdminOrders :many
SELECT 
	o.id, 
	o.service_id, 
	o.amount_cents, 
	o.quantity, 
	o.status, 
	o.created_at, 
	COALESCE(o.provider_order_id, '')::text as provider_order_id,
	COALESCE(pc.display_id, o.service_id)::text as display_id,
	COALESCE(pc.name, 'Service #' || o.service_id)::text as display_name,
	COALESCE(pc.provider_service_id, o.service_id)::text as source_service_id,
	COALESCE(o.remains, 0)::int as remains,
	COALESCE(o.start_count, 0)::int as start_count,
	COALESCE(o.link, '')::text as link,
	u.email,
	COALESCE(o.refunded_amount, 0)::int as refunded_amount,
	COALESCE(o.refills_remaining, 3)::int as refills_remaining,
	3::int as service_refill_limit,
	false::boolean as service_refill_enabled
FROM orders o
JOIN users u ON o.user_id = u.id
LEFT JOIN LATERAL (
    SELECT name, platform, category, id::text as display_id, provider_service_id
    FROM pablo_catalog
    WHERE (o.service_id ~ '^[0-9]+$' AND id = o.service_id::int)
       OR (provider_service_id = o.service_id)
       OR (provider_id || ':' || provider_service_id = o.service_id)
    LIMIT 1
) pc ON true
WHERE (sqlc.narg('status_filter')::text IS NULL OR o.status = sqlc.narg('status_filter'))
AND (sqlc.narg('user_id')::int IS NULL OR o.user_id = sqlc.narg('user_id'))
ORDER BY o.created_at DESC;

-- name: InsertOrder :one
INSERT INTO orders (user_id, service_id, amount_cents, quantity, link, status, provider_order_id, provider_resp, refills_remaining, provider_key)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id;

-- name: DeleteOrder :exec
DELETE FROM orders WHERE id = $1;

-- name: GetSingleOrder :one
SELECT 
	o.id, 
	o.service_id, 
	o.amount_cents, 
	o.quantity, 
	o.status, 
	o.created_at, 
    o.updated_at,
	COALESCE(pc.display_id, o.service_id)::text as display_id,
	COALESCE(pc.name, 'Service #' || o.service_id)::text as display_name,
	COALESCE(o.remains, 0)::int as remains,
	COALESCE(o.start_count, 0)::int as start_count,
	COALESCE(o.link, '')::text as link,
	COALESCE(pc.platform, '')::text as service_type,
	COALESCE(pc.category, '')::text as category,
	COALESCE(o.refills_remaining, 3)::int as refills_remaining
FROM orders o
LEFT JOIN LATERAL (
    SELECT name, platform, category, id::text as display_id
    FROM pablo_catalog
    WHERE (o.service_id ~ '^[0-9]+$' AND id = o.service_id::int)
       OR (provider_service_id = o.service_id)
       OR (provider_id || ':' || provider_service_id = o.service_id)
    LIMIT 1
) pc ON true
WHERE o.id = $1 AND o.user_id = $2;

-- name: UpdateOrderProvider :exec
UPDATE orders SET provider_resp = $1, provider_order_id = $2, status = $3 WHERE id = $4;

-- name: UpdateOrderRefillsAdmin :exec
UPDATE orders SET refills_remaining = $2 WHERE id = $1;
