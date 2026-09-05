// @ts-check
/**
 * Formas de los datos del ERP, en un solo sitio.
 *
 * Hasta ahora estaban implícitas: cada componente asumía qué campos traía un parte o
 * una ficha, y el desajuste solo se veía en producción. Esto no valida nada en tiempo
 * de ejecución —es JSDoc, no TypeScript— pero hace que el editor avise al escribir.
 *
 * NOTA SOBRE LOS OPCIONALES: casi todo es opcional a propósito. La base tiene
 * documentos de varias épocas del proyecto y muchos campos se añadieron por el camino
 * (obraId y trabajadorId en el Bloque 2, horasBaseMensuales en la Fase B). Marcar como
 * obligatorio algo que a los documentos antiguos les falta daría una falsa seguridad.
 *
 * Este archivo solo exporta tipos. El `export {}` final es lo que lo hace un módulo.
 */

// ---------------------------------------------------------------- trabajadores

/**
 * Ficha de plantilla. Vive en `trabajadores/{id}`.
 * @typedef {Object} Trabajador
 * @property {string} [id]                   id del documento
 * @property {string} nombre                 nombre oficial, el que sale en los albaranes
 * @property {string} [email]                cuenta de acceso vinculada, en minúsculas
 * @property {'operario'|'admin'} [rol]      etiqueta de la ficha; el permiso REAL vive
 *                                           en roles/{uid} y en el claim del token
 * @property {boolean} [papelera]
 * @property {number} [horasBaseMensuales]   base de contrato; sin ella se aplica el
 *                                           valor por defecto de utils/nomina.js
 * @property {boolean} [enPapelera]          lo añade plantillaDelPeriodo(), no la base
 */

// ---------------------------------------------------------------------- obras

/**
 * Una habitación o unidad de trabajo dentro de una obra.
 * @typedef {Object} Tarea
 * @property {string} id
 * @property {string} nombre                 "P1 - Hab 101"
 * @property {number} [numeroHabitacion]
 * @property {boolean} completada
 */

/**
 * Proyecto u hotel. Vive en `obras/{id}`.
 * @typedef {Object} Obra
 * @property {string} [id]
 * @property {string} nombre
 * @property {Tarea[]} [tareas]
 * @property {boolean} [papelera]
 */

// --------------------------------------------------------------------- partes

/**
 * Material consumido en un parte.
 * @typedef {Object} MaterialUsado
 * @property {string} [id]                   id en inventario/
 * @property {string} nombre
 * @property {number|string} cantidad
 * @property {number} [precio]
 */

/**
 * Una intervención concreta dentro del parte.
 * @typedef {Object} TareaRealizada
 * @property {string} ubicacion
 * @property {string} descripcion
 */

/**
 * Parte de trabajo. Vive en `partes_de_trabajo/{id}`.
 *
 * El campo `firma` tiene TRES formas posibles y las tres conviven:
 *   - ruta de Storage ("firmas/firma_xxx.png"), lo normal desde el Bloque 3
 *   - base64 ("data:image/png;base64,..."), cuando se envió sin cobertura y la Cloud
 *     Function aún no la ha movido
 *   - URL completa, en documentos anteriores a la migración
 * utils/firmas.js las resuelve las tres.
 *
 * @typedef {Object} Parte
 * @property {string} [id]
 * @property {string} obra                       nombre de la obra al emitirlo
 * @property {string|null} [obraId]              null si se escribió a mano
 * @property {string|null} [trabajadorId]
 * @property {TareaRealizada[]} [tareasRealizadas]
 * @property {string} [trabajo]                  texto libre
 * @property {MaterialUsado[]} [materialesUsados]
 * @property {string|null} [firma]
 * @property {string} creador                    email de quien lo envió
 * @property {string} [nombreTrabajador]         nombre al emitirlo: registro histórico
 * @property {string} [fecha]                    SOLO para mostrar; el formato depende
 *                                               del navegador del operario
 * @property {string} [hora]
 * @property {number} timestamp                  ms. Lo único válido para comparar
 * @property {'pendiente'|'aprobado'|'rechazado'} estado
 * @property {string} [fechaValidacion]
 * @property {boolean} [certificado]
 * @property {string|null} [idCertificacion]
 * @property {boolean} [facturado]
 * @property {boolean} [papelera]
 * @property {OperarioCuadrilla[]} [cuadrilla]   NO está en el documento: lo fusiona
 *                                               hidratarPartes() desde validaciones/
 * @property {number} [horasExtraAsignadas]      ídem
 */

// ---------------------------------------------------------------- validaciones

