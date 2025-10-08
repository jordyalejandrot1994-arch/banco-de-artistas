// patches/patches/ba-patch.js
// Banco de Artistas - Patch utilitario para index.html
// Requiere que existan globales: CONFIG, API, sendEmail y el <dialog id="dlgChat"> del index.

(function(){
  const BA_PATCH = {
    /**
     * Lógica cuando el ARTISTA acepta un contrato.
     * - Mueve a "pendiente de pago"
     * - Guarda fecha límite
     * - Envía email al usuario con instrucciones para subir comprobante
     */
    async onArtistAccept(contrato, horasParaPagar = 24){
      try{
        const deadlineIso = new Date(Date.now() + horasParaPagar*3600*1000).toISOString();
        await API.updateById('contratos', contrato.id, {
          estado: 'pendiente de pago',
          pago_deadline: deadlineIso
        });

        // Email al USUARIO con instrucciones para subir comprobante
        const appUrl = 'https://jordyalejandrot1994-arch.github.io/banco-de-artistas/';
        const fechaHumana = new Date(contrato.fecha_creacion || Date.now()).toLocaleString();

        await sendEmail({
          to: [contrato.usuario_correo],
          subject: `Tu contrato ${contrato.ref} está pendiente de pago`,
          html: `
            <h2>Tu contrato está pendiente de pago</h2>
            <p><strong>Ref:</strong> ${contrato.ref}</p>
            <p><strong>Artista:</strong> ${contrato.artista_nombre}</p>
            <p><strong>Creado:</strong> ${fechaHumana}</p>
            <p><strong>Total a pagar (con servicio):</strong> $${contrato.precio_user}</p>
            <hr>
            <p>Por favor realiza la transferencia y <strong>sube el comprobante</strong> desde
              <a href="${appUrl}" target="_blank" rel="noopener">Mis reservas</a> usando tu correo o Nº de contrato.</p>
            <p><em>Límite:</em> ${new Date(deadlineIso).toLocaleString()} (${horasParaPagar}h)</p>
            <p>Cuenta: <strong>Banco de Loja</strong> 2901691001, Ahorros, <strong>Jordy Torres</strong>, C.I. 1105200057</p>
          `
        });

        alert('Contrato aceptado. El usuario tiene ' + horasParaPagar + 'h para subir su comprobante.');
        return true;
      }catch(err){
        console.error('onArtistAccept error', err);
        alert('No se pudo aceptar el contrato.');
        return false;
      }
    },

    /**
     * Enriquecer tarjeta en ADMIN:
     * - Muestra link del comprobante si existe
     * - Reemplaza botón "Mensaje" para abrir el diálogo de chat
     */
    augmentAdminCard(cardEl, contrato){
      try{
        // 1) Mostrar link del comprobante (si existe)
        const btnRow = cardEl.querySelector('.peek');
        if(btnRow){
          const already = cardEl.querySelector('[data-comprobante-link]');
          if(!already){
            const info = document.createElement('div');
            info.style.marginTop = '8px';
            info.setAttribute('data-comprobante-link','');
            info.innerHTML = contrato.comprobante_url
              ? `<div class="note">Comprobante: <a href="${contrato.comprobante_url}" target="_blank" rel="noopener">ver archivo</a></div>`
              : `<div class="note">Comprobante: —</div>`;
            btnRow.parentElement.appendChild(info);
          }
        }

        // 2) Hook del botón "Mensaje" para abrir el diálogo de chat con rol admin
        const msgBtn = cardEl.querySelector('button[data-accion="mensaje"]');
        if(msgBtn){
          msgBtn.addEventListener('click', (e)=>{
            // Evita que el listener original (prompt) se ejecute
            e.preventDefault();
            e.stopImmediatePropagation();
            BA_PATCH.openChat(contrato, 'admin');
          }, { capture: true }); // captura para adelantarnos al otro listener
        }
      }catch(err){
        console.warn('augmentAdminCard error', err);
      }
    },

    /**
     * Abre el diálogo de chat unificado en el <dialog id="dlgChat"> del index
     * Canales:
     *  - admin-usuario
     *  - admin-artista
     *  - usuario-artista (solo si contrato.confirmado)
     *
     * role: 'admin' | 'usuario' | 'artista'
     */
    async openChat(contrato, role){
      const dlg = document.getElementById('dlgChat');
      if(!dlg){ alert('No se encontró el diálogo de chat (#dlgChat).'); return; }

      // DOM refs
      const refSpan   = document.getElementById('dlgChatRef');
      const listEl    = document.getElementById('chatList');
      const textEl    = document.getElementById('chatText');
      const sendBtn   = document.getElementById('chatSend');
      const canalSel  = document.getElementById('chatCanal');
      const hintEl    = document.getElementById('chatHint');
      const audienceRow = document.getElementById('chatAudienceRow');

      if(!refSpan || !listEl || !textEl || !sendBtn || !canalSel){ alert('Faltan nodos del chat.'); return; }

      refSpan.textContent = contrato.ref || '';

      // Definir canales disponibles según estado
      const confirmado = String(contrato.estado||'').toLowerCase() === 'confirmado';
      const canales = [
        { value: 'admin-usuario', label: 'Admin ↔ Usuario', enabled: true },
        { value: 'admin-artista', label: 'Admin ↔ Artista', enabled: true },
        { value: 'usuario-artista', label: 'Usuario ↔ Artista', enabled: confirmado }
      ];

      // Mostrar/ocultar selector de audiencia:
      // - Admin siempre puede escoger canal
      // - Usuario / Artista lo fijamos (no editable)
      const isAdmin = role === 'admin';
      audienceRow.style.display = isAdmin ? 'flex' : 'none';

      // Canal por defecto según rol + estado
      let defaultCanal = 'admin-usuario';
      if(role === 'artista') defaultCanal = confirmado ? 'usuario-artista' : 'admin-artista';
      if(role === 'usuario') defaultCanal = confirmado ? 'usuario-artista' : 'admin-usuario';

      // Rellenar selector (si admin)
      canalSel.innerHTML = '';
      canales.forEach(c=>{
        const opt = document.createElement('option');
        opt.value = c.value;
        opt.textContent = c.label + (c.enabled ? '' : ' (bloqueado hasta confirmar)');
        opt.disabled = !c.enabled;
        canalSel.appendChild(opt);
      });
      if(isAdmin){
        // Admin puede seleccionar canal (si el por defecto está deshabilitado, caer al primero habilitado)
        const preferred = canales.find(c=>c.value===defaultCanal && c.enabled) || canales.find(c=>c.enabled);
        canalSel.value = preferred ? preferred.value : 'admin-usuario';
      }else{
        // Usuario/Artista fijan el canal (sin selector)
        canalSel.value = defaultCanal;
      }

      // Permisos para enviar:
      // - Admin siempre
      // - Usuario/Artista:
      //    * Pueden escribir con admin aún no confirmado (su propio canal con admin)
      //    * Entre usuario y artista solo si confirmado
      function canCurrentRoleSend(canal){
        if(role === 'admin') return true;
        if(canal === 'usuario-artista') return confirmado; // solo si confirmado
        if(role === 'usuario' && canal === 'admin-usuario') return true;
        if(role === 'artista' && canal === 'admin-artista') return true;
        return false;
      }

      function updateHint(){
        const canal = canalSel.value;
        if(canCurrentRoleSend(canal)){
          sendBtn.disabled = false; textEl.disabled = false;
          hintEl.textContent = '';
        }else{
          sendBtn.disabled = true; textEl.disabled = true;
          if(canal==='usuario-artista' && !confirmado){
            hintEl.textContent = 'Este canal se habilita cuando el contrato esté CONFIRMADO.';
          }else{
            hintEl.textContent = 'No tienes permiso para enviar en este canal.';
          }
        }
      }

      async function loadMessages(){
        listEl.textContent = 'Cargando…';
        try{
          // Traer todos y filtrar por canal en cliente
          const msgs = await API.search('mensajes', { contrato_ref: contrato.ref });
          const canal = canalSel.value;
          const filtered = (Array.isArray(msgs) ? msgs : [])
            .filter(m => (m.canal || 'admin-usuario') === canal)
            .sort((a,b)=> String(a.ts||'').localeCompare(String(b.ts||'')));

          if(!filtered.length){
            listEl.innerHTML = '<div class="note">Sin mensajes aún.</div>';
          }else{
            listEl.innerHTML = filtered.map(m=>`
              <div style="margin:6px 0">
                <strong>${(m.de||'').toUpperCase()}</strong>
                <span class="muted" style="font-size:.8rem">${m.ts? new Date(m.ts).toLocaleString(): ''}</span>
                <div>${String(m.texto||'').replace(/</g,'&lt;')}</div>
              </div>
            `).join('');
            listEl.scrollTop = listEl.scrollHeight;
          }
        }catch(err){
          console.error('loadMessages error', err);
          listEl.innerHTML = '<div class="danger">No se pudieron cargar mensajes.</div>';
        }
      }

      // Cambiar de canal (solo admin)
      canalSel.onchange = async ()=>{ updateHint(); await loadMessages(); };

      // Enviar
      sendBtn.onclick = async ()=>{
        const texto = (textEl.value||'').trim();
        if(!texto) return;
        const canal = canalSel.value;
        if(!canCurrentRoleSend(canal)) return;

        try{
          await API.create('mensajes', {
            id: uid('M'),
            contrato_ref: contrato.ref,
            de: role,
            canal,
            texto,
            ts: new Date().toISOString()
          });
          textEl.value = '';
          await loadMessages();
        }catch(err){
          alert('No se pudo enviar el mensaje.');
        }
      };

      // Inicializa y muestra
      updateHint();
      await loadMessages();
      dlg.showModal();
    }
  };

  // expone global
  window.BA_PATCH = BA_PATCH;
})();
