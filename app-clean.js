// ======================= CONFIG =======================
const CONFIG = {
  SHEETDB_ENDPOINT: "https://sheetdb.io/api/v1/jaa331n4u5icl",
  COMMISSION_USER: 0.10, // +10% al usuario
  COMMISSION_ARTIST: 0.05, // -5% al artista
  ADMIN_PASSWORD: "Admin2026",
  BANK: {
    bank: "Banco de Loja",
    account: "2901691001",
    holder: "Jordy Alejandro Torres Quezada",
    id: "1105200057"
  }
};

// ======================= GAS (EMAIL/DRIVE) =======================
const GAS_URL = "https://script.google.com/macros/s/AKfycbyjWTTEG60IzzJspv5_9F4_nfjt4BbDHHzdqNFwU_4TPpFhwMM__BFU35twPxJqwsYK/exec";

async function gas(action, payload = {}) {
  try {
    const r = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload })
    });
    return await r.json().catch(() => ({ ok: false }));
  } catch (e) {
    console.warn("GAS error:", e);
    return { ok: false, error: String(e) };
  }
}

// ======================= HELPERS =======================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = (p = "A") => p + Math.random().toString(36).slice(2, 8).toUpperCase();
const pin6 = () => "" + Math.floor(100000 + Math.random() * 900000);

