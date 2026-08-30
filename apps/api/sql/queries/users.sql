-- name: GetUsers :many
SELECT 
	u.id, u.name, COALESCE(u.username, '')::text as username, u.email, COALESCE(u.mobile, '')::text as mobile, u.role, COALESCE(u.currency, 'INR')::text as currency, u.created_at,
	COALESCE(w.balance, 0)::int as balance,
	(SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) as order_count,
	(SELECT COALESCE(SUM(
		CASE 
			WHEN o.status IN ('failed', 'canceled', 'refunded') THEN 0 
			ELSE o.amount_cents 
		END
	), 0)::int FROM orders o WHERE o.user_id = u.id) as total_spend
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
WHERE (@search::text = '' OR u.name ILIKE '%' || @search || '%' OR u.email ILIKE '%' || @search || '%')
ORDER BY u.created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetUserAdmin :one
SELECT 
	u.id, u.name, COALESCE(u.username, '')::text as username, u.email, COALESCE(u.mobile, '')::text as mobile, u.role, COALESCE(u.currency, 'INR')::text as currency, u.created_at,
	COALESCE(w.balance, 0)::int as balance,
	(SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) as order_count,
	(SELECT COALESCE(SUM(
		CASE 
			WHEN o.status IN ('failed', 'canceled', 'refunded') THEN 0 
			ELSE o.amount_cents 
		END
	), 0)::int FROM orders o WHERE o.user_id = u.id) as total_spend
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
WHERE u.id = $1;

-- name: GetUserOrdersAdmin :many
SELECT id, service_id, amount_cents, status, created_at 
FROM orders 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 5;

-- name: GetUserTransactionsAdmin :many
SELECT id, amount, type, description, created_at 
FROM transactions 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 10;

-- name: UpdateUser :exec
UPDATE users SET 
    name = COALESCE(sqlc.narg('name'), name),
    email = COALESCE(sqlc.narg('email'), email),
    role = COALESCE(sqlc.narg('role'), role),
    mobile = COALESCE(sqlc.narg('mobile'), mobile),
    currency = COALESCE(sqlc.narg('currency'), currency)
WHERE id = $1;

-- name: UpdateProfile :exec
UPDATE users SET 
    name = COALESCE(sqlc.narg('name'), name),
    mobile = COALESCE(sqlc.narg('mobile'), mobile),
    currency = COALESCE(sqlc.narg('currency'), currency)
WHERE id = $1;


-- name: GetUserProfile :one
SELECT u.id, u.name, u.email, u.role, COALESCE(u.api_key, '')::text as api_key, COALESCE(w.balance, 0)::int as balance
FROM users u LEFT JOIN wallets w ON u.id = w.user_id WHERE u.email = $1;
