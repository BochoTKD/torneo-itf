
// =========================================
// Torneo General San Martín · NAVEGACIÓN E INICIO DE SESIÓN
// =========================================

const SUPABASE_URL = "https://ycavbzajwxnqdvzqphft.supabase.co";
const SUPABASE_KEY = "sb_publishable_ukZqxHyVbsAyjPYFHl9kYQ_obdK-bSr"

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let usuarioActual = null;
let notificacionesPrivadas = [];
let panelNotificacionesActivo = null;
let tipoNotificacionesActivo = null;


// =========================================
// CONFIGURACIÓN CENTRALIZADA DE RUTAS
// =========================================

const RUTAS = {
    espectador: {
        participantes: "espectador/listado.html",
        categorias: "espectador/categorias.html",
        llamados: "espectador/llamados.html"
    },

    participante: {
        participantes: "participantes/listado.html",
        categorias: "participantes/categorias.html",
        llaves: "participantes/llaves.html",
        llamados: "participantes/llamados.html"
    },

    profesor: {
        participantes: "profesor/listado.html",
        categorias: "profesor/categorias.html",
        llaves: "participantes/llaves.html",
        llamados: "participantes/llamados.html"
    },

    organizador: {
        participantes: "organizador/listado.html",
        categorias: "organizador/categorias.html",
        llaves: "organizador/llamados.html",
        llamados: "organizador/llamados.html"
    }
};


// =========================================
// ICONOS
// =========================================

function refrescarIconos() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}


// =========================================
// SALUDOS
// =========================================

function actualizarSaludo(perfil, tipo) {
    const nombre = perfil.display_name || perfil.username || "";

    if (tipo === "profesor") {
        const elemento = document.getElementById("saludo-profesor");

        if (elemento) {
            elemento.textContent = nombre
                ? `Bienvenido, ${nombre}. Seleccioná qué querés hacer.`
                : "Seleccioná qué querés hacer.";
        }
    }

    if (tipo === "organizador") {
        const elemento = document.getElementById("saludo-organizador");

        if (elemento) {
            elemento.textContent = nombre
                ? `Bienvenido, ${nombre}. Administrá las áreas del torneo.`
                : "Administrá las distintas áreas del torneo.";
        }
    }
}


// =========================================
// VISIBILIDAD DE NOTIFICACIONES
// =========================================

function mostrarBarraNotificacionesPrivada(tipo) {
    tipoNotificacionesActivo = tipo;

    // Nunca mostrar la campana solamente por iniciar sesión.
    ocultarBarrasNotificacionesPrivadas();

    tipoNotificacionesActivo = tipo;
    actualizarVisibilidadCampana(tipo);
}

function ocultarBarrasNotificacionesPrivadas() {
    document.getElementById("barra-notificaciones-profesor").hidden = true;
    document.getElementById("barra-notificaciones-organizador").hidden = true;

    cerrarPanelNotificaciones();
}

function actualizarVisibilidadCampana(tipo) {
    const config = configuracionNotificaciones[tipo];
    if (!config) return;

    const barra = document.getElementById(config.barra);
    if (!barra) return;

    const pendientes = notificacionesPrivadas.filter(
        notificacion => !notificacion.leida
    ).length;

    // La campana solamente existe visualmente si hay pendientes.
    barra.hidden = pendientes === 0;

    if (pendientes > 0) {
        tipoNotificacionesActivo = tipo;
    }
}


// =========================================
// NAVEGACIÓN ENTRE PANTALLAS
// =========================================

function sincronizarNotificacionesConPantalla(id) {
    const rolesProtegidos = {
        "pantalla-menu-profesor": "profesor",
        "pantalla-menu-organizador": "organizador"
    };

    const tipo = rolesProtegidos[id];

    if (
        tipo &&
        usuarioActual &&
        usuarioActual.rol === tipo
    ) {
        tipoNotificacionesActivo = tipo;
        actualizarVisibilidadCampana(tipo);
    } else {
        ocultarBarrasNotificacionesPrivadas();
    }
}

