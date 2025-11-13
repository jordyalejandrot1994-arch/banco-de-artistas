<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0ea5e9" />
  <title>Banco de Artistas</title>
  <style>
/* ===========================
   style-v2.css (incluido)
   Tema oscuro con acento azul
   =========================== */
:root{
  --bg:#0b1220;--panel:#0f172a;--card:#111827;--accent:#0ea5e9;--accent-2:#22d3ee;
  --text:#e2e8f0;--muted:#94a3b8;--radius:14px;--shadow:0 2px 10px rgba(0,0,0,0.4);--transition:all .25s ease;
}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Poppins',system-ui,sans-serif}
body{background:var(--bg);color:var(--text);padding-bottom:80px;overflow-x:hidden}
header{ text-align:center; background:var(--panel); padding:20px 10px; box-shadow:var(--shadow); position:sticky; top:0; z-index:50}
header h1{ color:var(--accent); font-size:1.8rem; font-weight:700; cursor:pointer}
nav.tabs{ display:flex; justify-content:center; flex-wrap:wrap; background:var(--panel); padding:8px; gap:8px; box-shadow:var(--shadow)}
nav.tabs button{ background:transparent; color:var(--text); border:1px solid #1f2b46; border-radius:var(--radius); padding:8px 20px; font-weight:500; cursor:pointer; transition:var(--transition)}
nav.tabs button:hover{ background:var(--accent); color:#fff}
.filters{ display:flex; flex-wrap:wrap; justify-content:center; gap:10px; margin:20px auto; max-width:900px}
.filters input,.filters select{ padding:10px 12px; border-radius:var(--radius); border:1px solid #1f2b46; background:var(--card); color:var(--text); outline:none; transition:var(--transition)}
#cards{ display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:16px; padding:20px; max-width:1200px; margin:auto}
.card{ background:var(--card); border-radius:var(--radius); padding:16px; box-shadow:var(--shadow); transition:var(--transition); position:relative}
.card:hover{ transform:translateY(-4px); box-shadow:0 4px 16px rgba(14,165,233,0.3)}
.card img{ width:100%; height:180px; object-fit:cover; border-radius:var(--radius); border:1px solid #1f2b46; margin-bottom:10px}
.card h3{ color:var(--accent); font-size:1.2rem; margin-bottom:4px}
.card .small{ color:var(--muted); font-size:0.9rem; margin-bottom:8px}
.badge{ display:inline-block; background:var(--accent); color:white; padding:4px 8px; border-radius:8px; font-size:0.8rem; margin:2px}
button.primary{ background:var(--accent); color:white; border:none; border-radius:var(--radius); padding:8px 16px; cursor:pointer; transition:var(--transition); font-weight:600}
button.primary:hover{ background:var(--accent-2)}
button{ background:transparent; border:1px solid #1f2b46; color:var(--text); border-radius:var(--radius); padding:8px 16px; cursor:pointer; transition:var(--transition)}
button:hover{ background:var(--accent); color:#fff}
form{ max-width:700px; margin:20px auto; background:var(--card); padding:20px; border-radius:var(--radius); box-shadow:var(--shadow) }
form label{ display:block; margin-bottom:8px; font-weight:500 }
form input, form textarea, form select{ width:100%; margin-bottom:14px; padding:10px; border-radius:var(--radius); border:1px solid #1f2b46; background:#0e1625; color:var(--text) }
.msg{ color:var(--accent); font-weight:500; text-align:center; margin-top:6px }
#admin{ position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:200 }
#admin.hidden{ display:none }
#admin-content{ background:var(--panel); padding:24px; border-radius:var(--radius); max-width:900px; width:92%; box-shadow:var(--shadow); color:var(--text); max-height:90vh; overflow-y:auto }
#close-admin{ margin-top:10px; background:var(--accent); color:#fff; padding:8px 20px; border-radius:var(--radius); border:none; cursor:pointer; transition:var(--transition)}
.foto-uploader{ background:#111827; border:1px solid var(--accent); border-radius:12px; padding:14px; margin:12px 0 20px}
.foto-uploader .secondary{ background-color:var(--accent); color:white; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:600 }
.preview{ display:block; width:160px; border-radius:10px; margin-top:10px; box-shadow:0 0 6px var(--accent)}
.hidden{ display:none }

/* Admin specifics */
.admin-header{ display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px }
.tabla-admin{ display:flex; flex-direction:column; gap:8px }
.fila-artista{ display:flex; gap:12px; align-items:flex-start; background:#0f172a; padding:10px; border-radius:10px }
.fila-artista img{ width:72px; height:72px; border-radius:8px; object-fit:cover; border:1px solid #1f2b46 }
.fila-info h4{ margin:0 0 4px 0; color:var(--accent) }
.fila-info .meta{ color:var(--muted); font-size:0.9rem; margin-bottom:6px }
.fila-info .bio{ color:var(--text); font-size:0.92rem; margin-bottom:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden }
.area-edit{ margin-top:8px; display:grid; gap:8px; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)) }
.area-edit input, .area-edit textarea{ background:#0e1625; border:1px solid #1f2b46; border-radius:8px; color:#e2e8f0; padding:6px; width:100% }
.estado-pill{ padding:4px 8px; border-radius:999px; font-weight:700; font-size:0.8rem; color:#062a1c; background:#a7f3d0 }

/* modal reservation */
#ba-modal{ position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000; padding:12px }
#ba-modal .modal-card{ background:#0f172a; color:#e2e8f0; border-radius:14px; padding:16px; width:min(92%,680px); max-height:90vh; overflow:auto; box-shadow:0 0 20px rgba(14,165,233,0.35) }
#ba-modal .modal-head{ display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px }

/* responsive */
@media (max-width:700px){
  header h1{ font-size:1.4rem }
  nav.tabs button{ padding:6px 12px; font-size:0.85rem }
  #cards{ grid-template-columns:1fr }
  .fila-artista{ flex-direction:column; align-items:flex-start }
  .fila-actions{ align-items:flex-start }
}

/* small-muted */
.small-muted{ color:var(--muted); font-size:0.95rem; }
  </style>
</head>
<body>
  <header>
    <h1 id="titulo-app">Banco de Artistas</h1>
  </header>

  <nav class="tabs">
    <button data-tab="explorar" class="active">Explorar</button>
    <button data-tab="registrar">Registrar Artista</button>
    <button data-tab="ingresar">Ingresar Artista</button>
    <button data-tab="reservas">Mis Reservas</button>
  </nav>

  <!-- EXPLORAR -->
  <div class="tab active" id="tab-explorar">
    <div class="filters">
      <input id="q" type="text" placeholder="Buscar por nombre, ciudad o tipo...">
      <select id="f-ciudad"><option value="">Todas las ciudades</option></select>
      <select id="f-tipo"><option value="">Todos los tipos</option></select>
    </div>
    <section id="cards"></section>
  </div>

  <!-- REGISTRAR -->
  <div class="tab" id="tab-registrar">
    <form id="form-registro">
      <label>Nombre artístico<input name="nombre_artistico" required></label>
      <label>Nombre real<input name="nombre_real" required></label>
      <label>Cédula<input name="cedula" required></label>
      <label>Ciudad<input name="ciudad" required></label>
      <label>Correo<input type="email" name="correo" required></label>
      <label>Celular<input name="celular" required></label>
      <label>Tipo de arte<input name="tipo_arte" required></label>
      <label>Precio 15 min<input name="p15" required></label>
      <label>Precio 30 min<input name="p30" required></label>
      <label>Precio 60 min<input name="p60" required></label>
      <label>Precio 120 min<input name="p120" required></label>
      <label>Biografía / Descripción<textarea name="bio"></textarea></label>

      <div class="foto-uploader">
        <label>Foto del artista</label>
        <button type="button" class="secondary" onclick="window.open('https://postimages.org/', '_blank')">📸 Subir foto en Postimages</button>
        <p class="hint">1) Se abrirá una pestaña. 2) Sube la foto. 3) Copia el enlace directo que termina en .jpg o .png. 4) Pega aquí.</p>
        <input type="url" id="foto" name="foto" placeholder="Pega aquí el enlace directo de tu imagen" required>
        <p id="alerta-foto" class="alerta"></p>
        <img id="preview-foto" class="preview hidden" alt="Previsualización de la foto">
      </div>

      <label>Video (YouTube)<input name="video" placeholder="https://youtube.com/..."></label>

      <button class="primary" id="btn-registrar" type="submit">Registrar</button>
      <p id="msg-registro" class="msg"></p>
    </form>
  </div>

  <!-- INGRESAR ARTISTA -->
  <div class="tab" id="tab-ingresar">
    <form id="form-login-artista">
      <label>Cédula<input name="cedula" required></label>
      <label>PIN<input name="pin" required></label>
      <button class="primary" type="submit">Ingresar</button>
      <p id="msg-login" class="msg"></p>
    </form>
    <div id="panel-artista" class="hidden">
      <h3>Solicitudes recibidas</h3>
      <div id="solicitudes-artista"></div>
    </div>
  </div>

  <!-- RESERVAS -->
  <div class="tab" id="tab-reservas">
    <form id="form-buscar-reserva">
      <label>Correo con el que hiciste la reserva<input name="correo" type="email" required></label>
      <button class="primary" type="submit">Buscar</button>
    </form>
    <div id="reservas-usuario"></div>
  </div>

  <!-- ADMIN -->
  <div id="admin" class="hidden" aria-hidden="true">
    <div id="admin-content"></div>
    <button id="close-admin">Cerrar</button>
  </div>

  <!-- MODAL RESERVA (se inyecta en JS) -->
  <div id="ba-modal-container"></div>

  <script>
/* =========================================================
   app-clean.js - unificado
   - adaptación completa según tus pedidos
   ========================================================= */

/* CONFIG - mantén tu endpoint */
const CONFIG = {
  SHEETDB_ENDPOINT: "https://sheetdb.io/api/v1/jaa331n4u5icl",
  COMMISSION_USER: 0.10,
  COMMISSION_ARTIST: 0.05,
  ADMIN_PASSWORD: "Admin2026",
  GAS_URL: "https://script.google.com/macros/s/AKfycbyZ27mjG6lnRdvV_MsaOOrr8lD7cN1KDUSaigYeiqVOu8cX_Yw8-xu7QORMhfwyJPvS/exec"
};

/* GAS helper (usa tus webhooks existentes) */
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

/* Helpers DOM */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = (p="A") => p + Math.random().toString(36).slice(2,8).toUpperCase();
const pin6 = () => ("" + Math.floor(100000 + Math.random()*900000));

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

/* Sheet helpers */
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

/* Extras: youtube id, drive id (no usado intensamente) */
function getYouTubeId(url=""){
  if(!url) return "";
  try{
    if(url.includes("youtu.be/")) return url.split("youtu.be/")[1].split(/[?&]/)[0];
    if(url.includes("watch?v=")) return url.split("watch?v=")[1].split("&")[0];
    if(url.includes("/embed/")) return url.split("/embed/")[1].split(/[?&]/)[0];
  }catch(_){}
  return url.split("/").pop().split(/[?&]/)[0];
}
function esc(s){ return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

/* STATE */
let ALL_ROWS = []; // raw
let ARTISTAS = []; // artists only
let CONTRATOS = []; // contracts only

/* UI: tabs */
$$("nav.tabs button").forEach(b => {
  b.addEventListener("click", async () => {
    $$("nav.tabs button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    $$(".tab").forEach(t => t.classList.remove("active"));
    const target = $("#tab-" + b.dataset.tab);
    if (target) target.classList.add("active");
    // refresh when entering certain tabs:
    if (b.dataset.tab === "reservas") {
      await reloadAllData();
      // nothing else; user searches by email
    }
    if (b.dataset.tab === "ingresar") {
      // clear login messages
      $("#msg-login").textContent = "";
      // reload list for artist panel if open later
      await reloadAllData();
    }
    if (b.dataset.tab === "registrar") {
      // no-op
      await reloadAllData();
    }
  });
});

/* SECRET ADMIN ACCESS: 4 taps + Ctrl+Alt+A */
let tapCount = 0, lastTap = 0;
$("#titulo-app").addEventListener("click", ()=>{
  const now = Date.now();
  if (now - lastTap < 700) tapCount++; else tapCount = 1;
  lastTap = now;
  if (tapCount >= 4) { tapCount = 0; openAdmin(); }
});
document.addEventListener("keydown", (e)=>{
  if (e.ctrlKey && e.altKey && (e.key === "a" || e.key === "A")) openAdmin();
});
$("#close-admin").onclick = () => {
  $("#admin").classList.add("hidden");
  $("#admin-content").innerHTML = "";
};

/* INIT */
document.addEventListener("DOMContentLoaded", async ()=>{
  bindLocalUI();
  await reloadAllData();
  renderFiltros();
  renderCards();
});

/* Bind local UI in index.html */
function bindLocalUI(){
  // foto preview & validation
  const inputFoto = document.getElementById("foto");
  const alertaFoto = document.getElementById("alerta-foto");
  const preview = document.getElementById("preview-foto");
  if (inputFoto) {
    inputFoto.addEventListener("input", ()=>{
      const url = inputFoto.value.trim();
      const esValida = /^https:\/\/i\.postimg\.cc\/.*\.(jpg|jpeg|png)$/i.test(url);
      if (esValida) {
        alertaFoto.textContent = "✅ Enlace válido. Imagen lista para subir.";
        alertaFoto.style.color = "#10b981";
        preview.src = url; preview.classList.remove("hidden");
      } else if (url.length > 0) {
        alertaFoto.textContent = "⚠️ El enlace no es válido. Usa el 'Enlace directo' de Postimages (.jpg/.png).";
        alertaFoto.style.color = "#ef4444";
        preview.classList.add("hidden");
      } else {
        alertaFoto.textContent = ""; preview.classList.add("hidden");
      }
    });
  }

  // registration form
  const regForm = document.getElementById("form-registro");
  if (regForm) regForm.addEventListener("submit", onRegistro);

  // login form
  const loginForm = document.getElementById("form-login-artista");
  if (loginForm) loginForm.addEventListener("submit", onLoginArtista);

  // buscar reservas
  const buscarForm = document.getElementById("form-buscar-reserva");
  if (buscarForm) buscarForm.addEventListener("submit", onBuscarReserva);
}

/* RELOAD ALL DATA FROM SHEETDB and separate artists/contracts */
async function reloadAllData(){
  ALL_ROWS = await sheetGet();
  // classify rows: if row.tipo === "contrato" OR has artista_id => contrato
  ARTISTAS = ALL_ROWS.filter(r => {
    const tipo = (r.tipo || "").toString().toLowerCase();
    if (tipo === "contrato") return false;
    if (r.artista_id || r.artista_nombre) return false;
    return true;
  }).map(a => {
    const estado = (a.estado || (a.aprobado && a.aprobado.toString().toUpperCase() === "TRUE" ? "aprobado" : "pendiente")).toString().toLowerCase();
    const fotoResolved = a.foto || "";
    return { ...a, estado, fotoResolved };
  });

  CONTRATOS = ALL_ROWS.filter(r => {
    const tipo = (r.tipo || "").toString().toLowerCase();
    return (tipo === "contrato") || Boolean(r.artista_id || r.artista_nombre);
  }).map(c => ({ ...c }));
  // If admin panel open, refresh it
  const adminOpen = !$("#admin").classList.contains("hidden");
  if (adminOpen) {
    // maintain current admin tab if present
    if ($("#admin-body") && $("#admin-body").dataset && $("#admin-body").dataset.tab === "contratos") {
      adminRenderContratos();
    } else {
      adminRenderArtists();
    }
  }
  // update filters on any reload
  renderFiltros();
}

/* FILTERS */
function renderFiltros(){
  const fc = $("#f-ciudad"), ft = $("#f-tipo");
  if (!fc || !ft) return;
  const ciudades = [...new Set(ARTISTAS.map(a=>a.ciudad).filter(Boolean))].sort();
  const tipos = [...new Set(ARTISTAS.map(a=>a.tipo_arte).filter(Boolean))].sort();
  fc.innerHTML = `<option value="">Todas las ciudades</option>` + ciudades.map(c=>`<option>${esc(c)}</option>`).join("");
  ft.innerHTML = `<option value="">Todos los tipos</option>` + tipos.map(t=>`<option>${esc(t)}</option>`).join("");
  ["q","f-ciudad","f-tipo"].forEach(id => {
    const el = $("#" + id); if (el) el.oninput = renderCards;
  });
}

/* RENDER CARDS (public) - only approved */
function renderCards(){
  const cont = $("#cards"); if (!cont) return;
  const q = ($("#q")?.value || "").toLowerCase();
  const fc = $("#f-ciudad")?.value || "";
  const ft = $("#f-tipo")?.value || "";
  const visibles = ARTISTAS.filter(a=>{
    const okApproved = (a.estado === "aprobado" || (a.aprobado && a.aprobado.toString().toUpperCase()==="TRUE"));
    if (!okApproved) return false;
    const text = `${a.nombre_artistico||""} ${a.ciudad||""} ${a.tipo_arte||""}`.toLowerCase();
    const okQ = !q || text.includes(q);
    const okC = !fc || a.ciudad === fc;
    const okT = !ft || (a.tipo_arte||"").includes(ft);
    return okQ && okC && okT && a.deleted !== "TRUE";
  });
  if (visibles.length === 0) { cont.innerHTML = "<p style='text-align:center;'>No hay artistas aprobados con ese criterio.</p>"; return; }
  cont.innerHTML = visibles.map(a=>{
    const vId = getYouTubeId(a.video||"");
    const iframe = vId ? `<iframe class="video" src="https://www.youtube.com/embed/${vId}" allowfullscreen></iframe>` : "";
    const foto = a.fotoResolved || "https://cdn-icons-png.flaticon.com/512/847/847969.png";
    const precios = `<span class="badge">15m $${a.p15||"-"}</span><span class="badge">30m $${a.p30||"-"}</span><span class="badge">60m $${a.p60||"-"}</span><span class="badge">120m $${a.p120||"-"}</span>`;
    return `
      <article class="card">
        <img src="${esc(foto)}" alt="${esc(a.nombre_artistico||"Artista")}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/847/847969.png';" />
        <h3>${esc(a.nombre_artistico||"")}</h3>
        <div class="small">${esc((a.tipo_arte||"").split(",").map(s=>s.trim()).filter(Boolean).join(" • "))} • ${esc(a.ciudad||"")}</div>
        <p>${esc(a.bio||"")}</p>
        ${iframe}
        <div class="actions">${precios}</div>
        <div class="actions"><button class="primary" onclick="abrirSolicitud('${esc(a.id||a.cedula||"")}')">Contratar</button></div>
      </article>
    `;
  }).join("");
}

/* REGISTRATION - prevent duplicates, show PIN and send email via gas("sendPin") */
let registering = false;
async function onRegistro(e){
  e.preventDefault();
  if (registering) return;
  registering = true;
  const btn = $("#btn-registrar"); if (btn) { btn.disabled = true; btn.textContent = "Enviando..."; }
  const f = e.target;
  const msg = $("#msg-registro");
  if (msg) { msg.textContent = ""; msg.style.color = ""; }
  const data = Object.fromEntries(new FormData(f));
  const foto = (data.foto || "").trim();
  // validate image optional
  if (foto && !/^https:\/\/i\.postimg\.cc\/.*\.(jpg|jpeg|png)$/i.test(foto)) {
    if (msg) { msg.textContent = "⚠️ El enlace de la foto no es válido (Postimages)."; msg.style.color="#ef4444"; }
    registering = false; if (btn) { btn.disabled=false; btn.textContent="Registrar"; } return;
  }
  // generate id & pin
  const id = uid("A"); const pin = pin6();
  const row = {
    id, tipo: "artista", nombre_artistico: data.nombre_artistico||"", nombre_real: data.nombre_real||"",
    cedula: data.cedula||"", ciudad: data.ciudad||"", correo: data.correo||"", celular: data.celular||"", tipo_arte: data.tipo_arte||"",
    p15: data.p15||"", p30: data.p30||"", p60: data.p60||"", p120: data.p120||"", bio: data.bio||"", foto: foto||"", video: data.video||"",
    pin, estado: "pendiente", aprobado: "FALSE", creado_en: new Date().toISOString()
  };
  try {
    await sheetPost(row);
    // show PIN persistently
    if (msg) {
      msg.innerHTML = `✅ Registro enviado. Guarda tu PIN: <b style="color:#10b981">${esc(pin)}</b><br>Hemos enviado un correo con tu PIN.`;
      msg.style.color = "#10b981";
    } else alert(`Registro enviado. PIN: ${pin}`);
    // send email via GAS (you have sendPin)
    try {
      await gas("sendPin", { to: [row.correo], artista: row.nombre_artistico, pin });
    } catch(err) { console.warn("sendPin failed", err); }
    // refresh data
    await reloadAllData();
    f.reset();
    const preview = document.getElementById("preview-foto"); if (preview) preview.classList.add("hidden");
    const alerta = document.getElementById("alerta-foto"); if (alerta) alerta.textContent="";
  } catch (err) {
    console.error("registro error", err);
    if (msg) { msg.textContent = "❌ Error al registrar. Intenta nuevamente."; msg.style.color="#ef4444"; }
  } finally {
    registering = false;
    if (btn) { btn.disabled = false; btn.textContent = "Registrar"; }
  }
}

/* LOGIN ARTISTA */
async function onLoginArtista(e){
  e.preventDefault();
  const f = e.target; const ced = f.cedula.value.trim(); const pin = f.pin.value.trim();
  const rows = await sheetGet();
  const found = rows.find(r => (r.cedula||"") === ced && (r.pin||"") === pin);
  if (found) {
    $("#msg-login").textContent = "✅ Ingreso correcto. Panel de artista abierto.";
    $("#msg-login").style.color = "#10b981";
    const panel = $("#panel-artista"); if (panel) { panel.classList.remove("hidden"); loadSolicitudesForArtist(found); }
  } else {
    $("#msg-login").textContent = "❌ Cédula o PIN incorrectos.";
    $("#msg-login").style.color = "#ef4444";
  }
}

/* BUSCAR RESERVA */
async function onBuscarReserva(e){
  e.preventDefault();
  const correo = e.target.correo.value.trim().toLowerCase();
  const target = $("#reservas-usuario");
  if (!target) return;
  await reloadAllData();
  const matches = CONTRATOS.filter(c => (c.usuario_correo||"").toLowerCase() === correo);
  if (matches.length === 0) { target.innerHTML = `<p style="text-align:center;">No se encontraron reservas para ${esc(correo)}.</p>`; return; }
  target.innerHTML = matches.map(c=>`
    <div class="card">
      <h3>${esc(c.artista_nombre||"Artista")}</h3>
      <p class="small">${esc(c.ciudad||"")} • ${esc(c.fecha||"")} ${esc(c.hora||"")}</p>
      <p>${esc(c.mensaje||"")}</p>
      <p class="small-muted">Estado: ${esc(c.estado||"")}</p>
    </div>
  `).join("");
}

/* ABRIR SOLICITUD (modal) - includes hora field */
async function abrirSolicitud(artistaId){
  await reloadAllData();
  const a = ARTISTAS.find(x => String(x.id) === String(artistaId) || String(x.cedula) === String(artistaId));
  if (!a) return alert("Artista no encontrado.");
  // create modal container
  let modal = document.getElementById("ba-modal");
  if (!modal) {
    modal = document.createElement("div"); modal.id = "ba-modal"; modal.innerHTML = ""; document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head"><h3>Solicitar a ${esc(a.nombre_artistico||"Artista")}</h3><button id="ba-close" class="modal-close">Cerrar</button></div>
      <form id="form-solicitud" class="modal-body">
        <label>Tu nombre<input name="usuario_nombre" required></label>
        <label>Tu correo<input type="email" name="usuario_correo" required></label>
        <label>Tu celular<input name="usuario_celular" required></label>
        <label>Ciudad del evento<input name="ciudad_evento" required></label>
        <label>Fecha del evento<input type="date" name="fecha_evento" required></label>
        <label>Hora de presentación<input type="time" name="hora_evento" required></label>
        <label>Duración<select name="duracion" id="duracion"><option value="15">15 minutos</option><option value="30" selected>30 minutos</option><option value="60">60 minutos</option><option value="120">120 minutos</option></select></label>
        <p id="precioTotal" class="modal-total"></p>
        <label>Mensaje<textarea name="mensaje" rows="2" placeholder="Detalles del evento..."></textarea></label>
        <div class="actions"><button class="primary" type="submit">Enviar solicitud</button></div>
        <p id="msg-solicitud" class="msg"></p>
      </form>
    </div>
  `;
  Object.assign(modal.style, { position:"fixed", inset:"0", background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:"1000", padding:"12px" });
  Object.assign(modal.querySelector(".modal-card").style, { background:"#0f172a", color:"#e2e8f0", borderRadius:"14px", padding:"16px", width:"min(94%,720px)", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 0 20px rgba(14,165,233,0.25)" });

  modal.querySelector("#ba-close").addEventListener("click", ()=> modal.remove());

  const durSel = modal.querySelector("#duracion");
  const precioEl = modal.querySelector("#precioTotal");
  const precioCalc = (dur)=>{ const base = parseFloat(a[`p${dur}`]||"0")||0; const total = base * (1 + CONFIG.COMMISSION_USER); return {base, total: total.toFixed(2)}; };
  const p0 = precioCalc(durSel.value); precioEl.innerHTML = `Valor total a pagar: <b>$${p0.total}</b>`;
  durSel.addEventListener("change",(e)=>{ const p = precioCalc(e.target.value); precioEl.innerHTML = `Valor total a pagar: <b>$${p.total}</b>`; });

  modal.querySelector("#form-solicitud").onsubmit = async (ev)=>{
    ev.preventDefault();
    const fd = Object.fromEntries(new FormData(ev.target));
    const contratoId = uid("C");
    const dur = fd.duracion; const base = parseFloat(a[`p${dur}`]||"0")||0; const total = (base*(1+CONFIG.COMMISSION_USER)).toFixed(2);
    const contratoRow = {
      id: contratoId, tipo: "contrato", artista_id: a.id||a.cedula||"", artista_nombre: a.nombre_artistico||"", artista_correo: a.correo||"",
      usuario_nombre: fd.usuario_nombre||"", usuario_correo: fd.usuario_correo||"", usuario_celular: fd.usuario_celular||"",
      ciudad: fd.ciudad_evento||"", fecha: fd.fecha_evento||"", hora: fd.hora_evento||"", duracion: dur, mensaje: fd.mensaje||"",
      estado: "por confirmar artista", comprobante_url: "", precio_total: total, creado_en: new Date().toISOString()
    };
    try {
      await sheetPost(contratoRow);
      CONTRATOS.push(contratoRow);
      // notify artist via GAS
      try { await gas("notifyNewBooking", { to:[contratoRow.artista_correo], artista:contratoRow.artista_nombre, fecha:contratoRow.fecha, hora:contratoRow.hora, duracion:contratoRow.duracion, ciudad:contratoRow.ciudad, mensaje:contratoRow.mensaje }); } catch(e){ console.warn("notify failed", e); }
      // show persistent message (does not auto-hide)
      const msg = modal.querySelector("#msg-solicitud");
      if (msg) {
        msg.innerHTML = `✅ Tu contrato fue generado con éxito. Debes esperar la confirmación del artista y estar atento al correo registrado: <b>${esc(contratoRow.usuario_correo)}</b>.`;
        msg.style.color = "#10b981";
      } else alert("Tu contrato fue generado con éxito. Revisa tu correo.");
      // refresh data globally
      await reloadAllData();
      // DO NOT auto-close — keep message until user closes
      // But we can optionally clear form or disable submit
      ev.target.querySelector("button[type=submit]").disabled = true;
    } catch (err) {
      console.error("error saving contract", err);
      const msg = modal.querySelector("#msg-solicitud");
      if (msg) { msg.textContent = "❌ Error al generar el contrato. Intenta nuevamente."; msg.style.color = "#ef4444"; } else alert("Error al generar contrato.");
    }
  };
}

/* ARTIST PANEL: load solicitudes for artist after login */
async function loadSolicitudesForArtist(artistRow){
  const panel = $("#panel-artista"); if (!panel) return;
  await reloadAllData();
  const rows = CONTRATOS.filter(c => String(c.artista_id) === String(artistRow.id) || String(c.artista_id) === String(artistRow.cedula) || (c.artista_correo && c.artista_correo === artistRow.correo));
  if (rows.length === 0) panel.innerHTML = `<p class="small-muted">No hay solicitudes aún.</p>`;
  else panel.innerHTML = rows.map(c=>`
    <div class="card">
      <h4>${esc(c.usuario_nombre||"")}</h4>
      <p class="small">${esc(c.ciudad||"")} • ${esc(c.fecha||"")} ${esc(c.hora||"")}</p>
      <p>${esc(c.mensaje||"")}</p>
      <p class="small-muted">Estado: ${esc(c.estado||"")}</p>
      <div style="margin-top:6px;">
        <button data-id="${esc(c.id||"")}" class="btn-aceptar">Aceptar</button>
        <button data-id="${esc(c.id||"")}" class="btn-rechazar">Rechazar</button>
      </div>
    </div>
  `).join("");
  // attach accept/reject
  panel.querySelectorAll(".btn-aceptar").forEach(b => b.addEventListener("click", async (ev)=>{
    const id = ev.currentTarget.dataset.id;
    if (!confirm("¿Confirmar este contrato?")) return;
    try {
      await fetch(`${CONFIG.SHEETDB_ENDPOINT}/id/${encodeURIComponent(id)}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ data:[{ estado:"confirmado" }] }) });
      await reloadAllData(); loadSolicitudesForArtist(artistRow); alert("✅ Contrato confirmado.");
    } catch(e){ console.error(e); alert("Error al confirmar."); }
  }));
  panel.querySelectorAll(".btn-rechazar").forEach(b => b.addEventListener("click", async (ev)=>{
    const id = ev.currentTarget.dataset.id;
    if (!confirm("¿Rechazar este contrato?")) return;
    try {
      await fetch(`${CONFIG.SHEETDB_ENDPOINT}/id/${encodeURIComponent(id)}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ data:[{ estado:"rechazado" }] }) });
      await reloadAllData(); loadSolicitudesForArtist(artistRow); alert("✅ Contrato rechazado.");
    } catch(e){ console.error(e); alert("Error al rechazar."); }
  }));
}

/* ADMIN PANEL - open / render */
function openAdmin(){
  const pass = prompt("🔒 Ingrese contraseña de administrador:");
  if (pass !== CONFIG.ADMIN_PASSWORD) { if (pass) alert("❌ Contraseña incorrecta."); return; }
  $("#admin").classList.remove("hidden");
  renderAdminShell();
  adminLoadAndRender();
}
function renderAdminShell(){
  const root = $("#admin-content"); if (!root) return;
  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
      <h3 style="margin:0;color:#0ea5e9;">Panel de Administración</h3>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="admin-tab-artistas">🎭 Artistas</button>
        <button id="admin-tab-contratos">📄 Contratos</button>
        <button id="admin-refresh">🔄 Recargar</button>
        <button id="admin-back">⬅️ Atrás</button>
      </div>
    </div>
    <div id="admin-body" data-tab="artistas" style="margin-top:12px;"></div>
  `;
  $("#admin-tab-artistas").onclick = ()=>{ $("#admin-body").dataset.tab="artistas"; adminRenderArtists(); };
  $("#admin-tab-contratos").onclick = ()=>{ $("#admin-body").dataset.tab="contratos"; adminRenderContratos(); };
  $("#admin-refresh").onclick = adminLoadAndRender;
  $("#admin-back").onclick = ()=>{ $("#admin").classList.add("hidden"); $("#admin-content").innerHTML = ""; };
}

async function adminLoadAndRender(){
  await reloadAllData();
  adminRenderArtists();
}

/* ADMIN: render artists full */
function adminRenderArtists(){
  const body = $("#admin-body"); if (!body) return;
  body.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
      <input id="adm-q" placeholder="Buscar por nombre, ciudad o cédula..." style="flex:1;padding:8px;border-radius:8px;background:#0e1625;border:1px solid #1f2b46;color:#e2e8f0;">
      <select id="adm-estado" style="padding:8px;border-radius:8px;background:#0e1625;border:1px solid #1f2b46;color:#e2e8f0;">
        <option value="">Todos</option><option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option>
      </select>
    </div>
    <div id="adm-list" class="tabla-admin"></div>
  `;
  $("#adm-q").oninput = adminRenderArtistsList;
  $("#adm-estado").onchange = adminRenderArtistsList;
  adminRenderArtistsList();
}
function adminRenderArtistsList(){
  const list = $("#adm-list"); if (!list) return;
  const q = ($("#adm-q")?.value || "").toLowerCase();
  const estadoFiltro = ($("#adm-estado")?.value || "").toLowerCase();
  const rows = ARTISTAS.filter(a=>{
    const hay = `${a.nombre_artistico||""} ${a.ciudad||""} ${a.cedula||""}`.toLowerCase();
    const matchQ = !q || hay.includes(q);
    const estado = (a.estado||"pendiente").toLowerCase();
    const matchE = !estadoFiltro || estado === estadoFiltro;
    return matchQ && matchE;
  });
  if (rows.length === 0) { list.innerHTML = `<p class="small-muted">No hay artistas para mostrar</p>`; return; }
  list.innerHTML = rows.map(a=>renderAdminArtistRow(a)).join("");
  // attach events
  list.querySelectorAll("[data-act='aprobar']").forEach(b=>b.addEventListener("click", e=>adminSetEstado(e.currentTarget.dataset.ced, "aprobado", true)));
  list.querySelectorAll("[data-act='rechazar']").forEach(b=>b.addEventListener("click", e=>adminSetEstado(e.currentTarget.dataset.ced, "rechazado", false)));
  list.querySelectorAll("[data-act='borrar']").forEach(b=>b.addEventListener("click", e=>adminDelete(e.currentTarget.dataset.ced)));
  list.querySelectorAll("[data-act='toggle-edit']").forEach(b=>b.addEventListener("click", e=>{
    const ced = e.currentTarget.dataset.ced; const area = $("#adm-edit-"+ced); if (area) area.style.display = (area.style.display==="none"?"grid":"none");
  }));
  list.querySelectorAll("[data-act='guardar']").forEach(b=>b.addEventListener("click", e=>adminSaveEdits(e.currentTarget.dataset.ced)));
  list.querySelectorAll("[data-act='ver-contratos']").forEach(b=>b.addEventListener("click", e=>adminShowContratosForArtist(e.currentTarget.dataset.ced)));
}
function renderAdminArtistRow(a){
  const estado = (a.estado || (a.aprobado?"aprobado":"pendiente")).toLowerCase();
  const pill = estado==="aprobado"? "background:#a7f3d0;color:#064e3b;padding:4px 8px;border-radius:999px;font-weight:700;"
             : estado==="rechazado"? "background:#fecaca;color:#7f1d1d;padding:4px 8px;border-radius:999px;font-weight:700;"
             : "background:#fde68a;color:#92400e;padding:4px 8px;border-radius:999px;font-weight:700;";
  const foto = a.fotoResolved || (a.foto && a.foto.startsWith("http")?a.foto:"https://via.placeholder.com/96x96?text=Sin+foto");
  return `
    <div class="fila-artista">
      <img src="${esc(foto)}" alt="${esc(a.nombre_artistico||"Artista")}" />
      <div class="fila-info">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700;color:#0ea5e9">${esc(a.nombre_artistico||"(sin nombre)")}</div>
            <div class="meta">${esc(a.tipo_arte||"")} • ${esc(a.ciudad||"")}</div>
          </div>
          <div style="text-align:right">
            <div style="${pill}">${esc(estado.toUpperCase())}</div>
            <div style="margin-top:8px;font-size:0.85rem;color:#94a3b8">Céd: ${esc(a.cedula||"")}</div>
          </div>
        </div>
        <div style="margin-top:8px;color:#e2e8f0">${esc(a.bio||"")}</div>
        <div style="margin-top:8px;color:#e2e8f0;font-size:0.9rem">
          <div><b>Correo:</b> ${esc(a.correo||"")}</div>
          <div><b>Celular:</b> ${esc(a.celular||"")}</div>
          <div><b>PIN:</b> ${esc(a.pin||"---")}</div>
          <div style="margin-top:6px;">Precios: 15m $${esc(a.p15||"-")} • 30m $${esc(a.p30||"-")} • 60m $${esc(a.p60||"-")}</div>
        </div>

        <div id="adm-edit-${esc(a.cedula||"")}" class="area-edit" style="display:none;margin-top:8px;">
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

/* ADMIN actions */
async function adminSetEstado(cedula, estado, aprobarFlag){
  if(!cedula) return alert("Registro sin cédula");
  if(!confirm(`Cambiar a ${estado.toUpperCase()} la cédula ${cedula}?`)) return;
  try {
    await sheetPatchByCedula(cedula, { estado, aprobado: aprobarFlag ? "TRUE" : "FALSE" });
    await adminLoadAndRender();
    await reloadAllData();
    alert("✅ Estado actualizado.");
  } catch(e){ console.error(e); alert("❌ Error al actualizar.") }
}
async function adminDelete(cedula){
  if(!cedula) return alert("Registro sin cédula");
  if(!confirm(`Eliminar definitivamente la cédula ${cedula}?`)) return;
  try {
    await sheetDeleteByCedula(cedula);
    await adminLoadAndRender();
    await reloadAllData();
    alert("🗑️ Registro eliminado.");
  } catch(e){ console.error(e); alert("❌ Error al eliminar.") }
}
async function adminSaveEdits(cedula){
  const area = document.getElementById("adm-edit-"+cedula);
  if(!area) return alert("Área de edición no encontrada");
  const payload = {};
  area.querySelectorAll("[data-f]").forEach(i=>payload[i.dataset.f]=i.value);
  try {
    await sheetPatchByCedula(cedula, payload);
    await adminLoadAndRender();
    await reloadAllData();
    alert("💾 Cambios guardados.");
  } catch(e){ console.error(e); alert("❌ Error guardando cambios.") }
}

/* ADMIN contracts view */
function adminRenderContratos(){
  const body = $("#admin-body"); if (!body) return;
  body.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
      <input id="adm-contrato-q" placeholder="Buscar por artista, usuario o cédula..." style="flex:1;padding:8px;border-radius:8px;background:#0e1625;border:1px solid #1f2b46;color:#e2e8f0;">
      <select id="adm-contrato-estado" style="padding:8px;border-radius:8px;background:#0e1625;border:1px solid #1f2b46;color:#e2e8f0;">
        <option value="">Todos</option><option value="por confirmar artista">Por confirmar artista</option><option value="confirmado">Confirmado</option><option value="rechazado">Rechazado</option>
      </select>
    </div>
    <div id="adm-contratos-list"></div>
  `;
  $("#adm-contrato-q").oninput = adminRenderContratosList;
  $("#adm-contrato-estado").onchange = adminRenderContratosList;
  adminRenderContratosList();
}
function adminRenderContratosList(){
  const list = $("#adm-contratos-list"); if(!list) return;
  const q = ($("#adm-contrato-q")?.value || "").toLowerCase();
  const est = ($("#adm-contrato-estado")?.value || "").toLowerCase();
  const rows = CONTRATOS.filter(c=>{
    const hay = `${c.artista_nombre||""} ${c.usuario_nombre||""} ${c.artista_id||""} ${c.usuario_correo||""}`.toLowerCase();
    const okQ = !q || hay.includes(q);
    const estado = (c.estado||"").toLowerCase();
    const okE = !est || estado === est;
    return okQ && okE;
  });
  if (rows.length === 0) { list.innerHTML = `<p class="small-muted">No hay contratos.</p>`; return; }
  list.innerHTML = rows.map(c=>`
    <div class="card">
      <h3>${esc(c.artista_nombre||"Artista")}</h3>
      <p class="small">${esc(c.ciudad||"")} • ${esc(c.fecha||"")} ${esc(c.hora||"")} • Duración: ${esc(c.duracion||"")}</p>
      <p>${esc(c.mensaje||"")}</p>
      <p class="small-muted">Usuario: ${esc(c.usuario_nombre||"")} • ${esc(c.usuario_correo||"")} • Tel: ${esc(c.usuario_celular||"")}</p>
      <p class="small-muted">Estado: ${esc(c.estado||"")}</p>
    </div>
  `).join("");
}

/* admin show contratos per artist */
function adminShowContratosForArtist(cedula){
  const artist = ARTISTAS.find(a => a.cedula === cedula || String(a.id) === cedula);
  if (!artist) return alert("Artista no encontrado");
  const body = $("#admin-body"); if(!body) return;
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div><h3 style="margin:0;color:#0ea5e9;">Contratos de ${esc(artist.nombre_artistico||"")}</h3><div class="small-muted">Céd: ${esc(artist.cedula||"")} • Correo: ${esc(artist.correo||"")}</div></div>
      <div><button id="adm-back-to-artistas">« Volver a Artistas</button></div>
    </div>
    <div id="adm-contratos-artist-list"></div>
  `;
  $("#adm-back-to-artistas").onclick = ()=> adminRenderArtists();
  const list = $("#adm-contratos-artist-list");
  const rows = CONTRATOS.filter(c => String(c.artista_id) === String(artist.id) || String(c.artista_id) === String(artist.cedula) || (c.artista_correo && c.artista_correo === artist.correo));
  if (rows.length === 0) list.innerHTML = `<p class="small-muted">No hay contratos para este artista.</p>`;
  else list.innerHTML = rows.map(c=>`
    <div class="card">
      <h4>${esc(c.usuario_nombre||"Usuario")}</h4>
      <p class="small">${esc(c.ciudad||"")} • ${esc(c.fecha||"")} ${esc(c.hora||"")}</p>
      <p>${esc(c.mensaje||"")}</p>
      <p class="small-muted">Estado: ${esc(c.estado||"")}</p>
      <p class="small-muted">Contacto: ${esc(c.usuario_correo||"")} • ${esc(c.usuario_celular||"")}</p>
    </div>
  `).join("");
}

/* Utility: avoid duplicate submissions is implemented in registration by disabling button */

/* END of script */
  </script>
</body>
</html>
