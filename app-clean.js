// ===============================
// BANCO DE ARTISTAS - APP CLIENTE
// Compatible con nuevo index + panel admin
// ===============================

const CONFIG = {
  SHEETDB_ENDPOINT: "https://sheetdb.io/api/v1/jaa331n4u5icl",
  COMMISSION_USER: 0.10,
  COMMISSION_ARTIST: 0.05,
};

// ---- GAS (email/drive) opcional (se usa si subes archivo)
const GAS_URL = "https://script.google.com/macros/s/AKfycbyZ27mjG6lnRdvV_MsaOOrr8lD7cN1KDUSaigYeiqVOu8cX_Yw8-xu7QORMhfwyJPvS/exec";

// Proxy Drive (si usas enlaces de Drive)
const DRIVE_PROXY_URL = "https://script.google.com/macros/s/AKfycbxyPirSpnyUykA2hlx5zoU0KtRftjU9AnYltF3r3idQLxlirNHUF2WOFuRzEuJPx1XM/exec";

// ======================= HELPERS =======================
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid  = (p = "A") => p + Math.random().toString(36).slice(2, 8).toUpperCase();
const pin6 = () => ("" + Math.floor(100000 + Math.random() * 900000));

async function gas(action, payload = {}) {
  try {
    const r = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload })
    });
    return await r.json().catch(() => ({}));
  } catch (e) {
    console.warn("GAS error:", e);
    return { ok: false, error: String(e) };
  }
}

async function sheetGet() {
  const r = await fetch(CONFIG.SHEETDB_ENDPOINT);
  const j = await r.json();
  // SheetDB retorna { data: [...] }
  return Array.isArray(j?.data) ? j.data : [];
}
async function sheetPost(row) {
  const r = await fetch(CONFIG.SHEETDB_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [row] })
  });
  return await r.json();
}

function getDriveIdFromUrl(url) {
  if (!url) return "";
  try {
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]{25,})/,
      /id=([a-zA-Z0-9_-]{25,})/,
      /\/uc\?export=view&id=([a-zA-Z0-9_-]{25,})/,
      /\/open\?id=([a-zA-Z0-9_-]{25,})/,
      /d\/([a-zA-Z0-9_-]{25,})/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
  } catch(_) {}
  return "";
}
function getDriveProxyUrl(anyDriveUrlOrId) {
  const id = getDriveIdFromUrl(anyDriveUrlOrId || "");
  return id ? `${DRIVE_PROXY_URL}?id=${id}` : anyDriveUrlOrId;
}

function getYouTubeId(url = "") {
  if (!url) return "";
  try {
    if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split(/[?&]/)[0];
    if (url.includes("watch?v=")) return url.split("watch?v=")[1].split("&")[0];
    if (url.includes("/embed/")) return url.split("/embed/")[1].split(/[?&]/)[0];
  } catch(_) {}
  return url.split("/").pop().split(/[?&]/)[0];
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
  });
}

// ======================= STATE =======================
let ARTISTAS = [];

