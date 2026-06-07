# Handoff: Rediseño iOS nativo — App "Tareas"

## Overview
Rediseño de la interfaz principal de la PWA de productividad **"Tareas"** (https://productivity-pwa.vercel.app/) para que se sienta 100% como una app **nativa de iOS**, siguiendo las Apple Human Interface Guidelines.

Este bundle cubre el **núcleo** de la app: la **lista de tareas**, la **creación de tareas** (bottom sheet), el **detalle de tarea**, la **navegación inferior** (tab bar) y el **sistema de apariencia** (claro/oscuro + color de acento).

Las demás secciones de la app (Inicio/dashboard, Hábitos, Objetivos, Estadísticas, Calendario, Ideas, Finanzas) **NO están diseñadas todavía** — pero este documento define el **sistema de diseño completo** (tokens, componentes, patrones) para que se apliquen de forma consistente al recrearlas.

## About the Design Files
El archivo `Tareas iOS.html` de este bundle es una **referencia de diseño creada en HTML/CSS/JS puro** — un prototipo que muestra el aspecto y el comportamiento deseados, **no código de producción para copiar tal cual**.

La tarea es **recrear este diseño en el entorno existente de la PWA**, usando su framework y patrones actuales (React, Vue, Svelte, vanilla JS, etc.). Si conviene, los tokens de color y los componentes CSS se pueden portar casi directamente (están en CSS plano y variables `--*`), pero la estructura debe integrarse al stack real del proyecto, no pegarse como un HTML aislado.

> **Para Claude Code:** primero inspecciona el repositorio real de la PWA para detectar el framework, el sistema de estilos (CSS modules, Tailwind, styled-components…) y cómo está organizado el estado de las tareas. Luego recrea estas pantallas con esos patrones. El HTML adjunto es la fuente de verdad **visual y de interacción**.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado, radios, sombras e interacciones son finales y deben reproducirse con precisión. Todos los valores exactos están abajo en *Design Tokens*.

---

## Design Tokens

Todo el sistema vive en variables CSS sobre el elemento `.device` (ver `Tareas iOS.html`). Pórtalas a tu `:root` / theme provider. Hay dos temas: **dark** (por defecto) y **light**.

### Colores — DARK (por defecto)
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#000000` | Fondo de pantalla (OLED true black) |
| `--bg-elev` / `--cell` | `#1c1c1e` | Fondo de celdas y sheets |
| `--cell-press` | `#2c2c2e` | Celda presionada |
| `--label` | `#ffffff` | Texto primario |
| `--label-2` | `rgba(235,235,245,.6)` | Texto secundario |
| `--label-3` | `rgba(235,235,245,.3)` | Texto terciario / placeholders |
| `--separator` | `rgba(84,84,88,.55)` | Líneas divisorias |
| `--fill` | `rgba(118,118,128,.24)` | Fills (search, toggles off) |
| `--fill-2` | `rgba(118,118,128,.16)` | Fill del segmented control |
| `--material` | `rgba(28,28,30,.72)` | Material translúcido nav bar |
| `--material-tab` | `rgba(20,20,22,.78)` | Material translúcido tab bar |

### Colores — LIGHT
| Token | Valor |
|---|---|
| `--bg` | `#f2f2f7` |
| `--bg-elev` / `--cell` | `#ffffff` |
| `--cell-press` | `#e5e5ea` |
| `--label` | `#000000` |
| `--label-2` | `rgba(60,60,67,.6)` |
| `--label-3` | `rgba(60,60,67,.3)` |
| `--separator` | `rgba(60,60,67,.29)` |
| `--fill` | `rgba(118,118,128,.12)` |
| `--fill-2` | `rgba(118,118,128,.08)` |
| `--material` | `rgba(249,249,251,.78)` |
| `--material-tab` | `rgba(248,248,250,.82)` |

### Colores de sistema (semánticos, varían por tema dark/light)
| Token | Dark | Light |
|---|---|---|
| `--red` (prioridad Alta) | `#FF453A` | `#FF3B30` |
| `--green` (prioridad Baja, completar) | `#30D158` | `#34C759` |
| `--orange` (prioridad Media) | `#FF9F0A` | `#FF9500` |
| `--yellow` | `#FFD60A` | `#FFCC00` |

### Color de acento (seleccionable por el usuario)
| Nombre | Light | Dark |
|---|---|---|
| Blue (default) | `#007AFF` | `#0A84FF` |
| Indigo | `#5856D6` | `#5E5CE6` |
| Green | `#34C759` | `#30D158` |
| Orange | `#FF9500` | `#FF9F0A` |
| Pink | `#FF2D55` | `#FF375F` |

### Colores de categoría (constantes en ambos temas)
| Categoría | Color | Ícono (concepto) |
|---|---|---|
| Sin categoría | `#8E8E93` | etiqueta |
| Trabajo | `#0A84FF` | maletín |
| Personal | `#BF5AF2` | persona |
| Estudio | `#FF9F0A` | libro |
| Salud | `#FF453A` | corazón |
| Otro | `#5E5CE6` | círculo |

### Tipografía
- **Familia:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", system-ui, sans-serif` (San Francisco en dispositivos Apple).
- **Escala:**
  | Rol | Tamaño | Peso | Letter-spacing |
  |---|---|---|---|
  | Large Title | 34px | 700 | .37px |
  | Section header (h2) | 20px | 700 | .35px |
  | Body / título de fila | 17px | 400 | -.2px |
  | Botones / nav items | 17px | 400–600 | — |
  | Meta / subtítulo | 13px | 400 | — |
  | Segmented control | 13px | 500–600 | — |
  | Tab bar label | 10px | 500 | .1px |
  | Sheet field (título input) | 22px | 600 | -.3px |
  | Detail title | 24px | 700 | -.4px |

### Espaciado, radios y sombras
- **Radios:** celdas/listas `12px`, sheets `14px` (solo esquinas superiores), botones primarios `13px`, search/segmented `9–10px`, chips/pills `20px` (pill).
- **Padding de fila de tarea:** `11px 16px`. **Altura mínima de fila de sheet:** `48px`.
- **Inset de listas:** margen lateral `16px`.
- **Área táctil mínima:** `44×44px` (todos los `.icon-btn`).
- **Separador:** línea de `0.5px` con `--separator`, indentada `52px` a la izquierda (alineada tras el ícono).
- **Sombra de sheet:** `0 -8px 40px rgba(0,0,0,.4)`.
- **Material translúcido:** `backdrop-filter: saturate(180%) blur(22px)`.

### Easing
- Curva iOS estándar: `cubic-bezier(.32, .72, 0, 1)` — úsala en sheets, segmented thumb y swipe.

---

## Screens / Views

### 1. Lista de Tareas (pantalla principal)
**Propósito:** ver y gestionar todas las tareas, filtradas por bucket temporal.

**Layout (de arriba a abajo):**
1. **Status bar** (54px): hora 9:41, íconos de señal/wifi/batería. Dynamic Island centrada arriba.
2. **Nav bar translúcida** (sticky, material blur):
   - Fila superior (44px): a la derecha, botón **apariencia** (◐, abre sheet de apariencia) + botón **+** (abre sheet de nueva tarea). Ambos 44×44px, color = acento.
   - **Large Title** "Tareas" (34px/700). Al hacer scroll >10px, aparece un título compacto centrado de 17px y un borde inferior de 0.5px (efecto de colapso iOS).
   - **Search field**: pill `--fill`, alto 36px, ícono lupa + placeholder "Buscar".
   - **Segmented control**: Todas / Hoy / Próximas / Vencidas. Thumb blanco (dark: `#636366`) que se desliza con animación; texto activo en peso 600, inactivo en `--label-2`/500.
3. **Contenido scrolleable** (lista agrupada inset):
   - **Section header**: título (20px/700) + contador a la derecha (`--label-3`).
   - **Filas de tarea** agrupadas por bucket: orden **Vencidas → Hoy → Próximas**, y **Completadas** al final (en filtros "Todas" y "Hoy").
4. **Tab bar translúcida** (83px, fija abajo): Inicio · Tareas · Hábitos · Objetivos · Más. Ítem activo en color de acento.

**Fila de tarea (`.task-row`):**
- **Checkbox** circular 26px, borde 2px `--label-3`; al completar → relleno de acento + checkmark blanco.
- **Título** (17px). Si está completada: tachado + `--label-3`.
- **Meta** (13px, `--label-2`): `[punto de prioridad 7px] · Categoría · hora · n/m subtareas`. Si es vencida, la hora va en `--red`.
- **Punto de prioridad:** Alta = `--red`, Media = `--orange`, Baja = `--green`.
- **Ícono de categoría** a la derecha: cuadrado 30px, radio 8px, fondo = color de categoría, glifo blanco.

### 2. Bottom Sheet — Nueva Tarea
**Propósito:** crear una tarea. Sube desde abajo sobre un scrim semitransparente (`rgba(0,0,0,.4)`).

**Estructura:**
- **Grabber** (36×5px) arrastrable → arrastrar >110px hacia abajo descarta.
- **Header:** "Cancelar" (izq, acento) · "Nueva tarea" (centro, 17/600) · "Agregar" (der, acento/600, **deshabilitado hasta que haya título**).
- **Body:**
  - Input grande "¿Qué necesitas hacer?" (22px/600) + textarea "Notas" (auto-grow), juntos en una celda.
  - **Prioridad:** 3 botones segmentados Baja/Media/Alta con punto de color; el seleccionado se rellena con `color-mix` 16% del color + borde de ese color. Default **Media**.
  - **Categoría:** chips (pill). Seleccionado = fondo del color de categoría + texto blanco.
  - **Lista de opciones:** Fecha (→ "Hoy"), Recordatorio (toggle iOS), Tarea persistente (toggle iOS). Cada fila con ícono cuadrado de color.
  - **Subtareas:** filas con mini-checkbox 20px; "Agregar subtarea" con borde punteado del acento → al tocar inserta un input inline (Enter agrega otra).
  - **Botón primario** "Agregar tarea" (fondo acento, 17/600, radio 13px), deshabilitado sin título.

### 3. Bottom Sheet — Detalle de Tarea
**Propósito:** ver una tarea y sus subtareas, completarla.
- Header: "Cerrar" · "Detalle" · "Editar".
- **Título** grande (24px/700).
- **Pills** horizontales: "Prioridad {nivel}" (con punto), categoría (fondo `color-mix` 18%), hora.
- **Subtareas** con contador (`n/m`), cada una con mini-checkbox toggleable en vivo.
- **Botón primario** "Completar tarea" / "Marcar como pendiente" (cambia a `--fill` si ya está completada).

### 4. Bottom Sheet — Apariencia
**Propósito:** cambiar tema y acento en vivo.
- **Tema:** 2 cards con preview (Claro / Oscuro), borde de acento en la seleccionada.
- **Acento:** fila de 5 swatches circulares (38px); el seleccionado muestra checkmark + anillo.
- El tema y el acento se aplican a **toda la app** instantáneamente vía variables CSS.

---

## Interactions & Behavior
- **Tap en checkbox:** marca completar/pendiente → re-render + toast "Tarea completada".
- **Tap en fila:** abre el sheet de Detalle.
- **Swipe → (derecha) sobre una fila:** completa la tarea (fondo verde con check). Umbral ~90px.
- **Swipe ← (izquierda):** elimina (fondo rojo "Eliminar"). Umbral ~90px. Debe distinguir gesto horizontal de scroll vertical (lock por eje).
- **Segmented control:** filtra el bucket; el thumb se anima a la posición del botón.
- **Nav bar colapsa** al hacer scroll: aparece título compacto + borde inferior.
- **Sheets:** entran con `translateY(110% → 0)` y easing iOS (~0.42s); el scrim hace fade. Cerrar = tap en scrim, botón cancelar/listo, o arrastrar el grabber.
- **Toggles iOS:** thumb 27px que se desliza 20px; fondo `--fill` → `--green` al activar.
- **Toast:** pill flotante translúcida, sube desde abajo, auto-oculta a ~1.6s.
- **Reduced motion:** respeta `prefers-reduced-motion` si lo añades al portar (las animaciones son decorativas).

## State Management
Estado mínimo por tarea:
```
Task = { id, title, notes?, cat, prio: "alta"|"media"|"baja",
         time, bucket: "hoy"|"proximas"|"vencidas",
         done: bool, subs: [{ t: string, d: bool }] }
```
Estado global de UI: `currentFilter` (segmented), `theme` ("dark"|"light"), `accent` (clave de acento), `openSheet`. Al recrear, conecta `bucket`/`time` a fechas reales y deriva los buckets desde la fecha de vencimiento.

## Interacciones con tab bar
Solo **Tareas** está implementada. Las demás pestañas (Inicio, Hábitos, Objetivos, Más) deben construirse aplicando **estos mismos tokens y patrones** (nav bar translúcida + large title, listas inset, sheets para creación, etc.). La app original ya tiene los datos de Hábitos, Objetivos, Finanzas, Ideas y Estadísticas — reutilízalos bajo este nuevo sistema visual.

## Assets
Todos los íconos son **SVG inline** (stroke 1.7–2.2, estilo SF Symbols). No hay imágenes externas. Recomendado al portar: usar SF Symbols nativos si es app nativa, o un set de íconos line equivalente (p. ej. Lucide) si es web.

## Files
- `Tareas iOS.html` — prototipo hifi completo y autocontenido (HTML/CSS/JS). Contiene el sistema de diseño en variables CSS (busca `.device { ... }` y `.device[data-theme="light"]`), y todos los componentes comentados por sección (`/* NAV BAR */`, `/* TAB BAR */`, `/* SHEETS */`, `/* Task row + swipe */`, etc.).
