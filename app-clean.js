/* =========================================================
   BANCO DE ARTISTAS - APP PRINCIPAL (CLIENTE + ADMIN)
   - Compatible con tu index.html actual (Postimages en el HTML)
   - Panel Admin avanzado (4 toques o Ctrl + Alt + A)
   - Explorar muestra SOLO aprobados (estado='aprobado' o aprobado='TRUE')
   - Reserva abre modal propio (sin tocar #admin)
========================================================= */

/* ======================= CONFIG ======================= */
const CONFIG = {
  SHEETDB_ENDPOINT: "https://sheetdb.io/api/v1/jaa331n4u5icl",
  COMMISSION_USER: 0.10,  // +10% al usuario
  COMMISSION_ARTIST: 0.05, // -5% al artista
  ADMIN_PASSWORD: "Admin2026",
  BANK: {
    bank: "Banco de Loja",
    account: "2901691001",
    holder: "Jordy Alejandro Torres Quezada",
    id: "1105200057"
  }
};

/* ======================= (Opcional) GAS ======================= */
/* Dejamos hooks por si en el futuro deseas Drive o emails; no se usan
   en el registro porque tu index tiene su propio flujo de Postimages. */
const GAS_URL = "https://script.google.com/macros/s/AKfycbyZ27mjG6lnRdvV_MsaOOrr8lD7cN1KDUSaigYeiqVOu8cX_Yw8-xu7QORMhfwyJPvS/exec";
const DRIVE_PROXY_URL = "https://script.google.com/macros/s/AKfycbxyPirSpnyUykA2hlx5zoU0KtRftjU9AnYltF3r3idQLxlirNHUF2WOFuRzEuJPx1XM/exec";

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

/* ======================= HELPERS ======================= */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const uid  = (p = "A") => p + Math.random().toString(36).slice(2, 8).toUpperCase();
const pin6 = () => ("" + Math.floor(100000 + Math.random() * 900000));

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

function getYouTubeId(url = "") {
  if (!url) return "";
  try {
    if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split(/[?&]/)[0];
    if (url.includes("watch?v=")) return url.split("watch?v=")[1].split("&")[0];
    if (url.includes("/embed/")) return url.split("/embed/")[1].split(/[?&]/)[0];
  } catch (_) {}
  return url.split("/").pop().split(/[?&]/)[0];
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
  } catch (_) {}
  return "";
}
function getDriveProxyUrl(anyDriveUrlOrId) {
  const id = getDriveIdFromUrl(anyDriveUrlOrId || "");
  return id ? `${DRIVE_PROXY_URL}?id=${id}` : anyDriveUrlOrId;
}

