// =========================================
// 1. CONEXIÓN CON SUPABASE
// =========================================

const SUPABASE_URL = "https://ycavbzajwxnqdvzqphft.supabase.co";
const SUPABASE_KEY = "sb_publishable_ukZqxHyVbsAyjPYFHl9kYQ_obdK-bSr";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// =========================================
// 1.1. PAGINACIÓN DE CONSULTAS RPC
// =========================================

async function consultarTodasLasFilasRPC(nombreFuncion, tamanoPagina = 500) {
    const todosLosRegistros = [];
    let desde = 0;

    while (true) {
        const hasta = desde + tamanoPagina - 1;

        const { data, error } = await supabaseClient
            .rpc(nombreFuncion)
            .range(desde, hasta);

        if (error) throw error;

        const pagina = data || [];

        todosLosRegistros.push(...pagina);

        if (pagina.length < tamanoPagina) break;

        desde += tamanoPagina;
    }

    return todosLosRegistros;
}


// =========================================
// 2. GRADUACIONES
// =========================================

const graduacionesDisponibles = [
    { id: 1, nombre: "Blanco" },
    { id: 2, nombre: "Blanco punta amarilla" },
    { id: 3, nombre: "Amarillo" },
    { id: 4, nombre: "Amarillo punta verde" },
    { id: 5, nombre: "Verde" },
    { id: 6, nombre: "Verde punta azul" },
    { id: 7, nombre: "Azul" },
    { id: 8, nombre: "Azul punta roja" },
    { id: 9, nombre: "Rojo" },
    { id: 10, nombre: "Rojo punta negra" },
    { id: 11, nombre: "I dan" },
    { id: 12, nombre: "II dan" },
    { id: 13, nombre: "III dan" },
    { id: 14, nombre: "IV dan" },
    { id: 15, nombre: "V dan" },
    { id: 16, nombre: "VI dan" }
];


// =========================================
// 3. SESIÓN Y USUARIO
// =========================================

let usuarioActual = null;
let participantesPublicos = [];
let profesoresDisponibles = [];

let participanteSeleccionado = null;
let elementoQueAbrioFicha = null;

let modoEdicion = false;
let cambiosPendientes = null;

function esperarConTiempoLimite(promesa, milisegundos, operacion) {
    let temporizador;

    return Promise.race([
        promesa,
        new Promise((_, reject) => {
            temporizador = setTimeout(() => {
                reject(new Error(
                    `La operación "${operacion}" superó los ${milisegundos / 1000} segundos.`
                ));
            }, milisegundos);
        })
    ]).finally(() => clearTimeout(temporizador));
}

function mostrarErrorVerificacion(mensaje) {
    const estado = estadoListado || estadoCategorias;

    if (estado) {
        estado.hidden = false;
        estado.classList.add("error");
        estado.textContent = mensaje;
    }

    console.error("Error de verificación:", mensaje);
}

async function comprobarSesionProfesor() {
    try {
        console.log("Verificando sesión...");

        const { data: sesion, error: errorSesion } =
            await esperarConTiempoLimite(
                supabaseClient.auth.getSession(),
                12000,
                "comprobación de sesión"
            );

        if (errorSesion) throw errorSesion;

        if (!sesion?.session) {
            window.location.href = "../index.html";
            return false;
        }

        console.log("Sesión encontrada. Verificando perfil...");

        const { data: perfil, error } =
            await esperarConTiempoLimite(
                supabaseClient
                    .from("usuarios")
                    .select("id, username, display_name, rol, activo")
                    .eq("id", sesion.session.user.id)
                    .single(),
                12000,
                "consulta del perfil"
            );

        if (error) {
            if (error.code === "PGRST116") {
                window.location.href = "../index.html";
                return false;
            }

            throw error;
        }

        if (
            !perfil ||
            perfil.rol !== "profesor" ||
            perfil.activo !== true
        ) {
            window.location.href = "../index.html";
            return false;
        }

        usuarioActual = perfil;

        console.log("Sesión y perfil verificados correctamente.");

        return true;

    } catch (error) {
        console.error("No se pudo verificar la sesión:", error);

        mostrarErrorVerificacion(
            error.message?.includes("superó los")
                ? "La verificación está tardando demasiado. Revisá tu conexión y recargá la página."
                : "No se pudo verificar tu sesión. Recargá la página e intentá nuevamente."
        );

        return false;
    }
}


// =========================================
// 4. SELECTOR DE TEMA
// =========================================

const botonTema = document.getElementById("btn-tema");
let temaActual = localStorage.getItem("tema") || "oscuro";

function refrescarIconos() {
    if (window.lucide) window.lucide.createIcons();
}

function aplicarTema() {
    document.body.classList.toggle(
        "tema-claro",
        temaActual === "claro"
    );

    if (botonTema) {
        botonTema.innerHTML = temaActual === "claro"
            ? '<i data-lucide="moon"></i>'
            : '<i data-lucide="sun"></i>';

        botonTema.setAttribute(
            "aria-label",
            temaActual === "claro"
                ? "Cambiar a tema oscuro"
                : "Cambiar a tema claro"
        );
    }

    refrescarIconos();
}

if (botonTema) {
    botonTema.addEventListener("click", () => {
        temaActual = temaActual === "oscuro" ? "claro" : "oscuro";
        localStorage.setItem("tema", temaActual);
        aplicarTema();
    });
}

aplicarTema();


// =========================================
// 5. ELEMENTOS DEL LISTADO Y MODALES
// =========================================

const buscarParticipante = document.getElementById("buscar-participante");
const filtroProfesor = document.getElementById("filtro-profesor");
const cuerpoTabla = document.getElementById("cuerpo-tabla-participantes");
const estadoListado = document.getElementById("estado-listado");
const contenedorTabla = document.getElementById("contenedor-tabla");
const cantidadParticipantes = document.getElementById("cantidad-participantes");

const botonActualizarParticipantes = document.getElementById(
    "btn-actualizar-participantes"
);

const contenidoFicha = document.getElementById("contenido-ficha-publica");
const modalFicha = document.getElementById("modal-ficha-publica");
const botonCerrarFicha = document.getElementById("btn-cerrar-ficha");

const botonEditarFichaModal = document.getElementById(
    "btn-editar-ficha-modal"
);

if (botonEditarFichaModal) {
    botonEditarFichaModal.addEventListener("click", activarEdicion);
}

const contenedorCategorias = document.getElementById("contenedor-categorias");
const estadoCategorias = document.getElementById("estado-categorias");
const cantidadCategorias = document.getElementById("cantidad-categorias");

const modalCategoria = document.getElementById("modal-categoria");
const tituloModalCategoria = document.getElementById("titulo-modal-categoria");
const contenidoModalCategoria = document.getElementById("contenido-modal-categoria");
const botonCerrarCategoria = document.getElementById("btn-cerrar-categoria");

const modalConfirmacion = document.getElementById("modal-confirmacion-edicion");
const tituloConfirmacion = document.getElementById("titulo-confirmacion-edicion");
const contenidoConfirmacion = document.getElementById("contenido-confirmacion-edicion");
const botonCerrarConfirmacion = document.getElementById("btn-cerrar-confirmacion");

let categoriasPublicas = [];
let categoriaAbierta = null;
let elementoQueAbrioCategoria = null;

