# CLAUDE.md — ERP de Gestión de Obras y Nóminas

> Este documento es el contexto de referencia del proyecto. Colócalo como `CLAUDE.md` en la raíz del repositorio para que **Claude Code** lo lea automáticamente en cada sesión, y pégalo al inicio de una conversación nueva cuando necesites ayuda de **Claude** (chat) para gestionar el proyecto, priorizar tareas o interpretar hallazgos de una revisión de código.

---

## 1. Resumen del proyecto

Aplicación web (ERP) para la gestión integral de una empresa de reformas/cristalería. Conecta el trabajo de campo de los operarios con la administración de oficina: partes de trabajo diarios, control de materiales y cálculo automatizado de nóminas mensuales.

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite |
| Backend / BD | Firebase Firestore |
| Despliegue | Vercel |
| Librerías clave | `lucide-react` (iconos), `jspdf` (albaranes/facturas) |

## 3. Flujo de datos (ciclo de vida de un parte)

```
Operario (móvil) → Bandeja de Validación (oficina) → Aprobación → Albarán definitivo → Control de Nóminas (fin de mes)
```

## 4. Módulos y reglas de negocio críticas

### A. Vista de Operario (campo, móvil)
Recaba: obra/cliente, rango de habitaciones intervenidas, material empleado (cantidad + nombre), notas de ejecución, horas reportadas, firma digital trazada en pantalla.
Al guardar → documento en Firestore con estado **"Pendiente de validación"**.

### B. Bandeja de Validación — `BandejaValidacion.jsx`
- Muestra un resumen **inamovible** de lo enviado por el operario (materiales, habitaciones, firma, notas).
- Oficina selecciona de un desplegable qué operarios (cuadrilla) asistieron realmente.
- Permite asignar **horas extra puntuales** a operarios concretos en ese parte.
- ⚠️ **REGLA ESTRICTA**: en este paso **NO** se contabilizan ni suman horas normales. Las horas normales son fijas por contrato y nunca se derivan de un parte individual.
- Permite aprobar (→ albarán definitivo) o eliminar el parte rechazado.

### C. Control de Nóminas — `ControlNominas.jsx`
- **Horas normales**: base mensual fija por empleado (ej. 160h). Se restan automáticamente 8h por cada "Día Libre"/ausencia marcada en rojo.
- **Horas extra**: se extraen automáticamente sumando las registradas en los albaranes validados de ese mes (vienen del Módulo B, no se introducen a mano aquí).
- Filtro por fechas; inputs globales de Tarifa Normal (€/h) y Tarifa Extra (€/h), sobrescribibles por tarjeta individual de empleado.
- Exportación masiva de la liquidación a CSV/Excel.

### D. Panel de Oficina e Histórico — `PanelOficina.jsx`
- ⚠️ **REGLA DE RENDIMIENTO**: las consultas a Firestore deben estar limitadas (ej. últimos 300 partes) para que la carga inicial sea instantánea en caché vacía. No cargar el histórico completo de golpe.

---

## 5. Instrucciones para Claude Code (auditoría del código)

La app está "casi terminada". Al revisarla, verifica en particular que la implementación real respete las reglas de negocio de la sección 4 — son las que más fácilmente se rompen sin darse cuenta. Checklist sugerida:

1. **Horas normales vs. extra**: confirmar que `BandejaValidacion.jsx` no tiene ningún camino de código que sume horas normales por parte; que solo `ControlNominas.jsx` calcula la base mensual − (8h × días libres) + horas extra del mes.
2. **Reglas de seguridad de Firestore**: los operarios no deberían poder editar/aprobar sus propios partes, ni leer nóminas o partes de otros. Revisar `firestore.rules` (o equivalente) explícitamente.
3. **Límite de consultas en `PanelOficina.jsx`**: confirmar paginación o `limit()` real (no solo en la UI, sino en la query), y que no haya un fetch completo oculto en algún `useEffect`.
4. **Inmutabilidad del parte original**: una vez enviado por el operario, sus datos (materiales, notas, firma) no deberían ser editables por oficina; solo la asignación de cuadrilla/horas extra y la aprobación.
5. **Firma digital**: cómo se almacena (¿base64 en Firestore? ¿tamaño del documento?), y si hay algún límite de payload.
6. **Exportaciones (`jspdf`, CSV/Excel)**: caracteres especiales (tildes, ñ), formato numérico de importes, rendimiento con volúmenes grandes.
7. **Comportamiento móvil/offline**: los operarios trabajan en campo, posiblemente con conectividad intermitente — revisar manejo de errores de red al guardar un parte y si hay reintento o guardado local.
8. **Estados y transiciones**: pendiente → aprobado / rechazado — que no existan estados intermedios inconsistentes ni forma de aprobar dos veces el mismo parte.
9. **Separación de vistas**: que la vista de operario y la de oficina no compartan rutas/permisos por error.

Al terminar, entrega hallazgos priorizados (bugs que rompen una regla de negocio primero, luego seguridad, luego rendimiento, luego resto).

## 6. Instrucciones para Claude (chat — gestión del proyecto)

- Usa este documento como contexto persistente: no asumas reglas de negocio distintas a las descritas arriba (la más fácil de confundir: **nunca sumar horas normales por parte**, siempre por base mensual fija).
- Cuando el usuario traiga hallazgos de una sesión de Claude Code, ayuda a priorizarlos y a traducirlos en tareas concretas.
- Si el usuario pide ayuda para redactar reglas de Firestore, lógica de cálculo de nómina, o estructura de componentes, respeta estrictamente la sección 4 como fuente de verdad del negocio.

