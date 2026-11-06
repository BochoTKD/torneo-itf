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
// 9. LISTADO Y FICHAS DE PARTICIPANTES
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

const contenidoFicha =
    document.getElementById("contenido-ficha-publica");


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


// Escapar valores antes de insertarlos en HTML.
function escaparHTML(valor) {

    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caracter]);
}


// Obtener los datos principales de un participante.
function obtenerDatosParticipante(registro) {

    return {

        id: obtenerCampo(registro, [
            "id",
            "inscripcion_id"
        ]),

        nombre: obtenerCampo(registro, ["nombre"]),

        apellido: obtenerCampo(registro, ["apellido"]),

        edad: obtenerCampo(registro, ["edad"]),

        genero: obtenerCampo(registro, ["genero"]),

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
        ]),

        invitado: obtenerCampo(registro, ["invitado"]) === true,

        esProfesor: obtenerCampo(registro, [
            "es_profesor",
            "profesor_participante"
        ]) === true
    };
}


// Agrupar las filas de un participante.
// Supabase devuelve una fila por modalidad,
// pero la ficha debe mostrar una sola persona.
function quitarParticipantesDuplicados(lista) {

    const unicos = new Map();

    lista.forEach(registro => {

        const p = obtenerDatosParticipante(registro);

        const clave = p.id || [
            normalizar(p.nombre),
            normalizar(p.apellido),
            normalizar(registro.fecha_nacimiento),
            normalizar(p.genero)
        ].join("|");

        if (!unicos.has(clave)) {

            unicos.set(clave, {
                ...registro,
                modalidades: []
            });
        }

        const participante = unicos.get(clave);

        const modalidad = obtenerCampo(registro, [
            "modalidad",
            "nombre_modalidad"
        ]);

        if (
            modalidad &&
            !participante.modalidades.some(
                item => normalizar(item.modalidad) === normalizar(modalidad)
            )
        ) {
            participante.modalidades.push({
                modalidad: modalidad,
                horario: obtenerCampo(registro, [
                    "horario",
                    "hora_inicio",
                    "horario_inicio"
                ]),
                categoria_id: obtenerCampo(registro, [
                    "categoria_id"
                ]),
                grupo_edad: obtenerCampo(registro, [
                    "grupo_edad"
                ]),
                division_graduacion: obtenerCampo(registro, [
                    "division_graduacion"
                ]),
                rango_peso: obtenerCampo(registro, [
                    "rango_peso"
                ]),
                estado_categoria: obtenerCampo(registro, [
                    "estado_categoria"
                ])
            });
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

        fila.classList.add("fila-participante");
        fila.tabIndex = 0;
        fila.setAttribute("role", "button");
        fila.setAttribute(
            "aria-label",
            `Ver ficha de ${participante.nombre} ${participante.apellido}`
        );

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

        fila.addEventListener("click", () => {
            abrirFichaParticipante(registro);
        });

        fila.addEventListener("keydown", evento => {

            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                abrirFichaParticipante(registro);
            }
        });

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


// =================================
// FICHA EMERGENTE DEL PARTICIPANTE
// =================================

const modalFicha = document.getElementById("modal-ficha-publica");

const botonCerrarFicha = document.getElementById("btn-cerrar-ficha");

let elementoQueAbrioFicha = null;


// Cerrar ficha y volver al mismo punto del listado.
function cerrarFichaParticipante() {
    modalFicha.hidden = true;

    if (modalCategoria.hidden) {
        document.body.classList.remove("modal-abierto");
    }

    if (elementoQueAbrioFicha) {
        elementoQueAbrioFicha.focus();
        elementoQueAbrioFicha = null;
    }
}


// Abrir ficha sin cambiar de pantalla.
function abrirFichaParticipante(registro) {

    const p = obtenerDatosParticipante(registro);

    elementoQueAbrioFicha = document.activeElement;

    const genero = normalizar(p.genero);

    const esFemenino =
        genero.includes("fem") ||
        genero === "f" ||
        genero.includes("mujer");

    const claseAvatar = esFemenino
        ? "femenino"
        : "masculino";

    const rol = p.esProfesor
        ? "Participante · Profesor"
        : "Participante";

    const etiquetaInvitado = p.invitado
        ? '<span class="etiqueta-invitado">INVITADO</span>'
        : "";

    // Orden: Tul, Combate y Media lucha.
    const ordenModalidades = {
        "tul": 1,
        "combate": 2,
        "media lucha": 3
    };

    const modalidades = [...(registro.modalidades || [])].sort(
        (a, b) => {
            const ordenA =
                ordenModalidades[normalizar(a.modalidad)] || 99;

            const ordenB =
                ordenModalidades[normalizar(b.modalidad)] || 99;

            return ordenA - ordenB;
        }
    );

    const tarjetasModalidades = modalidades.map((modalidad, indice) => {

        const nombreModalidad = escaparHTML(modalidad.modalidad);

        const horario = modalidad.horario
            ? escaparHTML(modalidad.horario)
            : "Horario pendiente de vincular";

        const categoriaDisponible =
            modalidad.categoria_id !== "" &&
            modalidad.categoria_id !== null;

        const detalleCategoria = [
            modalidad.grupo_edad
                ? `Grupo de edad: ${modalidad.grupo_edad}`
                : "",
            modalidad.division_graduacion
                ? `División: ${modalidad.division_graduacion}`
                : "",
            modalidad.rango_peso
                ? `Rango de peso: ${modalidad.rango_peso}`
                : "",
            modalidad.estado_categoria
                ? `Estado: ${modalidad.estado_categoria}`
                : ""
        ].filter(Boolean).map(escaparHTML).join("<br>");

        return `
            <article class="tarjeta-modalidad">

                <h3>${nombreModalidad}</h3>

                <p class="modalidad-horario">
                    <strong>Horario:</strong> ${horario}
                </p>

<div class="modalidad-acciones">
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
        `;
    }).join("");


    contenidoFicha.innerHTML = `

        <article class="ficha-participante">

            <div class="ficha-encabezado">

                <div class="ficha-avatar ${claseAvatar}">
                    <i data-lucide="user-round"></i>
                </div>

                <div class="ficha-identidad">
                    <h2>
                        ${escaparHTML(p.nombre)}
                        ${escaparHTML(p.apellido)}
                    </h2>

                    <p class="ficha-rol">
                        ${rol}
                    </p>
                </div>

                ${etiquetaInvitado}

            </div>


            <div class="ficha-separador"></div>


            <div class="ficha-datos-basicos">

                <div class="ficha-dato">
                    <small>Edad</small>
                    <strong>
                        ${p.edad !== ""
                            ? escaparHTML(p.edad) + " años"
                            : "—"}
                    </strong>
                </div>

                <div class="ficha-dato">
                    <small>Género</small>
                    <strong>
                        ${escaparHTML(p.genero) || "—"}
                    </strong>
                </div>

            </div>


            <div class="ficha-separador"></div>


            <h3 class="ficha-titulo-seccion">
                Datos generales
            </h3>

            <div class="ficha-datos-generales">

                <div class="ficha-dato">
                    <small>Graduación</small>
                    <strong>
                        ${escaparHTML(p.graduacion) || "—"}
                    </strong>
                </div>

                <div class="ficha-dato">
                    <small>Profesor</small>
                    <strong class="ficha-profesor">
                        ${escaparHTML(p.profesor) || "—"}
                    </strong>
                </div>

            </div>


            <div class="ficha-separador"></div>


            <h3 class="ficha-titulo-seccion">
                Compite en
            </h3>

            ${
                tarjetasModalidades
                    ? `<div class="ficha-modalidades">
                        ${tarjetasModalidades}
                       </div>`
                    : `<p class="ficha-sin-modalidades">
                        No hay modalidades registradas.
                       </p>`
            }

            <p class="ficha-nota-horarios">
                Preferiblemente, venir un poco antes.
                Los horarios son estimados y pueden sufrir demoras.
            </p>

        </article>
    `;

    // Mostrar modal por encima del listado.
    modalFicha.hidden = false;
    document.body.classList.add("modal-abierto");

    lucide.createIcons();

    botonCerrarFicha.focus();

}


// Cerrar con el botón.
botonCerrarFicha.addEventListener(
    "click",
    cerrarFichaParticipante
);


// Cerrar al tocar el fondo oscuro.
modalFicha.addEventListener("click", evento => {

    if (evento.target === modalFicha) {
        cerrarFichaParticipante();
    }
});


// Cerrar con Escape.
document.addEventListener("keydown", evento => {

    if (evento.key === "Escape" && !modalFicha.hidden) {
        cerrarFichaParticipante();
    }
});


// ==========================================
// CATEGORÍAS PÚBLICAS
// ==========================================

const botonVerCategorias = document.getElementById("btn-ver-categorias");
const contenedorCategorias = document.getElementById("contenedor-categorias");
const estadoCategorias = document.getElementById("estado-categorias");
const cantidadCategorias = document.getElementById("cantidad-categorias");

const modalCategoria = document.getElementById("modal-categoria");
const tituloModalCategoria = document.getElementById("titulo-modal-categoria");
const contenidoModalCategoria = document.getElementById("contenido-modal-categoria");
const botonCerrarCategoria = document.getElementById("btn-cerrar-categoria");

let categoriasPublicas = [];
let categoriaAbierta = null;
let elementoQueAbrioCategoria = null;

// Orden de las modalidades.
const ordenModalidades = {
    "tul": 1,
    "media lucha": 2,
    "combate": 3
};

// Orden de los cinturones y divisiones.
const ordenCinturones = {
    "blanco a blanco punta amarilla": 1,
    "blanco a punta amarilla": 1,
    "amarillo a amarillo punta verde": 3,
    "amarillo a punta verde": 3,
    "verde a verde punta azul": 5,
    "verde a punta azul": 5,
    "azul a rojo punta negra": 7,
    "azul a punta roja": 7,
    "rojo a punta negra": 9,
    "i dan": 11,
    "primer dan": 11,
    "ii a iii dan": 12,
    "ii dan": 12,
    "segundo dan": 12,
    "iii dan": 13,
    "tercer dan": 13,
    "iv a vi dan": 14,
    "iv dan": 14,
    "cuarto dan": 14,
    "v dan": 15,
    "quinto dan": 15,
    "vi dan": 16,
    "sexto dan": 16
};

// Convierte los nombres de los grupos de edad a títulos más claros.
function nombreEdadCategoria(nombre) {
    const valor = normalizar(nombre);

    const equivalencias = {
        "infantil hasta 5": "Hasta 5 años",
        "infantil 6-7": "6 a 7 años",
        "infantil 8-9": "8 a 9 años",
        "infantil 10-11": "10 a 11 años",
        "cadetes 12-13": "12 a 13 años",
        "juveniles 14-15": "14 a 15 años",
        "juveniles 16-17": "16 a 17 años",
        "adultos 18-35": "18 a 35 años",
        "seniors 36+": "36 años o más"
    };

    return equivalencias[valor] || nombre || "Edad no especificada";
}

// Normaliza el género para mostrarlo y ordenarlo.
function nombreGeneroCategoria(genero) {
    const valor = normalizar(genero);

    if (["f", "femenino", "mujer"].includes(valor)) {
        return "Femenino";
    }

    if (["m", "masculino", "hombre"].includes(valor)) {
        return "Masculino";
    }

    return genero || "Sin especificar";
}

function ordenGeneroCategoria(genero) {
    const valor = nombreGeneroCategoria(genero);

    if (valor === "Femenino") return 1;
    if (valor === "Masculino") return 2;

    return 3;
}

// Obtiene el orden de una división de cinturones.
function ordenDivisionCinturon(division) {
    const valor = normalizar(division);

    if (ordenCinturones[valor]) {
        return ordenCinturones[valor];
    }

    // Para divisiones individuales que puedan agregarse más adelante.
    const dan = valor.match(/(?:^|\s)(i{1,3}|iv|v|vi)\s*dan/);

    if (dan) {
        const danes = {
            "i": 11,
            "ii": 12,
            "iii": 13,
            "iv": 14,
            "v": 15,
            "vi": 16
        };

        return danes[dan[1]] || 99;
    }

    return 99;
}

// Ordena los pesos por su primer valor numérico.
function obtenerValorPeso(peso) {
    const coincidencia = String(peso || "").match(/\d+(?:[.,]\d+)?/);
    return coincidencia ? Number(coincidencia[0].replace(",", ".")) : 9999;
}

// Busca la letra de una subdivisión si ya viene en los datos.
function obtenerLetraSubdivision(datos) {
    const posiblesCampos = [
        datos.subdivision,
        datos.letra_subdivision,
        datos.grupo_subdivision,
        datos.division_llave
    ];

    for (const campo of posiblesCampos) {
        if (typeof campo === "string" && /^[A-Z]$/i.test(campo.trim())) {
            return campo.trim().toUpperCase();
        }
    }

    return "";
}

// Obtiene el título completo de la categoría.
function generarTituloCategoria(categoria) {
    const partes = [
        categoria.edad,
        categoria.genero,
        categoria.cinturones
    ];

    if (categoria.modalidad === "Combate" && categoria.peso) {
        partes.push(categoria.peso);
    }

    if (categoria.subdivision) {
        partes.push(categoria.subdivision);
    }

    return partes.filter(Boolean).join(" | ");
}

// Agrupa las inscripciones por categoría y modalidad.
function generarCategoriasPublicas() {
    const agrupadas = new Map();

    participantesPublicos.forEach(participante => {
        const modalidades = participante.modalidades || [];

        modalidades.forEach(modalidad => {
            const categoriaId = modalidad.categoria_id ?? participante.categoria_id;

            if (categoriaId === null || categoriaId === undefined || categoriaId === "") {
                return;
            }

            const nombreModalidad =
                modalidad.modalidad ||
                modalidad.nombre ||
                participante.modalidad ||
                "";

            const modalidadNormalizada = normalizar(nombreModalidad);

            if (!ordenModalidades[modalidadNormalizada]) {
                return;
            }

            const grupoEdad =
                modalidad.grupo_edad ||
                participante.grupo_edad ||
                "";

            const division =
                modalidad.division_graduacion ||
                participante.division_graduacion ||
                "";

            const rangoPeso =
                modalidad.rango_peso ||
                participante.rango_peso ||
                "";

            const subdivision = obtenerLetraSubdivision(modalidad);

            const clave = [
                categoriaId,
                modalidadNormalizada,
                subdivision
            ].join("|");

            if (!agrupadas.has(clave)) {
                agrupadas.set(clave, {
                    categoria_id: categoriaId,
                    modalidad: nombreModalidad,
                    modalidadOrden: ordenModalidades[modalidadNormalizada],
                    edad: nombreEdadCategoria(grupoEdad),
                    edadOrden: obtenerNumeroEdad(grupoEdad),
                    genero: nombreGeneroCategoria(participante.genero),
                    cinturones: division,
                    cinturonesOrden: ordenDivisionCinturon(division),
                    peso: rangoPeso,
                    pesoOrden: obtenerValorPeso(rangoPeso),
                    subdivision,
                    participantes: new Map()
                });
            }

            const categoria = agrupadas.get(clave);
            const idParticipante = participante.id || [
                participante.nombre,
                participante.apellido
            ].join("|");

            if (!categoria.participantes.has(idParticipante)) {
                categoria.participantes.set(idParticipante, participante);
            }
        });
    });

    // No mostrar categorías con menos de dos participantes.
    categoriasPublicas = [...agrupadas.values()]
        .filter(categoria => categoria.participantes.size >= 2);

    // Orden: modalidad, edad, cinturón, género y peso.
categoriasPublicas.sort((a, b) =>
    a.modalidadOrden - b.modalidadOrden ||
    a.edadOrden - b.edadOrden ||
    a.cinturonesOrden - b.cinturonesOrden ||
    ordenGeneroCategoria(a.genero) - ordenGeneroCategoria(b.genero) ||
    a.pesoOrden - b.pesoOrden ||
    a.subdivision.localeCompare(b.subdivision)
);
}

// Extrae el primer número de un grupo de edad para ordenarlo.
function obtenerNumeroEdad(grupoEdad) {
    const coincidencia = String(grupoEdad || "").match(/\d+/);
    return coincidencia ? Number(coincidencia[0]) : 999;
}
// Orden de las categorías: edad, cinturón, género y peso.
function compararOrdenCategorias(a, b) {

    // Orden de edades
    const ordenEdades = [
        "infantil hasta 5",
        "infantil 6-7",
        "infantil 8-9",
        "infantil 10-11",
        "cadetes 12-13",
        "juveniles 14-15",
        "juveniles 16-17",
        "adultos 18-35",
        "seniors 36+"
    ];

    // Orden de graduaciones
    const ordenCinturones = [
        "blanco a blanco punta amarilla",
        "amarillo a amarillo punta verde",
        "verde a verde punta azul",
        "azul a rojo punta negra",
        "i dan",
        "ii a iii dan",
        "iv a vi dan"
    ];

    const edadA = ordenEdades.indexOf(
        normalizar(a.grupo_edad).replace(/[–—]/g, "-")
    );

    const edadB = ordenEdades.indexOf(
        normalizar(b.grupo_edad).replace(/[–—]/g, "-")
    );

    if (edadA !== edadB) {
        return (edadA === -1 ? 99 : edadA) -
               (edadB === -1 ? 99 : edadB);
    }

    const cinturonA = ordenCinturones.indexOf(
        normalizar(a.division_graduacion)
    );

    const cinturonB = ordenCinturones.indexOf(
        normalizar(b.division_graduacion)
    );

    if (cinturonA !== cinturonB) {
        return (cinturonA === -1 ? 99 : cinturonA) -
               (cinturonB === -1 ? 99 : cinturonB);
    }

    // Femenino primero, masculino después
    const generoA = normalizar(a.genero) === "femenino" ? 0 : 1;
    const generoB = normalizar(b.genero) === "femenino" ? 0 : 1;

    if (generoA !== generoB) {
        return generoA - generoB;
    }

    // En combate, ordenar por peso
    return normalizar(a.rango_peso).localeCompare(
        normalizar(b.rango_peso),
        "es",
        { numeric: true }
    );
}

// Dibuja las tarjetas agrupadas por modalidad.
function dibujarCategorias() {
    generarCategoriasPublicas();

    contenedorCategorias.innerHTML = "";

    cantidadCategorias.textContent =
        `${categoriasPublicas.length} categorías disponibles`;

    if (categoriasPublicas.length === 0) {
        estadoCategorias.textContent = "No hay categorías disponibles.";
        estadoCategorias.hidden = false;
        return;
    }

    estadoCategorias.hidden = true;

    const modalidades = ["Tul", "Media lucha", "Combate"];

    modalidades.forEach(nombreModalidad => {
        const categorias = categoriasPublicas
    .filter(
        categoria =>
            normalizar(categoria.modalidad) === normalizar(nombreModalidad)
    );

        if (categorias.length === 0) return;

        const seccion = document.createElement("section");
        seccion.className = "seccion-categorias";

        const encabezado = document.createElement("h2");
        encabezado.className = "encabezado-modalidad-categorias";
        encabezado.textContent = nombreModalidad;

        const grilla = document.createElement("div");
        grilla.className = "lista-categorias";

        categorias.forEach(categoria => {
            const tarjeta = document.createElement("button");
            tarjeta.type = "button";
            tarjeta.className = "tarjeta-categoria";

            const titulo = generarTituloCategoria(categoria);
            const cantidad = categoria.participantes.size;

            tarjeta.innerHTML = `
                <strong class="titulo-tarjeta-categoria">
                    ${escaparHTML(titulo)}
                </strong>

                <span class="cantidad-tarjeta-categoria">
                    ${cantidad} participantes
                </span>

                <span class="flecha-tarjeta-categoria">
                    <i data-lucide="arrow-up-right"></i>
                </span>
            `;

            tarjeta.addEventListener("click", () => {
                abrirDetalleCategoria(categoria, tarjeta);
            });

            grilla.appendChild(tarjeta);
        });

        seccion.appendChild(encabezado);
        seccion.appendChild(grilla);
        contenedorCategorias.appendChild(seccion);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

// Abre el modal con los participantes de una categoría.

function abrirDetalleCategoria(categoria, elementoOrigen) {
    categoriaAbierta = categoria;
    elementoQueAbrioCategoria = elementoOrigen;

    tituloModalCategoria.textContent =
        generarTituloCategoria(categoria);

    // Obtener y ordenar participantes por apellido y nombre.
    const participantes = [...categoria.participantes.values()]
        .sort((a, b) =>
            `${a.apellido || ""} ${a.nombre || ""}`.localeCompare(
                `${b.apellido || ""} ${b.nombre || ""}`,
                "es"
            )
        );

    // Insertar el contenido del modal.
    contenidoModalCategoria.innerHTML = `
        <div class="detalle-categoria-encabezado">

            <span class="modalidad-detalle-categoria">
                ${escaparHTML(categoria.modalidad)}
            </span>

            <strong>
                ${participantes.length}
                ${participantes.length === 1 ? "participante" : "participantes"}
            </strong>

        </div>

        <div class="lista-participantes-categoria">

            ${participantes.map((participante, indice) => `
                <button
                    type="button"
                    class="participante-categoria"
                    data-indice="${indice}"
                >
                    <span class="numero-participante-categoria">
                        ${indice + 1}
                    </span>

                    <span class="nombre-participante-categoria">
                        ${escaparHTML(
                            `${participante.apellido || ""} ${participante.nombre || ""}`.trim()
                        )}
                    </span>

                    <i data-lucide="chevron-right"></i>
                </button>
            `).join("")}

        </div>
    `;

    // Asignar el evento a cada participante.
    contenidoModalCategoria
        .querySelectorAll(".participante-categoria")
        .forEach(boton => {

            boton.addEventListener("click", () => {

                const indice = Number(boton.dataset.indice);
                const participante = participantes[indice];

                abrirFichaParticipante(participante);
            });
        });

    // Mostrar modal.
    modalCategoria.hidden = false;
    document.body.classList.add("modal-abierto");

    if (window.lucide) {
        lucide.createIcons();
    }

    botonCerrarCategoria.focus();
}


// Cierra el modal de categoría.
function cerrarDetalleCategoria() {
    modalCategoria.hidden = true;
    categoriaAbierta = null;

    if (modalFicha.hidden) {
        document.body.classList.remove("modal-abierto");
    }

    if (elementoQueAbrioCategoria) {
        elementoQueAbrioCategoria.focus();
        elementoQueAbrioCategoria = null;
    }
}

botonCerrarCategoria.addEventListener("click", cerrarDetalleCategoria);

modalCategoria.addEventListener("click", evento => {
    if (evento.target === modalCategoria) {
        cerrarDetalleCategoria();
    }
});

// Cargar categorías al entrar en la pantalla.
botonVerCategorias.addEventListener("click", async () => {
    mostrarPantalla("pantalla-categorias");

    estadoCategorias.textContent = "Cargando categorías...";
    estadoCategorias.hidden = false;
    contenedorCategorias.innerHTML = "";

    try {
        await cargarParticipantesPublicos();
        dibujarCategorias();
    } catch (error) {
        console.error("Error al cargar categorías:", error);
        estadoCategorias.textContent = "No se pudieron cargar las categorías.";
        estadoCategorias.hidden = false;
    }
});

// Escape: primero cierra la ficha; luego, en otro Escape, la categoría.
document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && !modalCategoria.hidden && modalFicha.hidden) {
        cerrarDetalleCategoria();
    }
});

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

//11 BOTONES PARA VOLVER
document.querySelectorAll(".btn-volver").forEach(boton => {
    boton.addEventListener("click", () => {
        const pantallaActual =
            document.querySelector(".pantalla.activa")?.id;

        if (pantallaActual === "pantalla-provisional") {
            mostrarPantalla(pantallaAnterior);
        } else if (pantallaActual === "pantalla-listado-publico") {
            mostrarPantalla("pantalla-participante");
        } else if (pantallaActual === "pantalla-categorias") {
            mostrarPantalla("pantalla-participante");
        } else {
            mostrarPantalla("pantalla-inicio");
        }
    });
});

async function cargarParticipantesPublicos() {
    const estadoListado = document.getElementById("estado-listado");

    try {
        estadoListado.hidden = false;
        estadoListado.textContent = "Cargando participantes...";

        const { data, error } = await supabaseClient.rpc(
            "listar_inscripciones_publicas"
        );

        if (error) {
            throw error;
        }

        participantesPublicos = quitarParticipantesDuplicados(data || []);

        cargarFiltroProfesores();
        aplicarFiltrosParticipantes();

        return true;

    } catch (error) {
        console.error("Error al cargar participantes:", error);

        estadoListado.hidden = false;
        estadoListado.textContent =
            "No se pudieron cargar los participantes. Intentá nuevamente.";

        return false;
    }
}
