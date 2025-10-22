// =========================================
// Banco de Artistas - Patch Actualizado (solo GAS backend)
// =========================================
// Compatible con el nuevo Code.gs y el index.html
// Maneja: aceptación de contratos, correos, chat y comprobantes

(function(){

  const GAS = window.CONFIG?.GAS_URL || 'https://script.google.com/macros/s/AKfycbxEtWw-1vKziFDsgAOl1YDsGAk8xFZP8MErj6xiwyJcQKTAZy3-mG7egeyxlIK-etyIqA/exec';

  async function gasFetch(payload){
    try{
      const r = await fetch(GAS, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      return await r.json();
    }catch(e){
      console.error('Error GAS fetch', e);
      return {ok:false, error:e.message};
    }
  }

  async function sendEmail({to=[], subject='', html=''}){
    return gasFetch({action:'sendEmail', to, subject, html});
  }

  async function create(sheet, record){
    return gasFetch({action:'create', sheet, record});
  }

  async function search(sheet, filters){
    const r = await gasFetch({action:'search', sheet, filters});
    return r.ok ? r.results : [];
  }

  async function update(sheet, id, record){
    return gasFetch({action:'update', sheet, id, record});
  }

  // =========================================
  // PATCH PRINCIPAL
  // =========================================
  const BA_PATCH = {

    // ========== ARTISTA ACEPTA CONTRATO ==========
    async onArtistAccept(contrato, horasParaPagar = 24){
      try{
        if(!contrato?.id){
          alert("Contrato sin ID válido.");
          return false;
        }

        const vence = new Date(Date.now() + horasParaPagar*3600*1000).toISOString();

        const res = await update('contratos', contrato.id, {
          estado: 'pendiente de pago',
          vence_pago: vence
        });

        if(!res.ok){
          alert('No se pudo actualizar contrato en la hoja.');
          return false;
        }

        // ======= Email al usuario =======
        const appUrl = 'https://jordyalejandrot1994-arch.github.io/banco-de-artistas/';
        await sendEmail({
          to: [contrato.usuario_correo],
          subject: `Contrato ${contrato.ref}: pendiente de pago`,
          html: `
            <h2>Tu contrato fue aceptado</h2>
            <p><strong>Referencia:</strong> ${contrato.ref}</p>
            <p><strong>Artista:</strong> ${contrato.artista_nombre}</p>
            <p><strong>Total a pagar:</strong> $${contrato.precio_user}</p>
            <p><strong>Fecha límite para subir comprobante:</strong> ${new Date(vence).toLocaleString()}</p>
            <hr>
            <p>Ingresa a <a href="${appUrl}" target="_blank">Mis Reservas</a> para subir tu comprobante.</p>
            <p><em>Banco de Loja</em> - Cta Ahorros 2901691001 - Jordy Torres</p>
          `
        });

        // ======= Email al artista =======
        await sendEmail({
          to: [contrato.artista_correo],
          subject: `Contrato ${contrato.ref} aceptado - Esperando pago`,
          html: `
            <h2>Has aceptado el contrato ${contrato.ref}</h2>
            <p>Estado: <b>pendiente de pago</b></p>
            <p>El usuario tiene ${horasParaPagar}h para subir su comprobante.</p>
          `
        });

        alert('Contrato aceptado correctamente. Usuario notificado.');
        return true;
      }catch(err){
        console.error('onArtistAccept error', err);
        alert('Error al aceptar contrato.');
        return false;
      }
    },

    // ========== ADMIN VE COMPROBANTE ==========
    augmentAdminCard(cardEl, contrato){
      try{
        const row = cardEl.querySelector('.peek');
        if(!row) return;

        let existing = cardEl.querySelector('[data-comprobante-link]');
        if(existing) existing.remove();

        const info = document.createElement('div');
        info.setAttribute('data-comprobante-link','');
        info.className = 'note';
        info.innerHTML = contrato.comprobante_url
          ? `<div>Comprobante: <a href="${contrato.comprobante_url}" target="_blank">Ver archivo</a></div>`
          : `<div>Comprobante: —</div>`;

        row.parentElement.appendChild(info);
      }catch(e){ console.warn('augmentAdminCard', e); }
    },

    // ========== CHAT UNIFICADO ==========
    async openChat(contrato, role){
      const dlg = document.getElementById('dlgChat');
      if(!dlg){ alert('No existe el diálogo de chat.'); return; }

      const ref = contrato.ref;
      const refSpan = document.getElementById('dlgChatRef');
      const list = document.getElementById('chatList');
      const text = document.getElementById('chatText');
      const send = document.getElementById('chatSend');
      const sel = document.getElementById('chatCanal');
      const hint = document.getElementById('chatHint');
      const row = document.getElementById('chatAudienceRow');

      refSpan.textContent = ref;

      const confirmado = (contrato.estado||'').toLowerCase() === 'confirmado';
      const canales = [
        {value:'admin-usuario', label:'Admin ↔ Usuario', enabled:true},
        {value:'admin-artista', label:'Admin ↔ Artista', enabled:true},
        {value:'usuario-artista', label:'Usuario ↔ Artista', enabled:confirmado}
      ];

      const isAdmin = role==='admin';
      row.style.display = isAdmin ? 'flex':'none';

      let defaultCanal = 'admin-usuario';
      if(role==='artista') defaultCanal = confirmado?'usuario-artista':'admin-artista';
      if(role==='usuario') defaultCanal = confirmado?'usuario-artista':'admin-usuario';

      sel.innerHTML='';
      canales.forEach(c=>{
        const opt=document.createElement('option');
        opt.value=c.value;
        opt.textContent=c.label + (c.enabled?'':' (bloqueado)');
        opt.disabled=!c.enabled;
        sel.appendChild(opt);
      });
      sel.value = defaultCanal;

      function canSend(canal){
        if(role==='admin') return true;
        if(canal==='usuario-artista') return confirmado;
        if(role==='usuario' && canal==='admin-usuario') return true;
        if(role==='artista' && canal==='admin-artista') return true;
        return false;
      }

      async function load(){
        list.textContent='Cargando...';
        const msgs = await search('mensajes', {contrato_ref:ref});
        const canal = sel.value;
        const filtered = msgs.filter(m=>m.canal===canal).sort((a,b)=>a.ts.localeCompare(b.ts));

        if(!filtered.length){
          list.innerHTML='<div class="note">Sin mensajes.</div>';
        }else{
          list.innerHTML=filtered.map(m=>`
            <div style="margin:4px 0">
              <strong>${m.de}</strong>
              <span style="font-size:0.8em;color:#888">${new Date(m.ts).toLocaleString()}</span>
              <div>${m.texto}</div>
            </div>
          `).join('');
          list.scrollTop=list.scrollHeight;
        }
      }

      function updateHint(){
        const canal = sel.value;
        if(canSend(canal)){
          send.disabled=false; text.disabled=false;
          hint.textContent='';
        }else{
          send.disabled=true; text.disabled=true;
          hint.textContent='Este canal se habilita al confirmar el contrato.';
        }
      }

      send.onclick = async()=>{
        const txt = text.value.trim();
        if(!txt) return;
        const canal = sel.value;
        if(!canSend(canal)) return;
        await create('mensajes',{
          id: 'M-'+Date.now(),
          contrato_ref:ref,
          de:role,
          canal,
          texto:txt,
          ts:new Date().toISOString()
        });
        text.value='';
        await load();
      };

      sel.onchange = async()=>{ updateHint(); await load(); };
      updateHint(); await load();
      dlg.showModal();
    }
  };

  window.BA_PATCH = BA_PATCH;
})();
