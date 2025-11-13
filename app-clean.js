/**
 * app-clean.js
 * Versión mejorada - Banco de Artistas
 *
 * - Requiere que index.html tenga los elementos con los ids usados abajo.
 * - Usa SheetDB endpoint confirmado: https://sheetdb.io/api/v1/jaa331n4u5icl
 * - Usa un GAS_URL para subir imágenes y enviar emails (sendPin, uploadImage, notifyNewBooking).
 *
 * NOTA: Ajusta CONFIG si necesitas cambiar credenciales o endpoints.
 */

/* ====================== CONFIG ====================== */
const CONFIG = {
  SHEETDB_ENDPOINT: "https://sheetdb.io/api/v1/jaa331n4u5icl",
  COMMISSION_USER: 0.10,
  COMMISSION_ARTIST: 0.05,
  ADMIN_PASSWORD: "Admin2026",     // cambiar si quieres
  GAS_URL: "https://script.google.com/macros/s/AKfycbyZ27mjG6lnRdvV_MsaOOrr8lD7cN1KDUSaigYeiqVOu8cX_Yw8-xu7QORMhfwyJPvS/exec",
  DRIVE_PROXY_URL: "https://script.google.com/macros/s/AKfycbxyPirSpnyUykA2hlx5zoU0KtRftjU9AnYltF3r3idQLxlirNHUF2WOFuRzEuJPx1XM/exec"
};

/* ====================== HELPERS ====================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));

const uid = (prefix = "ID") => prefix + Math.random().toString(36).slice(2, 9).toUpperCase();
const pin6 = () => String(Math.floor(100000 + Math.random() * 900000));

function esc(s = "") { return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

async function gas(action, payload = {}) {
  // Wrapper simple para llamadas a tu GAS backend
  try {
    const r = await fetch(CONFIG.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload })
    });
    return await r.json().catch(()=>({}));
  } catch (e) {
    console.warn("GAS error:", e);
    return { ok: false, error: String(e) };
  }
}

/* SheetDB helpers */
async function sheetGet() {
  try {
    const r = await fetch(CONFIG.SHEETDB_ENDPOINT);
    if (!r.ok) throw new Error("SheetDB GET failed " + r.status);
    const j = await r.json();
    // SheetDB sometimes returns {data: [...] } or directly [...]
    if (Array.isArray(j)) return j;
    if (Array.isArray(j.data)) return j.data;
    return [];
  } catch (e) {
    console.error("sheetGet:", e);
    return [];
  }
}

async function sheetPost(row) {
  try {
    const r = await fetch(CONFIG.SHEETDB_ENDPOINT, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ data: [ row ] })
    });
    return await r.json();
  } catch (e) {
    console.error("sheetPost:", e);
    throw e;
  }
}

async function sheetPatchById(id, row) {
  try {
    const url = `${CONFIG.SHEETDB_ENDPOINT}/id/${encodeURIComponent(id)}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ data: row })
    });
    return await r.json();
  } catch (e) {
    console.error("sheetPatchById:", e);
    throw e;
  }
}

async function sheetPatchByCedula(cedula, row) {
  try {
    const url = `${CONFIG.SHEETDB_ENDPOINT}/cedula/${encodeURIComponent(cedula)}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ data: row })
    });
    return await r.json();
  } catch (e) {
    console.error("sheetPatchByCedula:", e);
    throw e;
  }
}

async function sheetDeleteByCedula(cedula) {
  try {
    const url = `${CONFIG.SHEETDB_ENDPOINT}/cedula/${encodeURIComponent(cedula)}`;
    const r = await fetch(url, { method: "DELETE" });
    return await r.json();
  } catch (e) {
    console.error("sheetDeleteByCedula:", e);
    throw e;
  }
}

/* Drive helpers (proxy) */
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
  } catch (e) {}
  return "";
}
function getDriveProxyUrl(anyDriveUrlOrId) {
  const id = getDriveIdFromUrl(anyDriveUrlOrId) || anyDriveUrlOrId;
  return id ? `${CONFIG.DRIVE_PROXY_URL}?id=${id}` : anyDriveUrlOrId;
}

/* YouTube helper */
function getYouTubeId(url = "") {
  if (!url) return "";
  try {
    if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split(/[?&]/)[0];
    if (url.includes("watch?v=")) return url.split("watch?v=")[1].split("&")[0];
    if (url.includes("/embed/")) return url.split("/embed/")[1].split(/[?&]/)[0];
  } catch (_) {}
  return "";
}

/* base64 converter for file upload */
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
  });
}

/* ====================== STATE ====================== */
let ALL_ROWS = [];    // raw rows fetched from SheetDB
let ARTISTAS = [];    // filtered artists (tipo !== 'contrato')
let CONTRATOS = [];   // filtered contracts (tipo === 'contrato' or containing artista_id)
let LOADING = false;

/* ====================== UI UTILITIES ====================== */

/**
 * Mensajes persistentes - se mantienen hasta navegacion o cierre manual
 * showPersistentMessage(text, type, sticky)
 * - type: 'success' | 'error' | 'info'
 * - sticky: boolean (if true won't auto hide)
 */
