import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentRole = null;
let currentHotelId = null;
let hotelsCache = [];

const $ = (id) => document.getElementById(id);

function formatMoney(amount, currency) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: currency || "MXN" }).format(amount || 0);
}

async function loadHotelsCache() {
  const snapshot = await getDocs(collection(db, "hotels"));
  hotelsCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

function populateHotelSelects() {
  const contextSelect = $("hotel-context-select");
  const adminHotelSelect = $("new-admin-hotel");

  [contextSelect, adminHotelSelect].forEach((select) => {
    select.innerHTML = "";
    hotelsCache.forEach((hotel) => {
      const option = document.createElement("option");
      option.value = hotel.id;
      option.textContent = hotel.propertyName || hotel.id;
      select.appendChild(option);
    });
  });

  if (hotelsCache.length > 0) {
    contextSelect.value = currentHotelId || hotelsCache[0].id;
  }
}

async function loadReservations() {
  const tbody = $("reservations-tbody");
  if (!currentHotelId) {
    tbody.innerHTML = `<tr><td colspan="9">Selecciona o crea un hotel primero.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="9">Cargando reservaciones...</td></tr>`;

  const q = query(collection(db, "reservations"), where("hotelId", "==", currentHotelId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    tbody.innerHTML = `<tr><td colspan="9">Aún no hay reservaciones.</td></tr>`;
    return;
  }

  const reservations = snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) => (a.checkIn > b.checkIn ? 1 : -1));

  tbody.innerHTML = "";
  reservations.forEach((r) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${r.id}</td>
      <td>${r.roomTitle || r.roomId}</td>
      <td>${r.checkIn}</td>
      <td>${r.checkOut}</td>
      <td>${r.guests}</td>
      <td>${r.guestName}<br><small>${r.guestEmail} · ${r.guestPhone}</small></td>
      <td>${formatMoney(r.totalPrice, r.currency)}</td>
      <td><span class="status-badge status-${r.status}">${r.status}</span></td>
      <td>
        ${r.status !== "cancelled" ? `<button class="btn-small btn-cancel" data-id="${r.id}">Cancelar</button>` : ""}
        <button class="btn-small btn-delete" data-id="${r.id}">Eliminar</button>
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

async function loadRoomsEditor() {
  const list = $("rooms-editor-list");
  if (!currentHotelId) {
    list.innerHTML = "<p>Selecciona o crea un hotel primero.</p>";
    return;
  }

  const snapshot = await getDocs(collection(db, "hotels", currentHotelId, "rooms"));
  list.innerHTML = "";
  snapshot.forEach((roomDoc) => {
    list.appendChild(buildRoomEditorCard(roomDoc.id, roomDoc.data()));
  });
}

function buildRoomEditorCard(roomId, room) {
  const card = document.createElement("div");
  card.className = "room-editor-card";

  card.innerHTML = `
    <div class="room-editor-header">
      <h3>${room.title || "Habitación"}</h3>
      <div>
        <button type="button" class="btn-small btn-cancel" data-action="save-room">Guardar</button>
        <button type="button" class="btn-small btn-delete" data-action="remove-room">Eliminar</button>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Título</label>
        <input type="text" data-field="title" value="${room.title || ""}">
      </div>
      <div class="form-group">
        <label>Máx. huéspedes</label>
        <input type="number" min="1" data-field="maxGuests" value="${room.maxGuests || 1}">
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
        <input type="number" min="0" step="0.01" data-field="baseRate" value="${room.baseRate ?? 0}">
      </div>
      <div class="form-group">
        <label>Moneda</label>
        <input type="text" data-field="currency" value="${room.currency || "MXN"}">
      </div>
      <div class="form-group">
        <label>Código de tarifa</label>
        <input type="text" data-field="rateCode" value="${room.rateCode || "BAR"}">
      </div>
    </div>
    <div class="form-group">
      <label>Características (separadas por coma)</label>
      <input type="text" data-field="features" value="${(room.features || []).join(", ")}">
    </div>
    <div class="form-group-checkbox">
      <input type="checkbox" id="available-${roomId}" data-field="isAvailable" ${room.isAvailable ? "checked" : ""}>
      <label for="available-${roomId}">Disponible para reservar</label>
    </div>
  `;

  const getVal = (field) => card.querySelector(`[data-field="${field}"]`).value;

  card.querySelector('[data-action="save-room"]').addEventListener("click", async () => {
    await updateDoc(doc(db, "hotels", currentHotelId, "rooms", roomId), {
      title: getVal("title"),
      description: getVal("description"),
      imageUrl: getVal("imageUrl"),
      baseRate: parseFloat(getVal("baseRate")) || 0,
      currency: getVal("currency"),
      rateCode: getVal("rateCode"),
      maxGuests: parseInt(getVal("maxGuests"), 10) || 1,
      features: getVal("features").split(",").map((f) => f.trim()).filter(Boolean),
      isAvailable: card.querySelector('[data-field="isAvailable"]').checked
    });
    loadRoomsEditor();
  });

  card.querySelector('[data-action="remove-room"]').addEventListener("click", async () => {
    if (confirm("¿Eliminar esta habitación?")) {
      await deleteDoc(doc(db, "hotels", currentHotelId, "rooms", roomId));
      loadRoomsEditor();
    }
  });

  return card;
}

async function addEmptyRoom() {
  if (!currentHotelId) {
    alert("Selecciona o crea un hotel primero.");
    return;
  }
  await addDoc(collection(db, "hotels", currentHotelId, "rooms"), {
    title: "Nueva Habitación",
    description: "",
    imageUrl: "",
    baseRate: 0,
    currency: "MXN",
    rateCode: "BAR",
    maxGuests: 2,
    features: [],
    isAvailable: true
  });
  loadRoomsEditor();
}

function renderHotelsAdminList() {
  const container = $("hotels-admin-list");
  if (hotelsCache.length === 0) {
    container.innerHTML = "<p>Aún no hay hoteles creados.</p>";
    return;
  }
  container.innerHTML = `
    <table class="reservations-table">
      <thead><tr><th>Identificador</th><th>Nombre</th><th>Ubicación</th></tr></thead>
      <tbody>
        ${hotelsCache.map((h) => `<tr><td>${h.id}</td><td>${h.propertyName || ""}</td><td>${h.location || ""}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

async function createHotel(event) {
  event.preventDefault();
  const statusEl = $("create-hotel-status");
  statusEl.textContent = "";
  statusEl.style.color = "";

  const hotelId = $("new-hotel-id").value.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(hotelId)) {
    statusEl.textContent = "El identificador solo puede tener letras minúsculas, números y guiones.";
    return;
  }

  const existing = await getDoc(doc(db, "hotels", hotelId));
  if (existing.exists()) {
    statusEl.textContent = "Ya existe un hotel con ese identificador.";
    return;
  }

  await setDoc(doc(db, "hotels", hotelId), {
    propertyName: $("new-hotel-name").value.trim(),
    location: $("new-hotel-location").value.trim(),
    currency: $("new-hotel-currency").value.trim() || "MXN",
    checkInTime: "15:00",
    checkOutTime: "12:00",
    heroHeadline: $("new-hotel-headline").value.trim(),
    heroSubheadline: $("new-hotel-subheadline").value.trim(),
    heroImage: $("new-hotel-image").value.trim(),
    createdAt: serverTimestamp()
  });

  statusEl.style.color = "#1e7e34";
  statusEl.textContent = `Hotel creado. URL: /hotel/${hotelId}`;
  $("create-hotel-form").reset();
  $("new-hotel-currency").value = "MXN";

  await loadHotelsCache();
  populateHotelSelects();
  renderHotelsAdminList();
}

async function createHotelAdmin(event) {
  event.preventDefault();
  const statusEl = $("create-admin-status");
  statusEl.textContent = "";
  statusEl.style.color = "";

  const email = $("new-admin-email").value.trim();
  const password = $("new-admin-password").value;
  const hotelId = $("new-admin-hotel").value;

  if (!hotelId) {
    statusEl.textContent = "Crea un hotel primero.";
    return;
  }

  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, "adminUsers", credential.user.uid), {
      role: "hotel_admin",
      hotelId
    });
    await signOut(secondaryAuth);

    statusEl.style.color = "#1e7e34";
    statusEl.textContent = `Administrador creado para ${hotelId}.`;
    $("create-admin-form").reset();
  } catch (error) {
    console.error("Error al crear administrador:", error);
    statusEl.textContent = "No se pudo crear el administrador: " + error.message;
  } finally {
    await deleteApp(secondaryApp);
  }
}