// ======================= TABS =======================
(function setupTabs(){
  $$("nav.tabs button").forEach(b => {
    b.addEventListener("click", () => {
      $$("nav.tabs button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      $$(".tab").forEach(t => t.classList.remove("active"));
      const target = $("#tab-" + b.dataset.tab);
      if (target) target.classList.add("active");
    });
  });
})();

// ======================= INICIO =======================
document.addEventListener("DOMContentLoaded", init);

async function init() {
  await cargarArtistas();
  renderFiltros();
  renderCards();
  bindForms();
}

// ======================= CARGA ARTISTAS =======================
async function cargarArtistas() {
  try {
    const rows = await sheetGet();

    // Normalizamos estado/aprobación
    ARTISTAS = rows.map(a => {
      const estadoNorm = (a.estado || "").toString().trim().toLowerCase();
      const aprobadoFlag = (a.aprobado || "").toString().trim().toUpperCase() === "TRUE";
      const show = estadoNorm ? (estadoNorm === "aprobado") : aprobadoFlag; // soporta ambas
      return { ...a, __showApproved: show };
    });

  } catch (e) {
    console.error(e);
    ARTISTAS = [];
  }
}

// ======================= FILTROS =======================
function renderFiltros() {
  const ciudades = [...new Set(ARTISTAS.map(a => a.ciudad).filter(Boolean))].sort();
  const tipos    = [...new Set(ARTISTAS.map(a => a.tipo_arte).filter(Boolean))].sort();
  const fc = $("#f-ciudad"), ft = $("#f-tipo");
  if (fc) ciudades.forEach(c => fc.insertAdjacentHTML("beforeend", `<option>${c}</option>`));
  if (ft) tipos.forEach(t => ft.insertAdjacentHTML("beforeend", `<option>${t}</option>`));
  ["q", "f-ciudad", "f-tipo"].forEach(id => {
    const el = $("#" + id);
    if (el) el.addEventListener("input", renderCards);
  });
}

// ======================= UTILS UI =======================
function renderStarsDisplay(rating = 0) {
  const total = 5;
  let html = "";
  for (let i = 1; i <= total; i++) html += i <= rating ? "⭐" : '<span style="color:#475569;">★</span>';
  return html;
}

// ======================= TARJETAS DE ARTISTAS =======================
function renderCards() {
  const q  = ($("#q")?.value || "").toLowerCase();
  const fc = $("#f-ciudad")?.value || "";
  const ft = $("#f-tipo")?.value || "";
  const cont = $("#cards");
  if (!cont) return;
  cont.innerHTML = "";

  const filtrados = ARTISTAS
    .filter(a => a.__showApproved && (a.deleted !== "TRUE"))
    .filter(a => {
      const texto = `${a.nombre_artistico||""} ${a.ciudad||""} ${a.tipo_arte||""}`.toLowerCase();
      const okQ = !q  || texto.includes(q);
      const okC = !fc || a.ciudad === fc;
      const okT = !ft || (a.tipo_arte || "").includes(ft);
      return okQ && okC && okT;
    });

  if (filtrados.length === 0) {
    cont.innerHTML = "<p style='text-align:center;'>No hay artistas aprobados todavía.</p>";
    return;
  }

  filtrados.forEach(a => {
    const vId = getYouTubeId(a.video || "");
    const iframe = vId ? `<iframe class="video" src="https://www.youtube.com/embed/${vId}" allowfullscreen></iframe>` : "";
    const rating = Number(a.rating || 0);
    const stars  = renderStarsDisplay(rating);

    // Imagen segura (Drive proxy / URL directa / placeholder)
    let fotoFinal = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
    const posibleFoto =
      a.foto || a.Foto || a["Foto del artista"] || a["foto_artista"] || a["foto_artista_url"] || "";

    if (posibleFoto) {
      if (posibleFoto.includes("drive.google.com")) {
        fotoFinal = getDriveProxyUrl(posibleFoto);
      } else if (/^https?:\/\//i.test(posibleFoto)) {
        fotoFinal = posibleFoto;
      }
    }

    const precios = `
      <span class="badge">15m $${a.p15 || "-"}</span>
      <span class="badge">30m $${a.p30 || "-"}</span>
      <span class="badge">60m $${a.p60 || "-"}</span>
      <span class="badge">120m $${a.p120 || "-"}</span>
    `;

    cont.insertAdjacentHTML(
      "beforeend",
      `
      <article class="card">
        <img
          src="${fotoFinal}"
          alt="${a.nombre_artistico || "Artista"}"
          onerror="this.src='https://cdn-icons-png.flaticon.com/512/847/847969.png';"
        />
        <h3>${a.nombre_artistico || ""}</h3>
        <div class="small">${(a.tipo_arte || "").split(",").map(s => s.trim()).filter(Boolean).join(" • ")} • ${a.ciudad || ""}</div>
        <div class="small">${stars} <span style="margin-left:6px;color:#94a3b8;">(${a.votos || 0})</span></div>
        <p>${a.bio || ""}</p>
        ${iframe}
        <div class="actions">${precios}</div>
        <div class="actions"><button data-id="${a.id}" class="btn-contratar primary">Contratar</button></div>
      </article>
      `
    );
  });

  $$(".btn-contratar").forEach(b => b.addEventListener("click", () => abrirSolicitud(b.dataset.id)));
}

// ======================= FORMULARIOS =======================
function bindForms() {
  const fReg = $("#form-registro");
  const fLog = $("#form-login-artista");
  const fRes = $("#form-buscar-reserva");

  if (fReg) fReg.addEventListener("submit", onRegistro);
  if (fLog) fLog.addEventListener("submit", onLoginArtista);
  if (fRes) fRes.addEventListener("submit", onBuscarReserva);
}

// REGISTRO: soporta foto por URL (Postimages) o archivo (Drive)
async function onRegistro(e) {
  e.preventDefault();
  const f = e.target;
  const data = Object.fromEntries(new FormData(f));

  let fotoURL = (data.foto || "").trim(); // campo URL (Postimages)
  const file = f.querySelector('input[name="fotoFile"]')?.files?.[0];

  // Si hay archivo, subimos a Drive mediante GAS
  if (!fotoURL && file) {
    try {
      const base64 = await toBase64(file);
      const res = await gas("uploadImage", {
        folder: "FotosArtistas",
        fileName: file.name,
        mimeType: file.type,
        base64
      });
      if (res.ok && res.id) {
        fotoURL = `https://drive.google.com/uc?export=view&id=${res.id}`;
      } else if (res.url) {
        fotoURL = res.url;
      }
    } catch(err) {
      console.warn("Falló subida a Drive:", err);
    }
  }

  const id = uid("A");
  const pin = pin6();
  const row = {
    id,
    // nuevo flujo: panel aprueba → por defecto queda pendiente
    estado: "pendiente",
    aprobado: "FALSE",
    rating: "0",
    votos: "0",
    foto: fotoURL || "",
    video: data.video || "",
    nombre_artistico: data.nombre_artistico || "",
    nombre_real: data.nombre_real || "",
    cedula: data.cedula || "",
    ciudad: data.ciudad || "",
    correo: data.correo || "",
    celular: data.celular || "",
    tipo_arte: data.tipo_arte || "",
    p15: data.p15 || "",
    p30: data.p30 || "",
    p60: data.p60 || "",
    p120: data.p120 || "",
    bio: data.bio || "",
    pin,
    deleted: "FALSE",
    creado_en: new Date().toISOString()
  };

  try {
    await sheetPost(row);
    $("#msg-registro").textContent = "✅ Registro enviado. Queda en revisión del administrador.";
    // correo con PIN (si quieres mantener)
    await gas("sendPin", { to: [data.correo], artista: data.nombre_artistico, pin });
    await cargarArtistas();
    renderCards();
    f.reset();
    const preview = $("#preview-foto");
    if (preview) preview.classList.add("hidden");
  } catch (err) {
    console.error(err);
    $("#msg-registro").textContent = "❌ Error registrando al artista.";
  }
}

// LOGIN ARTISTA (placeholder si aún no lo usas)
async function onLoginArtista(e) {
  e.preventDefault();
  const f = e.target;
  const cedula = f.cedula.value.trim();
  const pin = f.pin.value.trim();
  const data = await sheetGet();
  const a = data.find(x => (x.cedula || "") === cedula && (x.pin || "") === pin);
  $("#msg-login").textContent = a ? "✅ Ingresaste." : "❌ Cédula o PIN incorrectos.";
  // Aquí podrías cargar el panel del artista si ya lo tienes implementado
}

// BUSCAR RESERVA (placeholder – dependerá de tu hoja de reservas si la tienes)
async function onBuscarReserva(e) {
  e.preventDefault();
  const correo = e.target.correo.value.trim().toLowerCase();
  $("#reservas-usuario").innerHTML = `<p style="text-align:center;">Buscando reservas para <b>${correo}</b>...</p>`;
  // Si tienes hoja de reservas separada, aquí harías fetch a esa base y render.
  setTimeout(() => {
    $("#reservas-usuario").innerHTML = `<p style="text-align:center;">(Demo) Aún no hay reservas asociadas a <b>${correo}</b>.</p>`;
  }, 600);
}

// ======================= SOLICITUD DE CONTRATACIÓN =======================
// (modal propio, NO usa #admin-content)
function abrirSolicitud(artistaId) {
  const a = ARTISTAS.find(x => x.id === artistaId);
  if (!a) return;

  // Crear overlay
  let modal = $("#ba-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "ba-modal";
    Object.assign(modal.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: "1000"
    });
    document.body.appendChild(modal);
  }

  const precioCalc = (dur) => {
    const base = parseFloat(a[`p${dur}`] || "0") || 0;
    const total = base * (1 + CONFIG.COMMISSION_USER);
    return { base, total: total.toFixed(2) };
  };
  const p30 = precioCalc(30);

  modal.innerHTML = `
    <div style="background:#0f172a; color:#e2e8f0; border-radius:14px; width:min(92%,620px); padding:16px; box-shadow:0 0 18px rgba(14,165,233,0.35);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="margin:0; color:#0ea5e9;">Solicitar a ${a.nombre_artistico}</h3>
        <button id="ba-close" style="background:#111827;border:1px solid #1f2b46;color:#e2e8f0;border-radius:8px;padding:6px 10px;cursor:pointer;">Cerrar</button>
      </div>
      <form id="form-solicitud">
        <label>Tu nombre<input name="usuario_nombre" required></label>
        <label>Tu correo<input type="email" name="usuario_correo" required></label>
        <label>Tu celular<input name="usuario_celular" required></label>
        <label>Ciudad del evento<input name="ciudad_evento" required></label>
        <label>Fecha del evento<input type="date" name="fecha_evento" required></label>
        <label>Duración<select name="duracion" id="duracion">
          <option value="15">15 minutos</option>
          <option value="30" selected>30 minutos</option>
          <option value="60">60 minutos</option>
          <option value="120">120 minutos</option>
        </select></label>
        <p id="precioTotal" style="margin:6px 0;font-weight:600;color:#0ea5e9;">
          Valor total a pagar: <b>$${p30.total}</b>
        </p>
        <label>Mensaje<textarea name="mensaje" rows="2" placeholder="Detalles del evento..."></textarea></label>
        <div class="actions"><button class="primary" type="submit">Enviar solicitud</button></div>
        <p id="msg-solicitud" class="msg"></p>
      </form>
    </div>
  `;

  $("#ba-close").onclick = () => modal.remove();

  $("#duracion").addEventListener("change", (e) => {
    const dur = e.target.value;
    const p = precioCalc(dur);
    $("#precioTotal").innerHTML = `Valor total a pagar: <b>$${p.total}</b>`;
  });

  $("#form-solicitud").onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const dur = fd.duracion;
    const p = precioCalc(dur);

    // Aquí puedes guardar la “reserva” en otra hoja o enviar correos
    try {
      await gas("notifyNewBooking", {
        to: [a.correo],
        artista: a.nombre_artistico,
        fecha: fd.fecha_evento,
        duracion: dur,
        ciudad: fd.ciudad_evento,
        mensaje: fd.mensaje || ""
      });
      $("#msg-solicitud").textContent = "✅ Solicitud enviada. Te contactaremos para confirmar.";
      setTimeout(() => modal.remove(), 1200);
    } catch(err) {
      console.error(err);
      $("#msg-solicitud").textContent = "❌ No se pudo enviar la solicitud.";
    }
  };
}