const MSG_ROOT_ID = "persistent-msg-root";
function ensureMsgRoot() {
  let root = document.getElementById(MSG_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = MSG_ROOT_ID;
    root.style.position = "fixed";
    root.style.bottom = "18px";
    root.style.left = "18px";
    root.style.zIndex = 9999;
    document.body.appendChild(root);
  }
  return root;
}
function showPersistentMessage(htmlText, type = "info", sticky = true) {
  const root = ensureMsgRoot();
  const id = "msg-" + Date.now();
  const div = document.createElement("div");
  div.id = id;
  div.className = "persistent-msg";
  div.style.background = type === "success" ? "#10b981" : (type === "error" ? "#ef4444" : "#0ea5e9");
  div.style.color = "#fff";
  div.style.padding = "12px 14px";
  div.style.borderRadius = "10px";
  div.style.marginTop = "8px";
  div.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
  div.innerHTML = `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
    <div style="max-width:520px">${htmlText}</div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn-close-msg" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;padding:6px 8px;border-radius:8px;cursor:pointer">Cerrar</button>
    </div>
  </div>`;
  root.appendChild(div);
  div.querySelector(".btn-close-msg").onclick = () => div.remove();
  // if not sticky, auto hide after 6s
  if (!sticky) setTimeout(()=>div.remove(), 6000);
  return id;
}
function clearAllMessages() {
  const root = document.getElementById(MSG_ROOT_ID);
  if (root) root.innerHTML = "";
}

/* ====================== UI BINDINGS & TABS ====================== */

/* Initialize tab buttons and switcher */
function bindTabs() {
  const tabButtons = $$("nav.tabs button");
  tabButtons.forEach(b => {
    b.addEventListener("click", async () => {
      tabButtons.forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      $$(".tab").forEach(t => t.classList.remove("active"));
      const target = $("#tab-" + b.dataset.tab);
      if (target) {
        target.classList.add("active");
        // ensure latest data when visiting key tabs
        if (["explorar","reservas","ingresar"].includes(b.dataset.tab)) {
          await reloadAllData();
          renderCards();
        }
      }
    });
  });
}

/* secret admin activation: 4 taps + ctrl+alt+a */
function bindAdminSecret() {
  let taps = 0, last = 0;
  const title = $("header h1") || document.getElementById("titulo-app") || document.querySelector("header h1");
  if (title) {
    title.addEventListener("click", () => {
      const now = Date.now();
      if (now - last < 800) taps++; else taps = 1;
      last = now;
      if (taps >= 4) openAdminPanel();
      setTimeout(()=> taps = 0, 1200);
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && (e.key.toLowerCase() === "a")) openAdminPanel();
  });
}

/* attach forms after DOM ready */
function bindForms() {
  const reg = $("#form-registro"); if (reg) reg.addEventListener("submit", onRegistro);
  const login = $("#form-login-artista"); if (login) login.addEventListener("submit", onLoginArtista);
  const buscar = $("#form-buscar-reserva"); if (buscar) buscar.addEventListener("submit", onBuscarReserva);
}

/* ====================== DATA LOAD / RENDER ====================== */

async function reloadAllData() {
  // fetch latest rows and separate artists and contracts
  ALL_ROWS = await sheetGet();
  // normalize: ensure it's array of objects
  if (!Array.isArray(ALL_ROWS)) ALL_ROWS = [];
  // classify
  ARTISTAS = ALL_ROWS.filter(r => {
    const tipo = (r.tipo || "").toString().toLowerCase();
    if (tipo === "contrato") return false;
    // some contract rows may have artista_id or artista_nombre, so exclude
    if (r.artista_id || r.artista_nombre) return false;
    return true;
  }).map(a => ({ ...a, fotoResolved: resolveFoto(a.foto || a.Foto || a["Foto del artista"] || "") }));

  CONTRATOS = ALL_ROWS.filter(r => {
    const tipo = (r.tipo || "").toString().toLowerCase();
    if (tipo === "contrato") return true;
    if (r.artista_id || r.artista_nombre) return true;
    return false;
  }).map(c => ({ ...c }));

  // deduplicate ARTISTAS by cedula or correo
  ARTISTAS = dedupeArtists(ARTISTAS);

  // render filters/cards if exploring visible
  renderCards();
}

function dedupeArtists(arr) {
  const seen = new Map();
  const out = [];
  for (const a of arr) {
    const key = (a.cedula || a.correo || a.id || a.nombre_artistico || "").toString().trim().toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.set(key, true);
      out.push(a);
    } else {
      // skip duplicates
    }
  }
  return out;
}

function resolveFoto(posibleFoto) {
  if (!posibleFoto) return "";
  if (posibleFoto.includes("drive.google.com")) return getDriveProxyUrl(posibleFoto);
  if (posibleFoto.startsWith("http")) return posibleFoto;
  return "";
}

/* Render filtros (ciudad, tipo) */
function renderFiltros() {
  const fc = $("#f-ciudad"), ft = $("#f-tipo");
  if (!fc || !ft) return;
  const ciudades = [...new Set(ARTISTAS.map(a => (a.ciudad || "").trim()).filter(Boolean))].sort();
  const tipos = [...new Set(ARTISTAS.map(a => (a.tipo_arte || "").split(",").map(s=>s.trim()).filter(Boolean)).flat())].sort();
  fc.innerHTML = `<option value="">Todas las ciudades</option>` + ciudades.map(c => `<option>${esc(c)}</option>`).join("");
  ft.innerHTML = `<option value="">Todos los tipos</option>` + tipos.map(t => `<option>${esc(t)}</option>`).join("");
  ["q","f-ciudad","f-tipo"].forEach(id => {
    const el = $("#" + id); if (el) el.oninput = renderCards;
  });
}

