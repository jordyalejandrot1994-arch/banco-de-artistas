// patches/patches/ba-patch.js
// Parche robusto: aceptación de contrato con fallback a PATCH directo y logs.

window.BA_PATCH = (() => {
  function log(...args){ try{ console.log('[BA_PATCH]', ...args); }catch{} }

  async function safeJson(res){
    try { return await res.json(); } catch { return {}; }
  }

  async function patchContratoPorIdFallback(c, data){
    // Fallback: PATCH directo a SheetDB por ID + ?sheet=contratos
    try{
      const base = (typeof CONFIG?.SHEETDB_ENDPOINT === 'string')
        ? CONFIG.SHEETDB_ENDPOINT
        : 'https://sheetdb.io/api/v1/76ve5brru41h8'; // último recurso
      const url = `${base}/id/${encodeURIComponent(c.id)}?sheet=contratos`;
      const r = await fetch(url, {
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ data })
      });
      const jj = await safeJson(r);
      log('fallback PATCH response:', jj);
      return jj && (jj.updated >= 1);
    }catch(e){
      log('fallback PATCH error:', e);
      return false;
    }
  }

  async function actualizarContrato(c, data){
    // 1) intenta vía helper API.updateById
    try{
      log('API.updateById(contratos,', c.id, data, ')');
      const r = await API.updateById('contratos', c.id, data);
      // SheetDB suele devolver { updated: 1 }
      if (r && (r.updated >= 1)) return true;
      log('API.updateById no confirmó update, r=', r);
    }catch(e){
      log('API.updateById lanzó error:', e);
    }
    // 2) fallback directo
    return await patchContratoPorIdFallback(c, data);
  }

  async function onArtistAccept(c, horasLimite = 24){
    try{
      log('onArtistAccept INICIO para', c?.ref, 'id=', c?.id);

      // seguridad básica
      if(!c || !c.id){
        log('Contrato sin ID. No se puede actualizar.');
        return false;
      }

      const venceISO = new Date(Date.now() + horasLimite*60*60*1000).toISOString();
      const ok = await actualizarContrato(c, { estado:'pendiente de pago', vence_pago: venceISO });

      if(!ok){
        log('No se pudo actualizar el contrato en SheetDB (ni con fallback).');
        return false;
      }

      // emails: no deben romper el flujo si fallan
      try{
        await sendEmail({
          to: [c.usuario_correo].filter(Boolean),
          subject: `Contrato ${c.ref}: pendiente de pago`,
          html: `
            <h2>Tu contrato fue aceptado</h2>
            <p><strong>Referencia:</strong> ${c.ref}</p>
            <p><strong>Artista:</strong> ${c.artista_nombre||''}</p>
            <p><strong>Duración:</strong> ${c.minutos||''} minutos</p>
            <p><strong>Total a pagar:</strong> $${c.precio_user||''}</p>
            <p><strong>Fecha límite para subir comprobante:</strong> ${new Date(venceISO).toLocaleString()}</p>
            <hr/>
            <p>Ve a <em>Mis reservas</em> y sube tu comprobante para continuar.</p>
          `
        });
      }catch(e){ log('Email usuario falló (se ignora):', e); }

      try{
        await sendEmail({
          to: [c.artista_correo].filter(Boolean),
          subject: `Contrato ${c.ref} aceptado - Esperando comprobante`,
          html: `<p>Aceptaste el contrato <strong>${c.ref}</strong>. Queda en <strong>pendiente de pago</strong>.</p>`
        });
      }catch(e){ log('Email artista falló (se ignora):', e); }

      log('onArtistAccept OK para', c.ref);
      return true;
    }catch(e){
      log('onArtistAccept ERROR:', e);
      return false; // nunca lanzamos, para que no dispare alert en la UI
    }
  }

  function augmentAdminCard(cardEl, c){
    try{
      if(c?.comprobante_url){
        const div = document.createElement('div');
        div.className = 'note';
        div.innerHTML = `Comprobante: <a href="${c.comprobante_url}" target="_blank" rel="noopener">ver archivo</a>`;
        cardEl.appendChild(div);
      }
    }catch(e){ log('augmentAdminCard error:', e); }
  }

  log('BA_PATCH listo');
  return { onArtistAccept, augmentAdminCard };
})();
