// ========================================================
// 🚀 BANCO DE ARTISTAS - Frontend Limpio y Estable (2025)
// Autor: Johanna / Jordy
// ========================================================

// ======================= CONFIGURACIÓN =======================
const CONFIG = {
  SHEETDB_ENDPOINT: "https://sheetdb.io/api/v1/jaa331n4u5icl", // cambiar si usas otro
  ADMIN_PASSWORD: "Admin2026",
  COMMISSION_USER: 0.10,
  COMMISSION_ARTIST: 0.05,
  BANK: {
    bank: "Banco de Loja",
    account: "2901691001",
    holder: "Jordy Alejandro Torres Quezada",
    id: "1105200057"
  }
};

// ✅ Tu nueva URL de GAS
const GAS_URL = "https://script.google.com/macros/s/AKfycbyjWTTEG60IzzJspv5_9F4_nfjt4BbDHHzdqNFwU_4TPpFhwMM__BFU35twPxJqwsYK/exec";

// ======================= FUNCIONES AUXILIARES =======================
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const uid = (p="A") => p + Math.random().toString(36).slice(2,8).toUpperCase();
const pin6 = () => (""+Math.floor(100000+Math.random()*900000));

async function gas(action, payload={}) {
  try {
    const r = await fetch(GAS_URL, {
      method: 'POST',
      headers: {'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({action, ...payload})
    });
    return await r.json().catch(()=>({ok:false}));
  } catch(e) {
    console.warn("❌ GAS error:", e);
    return {ok:false,error:String(e)};
  }
}

async function sheetGet(){
  const r = await fetch(CONFIG.SHEETDB_ENDPOINT);
  return await r.json();
}
async function sheetPost(row){
  const r = await fetch(CONFIG.SHEETDB_ENDPOINT,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({data:[row]})
  });
  return await r.json();
}

// ======================= VARIABLES GLOBALES =======================
let ARTISTAS = [];
let CONTRATOS = [];

// ======================= CONTROL DE PESTAÑAS =======================
function initTabs(){
  const buttons = $$('nav.tabs button');
  const tabs = $$('.tab');
  buttons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      buttons.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      tabs.forEach(t=>t.classList.remove('active'));
      const target = $('#tab-' + btn.dataset.tab);
      if(target){ target.classList.add('active'); }
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });
}

// ======================= ADMIN SECRETO =======================
let clicks = 0;
$('header h1').addEventListener('click', ()=>{
  clicks++;
  if(clicks>=3){ openAdmin(); }
  setTimeout(()=>clicks=0,1200);
});
document.addEventListener('keydown', e=>{
  if(e.ctrlKey && e.shiftKey && e.key.toLowerCase()==='a'){ openAdmin(); }
});
$('#close-admin').onclick = () => $('#admin').classList.add('hidden');

// ======================= INICIALIZACIÓN =======================
init();
async function init(){
  initTabs();
  await cargarArtistas();
  renderFiltros();
  renderCards();
  bindForms();
}

// ======================= CARGA ARTISTAS =======================
async function cargarArtistas(){
  try{
    ARTISTAS = await sheetGet();
  } catch(e){
    console.error(e);
    ARTISTAS = [];
  }
}

function renderFiltros(){
  const ciudades = [...new Set(ARTISTAS.map(a=>a.ciudad).filter(Boolean))].sort();
  const tipos = [...new Set(ARTISTAS.map(a=>a.tipo_arte).filter(Boolean))].sort();
  const fc = $('#f-ciudad'), ft = $('#f-tipo');
  ciudades.forEach(c=>fc.insertAdjacentHTML('beforeend',`<option>${c}</option>`));
  tipos.forEach(t=>ft.insertAdjacentHTML('beforeend',`<option>${t}</option>`));
  ['q','f-ciudad','f-tipo'].forEach(id=>$('#'+id).addEventListener('input',renderCards));
}

