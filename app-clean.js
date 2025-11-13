/* =========================================================
   BANCO DE ARTISTAS - app-clean.js (UNIFICADO)
   - Registro muestra PIN y envía email de PIN (via GAS hook)
   - Contratos guardados en la misma SheetDB con tipo='contrato'
   - Modal de contratación incluye campo HORA
   - Confirmación clara al usuario al generar contrato
   - Panel admin: artistas completos + sección contratos por artista
   - Compatible con Postimages flow en index.html
   - Endpoint: https://sheetdb.io/api/v1/jaa331n4u5icl
========================================================= */

/* ======================= CONFIG ======================= */
const CONFIG = {
  SHEETDB_ENDPOINT: "https://sheetdb.io/api/v1/jaa331n4u5icl",
  COMMISSION_USER: 0.10,
  COMMISSION_ARTIST: 0.05,
  ADMIN_PASSWORD: "Admin2026",
  // Opcional GAS (debe existir en tu proyecto, lo usaremos para enviar emails)
  GAS_URL: "https://script.google.com/macros/s/AKfycbyZ27mjG6lnRdvV_MsaOOrr8lD7cN1KDUSaigYeiqVOu8cX_Yw8-xu7QORMhfwyJPvS/exec"
};

/* ======================= GAS helper (ya tenías uno similar) ======================= */
async function gas(action, payload = {}) {
  try {
    const r = await fetch(CONFIG.GAS_URL, {
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

async function sheetGet() {
  try {
    const j = await fetchJson(CONFIG.SHEETDB_ENDPOINT);
    return Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
  } catch (e) {
    console.error("sheetGet error:", e);
    return [];
  }
}
async function sheetPost(row) {
  const r = await fetch(CONFIG.SHEETDB_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [row] })
  });
  return await r.json();
}
async function sheetPatchByCedula(cedula, row) {
  const url = `${CONFIG.SHEETDB_ENDPOINT}/cedula/${encodeURIComponent(cedula)}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [row] })
  });
  return await r.json();
}
async function sheetDeleteByCedula(cedula) {
  const url = `${CONFIG.SHEETDB_ENDPOINT}/cedula/${encodeURIComponent(cedula)}`;
  const r = await fetch(url, { method: "DELETE" });
  return await r.json();
}

/* Utilidades para Drive / PostImages / YouTube */
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
function getDriveProxyUrl(d) {
  const id = getDriveIdFromUrl(d || "");
  return id ? `${CONFIG.DRIVE_PROXY_URL}?id=${id}` : d;
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
function esc(s){ return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

/* ======================= STATE ======================= */
let ARTISTAS_RAW = [];       // todos los rows crudos (artistas + contratos mezclados)
let ARTISTAS = [];           // solo registros considerados "artista"
let CONTRATOS = [];         // solo registros considerados "contrato"

/* ======================= TABS SETUP ======================= */
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
let _tapCount = 0, _lastTap = 0;
function setupAdminTriggers() {
  const h1 = $("header h1");
  if (h1) {
    h1.addEventListener("click", () => {
      const now = Date.now();
      if (now - _lastTap < 700) _tapCount++; else _tapCount = 1;
      _lastTap = now;
      if (_tapCount >= 4) { _tapCount = 0; openAdmin(); }
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && (e.key === "a" || e.key === "A")) openAdmin();
  });
  $("#close-admin")?.addEventListener("click", () => {
    $("#admin")?.classList.add("hidden");
    if ($("#admin-content")) $("#admin-content").innerHTML = "";
  });
}

/* ======================= INIT ======================= */
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupAdminTriggers();
  bindLocalUI();            // eventos HTML en index (Postimages preview y registro)
  await reloadAllData();    // carga desde sheet y actualiza vistas
});

/* ======================= BINDINGS - INDEX.HTML specific ======================= */
function bindLocalUI() {
  // Previsualización Postimages (index.html contains these elements)
  const inputFoto = document.getElementById("foto");
  const alertaFoto = document.getElementById("alerta-foto");
  const preview = document.getElementById("preview-foto");
  if (inputFoto) {
    inputFoto.addEventListener("input", () => {
      const url = inputFoto.value.trim();
      const esValida = /^https:\/\/i\.postimg\.cc\/.*\.(jpg|jpeg|png)$/i.test(url);
      if (esValida) {
        alertaFoto.textContent = "✅ Enlace válido. Imagen lista para subir.";
        alertaFoto.style.color = "#10b981";
        if (preview) { preview.src = url; preview.classList.remove("hidden"); }
      } else if (url.length > 0) {
        alertaFoto.textContent = "⚠️ El enlace no es válido. Asegúrate de copiar el 'Enlace directo' que termina en .jpg o .png desde Postimages.";
        alertaFoto.style.color = "#ef4444";
        if (preview) preview.classList.add("hidden");
      } else {
        alertaFoto.textContent = "";
        if (preview) preview.classList.add("hidden");
      }
    });
  }

  // Registro: si existe el formulario en index.html
  const regForm = document.getElementById("form-registro");
  if (regForm) regForm.addEventListener("submit", onRegistroWithPin);

  // Login artista (si lo usas)
  const login = document.getElementById("form-login-artista");
  if (login) login.addEventListener("submit", onLoginArtista);

  // Buscar reservas (placeholder)
  const buscar = document.getElementById("form-buscar-reserva");
  if (buscar) buscar.addEventListener("submit", onBuscarReserva);
}

/* ======================= RELOAD ALL DATA ======================= */
async function reloadAllData() {
  ARTISTAS_RAW = await sheetGet();
  // Distinguimos registros: si la fila tiene campo 'tipo' === 'contrato' -> contrato
  // Si no tiene tipo o tipo === 'artista' -> artista
  ARTISTAS = ARTISTAS_RAW.filter(r => {
    const tipo = (r.tipo || "").toString().trim().toLowerCase();
    // detectar si es contrato por campos característicos
    if (tipo === "contrato") return false;
    if (r.artista_id || r.artista_nombre) return false; // registros anteriores clasificados como contratos
    return true;
  }).map(normalizeArtist);

  CONTRATOS = ARTISTAS_RAW.filter(r => {
    const tipo = (r.tipo || "").toString().trim().toLowerCase();
    if (tipo === "contrato") return true;
    return Boolean(r.artista_id || r.artista_nombre); // older contract rows
  }).map(normalizeContrato);

  // Render UI
  renderFiltros();
  renderCards();
}

/* Helpers to normalize data shapes */
function normalizeArtist(a) {
  const estado = (a.estado || (a.aprobado?.toUpperCase() === "TRUE" ? "aprobado" : "")).toString().toLowerCase();
  const approved = estado === "aprobado" || (a.aprobado || "").toString().toUpperCase() === "TRUE";
  const fotoRaw = a.foto || a.Foto || a["Foto del artista"] || "";
  const foto = fotoRaw.includes("drive.google.com") ? getDriveProxyUrl(fotoRaw) : (fotoRaw || "");
  return { ...a, estado, aprobado: approved, fotoResolved: foto };
}
function normalizeContrato(c) {
  // expected fields: id, artista_id, artista_nombre, usuario_nombre, usuario_correo, fecha, hora, duracion, ciudad, mensaje, estado
  return { ...c };
}

/* ======================= RENDER FILTROS ======================= */
function renderFiltros() {
  const fc = $("#f-ciudad"), ft = $("#f-tipo");
  if (!fc || !ft) return;
  const ciudades = [...new Set(ARTISTAS.map(a => a.ciudad).filter(Boolean))].sort();
  const tipos = [...new Set(ARTISTAS.map(a => a.tipo_arte).filter(Boolean))].sort();
  fc.innerHTML = `<option value="">Todas las ciudades</option>` + ciudades.map(c => `<option>${esc(c)}</option>`).join("");
  ft.innerHTML = `<option value="">Todos los tipos</option>` + tipos.map(t => `<option>${esc(t)}</option>`).join("");
  ["q","f-ciudad","f-tipo"].forEach(id => {
    const el = $("#" + id);
    if (el) el.oninput = renderCards;
  });
}

/* ======================= RENDER CARDS (EXPLORAR) ======================= */
function renderCards() {
  const cont = $("#cards");
  if (!cont) return;
  const q = ($("#q")?.value || "").toLowerCase();
  const fc = $("#f-ciudad")?.value || "";
  const ft = $("#f-tipo")?.value || "";

  const visibles = ARTISTAS.filter(a => {
    // must be approved to show
    const okApproved = a.estado === "aprobado" || (a.aprobado === true);
    if (!okApproved) return false;
    const texto = `${a.nombre_artistico||""} ${a.ciudad||""} ${a.tipo_arte||""}`.toLowerCase();
    const okQ = !q || texto.includes(q);
    const okC = !fc || a.ciudad === fc;
    const okT = !ft || (a.tipo_arte || "").includes(ft);
    return okQ && okC && okT && a.deleted !== "TRUE";
  });

  if (visibles.length === 0) {
    cont.innerHTML = "<p style='text-align:center;'>No hay artistas aprobados con ese criterio.</p>";
    return;
  }

  cont.innerHTML = visibles.map(a => {
    const vId = getYouTubeId(a.video || "");
    const iframe = vId ? `<iframe class="video" src="https://www.youtube.com/embed/${vId}" allowfullscreen></iframe>` : "";
    const precios = `
      <span class="badge">15m $${a.p15 || "-"}</span>
      <span class="badge">30m $${a.p30 || "-"}</span>
      <span class="badge">60m $${a.p60 || "-"}</span>
      <span class="badge">120m $${a.p120 || "-"}</span>
    `;
    const foto = a.fotoResolved || "https://cdn-icons-png.flaticon.com/512/847/847969.png";
    return `
      <article class="card">
        <img src="${esc(foto)}" alt="${esc(a.nombre_artistico||"Artista")}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/847/847969.png';" />
        <h3>${esc(a.nombre_artistico||"")}</h3>
        <div class="small">${esc((a.tipo_arte||"").split(",").map(s=>s.trim()).filter(Boolean).join(" • "))} • ${esc(a.ciudad||"")}</div>
        <p>${esc(a.bio||"")}</p>
        ${iframe}
        <div class="actions">${precios}</div>
        <div class="actions">
          <button class="primary" onclick="abrirSolicitud('${esc(a.id||a.cedula||"")}', '${esc(a.nombre_artistico||"")}', '${esc(a.correo||"")}')">Contratar</button>
        </div>
      </article>
    `;
  }).join("");
}

/* ======================= REGISTRAR ARTISTA (con PIN mostrado y email) ======================= */
async function onRegistroWithPin(e) {
  e.preventDefault();
  const f = e.target;
  const msgEl = $("#msg-registro");
  if (msgEl) { msgEl.textContent = ""; msgEl.style.color = ""; }

  // collect from form fields (index.html uses inputs with these names)
  const formData = Object.fromEntries(new FormData(f));
  // photo from PostImages input 'foto'
  const fotoURL = (formData.foto || "").trim();

  // validate PostImages link if provided (index.html already checks), but keep robust
  const isPostImg = /^https:\/\/i\.postimg\.cc\/.*\.(jpg|jpeg|png)$/i.test(fotoURL);
  if (fotoURL && !isPostImg) {
    if (msgEl) { msgEl.textContent = "❌ Enlace de foto inválido."; msgEl.style.color = "#ef4444"; }
    return;
  }

  // create ID and PIN
  const id = uid("A");
  const pin = pin6();

  // build row: mark as artista, tipo 'artista', leave estado pendiente by default
  const row = {
    id,
    tipo: "artista",
    nombre_artistico: formData.nombre_artistico || "",
    nombre_real: formData.nombre_real || "",
    cedula: formData.cedula || "",
    ciudad: formData.ciudad || "",
    correo: formData.correo || "",
    celular: formData.celular || "",
    tipo_arte: formData.tipo_arte || "",
    p15: formData.p15 || "",
    p30: formData.p30 || "",
    p60: formData.p60 || "",
    p120: formData.p120 || "",
    bio: formData.bio || "",
    foto: fotoURL || "",
    video: formData.video || "",
    pin,
    estado: "pendiente",
    aprobado: "FALSE",
    creado_en: new Date().toISOString()
  };

  try {
    await sheetPost(row);
    // show PIN to user in UI
    if (msgEl) {
      msgEl.innerHTML = `✅ Registro enviado. Tu PIN: <b style="color:#10b981">${esc(pin)}</b><br>Se ha enviado un correo con tu PIN. Guarda este PIN para futuras consultas.`;
      msgEl.style.color = "#10b981";
    } else {
      alert(`Registro enviado. Tu PIN: ${pin}`);
    }

    // Send PIN email via GAS (you already had a gas("sendPin") hook)
    try {
      await gas("sendPin", { to: [row.correo], artista: row.nombre_artistico, pin });
    } catch (err) {
      console.warn("Error enviando correo PIN:", err);
      // not fatal
    }

    // refresh lists
    await reloadAllData();
    f.reset();
    // hide preview if present
    const preview = document.getElementById("preview-foto"); if (preview) preview.classList.add("hidden");
    const alerta = document.getElementById("alerta-foto"); if (alerta) alerta.textContent = "";

  } catch (err) {
    console.error("Error registrando artista:", err);
    if (msgEl) { msgEl.textContent = "❌ Error al registrar. Intenta de nuevo."; msgEl.style.color = "#ef4444"; }
  }
}

/* ======================= LOGIN ARTISTA (simple) ======================= */
async function onLoginArtista(e) {
  e.preventDefault();
  const f = e.target;
  const ced = f.cedula.value.trim(); const pin = f.pin.value.trim();
  const rows = await sheetGet();
  const found = rows.find(r => (r.cedula || "") === ced && (r.pin || "") === pin);
  if (found) {
    $("#msg-login").textContent = "✅ Ingresaste correctamente.";
    $("#msg-login").style.color = "#10b981";
    // if you want to show artist panel, implement here (panel-artista)
    const panel = $("#panel-artista");
    if (panel) {
      panel.classList.remove("hidden");
      loadSolicitudesForArtist(found);
    }
  } else {
    $("#msg-login").textContent = "❌ Cédula o PIN incorrectos.";
    $("#msg-login").style.color = "#ef4444";
  }
}

/* ======================= BUSCAR RESERVA (placeholder) ======================= */
async function onBuscarReserva(e) {
  e.preventDefault();
  const correo = e.target.correo.value.trim().toLowerCase();
  const target = $("#reservas-usuario");
  if (!target) return;
  target.innerHTML = `<p style="text-align:center;">Buscando reservas para <b>${esc(correo)}</b>...</p>`;
  // we will search CONTRATOS array for usuario_correo
  await reloadAllData(); // ensure up-to-date
  const matches = CONTRATOS.filter(c => (c.usuario_correo || "").toLowerCase() === correo);
  if (matches.length === 0) {
    target.innerHTML = `<p style="text-align:center;">No se encontraron reservas para ${esc(correo)}.</p>`;
    return;
  }
  target.innerHTML = matches.map(c => `
    <div class="card">
      <h3>${esc(c.artista_nombre || c.artista)}</h3>
      <p class="small">${esc(c.ciudad||"")} • ${esc(c.fecha || "")} ${esc(c.hora || "")}</p>
      <p>${esc(c.mensaje || "")}</p>
      <p class="small-muted">Estado: ${esc(c.estado || "por confirmar")}</p>
    </div>
  `).join("");
}

/* ======================= ABRIR SOLICITUD - ahora con HORA y guardado de contrato ======================= */
async function abrirSolicitud(artistaId, artistaNombre = "", artistaCorreo = "") {
  // find artist by id or cedula
  await reloadAllData();
  const a = ARTISTAS.find(x => String(x.id) === String(artistaId) || String(x.cedula) === String(artistaId));
  if (!a) return alert("Artista no encontrado.");

  // create modal overlay (if not exists)
  let modal = $("#ba-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "ba-modal";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:#0f172a;color:#e2e8f0;border-radius:14px;padding:16px;width:min(94%,720px);max-height:90vh;overflow:auto;box-shadow:0 0 20px rgba(14,165,233,0.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:0;color:#0ea5e9;">Solicitar a ${esc(a.nombre_artistico||"Artista")}</h3>
        <button id="ba-close" style="background:#111827;border:1px solid #1f2b46;color:#e2e8f0;border-radius:8px;padding:6px 10px;cursor:pointer;">Cerrar</button>
      </div>
      <form id="form-solicitud" style="margin-top:12px;">
        <label>Tu nombre<input name="usuario_nombre" required></label>
        <label>Tu correo<input type="email" name="usuario_correo" required></label>
        <label>Tu celular<input name="usuario_celular" required></label>
        <label>Ciudad del evento<input name="ciudad_evento" required></label>
        <label>Fecha del evento<input type="date" name="fecha_evento" required></label>
        <label>Hora de presentación<input type="time" name="hora_evento" required></label>
        <label>Duración<select name="duracion" id="duracion">
          <option value="15">15 minutos</option>
          <option value="30" selected>30 minutos</option>
          <option value="60">60 minutos</option>
          <option value="120">120 minutos</option>
        </select></label>
        <p id="precioTotal" style="margin:6px 0;font-weight:600;color:#0ea5e9;"></p>
        <label>Mensaje<textarea name="mensaje" rows="2" placeholder="Detalles del evento..."></textarea></label>
        <div class="actions" style="margin-top:10px;"><button class="primary" type="submit">Enviar solicitud</button></div>
        <p id="msg-solicitud" class="msg"></p>
      </form>
    </div>
  `;
  // style overlay
  Object.assign(modal.style, { position:"fixed", inset:"0", background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:"1000", padding:"12px" });

  modal.querySelector("#ba-close")?.addEventListener("click", ()=> modal.remove());

  // price calc
  const precioCalc = (dur) => {
    const base = parseFloat(a[`p${dur}`] || "0") || 0;
    const total = base * (1 + CONFIG.COMMISSION_USER);
    return { base, total: total.toFixed(2) };
  };
  const precioEl = modal.querySelector("#precioTotal");
  const durSel = modal.querySelector("#duracion");
  if (durSel && precioEl) {
    const p0 = precioCalc(durSel.value);
    precioEl.innerHTML = `Valor total a pagar: <b>$${p0.total}</b>`;
    durSel.addEventListener("change", (e) => {
      const p = precioCalc(e.target.value);
      precioEl.innerHTML = `Valor total a pagar: <b>$${p.total}</b>`;
    });
  }

  // handle submit: create contract row in SheetDB and notify
  modal.querySelector("#form-solicitud").onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = Object.fromEntries(new FormData(ev.target));
    // build contract row
    const contratoId = uid("C");
    const dur = fd.duracion;
    const base = parseFloat(a[`p${dur}`] || "0") || 0;
    const total = (base * (1 + CONFIG.COMMISSION_USER)).toFixed(2);

    const contratoRow = {
      id: contratoId,
      tipo: "contrato",
      artista_id: a.id || a.cedula || "",
      artista_nombre: a.nombre_artistico || "",
      artista_correo: a.correo || artistaCorreo || "",
      usuario_nombre: fd.usuario_nombre || "",
      usuario_correo: fd.usuario_correo || "",
      usuario_celular: fd.usuario_celular || "",
      ciudad: fd.ciudad_evento || "",
      fecha: fd.fecha_evento || "",
      hora: fd.hora_evento || "",
      duracion: dur,
      mensaje: fd.mensaje || "",
      estado: "por confirmar artista",
      comprobante_url: "",
      precio_total: total,
      creado_en: new Date().toISOString()
    };

    try {
      await sheetPost(contratoRow);
      // add to local list
      CONTRATOS.push(contratoRow);

      // notify artist via GAS (hook existing: notifyNewBooking)
      try {
        await gas("notifyNewBooking", {
          to: [contratoRow.artista_correo],
          artista: contratoRow.artista_nombre,
          fecha: contratoRow.fecha,
          hora: contratoRow.hora,
          duracion: contratoRow.duracion,
          ciudad: contratoRow.ciudad,
          mensaje: contratoRow.mensaje
        });
      } catch (err) {
        console.warn("notifyNewBooking failed:", err);
      }

      // show clear success message to user
      const msg = modal.querySelector("#msg-solicitud");
      if (msg) {
        msg.innerHTML = `✅ Tu contrato fue generado con éxito. Debes esperar la confirmación del artista y estar atento al correo que proporcionaste: <b>${esc(contratoRow.usuario_correo)}</b>.`;
        msg.style.color = "#10b981";
      } else {
        alert("Tu contrato fue generado con éxito. Revisa tu correo.");
      }

      // close modal after short delay
      setTimeout(()=> modal.remove(), 2200);

      // refresh admin/contracts view if open
      await reloadAllData();

    } catch (err) {
      console.error("Error guardando contrato:", err);
      const msg = modal.querySelector("#msg-solicitud");
      if (msg) {
        msg.textContent = "❌ Error al generar el contrato. Intenta de nuevo.";
        msg.style.color = "#ef4444";
      } else alert("Error generando contrato.");
    }
  };
}