function mostrarPantalla(id, { historial = true } = {}) {
    const destino = document.getElementById(id);
    if (!destino) return;

    document.querySelectorAll(".pantalla").forEach(pantalla => {
        pantalla.classList.remove("activa");
    });

    destino.classList.add("activa");

    sincronizarNotificacionesConPantalla(id);

    if (historial) {
        window.history.pushState({ pantalla: id }, "", `#${id}`);
    } else {
        window.history.replaceState({ pantalla: id }, "", `#${id}`);
    }

    refrescarIconos();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function volverAtras() {
    const pantallaActual = document.querySelector(".pantalla.activa");

    if (!pantallaActual) {
        mostrarPantalla("pantalla-inicio", { historial: false });
        return;
    }

    const destinos = {
        "pantalla-espectador": "pantalla-inicio",
        "pantalla-participante": "pantalla-inicio",
        "pantalla-login-profesor": "pantalla-inicio",
        "pantalla-menu-profesor": "pantalla-login-profesor",
        "pantalla-login-organizador": "pantalla-inicio",
        "pantalla-menu-organizador": "pantalla-login-organizador"
    };

    mostrarPantalla(destinos[pantallaActual.id] || "pantalla-inicio");
}


// =========================================
// NAVEGACIÓN A SUBPÁGINAS
// =========================================

document.querySelectorAll("[data-ruta]").forEach(boton => {
    boton.addEventListener("click", () => {
        const ruta = boton.dataset.ruta;
        if (ruta) window.location.href = ruta;
    });
});


// =========================================
// RESTAURAR PANTALLA AL RECARGAR
// =========================================

async function restaurarPantallaInicial() {
    const pantallaGuardada = window.location.hash.replace("#", "");

    const pantallasPublicas = [
        "pantalla-inicio",
        "pantalla-espectador",
        "pantalla-participante",
        "pantalla-login-profesor",
        "pantalla-login-organizador"
    ];

    const pantallasProtegidas = {
        "pantalla-menu-profesor": "profesor",
        "pantalla-menu-organizador": "organizador"
    };

    ocultarBarrasNotificacionesPrivadas();

    if (!pantallaGuardada) {
        mostrarPantalla("pantalla-inicio", { historial: false });
        return;
    }

    if (pantallasPublicas.includes(pantallaGuardada)) {
        mostrarPantalla(pantallaGuardada, { historial: false });
        return;
    }

    const tipo = pantallasProtegidas[pantallaGuardada];

    if (!tipo) {
        mostrarPantalla("pantalla-inicio", { historial: false });
        return;
    }

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

        const { data: perfil, error: errorPerfil } =
            await supabaseClient
                .from("usuarios")
                .select("id, username, display_name, rol, activo")
                .eq("id", sesion.user.id)
                .single();

        if (errorPerfil || !perfil || !perfil.activo || perfil.rol !== tipo) {
            await supabaseClient.auth.signOut();

            mostrarPantalla(
                tipo === "organizador"
                    ? "pantalla-login-organizador"
                    : "pantalla-login-profesor",
                { historial: false }
            );
            return;
        }

        usuarioActual = perfil;
        actualizarSaludo(perfil, tipo);

        // Consulta silenciosa: no abre ni muestra el panel.
        await cargarNotificacionesPrivadas(tipo);

        mostrarPantalla(pantallaGuardada, { historial: false });

    } catch (error) {
        console.error("Error al restaurar la sesión:", error);

        usuarioActual = null;
        notificacionesPrivadas = [];
        tipoNotificacionesActivo = null;

        ocultarBarrasNotificacionesPrivadas();

        mostrarPantalla(
            tipo === "organizador"
                ? "pantalla-login-organizador"
                : "pantalla-login-profesor",
            { historial: false }
        );
    }
}


// =========================================
// HISTORIAL DEL NAVEGADOR
// =========================================

window.addEventListener("popstate", evento => {
    const id = evento.state?.pantalla ||
        window.location.hash.replace("#", "") ||
        "pantalla-inicio";

    const destino = document.getElementById(id);

    if (destino) {
        document.querySelectorAll(".pantalla").forEach(pantalla => {
            pantalla.classList.remove("activa");
        });

        destino.classList.add("activa");
        sincronizarNotificacionesConPantalla(id);
        refrescarIconos();
    } else {
        mostrarPantalla("pantalla-inicio", { historial: false });
    }
});


// =========================================
// SELECCIÓN DE PERFIL
// =========================================

document.getElementById("marca-inicio").addEventListener("click", evento => {
    evento.preventDefault();
    mostrarPantalla("pantalla-inicio");
});

