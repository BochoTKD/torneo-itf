
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
