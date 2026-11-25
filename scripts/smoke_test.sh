#!/usr/bin/env bash
# Smoke test contra el sitio y la API desplegados.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL=$(cat "$ROOT/.api_url")
SITE_URL=$(cat "$ROOT/.site_url")

echo "==> Sitio responde"
curl -fsS "$SITE_URL" | grep -q "Pan de la Casa"

echo "==> Catalogo responde con productos"
curl -fsS "$API_URL/products" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d)>0, 'catalogo vacio'"

echo "==> Registrar pedido"
curl -fsS -X POST "$API_URL/orders" \
  -d '{"customer_name":"Smoke","pickup_time":"09:00","items":[{"product_id":"p1","qty":1}]}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='RECIBIDO'"

echo "Smoke test OK"