/* Render artist cards */
function renderCards() {
  const cont = $("#cards"); if (!cont) return;
  const q = ($("#q")?.value || "").toLowerCase();
  const fc = $("#f-ciudad")?.value || "";
  const ft = $("#f-tipo")?.value || "";
  const visibles = ARTISTAS.filter(a => {
    const estado = (a.estado || (a.aprobado && a.aprobado.toString().toUpperCase()==="TRUE" ? "aprobado" : "pendiente")).toString().toLowerCase();
    if (estado !== "aprobado" && estado !== "true") return false;
    const text = `${a.nombre_artistico||""} ${a.ciudad||""} ${a.tipo_arte||""}`.toLowerCase();
    const okQ = !q || text.includes(q);
    const okC = !fc || (a.ciudad || "") === fc;
    const okT = !ft || ((a.tipo_arte || "").toLowerCase().includes(ft.toLowerCase()));
    return okQ && okC && okT && a.deleted !== "TRUE";
  });

  if (visibles.length === 0) {
    cont.innerHTML = `<p style="text-align:center;color:#94a3b8">No hay artistas aprobados.</p>`;
    return;
  }

  cont.innerHTML = visibles.map(a => {
    const foto = a.fotoResolved || "https://cdn-icons-png.flaticon.com/512/847/847969.png";
    const vId = getYouTubeId(a.video || "");
    const iframe = vId ? `<iframe class="video" src="https://www.youtube.com/embed/${vId}" allowfullscreen></iframe>` : "";
    return `
      <article class="card">
        <img src="${esc(foto)}" alt="${esc(a.nombre_artistico||'Artista')}" style="width:100%;height:180px;object-fit:cover;border-radius:12px;border:1px solid #1f2b46" onerror="this.src='https://cdn-icons-png.flaticon.com/512/847/847969.png'"/>
        <h3>${esc(a.nombre_artistico||"")}</h3>
        <div class="small">${esc((a.tipo_arte||"").split(",").map(s=>s.trim()).filter(Boolean).join(" • "))} • ${esc(a.ciudad||"")}</div>
        <p>${esc(a.bio||"")}</p>
        ${iframe}
        <div style="margin-top:8px">
          <span class="badge">15m $${esc(a.p15||"-")}</span>
          <span class="badge">30m $${esc(a.p30||"-")}</span>
          <span class="badge">60m $${esc(a.p60||"-")}</span>
          <span class="badge">120m $${esc(a.p120||"-")}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="primary btn-contratar" data-id="${esc(a.id||a.cedula||'')}" >Contratar</button>
          <button class="secondary btn-ver" data-id="${esc(a.id||a.cedula||'')}" >Ver</button>
        </div>
      </article>
    `;
  }).join("");

  // attach events
  $$(".btn-contratar").forEach(b => b.onclick = () => abrirSolicitud(b.dataset.id));
  $$(".btn-ver").forEach(b => b.onclick = () => verPerfilPublic(b.dataset.id));
}

/* ====================== REGISTRO ARTISTA ====================== */

let registering = false;

async function onRegistro(e) {
  e.preventDefault();
  if (registering) return;
  registering = true;
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const msgEl = $("#msg-registro");
  if (btn) { btn.disabled = true; btn.textContent = "Enviando..."; }
  if (msgEl) { msgEl.textContent = ""; }

  // collect form values (supporting file input named fotoFile OR url input named foto)
  const data = Object.fromEntries(new FormData(form));
  // prefer URL if provided, else file upload
  let fotoURL = (data.foto || "").trim();

  // if file input present and file selected, upload to GAS
  const fileInput = form.querySelector('input[type="file"][name="fotoFile"]');
  if (!fotoURL && fileInput && fileInput.files && fileInput.files[0]) {
    try {
      const file = fileInput.files[0];
      const b64 = await toBase64(file);
      const res = await gas("uploadImage", {
        folder: "FotosArtistas",
        fileName: file.name,
        mimeType: file.type,
        base64: b64
      });
      if (res && res.ok && res.id) {
        fotoURL = `https://drive.google.com/uc?export=view&id=${res.id}`;
      } else if (res && res.url) {
        fotoURL = res.url;
      } else {
        console.warn("uploadImage returned:", res);
      }
    } catch (err) {
      console.warn("Error uploading image:", err);
    }
  }

  // Basic validation
  if (!data.nombre_artistico || !data.cedula || !data.correo) {
    if (msgEl) { msgEl.textContent = "Completa nombre artístico, cédula y correo."; msgEl.style.color = "#ef4444"; }
    registering = false; if (btn) { btn.disabled=false; btn.textContent="Registrar"; } return;
  }

  // reload data to prevent race duplicates
  await reloadAllData();

  const existsCed = ARTISTAS.find(a => String(a.cedula || "").trim() === String(data.cedula).trim());
  const existsMail = ARTISTAS.find(a => (a.correo || "").toLowerCase().trim() === (data.correo || "").toLowerCase().trim());
  if (existsCed || existsMail) {
    if (msgEl) {
      msgEl.innerHTML = `⚠️ Ya existe un registro con la ${existsCed ? "misma cédula" : "mismo correo"}. Si es tuyo, inicia sesión con tu PIN o contacta al admin.`;
      msgEl.style.color = "#f59e0b";
    }
    registering = false; if (btn) { btn.disabled=false; btn.textContent="Registrar"; } return;
  }

  // create row
  const id = uid("A");
  const pin = pin6();
  const row = {
    id,
    tipo: "artista",
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
    foto: fotoURL || "",
    video: data.video || "",
    pin,
    estado: "pendiente",
    aprobado: "FALSE",
    deleted: "FALSE",
    creado_en: new Date().toISOString()
  };

  try {
    await sheetPost(row);
    // show persistent message with PIN and mail note
    showPersistentMessage(`✅ Registro recibido. Tu PIN: <b style="color:#fff">${esc(pin)}</b>. Se envió un correo con tu PIN.`, "success", true);
    // send pin via GAS (non-blocking)
    gas("sendPin", { to: [row.correo], artista: row.nombre_artistico, pin }).catch(e => console.warn("sendPin failed", e));
    // refresh
    await reloadAllData();
    form.reset();
  } catch (err) {
    console.error("onRegistro error:", err);
    if (msgEl) { msgEl.textContent = "❌ Error al registrar. Intenta de nuevo."; msgEl.style.color = "#ef4444"; }
  } finally {
    registering = false;
    if (btn) { btn.disabled = false; btn.textContent = "Registrar"; }
  }
}

