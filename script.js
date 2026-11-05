// =================================
// 1. CONEXIÓN CON SUPABASE
// =================================

const SUPABASE_URL = "https://ycavbzajwxnqdvzqphft.supabase.co";
const SUPABASE_KEY = "sb_publishable_ukZqxHyVbsAyjPYFHl9kYQ_obdK-bSr";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let usuarioActual = null;


// =================================
// 2. SELECTOR DE TEMA
// =================================

const botonTema = document.getElementById("btn-tema");

let temaActual = localStorage.getItem("tema") || "oscuro";

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

    lucide.createIcons();
}

botonTema.addEventListener("click", () => {
    temaActual = temaActual === "oscuro" ? "claro" : "oscuro";
    localStorage.setItem("tema", temaActual);
    aplicarTema();
});

aplicarTema();


// =================================
// 3. NAVEGACIÓN ENTRE PANTALLAS
// =================================

function mostrarPantalla(id) {
    document.querySelectorAll(".pantalla").forEach(pantalla => {
        pantalla.classList.remove("activa");
    });

    document.getElementById(id).classList.add("activa");
}


// =================================
// 4. SELECCIÓN DE PERFIL
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
// 5. INICIO DE SESIÓN CON SUPABASE
// =================================

async function iniciarSesion(usuario, password, tipoAcceso, mensaje) {
    mensaje.textContent = "";

    const username = usuario
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

    if (!/^bocho[0-4]$/.test(username)) {
        mensaje.textContent = "El nombre de usuario no es válido.";
        return;
    }

    const email = `${username}@torneo-itf.test`;

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
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

        if (
            tipoAcceso === "organizador" &&
            perfil.rol !== "organizador"
        ) {
            await supabaseClient.auth.signOut();
            mensaje.textContent = "Esta cuenta no tiene permisos de organizador.";
            return;
        }

        usuarioActual = perfil;

        if (tipoAcceso === "profesor") {
            mostrarPantalla("pantalla-menu-profesor");
        } else {
            mostrarPantalla("pantalla-menu-organizador");
        }

        console.log("Sesión iniciada:", usuarioActual.display_name);

    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        mensaje.textContent = "Ocurrió un error al conectar. Intentá nuevamente.";
    }
}


// =================================
// 6. FORMULARIO DEL PROFESOR
// =================================

document.getElementById("form-profesor").addEventListener("submit", async evento => {
    evento.preventDefault();

    await iniciarSesion(
        document.getElementById("usuario-profesor").value,
        document.getElementById("password-profesor").value,
        "profesor",
        document.getElementById("mensaje-profesor")
    );
});


// =================================
// 7. FORMULARIO DEL ORGANIZADOR
// =================================

document.getElementById("form-organizador").addEventListener("submit", async evento => {
    evento.preventDefault();

    await iniciarSesion(
        document.getElementById("usuario-organizador").value,
        document.getElementById("password-organizador").value,
        "organizador",
        document.getElementById("mensaje-organizador")
    );
});


// =================================
// 8. PANTALLAS PROVISIONALES
// =================================

let pantallaAnterior = "pantalla-inicio";

function mostrarProvisional(mensaje) {
    pantallaAnterior =
        document.querySelector(".pantalla.activa").id;

    document.getElementById("texto-provisional").textContent = mensaje;
    mostrarPantalla("pantalla-provisional");
}

// =================================
// 9. LISTADO PÚBLICO DE PARTICIPANTES
// =================================

let participantesPublicos = [];

const buscarParticipante =
    document.getElementById("buscar-participante");

const filtroProfesor =
    document.getElementById("filtro-profesor");

const cuerpoTabla =
    document.getElementById("cuerpo-tabla-participantes");

const estadoListado =
    document.getElementById("estado-listado");

const contenedorTabla =
    document.getElementById("contenedor-tabla");

const cantidadParticipantes =
    document.getElementById("cantidad-participantes");


// Obtener un campo aunque tenga distintos nombres.
function obtenerCampo(registro, posiblesNombres) {

    for (const nombre of posiblesNombres) {

        if (
            registro[nombre] !== undefined &&
            registro[nombre] !== null
        ) {
            return registro[nombre];
        }
    }

    return "";
}


