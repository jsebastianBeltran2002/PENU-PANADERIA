"""API de El Último Capítulo en Azure Functions (Python) con Table Storage."""
import json
import os
import re
import uuid
from datetime import datetime, timezone

import azure.functions as func

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
DEFAULT_PRODUCTS = [
    ("p1", "Croissant", 4000),
    ("p2", "Pan de bono", 2500),
    ("p3", "Pan frances", 1200),
    ("p4", "Torta de chocolate", 18000),
]


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
        try:
            qty = int(it.get("qty", 0))
        except (TypeError, ValueError):
            qty = 0
        if not it.get("product_id") or qty < 1:
            return "Cada item requiere product_id y qty >= 1"
    return None


def _table(name):
    from azure.data.tables import TableServiceClient

    conn = os.environ["STORAGE_CONNECTION_STRING"]
    client = TableServiceClient.from_connection_string(conn)
    return client.create_table_if_not_exists(name)


def _json(body, status=200):
    return func.HttpResponse(json.dumps(body), status_code=status,
                             mimetype="application/json")


@app.route(route="products", methods=["GET"])
def products(req: func.HttpRequest) -> func.HttpResponse:
    table = _table("products")
    rows = list(table.list_entities())
    if not rows:  # primera vez: sembrar el catalogo
        for pid, name, price in DEFAULT_PRODUCTS:
            table.upsert_entity({"PartitionKey": "product", "RowKey": pid,
                                 "name": name, "price": price, "image_url": ""})
        rows = list(table.list_entities())
    out = [{"product_id": r["RowKey"], "name": r["name"],
            "price": r["price"], "image_url": r.get("image_url", "")} for r in rows]
    return _json(sorted(out, key=lambda p: p["name"]))


@app.route(route="orders", methods=["POST"])
def orders(req: func.HttpRequest) -> func.HttpResponse:
    try:
        data = req.get_json()
    except ValueError:
        return _json({"error": "JSON invalido"}, 400)
    error = validate_order(data)
    if error:
        return _json({"error": error}, 400)
    order_id = str(uuid.uuid4())
    items = [{"product_id": i["product_id"], "qty": int(i["qty"])} for i in data["items"]]
    now = datetime.now(timezone.utc)
    _table("orders").create_entity({
        "PartitionKey": now.strftime("%Y-%m-%d"), "RowKey": order_id,
        "customer_name": data["customer_name"].strip(),
        "pickup_time": data["pickup_time"], "items": json.dumps(items),
        "created_at": now.isoformat(), "status": "RECIBIDO"})
    return _json({"order_id": order_id, "status": "RECIBIDO",
                  "pickup_time": data["pickup_time"], "items": items}, 201)
