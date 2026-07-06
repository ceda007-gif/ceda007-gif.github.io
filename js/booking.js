import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, emailjsConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let hotelData = null;
let selectedRoom = null;
let searchDates = { checkIn: null, checkOut: null, guests: 1 };

const $ = (id) => document.getElementById(id);

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function nightsBetween(checkIn, checkOut) {
  const a = new Date(checkIn + "T00:00:00");
  const b = new Date(checkOut + "T00:00:00");
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount);
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

async function loadHotelData() {
  const response = await fetch("data.json");
  hotelData = await response.json();

  document.title = hotelData.hotelSettings.propertyName;
  $("hotel-logo").textContent = hotelData.hotelSettings.propertyName;
  $("footer-hotel-name").textContent = hotelData.hotelSettings.propertyName;
  $("footer-location").textContent = hotelData.hotelSettings.location;

  $("hero-headline").textContent = hotelData.heroSection.headline;
  $("hero-subheadline").textContent = hotelData.heroSection.subheadline;
  $("hero-section").style.backgroundImage = `url('${hotelData.heroSection.heroImage}')`;

  const checkInInput = $("search-checkin");
  const checkOutInput = $("search-checkout");
  checkInInput.min = todayISO();
  checkInInput.value = todayISO();
  checkOutInput.min = addDays(todayISO(), 1);
  checkOutInput.value = addDays(todayISO(), 1);

  checkInInput.addEventListener("change", () => {
    checkOutInput.min = addDays(checkInInput.value, 1);
    if (checkOutInput.value <= checkInInput.value) {
      checkOutInput.value = addDays(checkInInput.value, 1);
    }
  });

  renderAllRooms(hotelData.roomInventory);
}

function renderAllRooms(rooms) {
  const container = $("rooms-container");
  container.innerHTML = "";
  $("rooms-heading").textContent = "Nuestras Habitaciones y Suites";
  $("rooms-hint").textContent = "Elige tus fechas y número de huéspedes arriba, luego presiona \"Buscar disponibilidad\".";

  rooms
    .filter((room) => room.isAvailable)
    .forEach((room) => container.appendChild(buildRoomCard(room, null)));
}

function buildRoomCard(room, availability) {
  const card = document.createElement("div");
  card.className = "room-card";

  const formattedPrice = formatMoney(room.pricing.baseRate, room.pricing.currency);

  const actionHtml =
    availability === null
      ? ""
      : availability.available
      ? `<button class="btn-book btn-reserve-room" data-room-id="${room.roomId}">Reservar</button>`
      : `<span class="room-unavailable">No disponible en estas fechas</span>`;

  card.innerHTML = `
    <img src="${room.imageUrl}" alt="${room.title}">
    <div>
      <h3>${room.title}</h3>
      <p>${room.description}</p>
      <p class="room-features">${room.features.join(" · ")}</p>
    </div>
    <div class="room-pricing">
      <span class="price-amount">${formattedPrice} <span style="font-size:12px; font-weight:normal;">/ noche ${room.pricing.currency}</span></span>
      <span class="rate-code">${room.pricing.rateCode}</span>
    </div>
    <div class="room-action">${actionHtml}</div>
  `;

  if (availability && availability.available) {
    card.querySelector(".btn-reserve-room").addEventListener("click", () => {
      openBookingModal(room, availability);
    });
  }

  return card;
}

async function isRoomAvailable(roomId, checkIn, checkOut) {
  const reservationsRef = collection(db, "reservations");
  const q = query(reservationsRef, where("roomId", "==", roomId));
  const snapshot = await getDocs(q);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.status === "cancelled") continue;
    if (rangesOverlap(checkIn, checkOut, data.checkIn, data.checkOut)) {
      return false;
    }
  }
  return true;
}

async function searchAvailability() {
  const checkIn = $("search-checkin").value;
  const checkOut = $("search-checkout").value;
  const guests = parseInt($("search-guests").value, 10);

  if (!checkIn || !checkOut || checkOut <= checkIn) {
    alert("Selecciona fechas de llegada y salida válidas.");
    return;
  }

  searchDates = { checkIn, checkOut, guests };

  const container = $("rooms-container");
  const nights = nightsBetween(checkIn, checkOut);
  $("rooms-heading").textContent = `Disponibilidad del ${checkIn} al ${checkOut} (${nights} noche${nights > 1 ? "s" : ""})`;
  $("rooms-hint").textContent = "Verificando disponibilidad...";
  container.innerHTML = "";

  const candidateRooms = hotelData.roomInventory.filter(
    (room) => room.isAvailable && (!room.maxGuests || room.maxGuests >= guests)
  );

  const results = await Promise.all(
    candidateRooms.map(async (room) => ({
      room,
      available: await isRoomAvailable(room.roomId, checkIn, checkOut)
    }))
  );

  $("rooms-hint").textContent = "";
  container.innerHTML = "";
  results.forEach(({ room, available }) => {
    container.appendChild(
      buildRoomCard(room, { available, checkIn, checkOut, nights, guests })
    );
  });

  if (!results.some((r) => r.available)) {
    $("rooms-hint").textContent = "No hay habitaciones disponibles para esas fechas. Intenta otro rango.";
  }
}