let cargandoParticipantes = false;

const esPaginaListado = Boolean(buscarParticipante && cuerpoTabla);
const esPaginaCategorias = Boolean(contenedorCategorias);

// =========================================
// NOTIFICACIONES
// =========================================

const botonNotificaciones = document.getElementById("btn-notificaciones");
const contadorNotificaciones = document.getElementById("contador-notificaciones");

const panelNotificaciones = document.getElementById("panel-notificaciones");
const resumenNotificaciones = document.getElementById("resumen-notificaciones");
const estadoNotificaciones = document.getElementById("estado-notificaciones");
const listaNotificaciones = document.getElementById("lista-notificaciones");

const modalDetalleNotificacion = document.getElementById("modal-detalle-notificacion");
const botonCerrarDetalleNotificacion = document.getElementById("btn-cerrar-detalle-notificacion");
const botonVolverNotificaciones = document.getElementById("btn-volver-notificaciones");

const tituloDetalleNotificacion = document.getElementById("titulo-detalle-notificacion");
const tipoDetalleNotificacion = document.getElementById("detalle-notificacion-tipo");
const mensajeDetalleNotificacion = document.getElementById("detalle-notificacion-mensaje");
const datosDetalleNotificacion = document.getElementById("detalle-notificacion-datos");

let notificacionesProfesor = [];
let notificacionSeleccionada = null;

// =========================================
// 6. FUNCIONES AUXILIARES
// =========================================

function obtenerCampo(registro, posiblesNombres) {
    for (const nombre of posiblesNombres) {
        if (
            registro &&
            registro[nombre] !== undefined &&
            registro[nombre] !== null
        ) {
            return registro[nombre];
        }
    }

    return "";
}

function normalizar(valor) {
    return String(valor ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caracter]);
}

function graduacionPorId(id) {
    return graduacionesDisponibles.find(
        g => Number(g.id) === Number(id)
    )?.nombre || "—";
}

function fechaLegible(fecha) {
    if (!fecha) return "";

    const partes = String(fecha).slice(0, 10).split("-");

    if (partes.length !== 3) return fecha;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function fechaISO(fecha) {
    return fecha ? String(fecha).slice(0, 10) : "";
}

function obtenerDatosParticipante(registro) {
    return {
        id: registro.id,
        nombre: registro.nombre || "",
        apellido: registro.apellido || "",
        edad: registro.edad ?? "",
        genero: registro.genero || "",
        graduacion: registro.graduacion || "",
        graduacion_id: registro.graduacion_id,
        profesor: registro.instructor || "",
        instructor_id: registro.instructor_id,
        fecha_nacimiento: registro.fecha_nacimiento,
        dni: registro.dni || "",
        telefono: registro.telefono || "",
        peso: registro.peso,
        altura: registro.altura,
        tul: registro.tul === true,
        combate: registro.combate === true,
        media_lucha: registro.media_lucha === true,
        adaptado: registro.adaptado === true,
        invitado: registro.invitado === true,
        fecha_inscripcion: registro.fecha_inscripcion,
        invitadoPublico: registro.invitado === true
    };
}

function datoFicha(etiqueta, valor) {
    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return "";
    }

    return `
        <div class="ficha-dato">
            <small>${escaparHTML(etiqueta)}</small>
            <strong>${escaparHTML(valor)}</strong>
        </div>
    `;
}

// =========================================
// 7. UNIFICAR FILAS POR PARTICIPANTE
// =========================================

function quitarParticipantesDuplicados(lista) {
    const unicos = new Map();

    (lista || []).forEach(registro => {
        const clave = registro.id;

        if (!unicos.has(clave)) {
            unicos.set(clave, {
                ...registro,
                modalidades: []
            });
        }

        const participante = unicos.get(clave);

        const modalidad = registro.modalidad;

        if (
            modalidad &&
            !participante.modalidades.some(item =>
                Number(item.modalidad_id) === Number(registro.modalidad_id)
            )
        ) {
            participante.modalidades.push({
                modalidad_id: registro.modalidad_id,
                modalidad,
                horario: registro.hora_inicio,
                categoria_id: registro.categoria_id,
                grupo_edad: registro.grupo_edad,
                division_graduacion: registro.division_graduacion,
                rango_peso: registro.rango_peso,
                estado_categoria: registro.estado_categoria,
                subdivision: ""
            });
        }
    });

    return [...unicos.values()];
}


// =========================================
// 8. FILTROS Y LISTADO
// =========================================

function dibujarParticipantes(lista) {
    if (
        !cuerpoTabla ||
        !cantidadParticipantes ||
        !contenedorTabla ||
        !estadoListado
    ) return;

    cuerpoTabla.replaceChildren();

    cantidadParticipantes.textContent =
        `${lista.length} ${lista.length === 1 ? "participante" : "participantes"}`;

    if (!lista.length) {
        contenedorTabla.hidden = true;
        estadoListado.hidden = false;
        estadoListado.textContent =
            "No se encontraron participantes con esos filtros.";
        return;
    }

    estadoListado.hidden = true;
    contenedorTabla.hidden = false;

    lista.forEach(registro => {
        const p = obtenerDatosParticipante(registro);
        const fila = document.createElement("tr");

        fila.classList.add("fila-participante");
        fila.tabIndex = 0;
        fila.setAttribute("role", "button");

        fila.setAttribute(
            "aria-label",
            `Ver ficha de ${p.nombre} ${p.apellido}`
        );

        crearCelda(fila, "Participante", `${p.apellido}, ${p.nombre}`);
        crearCelda(fila, "Edad", p.edad !== "" ? `${p.edad} años` : "—");
        crearCelda(fila, "Graduación", p.graduacion);
        crearCelda(fila, "Profesor", p.profesor);

        fila.addEventListener("click", () => abrirFichaParticipante(registro));

        fila.addEventListener("keydown", evento => {
            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                abrirFichaParticipante(registro);
            }
        });

        cuerpoTabla.appendChild(fila);
    });
}

function crearCelda(fila, etiqueta, contenido) {
    const celda = document.createElement("td");
    celda.dataset.label = etiqueta;
    celda.textContent = contenido || "—";
    fila.appendChild(celda);
}

function aplicarFiltrosParticipantes() {
    if (!buscarParticipante || !filtroProfesor) return;

    const busqueda = normalizar(buscarParticipante.value);
    const profesor = filtroProfesor.value;

    const filtrados = participantesPublicos.filter(registro => {
        const p = obtenerDatosParticipante(registro);

        const nombreCompleto = normalizar(`${p.nombre} ${p.apellido}`);
        const apellidoNombre = normalizar(`${p.apellido} ${p.nombre}`);

        return (
            (!busqueda ||
                nombreCompleto.includes(busqueda) ||
                apellidoNombre.includes(busqueda)) &&
            (!profesor || registro.instructor_id === profesor)
        );
    });

    dibujarParticipantes(filtrados);
}

