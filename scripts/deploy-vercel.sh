#!/usr/bin/env bash
set -euo pipefail

echo "==> Orbit deployment preflight"
echo "Node: $(node -v)"
echo "NPM:  $(npm -v)"

if command -v vercel >/dev/null 2>&1; then
  VERCEL_CMD=(vercel)
else
  VERCEL_CMD=(npx -y vercel)
fi

AUTH_ARGS=()
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  AUTH_ARGS+=(--token "${VERCEL_TOKEN}")
fi

if ! "${VERCEL_CMD[@]}" whoami "${AUTH_ARGS[@]}" >/dev/null 2>&1; then
  echo "No Vercel credentials found."
  echo "Option A: run 'npx vercel login' once"
  echo "Option B: export VERCEL_TOKEN=your_token and rerun"
  exit 1
fi

echo "==> Running quality gates"
npm run lint
npm run build

if [[ -n "${VERCEL_ORG_ID:-}" && -n "${VERCEL_PROJECT_ID:-}" ]]; then
  echo "==> Pulling Vercel production environment"
  "${VERCEL_CMD[@]}" pull --yes --environment=production "${AUTH_ARGS[@]}"
else
  echo "==> Skipping vercel pull (VERCEL_ORG_ID/VERCEL_PROJECT_ID not set)"
fi

echo "==> Deploying to Vercel production"
"${VERCEL_CMD[@]}" deploy --prod --yes "${AUTH_ARGS[@]}"

echo "==> Deployment complete"
