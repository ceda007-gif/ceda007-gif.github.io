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
let occupancyByDate = new Map();
let calendarViewMonth = null;
let selection = { checkIn: null, checkOut: null };

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

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

function rateForRoomOnDate(room, dateStr) {
  const override = room.pricing.dateOverrides && room.pricing.dateOverrides[dateStr];
  return override !== undefined ? override : room.pricing.baseRate;
}

function calculateStayTotal(room, checkIn, checkOut) {
  let total = 0;
  let cursor = checkIn;
  while (cursor < checkOut) {
    total += rateForRoomOnDate(room, cursor);
    cursor = addDays(cursor, 1);
  }
  return total;
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
  $("calendar-currency").textContent = hotelData.hotelSettings.currency || "MXN";

  selection = { checkIn: todayISO(), checkOut: addDays(todayISO(), 1) };
  updateDatesSummary();

  const today = new Date();
  calendarViewMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  await buildOccupancyMap();
  renderCalendar();

  renderAllRooms(hotelData.roomInventory);
}

async function buildOccupancyMap() {
  occupancyByDate = new Map();
  const snapshot = await getDocs(collection(db, "reservations"));

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.status === "cancelled") return;

    let cursor = data.checkIn;
    while (cursor < data.checkOut) {
      if (!occupancyByDate.has(cursor)) {
        occupancyByDate.set(cursor, new Set());
      }
      occupancyByDate.get(cursor).add(data.roomId);
      cursor = addDays(cursor, 1);
    }
  });
}

function updateDatesSummary() {
  $("summary-checkin").textContent = selection.checkIn || "--";
  $("summary-checkout").textContent = selection.checkOut || "--";
}

function renderCalendar() {
  $("cal-month-label").textContent = `${MONTH_NAMES[calendarViewMonth.getMonth()]} ${calendarViewMonth.getFullYear()}`;

  const grid = $("calendar-grid");
  grid.innerHTML = "";

  const year = calendarViewMonth.getFullYear();
  const month = calendarViewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();
  const availableRooms = hotelData.roomInventory.filter((room) => room.isAvailable);

  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day cal-day-empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const bookedRoomIds = occupancyByDate.get(dateStr) || new Set();
    const freeRooms = availableRooms.filter((room) => !bookedRoomIds.has(room.roomId));
    const isPast = dateStr < today;
    const soldOut = freeRooms.length === 0;

    const cell = document.createElement("div");
    cell.className = "cal-day";
    cell.dataset.date = dateStr;

    if (isPast || soldOut) {
      cell.classList.add("cal-day-disabled");
    } else {
      const lowestRate = Math.min(...freeRooms.map((room) => rateForRoomOnDate(room, dateStr)));
      cell.addEventListener("click", () => onCalendarDayClick(dateStr));

      if (dateStr === selection.checkIn || dateStr === selection.checkOut) {
        cell.classList.add("cal-day-selected");
      } else if (selection.checkIn && selection.checkOut && dateStr > selection.checkIn && dateStr < selection.checkOut) {
        cell.classList.add("cal-day-in-range");
      }

      cell.innerHTML = `
        <span class="cal-day-number">${day}</span>
        <span class="cal-day-price">${Math.round(lowestRate)}</span>
      `;
      grid.appendChild(cell);
      continue;
    }

    cell.innerHTML = `<span class="cal-day-number">${day}</span>`;
    grid.appendChild(cell);
  }

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  $("cal-prev-btn").disabled = calendarViewMonth <= currentMonthStart;
}

function onCalendarDayClick(dateStr) {
  if (!selection.checkIn || (selection.checkIn && selection.checkOut)) {
    selection = { checkIn: dateStr, checkOut: null };
  } else if (dateStr > selection.checkIn) {
    selection.checkOut = dateStr;
  } else {
    selection = { checkIn: dateStr, checkOut: null };
  }

  updateDatesSummary();
  renderCalendar();
}

function navigateMonth(offset) {
  calendarViewMonth = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth() + offset, 1);
  renderCalendar();
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
  const checkIn = selection.checkIn;
  const checkOut = selection.checkOut;
  const guests = parseInt($("search-guests").value, 10);

  if (!checkIn || !checkOut || checkOut <= checkIn) {
    alert("Selecciona tus fechas de llegada y salida en el calendario.");
    return;
  }

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

  const total = calculateStayTotal(room, availability.checkIn, availability.checkOut);
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
      await buildOccupancyMap();
      renderCalendar();
      searchAvailability();
      return;
    }

    const total = calculateStayTotal(room, availability.checkIn, availability.checkOut);
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
    await buildOccupancyMap();
    renderCalendar();

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
  $("cal-prev-btn").addEventListener("click", () => navigateMonth(-1));
  $("cal-next-btn").addEventListener("click", () => navigateMonth(1));
}

document.addEventListener("DOMContentLoaded", init);
