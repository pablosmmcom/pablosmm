# Fix: `make dev-web` fails with "Cannot find module 'less/dist/less-node.cjs'"

## Root Cause

Two issues:

1. **Dependencies not installed**: `apps/web/node_modules` does not exist. `npm install` has not been run.
2. **Stale Less import path**: `dev.js` (line 6) and `package.json` (`build:less` script) both require `less/dist/less-node.cjs`. This path was removed in **Less 4.x** (the project uses `"less": "^4.5.1"`). In Less 4, the correct import is simply `require('less')`.

## Changes Required

### `apps/web/dev.js`
- Line 6: Replace `require('less/dist/less-node.cjs')` with `require('less')`
- Update the comment on line 5 to reflect that Less 4 works directly.

### `apps/web/package.json`
- `build:less` script (line 12): Replace `less/dist/less-node.cjs` with `less`

## Steps to Execute

1. Edit `apps/web/dev.js` — fix the require path.
2. Edit `apps/web/package.json` — fix the build:less script require path.
3. Run `cd apps/web && npm install` (or `make install` from repo root).
4. Run `make dev-web` (or `npm run dev` from `apps/web`).

## Validation

- `npm run dev` should start the Less watcher without throwing `MODULE_NOT_FOUND`.
- `npm run build:less` should compile `app/style.less` → `app/style.css` successfully.
- Next.js dev server should start normally after the watcher initializes.

## Risk

Low. The change is a direct path fix for a well-known Less 4 migration issue. No other files reference `less/dist/less-node.cjs`.