function cargarFiltroProfesores() {
    if (!filtroProfesor) return;

    const anterior = filtroProfesor.value;

    const profesores = [
        ...new Map(
            participantesPublicos.map(p => [
                p.instructor_id,
                p.instructor
            ])
        )
    ].filter(([id, nombre]) => id && nombre)
     .sort((a, b) => a[1].localeCompare(b[1]));

    filtroProfesor.replaceChildren();

    const todos = document.createElement("option");
    todos.value = "";
    todos.textContent = "Todos los profesores";
    filtroProfesor.appendChild(todos);

    profesores.forEach(([id, nombre]) => {
        const opcion = document.createElement("option");
        opcion.value = id;
        opcion.textContent = nombre;
        filtroProfesor.appendChild(opcion);
    });

    filtroProfesor.value = profesores.some(([id]) => id === anterior)
        ? anterior
        : "";
}

if (buscarParticipante) {
    buscarParticipante.addEventListener("input", aplicarFiltrosParticipantes);
}

if (filtroProfesor) {
    filtroProfesor.addEventListener("change", aplicarFiltrosParticipantes);
}


// =========================================
// 9. MODALES
// =========================================

function actualizarEstadoModales() {
    const fichaAbierta = modalFicha && !modalFicha.hidden;
    const categoriaAbierta = modalCategoria && !modalCategoria.hidden;
    const confirmacionAbierta = modalConfirmacion && !modalConfirmacion.hidden;
    const detalleNotificacionAbierto =
        modalDetalleNotificacion && !modalDetalleNotificacion.hidden;

    document.body.classList.toggle(
        "modal-abierto",
        Boolean(
            fichaAbierta ||
            categoriaAbierta ||
            confirmacionAbierta ||
            detalleNotificacionAbierto
        )
    );
}

function cerrarFichaParticipante() {
    if (!modalFicha) return;

    modalFicha.hidden = true;
    modoEdicion = false;

    if (modalCategoria && !modalCategoria.hidden) {
        modalFicha.style.zIndex = "1001";
    } else {
        modalFicha.style.removeProperty("z-index");
    }

    actualizarEstadoModales();

    if (elementoQueAbrioFicha?.isConnected) {
        elementoQueAbrioFicha.focus();
    }

    elementoQueAbrioFicha = null;
}

function abrirFichaParticipante(registro) {
    if (!contenidoFicha || !modalFicha) return;

    participanteSeleccionado = registro;
    elementoQueAbrioFicha = document.activeElement;
    modoEdicion = false;

    renderizarFichaParticipante();

    if (modalCategoria && !modalCategoria.hidden) {
        modalFicha.style.zIndex = "1003";
    } else {
        modalFicha.style.removeProperty("z-index");
    }

    modalFicha.hidden = false;
    actualizarEstadoModales();

    refrescarIconos();

    if (botonCerrarFicha) botonCerrarFicha.focus();
}

if (botonCerrarFicha) {
    botonCerrarFicha.addEventListener("click", cerrarFichaParticipante);
}

if (modalFicha) {
    modalFicha.addEventListener("click", evento => {
        if (evento.target === modalFicha) cerrarFichaParticipante();
    });
}

function renderizarFichaParticipante() {
    const registro = participanteSeleccionado;

    if (!registro || !contenidoFicha) return;

    const p = obtenerDatosParticipante(registro);

    const genero = normalizar(p.genero);
    const claseAvatar =
        genero.includes("fem") || genero === "f"
            ? "femenino"
            : "masculino";

    // Determina si el profesor autenticado es responsable del alumno.
    // Esto habilita la edición.
    const esPropio = Boolean(
        usuarioActual &&
        p.instructor_id &&
        String(p.instructor_id) === String(usuarioActual.id)
    );

    // Determina si este participante también tiene una cuenta de profesor.
    // Para esto, ambos IDs deben coincidir.
    const esParticipanteConCuentaProfesor = Boolean(
        usuarioActual &&
        p.id &&
        String(p.id) === String(usuarioActual.id)
    );

    // Mostrar Editar solamente si el profesor es responsable del participante.
    if (botonEditarFichaModal) {
        botonEditarFichaModal.hidden = !esPropio;
    }

    const ordenModalidadesFicha = {
        tul: 1,
        combate: 2,
        "media lucha": 3
    };

    const modalidades = [...(registro.modalidades || [])].sort((a, b) => {
        return (
            (ordenModalidadesFicha[normalizar(a.modalidad)] || 99) -
            (ordenModalidadesFicha[normalizar(b.modalidad)] || 99)
        );
    });

    const tarjetasModalidades = modalidades.map((modalidad, indice) => `
        <article class="tarjeta-modalidad">
            <h3>${escaparHTML(modalidad.modalidad)}</h3>

            <p class="modalidad-horario">
                <strong>Horario:</strong>
                ${modalidad.horario
                    ? escaparHTML(String(modalidad.horario).slice(0, 5))
                    : "Horario pendiente de vincular"}
            </p>

            <div class="modalidad-acciones">
                <button
                    type="button"
                    class="boton-ficha-secundario btn-ver-categoria"
                    data-indice-modalidad="${indice}"
                    ${modalidad.categoria_id == null ? "disabled" : ""}
                >
                    Ver categoría
                </button>

                <button
                    type="button"
                    class="boton-ficha-secundario"
                    disabled
                    title="La llave todavía no está publicada"
                >
                    Ver llave
                </button>
            </div>
        </article>
    `).join("");

    contenidoFicha.innerHTML = `
        <article class="ficha-participante">

            <div class="ficha-encabezado">
                <div class="ficha-avatar ${claseAvatar}">
                    <i data-lucide="user-round"></i>
                </div>

                <div class="ficha-identidad">
                    <h2>${escaparHTML(p.nombre)} ${escaparHTML(p.apellido)}</h2>

                    <div class="ficha-rol-contenedor">
                        <p class="ficha-rol">
                            ${esParticipanteConCuentaProfesor
                                ? "Participante · Profesor"
                                : "Participante"}
                        </p>

                        <div class="ficha-etiquetas">
                            ${p.adaptado
                                ? '<span class="etiqueta-invitado">ADAPTADO</span>'
                                : ""}

                            ${p.invitado
                                ? '<span class="etiqueta-invitado">INVITADO</span>'
                                : ""}
                        </div>
                    </div>
                </div>
            </div>

            <div class="ficha-separador"></div>

            <div class="ficha-datos-basicos">
                <div class="ficha-dato">
                    <small>Edad</small>
                    <strong>${p.edad !== "" ? escaparHTML(p.edad) + " años" : "—"}</strong>
                </div>

                <div class="ficha-dato">
                    <small>Género</small>
                    <strong>${escaparHTML(p.genero) || "—"}</strong>
                </div>
            </div>

            <div class="ficha-separador"></div>

            <h3 class="ficha-titulo-seccion">Datos generales</h3>

            <div class="ficha-datos-generales">

                <div class="ficha-dato">
                    <small>Cinto</small>
                    <strong>${escaparHTML(p.graduacion) || "—"}</strong>
                </div>

                <div class="ficha-dato">
                    <small>Profesor</small>
                    <strong class="ficha-profesor">${escaparHTML(p.profesor) || "—"}</strong>
                </div>

                ${datoFicha("Peso", p.peso !== null && p.peso !== undefined && p.peso !== "" ? `${p.peso} kg` : "")}
                ${datoFicha("Altura", p.altura !== null && p.altura !== undefined && p.altura !== "" ? `${p.altura} cm` : "")}
                ${datoFicha("DNI", p.dni)}
                ${datoFicha("Teléfono", p.telefono)}
                ${datoFicha("Fecha de nacimiento", fechaLegible(p.fecha_nacimiento))}
                ${datoFicha("Fecha de inscripción", p.fecha_inscripcion ? new Date(p.fecha_inscripcion).toLocaleDateString("es-AR") : "")}

            </div>

            <div class="ficha-separador"></div>

            <h3 class="ficha-titulo-seccion">Compite en</h3>

            ${
                tarjetasModalidades
                    ? `<div class="ficha-modalidades">${tarjetasModalidades}</div>`
                    : `<p class="ficha-sin-modalidades">No hay modalidades registradas.</p>`
            }

            ${!esPropio ? `
                <p class="aviso-solo-lectura">
                    Esta ficha pertenece a otro profesor. Solo podés consultarla.
                </p>
            ` : ""}

        </article>
    `;

    contenidoFicha.querySelectorAll(".btn-ver-categoria").forEach(boton => {
        const indice = Number(boton.dataset.indiceModalidad);
        const modalidad = modalidades[indice];

        const categoria = buscarCategoriaModalidad(modalidad);

        if (!categoria) {
            boton.disabled = true;
            boton.title = "Esta categoría todavía no está publicada";
            return;
        }

        boton.addEventListener("click", () => {
            abrirDetalleCategoria(categoria, boton);
        });
    });

    refrescarIconos();
}
// =========================================
// 9.1. SISTEMA DE NOTIFICACIONES
// =========================================