/* ======================= ADMIN PANEL - FULL (ARTISTAS + CONTRATOS) ======================= */
function openAdmin() {
  const pass = prompt("🔒 Ingrese contraseña de administrador:");
  if (pass !== CONFIG.ADMIN_PASSWORD) {
    if (pass) alert("❌ Contraseña incorrecta.");
    return;
  }
  const admin = $("#admin"); if (admin) admin.classList.remove("hidden");
  renderAdminShell();
  adminLoadAndRender();
}

function renderAdminShell() {
  const root = $("#admin-content"); if (!root) return;
  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
      <h3 style="margin:0;color:#0ea5e9;">Panel de Administración</h3>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="admin-tab-artistas">🎭 Artistas</button>
        <button id="admin-tab-contratos">📄 Contratos</button>
        <button id="admin-refresh">🔄 Recargar</button>
      </div>
    </div>
    <div id="admin-body" style="margin-top:12px;"></div>
  `;
  $("#admin-tab-artistas").onclick = () => adminRenderArtists();
  $("#admin-tab-contratos").onclick = () => adminRenderContratos();
  $("#admin-refresh").onclick = () => adminLoadAndRender();
}

/* admin data loader */
async function adminLoadAndRender() {
  // reload all data (this will repopulate ARTISTAS and CONTRATOS)
  await reloadAllData();
  adminRenderArtists();
}

/* ADMIN: Render Artists view (full data) */
function adminRenderArtists() {
  const body = $("#admin-body"); if (!body) return;
  // controls
  body.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
      <input id="adm-q" placeholder="Buscar nombre, ciudad o cédula..." style="flex:1;padding:8px;border-radius:8px;background:#0e1625;border:1px solid #1f2b46;color:#e2e8f0;">
      <select id="adm-estado" style="padding:8px;border-radius:8px;background:#0e1625;border:1px solid #1f2b46;color:#e2e8f0;">
        <option value="">Todos</option>
        <option value="pendiente">Pendiente</option>
        <option value="aprobado">Aprobado</option>
        <option value="rechazado">Rechazado</option>
      </select>
    </div>
    <div id="adm-list" style="display:flex;flex-direction:column;gap:8px;"></div>
  `;
  $("#adm-q").oninput = adminRenderArtistsList;
  $("#adm-estado").onchange = adminRenderArtistsList;
  adminRenderArtistsList();
}