function esc(s){return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");}

/* ======================= STATE ======================= */
let ARTISTAS = []; // registros crudos
let ARTISTAS_PUBLICOS = []; // normalizados (solo aprobados)
let _adminTapCount = 0;
let _adminLastTap = 0;

/* ======================= TABS ======================= */
function setupTabs(){
  $$("nav.tabs button").forEach(b => {
    b.addEventListener("click", () => {
      $$("nav.tabs button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      $$(".tab").forEach(t => t.classList.remove("active"));
      const target = $("#tab-" + b.dataset.tab);
      if (target) target.classList.add("active");
    });
  });
}

/* ======================= SECRET ADMIN ACCESS ======================= */
/* - 4 toques rápidos en el header h1 (móvil)
   - Ctrl + Alt + A (desktop) */
function setupSecretAdminAccess(){
  const h1 = $("header h1");
  if (!h1) return;

  h1.addEventListener("click", ()=> {
    const now = Date.now();
    if (now - _adminLastTap < 700) _adminTapCount++; else _adminTapCount = 1;
    _adminLastTap = now;
    if (_adminTapCount >= 4) {
      _adminTapCount = 0;
      openAdmin();
    }
  });

  document.addEventListener("keydown", (e)=>{
    if (e.ctrlKey && e.altKey && (e.key === "a" || e.key === "A")) {
      openAdmin();
    }
  });

  $("#close-admin")?.addEventListener("click", () => {
    $("#admin")?.classList.add("hidden");
    const c = $("#admin-content");
    if (c) c.innerHTML = "";
  });
}

/* ======================= CARGA Y NORMALIZACIÓN ======================= */
async function cargarArtistas() {
  try {
    const j = await fetchJson(CONFIG.SHEETDB_ENDPOINT);
    const rows = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
    ARTISTAS = rows;

    // Solo aprobados para público: admite estado/aprobado
    ARTISTAS_PUBLICOS = ARTISTAS.map(a => {
      const estado = (a.estado || "").toString().trim().toLowerCase();
      const aprobadoFlag = (a.aprobado || "").toString().trim().toUpperCase() === "TRUE";
      const isApproved = estado ? (estado === "aprobado") : aprobadoFlag;
      const foto = (() => {
        const posible = a.foto || a.Foto || a["Foto del artista"] || a["foto_artista"] || a["foto_artista_url"] || "";
        if (!posible) return "";
        if (posible.includes("drive.google.com")) return getDriveProxyUrl(posible);
        if (/^https?:\/\//i.test(posible)) return posible;
        return "";
      })();
      return { ...a, __approved: isApproved, __foto: foto };
    }).filter(a => a.__approved && a.deleted !== "TRUE");

  } catch (err) {
    console.error("Error cargando artistas:", err);
    ARTISTAS = [];
    ARTISTAS_PUBLICOS = [];
  }
}

/* ======================= FILTROS UI ======================= */
function renderFiltros() {
  const fc = $("#f-ciudad"), ft = $("#f-tipo");
  if (!fc || !ft) return;

  const ciudades = [...new Set(ARTISTAS.map(a => a.ciudad).filter(Boolean))].sort();
  const tipos    = [...new Set(ARTISTAS.map(a => a.tipo_arte).filter(Boolean))].sort();

  fc.innerHTML = '<option value="">Todas las ciudades</option>';
  ft.innerHTML = '<option value="">Todos los tipos</option>';
  ciudades.forEach(c => fc.insertAdjacentHTML("beforeend", `<option>${esc(c)}</option>`));
  tipos.forEach(t => ft.insertAdjacentHTML("beforeend", `<option>${esc(t)}</option>`));

  ["q", "f-ciudad", "f-tipo"].forEach(id => {
    const el = $("#" + id);
    if (el) el.addEventListener("input", renderCards);
  });
}

/* ======================= RENDER ESTRELLAS ======================= */
function renderStarsDisplay(rating = 0) {
  const total = 5;
  let html = "";
  for (let i = 1; i <= total; i++) html += i <= rating ? "⭐" : '<span style="color:#475569;">★</span>';
  return html;
}

/* ======================= RENDER TARJETAS ======================= */
function renderCards() {
  const cont = $("#cards");
  if (!cont) return;

  const q  = ($("#q")?.value || "").toLowerCase();
  const fc = $("#f-ciudad")?.value || "";
  const ft = $("#f-tipo")?.value || "";

  const filtrados = ARTISTAS_PUBLICOS.filter(a => {
    const texto = `${a.nombre_artistico||""} ${a.ciudad||""} ${a.tipo_arte||""}`.toLowerCase();
    const okQ = !q  || texto.includes(q);
    const okC = !fc || a.ciudad === fc;
    const okT = !ft || (a.tipo_arte || "").includes(ft);
    return okQ && okC && okT;
  });

  if (filtrados.length === 0) {
    cont.innerHTML = "<p style='text-align:center;'>No hay artistas aprobados con ese criterio.</p>";
    return;
  }

  cont.innerHTML = filtrados.map(a => {
    const vId = getYouTubeId(a.video || "");
    const iframe = vId ? `<iframe class="video" src="https://www.youtube.com/embed/${vId}" allowfullscreen></iframe>` : "";
    const rating = Number(a.rating || 0);
    const stars  = renderStarsDisplay(rating);

    const foto = a.__foto || "https://cdn-icons-png.flaticon.com/512/847/847969.png";
    const precios = `
      <span class="badge">15m $${a.p15 || "-"}</span>
      <span class="badge">30m $${a.p30 || "-"}</span>
      <span class="badge">60m $${a.p60 || "-"}</span>
      <span class="badge">120m $${a.p120 || "-"}</span>
    `;

    return `
      <article class="card">
        <img
          src="${esc(foto)}"
          alt="${esc(a.nombre_artistico || "Artista")}"
          onerror="this.src='https://cdn-icons-png.flaticon.com/512/847/847969.png';"
        />
        <h3>${esc(a.nombre_artistico || "")}</h3>
        <div class="small">${esc((a.tipo_arte || "").split(",").map(s => s.trim()).filter(Boolean).join(" • "))} • ${esc(a.ciudad || "")}</div>
        <div class="small">${stars} <span style="margin-left:6px;color:#94a3b8;">(${a.votos || 0})</span></div>
        <p>${esc(a.bio || "")}</p>
        ${iframe}
        <div class="actions">${precios}</div>
        <div class="actions"><button class="primary" data-id="${esc(a.id || "")}" data-nombre="${esc(a.nombre_artistico || "")}" data-correo="${esc(a.correo || "")}" onclick="abrirSolicitud(this.dataset.id)">Contratar</button></div>
      </article>
    `;
  }).join("");
}

/* ======================= RESERVA / SOLICITUD (MODAL PROPIO) ======================= */
function abrirSolicitud(artistaId) {
  const a = ARTISTAS.find(x => String(x.id) === String(artistaId));
  if (!a) return;

  // modal overlay
  let overlay = $("#ba-modal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "ba-modal";
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <h3>Solicitar a ${esc(a.nombre_artistico || "")}</h3>
        <button id="ba-close" class="modal-close">Cerrar</button>
      </div>
      <form id="form-solicitud" class="modal-body">
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
        <p id="precioTotal" class="modal-total"></p>
        <label>Mensaje<textarea name="mensaje" rows="2" placeholder="Detalles del evento..."></textarea></label>
        <div class="actions"><button class="primary" type="submit">Enviar solicitud</button></div>
        <p id="msg-solicitud" class="msg"></p>
      </form>
    </div>
  `;

  // estilos inline mínimos por si el CSS aún no tiene las clases del modal
  Object.assign(overlay.style, {
    position:"fixed", inset:"0", background:"rgba(0,0,0,0.7)", display:"flex",
    alignItems:"center", justifyContent:"center", zIndex:"1000", padding:"12px"
  });

  const head = overlay.querySelector(".modal-card");
  if (head) Object.assign(head.style, {
    background:"#0f172a", color:"#e2e8f0", borderRadius:"14px",
    width:"min(92%,680px)", padding:"16px", boxShadow:"0 0 20px rgba(14,165,233,0.35)",
    maxHeight:"90vh", overflowY:"auto"
  });

  overlay.querySelector("#ba-close")?.addEventListener("click", ()=> overlay.remove());

  const precioCalc = (dur) => {
    const base = parseFloat(a[`p${dur}`] || "0") || 0;
    const total = base * (1 + CONFIG.COMMISSION_USER);
    return { base, total: total.toFixed(2) };
  };
  const prec0 = precioCalc(30);
  const precioTotalEl = overlay.querySelector("#precioTotal");
  if (precioTotalEl) precioTotalEl.innerHTML = `Valor total a pagar: <b>$${prec0.total}</b>`;

  overlay.querySelector("#duracion")?.addEventListener("change", (e)=>{
    const dur = e.target.value;
    const p = precioCalc(dur);
    priceUpdate(p);
  });

  function priceUpdate(p) {
    if (precioTotalEl) precioTotalEl.innerHTML = `Valor total a pagar: <b>$${p.total}</b>`;
  }

  overlay.querySelector("#form-solicitud").onsubmit = async (e)=>{
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const p = precioCalc(fd.duracion);
    const msg = overlay.querySelector("#msg-solicitud");
    try {
      // Envío de notificación por GAS (si deseas)
      await gas("notifyNewBooking", {
        to: [a.correo],
        artista: a.nombre_artistico,
        fecha: fd.fecha_evento,
        duracion: fd.duracion,
        ciudad: fd.ciudad_evento,
        mensaje: fd.mensaje || ""
      });
      if (msg) { msg.textContent = "✅ Solicitud enviada. Te contactaremos para confirmar."; msg.style.color = "#10b981"; }
      setTimeout(()=> overlay.remove(), 1200);
    } catch(err) {
      console.error(err);
      if (msg) { msg.textContent = "❌ No se pudo enviar la solicitud."; msg.style.color = "#ef4444"; }
    }
  };
}

/* ======================= ADMIN PANEL ======================= */
/* Usa el contenedor existente: #admin (overlay) y #admin-content (body) */
function openAdmin() {
  const pass = prompt("🔒 Ingrese contraseña de administrador:");
  if (pass !== CONFIG.ADMIN_PASSWORD) {
    if (pass) alert("❌ Contraseña incorrecta.");
    return;
  }
  $("#admin")?.classList.remove("hidden");
  renderAdminShell();
  adminLoadAndRender();
}

function renderAdminShell() {
  const c = $("#admin-content");
  if (!c) return;
  c.innerHTML = `
    <div class="admin-header">
      <h2>Panel de Administración</h2>
      <div class="admin-actions">
        <button id="adm-refresh">🔄 Recargar</button>
        <button id="adm-comisiones">📊 Comisiones (30m)</button>
      </div>
    </div>

    <div class="admin-controls">
      <input id="adm-q" placeholder="Buscar por nombre, ciudad o cédula...">
      <select id="adm-estado">
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendiente</option>
        <option value="aprobado">Aprobado</option>
        <option value="rechazado">Rechazado</option>
      </select>
    </div>

    <div id="adm-list" class="tabla-admin">
      <p class="small-muted">Cargando artistas...</p>
    </div>
    <p class="small-muted" style="margin-top:8px;">Acceso: 4 toques en el título o Ctrl + Alt + A.</p>
  `;

  $("#adm-refresh").onclick = adminLoadAndRender;
  $("#adm-comisiones").onclick = adminCalcularComisiones;
  $("#adm-q").oninput = adminRenderList;
  $("#adm-estado").onchange = adminRenderList;
}

const AdminState = {
  rows: [],
  filtered: []
};

async function adminFetchRows() {
  const j = await fetchJson(CONFIG.SHEETDB_ENDPOINT);
  const rows = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
  return rows;
}

async function adminLoadAndRender() {
  const list = $("#adm-list");
  if (list) list.innerHTML = `<p class="small-muted">Cargando artistas...</p>`;
  try {
    AdminState.rows = await adminFetchRows();
    adminRenderList();
  } catch (e) {
    console.error(e);
    if (list) list.innerHTML = `<p style="color:#ef4444;">Error cargando datos.</p>`;
  }
}

function adminRenderList() {
  const list = $("#adm-list");
  if (!list) return;
  const q = ($("#adm-q")?.value || "").toLowerCase();
  const est = ($("#adm-estado")?.value || "").toLowerCase();

  const rows = (AdminState.rows || []).filter(a => {
    const estado = (a.estado || (a.aprobado?.toUpperCase() === "TRUE" ? "aprobado" : "pendiente")).toLowerCase();
    if (est && estado !== est) return false;
    const hay = `${a.nombre_artistico||""} ${a.ciudad||""} ${a.cedula||""}`.toLowerCase();
    return !q || hay.includes(q);
  });

  AdminState.filtered = rows;

  if (rows.length === 0) {
    list.innerHTML = `<p class="small-muted">Sin resultados.</p>`;
    return;
  }

  list.innerHTML = rows.map(renderAdminRow).join("");

  // Attach actions
  list.querySelectorAll("[data-act='aprobar']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced;
    adminSetEstado(ced, "aprobado", true);
  }));
  list.querySelectorAll("[data-act='rechazar']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced;
    adminSetEstado(ced, "rechazado", false);
  }));
  list.querySelectorAll("[data-act='borrar']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced;
    adminDelete(ced);
  }));
  list.querySelectorAll("[data-act='toggle-edit']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced;
    const area = document.getElementById("adm-edit-"+ced);
    if (area) area.style.display = (area.style.display === "none" ? "grid" : "none");
  }));
  list.querySelectorAll("[data-act='guardar']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced;
    adminSaveEdits(ced);
  }));
}

function renderAdminRow(a) {
  const estado = (a.estado || (a.aprobado?.toUpperCase() === "TRUE" ? "aprobado" : "pendiente")).toLowerCase();
  const pillClass = estado === "aprobado" ? "estado-pill"
                  : estado === "rechazado" ? "estado-pill estado-rechazado"
                  : "estado-pill estado-pendiente";
  const foto = (a.foto && a.foto.startsWith("http")) ? a.foto
    : "https://via.placeholder.com/96x96?text=Sin+foto";

  return `
    <div class="fila-artista">
      <img src="${esc(foto)}" alt="${esc(a.nombre_artistico||"Artista")}" />
      <div class="fila-info">
        <h4>${esc(a.nombre_artistico||"(sin nombre)")}</h4>
        <div class="meta">${esc(a.tipo_arte||"")} • ${esc(a.ciudad||"")} • Céd: ${esc(a.cedula||"")}</div>
        <div class="bio">${esc(a.bio||"")}</div>

        <div id="adm-edit-${esc(a.cedula||"")}" class="area-edit" style="display:none;">
          <input data-f="nombre_artistico" value="${esc(a.nombre_artistico||"")}" placeholder="Nombre artístico" />
          <input data-f="ciudad" value="${esc(a.ciudad||"")}" placeholder="Ciudad" />
          <input data-f="tipo_arte" value="${esc(a.tipo_arte||"")}" placeholder="Tipo de arte" />
          <input data-f="p15" value="${esc(a.p15||"")}" placeholder="p15" />
          <input data-f="p30" value="${esc(a.p30||"")}" placeholder="p30" />
          <input data-f="p60" value="${esc(a.p60||"")}" placeholder="p60" />
          <input data-f="p120" value="${esc(a.p120||"")}" placeholder="p120" />
          <input data-f="foto" value="${esc(a.foto||"")}" placeholder="URL foto" />
          <input data-f="video" value="${esc(a.video||"")}" placeholder="YouTube link" />
          <textarea data-f="bio" rows="2" placeholder="Bio">${esc(a.bio||"")}</textarea>
          <div class="edit-actions">
            <button data-act="guardar" data-ced="${esc(a.cedula||"")}">💾 Guardar</button>
            <button data-act="toggle-edit" data-ced="${esc(a.cedula||"")}">Cerrar</button>
          </div>
          <div class="calc-comm">Tarifa 30m: $${esc(a.p30||"0")} | Tu (10%): $${calcCommission(a.p30, CONFIG.COMMISSION_USER)} | Artista (5%): $${calcCommission(a.p30, CONFIG.COMMISSION_ARTIST)}</div>
        </div>
      </div>
      <div class="fila-actions">
        <span class="${pillClass}">${esc(estado.toUpperCase())}</span>
        <div class="fila-buttons">
          <button class="aprobar" data-act="aprobar" data-ced="${esc(a.cedula||"")}">✅ Aprobar</button>
          <button class="rechazar" data-act="rechazar" data-ced="${esc(a.cedula||"")}">❌ Rechazar</button>
          <button class="borrar" data-act="borrar" data-ced="${esc(a.cedula||"")}">🗑️ Borrar</button>
          <button class="editar" data-act="toggle-edit" data-ced="${esc(a.cedula||"")}">✏️ Editar</button>
        </div>
      </div>
    </div>
  `;
}

function calcCommission(value, ratio){
  const n = parseFloat(String(value||'').replace(/[^\d\.\-]/g,''));
  if (isNaN(n)) return '0.00';
  const c = (n * ratio);
  return Number.isFinite(c) ? c.toFixed(2) : '0.00';
}

async function adminSetEstado(cedula, estado, aprobarFlag) {
  if (!cedula) return alert("Registro sin cédula.");
  if (!confirm(`Cambiar a ${estado.toUpperCase()} la cédula ${cedula}?`)) return;
  try {
    await fetchJson(`${CONFIG.SHEETDB_ENDPOINT}/cedula/${encodeURIComponent(cedula)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{ estado, aprobado: aprobarFlag ? "TRUE" : "FALSE" }] })
    });
    await adminLoadAndRender();
    // refrescar público
    await cargarArtistas(); renderCards();
    alert("✅ Estado actualizado.");
  } catch (e) {
    console.error(e); alert("❌ Error al actualizar.");
  }
}