function renderCards(){
  const q = $('#q').value.toLowerCase();
  const fc = $('#f-ciudad').value;
  const ft = $('#f-tipo').value;
  const cont = $('#cards');
  cont.innerHTML = '';

  ARTISTAS.filter(a=>{
    const texto = `${a.nombre_artistico} ${a.ciudad} ${a.tipo_arte}`.toLowerCase();
    const okQ = !q || texto.includes(q);
    const okC = !fc || a.ciudad===fc;
    const okT = !ft || a.tipo_arte===ft;
    return okQ && okC && okT && a.deleted!=="TRUE";
  }).forEach(a=>{
    const vId = (a.video||'').includes('watch?v=') ? a.video.split('watch?v=')[1] : (a.video||'').split('/').pop();
    const iframe = vId ? `<iframe class="video" src="https://www.youtube.com/embed/${vId}" allowfullscreen></iframe>` : '';
    const precios = `
      <span class="badge">15m $${a.p15}</span> 
      <span class="badge">30m $${a.p30}</span> 
      <span class="badge">60m $${a.p60}</span> 
      <span class="badge">120m $${a.p120}</span>`;
    cont.insertAdjacentHTML('beforeend',`
      <article class="card">
        <img src="${a.foto}" alt="${a.nombre_artistico}">
        <h3>${a.nombre_artistico}</h3>
        <div class="small">${a.tipo_arte} • ${a.ciudad}</div>
        <p>${a.bio||''}</p>
        ${iframe}
        <div class="actions">${precios}</div>
        <div class="actions"><button data-id="${a.id}" class="btn-contratar primary">Contratar</button></div>
      </article>`);
  });
  $$('.btn-contratar').forEach(b=>b.onclick=()=>abrirSolicitud(b.dataset.id));
}

// ======================= FORMULARIOS =======================
function bindForms(){
  $('#form-registro').addEventListener('submit', onRegistro);
  $('#form-login-artista').addEventListener('submit', onLoginArtista);
  $('#form-buscar-reserva').addEventListener('submit', onBuscarReserva);
}

async function onRegistro(e){
  e.preventDefault();
  const f = e.target;
  const data = Object.fromEntries(new FormData(f));
  const id = uid('A');
  const pin = pin6();
  const row = {
    id,
    aprobado:"TRUE", rating:"0", votos:"0",
    foto:data.foto, video:data.video,
    nombre_artistico:data.nombre_artistico, nombre_real:data.nombre_real,
    cedula:data.cedula, ciudad:data.ciudad, correo:data.correo, celular:data.celular,
    tipo_arte:data.tipo_arte, p15:data.p15, p30:data.p30, p60:data.p60, p120:data.p120,
    bio:data.bio, pin, deleted:"FALSE"
  };
  try {
    await sheetPost(row);
    $('#msg-registro').textContent = '✅ Registro exitoso. Revisa tu correo para tu PIN.';
    await gas('sendPin', { to:[data.correo], artista:data.nombre_artistico, pin });
    await cargarArtistas(); renderCards(); f.reset();
  } catch(err){
    $('#msg-registro').textContent = '⚠️ Error al registrar.';
  }
}

function abrirSolicitud(artistaId){
  const a = ARTISTAS.find(x=>x.id===artistaId);
  if(!a) return;
  const html = `
    <div class="card">
      <h3>Solicitar a ${a.nombre_artistico}</h3>
      <form id="form-solicitud">
        <label>Tu nombre<input name="usuario_nombre" required></label>
        <label>Tu correo<input type="email" name="usuario_correo" required></label>
        <label>Tu celular<input name="usuario_celular" required></label>
        <label>Ciudad del evento<input name="ciudad_evento" required></label>
        <label>Fecha del evento<input type="date" name="fecha_evento" required></label>
        <label>Duración<select name="duracion"><option>15</option><option>30</option><option>60</option><option>120</option></select></label>
        <label>Mensaje<textarea name="mensaje"></textarea></label>
        <button class="primary" type="submit">Enviar solicitud</button>
        <p id="msg-solicitud" class="msg"></p>
      </form>
    </div>`;
  $('#admin-content').innerHTML = html;
  $('#admin').classList.remove('hidden');
  $('#form-solicitud').onsubmit = async (e)=>{
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const contrato = {
      id: uid('C'),
      artista_id: a.id,
      artista_nombre: a.nombre_artistico,
      artista_correo: a.correo,
      usuario_nombre: fd.usuario_nombre,
      usuario_correo: fd.usuario_correo,
      usuario_celular: fd.usuario_celular,
      ciudad: fd.ciudad_evento,
      fecha: fd.fecha_evento,
      duracion: fd.duracion,
      mensaje: fd.mensaje||'',
      estado:'por confirmar artista'
    };
    CONTRATOS.push(contrato);
    $('#msg-solicitud').textContent = '✅ Solicitud enviada. Espere confirmación.';
    await gas('notifyNewBooking', {
      to:[a.correo],
      artista:a.nombre_artistico,
      fecha:contrato.fecha,
      duracion:contrato.duracion,
      ciudad:contrato.ciudad,
      mensaje:contrato.mensaje
    });
  };
}

