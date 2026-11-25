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
  actualizarResumen();
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

// ---- Resumen del pedido ----
const resumen = document.getElementById("resumen");
const resumenVacio = document.getElementById("resumen-vacio");
const totalEl = document.getElementById("total");
const msg = document.getElementById("msg");

function elegidos() {
  return productos
    .filter(p => (cantidades[p.product_id] || 0) > 0)
    .map(p => ({ ...p, qty: cantidades[p.product_id] }));
}

function actualizarResumen() {
  const lista = elegidos();
  resumen.innerHTML = lista.map(p => `
    <li>
      <span class="resumen-cant">${p.qty}×</span>
      <span class="resumen-nombre">${esc(p.name)}</span>
      <span class="resumen-sub">${precio(p.qty * Number(p.price))}</span>
    </li>`).join("");
  resumenVacio.hidden = lista.length > 0;
  const total = lista.reduce((s, p) => s + p.qty * Number(p.price), 0);
  totalEl.textContent = precio(total);
}

// ---- Validacion y envio ----
const form = document.getElementById("form-pedido");
const nombre = document.getElementById("nombre");
const hora = document.getElementById("hora");
const boton = document.getElementById("enviar");

function marcarError(input, texto) {
  input.classList.toggle("invalido", !!texto);
  input.setAttribute("aria-invalid", texto ? "true" : "false");
  document.getElementById("error-" + input.id).textContent = texto || "";
}

function validar() {
  let ok = true;
  if (!nombre.value.trim()) { marcarError(nombre, "Escribe tu nombre."); ok = false; }
  else marcarError(nombre, "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora.value)) { marcarError(hora, "Elige una hora de recogida."); ok = false; }
  else marcarError(hora, "");
  if (!elegidos().length) { mostrarMsg("error", "Agrega al menos un producto a tu pedido."); ok = false; }
  return ok;
}

function mostrarMsg(tipo, html) {
  msg.className = "msg msg-" + tipo;
  msg.innerHTML = html;
}

nombre.addEventListener("input", () => nombre.value.trim() && marcarError(nombre, ""));
hora.addEventListener("input", () => hora.value && marcarError(hora, ""));

form.addEventListener("submit", async e => {
  e.preventDefault();
  msg.className = "";
  msg.textContent = "";
  if (!validar()) return;

  const body = {
    customer_name: nombre.value.trim(),
    pickup_time: hora.value,
    items: elegidos().map(p => ({ product_id: p.product_id, qty: p.qty }))
  };

  boton.disabled = true;
  boton.textContent = "Enviando...";
  try {
    const r = await fetch(API + "/orders", { method: "POST", body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Error " + r.status);
    mostrarMsg("exito", `
      <strong>¡Pedido recibido, ${esc(data.customer_name)}!</strong>
      Te esperamos a las ${esc(data.pickup_time)}.
      <span class="codigo">Código: ${esc(String(data.order_id).slice(0, 8).toUpperCase())}</span>`);
    // Reiniciar el pedido
    Object.keys(cantidades).forEach(id => cantidades[id] > 0 && cambiarCantidad(id, -cantidades[id]));
    form.reset();
  } catch (err) {
    mostrarMsg("error", "No pudimos registrar tu pedido: " + esc(err.message));
  } finally {
    boton.disabled = false;
    boton.textContent = "Hacer pedido";
  }
});

cargar();
