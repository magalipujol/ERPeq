---
name: ERPeq
description: Stock, pedidos y ventas de una dietética, en el celular, con frascos a granel como lenguaje visual.
colors:
  kraft: "#8a6a3b"
  kraft-deep: "#765a31"
  kraft-label: "#e8d5ae"
  kraft-soft: "#f3e8d2"
  paper: "#fbf8f1"
  card: "#ffffff"
  kraft-border: "#e3dccb"
  ink: "#1e2420"
  ink-dimmed: "#555b52"
  ink-placeholder: "#6b7066"
  alert-red: "#b42323"
  alert-red-text: "#8f1d1d"
  ok-green-text: "#1d5628"
  warn-yellow: "#a35f00"
  warn-yellow-text: "#7a4700"
  tapa-tostado: "#8a5a2b"
  tapa-verde: "#1f7a55"
  tapa-naranja: "#a8530a"
  tapa-violeta: "#6b4ba8"
  tapa-azul: "#2f5da8"
  tapa-bordo: "#a8324a"
  tapa-hoja: "#3d6b1f"
  tapa-petroleo: "#0f6e7a"
  tapa-ciruela: "#7a4a6b"
  tapa-oliva: "#5e6420"
  chart-1: "#1f7a55"
  chart-2: "#b98f4a"
  chart-3: "#2f5da8"
typography:
  display:
    fontFamily: "\"Atkinson Hyperlegible Next\", Verdana, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.15
    fontFeature: "tnum"
  headline:
    fontFamily: "\"Atkinson Hyperlegible Next\", Verdana, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    fontFeature: "tnum"
  title:
    fontFamily: "\"Atkinson Hyperlegible Next\", Verdana, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "\"Atkinson Hyperlegible Next\", Verdana, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  body-strong:
    fontFamily: "\"Atkinson Hyperlegible Next\", Verdana, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
  label:
    fontFamily: "\"Atkinson Hyperlegible Next\", Verdana, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "10px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  button-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
  button-filled:
    backgroundColor: "{colors.kraft-label}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
  accion-principal:
    backgroundColor: "{colors.kraft}"
    textColor: "{colors.card}"
    rounded: "{rounded.full}"
    size: "46px"
  input-buscar:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "52px"
  tarjeta:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  frasco:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 12px 12px"
  tapa:
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "40px"
  tapa-chica:
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "36px"
  barra-inferior-activa:
    backgroundColor: "{colors.kraft-soft}"
    textColor: "{colors.ink}"
    height: "68px"
  barra-inferior:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-dimmed}"
    height: "68px"
---

# Design System: ERPeq

## Overview

**Creative North Star: "Frascos a granel"**

Cada producto se reconoce por su tapa, un color fijo y dos letras, antes de leer el nombre, como los frascos de una dietética con su etiqueta de papel kraft. La pantalla es papel claro con tarjetas blancas de borde kraft; el color fuerte está en las tapas y en la acción principal, y en ningún otro lado. La tinta es casi negra y siempre va sobre fondo claro.

La densidad es la de una herramienta de una sola mano: toques de 44 px como mínimo, letra base de 18 px, cifras grandes y tabulares. Las reglas de legibilidad (fuente, tamaños, contraste, sin mayúsculas sostenidas ni itálicas, cifras que no se parten) están en [`spec/legibilidad.md`](spec/legibilidad.md) y este documento no las repite: las da por obligatorias.

El mundo está completo en el shell (header, barra inferior del celular) y en Stock del celular. Las demás pantallas heredan el tema de Mantine, la fuente y la paleta, pero todavía no usan la tapa ni la grilla de frascos: llevarlas es trabajo pendiente, y al hacerlo se siguen las reglas de este documento.

**Key Characteristics:**
- Papel claro, tarjetas blancas, borde kraft de 2 px en los frascos y de 1 px en lo demás.
- Diez tonos de tapa fijos por producto (el tono sale del ID, no del nombre).
- Polaridad positiva: tinta sobre claro en todo, incluidos los botones "filled".
- Atkinson Hyperlegible Next en 400 y 700, con cifras tabulares.
- Plano: profundidad por borde y tono, sin sombras.

## Colors

Papel y kraft de etiqueta para todo lo neutro y lo activo; color saturado solo en las tapas.

### Primary
- **Kraft de etiqueta** (kraft): lo activo y la acción principal. Fondo del círculo «+» de la barra inferior y color de los vínculos (nombres de producto que abren su ficha). Es el tono 6 de la escala `kraft` de `src/tema.ts`, que es el `primaryColor` del tema.
- **Kraft tostado** (kraft-deep): el anillo de foco de 3 px y la raya de 3 px arriba de la pestaña activa de la barra inferior.
- **Papel de etiqueta** (kraft-label): fondo de los botones y filtros `filled` (por ejemplo, el filtro elegido de Stock), con borde kraft y texto en tinta.
- **Kraft claro** (kraft-soft): fondo de la pestaña activa, de los encabezados de grupo de las tablas, de la fila resaltada y de las provincias del mapa (`--erp-soft`).