function adminRenderArtistsList() {
  const list = $("#adm-list"); if (!list) return;
  const q = ($("#adm-q")?.value || "").toLowerCase();
  const estadoFiltro = ($("#adm-estado")?.value || "").toLowerCase();

  const rows = ARTISTAS.filter(a => {
    const hay = `${a.nombre_artistico||""} ${a.ciudad||""} ${a.cedula||""}`.toLowerCase();
    const matchQ = !q || hay.includes(q);
    const estado = (a.estado || (a.aprobado ? "aprobado" : "pendiente")).toLowerCase();
    const matchEstado = !estadoFiltro || estado === estadoFiltro;
    return matchQ && matchEstado;
  });

  if (rows.length === 0) {
    list.innerHTML = `<p class="small-muted">No hay artistas para mostrar</p>`;
    return;
  }

  list.innerHTML = rows.map(a => renderAdminArtistRow(a)).join("");

  // attach listeners
  list.querySelectorAll("[data-act='aprobar']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced; adminSetEstado(ced, "aprobado", true);
  }));
  list.querySelectorAll("[data-act='rechazar']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced; adminSetEstado(ced, "rechazado", false);
  }));
  list.querySelectorAll("[data-act='borrar']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced; adminDelete(ced);
  }));
  list.querySelectorAll("[data-act='toggle-edit']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced; const area = $("#adm-edit-"+ced); if (area) area.style.display = (area.style.display === "none" ? "grid" : "none");
  }));
  list.querySelectorAll("[data-act='guardar']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced; adminSaveEdits(ced);
  }));
  list.querySelectorAll("[data-act='ver-contratos']").forEach(b => b.addEventListener("click", e => {
    const ced = e.currentTarget.dataset.ced; adminShowContratosForArtist(ced);
  }));
}

