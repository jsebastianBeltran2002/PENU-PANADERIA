import os
import sys
import types


# Evita requerir azure-functions para probar la validacion
class _App:
    def __init__(self, *args, **kwargs):
        pass

    def route(self, *args, **kwargs):
        return lambda f: f


fake = types.ModuleType("azure.functions")
fake.FunctionApp = _App
fake.AuthLevel = types.SimpleNamespace(ANONYMOUS=0)
fake.HttpRequest = fake.HttpResponse = object
sys.modules.setdefault("azure", types.ModuleType("azure"))
sys.modules["azure.functions"] = fake
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "azure", "api"))
import function_app as fa  # noqa: E402


def test_valido():
    assert fa.validate_order({"customer_name": "Ana", "pickup_time": "09:30",
                              "items": [{"product_id": "p1", "qty": 2}]}) is None


def test_hora_invalida():
    assert "pickup_time" in fa.validate_order({"customer_name": "Ana", "pickup_time": "99:99",
                                               "items": [{"product_id": "p1", "qty": 1}]})


def test_sin_items():
    assert fa.validate_order({"customer_name": "Ana", "pickup_time": "10:00", "items": []})


def test_qty_invalida():
    assert fa.validate_order({"customer_name": "Ana", "pickup_time": "10:00",
                              "items": [{"product_id": "p1", "qty": "x"}]})
