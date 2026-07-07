# carlos.davis

## Plataforma de reservaciones multi-hotel

Este sitio es una plataforma que administra las reservaciones de **varios
hoteles independientes**, cada uno con su propia página, habitaciones,
tarifas y administrador — no es una cadena, cada hotel es un inquilino
("tenant") separado. Está hecho con HTML/CSS/JS puro (sin frameworks ni
build), pensado para hospedarse en GitHub Pages.

### Estructura del sitio

- `index.html` — Directorio público: lista todos los hoteles publicados,
  cada uno enlaza a `/hotel/<identificador>`.
- `404.html` — El motor de reservaciones de un hotel individual (búsqueda
  de disponibilidad, calendario de tarifas, reservación). Gracias a un
  truco estándar de GitHub Pages, cualquier URL `/hotel/<id>` que no
  corresponde a un archivo real sirve el contenido de `404.html`
  mantendiendo esa URL limpia en la barra de direcciones. `<id>` se lee de
  `location.pathname` en tiempo de ejecución.
- `admin.html` — Panel de administración. Cada cuenta tiene un rol:
  - **`hotel_admin`**: solo ve y administra las reservaciones y tarifas de
    su propio hotel.
  - **`superadmin`**: además puede crear hoteles nuevos y crear cuentas de
    administrador para cada uno, desde la pestaña "Hoteles".
- `js/directory.js` — Lógica del directorio de hoteles (`index.html`).
- `js/hotel-booking.js` — Lógica del motor de reservas por hotel
  (`404.html`).
- `js/admin.js` — Lógica del panel de administración.
- `js/firebase-config.js` — Configuración de Firebase y EmailJS.
- `firestore.rules` — Reglas de seguridad de Firestore.
- `data.json` — Solo se usa como fuente para la **importación única** del
  hotel original ("Tropicana Los Cabos") al nuevo modelo multi-hotel (ver
  sección 5). Los hoteles creados después de esa migración no usan este
  archivo: viven enteramente en Firestore.

### Modelo de datos en Firestore

- `hotels/{hotelId}` — datos generales del hotel (nombre, ubicación,
  moneda, imagen principal, etc.). `hotelId` es el mismo identificador que
  aparece en la URL (`/hotel/{hotelId}`).
- `hotels/{hotelId}/rooms/{roomId}` — habitaciones y tarifas de ese hotel.
- `reservations/{reservationId}` — datos completos de cada reservación,
  incluyendo datos personales del huésped (nombre, correo, teléfono,
  notas); solo lectura/edición de administradores del hotel al que
  pertenece (campo `hotelId`).
- `availability/{reservationId}` — copia **pública** y sin datos
  personales de cada reservación (`hotelId`, `roomId`, `checkIn`,
  `checkOut`, `status`), con el mismo ID que su reservación
  correspondiente. El calendario de disponibilidad del sitio la usa para
  saber qué noches están ocupadas, sin que un visitante anónimo pueda leer
  nombres/correos de otros huéspedes.
