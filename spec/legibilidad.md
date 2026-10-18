# Legibilidad

Al menos una persona que usa la app tiene dislexia. La interfaz sigue la guía de estilo de la British Dyslexia
Association (BDA) y las pautas de contraste de WCAG. Los valores están en `src/tema.ts` (tipografía y tamaños) y
`src/estilos.css` (colores, espaciado, etiquetas); las pantallas no tienen que repetirlos.

## Reglas

| Pauta | Cómo se aplica |
|---|---|
| Sans serif clara, con letras que no se confunden (I/l/1, O/0, b/d) | OpenDyslexic en todo, títulos incluidos: letras con la base más pesada, para que no se den vuelta (b/d, p/q). Se sirve desde el propio sitio (`src/fuentes/`, declarada en `src/estilos.css`) en pesos 400 y 700; si no carga, Verdana. Es la versión 0.990 del repositorio del proyecto: la 0.910 que publica npm dibuja mal la tilde de la «ó» en regular. El texto monoespaciado usa la fuente del sistema. |
| Texto base de 16 a 19 px | Texto normal 17 px, `sm` 15 px, `xs` 14 px y etiquetas de estado 13 px. |
| Interlineado de 1,5 | 1,5 en textos chicos y 1,55 en el resto; títulos 1,3 a 1,4. |
| Espaciado entre letras y palabras | El de OpenDyslexic, que ya es amplio; no se agrega espaciado extra. |
| Sin mayúsculas sostenidas | Encabezados de tabla y etiquetas de estado (Badge) en mayúscula inicial. |
| Sin itálicas ni subrayados para énfasis | El énfasis va en negrita; `em`/`i` se muestran en negrita. |
| Sin texto justificado | Todo alineado a la izquierda; los números, a la derecha. |
| Polaridad positiva: texto oscuro sobre fondo claro | Siempre en esquema claro, aunque el dispositivo esté en modo oscuro (`forceColorScheme` en `src/main.tsx`). Botones y etiquetas `filled` con fondo claro del color (tono 2), borde del tono 6 y el texto normal, en lugar de texto blanco sobre color (`variantColorResolver` en `src/tema.ts`); lo mismo los globitos del mapa. |
| Contraste alto sin blanco puro sobre negro puro | Fondo crema (`#f6f3ec`, tarjetas `#fffdf8`) y texto `#1f241c`. Texto secundario `#545a50` (contraste mayor a 6:1). Los textos de color (`c="red"`, etiquetas `light`) usan el tono 9; los tonos 8 y 9 de rojo, verde, amarillo y naranja están oscurecidos en `src/tema.ts` para pasar 4,5:1 sobre el fondo. |
| Cifras fáciles de comparar | Números tabulares en las tablas y en los KPI; columnas numéricas alineadas a la derecha. |

## Al escribir pantallas

- Textos de ayuda de una sola idea y una línea cuando se pueda. Ejemplo: en *Ajuste de stock*, "Para corregir
  diferencias. Para restar, usá un número negativo."
- No usar `tt="uppercase"`, `fs="italic"` ni `ta="justify"`.
- OpenDyslexic es ancha: revisar cada pantalla en un celular de 360 a 412 px. Las tablas van dentro de un
  `ScrollArea`, y un `SegmentedControl` con varias opciones pasa a vertical (*Estado* en *Nuevo flete*) o a tamaño
  `xs` (*Período* en Análisis) en celular. La barra inferior tiene cuatro pantallas y un menú *Más* con el resto.
- Texto secundario (`c="dimmed"`) solo para datos de apoyo (fecha, depósito, unidad); el dato principal de cada fila va
  con el color normal.
