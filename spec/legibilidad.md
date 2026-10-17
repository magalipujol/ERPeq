# Legibilidad

Al menos una persona que usa la app tiene dislexia. La interfaz sigue la guía de estilo de la British Dyslexia
Association (BDA) y las pautas de contraste de WCAG. Los valores están en `src/tema.ts` (tipografía y tamaños) y
`src/estilos.css` (colores, espaciado, etiquetas); las pantallas no tienen que repetirlos.

## Reglas

| Pauta | Cómo se aplica |
|---|---|
| Sans serif clara, con letras que no se confunden (I/l/1, O/0, b/d) | Atkinson Hyperlegible Next en todo, títulos incluidos. Se carga desde Google Fonts (`index.html`); si no carga, Verdana. |
| Texto base de 16 a 19 px | Texto normal 17 px, `sm` 15 px, `xs` 14 px y etiquetas de estado 13 px. |
| Interlineado de 1,5 | 1,5 en textos chicos y 1,55 en el resto; títulos 1,3 a 1,4. |
| Espaciado entre letras y palabras | 0,02 em entre letras y 0,1 em extra entre palabras, también en campos y botones. |
| Sin mayúsculas sostenidas | Encabezados de tabla y etiquetas de estado (Badge) en mayúscula inicial. |
| Sin itálicas ni subrayados para énfasis | El énfasis va en negrita; `em`/`i` se muestran en negrita. |
| Sin texto justificado | Todo alineado a la izquierda; los números, a la derecha. |
| Contraste alto sin blanco puro sobre negro puro | Fondo crema (`#f6f3ec`, tarjetas `#fffdf8`) y texto `#1f241c`. Texto secundario `#545a50` (contraste mayor a 6:1); en modo oscuro, texto `#e6e4dc` sobre `#20241d`. |
| Cifras fáciles de comparar | Números tabulares en las tablas y en los KPI; columnas numéricas alineadas a la derecha. |

## Al escribir pantallas

- Textos de ayuda de una sola idea y una línea cuando se pueda. Ejemplo: en *Ajuste de stock*, "Para corregir
  diferencias. Para restar, usá un número negativo."
- No usar `tt="uppercase"`, `fs="italic"` ni `ta="justify"`.
- Texto secundario (`c="dimmed"`) solo para datos de apoyo (fecha, depósito, unidad); el dato principal de cada fila va
  con el color normal.