function openBookingModal(room, availability) {
  selectedRoom = { room, availability };

  const total = room.pricing.baseRate * availability.nights;
  $("modal-room-title").textContent = room.title;
  $("modal-summary").innerHTML = `
    <p><strong>Llegada:</strong> ${availability.checkIn}</p>
    <p><strong>Salida:</strong> ${availability.checkOut}</p>
    <p><strong>Noches:</strong> ${availability.nights}</p>
    <p><strong>Huéspedes:</strong> ${availability.guests}</p>
    <p><strong>Total:</strong> ${formatMoney(total, room.pricing.currency)}</p>
  `;

  $("guest-form").reset();
  $("guest-count-input").value = availability.guests;
  $("booking-modal").classList.add("open");
  $("modal-step-form").classList.remove("hidden");
  $("modal-step-confirmation").classList.add("hidden");
}

function closeBookingModal() {
  $("booking-modal").classList.remove("open");
  selectedRoom = null;
}

async function submitReservation(event) {
  event.preventDefault();
  if (!selectedRoom) return;

  const { room, availability } = selectedRoom;
  const submitBtn = $("guest-form-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Verificando disponibilidad...";

  try {
    const stillAvailable = await isRoomAvailable(room.roomId, availability.checkIn, availability.checkOut);
    if (!stillAvailable) {
      alert("Lo sentimos, esta habitación acaba de ser reservada por otro huésped para esas fechas. Elige otra habitación u otras fechas.");
      closeBookingModal();
      searchAvailability();
      return;
    }

    const total = room.pricing.baseRate * availability.nights;
    const reservation = {
      roomId: room.roomId,
      roomTitle: room.title,
      checkIn: availability.checkIn,
      checkOut: availability.checkOut,
      nights: availability.nights,
      guests: parseInt($("guest-count-input").value, 10),
      totalPrice: total,
      currency: room.pricing.currency,
      guestName: $("guest-name-input").value.trim(),
      guestEmail: $("guest-email-input").value.trim(),
      guestPhone: $("guest-phone-input").value.trim(),
      notes: $("guest-notes-input").value.trim(),
      status: "confirmed",
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "reservations"), reservation);

    await sendConfirmationEmail(reservation, docRef.id);

    $("modal-step-form").classList.add("hidden");
    $("modal-step-confirmation").classList.remove("hidden");
    $("confirmation-details").innerHTML = `
      <p>Folio de reservación: <strong>${docRef.id}</strong></p>
      <p>${room.title} · ${availability.checkIn} → ${availability.checkOut}</p>
      <p>Total: ${formatMoney(total, room.pricing.currency)}</p>
      <p>Enviamos los detalles a ${reservation.guestEmail}.</p>
    `;
  } catch (error) {
    console.error("Error al crear la reservación:", error);
    alert("Ocurrió un error al guardar tu reservación. Por favor intenta de nuevo.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmar reserva";
  }
}

async function sendConfirmationEmail(reservation, reservationId) {
  if (!emailjsConfig.publicKey || !window.emailjs) return;

  try {
    await window.emailjs.send(emailjsConfig.serviceId, emailjsConfig.templateId, {
      guest_name: reservation.guestName,
      guest_email: reservation.guestEmail,
      room_title: reservation.roomTitle,
      check_in: reservation.checkIn,
      check_out: reservation.checkOut,
      total_price: formatMoney(reservation.totalPrice, reservation.currency),
      reservation_id: reservationId
    }, emailjsConfig.publicKey);
  } catch (error) {
    console.error("No se pudo enviar el correo de confirmación:", error);
  }
}

function init() {
  loadHotelData().catch((error) => {
    console.error("Error al cargar la configuración de la página:", error);
    $("hero-headline").textContent = "Error al cargar la información";
  });

  $("btn-search-availability").addEventListener("click", searchAvailability);
  $("guest-form").addEventListener("submit", submitReservation);
  $("modal-close-btn").addEventListener("click", closeBookingModal);
  $("confirmation-close-btn").addEventListener("click", closeBookingModal);
}

document.addEventListener("DOMContentLoaded", init);