- `adminUsers/{uid}` — el rol de cada cuenta de administrador:
  `{ role: "superadmin" }` o `{ role: "hotel_admin", hotelId: "..." }`.

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
   tu cuenta (el correo/contraseña con los que vas a entrar a
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

Si ya habías publicado una versión anterior de estas reglas (antes de que
existiera la colección `availability`), vuelve a hacer este paso: sin
ella, el calendario de disponibilidad del sitio fallará con
"Missing or insufficient permissions" para cualquier visitante que no
haya iniciado sesión.

### 3. Volverte super-administrador (paso único)

Como todavía no existe ningún administrador, este primer paso se hace a
mano, una sola vez, directamente en la consola de Firebase (las reglas de
seguridad no permiten crear este primer registro desde el propio sitio,
a propósito, para que nadie más pueda auto-asignarse el rol):

1. En Authentication → Users, copia el **UID** completo de tu usuario
   (la columna "UID del usuario").
2. Ve a Firestore Database → pestaña **Datos** → **"+ Iniciar colección"**.
3. ID de la colección: `adminUsers`.
4. ID del documento: pega tu **UID** (no lo escribas tú, debe ser exacto).
5. Agrega un campo: nombre `role`, tipo `string`, valor `superadmin`.
6. Guarda.

Con esto, al entrar a `admin.html` con tu cuenta verás la pestaña
"Hoteles" y podrás crear hoteles y otros administradores desde ahí sin
volver a tocar la consola.

### 4. Configurar EmailJS (correo de confirmación) — opcional

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
simplemente no envía el correo de confirmación.

### 5. Migrar el hotel original (Tropicana Los Cabos)

Este sitio ya tenía un hotel funcionando antes de volverse multi-hotel.
Para migrarlo al nuevo modelo, una sola vez:

1. Entra a `admin.html` con tu cuenta de super-administrador.
2. Ve a la pestaña **"Hoteles"**.
3. En "Importar el hotel existente desde data.json", confirma o cambia el
   identificador (por defecto `tropicana-los-cabos`) y presiona
   **"Importar desde data.json"**.

Esto crea el hotel y sus habitaciones en Firestore, y le asigna ese mismo
`hotelId` a cualquier reservación que ya existiera de antes (de cuando el
sitio todavía era de un solo hotel). El hotel migrado queda disponible en
`/hotel/tropicana-los-cabos` igual que cualquier otro.

### 6. Crear un hotel nuevo

Desde la pestaña "Hoteles" (solo visible para super-administradores):

1. Llena el formulario "Crear hotel nuevo" (identificador, nombre,
   ubicación, moneda, imagen principal). El identificador se vuelve la
   URL del hotel: `/hotel/<identificador>`.
2. Agrega sus habitaciones desde la pestaña "Tarifas y Habitaciones"
   (selecciona primero el hotel en el menú desplegable de arriba).
3. Opcionalmente, en "Crear administrador para un hotel", da de alta una
   cuenta que solo pueda administrar ese hotel específico (no verá los
   demás).

### 7. Calendario de tarifas para el huésped

`404.html` (la página de cada hotel) muestra un calendario mensual donde
cada día indica la tarifa más baja disponible esa noche (calculada entre
las habitaciones libres) y navega mes a mes. Los días donde **todas** las
habitaciones ya están reservadas se muestran tachados. El huésped hace
clic en un día para marcar la llegada y en otro para la salida.

Por defecto todas las noches usan `baseRate` de cada habitación. Para
precios distintos por fecha (temporada alta, fines de semana), agrega un
campo `dateOverrides` al documento de la habitación en Firestore, con el
formato `{ "2026-12-24": 4800, "2026-12-31": 5200 }`. Cualquier fecha sin
entrada ahí usa `baseRate` normalmente. (La edición de `dateOverrides`
desde el panel admin no está incluida todavía; se agrega directamente en
el documento desde la consola de Firestore.)

### 8. Publicar

Con GitHub Pages, basta con hacer push a la rama publicada como sitio
(usualmente `main`). No hay paso de build.

### Notas y límites conocidos

- La verificación de disponibilidad se hace desde el navegador en el
  momento de reservar; si dos personas reservan la misma habitación en el
  mismo segundo podría haber una colisión rara. Para mayor volumen se
  recomendaría mover esta validación a una Cloud Function con una
  transacción.
- `404.html` responde con estado HTTP 404 aunque el contenido se vea
  normal (es el truco que usa GitHub Pages para dar URLs limpias sin un
  servidor propio). Esto no afecta a las personas navegando el sitio, pero
  sí significa que estas páginas no se indexan bien en buscadores; si el
  SEO importa, a futuro conviene mover el hosting a algo con rutas del
  lado del servidor.
- El panel de administración usa Firebase Authentication con roles
  (`adminUsers`), no contraseñas fijas en el código: cada administrador
  solo ve el hotel que tiene asignado, excepto el/los super-administrador(es).