async function adminDelete(cedula) {
  if (!cedula) return alert("Registro sin cédula.");
  if (!confirm(`Eliminar definitivamente la cédula ${cedula}?`)) return;
  try {
    await fetchJson(`${CONFIG.SHEETDB_ENDPOINT}/cedula/${encodeURIComponent(cedula)}`, {
      method: "DELETE"
    });
    await adminLoadAndRender();
    await cargarArtistas(); renderCards();
    alert("🗑️ Registro eliminado.");
  } catch (e) {
    console.error(e); alert("❌ Error al eliminar.");
  }
}

async function adminSaveEdits(cedula) {
  const area = document.getElementById("adm-edit-"+cedula);
  if (!area) return;
  const payload = {};
  area.querySelectorAll("[data-f]").forEach(i => payload[i.dataset.f] = i.value);

  try {
    await fetchJson(`${CONFIG.SHEETDB_ENDPOINT}/cedula/${encodeURIComponent(cedula)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [payload] })
    });
    await adminLoadAndRender();
    await cargarArtistas(); renderCards();
    alert("💾 Cambios guardados.");
  } catch (e) {
    console.error(e); alert("❌ Error guardando cambios.");
  }
}

async function adminCalcularComisiones(){
  try {
    const rows = await adminFetchRows();
    let user = 0, art = 0, count = 0;
    rows.forEach(a=>{
      const base = parseFloat(String(a.p30||'0').replace(/[^\d\.]/g,'')) || 0;
      user += base * CONFIG.COMMISSION_USER;
      art  += base * CONFIG.COMMISSION_ARTIST;
      count++;
    });
    alert(`Comisiones (sobre p30)\n- Tu (10%): $${user.toFixed(2)}\n- Artista (5%): $${art.toFixed(2)}\nRegistros: ${count}`);
  } catch(err) {
    console.error(err);
    alert("Error calculando comisiones.");
  }
}

/* ======================= INIT ======================= */
document.addEventListener("DOMContentLoaded", async ()=>{
  setupTabs();
  setupSecretAdminAccess();
  await cargarArtistas();
  renderFiltros();
  renderCards();
});