async function sheetGet() {
  const r = await fetch(CONFIG.SHEETDB_ENDPOINT);
  return await r.json();
}
async function sheetPost(row) {
  const r = await fetch(CONFIG.SHEETDB_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [row] })
  });
  return await r.json();
}
async function sheetPatch(id, row) {
  const url = `${CONFIG.SHEETDB_ENDPOINT}/id/${encodeURIComponent(id)}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: row })
  });
  return await r.json();
}

// ======================= STATE =======================
let ARTISTAS = [];
let CONTRATOS = [];

// ======================= UI TABS =======================
$$("nav.tabs button").forEach(b => {
  b.addEventListener("click", () => {
    $$("nav.tabs button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    $$(".tab").forEach(t => t.classList.remove("active"));
    $("#tab-" + b.dataset.tab).classList.add("active");
  });
});

// Admin oculto
let clicks = 0;
$("header h1").addEventListener("click", () => {
  clicks++;
  if (clicks >= 3) openAdmin();
  setTimeout(() => (clicks = 0), 1200);
});
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") openAdmin();
});
$("#close-admin").onclick = () => $("#admin").classList.add("hidden");

// ======================= CARGA INICIAL =======================
init();
async function init() {
  await cargarArtistas();
  renderFiltros();
  renderCards();
  bindForms();
}

async function cargarArtistas() {
  try {
    ARTISTAS = await sheetGet();
  } catch (e) {
    console.error(e);
    ARTISTAS = [];
  }
}

function renderFiltros() {
  const ciudades = [...new Set(ARTISTAS.map(a => a.ciudad).filter(Boolean))].sort();
  const tipos = [...new Set(ARTISTAS.map(a => a.tipo_arte).filter(Boolean))].sort();
  const fc = $("#f-ciudad"),
    ft = $("#f-tipo");
  ciudades.forEach(c => fc.insertAdjacentHTML("beforeend", `<option>${c}</option>`));
  tipos.forEach(t => ft.insertAdjacentHTML("beforeend", `<option>${t}</option>`));
  ["q", "f-ciudad", "f-tipo"].forEach(id => $("#" + id).addEventListener("input", renderCards));
}

// ======================= RENDER CARDS =======================
function renderStarsDisplay(rating = 0) {
  const total = 5;
  let html = "";
  for (let i = 1; i <= total; i++) {
    html += i <= rating ? "⭐" : '<span style="color:#475569;">★</span>';
  }
  return html;
}

function renderCards() {
  const q = $("#q").value.toLowerCase();
  const fc = $("#f-ciudad").value;
  const ft = $("#f-tipo").value;
  const cont = $("#cards");
  cont.innerHTML = "";

  ARTISTAS.filter(a => {
    const texto = `${a.nombre_artistico} ${a.ciudad} ${a.tipo_arte}`.toLowerCase();
    const okQ = !q || texto.includes(q);
    const okC = !fc || a.ciudad === fc;
    const okT = !ft || (a.tipo_arte || "").includes(ft);
    return okQ && okC && okT && a.deleted !== "TRUE";
  }).forEach(a => {
    const vId = (a.video || "").includes("watch?v=")
      ? a.video.split("watch?v=")[1]
      : (a.video || "").split("/").pop();
    const iframe = vId
      ? `<iframe class="video" src="https://www.youtube.com/embed/${vId}" allowfullscreen></iframe>`
      : "";

    const rating = Number(a.rating || 0);
    const stars = renderStarsDisplay(rating);

    const precios = `
      <span class="badge">15m $${a.p15}</span>
      <span class="badge">30m $${a.p30}</span>
      <span class="badge">60m $${a.p60}</span>
      <span class="badge">120m $${a.p120}</span>
    `;

    // 🔹 Nueva lógica de imagen — Detecta ID de Google Drive y genera URL visible
    let fotoFinal = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
    if (a.foto) {
      if (a.foto.includes("drive.google.com")) {
        // Busca ID en el enlace
        const match = a.foto.match(/\/d\/([a-zA-Z0-9_-]+)/) || a.foto.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          fotoFinal = `https://drive.google.com/uc?export=view&id=${match[1]}`;
        }
      } else if (a.foto.startsWith("http")) {
        fotoFinal = a.foto;
      }
    }

    cont.insertAdjacentHTML(
      "beforeend",
      `
      <article class="card">
        <img 
          src="${fotoFinal}" 
          alt="${a.nombre_artistico || "Artista"}" 
          style="width:100%;height:180px;object-fit:cover;border-radius:12px;border:1px solid #1f2b46"
          onerror="this.src='https://cdn-icons-png.flaticon.com/512/847/847969.png'">
        <h3>${a.nombre_artistico || ""}</h3>
        <div class="small">
          ${(a.tipo_arte || "").split(",").map(s => s.trim()).filter(Boolean).join(" • ")} • ${a.ciudad || ""}
        </div>
        <div class="small">
          ${stars} <span style="margin-left:6px;color:#94a3b8;">(${a.votos || 0})</span>
        </div>
        <p>${a.bio || ""}</p>
        ${iframe}
        <div class="actions">${precios}</div>
        <div class="actions">
          <button data-id="${a.id}" class="btn-contratar primary">Contratar</button>
        </div>
      </article>`
    );
  });

  $$(".btn-contratar").forEach(b => (b.onclick = () => abrirSolicitud(b.dataset.id)));
}

// ======================= REGISTRO ARTISTA =======================
function bindForms() {
  $("#form-registro").addEventListener("submit", onRegistro);
  $("#form-login-artista").addEventListener("submit", onLoginArtista);
  $("#form-buscar-reserva").addEventListener("submit", onBuscarReserva);
}

async function onRegistro(e) {
  e.preventDefault();
  const f = e.target;
  const data = Object.fromEntries(new FormData(f));
  const id = uid("A");
  const pin = pin6();

  const row = {
    id,
    aprobado: "TRUE",
    rating: "0",
    votos: "0",
    foto: data.foto,
    video: data.video,
    nombre_artistico: data.nombre_artistico,
    nombre_real: data.nombre_real,
    cedula: data.cedula,
    ciudad: data.ciudad,
    correo: data.correo,
    celular: data.celular,
    tipo_arte: data.tipo_arte,
    p15: data.p15,
    p30: data.p30,
    p60: data.p60,
    p120: data.p120,
    bio: data.bio,
    pin,
    deleted: "FALSE"
  };

  try {
    await sheetPost(row);
    $("#msg-registro").textContent = "Registro exitoso. Revisa tu correo para tu PIN.";
    await gas("sendPin", { to: [data.correo], artista: data.nombre_artistico, pin });
    await cargarArtistas();
    renderCards();
    f.reset();
  } catch (err) {
    $("#msg-registro").textContent = "Ocurrió un error en el registro.";
  }
}

