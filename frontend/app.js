// config.js lo genera el pipeline con la URL de la API desplegada
const API = (window.API_URL || "").replace(/\/$/, "");
let productos = [];
const cantidades = {}; // product_id -> cantidad elegida

const catalogo = document.getElementById("catalogo");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const precio = n => "$" + Number(n).toLocaleString("es-CO");

// Nombres de la carta (solo en pantalla). La API sigue usando product_id y name.
const CARTA = {
  p1: { orden: 1, num: "I", etiqueta: "Capítulo I", titulo: "El Despertar",
        frase: "Hojaldre dorado que cruje como la primera página de la mañana." },
  p2: { orden: 2, num: "II", etiqueta: "Capítulo II", titulo: "La Posada del Viajero",
        frase: "Redondo, tibio y con queso: el refugio de quien llega de lejos." },
  p3: { orden: 3, num: "III", etiqueta: "Capítulo III", titulo: "El Pan del Cartógrafo",
        frase: "Corteza firme para trazar el camino del día." },
  p4: { orden: 4, num: "Ep.", etiqueta: "Epílogo", titulo: "El Gran Final",
        frase: "Chocolate profundo para cerrar la historia como se merece." }
};

// Datos de pantalla de un producto; si no tiene mapeo, se usa su nombre normal
function ficha(p) {
  const c = CARTA[p.product_id];
  return c
    ? { ...c, completo: `${c.etiqueta} · ${c.titulo}`, real: p.name }
    : { orden: 100, num: "", etiqueta: "", titulo: p.name, frase: "", completo: p.name, real: "" };
}

function ordenCarta(a, b) {
  return ficha(a).orden - ficha(b).orden || String(a.name).localeCompare(b.name, "es");
}

function tarjeta(p) {
  const id = esc(p.product_id);
  const f = ficha(p);
  const foto = p.image_url
    ? `<img class="cap-img" src="${esc(p.image_url)}" alt="" loading="lazy" onerror="this.remove()">`
    : "";
  return `
    <li class="capitulo" data-card="${id}">
      <span class="cap-num" aria-hidden="true">${esc(f.num) || "❧"}</span>
      <div class="cap-texto">
        ${f.etiqueta ? `<span class="etiqueta">${esc(f.etiqueta)}</span>` : ""}
        <h3 class="cap-linea">
          <span class="cap-titulo">${esc(f.titulo)}</span>
          <span class="relleno" aria-hidden="true"></span>
          <span class="cap-precio">${precio(p.price)}</span>
        </h3>
        ${f.real ? `<p class="cap-real">${esc(f.real)}${f.frase ? ` · <em>${esc(f.frase)}</em>` : ""}</p>` : ""}
      </div>
      ${foto}
      <div class="stepper" role="group" aria-label="Cantidad de ${esc(f.completo)}">
        <button type="button" data-accion="menos" data-id="${id}" aria-label="Quitar uno de ${esc(f.titulo)}">−</button>
        <output data-cant="${id}">0</output>
        <button type="button" data-accion="mas" data-id="${id}" aria-label="Agregar uno de ${esc(f.titulo)}">+</button>
      </div>
    </li>`;
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
    productos = (await r.json()).sort(ordenCarta);
    catalogo.innerHTML = productos.length
      ? `<ol class="indice">${productos.map(tarjeta).join("")}</ol>`
      : `<p class="vacio">Por ahora no hay productos disponibles.</p>`;
  } catch (e) {
    catalogo.innerHTML = `
      <div class="vacio">
        <p>No se pudo cargar el catálogo. Revisa tu conexión e intenta de nuevo.</p>
        <button type="button" class="boton boton-sec" id="reintentar">Reintentar</button>
      </div>`;
    document.getElementById("reintentar").onclick = () => location.reload();
  } finally {
    catalogo.removeAttribute("aria-busy");
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
  resumen.innerHTML = lista.map(p => {
    const f = ficha(p);
    const id = esc(p.product_id);
    return `
    <li>
      <span class="resumen-cant">${p.qty}×</span>
      <span class="resumen-nombre">${esc(f.titulo)}${f.etiqueta ? `<small>${esc(f.etiqueta)}</small>` : ""}</span>
      <span class="resumen-sub">${precio(p.qty * Number(p.price))}</span>
      <button type="button" class="quitar" data-quitar="${id}" aria-label="Quitar ${esc(f.titulo)} del pedido" title="Quitar">×</button>
    </li>`;
  }).join("");
  resumenVacio.hidden = lista.length > 0;
  const total = lista.reduce((s, p) => s + p.qty * Number(p.price), 0);
  totalEl.textContent = precio(total);

  // Barra inferior en movil
  const unidades = lista.reduce((s, p) => s + p.qty, 0);
  document.getElementById("barra-movil").hidden = unidades === 0;
  document.getElementById("barra-cant").textContent = unidades + (unidades === 1 ? " pieza" : " piezas");
  document.getElementById("barra-total").textContent = precio(total);
}

resumen.addEventListener("click", e => {
  const b = e.target.closest("button[data-quitar]");
  if (b) cambiarCantidad(b.dataset.quitar, -(cantidades[b.dataset.quitar] || 0));
});

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

// Horario de recogida: de 06:00 a 20:00
const HORA_MIN = "06:00";
const HORA_MAX = "20:00";

function errorNombre() {
  return nombre.value.trim() ? "" : "Toda historia necesita un protagonista: escribe tu nombre.";
}

function errorHora() {
  if (!hora.value) return "¿A qué hora pasas? Elige una hora de recogida.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora.value)) return "Escribe la hora en formato HH:MM.";
  if (hora.value < HORA_MIN || hora.value > HORA_MAX) {
    return "A esa hora el horno duerme. Elige una hora entre las 6:00 a. m. y las 8:00 p. m.";
  }
  return "";
}

function validar() {
  const en = errorNombre();
  const eh = errorHora();
  marcarError(nombre, en);
  marcarError(hora, eh);
  if (en) nombre.focus();
  else if (eh) hora.focus();
  if (!elegidos().length) {
    mostrarMsg("error", "Tu pedido está vacío: agrega al menos un capítulo de la carta.");
    return false;
  }
  return !en && !eh;
}

// Recordar el nombre del cliente en este navegador
const CLAVE_NOMBRE = "uc_nombre";
function recordarNombre(valor) {
  try { localStorage.setItem(CLAVE_NOMBRE, valor); } catch (e) { /* modo privado */ }
}
function nombreRecordado() {
  try { return localStorage.getItem(CLAVE_NOMBRE) || ""; } catch (e) { return ""; }
}
nombre.value = nombreRecordado();

function mostrarMsg(tipo, html) {
  msg.className = "msg msg-" + tipo;
  msg.innerHTML = html;
}

// Al corregir, el error desaparece; al salir del campo, se revisa de nuevo
nombre.addEventListener("input", () => { if (!errorNombre()) marcarError(nombre, ""); });
hora.addEventListener("input", () => { if (!errorHora()) marcarError(hora, ""); });
nombre.addEventListener("blur", () => nombre.value && marcarError(nombre, errorNombre()));
hora.addEventListener("blur", () => hora.value && marcarError(hora, errorHora()));

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
    recordarNombre(body.customer_name);
    // Reiniciar el pedido (el nombre se conserva)
    Object.keys(cantidades).forEach(id => cantidades[id] > 0 && cambiarCantidad(id, -cantidades[id]));
    hora.value = "";
  } catch (err) {
    mostrarMsg("error", "No pudimos registrar tu pedido: " + esc(err.message));
  } finally {
    boton.disabled = false;
    boton.textContent = "Hacer pedido";
  }
});

cargar();
