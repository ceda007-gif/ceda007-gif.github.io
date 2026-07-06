# carlos.davis

## Motor de reservaciones de hotel

Este sitio incluye un motor de reservaciones completo hecho con HTML/CSS/JS
puro (sin frameworks ni build), pensado para hospedarse en GitHub Pages.

- `index.html` — Sitio del hotel: búsqueda de disponibilidad por fechas y
  huéspedes, tarjetas de habitaciones, y flujo de reservación (formulario
  del huésped → confirmación).
- `admin.html` — Panel de administración protegido con inicio de sesión,
  donde se ven todas las reservaciones y se pueden cancelar o eliminar.
- `data.json` — Contenido editable del sitio (nombre del hotel, hero,
  inventario de habitaciones y precios).
- `js/booking.js` — Lógica del flujo de búsqueda/reservación.
- `js/admin.js` — Lógica del panel de administración.
- `js/firebase-config.js` — Configuración de Firebase y EmailJS (debes
  completarla, ver abajo).
- `firestore.rules` — Reglas de seguridad de Firestore que debes publicar
  en tu proyecto de Firebase.

Las reservaciones se guardan en **Firebase Firestore**, y el envío del
correo de confirmación usa **EmailJS**. Ambos tienen planes gratuitos y no
requieren tarjeta de crédito para este uso.

### 1. Crear el proyecto de Firebase

1. Ve a https://console.firebase.google.com y crea un proyecto nuevo (gratis).
2. En el menú lateral, entra a **Compilación → Firestore Database** →
   "Crear base de datos" → modo producción → elige la región más cercana.
3. Entra a **Compilación → Authentication → Sign-in method** y habilita el
   proveedor **Correo electrónico/Contraseña**.
4. Ve a la pestaña **Users** de Authentication → "Agregar usuario" → crea
   tu cuenta de administrador (el correo/contraseña con los que entrarás a
   `admin.html`).
5. Ve a **Configuración del proyecto** (ícono de engrane) → baja hasta
   "Tus apps" → agrega una app web (ícono `</>`) → te mostrará un objeto
   `firebaseConfig`.
6. Abre `js/firebase-config.js` en este repositorio y reemplaza los
   valores de `firebaseConfig` con los que te dio Firebase.

### 2. Publicar las reglas de seguridad

1. En Firestore Database, ve a la pestaña **Reglas**.
2. Copia el contenido de `firestore.rules` (en la raíz de este repo) y
   pégalo, reemplazando lo que había.
3. Presiona **Publicar**.

Estas reglas permiten que cualquier visitante cree una reservación (para
que el formulario público funcione), pero solo tu usuario autenticado
puede ver, editar o borrar reservaciones desde `admin.html`.

### 3. Configurar EmailJS (correo de confirmación) — opcional

1. Crea una cuenta gratuita en https://www.emailjs.com
2. En **Email Services**, conecta tu cuenta de Gmail/Outlook y copia el
   **Service ID**.
3. En **Email Templates**, crea una plantilla usando variables como
   `{{guest_name}}`, `{{room_title}}`, `{{check_in}}`, `{{check_out}}`,
   `{{total_price}}`, `{{reservation_id}}`. Copia el **Template ID**.
4. En **Account → General**, copia tu **Public Key**.
5. Pega los tres valores en `emailjsConfig` dentro de
   `js/firebase-config.js`.

Si dejas `emailjsConfig.publicKey` vacío, el sitio funciona igual pero
simplemente no envía el correo de confirmación (la reservación se guarda
normalmente en Firestore).

### 4. Editar el contenido del hotel

Todo el contenido visible (nombre, imágenes, habitaciones, precios) está
en `data.json`. Puedes editarlo directamente en el repositorio, o usar la
pestaña **"Tarifas y Habitaciones"** dentro de `admin.html` (ver siguiente
sección).

### 4.1 Editar tarifas desde el panel admin

La pestaña "Tarifas y Habitaciones" de `admin.html` permite agregar,
editar o eliminar habitaciones y precios sin tocar código. Como este es un
sitio estático (sin servidor propio), guarda los cambios haciendo un
commit a `data.json` directamente vía la API de GitHub, usando un token
que tú generas:

1. Ve a https://github.com/settings/personal-access-tokens/new
2. Crea un token **"Fine-grained"** limitado solo al repositorio
   `ceda007-gif.github.io` (no a toda tu cuenta), con permiso
   **Repository permissions → Contents: Read and write**.
3. En `admin.html`, pestaña "Tarifas y Habitaciones", pega el token y
   presiona "Cargar tarifas".
4. Edita lo que necesites y presiona "Guardar cambios en GitHub". Esto
   crea un commit directo a `main`; GitHub Pages lo publica en ~1 minuto.

El token solo vive en la memoria de esa pestaña del navegador (nunca se
guarda en el código ni en Firestore) — tendrás que pegarlo de nuevo cada
vez que quieras editar tarifas. Guárdalo en un lugar seguro y no lo
compartas: quien lo tenga puede escribir en este repositorio.

### 5. Publicar

Con GitHub Pages, basta con hacer push a la rama publicada como sitio
(usualmente `main`). No hay paso de build.

### Notas y límites conocidos

- La verificación de disponibilidad se hace desde el navegador en el
  momento de reservar; si dos personas reservan la misma habitación en el
  mismo segundo podría haber una colisión rara. Para un hotel pequeño esto
  es aceptable; para mayor volumen se recomendaría mover esta validación a
  una Cloud Function con una transacción.
- El panel de administración usa Firebase Authentication (no una
  contraseña fija en el código), por lo que es seguro exponer este sitio
  públicamente: solo quien tenga una cuenta creada en tu proyecto de
  Firebase puede ver o modificar las reservaciones.