// ======================= CONTRATACIÓN =======================
function abrirSolicitud(artistaId) {
  const a = ARTISTAS.find(x => x.id === artistaId);
  if (!a) return;

  const html = `
  <div class="card" style="max-height:80vh;overflow-y:auto;">
    <h3>Contratar a ${a.nombre_artistico}</h3>
    <form id="form-solicitud">
      <label>Tu nombre<input name="usuario_nombre" required></label>
      <label>Tu correo<input type="email" name="usuario_correo" required></label>
      <label>Tu celular<input name="usuario_celular" required></label>
      <label>Ciudad del evento<input name="ciudad_evento" required></label>
      <label>Fecha del evento<input type="date" name="fecha_evento" required></label>
      <label>Duración<select name="duracion" id="duracion">
        <option>15</option><option>30</option><option>60</option><option>120</option>
      </select></label>
      <p id="precioTotal" style="color:#0ea5e9;font-weight:bold;"></p>
      <label>Mensaje<textarea name="mensaje" rows="2" placeholder="Detalles del evento..."></textarea></label>
      <div class="actions"><button class="primary" type="submit">Enviar solicitud</button></div>
      <p id="msg-solicitud" class="msg"></p>
    </form>
  </div>`;
  const sheet = $("#admin");
  $("#admin-content").innerHTML = html;
  sheet.classList.remove("hidden");

  const selectDur = $("#duracion");
  const precioEl = $("#precioTotal");
  selectDur.addEventListener("change", () => {
    const dur = selectDur.value;
    const base = a[`p${dur}`];
    const total = Number(base) + Number(base) * CONFIG.COMMISSION_USER;
    precioEl.textContent = `💰 Total a pagar: $${total.toFixed(2)}`;
  });

  $("#form-solicitud").onsubmit = async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const contrato = {
      id: uid("C"),
      artista_id: a.id,
      artista_nombre: a.nombre_artistico,
      artista_correo: a.correo,
      usuario_nombre: fd.usuario_nombre,
      usuario_correo: fd.usuario_correo,
      usuario_celular: fd.usuario_celular,
      ciudad: fd.ciudad_evento,
      fecha: fd.fecha_evento,
      duracion: fd.duracion,
      mensaje: fd.mensaje || "",
      estado: "por confirmar artista",
      comprobante_url: ""
    };
    CONTRATOS.push(contrato);
    $("#msg-solicitud").textContent = "✅ Solicitud enviada. Espere confirmación por correo.";
    await gas("notifyNewBooking", {
      to: [a.correo],
      artista: a.nombre_artistico,
      fecha: contrato.fecha,
      duracion: contrato.duracion,
      ciudad: contrato.ciudad,
      mensaje: contrato.mensaje
    });
  };
}
// ======================= LOGIN ARTISTA =======================
async function onLoginArtista(e) {
  e.preventDefault();
  const { cedula, pin } = Object.fromEntries(new FormData(e.target));
  const artista = ARTISTAS.find(a => a.cedula === cedula && a.pin === pin);
  if (!artista) {
    $("#msg-login").textContent = "Datos incorrectos";
    return;
  }
  $("#msg-login").textContent = "Ingreso exitoso.";
  $("#panel-artista").classList.remove("hidden");
  renderSolicitudesArtista(artista);
}

