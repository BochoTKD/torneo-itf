
// =================================
// 1. SELECTOR DE TEMA
// =================================

// Buscamos el botón de cambio de tema.
const botonTema = document.getElementById("btn-tema");

// Aplicamos el tema guardado o usamos el oscuro por defecto.
let temaActual = localStorage.getItem("tema") || "oscuro";

// Función para aplicar el tema.
function aplicarTema() {

    if (temaActual === "claro") {
        document.body.classList.add("tema-claro");

        botonTema.innerHTML = '<i data-lucide="moon"></i>';
        botonTema.setAttribute("aria-label", "Cambiar a tema oscuro");

    } else {
        document.body.classList.remove("tema-claro");

        botonTema.innerHTML = '<i data-lucide="sun"></i>';
        botonTema.setAttribute("aria-label", "Cambiar a tema claro");
    }

    // Actualizamos los iconos de Lucide.
    lucide.createIcons();
}

// Al pulsar el botón, cambiamos el tema.
botonTema.addEventListener("click", () => {

    temaActual = temaActual === "oscuro" ? "claro" : "oscuro";

    // Guardamos la preferencia.
    localStorage.setItem("tema", temaActual);

    aplicarTema();
});

// Aplicamos el tema al abrir la página.
aplicarTema();

// =================================
// 2. NAVEGACIÓN ENTRE PANTALLAS
// =================================

// Muestra una pantalla y oculta las demás.
function mostrarPantalla(id) {

    document.querySelectorAll(".pantalla").forEach(pantalla => {
        pantalla.classList.remove("activa");
    });

    document.getElementById(id).classList.add("activa");
}


// =================================
// 3. SELECCIÓN DE PERFIL
// =================================

document.getElementById("btn-participante").addEventListener("click", () => {
    mostrarPantalla("pantalla-participante");
});

document.getElementById("btn-profesor").addEventListener("click", () => {
    mostrarPantalla("pantalla-login-profesor");
});

document.getElementById("btn-organizador").addEventListener("click", () => {
    mostrarPantalla("pantalla-login-organizador");
});


// =================================
// 4. PRUEBA DE INICIO DE SESIÓN
// =================================

document.getElementById("form-profesor").addEventListener("submit", (evento) => {

    evento.preventDefault();

    const usuario = document.getElementById("usuario-profesor").value.trim();
    const password = document.getElementById("password-profesor").value;

    if (usuario && password) {
        document.getElementById("mensaje-profesor").textContent =
            "Datos recibidos. La validación de cuentas todavía no está conectada.";
    }
});


document.getElementById("form-organizador").addEventListener("submit", (evento) => {

    evento.preventDefault();

    const usuario = document.getElementById("usuario-organizador").value.trim();
    const password = document.getElementById("password-organizador").value;

    if (usuario && password) {
        document.getElementById("mensaje-organizador").textContent =
            "Datos recibidos. La validación de cuentas todavía no está conectada.";
    }
});


// =================================
// 5. PANTALLAS PROVISIONALES
// =================================

let pantallaAnterior = "pantalla-inicio";

function mostrarProvisional(mensaje) {

    pantallaAnterior =
        document.querySelector(".pantalla.activa").id;

    document.getElementById("texto-provisional").textContent = mensaje;

    mostrarPantalla("pantalla-provisional");
}


// Participante

document.getElementById("btn-ver-participantes").addEventListener("click", () => {
    mostrarProvisional(
        "El desarrollador es demasiado vago para crear una visualización de participantes."
    );
});

document.getElementById("btn-inscribirme").addEventListener("click", () => {
    mostrarProvisional(
        "El desarrollador es demasiado vago para hacer un formulario de inscripción."
    );
});


// Profesor

document.getElementById("btn-menu-ver-participantes").addEventListener("click", () => {
    mostrarProvisional(
        "El desarrollador es demasiado vago para crear una visualización de participantes."
    );
});

document.getElementById("btn-inscribir-alumnos").addEventListener("click", () => {
    mostrarProvisional(
        "El desarrollador es demasiado vago para hacer un formulario de inscripción masiva."
    );
});


// Organizador

document.getElementById("btn-administracion").addEventListener("click", () => {
    mostrarProvisional(
        "La administración todavía está en desarrollo. El organizador tendrá que tener paciencia."
    );
});


// =================================
// 6. BOTONES PARA VOLVER
// =================================

document.querySelectorAll(".btn-volver").forEach(boton => {

    boton.addEventListener("click", () => {

        if (document.querySelector(".pantalla.activa").id === "pantalla-provisional") {
            mostrarPantalla(pantallaAnterior);
        } else {
            mostrarPantalla("pantalla-inicio");
        }

    });

});
