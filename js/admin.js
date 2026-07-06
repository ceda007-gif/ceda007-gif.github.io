import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, githubRepoConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

function formatMoney(amount, currency) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: currency || "MXN" }).format(amount || 0);
}

async function loadReservations() {
  const tbody = $("reservations-tbody");
  tbody.innerHTML = `<tr><td colspan="9">Cargando reservaciones...</td></tr>`;

  const q = query(collection(db, "reservations"), orderBy("checkIn", "asc"));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    tbody.innerHTML = `<tr><td colspan="9">Aún no hay reservaciones.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  snapshot.forEach((docSnap) => {
    const r = docSnap.data();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${docSnap.id}</td>
      <td>${r.roomTitle || r.roomId}</td>
      <td>${r.checkIn}</td>
      <td>${r.checkOut}</td>
      <td>${r.guests}</td>
      <td>${r.guestName}<br><small>${r.guestEmail} · ${r.guestPhone}</small></td>
      <td>${formatMoney(r.totalPrice, r.currency)}</td>
      <td><span class="status-badge status-${r.status}">${r.status}</span></td>
      <td>
        ${r.status !== "cancelled" ? `<button class="btn-small btn-cancel" data-id="${docSnap.id}">Cancelar</button>` : ""}
        <button class="btn-small btn-delete" data-id="${docSnap.id}">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll(".btn-cancel").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "reservations", btn.dataset.id), { status: "cancelled" });
      loadReservations();
    });
  });

  tbody.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("¿Eliminar esta reservación permanentemente?")) {
        await deleteDoc(doc(db, "reservations", btn.dataset.id));
        loadReservations();
      }
    });
  });
}

let hotelDataCache = null;
let dataSha = null;

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function loadRatesFromGitHub() {
  const token = $("github-token-input").value.trim();
  const statusEl = $("rates-status");
  statusEl.style.color = "";
  statusEl.textContent = "";

  if (!token) {
    statusEl.textContent = "Ingresa tu token de GitHub primero.";
    return;
  }

  try {
    const { owner, repo, branch, dataPath } = githubRepoConfig;
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${dataPath}?ref=${branch}`,
      { headers: githubHeaders(token) }
    );

    if (!response.ok) {
      throw new Error(`GitHub respondió ${response.status}`);
    }

    const fileData = await response.json();
    dataSha = fileData.sha;
    hotelDataCache = JSON.parse(base64ToUtf8(fileData.content));

    renderRoomsEditor();
    $("rates-editor").classList.remove("hidden");
  } catch (error) {
    console.error("Error al cargar data.json desde GitHub:", error);
    statusEl.textContent = "No se pudo cargar data.json. Verifica que el token sea válido y tenga permiso sobre este repositorio.";
  }
}

function renderRoomsEditor() {
  const list = $("rooms-editor-list");
  list.innerHTML = "";
  hotelDataCache.roomInventory.forEach((room, index) => {
    list.appendChild(buildRoomEditorCard(room, index));
  });
}

function buildRoomEditorCard(room, index) {
  const card = document.createElement("div");
  card.className = "room-editor-card";
  card.dataset.index = index;

  card.innerHTML = `
    <div class="room-editor-header">
      <h3>Habitación ${index + 1}</h3>
      <button type="button" class="btn-small btn-delete" data-action="remove-room">Eliminar</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>ID de habitación</label>
        <input type="text" data-field="roomId" value="${room.roomId || ""}">
      </div>
      <div class="form-group">
        <label>Título</label>
        <input type="text" data-field="title" value="${room.title || ""}">
      </div>
    </div>
    <div class="form-group">
      <label>Descripción</label>
      <input type="text" data-field="description" value="${room.description || ""}">
    </div>
    <div class="form-group">
      <label>URL de imagen</label>
      <input type="text" data-field="imageUrl" value="${room.imageUrl || ""}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tarifa base</label>
        <input type="number" min="0" step="0.01" data-field="baseRate" value="${room.pricing ? room.pricing.baseRate : 0}">
      </div>
      <div class="form-group">
        <label>Moneda</label>
        <input type="text" data-field="currency" value="${room.pricing ? room.pricing.currency : "MXN"}">
      </div>
      <div class="form-group">
        <label>Código de tarifa</label>
        <input type="text" data-field="rateCode" value="${room.pricing ? room.pricing.rateCode : "BAR"}">
      </div>
      <div class="form-group">
        <label>Máx. huéspedes</label>
        <input type="number" min="1" data-field="maxGuests" value="${room.maxGuests || 1}">
      </div>
    </div>
    <div class="form-group">
      <label>Características (separadas por coma)</label>
      <input type="text" data-field="features" value="${(room.features || []).join(", ")}">
    </div>
    <div class="form-group-checkbox">
      <input type="checkbox" id="available-${index}" data-field="isAvailable" ${room.isAvailable ? "checked" : ""}>
      <label for="available-${index}">Disponible para reservar</label>
    </div>
  `;

  card.querySelector('[data-action="remove-room"]').addEventListener("click", () => {
    collectRoomsFromEditor();
    hotelDataCache.roomInventory.splice(index, 1);
    renderRoomsEditor();
  });

  return card;
}