function renderAdminArtistRow(a) {
  const estado = (a.estado || (a.aprobado ? "aprobado" : "pendiente")).toLowerCase();
  const pillStyle = estado === "aprobado" ? "background:#a7f3d0;color:#064e3b;padding:4px 8px;border-radius:999px;font-weight:700;"
                  : estado === "rechazado" ? "background:#fecaca;color:#7f1d1d;padding:4px 8px;border-radius:999px;font-weight:700;"
                  : "background:#fde68a;color:#92400e;padding:4px 8px;border-radius:999px;font-weight:700;";

  const foto = a.fotoResolved || (a.foto && a.foto.startsWith("http") ? a.foto : "https://via.placeholder.com/96x96?text=Sin+foto");
  // include full dataset: pin, correo, celular, etc.
  return `
    <div style="display:flex;gap:12px;align-items:flex-start;background:#0f172a;padding:10px;border-radius:10px;">
      <img src="${esc(foto)}" style="width:72px;height:72px;border-radius:8px;object-fit:cover;border:1px solid #1f2b46;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:700;color:#0ea5e9;">${esc(a.nombre_artistico||"(sin nombre)")}</div>
            <div style="color:#94a3b8;font-size:0.9rem;">${esc(a.tipo_arte||"")} • ${esc(a.ciudad||"")}</div>
          </div>
          <div style="text-align:right">
            <div style="${pillStyle}">${esc(estado.toUpperCase())}</div>
            <div style="margin-top:8px;font-size:0.85rem;color:#94a3b8">Céd: ${esc(a.cedula||"")}</div>
          </div>
        </div>
        <div style="margin-top:8px;color:#e2e8f0">${esc(a.bio||"")}</div>
        <div style="margin-top:8px;color:#e2e8f0;font-size:0.9rem;">
          <div><b>Correo:</b> ${esc(a.correo||"")}</div>
          <div><b>Celular:</b> ${esc(a.celular||"")}</div>
          <div><b>PIN:</b> ${esc(a.pin||"---")}</div>
          <div style="margin-top:6px;">Precios: 15m $${esc(a.p15||"-")} • 30m $${esc(a.p30||"-")} • 60m $${esc(a.p60||"-")}</div>
        </div>

        <div id="adm-edit-${esc(a.cedula||"")}" style="display:none;margin-top:8px;gap:8px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">
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
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button data-act="guardar" data-ced="${esc(a.cedula||"")}">💾 Guardar</button>
            <button data-act="toggle-edit" data-ced="${esc(a.cedula||"")}">Cerrar</button>
            <button data-act="ver-contratos" data-ced="${esc(a.cedula||"")}">📄 Ver contratos</button>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;min-width:120px;align-items:flex-end;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button data-act="aprobar" data-ced="${esc(a.cedula||"")}">✅ Aprobar</button>
          <button data-act="rechazar" data-ced="${esc(a.cedula||"")}">❌ Rechazar</button>
          <button data-act="borrar" data-ced="${esc(a.cedula||"")}">🗑️ Borrar</button>
          <button data-act="toggle-edit" data-ced="${esc(a.cedula||"")}">✏️ Editar</button>
        </div>
      </div>
    </div>
  `;
}