function obtenerTipoNotificacion(tipo) {
    const tipos = {
        modificacion: "Ficha modificada",
        transferencia: "Transferencia de participante"
    };

    return tipos[tipo] || "Notificación";
}


// -----------------------------------------
// CARGAR NOTIFICACIONES DESDE SUPABASE
// -----------------------------------------

async function cargarNotificaciones() {
    if (!usuarioActual || !listaNotificaciones) return;

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

        notificacionesProfesor = data || [];

        actualizarContadorNotificaciones();
        dibujarNotificaciones();

    } catch (error) {
        console.error("Error al cargar notificaciones:", error);

        if (estadoNotificaciones) {
            estadoNotificaciones.hidden = false;
            estadoNotificaciones.textContent =
                "No se pudieron cargar las notificaciones.";
        }
    }
}


// -----------------------------------------
// ACTUALIZAR CONTADOR
// -----------------------------------------

function actualizarContadorNotificaciones() {
    if (!contadorNotificaciones) return;

    const pendientes = notificacionesProfesor.filter(
        notificacion => !notificacion.leida
    ).length;

    contadorNotificaciones.textContent =
        pendientes > 99 ? "99+" : pendientes;

    contadorNotificaciones.hidden = pendientes === 0;

    if (botonNotificaciones) {
        botonNotificaciones.setAttribute(
            "aria-label",
            pendientes
                ? `Abrir notificaciones. ${pendientes} sin leer`
                : "Abrir notificaciones"
        );
    }
}


// -----------------------------------------
// DIBUJAR CAJA DE NOTIFICACIONES
// -----------------------------------------

function dibujarNotificaciones() {
    if (!listaNotificaciones || !estadoNotificaciones) return;

    listaNotificaciones.replaceChildren();

    const total = notificacionesProfesor.length;

    const pendientes = notificacionesProfesor.filter(
        notificacion => !notificacion.leida
    ).length;

    if (resumenNotificaciones) {
        resumenNotificaciones.textContent =
            `${total} ${total === 1 ? "notificación" : "notificaciones"} · ${pendientes} sin leer`;
    }

    if (total === 0) {
        estadoNotificaciones.hidden = false;
        estadoNotificaciones.textContent =
            "No tenés notificaciones pendientes.";
        return;
    }

    estadoNotificaciones.hidden = true;

    notificacionesProfesor.forEach(notificacion => {
        const boton = document.createElement("button");

        boton.type = "button";
        boton.className = `notificacion-item ${
            notificacion.leida ? "leida" : "no-leida"
        }`;

        const fecha = new Date(
            notificacion.fecha_creacion
        ).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });

        boton.innerHTML = `
            <span class="notificacion-indicador"></span>

            <span class="notificacion-contenido">
                <strong>
                    ${escaparHTML(obtenerTipoNotificacion(notificacion.tipo))}
                </strong>

                <span>${escaparHTML(notificacion.mensaje)}</span>

                <small>${escaparHTML(fecha)}</small>
            </span>

            <span class="notificacion-flecha">
                <i data-lucide="chevron-right"></i>
            </span>
        `;

        boton.addEventListener("click", () => {
            abrirDetalleNotificacion(notificacion);
        });

        listaNotificaciones.appendChild(boton);
    });

    refrescarIconos();
}


// -----------------------------------------
// ABRIR Y CERRAR CAJA PLEGABLE
// -----------------------------------------

async function abrirNotificaciones() {
    if (!panelNotificaciones) return;

    const estabaAbierto = !panelNotificaciones.hidden;

    if (estabaAbierto) {
        cerrarNotificaciones();
        return;
    }

    panelNotificaciones.hidden = false;

    if (estadoNotificaciones) {
        estadoNotificaciones.hidden = false;
        estadoNotificaciones.textContent = "Cargando notificaciones...";
    }

    await cargarNotificaciones();

    refrescarIconos();
}

function cerrarNotificaciones() {
    if (!panelNotificaciones) return;

    panelNotificaciones.hidden = true;
}

if (botonNotificaciones) {
    botonNotificaciones.addEventListener(
        "click",
        abrirNotificaciones
    );
}


// -----------------------------------------
// CERRAR AL HACER CLIC FUERA
// -----------------------------------------

document.addEventListener("click", evento => {
    if (!panelNotificaciones || panelNotificaciones.hidden) return;

    const clicEnCampana =
        botonNotificaciones?.contains(evento.target);

    const clicEnPanel =
        panelNotificaciones.contains(evento.target);

    if (!clicEnCampana && !clicEnPanel) {
        cerrarNotificaciones();
    }
});


// -----------------------------------------
// ABRIR DETALLE DE NOTIFICACIÓN
// -----------------------------------------

