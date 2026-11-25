// config.js lo genera el pipeline con la URL de la API desplegada
const API = (window.API_URL || "").replace(/\/$/, "");
let productos = [];
const cantidades = {}; // product_id -> cantidad elegida

const catalogo = document.getElementById("catalogo");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const precio = n => "$" + Number(n).toLocaleString("es-CO");

// Emoji de respaldo cuando el producto no tiene foto
function emojiDe(nombre) {
  const n = nombre.toLowerCase();
  if (n.includes("croissant")) return "🥐";
  if (n.includes("bono") || n.includes("queso")) return "🧀";
  if (n.includes("frances") || n.includes("baguette")) return "🥖";
  if (n.includes("torta") || n.includes("pastel")) return "🍰";
  if (n.includes("galleta")) return "🍪";
  if (n.includes("dona")) return "🍩";
  return "🍞";
}

function tarjeta(p) {
  const id = esc(p.product_id);
  const nombre = esc(p.name);
  const foto = p.image_url
    ? `<img src="${esc(p.image_url)}" alt="${nombre}" loading="lazy"
         onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'foto-emoji',textContent:'${emojiDe(p.name)}'}))">`
    : `<span class="foto-emoji" aria-hidden="true">${emojiDe(p.name)}</span>`;
  return `
    <article class="card" data-card="${id}">
      <div class="card-foto">${foto}</div>
      <div class="card-cuerpo">
        <h3>${nombre}</h3>
        <p class="card-precio">${precio(p.price)}</p>
        <div class="stepper" role="group" aria-label="Cantidad de ${nombre}">
          <button type="button" data-accion="menos" data-id="${id}" aria-label="Quitar uno">−</button>
          <output data-cant="${id}">0</output>
          <button type="button" data-accion="mas" data-id="${id}" aria-label="Agregar uno">+</button>
        </div>
      </div>
    </article>`;
}

function cambiarCantidad(id, delta) {
  const nueva = Math.max(0, Math.min(99, (cantidades[id] || 0) + delta));
  cantidades[id] = nueva;
  document.querySelector(`[data-cant="${CSS.escape(id)}"]`).textContent = nueva;
  document.querySelector(`[data-card="${CSS.escape(id)}"]`).classList.toggle("elegido", nueva > 0);
}

catalogo.addEventListener("click", e => {
  const b = e.target.closest("button[data-accion]");
  if (b) cambiarCantidad(b.dataset.id, b.dataset.accion === "mas" ? 1 : -1);
});

async function cargar() {
  try {
    const r = await fetch(API + "/products");
    if (!r.ok) throw new Error(r.status);
    productos = await r.json();
    catalogo.innerHTML = productos.length
      ? productos.map(tarjeta).join("")
      : `<p class="vacio">Por ahora no hay productos disponibles.</p>`;
  } catch (e) {
    catalogo.innerHTML = `<p class="vacio">No se pudo cargar el catálogo. Intenta de nuevo en un momento.</p>`;
  }
}

document.getElementById("enviar").onclick = async () => {
  const items = Object.entries(cantidades)
    .filter(([, qty]) => qty > 0)
    .map(([product_id, qty]) => ({ product_id, qty }));
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
