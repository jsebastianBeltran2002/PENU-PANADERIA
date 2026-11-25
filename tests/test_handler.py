import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lambda"))
import handler  # noqa: E402


class FakeTable:
    def __init__(self, items=None):
        self.items = list(items or [])

    def scan(self):
        return {"Items": self.items}

    def put_item(self, Item):
        self.items.append(Item)


def setup_function(_):
    handler._tables.clear()
    handler._tables["products"] = FakeTable(
        [
            {"product_id": "p2", "name": "Pan de bono", "price": 2500},
            {"product_id": "p1", "name": "Croissant", "price": 4000},
        ]
    )
    handler._tables["orders"] = FakeTable()


def call(method, path, body=None):
    event = {"httpMethod": method, "path": path}
    if body is not None:
        event["body"] = json.dumps(body)
    r = handler.handler(event)
    return r["statusCode"], json.loads(r["body"])


def test_catalogo_ordenado():
    status, body = call("GET", "/products")
    assert status == 200
    assert [p["name"] for p in body] == ["Croissant", "Pan de bono"]


def test_crear_pedido_valido():
    status, body = call(
        "POST",
        "/orders",
        {
            "customer_name": "Ana",
            "pickup_time": "09:30",
            "items": [{"product_id": "p1", "qty": 2}],
        },
    )
    assert status == 201
    assert body["status"] == "RECIBIDO"
    assert len(handler._tables["orders"].items) == 1


def test_pedido_hora_invalida():
    status, body = call(
        "POST",
        "/orders",
        {
            "customer_name": "Ana",
            "pickup_time": "25:99",
            "items": [{"product_id": "p1", "qty": 1}],
        },
    )
    assert status == 400
    assert "pickup_time" in body["error"]


def test_pedido_sin_items():
    status, _ = call(
        "POST",
        "/orders",
        {"customer_name": "Ana", "pickup_time": "10:00", "items": []},
    )
    assert status == 400


def test_ruta_desconocida():
    status, _ = call("GET", "/otra")
    assert status == 404
