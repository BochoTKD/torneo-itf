
// =========================================
// Torneo General San Martín · NAVEGACIÓN E INICIO DE SESIÓN
// =========================================

// Se conservan los datos de conexión y el flujo de autenticación.
const SUPABASE_URL = "https://ycavbzajwxnqdvzqphft.supabase.co";
const SUPABASE_KEY = "sb_publishable_ukZqxHyVbsAyjPYFHl9kYQ_obdK-bSr";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioActual = null;
const RUTA_PROVISIONAL = "/pagina%20provisional/provisional.html";

// Iconos Lucide
function refrescarIconos() {
    if (window.lucide) window.lucide.createIcons();
}

// Actualizar saludo según el perfil.
function actualizarSaludo(perfil, tipo) {
    const nombre = perfil.display_name || perfil.username || "";

    if (tipo === "profesor") {
        document.getElementById("saludo-profesor").textContent =
            nombre
                ? `Bienvenido, ${nombre}. Seleccioná qué querés hacer.`
                : "Seleccioná qué querés hacer.";
    } else {
        document.getElementById("saludo-organizador").textContent =
            nombre
                ? `Bienvenido, ${nombre}. Administrá las áreas del torneo.`
                : "Administrá las distintas áreas del torneo.";
    }
}

// Navegación interna con historial del navegador.
function mostrarPantalla(id, { historial = true } = {}) {
    const destino = document.getElementById(id);
    if (!destino) return;

    document.querySelectorAll(".pantalla").forEach(p => {
        p.classList.remove("activa");
    });

    destino.classList.add("activa");

    if (historial) {
        window.history.pushState({ pantalla: id }, "", `#${id}`);
    } else {
        window.history.replaceState({ pantalla: id }, "", `#${id}`);
    }

    refrescarIconos();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function volverAtras() {
    if (window.history.state?.pantalla) {
        window.history.back();
    } else {
        mostrarPantalla("pantalla-inicio", { historial: false });
    }
}

// Restaurar la pantalla al recargar la página.
async function restaurarPantallaInicial() {
    const pantallaGuardada = window.location.hash.replace("#", "");

    const pantallasPublicas = [
        "pantalla-inicio",
        "pantalla-participante",
        "pantalla-login-profesor",
        "pantalla-login-organizador"
    ];

    const pantallasProtegidas = {
        "pantalla-menu-profesor": "profesor",
        "pantalla-menu-organizador": "organizador"
    };

    // Si no hay una pantalla guardada, mostrar el inicio.
    if (!pantallaGuardada) {
        mostrarPantalla("pantalla-inicio", { historial: false });
        return;
    }

    // Restaurar pantallas públicas.
    if (pantallasPublicas.includes(pantallaGuardada)) {
        mostrarPantalla(pantallaGuardada, { historial: false });
        return;
    }

    // Restaurar menús protegidos solo con una sesión válida.
    const tipo = pantallasProtegidas[pantallaGuardada];

    if (tipo) {
        try {
            const { data: sesionData, error: errorSesion } =
                await supabaseClient.auth.getSession();

            const sesion = sesionData?.session;

            if (errorSesion || !sesion) {
                mostrarPantalla(
                    tipo === "organizador"
                        ? "pantalla-login-organizador"
                        : "pantalla-login-profesor",
                    { historial: false }
                );
                return;
            }

            const { data: perfil, error: errorPerfil } = await supabaseClient
                .from("usuarios")
                .select("id, username, display_name, rol, activo")
                .eq("id", sesion.user.id)
                .single();

            if (errorPerfil || !perfil || !perfil.activo) {
                await supabaseClient.auth.signOut();

                mostrarPantalla(
                    tipo === "organizador"
                        ? "pantalla-login-organizador"
                        : "pantalla-login-profesor",
                    { historial: false }
                );
                return;
            }

            if (tipo === "organizador" && perfil.rol !== "organizador") {
                mostrarPantalla("pantalla-login-organizador", {
                    historial: false
                });
                return;
            }

            usuarioActual = perfil;
            actualizarSaludo(perfil, tipo);

            mostrarPantalla(pantallaGuardada, { historial: false });
            return;

        } catch (error) {
            console.error("Error al restaurar la sesión:", error);

            mostrarPantalla(
                tipo === "organizador"
                    ? "pantalla-login-organizador"
                    : "pantalla-login-profesor",
                { historial: false }
            );
            return;
        }
    }

    // Si el identificador no existe, volver al inicio.
    mostrarPantalla("pantalla-inicio", { historial: false });
}

// Navegación con los botones Atrás y Adelante del navegador.
window.addEventListener("popstate", evento => {
    const id = evento.state?.pantalla ||
        window.location.hash.replace("#", "") ||
        "pantalla-inicio";

    const destino = document.getElementById(id);

    if (destino) {
        document.querySelectorAll(".pantalla").forEach(p => {
            p.classList.remove("activa");
        });

        destino.classList.add("activa");
        refrescarIconos();
    } else {
        mostrarPantalla("pantalla-inicio", { historial: false });
    }
});

// Inicio y selección de perfil.
document.getElementById("marca-inicio").addEventListener("click", evento => {
    evento.preventDefault();
    mostrarPantalla("pantalla-inicio");
});

document.getElementById("btn-participante").addEventListener("click", () => {
    mostrarPantalla("pantalla-participante");
});

document.getElementById("btn-profesor").addEventListener("click", () => {
    mostrarPantalla("pantalla-login-profesor");
});

document.getElementById("btn-organizador").addEventListener("click", () => {
    mostrarPantalla("pantalla-login-organizador");
});

// =========================================
// ACCESO AL LISTADO PÚBLICO
// =========================================

document.getElementById("btn-ver-participantes")
    .addEventListener("click", () => {
        const pantallaAnterior = "pantalla-participante";

        window.location.href =
            `participantes/listado.html?origen=${pantallaAnterior}`;
    });

    document.getElementById("btn-ver-categorias")
    .addEventListener("click", () => {
        const pantallaAnterior = "pantalla-participante";

        window.location.href =
            `participantes/categorias.html?origen=${pantallaAnterior}`;
    });

// Botones para volver.
document.querySelectorAll("[data-volver]").forEach(boton => {
    boton.addEventListener("click", volverAtras);
});

// Selector de tema.
const botonTema = document.getElementById("btn-tema");
let temaActual = localStorage.getItem("tema") || "oscuro";

function aplicarTema() {
    document.body.classList.toggle(
        "tema-claro",
        temaActual === "claro"
    );

    botonTema.innerHTML = temaActual === "claro"
        ? '<i data-lucide="moon"></i>'
        : '<i data-lucide="sun"></i>';

    botonTema.setAttribute(
        "aria-label",
        temaActual === "claro"
            ? "Cambiar a tema oscuro"
            : "Cambiar a tema claro"
    );

    refrescarIconos();
}

botonTema.addEventListener("click", () => {
    temaActual = temaActual === "oscuro" ? "claro" : "oscuro";
    localStorage.setItem("tema", temaActual);
    aplicarTema();
});

// Autenticación.
async function iniciarSesion(usuario, password, tipoAcceso, mensaje, formulario) {
    mensaje.textContent = "";

    const username = usuario.trim().toLowerCase().replace(/\s+/g, "");

    if (!/^bocho[0-4]$/.test(username)) {
        mensaje.textContent = "El nombre de usuario no es válido.";
        return;
    }

    const botonEnviar = formulario.querySelector('button[type="submit"]');

    botonEnviar.disabled = true;
    botonEnviar.innerHTML = 'Verificando... <i data-lucide="loader-circle"></i>';
    refrescarIconos();

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: `${username}@torneo-itf.test`,
            password
        });

        if (error) {
            mensaje.textContent = "Usuario o contraseña incorrectos.";
            return;
        }

        const { data: perfil, error: errorPerfil } = await supabaseClient
            .from("usuarios")
            .select("id, username, display_name, rol, activo")
            .eq("id", data.user.id)
            .single();

        if (errorPerfil || !perfil) {
            await supabaseClient.auth.signOut();
            mensaje.textContent = "No se pudo verificar el perfil del usuario.";
            return;
        }

        if (!perfil.activo) {
            await supabaseClient.auth.signOut();
            mensaje.textContent = "Esta cuenta está desactivada.";
            return;
        }

        if (tipoAcceso === "organizador" && perfil.rol !== "organizador") {
            await supabaseClient.auth.signOut();
            mensaje.textContent = "Esta cuenta no tiene permisos de organizador.";
            return;
        }

        usuarioActual = perfil;
        actualizarSaludo(perfil, tipoAcceso);

        if (tipoAcceso === "profesor") {
            mostrarPantalla("pantalla-menu-profesor", {
                historial: false
            });
        } else {
            mostrarPantalla("pantalla-menu-organizador", {
                historial: false
            });
        }

    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        mensaje.textContent = "Ocurrió un error al conectar. Intentá nuevamente.";

    } finally {
        botonEnviar.disabled = false;
        botonEnviar.innerHTML = 'Iniciar sesión <i data-lucide="arrow-right"></i>';
        refrescarIconos();
    }
}

// Formulario de profesor.
document.getElementById("form-profesor").addEventListener("submit", async evento => {
    evento.preventDefault();

    const formulario = evento.currentTarget;

    await iniciarSesion(
        document.getElementById("usuario-profesor").value,
        document.getElementById("password-profesor").value,
        "profesor",
        document.getElementById("mensaje-profesor"),
        formulario
    );
});

// Formulario de organizador.
document.getElementById("form-organizador").addEventListener("submit", async evento => {
    evento.preventDefault();

    const formulario = evento.currentTarget;

    await iniciarSesion(
        document.getElementById("usuario-organizador").value,
        document.getElementById("password-organizador").value,
        "organizador",
        document.getElementById("mensaje-organizador"),
        formulario
    );
});

// Inicialización.
aplicarTema();
restaurarPantallaInicial();
