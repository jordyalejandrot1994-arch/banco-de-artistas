/* patches/patches/ba-patch.js
   Banco de Artistas – helpers para acciones especiales
   (c) 2025
*/
(function (global) {
  "use strict";

  // ====== DEPENDENCIAS DEL INDEX ======
  // API: { getAll, search, create, updateById }
  // sendEmail: función que envía correos vía GAS
  const API = global.API;
  const sendEmail = global.sendEmail;

  // Pequeño logger con prefijo
  function log() {
    try {
      console.log("[BA_PATCH]", ...arguments);
    } catch (e) {}
  }

  // --- Guardas: por si el index aún no cargó ---
  if (!API || !API.updateById) {
    log("API.updateById no está disponible aún.");
  }
  if (!sendEmail) {
    log("sendEmail no está disponible aún (se ignorarán emails).");
  }

  // ========= ACTUALIZACIÓN SEGURA EN SHEETDB =========
  // Fuerza a actualizar SIEMPRE en la hoja 'contratos'
  async function safeUpdateContrato(c, data) {
    try {
      if (!c || !c.id) throw new Error("Contrato sin id");
      log("updateById iniciando para", c.id, "data=", data);
      const result = await API.updateById("contratos", c.id, data);
      log("updateById OK", result);
      return true;
    } catch (e) {
      log("updateById falló", e);
      return false;
    }
  }

  // ========= ACEPTACIÓN DEL ARTISTA =========
  // Cambia estado a "pendiente de pago", define fecha límite
  // y notifica a usuario/artista (sin datos de contacto del usuario).
  async function onArtistAccept(contrato, graceHours = 24) {
    try {
      log("onArtistAccept INICIO", contrato?.ref, "id=", contrato?.id);

      if (!contrato || !contrato.id) {
        log("Contrato inválido (sin id).");
        return false;
      }

      // Sólo permitir si venía "por confirmar artista"
      if (
        (contrato.estado || "").toLowerCase() !== "por confirmar artista" &&
        (contrato.estado || "").toLowerCase() !== "por confirmar"
      ) {
        log("Estado no permite aceptación:", contrato.estado);
        // No lo tratamos como error fatal; devolvemos false para que la UI
        // muestre mensaje amigable.
        return false;
      }

      const venceISO = new Date(
        Date.now() + graceHours * 60 * 60 * 1000
      ).toISOString();

      const ok = await safeUpdateContrato(contrato, {
        estado: "pendiente de pago",
        vence_pago: venceISO,
      });

      if (!ok) {
        log("No se pudo actualizar el contrato a 'pendiente de pago'.");
        return false;
      }

      // ===== Emails (no deben romper el flujo si fallan) =====
      // 1) Email al USUARIO: aceptado → pendiente de pago
      try {
        if (sendEmail && contrato.usuario_correo) {
          await sendEmail({
            to: [contrato.usuario_correo],
            subject: `Contrato ${contrato.ref}: pendiente de pago`,
            html: `
              <h2>Tu contrato fue aceptado por el artista</h2>
              <p><strong>Referencia:</strong> ${contrato.ref}</p>
              <p><strong>Artista:</strong> ${contrato.artista_nombre || ""}</p>
              <p><strong>Duración:</strong> ${contrato.minutos || ""} minutos</p>
              <p><strong>Total a pagar:</strong> $${contrato.precio_user || ""}</p>
              <p><strong>Fecha límite para subir comprobante:</strong> ${new Date(
                venceISO
              ).toLocaleString()}</p>
              <hr/>
              <p>Ve a <em>Mis reservas</em> y sube tu comprobante para continuar.</p>
            `,
          });
        }
      } catch (e) {
        log("Email usuario falló (se ignora):", e);
      }

      // 2) Email al ARTISTA: aceptó y queda pendiente de pago (sin datos del cliente)
      try {
        if (sendEmail && contrato.artista_correo) {
          await sendEmail({
            to: [contrato.artista_correo],
            subject: `Contrato ${contrato.ref} aceptado - Esperando comprobante`,
            html: `
              <h2>Contrato aceptado</h2>
              <p>Has aceptado el contrato <strong>${contrato.ref}</strong>.</p>
              <p>Estado: <strong>pendiente de pago</strong>.</p>
              <p>Los datos de contacto del cliente se revelarán cuando el administrador valide el pago y confirme el contrato.</p>
            `,
          });
        }
      } catch (e) {
        log("Email artista falló (se ignora):", e);
      }

      log("onArtistAccept OK", contrato.ref);
      return true;
    } catch (e) {
      log("onArtistAccept ERROR:", e);
      return false;
    }
  }

  // ========= MEJORA DE TARJETA ADMIN =========
  // Agrega enlace/preview de comprobante si existe.
  function augmentAdminCard(containerEl, contrato) {
    try {
      if (!containerEl || !contrato) return;

      // En tu sheet podrían existir distintas columnas:
      const proof =
        contrato.comprobante_url ||
        contrato.payment_comprobante ||
        contrato.comprobante ||
        contrato.comprobante_pago ||
        "";

      if (!proof) return;

      const note = document.createElement("div");
      note.className = "note";
      note.style.marginTop = "8px";

      const isImg = /\.(png|jpe?g|gif|webp)$/i.test(proof);

      note.innerHTML = `
        <div><strong>Comprobante:</strong> <a href="${proof}" target="_blank" rel="noopener">${proof}</a></div>
        ${
          isImg
            ? `<div style="margin-top:6px">
                 <img src="${proof}" alt="comprobante" style="max-width:240px;border-radius:8px;border:1px solid rgba(255,255,255,.12)" onerror="this.style.display='none'">
               </div>`
            : ""
        }
      `;

      // La tarjeta admin en index crea un .peek (fila de botones). Insertamos debajo:
      const btnRow = containerEl.querySelector(".peek");
      if (btnRow) btnRow.insertAdjacentElement("afterend", note);
      else containerEl.appendChild(note);
    } catch (e) {
      log("augmentAdminCard error:", e);
    }
  }

  // ====== API PÚBLICA ======
  const BA_PATCH = {
    onArtistAccept,
    augmentAdminCard,
  };

  global.BA_PATCH = BA_PATCH;
  log("BA_PATCH listo");
})(window);
