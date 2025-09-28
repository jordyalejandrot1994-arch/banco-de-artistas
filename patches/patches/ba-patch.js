/**
 * Banco de Artistas — PATCH (Aceptar→Pago + Mensajes visibles)
 * No rompe tu app: añade UI puntual (uploader en “pendiente de pago”, hilo de mensajes).
 */
(function(){
  const SHEETDB = window.SHEETDB || "https://sheetdb.io/api/v1/76ve5brru41h8";
  const BA_PATCH = window.BA_PATCH = window.BA_PATCH || {};

  // --- Utils ---
  const qs = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));
  const nowIso = () => new Date().toISOString();
  const addHours = (h) => new Date(Date.now() + h*3600*1000).toISOString();
  const ensureEl = (el, cls) => { if (cls) el.classList.add(cls); return el; };

  // --- Email helper (reusa tu función serverless) ---
  async function sendEmail({to=[], subject="", html=""}){
    if (window.sendEmail) return window.sendEmail({to, subject, html});
    const res = await fetch('/.netlify/functions/send-email', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ to, subject, html })
    });
    try { return await res.json(); } catch(e){ return { ok: res.ok }; }
  }

  // --- SheetDB helpers de parche ---
  const PatchAPI = {
    async search(sheet, where){
      const params = new URLSearchParams({ sheet });
      for (const [k,v] of Object.entries(where||{})){ params.append(k, v); }
      const r = await fetch(`${SHEETDB}/search?${params.toString()}`);
      if (!r.ok) throw new Error('SheetDB search error');
      return r.json();
    },
    async create(sheet, data){
      const r = await fetch(`${SHEETDB}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sheet, data: [data] })
      });
      if (!r.ok) throw new Error('SheetDB create error');
      return r.json();
    },
    async updateByRef(sheet, ref, data){
      const params = new URLSearchParams({ sheet, ref });
      const r = await fetch(`${SHEETDB}/search?${params.toString()}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ data })
      });
      if (!r.ok) throw new Error('SheetDB update error');
      return r.json();
    }
  };

  // --- Mensajería ---
  async function listMensajes(contrato_ref){
    const arr = await PatchAPI.search('mensajes', { contrato_ref });
    arr.sort((a,b)=> String(a.ts||'').localeCompare(String(b.ts||'')));
    return arr;
  }
  async function sendMensaje(contrato_ref, de, texto){
    if (!texto || !texto.trim()) return;
    const msg = {
      id: (Math.random().toString(36).slice(2)+Date.now().toString(36)).toUpperCase(),
      contrato_ref, de, texto: texto.trim(), ts: nowIso()
    };
    await PatchAPI.create('mensajes', msg);
    return msg;
  }

  function threadItem(m, role){
    const who = m.de || 'otro';
    const me = (role && who===role);
    const li = document.createElement('div');
    li.className = 'ba-msg ' + (me ? 'me' : 'other');
    li.innerHTML = `<div class="ba-bubble"><div class="ba-meta">${who} · ${new Date(m.ts).toLocaleString()}</div><div class="ba-text"></div></div>`;
    qs('.ba-text', li).textContent = m.texto || '';
    return li;
  }

  function threadStyles(){
    if (document.getElementById('ba-msg-styles')) return;
    const css = `
    .ba-thread{max-height:260px;overflow:auto;padding:8px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin-top:8px;}
    .ba-msg{display:flex;margin:6px 0;}
    .ba-msg.me{justify-content:flex-end;}
    .ba-bubble{max-width:80%;padding:8px 12px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);}
    .ba-msg.other .ba-bubble{background:#f3f4f6;}
    .ba-msg.me .ba-bubble{background:#e0f2fe;}
    .ba-meta{font-size:.72rem;color:#6b7280;margin-bottom:4px;}
    .ba-input{display:flex;gap:8px;margin-top:8px;}
    .ba-input input{flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:10px;}
    .ba-input button{padding:10px 14px;border-radius:10px;border:0;cursor:pointer;}
    .ba-muted{color:#6b7280;font-size:.9rem;margin-top:6px;}
    .ba-proof{border:1px dashed #94a3b8;padding:12px;border-radius:12px;background:#f8fafc;margin-top:10px;}
    `;
    const style = document.createElement('style');
    style.id = 'ba-msg-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  async function mountThread(container, contrato, role, canWrite){
    threadStyles();
    const wrap = ensureEl(document.createElement('div'), 'ba-thread');
    container.appendChild(wrap);
    const msgs = await listMensajes(contrato.ref);
    wrap.innerHTML = '';
    msgs.forEach(m => wrap.appendChild(threadItem(m, role)));

    if (canWrite){
      const inputWrap = ensureEl(document.createElement('div'), 'ba-input');
      inputWrap.innerHTML = `
        <input type="text" placeholder="Escribe un mensaje..." maxlength="500">
        <button class="send">Enviar</button>
      `;
      container.appendChild(inputWrap);
      const inp = qs('input', inputWrap);
      const btn = qs('button.send', inputWrap);
      async function doSend(){
        const text = inp.value.trim();
        if (!text) return;
        const msg = await sendMensaje(contrato.ref, role, text);
        if (msg){
          wrap.appendChild(threadItem(msg, role));
          inp.value='';
          wrap.scrollTop = wrap.scrollHeight;
        }
      }
      btn.addEventListener('click', doSend);
      inp.addEventListener('keydown', e => { if (e.key==='Enter') doSend(); });
    } else {
      const note = ensureEl(document.createElement('div'), 'ba-muted');
      note.textContent = 'El chat se habilitará cuando el contrato esté confirmado.';
      container.appendChild(note);
    }
  }

  // --- Pago: uploader para “pendiente de pago” ---
  async function uploadProof(file){
    const b64 = await new Promise((resolve, reject)=>{
      const fr = new FileReader();
      fr.onload = ()=> resolve(String(fr.result).split(',')[1]);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    const r = await fetch('/.netlify/functions/upload-proof', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        mode:'upload',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64: b64
      })
    });
    const j = await r.json();
    if (!j.ok) throw new Error('No se pudo subir el comprobante');
    return j.url;
  }

  async function mountUserPayment(container, contrato){
    if (String(contrato.estado).toLowerCase() !== 'pendiente de pago') return;
    const box = ensureEl(document.createElement('div'), 'ba-proof');
    box.innerHTML = `
      <div><b>Subir comprobante de pago</b></div>
      <div class="ba-muted">Tu solicitud fue aceptada. Sube el comprobante para continuar.</div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:8px;">
        <input type="file" accept="image/*,application/pdf">
        <button class="enviar" style="padding:8px 12px;border-radius:8px;border:0;cursor:pointer;">Enviar comprobante</button>
      </div>
      <div class="status ba-muted"></div>
    `;
    container.appendChild(box);
    const fileInp = qs('input[type=file]', box);
    const status = qs('.status', box);
    qs('.enviar', box).addEventListener('click', async ()=>{
      const f = fileInp.files && fileInp.files[0];
      if (!f){ alert('Selecciona un archivo.'); return; }
      try{
        status.textContent = 'Subiendo comprobante...';
        const url = await uploadProof(f);
        await PatchAPI.updateByRef('contratos', contrato.ref, {
          comprobante_url: url,
          pago_cargado: 'TRUE',
          estado: 'pago en revisión'
        });
        status.textContent = 'Comprobante recibido. Estamos validando.';
        try{
          await sendEmail({
            to:[contrato.usuario_correo],
            subject:`Recibimos tu comprobante — Ref ${contrato.ref}`,
            html:`<p>Gracias. Tu pago está en <b>revisión</b>.</p><p>Ref: <b>${contrato.ref}</b></p>`
          });
          await sendEmail({
            to:[contrato.artista_correo],
            subject:`Solicitud con pago cargado — Ref ${contrato.ref}`,
            html:`<p>El usuario subió el comprobante de pago.</p><p>Ref: <b>${contrato.ref}</b></p>`
          });
        }catch(e){}
        alert('¡Listo! Tu pago está en revisión.');
      }catch(e){
        console.error(e);
        alert('No se pudo subir/guardar el comprobante.');
        status.textContent = 'Error al subir.';
      }
    });
  }

  // --- Hooks públicos que debes llamar desde tu app en puntos muy puntuales ---
  BA_PATCH.onArtistAccept = async function(contrato, horasPlazo=24){
    // Llamar cuando el artista pulse "Aceptar"
    const payment_due_at = addHours(horasPlazo);
    await PatchAPI.updateByRef('contratos', contrato.ref, {
      estado: 'pendiente de pago',
      payment_due_at
    });
    try{
      await sendEmail({
        to:[contrato.usuario_correo],
        subject:`Tu solicitud fue aceptada — Ref ${contrato.ref}`,
        html:`<p>¡El artista aceptó! Tienes <b>${horasPlazo}h</b> para realizar el pago y subir el comprobante desde <b>Mis reservas</b>.</p>`
      });
    }catch(e){}
    return { ok:true, payment_due_at };
  };

  BA_PATCH.mountInContractDetail = async function(container, contrato, role){
    // role: 'usuario' | 'artista' | 'admin'
    try{
      if (role === 'usuario'){
        await mountUserPayment(container, contrato);
      }
      const canWrite = (role === 'admin') || (String(contrato.estado).toLowerCase() === 'confirmado');
      const title = document.createElement('h4');
      title.textContent = 'Mensajes';
      container.appendChild(title);
      await mountThread(container, contrato, role, canWrite);
    }catch(e){
      console.error('BA_PATCH.mountInContractDetail error', e);
    }
  };

  BA_PATCH.augmentAdminCard = function(cardElem, contrato){
    try{
      if (contrato.comprobante_url){
        const p = document.createElement('div');
        p.className = 'ba-muted';
        p.innerHTML = `Comprobante: <a href="${contrato.comprobante_url}" target="_blank">Ver</a>`;
        cardElem.appendChild(p);
      }
      const wrap = document.createElement('div');
      const title = document.createElement('div');
      title.style.marginTop = '6px';
      title.textContent = 'Mensajes';
      cardElem.appendChild(title);
      BA_PATCH.mountInContractDetail(wrap, contrato, 'admin');
      cardElem.appendChild(wrap);
    }catch(e){ console.error('augmentAdminCard', e); }
  };

  console.log('BA_PATCH listo');
})();
