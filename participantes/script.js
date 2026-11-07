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
// 2. SELECTOR DE TEMA (COMPARTIDO)
// =========================================

const botonTema = document.getElementById("btn-tema");
let temaActual = localStorage.getItem("tema") || "oscuro";

function refrescarIconos() {
    if (window.lucide) window.lucide.createIcons();
}

function aplicarTema() {
    document.body.classList.toggle("tema-claro", temaActual === "claro");

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
// 3. ELEMENTOS COMPARTIDOS Y DEL LISTADO
// =========================================

let participantesPublicos = [];

const buscarParticipante = document.getElementById("buscar-participante");
const filtroProfesor = document.getElementById("filtro-profesor");
const cuerpoTabla = document.getElementById("cuerpo-tabla-participantes");
const estadoListado = document.getElementById("estado-listado");
const contenedorTabla = document.getElementById("contenedor-tabla");
const cantidadParticipantes = document.getElementById("cantidad-participantes");

const contenidoFicha = document.getElementById("contenido-ficha-publica");
const modalFicha = document.getElementById("modal-ficha-publica");
const botonCerrarFicha = document.getElementById("btn-cerrar-ficha");

let elementoQueAbrioFicha = null;

// Elementos exclusivos de categorías.
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

const esPaginaListado = Boolean(buscarParticipante && cuerpoTabla);
const esPaginaCategorias = Boolean(contenedorCategorias);


// =========================================
// 4. FUNCIONES AUXILIARES COMPARTIDAS
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

function obtenerDatosParticipante(registro) {
    return {
        id: obtenerCampo(registro, ["id", "inscripcion_id"]),
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


// =========================================
// 5. UNIFICAR FILAS POR PARTICIPANTE
// =========================================

// La RPC puede devolver una fila por modalidad.
// Se conserva una sola persona y se acumulan sus modalidades.

function quitarParticipantesDuplicados(lista) {
    const unicos = new Map();

    (lista || []).forEach(registro => {
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
                modalidad,
                horario: obtenerCampo(registro, [
                    "horario",
                    "hora_inicio",
                    "horario_inicio"
                ]),
                categoria_id: obtenerCampo(registro, ["categoria_id"]),
                grupo_edad: obtenerCampo(registro, ["grupo_edad"]),
                division_graduacion: obtenerCampo(registro, [
                    "division_graduacion",
                    "division_cinturon"
                ]),
                rango_peso: obtenerCampo(registro, ["rango_peso"]),
                estado_categoria: obtenerCampo(registro, ["estado_categoria"]),
                subdivision: obtenerCampo(registro, [
                    "subdivision",
                    "letra_subdivision",
                    "grupo_subdivision",
                    "division_llave"
                ])
            });
        }
    });

    return [...unicos.values()];
}


// =========================================
// 6. FICHA PÚBLICA DEL PARTICIPANTE
// =========================================

function actualizarEstadoModales() {
    const fichaAbierta = modalFicha && !modalFicha.hidden;
    const categoriaAbierta = modalCategoria && !modalCategoria.hidden;

    document.body.classList.toggle(
        "modal-abierto",
        Boolean(fichaAbierta || categoriaAbierta)
    );
}

function cerrarFichaParticipante() {
    if (!modalFicha) return;

    modalFicha.hidden = true;
    actualizarEstadoModales();

    if (elementoQueAbrioFicha && elementoQueAbrioFicha.isConnected) {
        elementoQueAbrioFicha.focus();
    }
    elementoQueAbrioFicha = null;
}