### Secondary: las tapas
- **Diez tonos de tapa** (tapa-tostado, tapa-verde, tapa-naranja, tapa-violeta, tapa-azul, tapa-bordo, tapa-hoja, tapa-petroleo, tapa-ciruela, tapa-oliva): uno por producto, elegido por un hash del ID en `tonoTapa` (`src/componentes/tapa.ts`). Son oscuros y de matiz distinto entre sí para que dos productos vecinos no se confundan. Van como banda de color arriba del frasco o como aro de 4 px alrededor de la tapa suelta; nunca como color de texto.

### Tertiary: estados
- **Rojo alerta** (alert-red) y **rojo texto** (alert-red-text): stock negativo o bajo el mínimo; el borde del frasco en alerta y las cifras negativas.
- **Amarillo** (warn-yellow, warn-yellow-text): "Atención" y "Faltan … para pedidos".
- **Verde texto** (ok-green-text): mensajes de guardado y estado OK.
Son los tonos 8 y 9 de Mantine oscurecidos en `src/tema.ts` para llegar a 4,5:1; las etiquetas de estado usan la variante `light` (fondo tenue del color, texto en el tono 9).

### Neutral
- **Papel** (paper): fondo de la página (`--erp-bg`).
- **Tarjeta** (card): fondo de tarjetas, frascos, campos y barras (`--mantine-color-body`).
- **Borde kraft** (kraft-border): borde de tarjetas, campos y frascos (`--erp-borde`).
- **Tinta** (ink): todo el texto, incluidas las letras de las tapas y el texto de los botones de color.
- **Tinta tenue** (ink-dimmed): etiquetas, unidades, pestañas inactivas y el borde punteado del frasco vacío.
- **Tinta de ayuda** (ink-placeholder): placeholders.
- **Gráficos** (chart-1, chart-2, chart-3): series de los gráficos de Stock, Ventas y Análisis (`--c1` a `--c3`).

### Named Rules
**The Tapa Rule.** El color saturado identifica productos, nada más. Un tono de tapa no marca estado, ni pantalla, ni categoría, y un producto conserva su tono en todas las pantallas.

**The Positive Polarity Rule.** Texto oscuro sobre fondo claro, también en los botones `filled` y sobre las bandas de color (el círculo de la tapa va claro con letras en tinta). La única pieza clara sobre oscuro es el «+» blanco del círculo kraft de la acción principal, que es un ícono.

## Typography

**Display Font:** Atkinson Hyperlegible Next (con Verdana, system-ui, sans-serif)
**Body Font:** la misma, en todo, títulos incluidos.
**Label/Mono Font:** ui-monospace solo para texto técnico (código, errores).

**Character:** una sola familia, clara y angosta, con cero con barra y letras que no se confunden; la jerarquía sale del tamaño y de la negrita, nunca de otra familia.

### Hierarchy
- **Display** (700, 30 px, 1,15, tabulares): el total de cada frasco, seguido de la unidad en tinta tenue y tamaño de cuerpo.
- **Headline** (700, 1,5 rem, 1,3, tabulares): el valor de los KPI.
- **Title** (700, 1,1875 rem, 1,4): encabezado de cada sección ("Stock total", "Stock por depósito"). El nombre de la app usa h3 (1,3125 rem).
- **Body** (400, 1,125 rem, 1,55): texto base de 18 px.
- **Body strong** (700, 1,125 rem, 1,25): nombre del producto en el frasco y letras de la tapa (16 px, 15 px en la chica).
- **Label** (400, 0,875 rem, 1,5): etiquetas de KPI y de `Resumen`, palabras de la barra inferior (700 en la activa).

### Named Rules
**The Two Weights Rule.** Solo hay archivos de 400 y 700: un 500 se ve como 400 y un 600 como 700. El énfasis es negrita (700), nunca itálica.

## Layout

Celular primero: el corte es el breakpoint `sm` de Mantine (48em); por debajo rigen los ajustes de `src/celular.css`.

- **Shell del celular:** header de 68 px (nombre, estado de sincronización y botones de 44 px en una sola fila) y barra inferior fija de 68 px con cinco lugares: Inicio, Stock, la acción principal «Nuevo» en el centro, Pedidos y «Más» (menú con el resto de las pantallas, ítems de 44 px). El título de cada pantalla queda solo para lectores de pantalla: la barra ya marca dónde estás. En escritorio la barra inferior desaparece y las pantallas se eligen con un control segmentado en el header.
- **Stock en el celular:** buscador de 52 px arriba, una fila de tres filtros de 44 px (Todos, Faltan, Bajo el mínimo), y la grilla de frascos en dos columnas con 12 px entre ellas, siempre ordenada por nombre para que cada frasco quede en su lugar. Debajo, Stock por depósito en tarjetas; el resumen de KPI pasa al final.
- **Secciones planas:** en el celular las secciones pierden la tarjeta y usan todo el ancho; en escritorio son tarjetas con 16 px de relleno.
- **Ritmo:** la escala de Mantine (10, 12, 16, 20, 32 px); `md` entre bloques, `xs` y `sm` dentro de las tarjetas.