/**
 * Un operario dentro de la cuadrilla de un parte.
 * @typedef {Object} OperarioCuadrilla
 * @property {string|null} trabajadorId
 * @property {string} nombre
 * @property {number|string} horasExtra      cadena vacía mientras se teclea en el input
 */

/**
 * Lo que la oficina asigna al validar. Vive en `validaciones/{parteId}`, fuera del
 * parte, para que su autor no vea las horas de sus compañeros.
 * @typedef {Object} Validacion
 * @property {string} [id]                   mismo id que el parte
 * @property {OperarioCuadrilla[]} cuadrilla
 * @property {number} horasExtraAsignadas
 * @property {number} timestamp              copiado del parte
 * @property {string|null} [obra]
 * @property {string|null} [obraId]
 * @property {string} [fechaValidacion]
 */

// -------------------------------------------------------------------- nóminas

/**
 * Una línea de liquidación. Vive en `nominas/{cierreId}/lineas/{trabajadorId}`.
 * Es un snapshot congelado: los nombres y las bases son los del momento del cierre.
 * @typedef {Object} LineaNomina
 * @property {string} [id]
 * @property {string} trabajadorId
 * @property {string} nombre
 * @property {string} [email]
 * @property {number} baseMensual
 * @property {'ficha'|'defecto'} origenBase
 * @property {number} diasAusencia
 * @property {number} horasNormalesCalculadas
 * @property {number} horasNormales
 * @property {boolean} ajusteManualNormales
 * @property {number} horasExtraDeAlbaranes
 * @property {number} horasExtra
 * @property {boolean} ajusteManualExtras
 * @property {number} tarifaNormal
 * @property {number} tarifaExtra
 * @property {boolean} [tarifaPersonalizada]
 * @property {number} total
 * @property {boolean} [enPapelera]
 */

/**
 * Cabecera de una liquidación cerrada. Vive en `nominas/{periodo}-v{version}`.
 * Se crea una vez y no se modifica nunca: corregir emite la versión siguiente.
 * @typedef {Object} CierreNomina
 * @property {string} [id]                   "2026-08-v2"
 * @property {string} periodo                "2026-08", siempre un mes natural
 * @property {number} version
 * @property {number} rangoInicio            ms, hora local
 * @property {number} rangoFin
 * @property {'cerrado'} estado
 * @property {string} cerradoPor             uid
 * @property {string} [cerradoPorEmail]
 * @property {*} [cerradoEn]                 Timestamp del servidor
 * @property {number} [tarifaNormalGlobal]
 * @property {number} [tarifaExtraGlobal]
 * @property {{trabajadores: number, horasNormales: number, horasExtra: number, importe: number}} [totales]
 * @property {{albaranesComputados: number}} [cobertura]
 * @property {boolean} [cerradoRetroactivamente]
 * @property {string|null} [sustituyeA]      id del cierre al que reemplaza
 * @property {number} [esquema]
 */

// ------------------------------------------------------------------ inventario

/**
 * Material de almacén. Vive en `inventario/{id}`.
 * @typedef {Object} Material
 * @property {string} [id]
 * @property {string} nombre
 * @property {number} stock
 */

/**
 * Fila del resumen de horas extra que devuelve utils/horasPeriodo.js.
 * La clave es el trabajadorId cuando existe y el nombre cuando no.
 * @typedef {[string, {trabajadorId: string|null, nombre: string, horasExtra: number}]} FilaHorasExtra
 */

// ----------------------------------------------------------------- planificación

/**
 * Grupo estable de operarios. Vive en `cuadrillas/{id}`.
 *
 * No confundir con el array `cuadrilla` que la oficina arma al validar un parte: aquel
 * se compone DESPUÉS del trabajo y lleva horas extra; esto se compone ANTES y no sabe
 * nada de horas.
 *
 * `operarioEmails` duplica en plano los correos de `operarios`. Es redundante a
 * propósito: las reglas de Firestore no saben proyectar un campo dentro de un array de
 * objetos, y de este array cuelga quién puede LEER las asignaciones de la cuadrilla —
 * las reglas de `cuadrantes` lo resuelven en vivo con un get() por ruta. Lo deriva
 * `actualizarOperariosCuadrilla`, que es el único camino por el que pasan altas y bajas.
 *
 * @typedef {Object} Cuadrilla
 * @property {string} [id]
 * @property {string} nombre
 * @property {Array<{trabajadorId: string|null, nombre: string, email: string}>} operarios
 * @property {string[]} [operarioEmails] plano, para las reglas; ausente en las anteriores
 *                                       a la referencia viva hasta que se editan
 * @property {boolean} [papelera]
 */