function abrirFichaParticipante(registro) {
    if (!contenidoFicha || !modalFicha) return;

    const p = obtenerDatosParticipante(registro);
    elementoQueAbrioFicha = document.activeElement;

    const genero = normalizar(p.genero);
    const esFemenino =
        genero.includes("fem") ||
        genero === "f" ||
        genero.includes("mujer");

    const claseAvatar = esFemenino ? "femenino" : "masculino";
    const rol = p.esProfesor ? "Participante · Profesor" : "Participante";
    const etiquetaInvitado = p.invitado
        ? '<span class="etiqueta-invitado">INVITADO</span>'
        : "";

    const ordenModalidadesFicha = {
        tul: 1,
        combate: 2,
        "media lucha": 3
    };

    const modalidades = [...(registro.modalidades || [])].sort((a, b) => {
        const ordenA = ordenModalidadesFicha[normalizar(a.modalidad)] || 99;
        const ordenB = ordenModalidadesFicha[normalizar(b.modalidad)] || 99;
        return ordenA - ordenB;
    });

    const tarjetasModalidades = modalidades.map(modalidad => {
        const nombreModalidad = escaparHTML(modalidad.modalidad);
        const horario = modalidad.horario
            ? escaparHTML(modalidad.horario)
            : "Horario pendiente de vincular";

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
                    <h2>${escaparHTML(p.nombre)} ${escaparHTML(p.apellido)}</h2>
                    <p class="ficha-rol">${rol}</p>
                </div>
                ${etiquetaInvitado}
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
                    <small>Graduación</small>
                    <strong>${escaparHTML(p.graduacion) || "—"}</strong>
                </div>
                <div class="ficha-dato">
                    <small>Profesor</small>
                    <strong class="ficha-profesor">${escaparHTML(p.profesor) || "—"}</strong>
                </div>
            </div>

            <div class="ficha-separador"></div>

            <h3 class="ficha-titulo-seccion">Compite en</h3>

            ${
                tarjetasModalidades
                    ? `<div class="ficha-modalidades">${tarjetasModalidades}</div>`
                    : `<p class="ficha-sin-modalidades">No hay modalidades registradas.</p>`
            }

            <p class="ficha-nota-horarios">
                Preferiblemente, venir un poco antes.
                Los horarios son estimados y pueden sufrir demoras.
            </p>
        </article>
    `;

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


// =========================================
// 7. FUNCIONES DEL LISTADO
// =========================================

function crearCelda(fila, etiqueta, contenido) {
    const celda = document.createElement("td");
    celda.dataset.label = etiqueta;
    celda.textContent = contenido || "—";
    fila.appendChild(celda);
}

function dibujarParticipantes(lista) {
    if (!cuerpoTabla || !cantidadParticipantes || !contenedorTabla || !estadoListado) {
        return;
    }

    cuerpoTabla.replaceChildren();

    cantidadParticipantes.textContent =
        `${lista.length} ${lista.length === 1 ? "participante" : "participantes"}`;

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
            participante.edad !== "" ? `${participante.edad} años` : "—"
        );
        crearCelda(fila, "Graduación", participante.graduacion);
        crearCelda(fila, "Profesor", participante.profesor);

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

function aplicarFiltrosParticipantes() {
    if (!buscarParticipante || !filtroProfesor) return;

    const busqueda = normalizar(buscarParticipante.value);
    const profesor = normalizar(filtroProfesor.value);

    const filtrados = participantesPublicos.filter(registro => {
        const p = obtenerDatosParticipante(registro);
        const nombreCompleto = normalizar(`${p.nombre} ${p.apellido}`);

        return (
            nombreCompleto.includes(busqueda) &&
            (!profesor || normalizar(p.profesor) === profesor)
        );
    });

    dibujarParticipantes(filtrados);
}

function cargarFiltroProfesores() {
    if (!filtroProfesor) return;

    const profesores = [
        ...new Set(
            participantesPublicos
                .map(registro => obtenerDatosParticipante(registro).profesor)
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

if (buscarParticipante) {
    buscarParticipante.addEventListener("input", aplicarFiltrosParticipantes);
}
if (filtroProfesor) {
    filtroProfesor.addEventListener("change", aplicarFiltrosParticipantes);
}


// =========================================
// 8. ORDEN Y CONSTRUCCIÓN DE CATEGORÍAS
// =========================================

const ordenModalidades = {
    tul: 1,
    "media lucha": 2,
    combate: 3
};

function nombreEdadCategoria(valor) {
    const edad = normalizar(valor);

    const equivalencias = [
        [/infantil.*hasta.?5|hasta.?5/, "Hasta 5 años"],
        [/infantil.*6.?7|6.?7/, "6 a 7 años"],
        [/infantil.*8.?9|8.?9/, "8 a 9 años"],
        [/infantil.*10.?11|10.?11/, "10 a 11 años"],
        [/cadete.*12.?13|12.?13/, "12 a 13 años"],
        [/juvenil.*14.?15|14.?15/, "14 a 15 años"],
        [/juvenil.*16.?17|16.?17/, "16 a 17 años"],
        [/adulto.*18.?35|18.?35/, "18 a 35 años"],
        [/senior|36.*mas|36\+/, "36 años o más"]
    ];

    for (const [patron, nombre] of equivalencias) {
        if (patron.test(edad)) return nombre;
    }

    return String(valor || "Edad sin especificar");
}

function nombreGeneroCategoria(valor) {
    const genero = normalizar(valor);
    if (genero.includes("fem") || genero === "f") return "Femenino";
    if (genero.includes("masc") || genero === "m") return "Masculino";
    return String(valor || "Género sin especificar");
}

function ordenGeneroCategoria(valor) {
    const genero = normalizar(valor);
    if (genero.includes("fem") || genero === "f") return 1;
    if (genero.includes("masc") || genero === "m") return 2;
    return 3;
}

function ordenDivisionCinturon(valor) {
    const texto = normalizar(valor);

    if (texto.includes("blanco") && texto.includes("amarillo")) return 2;
    if (texto.includes("blanco")) return 1;
    if (texto.includes("amarillo") && texto.includes("verde")) return 4;
    if (texto.includes("amarillo")) return 3;
    if (texto.includes("verde") && texto.includes("azul")) return 6;
    if (texto.includes("verde")) return 5;
    if (texto.includes("azul") && texto.includes("rojo")) return 8;
    if (texto.includes("azul")) return 7;
    if (texto.includes("rojo") && texto.includes("negra")) return 10;
    if (texto.includes("rojo")) return 9;

    const danes = texto.match(/\b(i{1,3}|iv|v|vi)\s*dan\b/);
    if (danes) {
        const valores = { i: 11, ii: 12, iii: 13, iv: 14, v: 15, vi: 16 };
        return valores[danes[1]] || 99;
    }

    if (texto.includes("primer dan")) return 11;
    if (texto.includes("segundo dan")) return 12;
    if (texto.includes("tercer dan")) return 13;
    if (texto.includes("cuarto dan")) return 14;
    if (texto.includes("quinto dan")) return 15;
    if (texto.includes("sexto dan")) return 16;

    return 99;
}

function obtenerValorPeso(valor) {
    const coincidencia = String(valor || "").match(/\d+(?:[.,]\d+)?/);
    return coincidencia ? Number(coincidencia[0].replace(",", ".")) : 999;
}

function obtenerLetraSubdivision(modalidad) {
    const valor = obtenerCampo(modalidad, [
        "subdivision",
        "letra_subdivision",
        "grupo_subdivision",
        "division_llave"
    ]);

    const coincidencia = String(valor || "").match(/\b([A-Z])\b/i);
    return coincidencia ? coincidencia[1].toUpperCase() : "";
}

function generarTituloCategoria(categoria) {
    const partes = [
        categoria.edad,
        categoria.genero,
        categoria.division
    ].filter(Boolean);

    if (normalizar(categoria.modalidad) === "combate" && categoria.peso) {
        partes.push(categoria.peso);
    }

    if (categoria.subdivision) {
        partes.push(`Subdivisión ${categoria.subdivision}`);
    }

    return partes.join(" · ") || "Categoría";
}

function generarCategoriasPublicas(participantes) {
    const agrupadas = new Map();

    participantes.forEach(registro => {
        const p = obtenerDatosParticipante(registro);

        (registro.modalidades || []).forEach(modalidad => {
            const modalidadNombre = String(modalidad.modalidad || "").trim();
            const modalidadNormalizada = normalizar(modalidadNombre);

            if (!Object.prototype.hasOwnProperty.call(ordenModalidades, modalidadNormalizada)) {
                return;
            }

            const categoriaId = modalidad.categoria_id || "sin-categoria";
            const subdivision = obtenerLetraSubdivision(modalidad);
            const clave = `${categoriaId}|${modalidadNormalizada}|${subdivision}`;

            if (!agrupadas.has(clave)) {
                const edadOriginal = modalidad.grupo_edad || "";
                const division = modalidad.division_graduacion || p.graduacion || "";
                const peso = modalidad.rango_peso || "";

                const categoria = {
                    clave,
                    categoriaId,
                    modalidad: modalidadNombre,
                    modalidadNormalizada,
                    edad: nombreEdadCategoria(edadOriginal),
                    edadOriginal,
                    genero: nombreGeneroCategoria(p.genero),
                    division: String(division || "Graduación sin especificar"),
                    peso: String(peso || ""),
                    subdivision,
                    participantes: new Map()
                };

                categoria.titulo = generarTituloCategoria(categoria);
                agrupadas.set(clave, categoria);
            }

            const categoria = agrupadas.get(clave);
            const participanteId = p.id || [
                normalizar(p.nombre),
                normalizar(p.apellido),
                normalizar(p.genero)
            ].join("|");

            if (!categoria.participantes.has(participanteId)) {
                categoria.participantes.set(participanteId, registro);
            }
        });
    });

    return [...agrupadas.values()]
        .filter(categoria => categoria.participantes.size >= 2)
        .map(categoria => ({
            ...categoria,
            participantes: [...categoria.participantes.values()]
        }))
        .sort((a, b) => {
            const modalidad = (ordenModalidades[a.modalidadNormalizada] || 99) -
                (ordenModalidades[b.modalidadNormalizada] || 99);
            if (modalidad) return modalidad;

            const edad = obtenerNumeroEdad(a.edad) - obtenerNumeroEdad(b.edad);
            if (edad) return edad;

            const cinturon = ordenDivisionCinturon(a.division) -
                ordenDivisionCinturon(b.division);
            if (cinturon) return cinturon;

            const genero = ordenGeneroCategoria(a.genero) -
                ordenGeneroCategoria(b.genero);
            if (genero) return genero;

            const peso = obtenerValorPeso(a.peso) - obtenerValorPeso(b.peso);
            if (peso) return peso;

            return a.subdivision.localeCompare(b.subdivision);
        });
}

function obtenerNumeroEdad(valor) {
    const coincidencia = String(valor || "").match(/\d+/);
    return coincidencia ? Number(coincidencia[0]) : 999;
}


// =========================================
// 9. DIBUJAR Y ABRIR CATEGORÍAS
// =========================================

function dibujarCategorias() {
    if (!contenedorCategorias || !estadoCategorias || !cantidadCategorias) return;

    contenedorCategorias.replaceChildren();

    cantidadCategorias.textContent =
        `${categoriasPublicas.length} ${
            categoriasPublicas.length === 1 ? "categoría publicada" : "categorías publicadas"
        }`;

    if (categoriasPublicas.length === 0) {
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
                modalidad === "tul" ? "Tul" :
                modalidad === "media lucha" ? "Media lucha" : "Combate"
            )}</h2>
            <span>${categorias.length} ${categorias.length === 1 ? "categoría" : "categorías"}</span>
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
                    <span class="tarjeta-categoria-titulo">${escaparHTML(categoria.titulo)}</span>
                    <span class="tarjeta-categoria-cantidad">
                        ${categoria.participantes.length}
                        ${categoria.participantes.length === 1 ? "participante" : "participantes"}
                    </span>
                </span>
                <span class="tarjeta-categoria-icono"><i data-lucide="arrow-up-right"></i></span>
            `;
            tarjeta.addEventListener("click", () => abrirDetalleCategoria(categoria, tarjeta));
            grilla.appendChild(tarjeta);
        });

        seccion.appendChild(grilla);
        contenedorCategorias.appendChild(seccion);
    });

    refrescarIconos();
}