**The Thumb Rule.** Todo lo que se toca mide 44 px o más en el celular (campos, botones, filtros, ítems de menú), y la acción más frecuente está en el centro de la barra inferior, en todas las pantallas.

## Elevation & Depth

Plano. La profundidad la dan el borde kraft y el contraste entre el papel de la página y el blanco de las tarjetas. Las únicas `box-shadow` del sistema no son sombras: un anillo de 4 px del color de la tarjeta alrededor del círculo «+» (lo separa de la barra que sobresale) y una raya interna de 3 px kraft tostado arriba de la pestaña activa.

**The Flat Shelf Rule.** Las tarjetas y los frascos no proyectan sombra; un estado se marca con borde (rojo, punteado) o con fondo kraft claro.

## Shapes

- Esquinas de 8 px (`md`, el radio por defecto del tema) en tarjetas, campos, botones y filtros.
- Esquinas de 16 px (`lg`) en los frascos, que se recortan (`overflow: hidden`) para que la banda de color siga la curva.
- Círculos perfectos para las tapas y para la acción principal.
- Bordes: 1 px kraft en tarjetas y campos; 2 px en los frascos; 4 px de tono en la tapa suelta. El frasco vacío lleva el borde punteado en tinta tenue: es el frasco sin nada adentro.

## Components

### Buttons
- **Shape:** esquinas de 8 px; 44 px de alto en el celular.
- **Default:** fondo blanco, borde kraft, texto en tinta.
- **Filled:** fondo papel de etiqueta, borde kraft (tono 6 del color), texto en tinta; al pasar el mouse, un tono más (3). Vale para cualquier color del tema (`variantes` en `src/tema.ts`).
- **Focus:** anillo de 3 px kraft tostado separado 2 px.

### Chips (filtros)
- **Style:** son botones de 44 px en una fila, con `aria-pressed`. El elegido es `filled` (papel de etiqueta con borde kraft); los demás, `default`.

### Cards / Containers
- **Tarjeta:** fondo blanco, borde kraft de 1 px, esquinas de 8 px, relleno de 16 px (12 px en las tarjetas de producto del celular). Sin sombra.

### Inputs / Fields
- **Style:** fondo blanco, borde kraft, esquinas de 8 px, 44 px de alto (52 px el buscador de Stock); letra de 16 px en el celular.
- **Focus:** el mismo anillo kraft tostado.

### Navigation
- **Barra inferior:** ícono de 22 px (trazo 1,6; 2,2 en la activa) y la palabra debajo en 0,875 rem. Inactiva en tinta tenue; activa en tinta y negrita, con fondo kraft claro y la raya kraft tostado arriba. En el centro, la acción principal: círculo kraft de 46 px que sobresale 24 px de la barra, con «+» blanco y la palabra en negrita.

### Tapa (signature)
Un círculo con dos letras ("Al" para Almendras, "Me" para Mix europeo; `letrasTapa`) que identifica al producto. Es decorativa (`aria-hidden`): el nombre siempre va al lado. Dos formas:
- **Suelta** (en tarjetas y listas): 40 px (36 px la chica), aro de 4 px del tono del producto y relleno del tono al 14 % sobre blanco, letras en tinta.
- **Sobre la banda del frasco:** círculo blanco al 92 % sobre la banda de color.

### Frasco (signature)
Un producto en la grilla de Stock del celular. Arriba, la banda del tono de su tapa con la tapa chica; abajo, el nombre (vínculo a su ficha), el total en display con la unidad, y como mucho una cosa que pide atención: la etiqueta de estado, "Faltan … para pedidos" en amarillo, o lo que viene en camino. Borde kraft de 2 px; rojo si está en alerta; punteado si el total es cero. Tocarlo abre la ficha del producto con el detalle por depósito.

## Do's and Don'ts

### Do:
- **Do** poner la tapa del producto (`Tapa`, con su tono de `tonoTapa`) en cada lugar donde aparece un producto como ítem de una lista, con el nombre al lado.
- **Do** escribir las cifras en negrita y tabulares, con la unidad al lado en tinta tenue.
- **Do** marcar lo elegido con papel de etiqueta y borde kraft, con el texto en tinta.
- **Do** marcar estados con borde (rojo, punteado) y con etiquetas `light` en tipo oración ("Sin stock").
- **Do** cumplir [`spec/legibilidad.md`](spec/legibilidad.md) en cada pantalla nueva.

### Don't:
- **Don't** usar un tono de tapa para otra cosa que identificar un producto, ni inventar tonos fuera de los diez.
- **Don't** poner texto blanco sobre un fondo de color: botones `filled`, bandas y etiquetas llevan texto en tinta.
- **Don't** agregar sombras a tarjetas o frascos.
- **Don't** usar pesos 500 o 600 esperando que se vean distintos de 400 y 700.
- **Don't** poner el resumen de KPI arriba de los frascos en Stock del celular: primero lo que hay, el resumen al final.