async function importFromDataJson() {
  const statusEl = $("import-status");
  statusEl.textContent = "";
  statusEl.style.color = "";

  const hotelId = $("import-hotel-id").value.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(hotelId)) {
    statusEl.textContent = "El identificador solo puede tener letras minúsculas, números y guiones.";
    return;
  }

  try {
    const response = await fetch("/data.json");
    const data = await response.json();

    await setDoc(doc(db, "hotels", hotelId), {
      propertyName: data.hotelSettings.propertyName,
      location: data.hotelSettings.location,
      currency: data.hotelSettings.currency || "MXN",
      checkInTime: data.hotelSettings.checkInTime || "15:00",
      checkOutTime: data.hotelSettings.checkOutTime || "12:00",
      heroHeadline: data.heroSection.headline,
      heroSubheadline: data.heroSection.subheadline,
      heroImage: data.heroSection.heroImage,
      createdAt: serverTimestamp()
    });

    for (const room of data.roomInventory) {
      await setDoc(doc(db, "hotels", hotelId, "rooms", room.roomId), {
        title: room.title,
        description: room.description,
        imageUrl: room.imageUrl,
        baseRate: room.pricing.baseRate,
        currency: room.pricing.currency,
        rateCode: room.pricing.rateCode,
        maxGuests: room.maxGuests || 2,
        features: room.features || [],
        isAvailable: room.isAvailable
      });
    }

    const reservationsSnapshot = await getDocs(collection(db, "reservations"));
    let tagged = 0;
    for (const reservationDoc of reservationsSnapshot.docs) {
      if (!reservationDoc.data().hotelId) {
        await updateDoc(doc(db, "reservations", reservationDoc.id), { hotelId });
        tagged++;
      }
    }

    statusEl.style.color = "#1e7e34";
    statusEl.textContent = `Hotel "${hotelId}" importado con ${data.roomInventory.length} habitación(es). ${tagged} reservación(es) existentes actualizadas.`;

    await loadHotelsCache();
    populateHotelSelects();
    renderHotelsAdminList();
  } catch (error) {
    console.error("Error al importar data.json:", error);
    statusEl.textContent = "No se pudo completar la importación: " + error.message;
  }
}

