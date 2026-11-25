#!/usr/bin/env bash
# Despliega el MVP sobre Floci: Terraform (infra) + carga de datos + sitio.
set -euo pipefail

export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1
EP="${FLOCI_ENDPOINT:-http://localhost:4566}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Terraform"
terraform -chdir="$ROOT/infra" init -input=false
terraform -chdir="$ROOT/infra" apply -auto-approve -input=false -var "endpoint=$EP"

API_ID=$(terraform -chdir="$ROOT/infra" output -raw api_id)
BUCKET=$(terraform -chdir="$ROOT/infra" output -raw site_bucket)
API_URL="$EP/restapis/$API_ID/prod/_user_request_"

echo "==> Cargando catalogo"
aws --endpoint-url "$EP" dynamodb batch-write-item \
  --request-items "file://$ROOT/data/products.json"

echo "==> Publicando sitio"
echo "window.API_URL = \"$API_URL\";" > "$ROOT/frontend/config.js"
aws --endpoint-url "$EP" s3 sync "$ROOT/frontend" "s3://$BUCKET" --delete

SITE_URL="$EP/$BUCKET/index.html"
echo "$API_URL" > "$ROOT/.api_url"
echo "$SITE_URL" > "$ROOT/.site_url"
echo "Sitio: $SITE_URL"
echo "API:   $API_URL"