document.getElementById("btn-espectador").addEventListener("click", () => {
    mostrarPantalla("pantalla-espectador");
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
// BOTONES PARA VOLVER
// =========================================

document.querySelectorAll("[data-volver]").forEach(boton => {
    boton.addEventListener("click", volverAtras);
});


// =========================================
// SELECTOR DE TEMA
// =========================================

const botonTema = document.getElementById("btn-tema");
let temaActual = localStorage.getItem("tema") || "oscuro";

function aplicarTema() {
    document.body.classList.toggle("tema-claro", temaActual === "claro");

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


// =========================================
// AUTENTICACIÓN
// =========================================

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

        const { data: perfil, error: errorPerfil } =
            await supabaseClient
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

        if (perfil.rol !== tipoAcceso) {
            await supabaseClient.auth.signOut();

            mensaje.textContent = tipoAcceso === "profesor"
                ? "Esta cuenta no tiene permisos de profesor."
                : "Esta cuenta no tiene permisos de organizador.";

            return;
        }

        usuarioActual = perfil;
        actualizarSaludo(perfil, tipoAcceso);

        // Se consultan los pendientes sin mostrar el panel.
        await cargarNotificacionesPrivadas(tipoAcceso);

        mostrarPantalla(
            tipoAcceso === "profesor"
                ? "pantalla-menu-profesor"
                : "pantalla-menu-organizador",
            { historial: false }
        );

    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        mensaje.textContent = "Ocurrió un error al conectar. Intentá nuevamente.";

    } finally {
        botonEnviar.disabled = false;
        botonEnviar.innerHTML = 'Iniciar sesión <i data-lucide="arrow-right"></i>';
        refrescarIconos();
    }
}


// =========================================
// NOTIFICACIONES · PROFESORES Y ORGANIZADORES
// =========================================

const configuracionNotificaciones = {
    profesor: {
        barra: "barra-notificaciones-profesor",
        boton: "btn-notificaciones-profesor",
        contador: "contador-notificaciones-profesor",
        panel: "panel-notificaciones-profesor",
        resumen: "resumen-notificaciones-profesor",
        estado: "estado-notificaciones-profesor",
        lista: "lista-notificaciones-profesor"
    },

    organizador: {
        barra: "barra-notificaciones-organizador",
        boton: "btn-notificaciones-organizador",
        contador: "contador-notificaciones-organizador",
        panel: "panel-notificaciones-organizador",
        resumen: "resumen-notificaciones-organizador",
        estado: "estado-notificaciones-organizador",
        lista: "lista-notificaciones-organizador"
    }
};


// =========================================
// FUNCIONES AUXILIARES
// =========================================

function escaparHTMLNotificacion(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

function obtenerEtiquetaNotificacion(tipo) {
    const etiquetas = {
        modificacion: "Ficha modificada",
        transferencia: "Transferencia de participante",
        inscripcion: "Nueva inscripción"
    };

    return etiquetas[tipo] || "Notificación";
}

function formatearFechaNotificacion(fecha) {
    if (!fecha) return "Fecha no disponible";

    return new Date(fecha).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function obtenerConfiguracionPanel(tipo) {
    return configuracionNotificaciones[tipo];
}


// =========================================
// CONTADOR Y VISIBILIDAD DE CAMPANA
// =========================================

function actualizarContadorPrivado(tipo) {
    const config = obtenerConfiguracionPanel(tipo);
    if (!config) return;

    const contador = document.getElementById(config.contador);
    if (!contador) return;

    const pendientes = notificacionesPrivadas.filter(
        notificacion => !notificacion.leida
    ).length;

    contador.textContent = pendientes > 99 ? "99+" : pendientes;
    contador.hidden = pendientes === 0;

    actualizarVisibilidadCampana(tipo);
}


// =========================================
// DIBUJAR NOTIFICACIONES
// =========================================

function dibujarNotificacionesPrivadas(tipo) {
    const config = obtenerConfiguracionPanel(tipo);
    if (!config) return;

    const resumen = document.getElementById(config.resumen);
    const estado = document.getElementById(config.estado);
    const lista = document.getElementById(config.lista);

    if (!resumen || !estado || !lista) return;

    const pendientes = notificacionesPrivadas.filter(
        notificacion => !notificacion.leida
    ).length;

    resumen.textContent =
        `${notificacionesPrivadas.length} notificaciones · ${pendientes} sin leer`;

    if (notificacionesPrivadas.length === 0) {
        estado.textContent = "No tenés notificaciones por el momento.";
        estado.hidden = false;
        lista.innerHTML = "";
        return;
    }

    estado.hidden = true;

    lista.innerHTML = notificacionesPrivadas.map(notificacion => `
        <button
            type="button"
            class="notificacion-item ${notificacion.leida ? "leida" : "no-leida"}"
            data-notificacion-id="${escaparHTMLNotificacion(notificacion.id)}"
        >
            <span class="notificacion-indicador"></span>

            <span class="notificacion-contenido">
                <strong>${escaparHTMLNotificacion(obtenerEtiquetaNotificacion(notificacion.tipo))}</strong>
                <span>${escaparHTMLNotificacion(notificacion.mensaje)}</span>
                <span>${escaparHTMLNotificacion(formatearFechaNotificacion(notificacion.fecha_creacion))}</span>
            </span>

            <i data-lucide="chevron-right" class="notificacion-flecha"></i>
        </button>
    `).join("");

    refrescarIconos();
}


// =========================================
// CARGAR NOTIFICACIONES
// =========================================

async function cargarNotificacionesPrivadas(tipo, { mostrarEstado = false } = {}) {
    if (!usuarioActual?.id) return;

    const config = obtenerConfiguracionPanel(tipo);
    if (!config) return;

    const estado = document.getElementById(config.estado);

    // Solo muestra "Cargando..." cuando el usuario abrió el panel.
    if (mostrarEstado && estado) {
        estado.hidden = false;
        estado.textContent = "Cargando notificaciones...";
    }

    try {
        const { data, error } = await supabaseClient
            .from("notificaciones")
            .select(`
                id,
                inscripcion_id,
                tipo,
                mensaje,
                leida,
                fecha_creacion,
                fecha_lectura,
                fecha_expiracion
            `)
            .eq("destinatario_id", usuarioActual.id)
            .gt("fecha_expiracion", new Date().toISOString())
            .order("fecha_creacion", { ascending: false });

        if (error) throw error;

        notificacionesPrivadas = data || [];

        actualizarContadorPrivado(tipo);
        dibujarNotificacionesPrivadas(tipo);

    } catch (error) {
        console.error("Error al cargar notificaciones:", error);

        notificacionesPrivadas = [];

        actualizarContadorPrivado(tipo);

        if (mostrarEstado && estado) {
            estado.hidden = false;
            estado.textContent = "No se pudieron cargar las notificaciones.";
        }
    }
}


// =========================================
// ABRIR Y CERRAR PANEL
// =========================================

function abrirPanelNotificaciones(tipo) {
    if (!usuarioActual || usuarioActual.rol !== tipo) return;

    const config = obtenerConfiguracionPanel(tipo);
    if (!config) return;

    const panel = document.getElementById(config.panel);
    const boton = document.getElementById(config.boton);

    if (!panel || !boton) return;

    const yaAbierto = !panel.hidden;

    cerrarPanelNotificaciones();

    if (yaAbierto) return;

    panel.hidden = false;
    boton.setAttribute("aria-expanded", "true");

    panelNotificacionesActivo = tipo;

    // Ahora sí se actualiza el contenido visible del panel.
    cargarNotificacionesPrivadas(tipo, { mostrarEstado: true });
}

function cerrarPanelNotificaciones() {
    Object.values(configuracionNotificaciones).forEach(config => {
        const panel = document.getElementById(config.panel);
        const boton = document.getElementById(config.boton);

        if (panel) panel.hidden = true;
        if (boton) boton.setAttribute("aria-expanded", "false");
    });

    panelNotificacionesActivo = null;
}


// =========================================
// DETALLE DE NOTIFICACIÓN
// =========================================

async function abrirDetalleNotificacionPrivada(id) {
    const notificacion = notificacionesPrivadas.find(
        notificacion => String(notificacion.id) === String(id)
    );

    if (!notificacion || !usuarioActual) return;

    const modal = document.getElementById("modal-detalle-notificacion");
    if (!modal) return;

    const tipoActivo = panelNotificacionesActivo || usuarioActual.rol;

    if (!notificacion.leida) {
        const { error } = await supabaseClient
            .from("notificaciones")
            .update({
                leida: true,
                fecha_lectura: new Date().toISOString()
            })
            .eq("id", notificacion.id)
            .eq("destinatario_id", usuarioActual.id);

        if (error) {
            console.error("No se pudo marcar como leída:", error);
        } else {
            notificacion.leida = true;
        }
    }

    document.getElementById("titulo-detalle-notificacion").textContent =
        obtenerEtiquetaNotificacion(notificacion.tipo);

    document.getElementById("detalle-notificacion-tipo").textContent =
        obtenerEtiquetaNotificacion(notificacion.tipo);

    document.getElementById("detalle-notificacion-mensaje").textContent =
        notificacion.mensaje || "Sin descripción.";

    document.getElementById("detalle-notificacion-datos").innerHTML = `
        <div class="detalle-notificacion-dato">
            <strong>Fecha:</strong>
            ${escaparHTMLNotificacion(formatearFechaNotificacion(notificacion.fecha_creacion))}
        </div>

        <div class="detalle-notificacion-dato">
            <strong>Estado:</strong>
            ${notificacion.leida ? "Leída" : "Sin leer"}
        </div>

        ${
            notificacion.inscripcion_id
                ? `<div class="detalle-notificacion-dato">
                    <strong>ID de inscripción:</strong>
                    ${escaparHTMLNotificacion(notificacion.inscripcion_id)}
                   </div>`
                : ""
        }
    `;

    cerrarPanelNotificaciones();

    modal.dataset.panelOrigen = tipoActivo;
    modal.hidden = false;

    actualizarContadorPrivado(tipoActivo);
    dibujarNotificacionesPrivadas(tipoActivo);

    refrescarIconos();
}

function cerrarDetalleNotificacionPrivada() {
    const modal = document.getElementById("modal-detalle-notificacion");
    if (modal) modal.hidden = true;
}

function volverAPanelNotificaciones() {
    const modal = document.getElementById("modal-detalle-notificacion");
    if (!modal) return;

    const tipo = modal.dataset.panelOrigen || usuarioActual?.rol;

    cerrarDetalleNotificacionPrivada();

    if (tipo && configuracionNotificaciones[tipo]) {
        abrirPanelNotificaciones(tipo);
    }
}


// =========================================
// EVENTOS DE NOTIFICACIONES
// =========================================

Object.entries(configuracionNotificaciones).forEach(([tipo, config]) => {
    const boton = document.getElementById(config.boton);
    const lista = document.getElementById(config.lista);

    if (boton) {
        boton.addEventListener("click", evento => {
            evento.stopPropagation();
            abrirPanelNotificaciones(tipo);
        });
    }

    if (lista) {
        lista.addEventListener("click", evento => {
            const elemento = evento.target.closest("[data-notificacion-id]");
            if (!elemento) return;

            abrirDetalleNotificacionPrivada(
                elemento.dataset.notificacionId
            );
        });
    }
});

document.addEventListener("click", evento => {
    if (!evento.target.closest(".contenedor-notificaciones")) {
        cerrarPanelNotificaciones();
    }
});

document.getElementById("btn-cerrar-detalle-notificacion")
    ?.addEventListener("click", cerrarDetalleNotificacionPrivada);

document.getElementById("btn-volver-notificaciones")
    ?.addEventListener("click", volverAPanelNotificaciones);

document.getElementById("modal-detalle-notificacion")
    ?.addEventListener("click", evento => {
        if (evento.target.id === "modal-detalle-notificacion") {
            cerrarDetalleNotificacionPrivada();
        }
    });

document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") {
        const modal = document.getElementById("modal-detalle-notificacion");

        if (modal && !modal.hidden) {
            cerrarDetalleNotificacionPrivada();
        } else {
            cerrarPanelNotificaciones();
        }
    }
});


// =========================================
// FORMULARIO DE PROFESOR
// =========================================

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


// =========================================
// FORMULARIO DE ORGANIZADOR
// =========================================

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


// =========================================
// INICIALIZACIÓN
// =========================================

ocultarBarrasNotificacionesPrivadas();
cerrarPanelNotificaciones();
aplicarTema();
restaurarPantallaInicial();
