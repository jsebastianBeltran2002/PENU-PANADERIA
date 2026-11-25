"""API de Pan de la Casa: catalogo y pedidos (Lambda + DynamoDB)."""
import json
import os
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

_tables = {}


def _table(name):
    """Crea el recurso DynamoDB solo cuando se necesita (facilita los tests)."""
    if name not in _tables:
        import boto3

        endpoint = os.environ.get("AWS_ENDPOINT_URL")
        kwargs = {"endpoint_url": endpoint} if endpoint else {}
        _tables[name] = boto3.resource("dynamodb", **kwargs).Table(name)
    return _tables[name]


def _json_default(o):
    if isinstance(o, Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    raise TypeError


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": HEADERS,
        "body": json.dumps(body, default=_json_default),
    }


def validate_order(data):
    """Devuelve un mensaje de error o None si el pedido es valido."""
    if not isinstance(data, dict):
        return "Cuerpo invalido"
    if not str(data.get("customer_name", "")).strip():
        return "customer_name es obligatorio"
    if not TIME_RE.match(str(data.get("pickup_time", ""))):
        return "pickup_time debe tener formato HH:MM"
    items = data.get("items")
    if not isinstance(items, list) or not items:
        return "items debe ser una lista con al menos un producto"
    for it in items:
        if not it.get("product_id") or int(it.get("qty", 0)) < 1:
            return "Cada item requiere product_id y qty >= 1"
    return None


def handler(event, context=None):
    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    products = _table(os.environ.get("PRODUCTS_TABLE", "products"))
    orders = _table(os.environ.get("ORDERS_TABLE", "orders"))

    if method == "OPTIONS":
        return _resp(200, {})

    if method == "GET" and path.endswith("/products"):
        items = sorted(products.scan()["Items"], key=lambda p: p["name"])
        return _resp(200, items)

    if method == "POST" and path.endswith("/orders"):
        try:
            data = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return _resp(400, {"error": "JSON invalido"})
        error = validate_order(data)
        if error:
            return _resp(400, {"error": error})
        order = {
            "order_id": str(uuid.uuid4()),
            "customer_name": data["customer_name"].strip(),
            "pickup_time": data["pickup_time"],
            "items": [
                {"product_id": i["product_id"], "qty": int(i["qty"])}
                for i in data["items"]
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "RECIBIDO",
        }
        orders.put_item(Item=order)
        return _resp(201, order)

    if method == "GET" and path.endswith("/orders"):
        return _resp(200, orders.scan()["Items"])

    return _resp(404, {"error": "No encontrado"})