/* ADMIN: Set estado (aprobar/rechazar) */
async function adminSetEstado(cedula, estado, aprobarFlag) {
  if (!cedula) return alert("Registro sin cédula.");
  if (!confirm(`Cambiar a ${estado.toUpperCase()} la cédula ${cedula}?`)) return;
  try {
    await sheetPatchByCedula(cedula, { estado, aprobado: aprobarFlag ? "TRUE" : "FALSE" });
    await adminLoadAndRender();
    await reloadAllData();
    alert("✅ Estado actualizado.");
  } catch (e) {
    console.error(e); alert("❌ Error al actualizar.");
  }
}

/* ADMIN: Delete */
async function adminDelete(cedula) {
  if (!cedula) return alert("Registro sin cédula.");
  if (!confirm(`Eliminar definitivamente la cédula ${cedula}?`)) return;
  try {
    await sheetDeleteByCedula(cedula);
    await adminLoadAndRender();
    await reloadAllData();
    alert("🗑️ Registro eliminado.");
  } catch (e) {
    console.error(e); alert("❌ Error al eliminar.");
  }
}

/* ADMIN: Save edits inline */
async function adminSaveEdits(cedula) {
  const area = document.getElementById("adm-edit-"+cedula);
  if (!area) return alert("Área de edición no encontrada.");
  const payload = {};
  area.querySelectorAll("[data-f]").forEach(i => payload[i.dataset.f] = i.value);
  try {
    await sheetPatchByCedula(cedula, payload);
    await adminLoadAndRender();
    await reloadAllData();
    alert("💾 Cambios guardados.");
  } catch (e) {
    console.error(e); alert("❌ Error guardando cambios.");
  }
}

