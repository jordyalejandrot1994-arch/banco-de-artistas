// ========================================================
// 🚀 BANCO DE ARTISTAS - Frontend con Drive (2025)
// Autor: Johanna / Jordy
// ========================================================

// ======================= CONFIGURACIÓN =======================
const CONFIG = {
  SHEETDB_ENDPOINT: "https://sheetdb.io/api/v1/jaa331n4u5icl",
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

// ✅ TU URL DE GAS ACTUAL
const GAS_URL = "https://script.google.com/macros/s/AKfycbyjWTTEG60IzzJspv5_9F4_nfjt4BbDHHzdqNFwU_4TPpFhwMM__BFU35twPxJqwsYK/exec";

// ======================= HELPERS =======================
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
async function sheetPatch(id, data){
  const url = `${CONFIG.SHEETDB_ENDPOINT}/id/${encodeURIComponent(id)}`;
  const r = await fetch(url,{
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({data})
  });
  return await r.json();
}

function fileToBase64(file){
  return new Promise((res,rej)=>{
    const fr = new FileReader();
    fr.onload = () => res(fr.result.split(',')[1]); // quitar header
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

async function uploadToDrive(file, folder){
  try{
    const base64 = await fileToBase64(file);
    const resp = await gas('uploadImage', {
      folder, // "artists" | "proofs"
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64
    });
    if(!resp?.ok) throw new Error(resp?.error || 'Error subiendo a Drive');
    return resp.url; // URL pública devuelta por GAS
  }catch(e){
    alert('No se pudo subir el archivo a Drive. Verifica la función uploadImage en tu Apps Script.');
    throw e;
  }
}

// ======================= ESTADO =======================
let ARTISTAS = [];
let CONTRATOS = []; // en memoria; puedes llevarlo a una hoja separada si quieres persistir

// ======================= TABS =======================
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
  enhanceRegistroUI();      // ⬅️ inyecta file input y checkboxes
  await cargarArtistas();
  renderFiltros();
  renderCards();
  bindForms();
}

// ======================= MEJORA UI REGISTRO =======================
function enhanceRegistroUI(){
  // 1) Reemplazar campo "Foto (URL)" por input file + preview + hidden url
  const form = $('#form-registro');
  if(!form) return;

  // Si no existe el input oculto para URL, lo creamos
  let urlInput = form.querySelector('input[name="foto"]');
  if(!urlInput){
    urlInput = document.createElement('input');
    urlInput.setAttribute('name','foto');
    urlInput.type = 'hidden';
    form.appendChild(urlInput);
  }

  // Insertar file input visual antes de urlInput
  const fileWrap = document.createElement('label');
  fileWrap.innerHTML = `Foto (subir imagen)<input id="foto_file" type="file" accept="image/*" />`;
  urlInput.parentElement ? urlInput.parentElement.before(fileWrap) : form.insertBefore(fileWrap, form.firstChild);

  // Preview
  const prev = document.createElement('div');
  prev.className = 'small';
  prev.textContent = 'Sin imagen seleccionada.';
  fileWrap.after(prev);

  $('#foto_file')?.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    prev.textContent = 'Subiendo imagen a Drive...';
    try{
      const url = await uploadToDrive(file, 'artists');
      urlInput.value = url;
      prev.innerHTML = `Imagen subida ✅<br><a href="${url}" target="_blank">Ver imagen</a>`;
    }catch(err){
      prev.textContent = 'Error subiendo imagen.';
    }
  });

  // 2) Reemplazar "Tipo de arte" (input) por checkboxes múltiples
  let tipoLabel = [...form.querySelectorAll('label')].find(l=>l.textContent.toLowerCase().includes('tipo de arte'));
  if(tipoLabel){
    const chk = document.createElement('div');
    chk.style.margin = '8px 0';
    chk.innerHTML = `
      <div class="small" style="margin-bottom:6px;">Selecciona uno o varios:</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px;">
        ${[
          'Cantante','Grupo musical','Bailarín','Grupo de baile',
          'Animador','DJ','Cómico','Teatro'
        ].map(v=>`<label style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" class="tipo-multi" value="${v}">
          <span>${v}</span>
        </label>`).join('')}
      </div>
    `;
    // Reemplazar el input anterior (si lo hay) por el grupo
    const oldInput = tipoLabel.querySelector('input[name="tipo_arte"]');
    if(oldInput) oldInput.remove();
    tipoLabel.appendChild(chk);
  }
}

// ======================= CARGA Y RENDER =======================
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
  const tiposSet = new Set();
  ARTISTAS.forEach(a=>{
    (a.tipo_arte||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(t=>tiposSet.add(t));
  });
  const tipos = [...tiposSet].sort();

  const fc = $('#f-ciudad'), ft = $('#f-tipo');
  fc.innerHTML = `<option value="">Todas las ciudades</option>`;
  ft.innerHTML = `<option value="">Todos los tipos</option>`;
  ciudades.forEach(c=>fc.insertAdjacentHTML('beforeend',`<option>${c}</option>`));
  tipos.forEach(t=>ft.insertAdjacentHTML('beforeend',`<option>${t}</option>`));
  ['q','f-ciudad','f-tipo'].forEach(id=>$('#'+id).addEventListener('input',renderCards));
}

function renderCards(){
  const q = ($('#q')?.value||'').toLowerCase();
  const fc = $('#f-ciudad')?.value||''; 
  const ft = $('#f-tipo')?.value||'';
  const cont = $('#cards');
  cont.innerHTML = '';

  ARTISTAS.filter(a=>{
    const texto = `${a.nombre_artistico||''} ${a.ciudad||''} ${(a.tipo_arte||'')}`.toLowerCase();
    const okQ = !q || texto.includes(q);
    const okC = !fc || a.ciudad===fc;
    const okT = !ft || (a.tipo_arte||'').split(',').map(s=>s.trim()).includes(ft);
    return okQ && okC && okT && a.deleted!=="TRUE";
  }).forEach(a=>{
    const vId = (a.video||'').includes('watch?v=') ? a.video.split('watch?v=')[1] : (a.video||'').split('/').pop();
    const iframe = vId ? `<iframe class="video" src="https://www.youtube.com/embed/${vId}" allowfullscreen></iframe>` : '';
    const precios = `
      <span class="badge">15m $${a.p15||'-'}</span> 
      <span class="badge">30m $${a.p30||'-'}</span> 
      <span class="badge">60m $${a.p60||'-'}</span> 
      <span class="badge">120m $${a.p120||'-'}</span>
    `;
    const stars = renderStarsDisplay(Number(a.rating||0));

    cont.insertAdjacentHTML('beforeend',`
      <article class="card">
        <img src="${a.foto||''}" alt="${a.nombre_artistico||''}">
        <h3>${a.nombre_artistico||''}</h3>
        <div class="small">${(a.tipo_arte||'').split(',').map(s=>s.trim()).filter(Boolean).join(' • ')} • ${a.ciudad||''}</div>
        <div class="small">${stars} <span style="margin-left:6px;color:#94a3b8;">(${a.votos||0})</span></div>
        <p>${a.bio||''}</p>
        ${iframe}
        <div class="actions">${precios}</div>
        <div class="actions"><button data-id="${a.id}" class="btn-contratar primary">Contratar</button></div>
      </article>`);
  });
  $$('.btn-contratar').forEach(b=>b.onclick=()=>abrirSolicitud(b.dataset.id));
}

function renderStarsDisplay(avg){
  // avg 0..5 ⇒ retorna 5 estrellas (★/☆) con medios como ★☆
  const rounded = Math.round((avg||0)*2)/2; // pasos de 0.5
  let out = '';
  for(let i=1;i<=5;i++){
    if(rounded >= i) out += '★';
    else if(rounded >= i-0.5) out += '☆'; // medio (usamos ☆ para marcar medio de forma simple)
    else out += '☆';
  }
  return `<span style="color:#fbbf24;font-size:1.1rem;letter-spacing:1px;">${out}</span>`;
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

  // tipo_arte desde checkboxes múltiples
  const selected = $$('.tipo-multi:checked', f).map(x=>x.value);
  const tipo_arte = selected.length ? selected.join(', ') : (data.tipo_arte || '');

  const id = uid('A');
  const pin = pin6();

  const row = {
    id,
    aprobado:"TRUE", rating: (0).toString(), votos: (0).toString(),
    foto: data.foto, // ya set por uploadToDrive si usó file
    video: data.video,
    nombre_artistico:data.nombre_artistico, nombre_real:data.nombre_real,
    cedula:data.cedula, ciudad:data.ciudad, correo:data.correo, celular:data.celular,
    tipo_arte, p15:data.p15, p30:data.p30, p60:data.p60, p120:data.p120,
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

// ======================= SOLICITUD DE CONTRATACIÓN =======================
function abrirSolicitud(artistaId){
  const a = ARTISTAS.find(x=>x.id===artistaId);
  if(!a) return;

  // precio dinámico por duración
  const precio = (mins)=>{
    const key = mins==='15'?'p15':mins==='30'?'p30':mins==='60'?'p60':'p120';
    const val = Number(a[key]||0);
    return isNaN(val)?0:val;
  };

  const html = `
    <div class="card" style="max-height:80vh;overflow:auto;">
      <h3>Solicitar a ${a.nombre_artistico}</h3>
      <form id="form-solicitud">
        <label>Tu nombre<input name="usuario_nombre" required></label>
        <label>Tu correo<input type="email" name="usuario_correo" required></label>
        <label>Tu celular<input name="usuario_celular" required></label>
        <label>Ciudad del evento<input name="ciudad_evento" required></label>
        <label>Fecha del evento<input type="date" name="fecha_evento" required></label>

        <label>Duración
          <select name="duracion" id="duracion_sel">
            <option value="15">15</option>
            <option value="30">30</option>
            <option value="60">60</option>
            <option value="120">120</option>
          </select>
        </label>

        <div id="total_pago" class="small" style="margin:6px 0 10px 0;">
          💰 Total a pagar: $${precio('15').toFixed(2)}
        </div>

        <label>Mensaje<textarea name="mensaje" rows="2" placeholder="Detalles del evento..."></textarea></label>
        <button class="primary" type="submit">Enviar solicitud</button>
        <p id="msg-solicitud" class="msg"></p>
      </form>
    </div>`;

  $('#admin-content').innerHTML = html;
  $('#admin').classList.remove('hidden');

  const durSel = $('#duracion_sel');
  const totalLbl = $('#total_pago');
  durSel.addEventListener('change',()=>{
    totalLbl.textContent = `💰 Total a pagar: $${precio(durSel.value).toFixed(2)}`;
  });

  $('#form-solicitud').onsubmit = async (e)=>{
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const contrato = {
      id: uid('C'),
      artista_id:a.id,
      artista_nombre:a.nombre_artistico,
      artista_correo:a.correo,
      usuario_nombre:fd.usuario_nombre,
      usuario_correo:fd.usuario_correo,
      usuario_celular:fd.usuario_celular,
      ciudad:fd.ciudad_evento,
      fecha:fd.fecha_evento,
      duracion:fd.duracion,
      precio: precio(fd.duracion),
      mensaje: fd.mensaje||'',
      estado:'por confirmar artista',
      comprobante_url:'',
      calificado:false
    };
    CONTRATOS.push(contrato);
    $('#msg-solicitud').textContent = '✅ Solicitud enviada. Espere confirmación en su correo.';
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

// ======================= LOGIN ARTISTA =======================
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
  cont.innerHTML='';
  CONTRATOS.filter(c=>c.artista_id===artista.id && c.estado==='por confirmar artista').forEach(c=>{
    const card=document.createElement('div');
    card.className='card';
    card.innerHTML=`
      <div><b>${c.usuario_nombre}</b> solicita show de ${c.duracion} min el ${c.fecha} en ${c.ciudad}</div>
      <div class="small">Precio: $${(c.precio||0).toFixed(2)}</div>
      <div class="actions">
        <button class="primary" onclick="aceptarContrato('${c.id}','${artista.id}')">Aceptar</button>
      </div>`;
    cont.appendChild(card);
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

// ======================= MIS RESERVAS =======================
async function onBuscarReserva(e){
  e.preventDefault();
  const correo = new FormData(e.target).get('correo');
  const list = CONTRATOS.filter(c=>c.usuario_correo===correo);
  const cont = $('#reservas-usuario');
  cont.innerHTML='';
  if(!list.length){ cont.innerHTML = '<div class="card">No se encontraron reservas.</div>'; return; }

  list.forEach(c=>{
    const canUploadProof = c.estado==='por validar pago';
    const canRate = c.estado==='confirmado' && !c.calificado;

    const el = document.createElement('div');
    el.className='card';
    el.innerHTML = `
      <div><b>${c.artista_nombre}</b> • ${c.fecha} • ${c.ciudad} • ${c.duracion} min</div>
      <div class="small">Estado: ${c.estado}</div>

      ${canUploadProof ? `
        <div style="margin:8px 0;">
          <label>Subir comprobante (imagen)
            <input type="file" accept="image/*" data-proof="${c.id}">
          </label>
        </div>
        <div class="actions">
          <button class="primary" data-sendproof="${c.id}">Enviar comprobante</button>
        </div>
      `:''}

      ${canRate ? `
        <div style="margin-top:10px;">
          <div class="small">Califica al artista (1 a 5):</div>
          <div data-stars="${c.id}" style="font-size:1.4rem;color:#fbbf24;cursor:pointer;user-select:none;">☆☆☆☆☆</div>
          <label>Reseña<textarea rows="2" data-review="${c.id}" placeholder="¿Cómo estuvo el show?"></textarea></label>
          <div class="actions"><button class="primary" data-sendreview="${c.id}">Enviar calificación</button></div>
        </div>
      `:''}

      ${c.comprobante_url ? `<div class="small">Comprobante: <a href="${c.comprobante_url}" target="_blank">Ver</a></div>`:''}
    `;
    cont.appendChild(el);

    // manejadores de comprobante
    if(canUploadProof){
      const btn = el.querySelector(`[data-sendproof="${c.id}"]`);
      btn.onclick = async ()=>{
        const fInput = el.querySelector(`input[data-proof="${c.id}"]`);
        const file = fInput?.files?.[0];
        if(!file) return alert('Selecciona una imagen de comprobante.');
        btn.disabled = true; btn.textContent = 'Subiendo...';
        try{
          const url = await uploadToDrive(file, 'proofs');
          c.comprobante_url = url;
          alert('✅ Comprobante enviado. El administrador revisará y confirmará.');
          onBuscarReserva(e); // refresca lista
        }catch(err){
          alert('No se pudo subir el comprobante.');
        }finally{
          btn.disabled = false; btn.textContent = 'Enviar comprobante';
        }
      };
    }

    // manejadores de estrellas
    if(canRate){
      let current = 0;
      const starEl = el.querySelector(`[data-stars="${c.id}"]`);
      const reviewEl = el.querySelector(`[data-review="${c.id}"]`);
      starEl.addEventListener('mousemove', (ev)=>{
        const rect = starEl.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (ev.clientX - rect.left)/rect.width));
        const val = Math.ceil(ratio*5);
        starEl.textContent = '★'.repeat(val)+'☆'.repeat(5-val);
      });
      starEl.addEventListener('mouseleave', ()=>{
        starEl.textContent = current ? ('★'.repeat(current)+'☆'.repeat(5-current)) : '☆☆☆☆☆';
      });
      starEl.addEventListener('click', (ev)=>{
        const rect = starEl.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (ev.clientX - rect.left)/rect.width));
        current = Math.max(1, Math.ceil(ratio*5));
        starEl.textContent = '★'.repeat(current)+'☆'.repeat(5-current);
      });

      const sendBtn = el.querySelector(`[data-sendreview="${c.id}"]`);
      sendBtn.onclick = async ()=>{
        if(!current) return alert('Elige una puntuación de 1 a 5.');
        const txt = (reviewEl.value||'').trim();

        // actualizar promedio del artista
        const art = ARTISTAS.find(a=>a.id===c.artista_id);
        const votos = Number(art.votos||0);
        const rating = Number(art.rating||0);
        const nuevoVotos = votos + 1;
        const nuevoRating = ((rating*votos) + current) / nuevoVotos;

        try{
          await sheetPatch(art.id, { rating: nuevoRating.toFixed(2), votos: String(nuevoVotos) });
          art.rating = nuevoRating.toFixed(2);
          art.votos = String(nuevoVotos);
          c.calificado = true;
          alert('✅ ¡Gracias por tu calificación y reseña!');
          onBuscarReserva(e); // refresca lista
        }catch(err){
          alert('No se pudo guardar la calificación.');
        }
      };
    }
  });
}

// ======================= PANEL ADMIN =======================
async function openAdmin(){
  const pass = prompt('Clave de administrador:');
  if(pass!==CONFIG.ADMIN_PASSWORD) return alert('Clave incorrecta');
  $('#admin').classList.remove('hidden');
  renderAdmin();
}

function renderAdmin(){
  const cont = $('#admin-content');
  const pend = CONTRATOS.filter(c=>c.estado==='por validar pago');
  cont.innerHTML = '<h4>Pendientes de validar pago</h4>' + (pend.length?'':'<div class="small">No hay pagos pendientes.</div>');
  pend.forEach(c=>{
    cont.insertAdjacentHTML('beforeend',`
      <div class="card">
        <div><b>${c.artista_nombre}</b> ←→ <b>${c.usuario_nombre}</b></div>
        <div class="small">Fecha: ${c.fecha} • Ciudad: ${c.ciudad} • Duración: ${c.duracion} min</div>
        <div>Comprobante: ${c.comprobante_url ? `<a href="${c.comprobante_url}" target="_blank">Ver</a>` : '—'}</div>
        <div class="actions">
          <button class="primary" data-id="${c.id}">Marcar como pagado</button>
        </div>
      </div>`);
  });
  $$('#admin-content button.primary').forEach(b=>b.onclick=()=>confirmarContrato(b.dataset.id));
}

async function confirmarContrato(cid){
  const c = CONTRATOS.find(x=>x.id===cid); if(!c) return;
  c.estado='confirmado';
  const artista = ARTISTAS.find(a=>a.id===c.artista_id);
  await gas('notifyConfirmed',{
    toUser:[c.usuario_correo], toArtist:[artista.correo],
    artista_nombre: artista.nombre_artistico,
    artista_correo: artista.correo, artista_celular: artista.celular,
    usuario_nombre: c.usuario_nombre,
    usuario_correo: c.usuario_correo, usuario_celular: c.usuario_celular
  });
  alert('✅ Contrato confirmado y contactos liberados. El usuario ahora puede calificar.');
  renderAdmin();
}
