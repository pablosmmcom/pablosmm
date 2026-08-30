-- name: CheckUserExists :one
SELECT EXISTS(SELECT 1 FROM users WHERE email=$1 OR username=$2);

-- name: CreateUser :exec
INSERT INTO users (name, email, username, mobile, password_hash, role, currency)
VALUES ($1, $2, $3, $4, $5, 'user', 'INR');

-- name: GetUserForLogin :one
SELECT id, password_hash, role 
FROM users 
WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1);

-- name: GetUserDataForMe :one
SELECT 
    u.id, 
    u.name, 
    COALESCE(u.username, '')::text as username, 
    u.email, 
    COALESCE(u.mobile, '')::text as mobile, 
    u.role, 
    COALESCE(u.currency, 'INR')::text as currency,
    u.created_at, 
    COALESCE(u.password_hash, '')::text as password_hash,
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

-- name: GetOrderStatsForUser :one
SELECT 
    COUNT(*) FILTER (WHERE status IN ('pending', 'processing', 'submitted', 'in_progress', 'active'))::int as active_count,
    COUNT(*) FILTER (WHERE status IN ('completed', 'partial'))::int as completed_count,
    COUNT(*) FILTER (WHERE status IN ('canceled', 'failed', 'refunded'))::int as failed_count
FROM orders 
WHERE user_id = $1;

-- name: CheckGoogleUser :one
SELECT id, role FROM users WHERE email=$1 OR google_id=$2;

-- name: UpdateGoogleInfo :exec
UPDATE users SET google_id=$1, avatar_url=$2 WHERE id=$3;

-- name: CreateGoogleUser :one
INSERT INTO users (name, email, google_id, avatar_url, role, username, currency)
VALUES ($1, $2, $3, $4, 'user', $5, 'INR')
RETURNING id, role;

-- name: GetPasswordHash :one
SELECT COALESCE(password_hash, '')::text FROM users WHERE id=$1;

-- name: UpdatePassword :exec
UPDATE users SET password_hash=$1 WHERE id=$2;
