// config.js lo genera el pipeline con la URL de la API desplegada
const API = (window.API_URL || "").replace(/\/$/, "");
let productos = [];

async function cargar() {
  try {
    const r = await fetch(API + "/products");
    productos = await r.json();
    document.getElementById("catalogo").innerHTML = productos.map(p => `
      <div class="prod">
        <div class="info">
          <img src="${p.image_url || ''}" alt="" onerror="this.style.visibility='hidden'">
          <div><strong>${p.name}</strong><br>$${Number(p.price).toLocaleString("es-CO")}</div>
        </div>
        <input type="number" min="0" value="0" data-id="${p.product_id}" aria-label="Cantidad de ${p.name}">
      </div>`).join("");
  } catch (e) {
    document.getElementById("catalogo").textContent = "No se pudo cargar el catalogo";
  }
}

document.getElementById("enviar").onclick = async () => {
  const items = [...document.querySelectorAll("input[data-id]")]
    .map(i => ({ product_id: i.dataset.id, qty: parseInt(i.value, 10) }))
    .filter(i => i.qty > 0);
  const body = {
    customer_name: document.getElementById("nombre").value,
    pickup_time: document.getElementById("hora").value,
    items
  };
  const r = await fetch(API + "/orders", { method: "POST", body: JSON.stringify(body) });
  const data = await r.json();
  document.getElementById("msg").textContent =
    r.ok ? "Pedido recibido: " + data.order_id : "Error: " + data.error;
};

cargar();
