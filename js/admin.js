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
import { firebaseConfig } from "./firebase-config.js";

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

function init() {
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
}

document.addEventListener("DOMContentLoaded", init);
