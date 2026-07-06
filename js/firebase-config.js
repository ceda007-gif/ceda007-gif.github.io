// Configuración de Firebase para el motor de reservaciones.
//
// CÓMO OBTENER ESTOS VALORES:
// 1. Ve a https://console.firebase.google.com y crea un proyecto (gratis).
// 2. Dentro del proyecto, entra a "Compilación" > "Firestore Database" y
//    crea una base de datos (modo producción, elige la región más cercana).
// 3. Ve a "Compilación" > "Authentication" > pestaña "Sign-in method" y
//    habilita el proveedor "Correo electrónico/Contraseña". Luego, en la
//    pestaña "Users", crea manualmente el usuario administrador (el correo
//    y contraseña con los que vas a entrar a admin.html).
// 4. Ve a "Configuración del proyecto" (ícono de engrane) > baja hasta
//    "Tus apps" > agrega una app web (ícono </>) > copia el objeto
//    `firebaseConfig` que te muestra y pégalo abajo, reemplazando los
//    valores de ejemplo.
// 5. Aplica las reglas de seguridad del archivo firestore.rules en la
//    pestaña "Reglas" de Firestore (ver README.md para instrucciones).
//
// Estas claves son seguras para exponer en el navegador: no son secretas,
// la protección real de tus datos la dan las reglas de Firestore.

export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx"
};

// Configuración de EmailJS para enviar el correo de confirmación al huésped.
//
// CÓMO OBTENER ESTOS VALORES:
// 1. Crea una cuenta gratuita en https://www.emailjs.com
// 2. Conecta un servicio de correo (Gmail, Outlook, etc.) en "Email Services"
//    y copia el "Service ID".
// 3. Crea una plantilla en "Email Templates" con variables como
//    {{guest_name}}, {{room_title}}, {{check_in}}, {{check_out}},
//    {{total_price}}, {{reservation_id}}. Copia el "Template ID".
// 4. En "Account" > "General" copia tu "Public Key".
// Si dejas emailjsPublicKey vacío, el sistema simplemente omite el envío
// de correo (la reserva se sigue guardando normalmente en Firestore).

export const emailjsConfig = {
  serviceId: "TU_SERVICE_ID",
  templateId: "TU_TEMPLATE_ID",
  publicKey: ""
};