/* ADMIN: Render contracts view */
function adminRenderContratos() {
  const body = $("#admin-body"); if (!body) return;
  body.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
      <input id="adm-contrato-q" placeholder="Buscar por artista, usuario o cédula..." style="flex:1;padding:8px;border-radius:8px;background:#0e1625;border:1px solid #1f2b46;color:#e2e8f0;">
      <select id="adm-contrato-estado" style="padding:8px;border-radius:8px;background:#0e1625;border:1px solid #1f2b46;color:#e2e8f0;">
        <option value="">Todos</option>
        <option value="por confirmar artista">Por confirmar artista</option>
        <option value="confirmado">Confirmado</option>
        <option value="cancelado">Cancelado</option>
      </select>
    </div>
    <div id="adm-contratos-list" style="display:flex;flex-direction:column;gap:8px;"></div>
  `;
  $("#adm-contrato-q").oninput = adminRenderContratosList;
  $("#adm-contrato-estado").onchange = adminRenderContratosList;
  adminRenderContratosList();
}

function adminRenderContratosList() {
  const list = $("#adm-contratos-list"); if (!list) return;
  const q = ($("#adm-contrato-q")?.value || "").toLowerCase();
  const est = ($("#adm-contrato-estado")?.value || "").toLowerCase();

  const rows = CONTRATOS.filter(c => {
    const hay = `${c.artista_nombre||""} ${c.usuario_nombre||""} ${c.artista_id||""} ${c.usuario_correo||""}`.toLowerCase();
    const okQ = !q || hay.includes(q);
    const estado = (c.estado || "").toLowerCase();
    const okE = !est || estado === est;
    return okQ && okE;
  });

  if (rows.length === 0) { list.innerHTML = `<p class="small-muted">No hay contratos.</p>`; return; }

  list.innerHTML = rows.map(c => `
    <div class="card">
      <h3>${esc(c.artista_nombre || "Artista")}</h3>
      <p class="small">${esc(c.ciudad||"")} • ${esc(c.fecha||"")} ${esc(c.hora||"")} • Duración: ${esc(c.duracion||"")}</p>
      <p>${esc(c.mensaje||"")}</p>
      <p class="small-muted">Usuario: ${esc(c.usuario_nombre||"")} • ${esc(c.usuario_correo||"")} • Tel: ${esc(c.usuario_celular||"")}</p>
      <p class="small-muted">Estado: ${esc(c.estado||"")}</p>
    </div>
  `).join("");
}

/* ADMIN helper: show contracts for a specific artist cedula */
function adminShowContratosForArtist(cedula) {
  const artist = ARTISTAS.find(a => a.cedula === cedula || String(a.id) === cedula);
  if (!artist) return alert("Artista no encontrado.");
  // switch to contratos tab UI in admin body
  const body = $("#admin-body"); if (!body) return;
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div>
        <h3 style="margin:0;color:#0ea5e9;">Contratos de ${esc(artist.nombre_artistico||"")}</h3>
        <div class="small-muted">Céd: ${esc(artist.cedula||"")} • Correo: ${esc(artist.correo||"")}</div>
      </div>
      <div><button id="adm-back-to-artistas">« Volver a Artistas</button></div>
    </div>
    <div id="adm-contratos-artist-list"></div>
  `;
  $("#adm-back-to-artistas").onclick = () => adminRenderArtists();
  const list = $("#adm-contratos-artist-list");
  if (!list) return;
  const rows = CONTRATOS.filter(c => String(c.artista_id) === String(artist.id) || String(c.artista_id) === String(artist.cedula) || (c.artista_correo && c.artista_correo === artist.correo));
  if (rows.length === 0) list.innerHTML = `<p class="small-muted">No hay contratos para este artista.</p>`;
  else list.innerHTML = rows.map(c => `
    <div class="card">
      <h4>${esc(c.usuario_nombre||"Usuario")}</h4>
      <p class="small">${esc(c.ciudad||"")} • ${esc(c.fecha||"")} ${esc(c.hora||"")}</p>
      <p>${esc(c.mensaje||"")}</p>
      <p class="small-muted">Estado: ${esc(c.estado||"")}</p>
      <p class="small-muted">Contacto: ${esc(c.usuario_correo||"")} • ${esc(c.usuario_celular||"")}</p>
    </div>
  `).join("");
}