/* ====================== SOLICITUD / CONTRATO ====================== */

function abrirSolicitud(artistaId) {
  // find artist by id or cedula
  const a = ARTISTAS.find(x => String(x.id) === String(artistaId) || String(x.cedula) === String(artistaId));
  if (!a) return showPersistentMessage("Artista no encontrado", "error", false);
  // Build modal-like admin area using admin overlay (#admin)
  const adminOverlay = $("#admin");
  if (!adminOverlay) {
    // fallback to prompt flow if admin overlay not available
    promptBookingFallback(a);
    return;
  }
  // use admin-content as modal (but we'll show it temporarily)
  const adminContent = $("#admin-content");
  if (!adminContent) return promptBookingFallback(a);

  // create form html
  adminContent.innerHTML = `
    <div class="card" style="max-height:70vh;overflow:auto">
      <h3>Solicitar a ${esc(a.nombre_artistico || "")}</h3>
      <form id="form-solicitud">
        <label>Tu nombre<input name="usuario_nombre" required></label>
        <label>Tu correo<input type="email" name="usuario_correo" required></label>
        <label>Tu celular<input name="usuario_celular" required></label>
        <label>Ciudad del evento<input name="ciudad_evento" required></label>
        <label>Fecha del evento<input type="date" name="fecha_evento" required></label>
        <label>Hora de presentación<input type="time" name="hora_evento" required></label>
        <label>Duración<select name="duracion" id="duracion">
          <option value="15">15 minutos</option>
          <option value="30">30 minutos</option>
          <option value="60">60 minutos</option>
          <option value="120">120 minutos</option>
        </select></label>
        <p id="precioTotal" style="margin:6px 0;font-weight:600;color:#0ea5e9;"></p>
        <label>Mensaje<textarea name="mensaje" rows="2" placeholder="Detalles..."></textarea></label>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="primary" type="submit">Enviar solicitud</button>
          <button type="button" id="cancel-solicitud" class="secondary">Cancelar</button>
        </div>
        <p id="msg-solicitud" class="msg"></p>
      </form>
    </div>
  `;
  // show admin overlay as modal
  adminOverlay.classList.remove("hidden");
  // when not admin (we reuse same overlay) hide other admin UI if any
  $("#admin-content").dataset.current = "solicitud";
  // calculate price
  const durEl = $("#duracion");
  const precioEl = $("#precioTotal");
  const calcPrice = (d) => {
    const base = Number(a[`p${d}`] || 0) || 0;
    const total = (base * (1 + CONFIG.COMMISSION_USER)).toFixed(2);
    return { base, total };
  };
  precioEl.innerHTML = `Valor total a pagar: <b>$${calcPrice(durEl.value).total}</b>`;
  durEl.addEventListener("change", (ev) => {
    precioEl.innerHTML = `Valor total a pagar: <b>$${calcPrice(ev.target.value).total}</b>`;
  });

  // cancel button hides overlay
  $("#cancel-solicitud").onclick = () => {
    $("#admin").classList.add("hidden");
    $("#admin-content").innerHTML = "";
  };

  // on submit
  $("#form-solicitud").onsubmit = async function(evt) {
    evt.preventDefault();
    const fd = Object.fromEntries(new FormData(evt.target));
    // validation
    if (!fd.usuario_nombre || !fd.usuario_correo || !fd.fecha_evento || !fd.hora_evento) {
      $("#msg-solicitud").textContent = "Completa los campos requeridos.";
      $("#msg-solicitud").style.color = "#ef4444";
      return;
    }
    const dur = fd.duracion || "30";
    const base = Number(a[`p${dur}`] || 0) || 0;
    const total = (base * (1 + CONFIG.COMMISSION_USER)).toFixed(2);
    const contrato = {
      id: uid("C"),
      tipo: "contrato",
      artista_id: a.id || a.cedula || "",
      artista_nombre: a.nombre_artistico || "",
      artista_correo: a.correo || "",
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
      await sheetPost(contrato);
      // persistent success message shown to user
      showPersistentMessage(`✅ Tu contrato fue generado con éxito. Revisa el correo <b style="color:#fff">${esc(contrato.usuario_correo)}</b> para detalles.`, "success", true);
      // notify artist via GAS (non-blocking)
      gas("notifyNewBooking", { to: [contrato.artista_correo], artista: contrato.artista_nombre, fecha: contrato.fecha, hora: contrato.hora, duracion: contrato.duracion, ciudad: contrato.ciudad, mensaje: contrato.mensaje }).catch(e => console.warn("notifyNewBooking failed", e));
      // refresh local state
      await reloadAllData();
      // disable submit to avoid duplicates
      evt.target.querySelector("button[type='submit']").disabled = true;
      // leave modal open until user closes
    } catch (err) {
      console.error("Error creating contrato:", err);
      $("#msg-solicitud").textContent = "Error al enviar la solicitud. Intenta otra vez.";
      $("#msg-solicitud").style.color = "#ef4444";
    }
  };
}