/**
 * Furgoneta o vehículo de empresa. Vive en `vehiculos/{id}`.
 * @typedef {Object} Vehiculo
 * @property {string} [id]
 * @property {string} nombre
 * @property {string} [matricula]
 * @property {boolean} [papelera]
 */

/**
 * Una asignación del cuadrante: una cuadrilla, en una franja, con un destino.
 * Vive en `cuadrantes/{id}`. UN DOCUMENTO POR ASIGNACIÓN, no uno por día.
 *
 * NO LLEVA `operarioEmails`. Quién puede leerla lo decide la CUADRILLA VIVA, que las
 * reglas resuelven con get() sobre `cuadrillas/{cuadrillaId}`. La copia que había aquí
 * se escribía al planificar y no se enteraba de las altas ni de las bajas posteriores:
 * un integrante nuevo no veía el trabajo y uno dado de baja seguía viéndolo.
 *
 * `operarios` se queda como ETIQUETA —quién estaba previsto ese día— y no gobierna
 * ningún permiso.
 *
 * @typedef {Object} Cuadrante
 * @property {string} [id]
 * @property {string} fecha `YYYY-MM-DD`
 * @property {string} horaInicio `HH:MM`, libre (D6)
 * @property {string} horaFin `HH:MM`
 * @property {string} cuadrillaId
 * @property {string} cuadrillaNombre denormalizado
 * @property {Array<{trabajadorId: string|null, nombre: string, email: string}>} operarios
 *                                       etiqueta informativa, no gobierna permisos
 * @property {string|null} vehiculoId
 * @property {string|null} vehiculoNombre denormalizado
 * @property {'obra'|'taller'} destinoTipo
 * @property {string|null} obraId null si el destino es el taller
 * @property {string|null} obraNombre denormalizado
 * @property {'planificado'|'parte_enviado'} estado
 * @property {string|null} parteId se rellena cuando el operario envía su parte
 * @property {string} creadoPor
 * @property {number} creadoEn
 */

// ------------------------------------------------------------- unidades de obra

/**
 * Una unidad de obra ejecutable y certificable. Vive en `unidades_obra/{id}`.
 *
 * NO CONFUNDIR con `Tarea`, que es el array `obras.tareas[]` de siempre. Aquella es
 * una casilla de progreso dentro del documento de la obra; esta es un documento propio,
 * con rastro de quién la propuso y quién la confirmó, y es la que podrá facturarse.
 * Los dos conviven a propósito (D2): el array viejo no se migra por ahora.
 *
 * @typedef {Object} UnidadObra
 * @property {string} [id]
 * @property {string|null} obraId
 * @property {string|null} obraNombre denormalizado
 * @property {string} nombre "Unidad 101", o el texto tal cual si no lleva número
 * @property {number|null} numero
 * @property {number} orden para ordenar sin parsear el nombre
 * @property {string} descripcion lo que se hizo
 * @property {string} textoOriginal lo que tecleó el operario, sin interpretar
 * @property {string} parteId de qué parte salió
 * @property {'propuesta'|'confirmada'} estado
 * @property {string} propuestaPor correo del operario
 * @property {number} propuestaEn
 * @property {string|null} confirmadaPor correo del admin
 * @property {number|null} confirmadaEn
 */

// -------------------------------------------------------------------- acopios

/**
 * Material concreto reservado para una obra concreta. Vive en `acopios/{id}`.
 *
 * NO ES INVENTARIO. `inventario/` sigue siendo el stock general y su descuento al
 * aprobar un parte no se toca (D4): son dos sistemas paralelos. Un acopio no resta
 * stock, dice dónde está una pieza en su camino hacia la furgoneta.
 *
 * @typedef {Object} Acopio
 * @property {string} [id]
 * @property {string} obraId
 * @property {string|null} obraNombre denormalizado
 * @property {string|null} materialId del catálogo; null si es una pieza a medida
 * @property {string} materialNombre COPIA CONGELADA, no referencia: el catálogo se
 *   identifica por nombre y renombrarlo no debe romper el acopio
 * @property {string} descripcion
 * @property {number} cantidad admite decimales: metros lineales, m²
 * @property {'ud'|'ml'|'m2'|'kg'} unidad propia; el catálogo no la tiene
 * @property {boolean} requiereFabricacion si es false se salta «fabricado» (A2)
 * @property {'pendiente'|'fabricado'|'recepcionado'|'listo'} estado
 * @property {Array<{estado: string, en: number, por: string}>} historial
 * @property {number} actualizadoEn
 * @property {string} actualizadoPor quién movió el último estado
 * @property {number} creadoEn
 * @property {string} creadoPor siempre oficina (A1)
 */

export {};