function abrirDetalleCategoria(categoria, elemento) {
    if (!modalCategoria || !contenidoModalCategoria || !tituloModalCategoria) return;

    categoriaAbierta = categoria;
    elementoQueAbrioCategoria = elemento || document.activeElement;

    tituloModalCategoria.textContent = categoria.titulo;

    const participantesOrdenados = [...categoria.participantes].sort((a, b) => {
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
                <span class="detalle-categoria-modalidad">${escaparHTML(categoria.modalidad)}</span>
                <span>${participantesOrdenados.length} participantes</span>
            </div>

            <div class="lista-participantes-categoria">
                ${participantesOrdenados.map((registro, indice) => {
                    const p = obtenerDatosParticipante(registro);
                    return `
                        <button
                            type="button"
                            class="fila-participante-categoria"
                            data-indice="${indice}"
                        >
                            <span class="numero-participante">${String(indice + 1).padStart(2, "0")}</span>
                            <span class="datos-participante-categoria">
                                <strong>${escaparHTML(p.apellido)}, ${escaparHTML(p.nombre)}</strong>
                                <small>${escaparHTML(p.graduacion || "Graduación sin especificar")}</small>
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
                const indice = Number(boton.dataset.indice);
                abrirFichaParticipante(participantesOrdenados[indice]);
            });
        });

    modalCategoria.hidden = false;
    actualizarEstadoModales();
    refrescarIconos();

    if (botonCerrarCategoria) botonCerrarCategoria.focus();
}

function cerrarDetalleCategoria() {
    if (!modalCategoria) return;

    modalCategoria.hidden = true;
    categoriaAbierta = null;
    actualizarEstadoModales();

    if (elementoQueAbrioCategoria && elementoQueAbrioCategoria.isConnected) {
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
// 10. CARGA ÚNICA DESDE SUPABASE
// =========================================

async function cargarParticipantesPublicos() {
    const estado = esPaginaListado ? estadoListado : estadoCategorias;
    const cantidad = esPaginaListado ? cantidadParticipantes : cantidadCategorias;
    const tabla = contenedorTabla;

    try {
        if (estado) {
            estado.hidden = false;
            estado.classList.remove("error");
            estado.textContent = "Cargando participantes...";
        }
        if (cantidad) cantidad.textContent = "Cargando participantes...";
        if (tabla) tabla.hidden = true;

        const { data, error } = await supabaseClient.rpc(
            "listar_inscripciones_publicas"
        );

        if (error) throw error;

        participantesPublicos = quitarParticipantesDuplicados(data || []);

        if (esPaginaListado) {
            cargarFiltroProfesores();
            aplicarFiltrosParticipantes();
        }

        if (esPaginaCategorias) {
            categoriasPublicas = generarCategoriasPublicas(participantesPublicos);
            dibujarCategorias();
        }

        return true;
    } catch (error) {
        console.error("Error al cargar participantes:", error);

        participantesPublicos = [];

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
            categoriasPublicas = [];
            if (estadoCategorias) {
                estadoCategorias.hidden = false;
                estadoCategorias.classList.add("error");
                estadoCategorias.textContent =
                    "No se pudieron cargar las categorías. Intentá nuevamente.";
            }
            if (cantidadCategorias) {
                cantidadCategorias.textContent = "Error al cargar las categorías";
            }
        }

        return false;
    }
}


// =========================================
// 11. NAVEGACIÓN Y CIERRE CON ESCAPE
// =========================================

const botonVolver = document.getElementById("btn-volver");

if (botonVolver) {
    botonVolver.addEventListener("click", () => {
        if (esPaginaCategorias) {
            window.location.href = "../index.html#pantalla-participante";
            return;
        }

        const parametros = new URLSearchParams(window.location.search);
        const origen = parametros.get("origen");

        window.location.href = origen
            ? `../index.html#${encodeURIComponent(origen)}`
            : "../index.html";
    });
}

document.addEventListener("keydown", evento => {
    if (evento.key !== "Escape") return;

    if (modalFicha && !modalFicha.hidden) {
        cerrarFichaParticipante();
        return;
    }

    if (modalCategoria && !modalCategoria.hidden) {
        cerrarDetalleCategoria();
    }
});


// =========================================
// 12. INICIO
// =========================================

cargarParticipantesPublicos();
refrescarIconos();