/* fallback simple prompt booking if overlay missing */
async function promptBookingFallback(a) {
  const nombre = prompt("Tu nombre:");
  if (!nombre) return;
  const correo = prompt("Tu correo:");
  if (!correo) return;
  const fecha = prompt("Fecha del evento (YYYY-MM-DD):");
  const hora = prompt("Hora (HH:MM):");
  const dur = prompt("Duración (minutos, e.j. 30):", "30");
  const contrato = {
    id: uid("C"),
    tipo: "contrato",
    artista_id: a.id || a.cedula || "",
    artista_nombre: a.nombre_artistico || "",
    artista_correo: a.correo || "",
    usuario_nombre: nombre,
    usuario_correo: correo,
    usuario_celular: "",
    ciudad: "",
    fecha,
    hora,
    duracion: dur,
    mensaje: "",
    estado: "por confirmar artista",
    precio_total: (Number(a[`p${dur}`]||0)*(1+CONFIG.COMMISSION_USER)).toFixed(2),
    creado_en: new Date().toISOString()
  };
  try {
    await sheetPost(contrato);
    showPersistentMessage("Contrato creado. Revisa tu correo para seguimiento.", "success", true);
    await reloadAllData();
  } catch (e) {
    console.error(e);
    alert("Error al generar contrato.");
  }
}

/* view public profile simple modal */
function verPerfilPublic(id) {
  const a = ARTISTAS.find(x => String(x.id) === String(id) || String(x.cedula) === String(id));
  if (!a) return showPersistentMessage("Artista no encontrado", "error", false);
  const content = `
    <div style="padding:12px;max-width:720px">
      <h3 style="color:#0ea5e9">${esc(a.nombre_artistico||"")}</h3>
      <div style="color:#94a3b8">${esc((a.tipo_arte||""))} • ${esc(a.ciudad||"")}</div>
      <img src="${esc(a.fotoResolved||a.foto||'https://cdn-icons-png.flaticon.com/512/847/847969.png')}" style="width:100%;height:220px;object-fit:cover;border-radius:10px;margin-top:10px;border:1px solid #1f2b46"/>
      <p style="margin-top:10px">${esc(a.bio||"")}</p>
      <div style="margin-top:8px"><b>Contacto:</b> ${esc(a.correo||"")} • ${esc(a.celular||"")}</div>
    </div>
  `;
  showModal(content, {closable:true});
}

/* ====================== ARTIST LOGIN & PANEL ====================== */

async function onLoginArtista(e) {
  e.preventDefault();
  const form = e.target;
  const ced = (form.cedula.value || "").toString().trim();
  const pin = (form.pin.value || "").toString().trim();
  await reloadAllData();
  const found = ARTISTAS.find(a => ((a.cedula || "").toString().trim() === ced) && ((a.pin || "").toString().trim() === pin));
  const msg = $("#msg-login");
  if (!found) {
    if (msg) { msg.textContent = "Cédula o PIN incorrectos."; msg.style.color = "#ef4444"; }
    return;
  }
  if (msg) { msg.textContent = "Ingreso correcto. Cargando solicitudes..."; msg.style.color = "#10b981"; }
  // show panel-artist and list their contracts
  const panel = $("#panel-artista");
  if (panel) {
    panel.classList.remove("hidden");
    loadSolicitudesForArtist(found);
  }
}

/* load artist-specific contracts into panel */
async function loadSolicitudesForArtist(artistRow) {
  await reloadAllData();
  const panel = $("#panel-artista");
  if (!panel) return;
  const rows = CONTRATOS.filter(c => String(c.artista_id) === String(artistRow.id) || String(c.artista_id) === String(artistRow.cedula) || (c.artista_correo && c.artista_correo === artistRow.correo));
  if (rows.length === 0) { panel.innerHTML = `<p class="small-muted">No hay solicitudes.</p>`; return; }
  panel.innerHTML = rows.map(c => `
    <div class="card">
      <h4>${esc(c.usuario_nombre||"")}</h4>
      <div class="small">${esc(c.ciudad||"")} • ${esc(c.fecha||"")} ${esc(c.hora||"")}</div>
      <p>${esc(c.mensaje||"")}</p>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="primary btn-aceptar" data-id="${esc(c.id||'')}">Aceptar</button>
        <button class="secondary btn-rechazar" data-id="${esc(c.id||'')}">Rechazar</button>
      </div>
    </div>
  `).join("");

  // attach accept/reject handlers
  panel.querySelectorAll(".btn-aceptar").forEach(b => b.addEventListener("click", async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm("Confirmar contrato?")) return;
    try {
      await sheetPatchById(id, { estado: "confirmado" });
      await reloadAllData();
      loadSolicitudesForArtist(artistRow);
      showPersistentMessage("✅ Contrato confirmado.", "success", false);
    } catch (e) { console.error(e); showPersistentMessage("Error al confirmar contrato", "error", false); }
  }));

  panel.querySelectorAll(".btn-rechazar").forEach(b => b.addEventListener("click", async (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm("Rechazar contrato?")) return;
    try {
      await sheetPatchById(id, { estado: "rechazado" });
      await reloadAllData();
      loadSolicitudesForArtist(artistRow);
      showPersistentMessage("Contrato rechazado.", "info", false);
    } catch (e) { console.error(e); showPersistentMessage("Error al rechazar contrato", "error", false); }
  }));
}

