Banco de Artistas - Deploy con Netlify Functions (SendGrid)
===============================================================

1) Variables de entorno (Netlify > Site settings > Environment variables)
   - SENDGRID_API_KEY = TU_API_KEY_DE_SENDGRID
   - FROM_EMAIL       = notificaciones@tudominio.com  (remitente verificado en SendGrid)

2) Despliegue
   - Sube este ZIP a Netlify (Drag & Drop).
   - Netlify detectará `netlify/functions/send-email.js` y empaquetará la función.

3) Dónde se envían correos
   - Al registrar ARTISTA (envía PIN a su correo).
   - Al CONFIRMAR un CONTRATO desde el panel Admin (usuario y artista).

4) Plantillas de Sheets esperadas
   - Pestañas: artistas, contratos, mensajes.
   - Encabezados: ver la documentación en el chat.

5) Endpoints (SheetDB)
   - Configurado a: https://sheetdb.io/api/v1/76ve5brru41h8