function renderSolicitudesArtista(artista) {
  const cont = $("#solicitudes-artista");
  cont.innerHTML = "";
  const list = CONTRATOS.filter(c => c.artista_id === artista.id && c.estado === "por confirmar artista");

  if (!list.length) {
    cont.innerHTML = `<div class="card">No tienes solicitudes pendientes.</div>`;
    return;
  }

  list.forEach(c => {
    const neto = (a => {
      const base = a[`p${c.duracion}`];
      return (base * (1 - CONFIG.COMMISSION_ARTIST)).toFixed(2);
    })(artista);

    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <div><b>${c.usuario_nombre}</b> solicita show de ${c.duracion} min el <b>${c.fecha}</b> en ${c.ciudad}</div>
      <div class="small">Mensaje: ${c.mensaje || "-"}</div>
      <p style="color:#16a34a;">💵 Pago neto para ti: $${neto}</p>
      <div class="actions">
        <button data-id="${c.id}" class="btn-aceptar primary">Aceptar</button>
        <button data-id="${c.id}" class="btn-rechazar">Rechazar</button>
      </div>`;
    cont.appendChild(el);
  });

  $$(".btn-aceptar", cont).forEach(b => (b.onclick = () => aceptarContrato(b.dataset.id, artista)));
  $$(".btn-rechazar", cont).forEach(b => (b.onclick = () => rechazarContrato(b.dataset.id, artista)));
}

async function aceptarContrato(cid, artista) {
  const c = CONTRATOS.find(x => x.id === cid);
  if (!c) return;
  c.estado = "por validar pago";
  await gas("notifyUserPayment", {
    to: [c.usuario_correo],
    usuario: c.usuario_nombre,
    artista: artista.nombre_artistico,
    banco: CONFIG.BANK.bank,
    cuenta: CONFIG.BANK.account,
    titular: CONFIG.BANK.holder,
    cedula: CONFIG.BANK.id
  });
  await gas("notifyAdminPayment", {
    to: ["jordyalejandrot1994@gmail.com"],
    usuario: c.usuario_nombre,
    artista: artista.nombre_artistico
  });
  alert("Solicitud aceptada. El usuario fue notificado para realizar el pago.");
  renderSolicitudesArtista(artista);
}

function rechazarContrato(cid, artista) {
  const i = CONTRATOS.findIndex(x => x.id === cid);
  if (i > -1) CONTRATOS.splice(i, 1);
  renderSolicitudesArtista(artista);
}

// ======================= MIS RESERVAS (USUARIO) =======================
async function onBuscarReserva(e) {
  e.preventDefault();
  const correo = new FormData(e.target).get("correo");
  const list = CONTRATOS.filter(c => c.usuario_correo === correo);
  const cont = $("#reservas-usuario");
  cont.innerHTML = "";

  if (!list.length) {
    cont.innerHTML = '<div class="card">No se encontraron reservas.</div>';
    return;
  }

  list.forEach(c => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <div><b>${c.artista_nombre}</b> • ${c.fecha} • ${c.ciudad} • ${c.duracion} min</div>
      <div class="small">Estado: ${c.estado}</div>
      ${
        c.estado === "por validar pago"
          ? `
        <label>Subir comprobante de pago
          <input type="file" accept="image/*" data-id="${c.id}" class="comprobanteFile">
        </label>
        <div class="actions"><button class="primary" data-id="${c.id}">Enviar comprobante</button></div>
      `
          : ""
      }
      ${c.estado === "confirmado" ? `
        <div class="actions">
          <p>⭐ Califica tu experiencia:</p>
          <div class="rating" data-id="${c.id}">
            ${[1,2,3,4,5].map(i=>`<span data-star="${i}">★</span>`).join("")}
          </div>
          <textarea class="resena" placeholder="Escribe una reseña..." rows="2"></textarea>
          <button class="primary" data-calificar="${c.id}">Enviar calificación</button>
        </div>` : ""}
    `;
    cont.appendChild(el);
  });

  // Eventos comprobante
  $$("#reservas-usuario button.primary").forEach(b => {
    const cid = b.dataset.id;
    if (cid) b.onclick = () => enviarComprobante(cid);
  });

  // Eventos calificación
  $$("#reservas-usuario button[data-calificar]").forEach(b => {
    const cid = b.dataset.calificar;
    b.onclick = () => enviarCalificacion(cid);
  });

  // Efecto visual estrellas
  $$(".rating span").forEach(star => {
    star.addEventListener("click", e => {
      const parent = e.target.parentElement;
      const val = Number(e.target.dataset.star);
      parent.dataset.value = val;
      parent.querySelectorAll("span").forEach(s => {
        s.style.color = s.dataset.star <= val ? "#facc15" : "#475569";
      });
    });
  });
}