async function onLoginArtista(e){
  e.preventDefault();
  const {cedula, pin} = Object.fromEntries(new FormData(e.target));
  const artista = ARTISTAS.find(a=>a.cedula===cedula && a.pin===pin);
  if(!artista){ $('#msg-login').textContent='Datos incorrectos'; return; }
  $('#msg-login').textContent='Bienvenido';
  $('#panel-artista').classList.remove('hidden');
  renderSolicitudesArtista(artista);
}

function renderSolicitudesArtista(artista){
  const cont = $('#solicitudes-artista');
  cont.innerHTML = '';
  CONTRATOS.filter(c=>c.artista_id===artista.id && c.estado==='por confirmar artista').forEach(c=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div><b>${c.usuario_nombre}</b> solicita show de ${c.duracion} min el ${c.fecha} en ${c.ciudad}</div>
      <div class="actions"><button class="primary" onclick="aceptarContrato('${c.id}','${artista.id}')">Aceptar</button></div>
    `;
    cont.appendChild(card);
  });
}

async function onBuscarReserva(e){
  e.preventDefault();
  const correo = new FormData(e.target).get('correo');
  const list = CONTRATOS.filter(c=>c.usuario_correo===correo);
  const cont = $('#reservas-usuario');
  cont.innerHTML = '';
  if(!list.length){ cont.innerHTML = '<div class="card">No se encontraron reservas.</div>'; return; }
  list.forEach(c=>{
    cont.insertAdjacentHTML('beforeend',`
      <div class="card">
        <div><b>${c.artista_nombre}</b> • ${c.fecha} • ${c.ciudad} • ${c.duracion}min</div>
        <div class="small">Estado: ${c.estado}</div>
      </div>`);
  });
}

async function aceptarContrato(cid, artistaId){
  const c = CONTRATOS.find(x=>x.id===cid);
  const artista = ARTISTAS.find(a=>a.id===artistaId);
  if(!c || !artista) return;
  c.estado = 'por validar pago';
  await gas('notifyUserPayment', {
    to:[c.usuario_correo],
    usuario:c.usuario_nombre,
    artista: artista.nombre_artistico,
    banco: CONFIG.BANK.bank,
    cuenta: CONFIG.BANK.account,
    titular: CONFIG.BANK.holder,
    cedula: CONFIG.BANK.id
  });
  await gas('notifyAdminPayment', {
    to:["jordyalejandrot1994@gmail.com"],
    usuario:c.usuario_nombre,
    artista: artista.nombre_artistico
  });
  alert('✅ Solicitud aceptada. El usuario fue notificado para realizar el pago.');
  renderSolicitudesArtista(artista);
}

async function openAdmin(){
  const pass = prompt('Clave de administrador:');
  if(pass!==CONFIG.ADMIN_PASSWORD) return alert('Clave incorrecta');
  $('#admin').classList.remove('hidden');
  renderAdmin();
}

function renderAdmin(){
  const cont = $('#admin-content');
  const pend = CONTRATOS.filter(c=>c.estado==='por validar pago');
  cont.innerHTML = '<h4>Pendientes de validar pago</h4>';
  pend.forEach(c=>{
    cont.insertAdjacentHTML('beforeend',`
      <div class="card">
        <div><b>${c.artista_nombre}</b> ←→ <b>${c.usuario_nombre}</b></div>
        <div class="small">Fecha: ${c.fecha} • ${c.ciudad} • ${c.duracion} min</div>
        <div>Comprobante: ${c.comprobante_url||'—'}</div>
        <div class="actions"><button class="primary" data-id="${c.id}">Marcar como pagado</button></div>
      `);
  });
  $$('#admin-content button.primary').forEach(b=>{
    b.onclick = async ()=>{
      const cid = b.dataset.id;
      const c = CONTRATOS.find(x=>x.id===cid);
      if(!c) return;
      c.estado = 'confirmado';
      const artista = ARTISTAS.find(a=>a.id===c.artista_id);
      await gas('notifyConfirmed', {
        toUser:[c.usuario_correo],
        toArtist:[artista.correo],
        artista_nombre: artista.nombre_artistico,
        artista_correo: artista.correo,
        artista_celular: artista.celular,
        usuario_nombre: c.usuario_nombre,
        usuario_correo: c.usuario_correo,
        usuario_celular: c.usuario_celular
      });
      alert('✅ Contrato confirmado y contactos liberados.');
      renderAdmin();
    };
  });
}