function collectRoomsFromEditor() {
  const cards = document.querySelectorAll(".room-editor-card");
  hotelDataCache.roomInventory = Array.from(cards).map((card) => {
    const getVal = (field) => card.querySelector(`[data-field="${field}"]`).value;
    return {
      roomId: getVal("roomId"),
      title: getVal("title"),
      description: getVal("description"),
      imageUrl: getVal("imageUrl"),
      pricing: {
        baseRate: parseFloat(getVal("baseRate")) || 0,
        currency: getVal("currency"),
        rateCode: getVal("rateCode")
      },
      maxGuests: parseInt(getVal("maxGuests"), 10) || 1,
      features: getVal("features").split(",").map((f) => f.trim()).filter(Boolean),
      isAvailable: card.querySelector('[data-field="isAvailable"]').checked
    };
  });
}

function addEmptyRoom() {
  if (!hotelDataCache) return;
  collectRoomsFromEditor();
  hotelDataCache.roomInventory.push({
    roomId: `HAB-${Date.now()}`,
    title: "Nueva Habitación",
    description: "",
    imageUrl: "",
    pricing: { baseRate: 0, currency: "MXN", rateCode: "BAR" },
    maxGuests: 2,
    features: [],
    isAvailable: true
  });
  renderRoomsEditor();
}

async function saveRatesToGitHub() {
  const token = $("github-token-input").value.trim();
  const statusEl = $("rates-status");
  const saveBtn = $("save-rates-btn");

  if (!token || !hotelDataCache) return;

  collectRoomsFromEditor();

  saveBtn.disabled = true;
  saveBtn.textContent = "Guardando...";
  statusEl.style.color = "";
  statusEl.textContent = "";

  try {
    const { owner, repo, branch, dataPath } = githubRepoConfig;
    const updatedContent = JSON.stringify(hotelDataCache, null, 2) + "\n";

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${dataPath}`,
      {
        method: "PUT",
        headers: githubHeaders(token),
        body: JSON.stringify({
          message: "Actualizar tarifas y habitaciones desde el panel admin",
          content: utf8ToBase64(updatedContent),
          sha: dataSha,
          branch
        })
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub respondió ${response.status}`);
    }

    const result = await response.json();
    dataSha = result.content.sha;
    statusEl.style.color = "#1e7e34";
    statusEl.textContent = "Cambios guardados. GitHub Pages tardará ~1 minuto en publicarlos.";
  } catch (error) {
    console.error("Error al guardar data.json en GitHub:", error);
    statusEl.style.color = "#b00020";
    statusEl.textContent = `No se pudo guardar: ${error.message}`;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Guardar cambios en GitHub";
  }
}

function initTabs() {
  const tabReservationsBtn = $("tab-btn-reservations");
  const tabRatesBtn = $("tab-btn-rates");

  tabReservationsBtn.addEventListener("click", () => {
    tabReservationsBtn.classList.add("active");
    tabRatesBtn.classList.remove("active");
    $("tab-reservations").classList.remove("hidden");
    $("tab-rates").classList.add("hidden");
  });

  tabRatesBtn.addEventListener("click", () => {
    tabRatesBtn.classList.add("active");
    tabReservationsBtn.classList.remove("active");
    $("tab-rates").classList.remove("hidden");
    $("tab-reservations").classList.add("hidden");
  });
}

function init() {
  initTabs();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      $("login-screen").classList.add("hidden");
      $("dashboard-screen").classList.remove("hidden");
      $("admin-email-label").textContent = user.email;
      loadReservations();
    } else {
      $("login-screen").classList.remove("hidden");
      $("dashboard-screen").classList.add("hidden");
    }
  });

  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("login-email").value.trim();
    const password = $("login-password").value;
    const errorBox = $("login-error");
    errorBox.textContent = "";

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      errorBox.textContent = "Correo o contraseña incorrectos.";
    }
  });

  $("logout-btn").addEventListener("click", () => signOut(auth));
  $("refresh-btn").addEventListener("click", loadReservations);

  $("load-rates-btn").addEventListener("click", loadRatesFromGitHub);
  $("add-room-btn").addEventListener("click", addEmptyRoom);
  $("save-rates-btn").addEventListener("click", saveRatesToGitHub);
}

document.addEventListener("DOMContentLoaded", init);