/* ====================== RESERVAS USUARIO ====================== */

async function onBuscarReserva(e) {
  e.preventDefault();
  const form = e.target;
  const correo = (form.correo.value || "").toLowerCase().trim();
  const target = $("#reservas-usuario");
  if (!target) return;
  await reloadAllData();
  const matches = CONTRATOS.filter(c => (c.usuario_correo || "").toLowerCase() === correo);
  if (matches.length === 0) { target.innerHTML = `<p class="small-muted">No se encontraron reservas para ${esc(correo)}</p>`; return; }
  target.innerHTML = matches.map(c => `
    <div class="card">
      <h3>${esc(c.artista_nombre||"")}</h3>
      <p class="small">${esc(c.ciudad||"")} • ${esc(c.fecha||"")} ${esc(c.hora||"")}</p>
      <p>${esc(c.mensaje||"")}</p>
      <p class="small-muted">Estado: ${esc(c.estado||"")}</p>
    </div>
  `).join("");
}

/* ====================== ADMIN PANEL ====================== */

function openAdminPanel() {
  // ask for password (simple)
  const pass = prompt("🔒 Ingrese contraseña de administrador:");
  if (pass !== CONFIG.ADMIN_PASSWORD) { if (pass) alert("Contraseña incorrecta."); return; }
  const admin = $("#admin");
  if (!admin) {
    alert("Admin overlay no encontrado.");
    return;
  }
  // show admin overlay and render shell
  admin.classList.remove("hidden");
  renderAdminShell();
  adminLoadAndRender();
}

function renderAdminShell() {
  const root = $("#admin-content");
  if (!root) return;
  root.dataset.current = "artistas";
  root.innerHTML = `
    <div class="admin-controls" style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;gap:8px">
        <button id="admin-tab-artistas" class="primary">Artistas</button>
        <button id="admin-tab-contratos" class="secondary">Contratos</button>
      </div>
      <div style="display:flex;gap:8px">
        <button id="admin-refresh" class="secondary">🔄 Recargar</button>
        <button id="admin-back" class="secondary">⬅️ Volver</button>
        <button id="admin-close" class="secondary">Cerrar</button>
      </div>
    </div>
    <div id="admin-body" style="margin-top:12px"></div>
  `;
  $("#admin-tab-artistas").onclick = () => { root.dataset.current = "artistas"; adminRenderArtists(); };
  $("#admin-tab-contratos").onclick = () => { root.dataset.current = "contratos"; adminRenderContratos(); };
  $("#admin-refresh").onclick = () => adminLoadAndRender();
  $("#admin-back").onclick = () => { /* "volver" regresa al listado de artistas */ adminRenderArtists(); };
  $("#admin-close").onclick = () => { $("#admin").classList.add("hidden"); $("#admin-content").innerHTML = ""; };
}

async function adminLoadAndRender() {
  await reloadAllData();
  adminRenderArtists();
}