async function enterDashboard(user) {
  const adminSnap = await getDoc(doc(db, "adminUsers", user.uid));

  if (!adminSnap.exists()) {
    $("login-screen").classList.add("hidden");
    $("dashboard-screen").classList.add("hidden");
    $("no-role-screen").classList.remove("hidden");
    return;
  }

  const adminData = adminSnap.data();
  currentRole = adminData.role;

  $("login-screen").classList.add("hidden");
  $("no-role-screen").classList.add("hidden");
  $("dashboard-screen").classList.remove("hidden");
  $("admin-email-label").textContent = user.email;

  if (currentRole === "superadmin") {
    $("admin-role-label").textContent = "Super-administrador";
    $("hotel-context-wrap").classList.remove("hidden");
    $("tab-btn-hotels").classList.remove("hidden");

    await loadHotelsCache();
    populateHotelSelects();
    renderHotelsAdminList();
    currentHotelId = hotelsCache.length > 0 ? hotelsCache[0].id : null;
  } else {
    $("admin-role-label").textContent = `Administrador de ${adminData.hotelId}`;
    $("hotel-context-wrap").classList.add("hidden");
    $("tab-btn-hotels").classList.add("hidden");
    currentHotelId = adminData.hotelId;
  }

  loadReservations();
  loadRoomsEditor();
}

function initTabs() {
  const tabs = {
    reservations: { btn: $("tab-btn-reservations"), panel: $("tab-reservations") },
    rates: { btn: $("tab-btn-rates"), panel: $("tab-rates") },
    hotels: { btn: $("tab-btn-hotels"), panel: $("tab-hotels") }
  };

  Object.entries(tabs).forEach(([key, { btn }]) => {
    btn.addEventListener("click", () => {
      Object.entries(tabs).forEach(([otherKey, { btn: otherBtn, panel: otherPanel }]) => {
        const isActive = otherKey === key;
        otherBtn.classList.toggle("active", isActive);
        otherPanel.classList.toggle("hidden", !isActive);
      });
    });
  });
}

function init() {
  initTabs();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      enterDashboard(user);
    } else {
      $("dashboard-screen").classList.add("hidden");
      $("no-role-screen").classList.add("hidden");
      $("login-screen").classList.remove("hidden");
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
  $("no-role-logout-btn").addEventListener("click", () => signOut(auth));
  $("refresh-btn").addEventListener("click", loadReservations);
  $("add-room-btn").addEventListener("click", addEmptyRoom);
  $("create-hotel-form").addEventListener("submit", createHotel);
  $("create-admin-form").addEventListener("submit", createHotelAdmin);
  $("import-data-json-btn").addEventListener("click", importFromDataJson);

  $("hotel-context-select").addEventListener("change", (event) => {
    currentHotelId = event.target.value;
    loadReservations();
    loadRoomsEditor();
  });
}

document.addEventListener("DOMContentLoaded", init);