async function enviarComprobante(cid) {
  const input = $(`input.comprobanteFile[data-id="${cid}"]`);
  const file = input?.files?.[0];
  if (!file) return alert("Selecciona una imagen antes de enviar.");

  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(",")[1];
    const mimeType = file.type;
    const resp = await gas("uploadImage", {
      folder: "Comprobantes",
      fileName: file.name,
      base64,
      mimeType
    });
    if (!resp.ok) return alert("Error al subir comprobante.");

    const c = CONTRATOS.find(x => x.id === cid);
    c.comprobante_url = resp.url;
    alert("Comprobante enviado. El administrador validará tu pago.");
  };
  reader.readAsDataURL(file);
}

// ======================= CALIFICACIÓN =======================
async function enviarCalificacion(cid) {
  const c = CONTRATOS.find(x => x.id === cid);
  if (!c) return;
  const parent = $(`.rating[data-id="${cid}"]`);
  const val = Number(parent?.dataset.value || 0);
  const texto = $(`.resena`).value || "";
  if (val < 1) return alert("Selecciona una calificación de 1 a 5 estrellas.");

  const artista = ARTISTAS.find(a => a.id === c.artista_id);
  const votos = Number(artista.votos || 0);
  const rating = Number(artista.rating || 0);
  const nuevoPromedio = ((rating * votos + val) / (votos + 1)).toFixed(1);

  artista.rating = nuevoPromedio;
  artista.votos = votos + 1;
  await sheetPatch(artista.id, { rating: nuevoPromedio, votos: artista.votos });
  alert("Gracias por calificar. Tu reseña ha sido enviada.");
}

// ======================= ADMIN =======================
async function openAdmin() {
  const pass = prompt("Clave de administrador:");
  if (pass !== CONFIG.ADMIN_PASSWORD) return alert("Clave incorrecta");
  $("#admin").classList.remove("hidden");
  renderAdmin();
}

function renderAdmin() {
  const cont = $("#admin-content");
  const pend = CONTRATOS.filter(c => c.estado === "por validar pago");
  cont.innerHTML = "<h4>Pendientes de validar pago</h4>";

  if (!pend.length) {
    cont.innerHTML += "<div class='card'>No hay pagos pendientes.</div>";
    return;
  }

  pend.forEach(c => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <div><b>${c.artista_nombre}</b> ←→ <b>${c.usuario_nombre}</b></div>
      <div class="small">Fecha: ${c.fecha} • Ciudad: ${c.ciudad} • Duración: ${c.duracion} min</div>
      <div>Comprobante: ${
        c.comprobante_url ? `<a href="${c.comprobante_url}" target="_blank">Ver</a>` : "—"
      }</div>
      <div class="actions">
        <button class="primary" data-id="${c.id}">Marcar como pagado</button>
      </div>`;
    cont.appendChild(el);
  });

  $$("#admin-content button.primary").forEach(b => (b.onclick = () => confirmarContrato(b.dataset.id)));
}

async function confirmarContrato(cid) {
  const c = CONTRATOS.find(x => x.id === cid);
  if (!c) return;
  c.estado = "confirmado";
  const artista = ARTISTAS.find(a => a.id === c.artista_id);

  await gas("notifyConfirmed", {
    toUser: [c.usuario_correo],
    toArtist: [artista.correo],
    artista_nombre: artista.nombre_artistico,
    artista_correo: artista.correo,
    artista_celular: artista.celular,
    usuario_nombre: c.usuario_nombre,
    usuario_correo: c.usuario_correo,
    usuario_celular: c.usuario_celular
  });

  alert("Contrato confirmado y contactos liberados.");
  renderAdmin();
}