function adminRenderArtists() {
  const body = $("#admin-body"); if (!body) return;
  body.innerHTML = `
    <div style="margin-bottom:10px;display:flex;gap:8px;">
      <input id="adm-q" placeholder="Buscar por nombre, ciudad o cédula..." style="flex:1;padding:8px;border-radius:8px;background:#0e1625;border:1px solid #1f2b46;color:#e2e8f0" />
      <select id="adm-estado">
        <option value="">Todos</option><option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option>
      </select>
    </div>
    <div id="adm-list"></div>
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
    const estado = (a.estado || (a.aprobado && a.aprobado.toString().toUpperCase()==="TRUE" ? "aprobado" : "pendiente")).toString().toLowerCase();
    const matchEstado = !estadoFiltro || estado === estadoFiltro;
    return matchQ && matchEstado;
  });
  if (rows.length === 0) { list.innerHTML = `<p class="small-muted">No hay artistas para mostrar.</p>`; return; }
  list.innerHTML = rows.map(a => adminArtistRow(a)).join("");

  // attach events after DOM update
  list.querySelectorAll("[data-act='aprobar']").forEach(b => b.addEventListener("click", async (e) => {
    const ced = e.currentTarget.dataset.ced; if (!ced) return;
    if (!confirm("Aprobar este artista?")) return;
    try { await sheetPatchByCedula(ced, { estado: "aprobado", aprobado: "TRUE" }); await adminLoadAndRender(); await reloadAllData(); showPersistentMessage("Artista aprobado.", "success", false); } catch(e) { console.error(e); showPersistentMessage("Error al aprobar.", "error", false); }
  }));
  list.querySelectorAll("[data-act='rechazar']").forEach(b => b.addEventListener("click", async (e) => {
    const ced = e.currentTarget.dataset.ced; if (!ced) return;
    if (!confirm("Rechazar este artista?")) return;
    try { await sheetPatchByCedula(ced, { estado: "rechazado", aprobado: "FALSE" }); await adminLoadAndRender(); await reloadAllData(); showPersistentMessage("Artista rechazado.", "info", false); } catch(e) { console.error(e); showPersistentMessage("Error al rechazar.", "error", false); }
  }));
  list.querySelectorAll("[data-act='borrar']").forEach(b => b.addEventListener("click", async (e) => {
    const ced = e.currentTarget.dataset.ced; if (!ced) return;
    if (!confirm("Eliminar registro definitivamente?")) return;
    try { await sheetDeleteByCedula(ced); await adminLoadAndRender(); await reloadAllData(); showPersistentMessage("Registro eliminado.", "info", false); } catch (err) { console.error(err); showPersistentMessage("Error al eliminar.", "error", false); }
  }));
  list.querySelectorAll("[data-act='toggle-edit']").forEach(b => b.addEventListener("click", (e) => {
    const ced = e.currentTarget.dataset.ced; const area = $("#adm-edit-"+ced); if (area) area.style.display = (area.style.display === "none" ? "grid" : "none");
  }));
  list.querySelectorAll("[data-act='guardar']").forEach(b => b.addEventListener("click", async (e) => {
    const ced = e.currentTarget.dataset.ced; await adminSaveEdits(ced);
  }));
  list.querySelectorAll("[data-act='ver-contratos']").forEach(b => b.addEventListener("click", (e) => {
    adminShowContratosForArtist(e.currentTarget.dataset.ced);
  }));
}

function adminArtistRow(a) {
  const estado = (a.estado || (a.aprobado && a.aprobado.toString().toUpperCase()==="TRUE" ? "aprobado" : "pendiente")).toString().toLowerCase();
  const foto = a.fotoResolved || (a.foto && a.foto.startsWith("http") ? a.foto : "https://via.placeholder.com/96x96?text=Sin+foto");
  return `
    <div class="fila-artista" style="display:flex;gap:12px;align-items:flex-start;padding:10px;border-bottom:1px solid rgba(255,255,255,0.02)">
      <img src="${esc(foto)}" alt="${esc(a.nombre_artistico||'Artista')}" style="width:88px;height:88px;border-radius:10px;object-fit:cover;border:1px solid #1f2b46"/>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:800;color:var(--accent)">${esc(a.nombre_artistico||"(sin nombre)")}</div>
            <div class="small-muted">${esc(a.tipo_arte||"")} • ${esc(a.ciudad||"")}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700">${esc(estado.toUpperCase())}</div>
            <div style="margin-top:6px;font-size:.85rem;color:var(--muted)">Céd: ${esc(a.cedula||"")}</div>
          </div>
        </div>
        <div style="margin-top:8px">${esc(a.bio||"")}</div>
        <div style="margin-top:8px">Correo: ${esc(a.correo||"")} • Tel: ${esc(a.celular||"")}</div>

        <div id="adm-edit-${esc(a.cedula||'')}" style="display:none;margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">
          <input data-f="nombre_artistico" value="${esc(a.nombre_artistico||'')}" placeholder="Nombre artístico" />
          <input data-f="ciudad" value="${esc(a.ciudad||'')}" placeholder="Ciudad" />
          <input data-f="tipo_arte" value="${esc(a.tipo_arte||'')}" placeholder="Tipo de arte" />
          <input data-f="p15" value="${esc(a.p15||'')}" placeholder="p15" />
          <input data-f="p30" value="${esc(a.p30||'')}" placeholder="p30" />
          <input data-f="p60" value="${esc(a.p60||'')}" placeholder="p60" />
          <input data-f="p120" value="${esc(a.p120||'')}" placeholder="p120" />
          <input data-f="foto" value="${esc(a.foto||'')}" placeholder="URL foto" />
          <input data-f="video" value="${esc(a.video||'')}" placeholder="YouTube link" />
          <textarea data-f="bio" rows="2" placeholder="Bio">${esc(a.bio||'')}</textarea>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
            <button data-act="guardar" data-ced="${esc(a.cedula||'')}">💾 Guardar</button>
            <button data-act="toggle-edit" data-ced="${esc(a.cedula||'')}">Cerrar</button>
            <button data-act="ver-contratos" data-ced="${esc(a.cedula||'')}">📄 Ver contratos</button>
          </div>
        </div>

      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button data-act="aprobar" data-ced="${esc(a.cedula||'')}">✅ Aprobar</button>
          <button data-act="rechazar" data-ced="${esc(a.cedula||'')}">❌ Rechazar</button>
          <button data-act="borrar" data-ced="${esc(a.cedula||'')}">🗑️ Borrar</button>
          <button data-act="toggle-edit" data-ced="${esc(a.cedula||'')}">✏️ Editar</button>
        </div>
      </div>
    </div>
  `;
}

async function adminSaveEdits(cedula) {
  const area = document.getElementById("adm-edit-" + cedula);
  if (!area) return showPersistentMessage("Área de edición no encontrada", "error", false);
  const payload = {};
  area.querySelectorAll("[data-f]").forEach(i => payload[i.dataset.f] = i.value);
  try {
    await sheetPatchByCedula(cedula, payload);
    await adminLoadAndRender();
    await reloadAllData();
    showPersistentMessage("Cambios guardados.", "success", false);
  } catch (e) {
    console.error(e); showPersistentMessage("Error guardando cambios.", "error", false);
  }
}

/* Admin contracts view */
function adminRenderContratos() {
  const body = $("#admin-body"); if (!body) return;
  body.innerHTML = `
    <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center">
      <input id="adm-contrato-q" placeholder="Buscar por artista, usuario o cédula..." style="flex:1;padding:8px;border-radius:8px;background:#0e1625;border:1px solid #1f2b46;color:#e2e8f0" />
      <select id="adm-contrato-estado">
        <option value="">Todos</option><option value="por confirmar artista">Por confirmar</option><option value="confirmado">Confirmado</option><option value="rechazado">Rechazado</option>
      </select>
    </div>
    <div id="adm-contratos-list"></div>
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

function adminShowContratosForArtist(cedula) {
  const artist = ARTISTAS.find(a => a.cedula === cedula || String(a.id) === cedula);
  if (!artist) return showPersistentMessage("Artista no encontrado", "error", false);
  const body = $("#admin-body"); if (!body) return;
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div><h3 style="margin:0;color:var(--accent)">Contratos de ${esc(artist.nombre_artistico||"")}</h3><div class="small-muted">Céd: ${esc(artist.cedula||"")} • Correo: ${esc(artist.correo||"")}</div></div>
      <div><button id="adm-back-to-artistas" class="secondary">« Volver a Artistas</button></div>
    </div>
    <div id="adm-contratos-artist-list"></div>
  `;
  $("#adm-back-to-artistas").onclick = () => adminRenderArtists();
  const list = $("#adm-contratos-artist-list");
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

/* ====================== MODAL UTILITIES ====================== */
function showModal(innerHtml, opts = {closable:true}) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "overlay-fixed";
  overlay.style.position = "fixed";
  overlay.style.inset = 0;
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.zIndex = 9998;
  overlay.innerHTML = `<div class="modal-card" style="margin:auto;max-width:800px">${innerHtml}</div>`;
  document.getElementById("modal-root")?.appendChild(overlay) || document.body.appendChild(overlay);
  if (opts.closable) overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  return overlay;
}
function closeModal() {
  const root = document.getElementById("modal-root");
  if (root) root.innerHTML = "";
  // also remove any overlay-fixed appended to body
  document.querySelectorAll(".overlay-fixed").forEach(n => n.remove());
}

/* ====================== BOOTSTRAP: INIT ON LOAD ====================== */

async function initApp() {
  // create modal root if missing
  if (!document.getElementById("modal-root")) {
    const mr = document.createElement("div"); mr.id = "modal-root"; document.body.appendChild(mr);
  }
  bindTabs();
  bindAdminSecret();
  bindForms();

  // attach admin close button if exists (#close-admin)
  const closeAdmin = $("#close-admin");
  if (closeAdmin) closeAdmin.onclick = () => { $("#admin").classList.add("hidden"); $("#admin-content").innerHTML = ""; };

  // attach preview for postimages url input if present
  const inputFoto = document.getElementById("foto");
  const alertaFoto = document.getElementById("alerta-foto");
  const preview = document.getElementById("preview-foto");
  if (inputFoto) {
    inputFoto.addEventListener("input", () => {
      const url = inputFoto.value.trim();
      const ok = /^https:\/\/i\.postimg\.cc\/.*\.(jpg|jpeg|png)$/i.test(url);
      if (ok) { if (alertaFoto) { alertaFoto.textContent = "✅ Enlace válido"; alertaFoto.style.color = "#10b981"; } if (preview) { preview.src = url; preview.classList.remove("hidden"); } }
      else if (url.length > 0) { if (alertaFoto) { alertaFoto.textContent = "⚠️ Copia el enlace directo (.jpg/.png)"; alertaFoto.style.color = "#ef4444"; } if (preview) preview.classList.add("hidden"); }
      else { if (alertaFoto) alertaFoto.textContent = ""; if (preview) preview.classList.add("hidden"); }
    });
  }

  // initial load
  await reloadAllData();
  renderFiltros();
  renderCards();
}

// run init when DOM loaded
document.addEventListener("DOMContentLoaded", () => {
  try { initApp(); } catch (e) { console.error("initApp failed", e); }
});

/* ====================== END ====================== */
/* Notas:
 - Si deseas dividir en archivos: data.js (CONFIG + sheet helpers), ui.js (renderers), admin.js (admin functions).
 - Asegúrate que index.html tenga los IDs usados en este script:
   #cards, #f-ciudad, #f-tipo, #q, #form-registro, #form-login-artista, #form-buscar-reserva,
   #msg-registro, #msg-login, #admin, #admin-content, #preview-foto, #alerta-foto, #modal-root
 - El GAS (CONFIG.GAS_URL) debe ofrecer endpoints actions: uploadImage, sendPin, notifyNewBooking; si no, las llamadas fallarán silenciosamente pero el resto funciona.
 - Puedes ajustar estilos y clases en style-v2.css sin tocar la lógica.
*/