async function abrirDetalleNotificacion(notificacion) {
    if (!modalDetalleNotificacion) return;

    notificacionSeleccionada = notificacion;

    // Marcar como leída en Supabase.
    if (!notificacion.leida) {
        const { error } = await supabaseClient
            .from("notificaciones")
            .update({ leida: true })
            .eq("id", notificacion.id)
            .eq("destinatario_id", usuarioActual.id)
            .eq("leida", false);

        if (error) {
            console.error(
                "Error al marcar la notificación como leída:",
                error
            );

            alert(
                "No se pudo marcar la notificación como leída."
            );

        } else {
            notificacion.leida = true;

            notificacionesProfesor = notificacionesProfesor.map(item =>
                item.id === notificacion.id
                    ? { ...item, leida: true }
                    : item
            );

            actualizarContadorNotificaciones();
            dibujarNotificaciones();
        }
    }

    // Buscar los datos del participante.
    const participante = participantesPublicos.find(
        registro =>
            String(registro.id) === String(notificacion.inscripcion_id)
    );

    const nombreParticipante = participante
        ? `${participante.apellido || ""}, ${participante.nombre || ""}`
            .replace(/^, |, $/g, "")
        : "Participante no disponible";

    const fecha = new Date(
        notificacion.fecha_creacion
    ).toLocaleString("es-AR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    // Completar el detalle.
    if (tituloDetalleNotificacion) {
        tituloDetalleNotificacion.textContent =
            obtenerTipoNotificacion(notificacion.tipo);
    }

    if (tipoDetalleNotificacion) {
        tipoDetalleNotificacion.textContent =
            obtenerTipoNotificacion(notificacion.tipo);
    }

    if (mensajeDetalleNotificacion) {
        mensajeDetalleNotificacion.textContent =
            notificacion.mensaje || "Sin descripción.";
    }

    if (datosDetalleNotificacion) {
        datosDetalleNotificacion.innerHTML = `
            <div class="detalle-notificacion-dato">
                <small>Participante</small>
                <strong>${escaparHTML(nombreParticipante)}</strong>
            </div>

            <div class="detalle-notificacion-dato">
                <small>Fecha</small>
                <strong>${escaparHTML(fecha)}</strong>
            </div>

            <div class="detalle-notificacion-dato">
                <small>Estado</small>
                <strong>${notificacion.leida ? "Leída" : "Sin leer"}</strong>
            </div>
        `;
    }

    cerrarNotificaciones();

    modalDetalleNotificacion.hidden = false;

    actualizarEstadoModales();
    refrescarIconos();

    if (botonCerrarDetalleNotificacion) {
        botonCerrarDetalleNotificacion.focus();
    }
}


// -----------------------------------------
// VOLVER DEL DETALLE A LA CAJA
// -----------------------------------------

function volverABandejaNotificaciones() {
    if (!modalDetalleNotificacion || !panelNotificaciones) return;

    modalDetalleNotificacion.hidden = true;
    panelNotificaciones.hidden = false;

    notificacionSeleccionada = null;

    actualizarEstadoModales();
    refrescarIconos();

    if (botonNotificaciones) {
        botonNotificaciones.focus();
    }
}


// -----------------------------------------
// CERRAR DETALLE
// -----------------------------------------

function cerrarDetalleNotificacion() {
    if (!modalDetalleNotificacion) return;

    modalDetalleNotificacion.hidden = true;
    notificacionSeleccionada = null;

    actualizarEstadoModales();

    if (botonNotificaciones) {
        botonNotificaciones.focus();
    }
}


// -----------------------------------------
// EVENTOS DEL MODAL DE DETALLE
// -----------------------------------------

if (botonCerrarDetalleNotificacion) {
    botonCerrarDetalleNotificacion.addEventListener(
        "click",
        cerrarDetalleNotificacion
    );
}

if (botonVolverNotificaciones) {
    botonVolverNotificaciones.addEventListener(
        "click",
        volverABandejaNotificaciones
    );
}

if (modalDetalleNotificacion) {
    modalDetalleNotificacion.addEventListener("click", evento => {
        if (evento.target === modalDetalleNotificacion) {
            cerrarDetalleNotificacion();
        }
    });
}

// =========================================
// 11. EDICIÓN DE FICHA
// =========================================

function campoTexto(id, etiqueta, valor, tipo = "text", requerido = false) {
    return `
        <label class="campo-edicion" for="edit-${id}">
            <span>${escaparHTML(etiqueta)}${requerido ? " *" : ""}</span>

            <input
                id="edit-${id}"
                name="${id}"
                type="${tipo}"
                value="${escaparHTML(valor ?? "")}"
                ${requerido ? "required" : ""}
            >
        </label>
    `;
}

function campoSelect(id, etiqueta, opciones, actual) {
    return `
        <label class="campo-edicion" for="edit-${id}">
            <span>${escaparHTML(etiqueta)}</span>

            <select id="edit-${id}" name="${id}">
                ${opciones.map(opcion => `
                    <option
                        value="${escaparHTML(opcion.value)}"
                        ${String(opcion.value) === String(actual) ? "selected" : ""}
                    >
                        ${escaparHTML(opcion.label)}
                    </option>
                `).join("")}
            </select>
        </label>
    `;
}

function campoCheck(id, etiqueta, valor) {
    return `
        <label class="campo-check" for="edit-${id}">
            <input
                type="checkbox"
                id="edit-${id}"
                name="${id}"
                ${valor ? "checked" : ""}
            >
            <span>${escaparHTML(etiqueta)}</span>
        </label>
    `;
}

function activarEdicion() {
    const registro = participanteSeleccionado;

    if (!registro) return;

    const p = obtenerDatosParticipante(registro);

    if (
        !usuarioActual ||
        String(p.instructor_id) !== String(usuarioActual.id)
    ) {
        return;
    }

    modoEdicion = true;

    if (botonEditarFichaModal) {
        botonEditarFichaModal.hidden = true;
    }

const generos = [
    { value: "Masculino", label: "Masculino" },
    { value: "Femenino", label: "Femenino" }
];

    contenidoFicha.innerHTML = `
        <form id="form-edicion-participante" class="formulario-edicion">

            <div class="aviso-edicion">
                Estás editando esta ficha. Revisá los cambios antes de confirmarlos.
            </div>

            <section class="seccion-edicion">
                <h3>Datos personales</h3>

                <div class="campos-edicion">
                    ${campoTexto("nombre", "Nombre", p.nombre, "text", true)}
                    ${campoTexto("apellido", "Apellido", p.apellido, "text", true)}
                    ${campoTexto("fecha_nacimiento", "Fecha de nacimiento", fechaISO(p.fecha_nacimiento), "date", true)}
                    ${campoSelect("genero", "Género", generos, p.genero)}

                    ${campoSelect(
                        "graduacion_id",
                        "Graduación",
                        graduacionesDisponibles.map(g => ({
                            value: g.id,
                            label: g.nombre
                        })),
                        p.graduacion_id
                    )}

                    ${campoTexto("dni", "DNI", p.dni)}
                    ${campoTexto("telefono", "Teléfono", p.telefono)}
                </div>
            </section>

            <section class="seccion-edicion">
                <h3>Modalidades</h3>

                <div class="checks-edicion">
                    ${campoCheck("tul", "Tul", p.tul)}
                    ${campoCheck("combate", "Combate", p.combate)}
                    ${campoCheck("media_lucha", "Media lucha", p.media_lucha)}
                </div>

                <div id="campos-combate" class="campos-edicion">
                    ${campoTexto("peso", "Peso (kg)", p.peso, "number")}
                    ${campoTexto("altura", "Altura (cm)", p.altura, "number")}
                </div>
            </section>

            <section class="seccion-edicion">
                <h3>Condiciones especiales</h3>

                <div class="checks-edicion">
                    ${campoCheck("adaptado", "Adaptado", p.adaptado)}
                    ${campoCheck("invitado", "Invitado", p.invitado)}
                </div>
            </section>

            <section class="seccion-edicion">
                <h3>Profesor responsable</h3>

                ${campoSelect(
                    "instructor_id",
                    "Profesor",
                    profesoresDisponibles.map(profesor => ({
                        value: profesor.id,
                        label: profesor.display_name
                    })),
                    p.instructor_id
                )}

                <div class="aviso-transferencia" id="aviso-transferencia" hidden>
                    <strong>Transferencia de participante</strong>
                    <p>
                        Al confirmar, el nuevo profesor será responsable de esta ficha.
                        Perderás el permiso para editarla.
                    </p>
                </div>
            </section>

            <div class="acciones-edicion">
                <button type="button" class="btn-secundario" id="btn-cancelar-edicion">
                    Cancelar
                </button>

                <button type="submit" class="btn-editar-ficha">
                    Revisar cambios
                </button>
            </div>

        </form>
    `;

    const form = document.getElementById("form-edicion-participante");

    const campoCombate = document.getElementById("edit-combate");
    const campoMedia = document.getElementById("edit-media_lucha");

    const campoPeso = document.getElementById("edit-peso");
    const campoAltura = document.getElementById("edit-altura");

    const camposCombate = document.getElementById("campos-combate");

    function actualizarCamposCombate() {
        const combate = campoCombate.checked;

        camposCombate.hidden = !combate;

        campoPeso.required = combate;
        campoAltura.required = combate;

        if (!combate) {
            campoPeso.value = "";
            campoAltura.value = "";
        }
    }

    campoCombate.addEventListener("change", () => {
        if (campoCombate.checked) campoMedia.checked = false;
        actualizarCamposCombate();
    });

    campoMedia.addEventListener("change", () => {
        if (campoMedia.checked) campoCombate.checked = false;
        actualizarCamposCombate();
    });

    document.getElementById("edit-instructor_id")
        .addEventListener("change", evento => {
            document.getElementById("aviso-transferencia").hidden =
                evento.target.value === p.instructor_id;
        });

    actualizarCamposCombate();

    document.getElementById("btn-cancelar-edicion")
        .addEventListener("click", () => {
            modoEdicion = false;
            renderizarFichaParticipante();
        });

    form.addEventListener("submit", prepararConfirmacion);

    refrescarIconos();
}

function leerFormularioEdicion() {
    const campo = id => document.getElementById(`edit-${id}`);

    return {
        p_id: participanteSeleccionado.id,
        p_nombre: campo("nombre").value.trim(),
        p_apellido: campo("apellido").value.trim(),
        p_fecha_nacimiento: campo("fecha_nacimiento").value,
        p_genero: campo("genero").value,
        p_graduacion_id: Number(campo("graduacion_id").value),
        p_dni: campo("dni").value.trim() || null,
        p_telefono: campo("telefono").value.trim() || null,
        p_peso: campo("peso").value === "" ? null : Number(campo("peso").value),
        p_altura: campo("altura").value === "" ? null : Number(campo("altura").value),
        p_tul: campo("tul").checked,
        p_combate: campo("combate").checked,
        p_media_lucha: campo("media_lucha").checked,
        p_adaptado: campo("adaptado").checked,
        p_invitado: campo("invitado").checked,
        p_instructor_id: campo("instructor_id").value
    };
}


// =========================================
// 12. CONFIRMACIÓN DE CAMBIOS
// =========================================

function prepararConfirmacion(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;

    if (!form.reportValidity()) return;

    const datos = leerFormularioEdicion();

    if (datos.p_combate && datos.p_media_lucha) {
        alert("No se puede seleccionar Combate y Media lucha simultáneamente.");
        return;
    }

    if (datos.p_media_lucha && datos.p_graduacion_id >= 3) {
        alert("Media lucha solamente está permitida para graduación blanca y punta amarilla.");
        return;
    }

    if (
        datos.p_combate &&
        (
            !datos.p_peso ||
            !datos.p_altura ||
            datos.p_peso <= 0 ||
            datos.p_altura <= 0
        )
    ) {
        alert("Para competir en Combate, el peso y la altura son obligatorios.");
        return;
    }

    cambiosPendientes = datos;

    renderizarConfirmacion();
    modalConfirmacion.hidden = false;

    actualizarEstadoModales();
}

function renderizarConfirmacion() {
    const datos = cambiosPendientes;
    const original = obtenerDatosParticipante(participanteSeleccionado);

    const profesorNuevo = profesoresDisponibles.find(
        profesor => profesor.id === datos.p_instructor_id
    );

    const cambios = [
        ["Nombre", original.nombre, datos.p_nombre],
        ["Apellido", original.apellido, datos.p_apellido],
        ["Fecha de nacimiento", fechaLegible(original.fecha_nacimiento), fechaLegible(datos.p_fecha_nacimiento)],
        ["Género", original.genero, datos.p_genero],
        ["Graduación", original.graduacion, graduacionPorId(datos.p_graduacion_id)],
        ["DNI", original.dni || "Vacío", datos.p_dni || "Vacío"],
        ["Teléfono", original.telefono || "Vacío", datos.p_telefono || "Vacío"],
        ["Peso", original.peso ?? "Vacío", datos.p_peso ?? "Vacío"],
        ["Altura", original.altura ?? "Vacío", datos.p_altura ?? "Vacío"],
        ["Tul", original.tul ? "Sí" : "No", datos.p_tul ? "Sí" : "No"],
        ["Combate", original.combate ? "Sí" : "No", datos.p_combate ? "Sí" : "No"],
        ["Media lucha", original.media_lucha ? "Sí" : "No", datos.p_media_lucha ? "Sí" : "No"],
        ["Adaptado", original.adaptado ? "Sí" : "No", datos.p_adaptado ? "Sí" : "No"],
        ["Invitado", original.invitado ? "Sí" : "No", datos.p_invitado ? "Sí" : "No"],
        ["Profesor", original.profesor, profesorNuevo?.display_name || "—"]
    ];

    const cambiosReales = cambios.filter(([, anterior, nuevo]) =>
        String(anterior ?? "") !== String(nuevo ?? "")
    );

    const transferencia = datos.p_instructor_id !== original.instructor_id;

    tituloConfirmacion.textContent = "Confirmar modificaciones";

    contenidoConfirmacion.innerHTML = `
        <div class="resumen-confirmacion">
            <p>Revisá los cambios antes de guardar.</p>

            ${cambiosReales.length ? `
                <div class="tabla-cambios">
                    ${cambiosReales.map(([campo, anterior, nuevo]) => `
                        <div class="fila-cambio">
                            <strong>${escaparHTML(campo)}</strong>
                            <span class="valor-anterior">${escaparHTML(anterior)}</span>
                            <span class="valor-nuevo">${escaparHTML(nuevo)}</span>
                        </div>
                    `).join("")}
                </div>
            ` : `
                <p>No hay cambios para guardar.</p>
            `}

            ${transferencia ? `
                <div class="advertencia-transferencia">
                    <strong>Transferencia de participante</strong>
                    <p>
                        El nuevo responsable será
                        ${escaparHTML(profesorNuevo?.display_name || "")}.
                        Perderás el permiso para editar esta ficha.
                        Se notificará a ambos profesores y a los organizadores.
                    </p>
                </div>
            ` : ""}

            <div class="acciones-confirmacion">
                <button type="button" class="btn-secundario" id="btn-volver-edicion">
                    Volver a editar
                </button>

                <button
                    type="button"
                    class="btn-editar-ficha"
                    id="btn-confirmar-guardado"
                    ${cambiosReales.length ? "" : "disabled"}
                >
                    Confirmar y guardar
                </button>
            </div>
        </div>
    `;

    document.getElementById("btn-volver-edicion")
        .addEventListener("click", () => {
            modalConfirmacion.hidden = true;
            actualizarEstadoModales();
        });

    document.getElementById("btn-confirmar-guardado")
        .addEventListener("click", guardarCambios);
}


// =========================================
// 13. GUARDAR MODIFICACIONES
// =========================================

async function guardarCambios() {
    if (!cambiosPendientes) return;

    const boton = document.getElementById("btn-confirmar-guardado");

    boton.disabled = true;
    boton.textContent = "Guardando...";

    const { error } = await supabaseClient.rpc(
        "modificar_inscripcion",
        cambiosPendientes
    );

    if (error) {
        console.error("Error al modificar participante:", error);

        alert(
            error.message ||
            "No se pudieron guardar los cambios. La ficha original permanece intacta."
        );

        boton.disabled = false;
        boton.textContent = "Confirmar y guardar";

        return;
    }

    const idGuardado = participanteSeleccionado.id;
    const nuevoInstructor = cambiosPendientes.p_instructor_id;

    cambiosPendientes = null;

    modalConfirmacion.hidden = true;

    await cargarParticipantesPublicos();

    if (nuevoInstructor === usuarioActual.id) {
        const actualizado = participantesPublicos.find(
            p => p.id === idGuardado
        );

        if (actualizado) {
            participanteSeleccionado = actualizado;
            modoEdicion = false;
            renderizarFichaParticipante();
        } else {
            cerrarFichaParticipante();
        }
    } else {
        cerrarFichaParticipante();
    }

    actualizarEstadoModales();

    alert("La ficha se modificó correctamente.");
}

if (botonCerrarConfirmacion) {
    botonCerrarConfirmacion.addEventListener("click", () => {
        modalConfirmacion.hidden = true;
        actualizarEstadoModales();
    });
}

if (modalConfirmacion) {
    modalConfirmacion.addEventListener("click", evento => {
        if (evento.target === modalConfirmacion) {
            modalConfirmacion.hidden = true;
            actualizarEstadoModales();
        }
    });
}


// =========================================
// 14. CATEGORÍAS
// =========================================

function buscarCategoriaModalidad(modalidad) {
    return categoriasPublicas.find(categoria =>
        String(categoria.categoriaId) === String(modalidad.categoria_id) &&
        categoria.modalidadNormalizada === normalizar(modalidad.modalidad)
    );
}

function generarCategoriasPublicas(participantes) {
    const agrupadas = new Map();

    participantes.forEach(registro => {
        const p = obtenerDatosParticipante(registro);

        (registro.modalidades || []).forEach(modalidad => {
            const modalidadNombre = String(modalidad.modalidad || "").trim();
            const modalidadNormalizada = normalizar(modalidadNombre);

            const categoriaId = modalidad.categoria_id || "sin-categoria";

            const clave = `${categoriaId}|${modalidadNormalizada}`;

            if (!agrupadas.has(clave)) {
                const categoria = {
                    clave,
                    categoriaId,
                    modalidad: modalidadNombre,
                    modalidadNormalizada,
                    edad: modalidad.grupo_edad || "",
                    genero: p.genero,
                    division: modalidad.division_graduacion || "",
                    peso: modalidad.rango_peso || "",
                    subdivision: "",
                    participantes: new Map()
                };

                categoria.titulo = [
                    categoria.edad,
                    categoria.genero,
                    categoria.division,
                    categoria.peso
                ].filter(Boolean).join(" · ");

                agrupadas.set(clave, categoria);
            }

            const categoria = agrupadas.get(clave);

            if (!categoria.participantes.has(p.id)) {
                categoria.participantes.set(p.id, registro);
            }
        });
    });

    return [...agrupadas.values()]
        .filter(categoria => categoria.participantes.size >= 2)
        .map(categoria => ({
            ...categoria,
            participantes: [...categoria.participantes.values()]
        }));
}

function abrirDetalleCategoria(categoria, elemento) {
    if (!modalCategoria || !contenidoModalCategoria || !tituloModalCategoria) {
        return;
    }

    categoriaAbierta = categoria;
    elementoQueAbrioCategoria = elemento || document.activeElement;

    tituloModalCategoria.textContent = categoria.titulo;

    const ordenados = [...categoria.participantes].sort((a, b) => {
        const pa = obtenerDatosParticipante(a);
        const pb = obtenerDatosParticipante(b);

        return (
            normalizar(pa.apellido).localeCompare(normalizar(pb.apellido)) ||
            normalizar(pa.nombre).localeCompare(normalizar(pb.nombre))
        );
    });

    contenidoModalCategoria.innerHTML = `
        <div class="detalle-categoria">

            <div class="detalle-categoria-resumen">
                <span>${escaparHTML(categoria.modalidad)}</span>
                <span>${ordenados.length} participantes</span>
            </div>

            <div class="lista-participantes-categoria">
                ${ordenados.map((registro, indice) => {
                    const p = obtenerDatosParticipante(registro);

                    return `
                        <button
                            type="button"
                            class="fila-participante-categoria"
                            data-indice="${indice}"
                        >
                            <span class="numero-participante">
                                ${String(indice + 1).padStart(2, "0")}
                            </span>

                            <span class="datos-participante-categoria">
                                <strong>${escaparHTML(p.apellido)}, ${escaparHTML(p.nombre)}</strong>
                                <small>${escaparHTML(p.graduacion)}</small>
                            </span>

                            <i data-lucide="chevron-right"></i>
                        </button>
                    `;
                }).join("")}
            </div>
        </div>
    `;

    contenidoModalCategoria
        .querySelectorAll(".fila-participante-categoria")
        .forEach(boton => {
            boton.addEventListener("click", () => {
                abrirFichaParticipante(
                    ordenados[Number(boton.dataset.indice)]
                );
            });
        });

    modalCategoria.style.zIndex = "1002";

    if (modalFicha && !modalFicha.hidden) {
        modalFicha.style.zIndex = "1001";
    }

    modalCategoria.hidden = false;

    actualizarEstadoModales();
    refrescarIconos();

    if (botonCerrarCategoria) botonCerrarCategoria.focus();
}

function cerrarDetalleCategoria() {
    if (!modalCategoria) return;

    modalCategoria.hidden = true;
    modalCategoria.style.removeProperty("z-index");

    categoriaAbierta = null;

    if (modalFicha) {
        modalFicha.style.removeProperty("z-index");
    }

    actualizarEstadoModales();

    if (elementoQueAbrioCategoria?.isConnected) {
        elementoQueAbrioCategoria.focus();
    }

    elementoQueAbrioCategoria = null;
}

if (botonCerrarCategoria) {
    botonCerrarCategoria.addEventListener("click", cerrarDetalleCategoria);
}

if (modalCategoria) {
    modalCategoria.addEventListener("click", evento => {
        if (evento.target === modalCategoria) cerrarDetalleCategoria();
    });
}


// =========================================
// 15. CARGAR PROFESORES
// =========================================

async function cargarProfesoresDisponibles() {
    const { data, error } = await supabaseClient.rpc(
        "listar_profesores_publicos"
    );

    if (error) throw error;

    profesoresDisponibles = data || [];
}


// =========================================
// 16. CARGAR PARTICIPANTES
// =========================================

async function cargarParticipantesPublicos(opciones = {}) {
    const actualizacionManual = opciones.actualizacionManual === true;

    if (cargandoParticipantes) return false;

    cargandoParticipantes = true;

    const habiaDatos = participantesPublicos.length > 0;

    if (botonActualizarParticipantes) {
        botonActualizarParticipantes.disabled = true;
        botonActualizarParticipantes.innerHTML = `
            <i data-lucide="refresh-cw"></i>
            Actualizando...
        `;
    }

    const estado = esPaginaListado ? estadoListado : estadoCategorias;

    if (estado) {
        estado.classList.remove("error");

        if (!actualizacionManual || !habiaDatos) {
            estado.hidden = false;
            estado.textContent = "Cargando participantes...";
        } else {
            estado.hidden = false;
            estado.textContent = "Actualizando participantes...";
        }
    }

    try {
        // La RPC de profesores conserva su nombre y sus columnas.
        // Se consultan todas sus filas en bloques de 500.
        const data = await consultarTodasLasFilasRPC(
            "listar_inscripciones_profesores",
            500
        );

        participantesPublicos = quitarParticipantesDuplicados(data);

        categoriasPublicas = generarCategoriasPublicas(participantesPublicos);

        if (esPaginaListado) {
            cargarFiltroProfesores();
            aplicarFiltrosParticipantes();
        }

        if (esPaginaCategorias) {
            dibujarCategorias();
        }

        return true;

    } catch (error) {
        console.error("Error al cargar participantes:", error);

        if (habiaDatos) {
            if (estado) {
                estado.hidden = false;
                estado.classList.add("error");
                estado.textContent =
                    "No se pudo actualizar. Se mantienen los datos anteriores.";
            }

            return false;
        }

        participantesPublicos = [];
        categoriasPublicas = [];

        if (esPaginaListado) {
            if (cuerpoTabla) cuerpoTabla.replaceChildren();
            if (contenedorTabla) contenedorTabla.hidden = true;

            if (estadoListado) {
                estadoListado.hidden = false;
                estadoListado.classList.add("error");
                estadoListado.textContent =
                    "No se pudieron cargar los participantes. Intentá nuevamente.";
            }

            if (cantidadParticipantes) {
                cantidadParticipantes.textContent = "Error al cargar el listado";
            }
        }

        if (esPaginaCategorias) {
            if (estadoCategorias) {
                estadoCategorias.hidden = false;
                estadoCategorias.classList.add("error");
                estadoCategorias.textContent =
                    "No se pudieron cargar las categorías.";
            }
        }

        return false;

    } finally {
        cargandoParticipantes = false;

        if (botonActualizarParticipantes) {
            botonActualizarParticipantes.disabled = false;
            botonActualizarParticipantes.innerHTML = `
                <i data-lucide="refresh-cw"></i>
                Actualizar
            `;
        }

        refrescarIconos();
    }
}

if (botonActualizarParticipantes) {
    botonActualizarParticipantes.addEventListener("click", () => {
        cargarParticipantesPublicos({
            actualizacionManual: true
        });
    });
}

// =========================================
// 17. NAVEGACIÓN
// =========================================

const botonVolver = document.getElementById("btn-volver");

if (botonVolver) {
    botonVolver.addEventListener("click", () => {
        window.location.href = "../index.html#pantalla-menu-profesor";
    });
}

document.addEventListener("keydown", evento => {
    if (evento.key !== "Escape") return;

    if (modalDetalleNotificacion && !modalDetalleNotificacion.hidden) {
        cerrarDetalleNotificacion();
        return;
    }

    if (panelNotificaciones && !panelNotificaciones.hidden) {
        cerrarNotificaciones();
        return;
    }

    if (modalConfirmacion && !modalConfirmacion.hidden) {
        modalConfirmacion.hidden = true;
        actualizarEstadoModales();
        return;
    }

    if (modalFicha && !modalFicha.hidden) {
        cerrarFichaParticipante();
        return;
    }

    if (modalCategoria && !modalCategoria.hidden) {
        cerrarDetalleCategoria();
    }
});

// =========================================
// 18. DIBUJAR CATEGORÍAS
// =========================================

function dibujarCategorias() {
    if (!contenedorCategorias || !estadoCategorias || !cantidadCategorias) {
        return;
    }

    contenedorCategorias.replaceChildren();

    cantidadCategorias.textContent =
        `${categoriasPublicas.length} ${
            categoriasPublicas.length === 1
                ? "categoría publicada"
                : "categorías publicadas"
        }`;

    if (!categoriasPublicas.length) {
        estadoCategorias.hidden = false;
        estadoCategorias.textContent =
            "Todavía no hay categorías con dos o más participantes.";
        return;
    }

    estadoCategorias.hidden = true;

    ["tul", "media lucha", "combate"].forEach(modalidad => {
        const categorias = categoriasPublicas.filter(
            categoria => categoria.modalidadNormalizada === modalidad
        );

        if (!categorias.length) return;

        const seccion = document.createElement("section");
        seccion.className = "grupo-categorias";

        const encabezado = document.createElement("div");
        encabezado.className = "encabezado-grupo-categorias";

        encabezado.innerHTML = `
            <h2>${escaparHTML(
                modalidad === "tul"
                    ? "Tul"
                    : modalidad === "media lucha"
                        ? "Media lucha"
                        : "Combate"
            )}</h2>

            <span>${categorias.length} categorías</span>
        `;

        seccion.appendChild(encabezado);

        const grilla = document.createElement("div");
        grilla.className = "grilla-categorias";

        categorias.forEach(categoria => {
            const tarjeta = document.createElement("button");

            tarjeta.type = "button";
            tarjeta.className = "tarjeta-categoria";

            tarjeta.innerHTML = `
                <span class="tarjeta-categoria-contenido">
                    <span class="tarjeta-categoria-titulo">
                        ${escaparHTML(categoria.titulo)}
                    </span>

                    <span class="tarjeta-categoria-cantidad">
                        ${categoria.participantes.length} participantes
                    </span>
                </span>

                <span class="tarjeta-categoria-icono">
                    <i data-lucide="arrow-up-right"></i>
                </span>
            `;

            tarjeta.addEventListener("click", () => {
                abrirDetalleCategoria(categoria, tarjeta);
            });

            grilla.appendChild(tarjeta);
        });

        seccion.appendChild(grilla);
        contenedorCategorias.appendChild(seccion);
    });

    refrescarIconos();
}

// =========================================
// 19. INICIO
// =========================================

async function iniciarPaginaProfesores() {
    console.log("Iniciando página de profesores...");

    const autenticado = await comprobarSesionProfesor();

    if (!autenticado) return;

    try {
        console.log("Cargando profesores disponibles...");

        await cargarProfesoresDisponibles();

        console.log("Cargando participantes...");

        await cargarParticipantesPublicos();

        console.log("Cargando notificaciones...");

        await cargarNotificaciones();

        console.log("Página de profesores cargada correctamente.");

    } catch (error) {
        console.error("Error al iniciar la página:", error);

        mostrarErrorVerificacion(
            "No se pudo iniciar el listado. Intentá recargar la página."
        );
    }
}

iniciarPaginaProfesores();