---
version: 1
slug: "src-vistas-stock-tsx"
primary_target: "src/vistas/Stock.tsx"
related_targets: ["src/App.tsx","src/componentes/Navegacion.tsx"]
---

# App de celular de ERPeq (shell, Stock y Pedido nuevo)

Modo: Operate. Usuaria: dueña con dislexia, en el celular, con una mano. Trabajos: cargar un pedido nuevo y consultar el stock.
Restricciones: polaridad positiva, 44 px mínimo por toque, sin mayúsculas sostenidas ni itálicas, cifras que no se parten, la UI nunca muestra IDs.
Pendiente: llevar la tapa de producto al resto de las pantallas (Pedidos, Ventas, Compras, Fletes, Recetas).

## Direction contract

THESIS: cada producto se reconoce por su tapa (un color fijo y dos letras) antes de leer el nombre, como los frascos a granel de la dietética. Rechaza la grilla de KPI arriba de cada pantalla y las tarjetas iguales de texto gris.
OWN-WORLD: fondo de papel claro #FBF8F1, tarjetas blancas con borde kraft #E3DCCB, tinta #1E2420, acento kraft #8A6A3B para lo activo, tapas de 10 tonos oscuros fijos con un círculo claro y dos letras. Atkinson Hyperlegible Next en todo; cifras tabulares grandes en negrita.
STORY: abre la app, ve lo que hay sin leer de más; toca un frasco y ve en qué depósito está; toca Pedido y carga.
FIRST VIEWPORT: Stock en celular: buscador de 52 px arriba, filtros en chips de 44 px (Todos, Faltan, Bajo el mínimo), grilla de frascos de dos columnas con tapa de color, total grande y unidad; los sin stock con borde punteado. Barra inferior con Inicio, Stock, Pedido (botón kraft lleno, en el centro), Pedidos y Más.
FORM: candidato 2 de mi lista (Frascos a granel, IMPECCABLE'S PICK; la tirada asignó Señalética vial, candidato 7). seed:8337faf9a722773e
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
