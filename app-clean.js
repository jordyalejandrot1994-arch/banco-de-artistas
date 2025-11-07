/* ==========================================================
   BANCO DE ARTISTAS - APP CLEAN (versión estable sin fotos)
   ========================================================== */

const GAS_URL = "https://script.google.com/macros/s/AKfycbyjWTTEG60IzzJspv5_9F4_nfjt4BbDHHzdqNFwU_4TPpFhwMM__BFU35twPxJqwsYK/exec";
const SHEETDB_URL = "https://sheetdb.io/api/v1/XXXXXXXXXXXX"; // 👈 reemplaza con tu endpoint real
let ARTISTAS = [];
let RESERVAS = [];
let modoAdmin = false;

const $ = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);

function notify(msg, ok = true) {
  const box = document.createElement("div");
  box.className = `toast ${ok ? "ok" : "error"}`;
  box.textContent = msg;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4000);
}

/* ========================
   🔹 Render de estrellas
======================== */
function renderStarsDisplay(rating = 0) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<span style="color:${i <= rating ? "#facc15" : "#475569"}">★</span>`;
  }
  return html;
}

/* ========================
   🔹 Cargar artistas
======================== */
async function loadArtistas() {
  try {
    const res = await fetch(SHEETDB_URL);
    ARTISTAS = await res.json();
    renderCards();
  } catch (err) {
    console.error("Error cargando artistas:", err);
    notify("Error al cargar artistas ❌", false);
  }
}

/* ========================
   🔹 Renderizar artistas
======================== */
function renderCards() {
  const q = $("#q")?.value?.toLowerCase() || "";
  const fc = $("#f-ciudad")?.value || "";
  const ft = $("#f-tipo")?.value || "";
  const cont = $("#cards");
  if (!cont) return;
  cont.innerHTML = "";

  ARTISTAS.filter(a => {
    const texto = `${a.nombre_artistico} ${a.ciudad} ${a.tipo_arte}`.toLowerCase();
    const okQ = !q || texto.includes(q);
    const okC = !fc || a.ciudad === fc;
    const okT = !ft || (a.tipo_arte || "").includes(ft);
    return okQ && okC && okT && a.deleted !== "TRUE" && a.aprobado !== "NO";
  }).forEach(a => {
    const vId = (a.video || "").includes("watch?v=")
      ? a.video.split("watch?v=")[1]
      : (a.video || "").split("/").pop();
    const iframe = vId ? `<iframe class="video" src="https://www.youtube.com/embed/${vId}" allowfullscreen></iframe>` : "";

    const rating = Number(a.rating || 0);
    const stars = renderStarsDisplay(rating);

    const precios = `
      <span class="badge">15m $${a.p15}</span>
      <span class="badge">30m $${a.p30}</span>
      <span class="badge">60m $${a.p60}</span>
      <span class="badge">120m $${a.p120}</span>
    `;

    cont.insertAdjacentHTML("beforeend", `
      <article class="card">
        <img 
          src="${a.foto && a.foto.startsWith('http') ? a.foto : 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}" 
          alt="${a.nombre_artistico}" 
          style="width:100%;height:180px;object-fit:cover;border-radius:12px;border:1px solid #1f2b46"
          onerror="this.src='https://cdn-icons-png.flaticon.com/512/847/847969.png'">
        <h3>${a.nombre_artistico || ""}</h3>
        <div class="small">${(a.tipo_arte || "").split(",").map(s => s.trim()).filter(Boolean).join(" • ")} • ${a.ciudad || ""}</div>
        <div class="small">${stars} <span style="margin-left:6px;color:#94a3b8;">(${a.votos || 0})</span></div>
        <p>${a.bio || ""}</p>
        ${iframe}
        <div class="actions">${precios}</div>
        <div class="actions"><button data-id="${a.id}" class="btn-contratar primary">Contratar</button></div>
      </article>
    `);
  });

  $$(".btn-contratar").forEach(btn =>
    btn.addEventListener("click", () => openContratacion(btn.dataset.id))
  );
}

/* ========================
   🔹 Subir imagen a Drive (foto artista o comprobante)
======================== */
async function uploadImageToDrive(file, folder = "artists") {
  const base64 = await toBase64(file);
  const data = {
    action: "uploadImage",
    base64,
    fileName: file.name,
    mimeType: file.type,
    folder
  };
  const res = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify(data)
  });
  return await res.json();
}

/* ========================
   🔹 Convertir a Base64
======================== */
function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => res(reader.result.split(",")[1]);
    reader.onerror = (err) => rej(err);
  });
}

