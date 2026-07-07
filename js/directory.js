import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

async function loadHotels() {
  const container = $("hotels-container");
  const hint = $("hotels-hint");

  try {
    const snapshot = await getDocs(collection(db, "hotels"));

    if (snapshot.empty) {
      hint.textContent = "Todavía no hay hoteles publicados en esta plataforma.";
      return;
    }

    hint.textContent = "";
    snapshot.forEach((docSnap) => {
      const hotel = docSnap.data();
      container.appendChild(buildHotelCard(docSnap.id, hotel));
    });
  } catch (error) {
    console.error("Error al cargar los hoteles:", error);
    hint.textContent = "No se pudo cargar la lista de hoteles. Intenta de nuevo más tarde.";
  }
}

function buildHotelCard(hotelId, hotel) {
  const card = document.createElement("a");
  card.className = "hotel-card";
  card.href = `hotel/${hotelId}`;

  card.innerHTML = `
    <img src="${hotel.heroImage || ""}" alt="${hotel.propertyName}">
    <div class="hotel-card-body">
      <h3>${hotel.propertyName}</h3>
      <p>${hotel.location || ""}</p>
    </div>
  `;

  return card;
}

document.addEventListener("DOMContentLoaded", loadHotels);