/* ======================= UTIL - refresh full lists ======================= */
async function refreshLocalFromSheet() {
  const rows = await sheetGet();
  ARTISTAS_RAW = rows;
  ARTISTAS = rows.filter(r => {
    const tipo = (r.tipo || "").toString().toLowerCase();
    if (tipo === "contrato") return false;
    if (r.artista_id || r.artista_nombre) return false; // older contract style
    return true;
  }).map(normalizeArtist);
  CONTRATOS = rows.filter(r => {
    const tipo = (r.tipo || "").toString().toLowerCase();
    return (tipo === "contrato" || r.artista_id || r.artista_nombre);
  }).map(normalizeContrato);
}
async function reloadAllData() {
  await refreshLocalFromSheet();
  renderFiltros();
  renderCards();
}

/* ======================= ADMIN - CALCULOS UTILES ======================= */
function calcCommission(value, ratio) {
  const n = parseFloat(String(value||'').replace(/[^\d\.\-]/g,'')) || 0;
  return (n*ratio).toFixed(2);
}

/* ======================= ARTIST PANEL - SOLICITUDES (optional) ======================= */
async function loadSolicitudesForArtist(artistRow) {
  // shows the contracts assigned to this artist in panel-artista
  const panel = $("#panel-artista");
  if (!panel) return;
  await reloadAllData();
  const rows = CONTRATOS.filter(c => String(c.artista_id) === String(artistRow.id) || String(c.artista_id) === String(artistRow.cedula) || c.artista_correo === artistRow.correo);
  if (rows.length === 0) panel.innerHTML = `<p class="small-muted">No hay solicitudes aún.</p>`;
  else panel.innerHTML = rows.map(c => `
    <div class="card">
      <h4>${esc(c.usuario_nombre||"")}</h4>
      <p class="small">${esc(c.fecha||"")} ${esc(c.hora||"")} • ${esc(c.ciudad||"")}</p>
      <p>${esc(c.mensaje||"")}</p>
      <p class="small-muted">Estado: ${esc(c.estado||"")}</p>
    </div>
  `).join("");
}

/* ======================= END OF FILE ======================= */
/* Nota:
 - Este archivo asume que tu index.html tiene:
   - #form-registro con inputs (nombre_artistico, nombre_real, cedula, ciudad, correo, celular, tipo_arte, p15, p30, p60, p120, bio, foto, video)
   - #msg-registro para mensajes
   - #cards contenedor para artistas
   - #admin overlay con #admin-content y #close-admin
 - Usa la función `gas(action, payload)` para enviar correos: mantuvimos la llamada gas("sendPin", ...) y gas("notifyNewBooking", ...).
 - Los registros nuevos de artistas se guardan con campo tipo='artista' y contratos con tipo='contrato' para facilitar queries futuras.
 - Si quieres que los contratos puedan editarse/confirmarse desde admin (botón Confirmar), lo agrego en una patch pequeña.
*/