/* ========================
   🔹 Registrar artista
======================== */
$("#form-registro")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);

  // Subir foto si existe
  let fotoUrl = "";
  const file = fd.get("foto");
  if (file && file.size > 0) {
    const res = await uploadImageToDrive(file, "artists");
    if (res.ok) fotoUrl = res.url;
  }

  fd.append("foto", fotoUrl);
  const body = Object.fromEntries(fd.entries());
  body.pin = Math.floor(1000 + Math.random() * 9000);
  body.aprobado = "SI";

  await fetch(SHEETDB_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "sendPin",
      to: [body.correo],
      artista: body.nombre_artistico,
      pin: body.pin
    })
  });

  notify("Artista registrado correctamente ✅");
  e.target.reset();
  loadArtistas();
});

/* ========================
   🔹 Contratar artista
======================== */
async function openContratacion(id) {
  const artista = ARTISTAS.find(a => a.id === id);
  if (!artista) return notify("Artista no encontrado ❌", false);

  const modal = document.createElement("div");
  modal.className = "modal";
  const precios = [15, 30, 60, 120];
  const htmlPrecios = precios.map(min => {
    const base = artista[`p${min}`];
    const total = Math.round(base * 1.1);
    return `<option value="${min}">${min} minutos — $${total}</option>`;
  }).join("");

  modal.innerHTML = `
    <div class="modal-content">
      <h3>Contratar a ${artista.nombre_artistico}</h3>
      <label>Tu nombre:</label>
      <input id="nombreUsuario">
      <label>Tu correo:</label>
      <input id="correoUsuario" type="email">
      <label>Ciudad del evento:</label>
      <input id="ciudadEvento">
      <label>Duración del show:</label>
      <select id="duracionShow">${htmlPrecios}</select>
      <label>Mensaje (opcional):</label>
      <textarea id="mensaje"></textarea>
      <button id="btnConfirmar" class="primary">Enviar solicitud</button>
      <button onclick="this.closest('.modal').remove()">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);

  $("#btnConfirmar").onclick = async () => {
    const usuario = $("#nombreUsuario").value.trim();
    const correo = $("#correoUsuario").value.trim();
    const duracion = $("#duracionShow").value;
    const ciudad = $("#ciudadEvento").value.trim();
    if (!usuario || !correo) return notify("Completa tus datos ❌", false);

    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "notifyNewBooking",
        to: [artista.correo],
        artista: artista.nombre_artistico,
        duracion,
        ciudad,
        fecha: new Date().toLocaleDateString(),
        mensaje: $("#mensaje").value
      })
    });

    notify("Solicitud enviada correctamente ✅");
    modal.remove();
  };
}

/* ========================
   🔹 Panel de reservas
======================== */
$("#form-reservas")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const correo = $("#correoReserva").value.trim();
  if (!correo) return notify("Ingresa tu correo", false);

  const res = await fetch(`${SHEETDB_URL}/search?correo=${correo}`);
  RESERVAS = await res.json();
  renderReservas();
});

function renderReservas() {
  const cont = $("#reservas");
  if (!cont) return;
  cont.innerHTML = "";

  RESERVAS.forEach(r => {
    cont.insertAdjacentHTML("beforeend", `
      <div class="reserva">
        <p><b>${r.artista}</b> • ${r.fecha}</p>
        <p>Estado: ${r.estado || "pendiente"}</p>
        <input type="file" class="comprobante" data-id="${r.id}">
      </div>
    `);
  });

  $$(".comprobante").forEach(inp =>
    inp.addEventListener("change", async () => {
      const file = inp.files[0];
      if (!file) return;
      const id = inp.dataset.id;
      const res = await uploadImageToDrive(file, "proofs");
      if (res.ok) {
        await fetch(`${SHEETDB_URL}/id/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comprobante: res.url, estado: "por validar pago" })
        });
        notify("Comprobante subido correctamente ✅");
      } else notify("Error al subir comprobante ❌", false);
    })
  );
}

/* ========================
   🔹 Calificación artistas
======================== */
function renderRatingForm(artistaId) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Calificar al artista</h3>
      <div id="starSelector">
        ${[1,2,3,4,5].map(i => `<span data-v="${i}" style="font-size:28px;cursor:pointer;">★</span>`).join("")}
      </div>
      <textarea id="reseña" placeholder="Escribe tu opinión..."></textarea>
      <button id="enviarRating" class="primary">Enviar</button>
      <button onclick="this.closest('.modal').remove()">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);

  let rating = 0;
  $$("#starSelector span").forEach(s => s.onclick = () => {
    rating = Number(s.dataset.v);
    $$("#starSelector span").forEach(st => st.style.color = st.dataset.v <= rating ? "#facc15" : "#475569");
  });

  $("#enviarRating").onclick = async () => {
    await fetch(`${SHEETDB_URL}/id/${artistaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, reseña: $("#reseña").value })
    });
    notify("Calificación enviada ⭐");
    modal.remove();
    loadArtistas();
  };
}

/* ========================
   🔹 Inicialización
======================== */
window.addEventListener("DOMContentLoaded", loadArtistas);