// Normalizar texto para las búsquedas.
function normalizar(valor) {

    return String(valor ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


// Calcular edad si Supabase no la devuelve.
function calcularEdad(fechaNacimiento) {

    if (!fechaNacimiento) return "";

    const nacimiento = new Date(`${fechaNacimiento}T12:00:00`);
    const hoy = new Date();

    let edad = hoy.getFullYear() - nacimiento.getFullYear();

    const yaCumplio =
        hoy.getMonth() > nacimiento.getMonth() ||
        (
            hoy.getMonth() === nacimiento.getMonth() &&
            hoy.getDate() >= nacimiento.getDate()
        );

    if (!yaCumplio) edad--;

    return edad;
}


// Obtener los datos que necesita el listado.
function obtenerDatosParticipante(registro) {

    const fechaNacimiento = obtenerCampo(registro, [
        "fecha_nacimiento",
        "nacimiento"
    ]);

    const edadRecibida = obtenerCampo(registro, ["edad"]);

    return {

        id: obtenerCampo(registro, [
            "id",
            "inscripcion_id"
        ]),

        nombre: obtenerCampo(registro, ["nombre"]),

        apellido: obtenerCampo(registro, ["apellido"]),

        edad: edadRecibida !== ""
            ? edadRecibida
            : calcularEdad(fechaNacimiento),

        graduacion: obtenerCampo(registro, [
            "graduacion",
            "nombre_graduacion",
            "graduacion_nombre",
            "cinturon"
        ]),

        profesor: obtenerCampo(registro, [
            "instructor",
            "profesor",
            "nombre_instructor",
            "instructor_nombre",
            "display_name"
        ])
    };
}


// Evitar repetir al participante si aparece
// una vez por cada modalidad en la respuesta SQL.
function quitarParticipantesDuplicados(lista) {

    const unicos = new Map();

    lista.forEach(registro => {

        const p = obtenerDatosParticipante(registro);

        const clave = p.id || [
            normalizar(p.nombre),
            normalizar(p.apellido),
            normalizar(registro.fecha_nacimiento),
            normalizar(registro.genero)
        ].join("|");

        if (!unicos.has(clave)) {
            unicos.set(clave, registro);
        }
    });

    return [...unicos.values()];
}


// Crear una celda de la tabla.
function crearCelda(fila, etiqueta, contenido) {

    const celda = document.createElement("td");

    celda.dataset.label = etiqueta;
    celda.textContent = contenido || "—";

    fila.appendChild(celda);
}


// Dibujar participantes.
function dibujarParticipantes(lista) {

    cuerpoTabla.replaceChildren();

    cantidadParticipantes.textContent =
        `${lista.length} ${
            lista.length === 1 ? "participante" : "participantes"
        }`;

    if (lista.length === 0) {

        contenedorTabla.hidden = true;
        estadoListado.hidden = false;

        estadoListado.textContent =
            "No se encontraron participantes con esos filtros.";

        return;
    }

    estadoListado.hidden = true;
    contenedorTabla.hidden = false;

    lista.forEach(registro => {

        const participante = obtenerDatosParticipante(registro);

        const fila = document.createElement("tr");

        crearCelda(
            fila,
            "Participante",
            `${participante.apellido}, ${participante.nombre}`
        );

        crearCelda(
            fila,
            "Edad",
            participante.edad !== ""
                ? `${participante.edad} años`
                : "—"
        );

        crearCelda(
            fila,
            "Graduación",
            participante.graduacion
        );

        crearCelda(
            fila,
            "Profesor",
            participante.profesor
        );

        cuerpoTabla.appendChild(fila);
    });
}


// Aplicar búsqueda y filtro de profesor.
function aplicarFiltrosParticipantes() {

    const busqueda = normalizar(buscarParticipante.value);
    const profesor = normalizar(filtroProfesor.value);

    const filtrados = participantesPublicos.filter(registro => {

        const p = obtenerDatosParticipante(registro);

        const nombreCompleto = normalizar(
            `${p.nombre} ${p.apellido}`
        );

        const coincideBusqueda =
            nombreCompleto.includes(busqueda);

        const coincideProfesor =
            !profesor ||
            normalizar(p.profesor) === profesor;

        return coincideBusqueda && coincideProfesor;
    });

    dibujarParticipantes(filtrados);
}


// Cargar el selector de profesores.
function cargarFiltroProfesores() {

    const profesores = [
        ...new Set(
            participantesPublicos
                .map(registro =>
                    obtenerDatosParticipante(registro).profesor
                )
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b));

    filtroProfesor.replaceChildren();

    const opcionTodos = document.createElement("option");

    opcionTodos.value = "";
    opcionTodos.textContent = "Todos los profesores";

    filtroProfesor.appendChild(opcionTodos);

    profesores.forEach(profesor => {

        const opcion = document.createElement("option");

        opcion.value = profesor;
        opcion.textContent = profesor;

        filtroProfesor.appendChild(opcion);
    });
}


// Consultar Supabase.
async function cargarParticipantesPublicos() {

    estadoListado.hidden = false;
    estadoListado.classList.remove("error");

    estadoListado.textContent = "Cargando participantes...";

    contenedorTabla.hidden = true;

    cantidadParticipantes.textContent = "Consultando Supabase...";

    try {

        const { data, error } = await supabaseClient.rpc(
            "listar_inscripciones_publicas"
        );

        if (error) throw error;

        // La consulta puede devolver varias filas por participante.
        participantesPublicos = quitarParticipantesDuplicados(data || []);

        console.log(
            "Participantes públicos:",
            participantesPublicos
        );

        if (participantesPublicos.length > 0) {
            console.log(
                "Columnas recibidas:",
                Object.keys(participantesPublicos[0])
            );
        }

        cargarFiltroProfesores();
        aplicarFiltrosParticipantes();

    } catch (error) {

        console.error("Error al cargar participantes:", error);

        estadoListado.hidden = false;
        estadoListado.classList.add("error");

        estadoListado.textContent =
            "No se pudo cargar el listado. Revisá la conexión e intentá nuevamente.";

        cantidadParticipantes.textContent = "Error al cargar";
    }
}


// Abrir listado público.
document.getElementById("btn-ver-participantes")
    .addEventListener("click", () => {

        mostrarPantalla("pantalla-listado-publico");

        cargarParticipantesPublicos();
    });


// Eventos de búsqueda y filtro.
buscarParticipante.addEventListener(
    "input",
    aplicarFiltrosParticipantes
);

filtroProfesor.addEventListener(
    "change",
    aplicarFiltrosParticipantes
);

// =================================
// 10. BOTONES PROVISIONALES
// =================================

// Inscripción pública

document.getElementById("btn-inscribirme").addEventListener("click", () => {
    mostrarProvisional("El formulario de inscripción estará disponible próximamente.");
});


// Profesor: por ahora dejamos su listado interno pendiente,
// porque deberá mostrar también información privada y adaptados.

document.getElementById("btn-menu-ver-participantes").addEventListener("click", () => {
    mostrarProvisional("El listado interno de participantes para profesores está en desarrollo.");
});

document.getElementById("btn-inscribir-alumnos").addEventListener("click", () => {
    mostrarProvisional("El formulario de inscripción masiva estará disponible próximamente.");
});


// Organizador

document.getElementById("btn-administracion").addEventListener("click", () => {
    mostrarProvisional("La administración todavía está en desarrollo.");
});

// =================================
// 11. BOTONES PARA VOLVER
// =================================

document.querySelectorAll(".btn-volver").forEach(boton => {

    boton.addEventListener("click", () => {

        const pantallaActual =
            document.querySelector(".pantalla.activa").id;

        if (pantallaActual === "pantalla-provisional") {

            mostrarPantalla(pantallaAnterior);

        } else if (pantallaActual === "pantalla-listado-publico") {

            mostrarPantalla("pantalla-participante");

        } else {

            mostrarPantalla("pantalla-inicio");
        }

    });

});
