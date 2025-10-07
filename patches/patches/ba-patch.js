(function (global) {
  const API = global.API;
  const sendEmail = global.sendEmail;

  function log(...a){ try{ console.log('[BA_PATCH]', ...a); }catch(_){} }

  async function safeUpdateContrato(c, data){
    try{
      await API.updateById('contratos', c.id, data);
      return true;
    }catch(e){
      log('updateById falló', e);
      return false;
    }
  }

  const BA_PATCH = {
    /**
     * Aceptación del artista -> contrato pasa a "pendiente de pago"
     * Nunca debe lanzar excepción ni mostrar alert; devuelve true/false.
     */
    async onArtistAccept(c, horasLimite = 24){
      try{
        log('onArtistAccept INICIO', c && c.ref, 'id=', c && c.id);
        if(!c || !c.id){ log('Contrato sin ID'); return false; }

        const venceISO = new Date(Date.now() + horasLimite*60*60*1000).toISOString();

        const ok = await safeUpdateContrato(c, {
          estado: 'pendiente de pago',
          vence_pago: venceISO
        });

        if(!ok){ log('No se pudo actualizar estado'); return false; }

        // Emails – si fallan, no interrumpen el flujo
        try{
          // Usuario: aviso de pendiente de pago
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
        }catch(e){ log('Email usuario falló (ignorar):', e); }

        try{
          // Artista: mensaje corto (sin datos de contacto del usuario)
          await sendEmail({
            to: [c.artista_correo].filter(Boolean),
            subject: `Contrato ${c.ref} aceptado - Esperando comprobante`,
            html: `<p>Aceptaste el contrato <strong>${c.ref}</strong>. Estado: <strong>pendiente de pago</strong>.</p>`
          });
        }catch(e){ log('Email artista falló (ignorar):', e); }

        log('onArtistAccept OK', c.ref);
        return true;
      }catch(e){
        log('onArtistAccept ERROR', e);
        return false;
      }
    },

    // Deja este stub por si lo usas desde Admin para añadir enlaces, etc.
    augmentAdminCard(container, contrato){
      // no-op seguro
    }
  };

  global.BA_PATCH = BA_PATCH;
})(window);
