# AGENTS.md

Guía para agentes (y personas) que trabajan en este repo.

ERPeq gestiona stock, pedidos, ventas, compras y fletes de una dietética. Es una página estática (React 19 + TypeScript +
Mantine) publicada en GitHub Pages. No hay servidor: la base de datos es una planilla de Google Sheets que
la app lee y escribe con la Sheets API desde el navegador, con el login de Google del usuario.

El código, los comentarios, la UI y los mensajes de commit están en **español**. Mantenelo así.

## Comandos

Node 24 y pnpm (`corepack enable`).

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo en http://localhost:5500 (tiene que estar autorizado en Google Cloud). |
| `pnpm typecheck` | `tsc -b`. |
| `pnpm lint` / `pnpm lint:fix` | ESLint con `--max-warnings 0` y caché (`.tmp/eslintcache`): solo vuelve a revisar los archivos cambiados. |
| `pnpm test:unit` | Vitest (`src/**/*.test.ts`). |
| `pnpm test:e2e` | Playwright contra el build (`pnpm build` + `vite preview`), en Chromium escritorio y Pixel 7. |
| `pnpm build` | Compila a `dist/`. |

El hook de pre-commit (husky) corre `lint-staged` (ESLint sobre los archivos cambiados) y `pnpm test:unit`.
CI (`.github/workflows/ci.yml`) corre typecheck, lint, unit y e2e. Un push a `main` además publica en
GitHub Pages (`deploy.yml`).

Antes de dar un cambio por terminado: `pnpm typecheck && pnpm lint && pnpm test:unit`, y `pnpm test:e2e`
si tocaste pantallas o la lectura/escritura de la planilla.

Para trabajar rápido:

- Mientras iterás, corré solo el spec que tocaste y en un proyecto:
  `pnpm test:e2e tests/stock.spec.ts --project=chromium` tarda ~10 s; la suite completa (140 pruebas, escritorio
  y celular) tarda ~1 min. Corré la completa una vez, antes de commitear.
- Para cambiar parte de un archivo, usá `Edit` con el fragmento que cambia. `Write` (o un heredoc) es para archivos
  nuevos o reescrituras completas: generar el archivo entero de nuevo es lo más lento de una sesión.
- Las salidas temporales de scripts y herramientas (capturas, reportes, descargas, archivos intermedios) van en
  `.tmp/`, que git ignora. Ahí ya escriben Playwright (`.tmp/test-results`, `.tmp/playwright-report`) y la caché de
  ESLint. No las dejes sueltas en la raíz ni en `tests/`.
- No esperes la CI en primer plano (`gh pr checks --watch`, `gh run watch`, `sleep`): corré la espera en segundo
  plano, o no la esperes si no hace falta el resultado para seguir.

Cada flujo nuevo que cruce pantallas (por ejemplo, pedido → flete → entrega) se registra como una historia
en `tests/historias.spec.ts`: una prueba por historia, con los pasos numerados en comentarios y los números
esperados explicados (de dónde sale cada total). Ahí es donde aparecen los bugs entre pantallas.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/dominio/modelo.ts` | **Dominio**: tipos y cálculos (stock, estados, precios, comisiones, ganancia, entregas, IDs, saldo a cobrar de cada venta, cuentas entre socios y recetas: versión vigente, merma y armado de una fabricación). No sabe nada de hojas, columnas ni del navegador: se prueba con Vitest. |
| `src/dominio/analisis.ts` | **Dominio**: cálculos de la pantalla Análisis (ganancia y ventas por producto, clientes activos e inactivos). Puro, se prueba con Vitest. Ver `spec/analisis.md`. |
| `src/dominio/fichas.ts` | **Dominio**: qué muestra la ficha de un pedido, venta, producto, contacto, flete o compra y lo que tiene relacionado. Puro, se prueba con Vitest. Ver `spec/fichas.md`. |
| `src/dominio/mapa.ts` | **Dominio**: qué va en el mapa de Inicio (depósitos, pedidos abiertos, fletes en curso) y en qué localidad. Puro, se prueba con Vitest. Ver `spec/mapa.md`. |
| `src/mapa/` | Mapa de Argentina: `argentina.json` (provincias como paths SVG y localidades censales, ya proyectadas; lo genera `herramientas/mapa_argentina.py`) y `ubicar.ts` (ubica una localidad, junta lugares cercanos en sitios y fletes en tramos; se prueba con Vitest). Lo usa `componentes/Mapa.tsx`, que Inicio carga aparte (`lazy`). |
| `src/db/puerto.ts` | **Puerto**: la interfaz `BaseDeDatos` que usa la UI (sesión, `leer()` y una operación atómica por caso de uso: `registrarPedido`, `registrarEntrega`, `registrarFlete`, `registrarCobro`, `registrarFabricacion`, …), los errores `SinAcceso` y `SesionVencida` y las hojas que faltan por área (`faltantesDe`). |
| `src/db/sheets/` | **Adaptador Google Sheets**. `hojas.ts`: hojas y encabezados de sus columnas (`HOJAS`), hojas opcionales por área (`OPCIONALES`: caja y recetas, que se leen vacías si faltan), lectura (`leerHojas`, que verifica los encabezados, y `parsear`) y filas a escribir (`filas`). `operaciones.ts`: qué filas agrega cada operación. `celdas.ts`: valores de celda y fechas como número de serie. `google.ts`: login (Google Identity Services) y Sheets API (`escribir` agrega filas en varias hojas en un solo `batchUpdate`). `index.ts`: `crearBaseSheets`. `memoria.ts`: la misma planilla en memoria, para pruebas unitarias. |
| `src/main.tsx` | Raíz de composición: crea el adaptador y se lo pasa a `App`. |
| `src/base.ts`, `src/BaseProvider.tsx` | Contexto de React con los datos cargados, los cálculos derivados y las operaciones del puerto (`db`). |
| `src/ficha.ts` | Contexto para abrir fichas (`useFicha`) y `useFila`, que hace que tocar una fila de tabla abra su ficha. |
| `src/vistas/` | Pantallas: Inicio (por defecto: pedido nuevo, mapa, pedidos pendientes —con el flete para cubrir sus faltantes— y fletes en curso), Stock, Pedidos (alta y entregas), Ventas, Compras, Recetas (recetas y fabricación), Fletes, Precios (precios, reglas de comisión y envío), Caja (cobros y cuentas entre socios) y Análisis. |
| `src/componentes/` | Componentes compartidos (carga de ítems, navegación: selector del header y barra inferior del celular, exportar pedidos a WhatsApp, estados de pedidos y fletes, etc.). `Fichas.tsx`: el modal de fichas (`FichaProvider`) y `Vinculo`. |
| `src/estilos.css`, `src/celular.css` | Estilos globales (incluida la declaración de la fuente); `celular.css` tiene los ajustes para menos de 768 px (breakpoint `sm` de Mantine). |
| `src/fuentes/` | OpenDyslexic 0.990 (regular y negrita, del repositorio del proyecto) y su licencia OFL. Ver `spec/legibilidad.md`. |
| `src/whatsapp.ts` | Arma el mensaje de pedidos para WhatsApp (qué pedidos entran y el texto). Sin dependencias del navegador: se prueba con Vitest. |
| `src/config.ts` | Client ID de Google e ID de la planilla. No son secretos. |
| `tests/` | Pruebas e2e. `tests/google-falso.ts` reemplaza a Google con una planilla en memoria (su estado inicial está resumido al principio de `historias.spec.ts`) y tiene `ir()` para cambiar de pantalla en escritorio o celular, y funciones para leer el stock tanto de las tablas (escritorio) como de las tarjetas (celular): `stockEn`, `stockTotal`, `esperarDatosStock`, etc. `tests/historias.spec.ts` tiene las historias de usuario de punta a punta; el resto prueba una pantalla cada uno. |
| `spec/` | Especificaciones. `spec/modelo-de-datos.md` es la referencia del modelo de datos; `spec/arquitectura.md`, la de las capas; `spec/legibilidad.md`, las pautas de tipografía y contraste (apto dislexia); `spec/analisis.md`, la de los análisis; `spec/mapa.md`, la del mapa de Inicio; `spec/fichas.md`, la de las fichas; `spec/recetas.md`, la de recetas y fabricación; `spec/stock.md`, la de la pantalla Stock. |
| `diseño/experimental/` | Propuesta de rediseño para celular (exportada de un lienzo de diseño de Claude): una pantalla por archivo `.dc.html` (Inicio, Pedido, Entregar, Cobrar, Stock, Fletes) y `Sistema.dc.html` con colores, íconos y letra; `canvas.json` ubica las pantallas en el lienzo. Son referencia: cargan un `support.js` del editor que no está en el repo, así que no se abren solas en el navegador. Datos inventados. |
| `public/` | Se copia tal cual a `dist/`: `manifest.webmanifest` (app instalable, sin service worker), `icono.svg` (original del ícono y favicon) y los PNG que genera `herramientas/iconos.mjs` (192, 512 —también *maskable*— y `apple-touch-icon` de 180). Las rutas son relativas porque la app vive en `/ERPeq/`. |
| `herramientas/iconos.mjs` | Genera los íconos PNG desde `public/icono.svg` con el Chromium de Playwright: `node herramientas/iconos.mjs`. |
| `herramientas/mapa_argentina.py` | Baja provincias (IGN) y localidades censales (INDEC) del servicio Georef y genera `src/mapa/argentina.json`. |
| `.tmp/` | Salidas temporales de scripts y herramientas (reportes de Playwright, caché de ESLint, capturas). Git la ignora. |
| `README.md` | Qué es, cómo funciona, estructura de la planilla, cómo correrlo. |
| `GUIA-CONFIGURACION.md` | Paso a paso para configurar Google Cloud y la planilla (para el dueño, no técnico). |
| `TODO.md` | Pendientes. |

## Capas

Arquitectura hexagonal, con los límites controlados por ESLint (`no-restricted-imports`, bloques `capas/*` de
`eslint.config.ts`). Detalle y diagrama en `spec/arquitectura.md`.

- **Dominio** (`src/dominio/`) no importa nada de fuera de su carpeta: ni la base, ni la UI, ni React.
- **Puerto** (`src/db/puerto.ts`) solo depende del dominio.
- **Adaptadores** (`src/db/sheets/`) implementan el puerto; no importan la UI.
- **UI** (`App.tsx`, `base.ts`, `vistas/`, `componentes/`) usa el dominio y el puerto, nunca un adaptador:
  no conoce hojas, columnas ni filas. Solo `src/main.tsx` elige el adaptador.
- Una escritura nueva es una operación nueva en el puerto (en términos del dominio) y su traducción a filas
  en `src/db/sheets/operaciones.ts`, con su prueba en `operaciones.test.ts` sobre la planilla en memoria.

## Reglas del modelo de datos

- **Solo se agregan filas** a la planilla. Las correcciones son filas nuevas (ajustes); el stock y el costo
  promedio se calculan a partir de los movimientos.
- Lo que tiene que quedar fijo al momento de una operación (costo, comisión, ganancia de una venta) se
  guarda en la fila. Lo demás se calcula.
- Las filas guardan IDs, nunca copias de nombres: el nombre de un producto, contacto, vendedor o socio está
  solo en su hoja, y la UI lo resuelve con `nombres(datos)` del dominio.
- La UI nunca muestra IDs (ni en tablas, ni en mensajes, ni en el texto de WhatsApp): sirven para relacionar
  filas. Un pedido, una venta o un flete se nombra por cliente (o transportista) y fecha con `etiquetas` de
  `base.ts`: "Ana · 10/10/26".
- Los valores por defecto (precio de lista, % de comisión) viven en *Precios* y *Reglas de comisión*. Cada
  operación guarda el valor por defecto que se propuso y el que se usó (`precio_lista`/`precio`,
  `porcentaje_regla`/`porcentaje`).
- Cada operación del puerto es atómica: escribe todas sus filas con un solo `escribir` (un `batchUpdate`).
  Nunca la partas en varias operaciones ni en varias llamadas.
- El orden de columnas de cada hoja está definido en `HOJAS` y `filas` de `src/db/sheets/hojas.ts`, y tiene que
  coincidir con la planilla real, con `ENCABEZADOS` y las filas de `tests/google-falso.ts` y con la tabla de
  hojas de `GUIA-CONFIGURACION.md`. La app verifica los encabezados al leer: cambiar columnas de una planilla
  existente necesita migrarla, con el paso a mano descripto en `GUIA-CONFIGURACION.md` (como "Agregar la
  localidad de los vendedores a una planilla que ya existe").
- `spec/modelo-de-datos.md` describe el modelo implementado. Si cambiás el modelo, actualizalo junto con
  sus diagramas y las preguntas abiertas que resuelvas.

## Documentación siempre actualizada

Cada cambio deja la documentación al día **en el mismo commit**. Antes de terminar, revisá esta tabla:

| Si cambiaste… | Actualizá |
|---|---|
| Tipos o cálculos de `src/dominio/modelo.ts`, u hojas y columnas de `src/db/sheets/hojas.ts` | `spec/modelo-de-datos.md` (tablas y diagramas Mermaid), la sección "Estructura de la planilla" del `README.md`, `tests/google-falso.ts` y, si cambian hojas o columnas, la tabla de hojas y el paso de migración en `GUIA-CONFIGURACION.md`. |
| Una decisión de diseño del modelo (sin código todavía) | `spec/modelo-de-datos.md`: el cambio y, si queda algo sin decidir, en "Preguntas abiertas". |
| Archivos o carpetas (nuevos, movidos, borrados) | La tabla "Estructura" de este archivo y la sección "Archivos" del `README.md`. |
| Capas, el puerto o un adaptador | La sección "Capas" de este archivo y `spec/arquitectura.md` (tabla de operaciones y diagramas). |
| Scripts de `package.json`, CI o hooks | La tabla "Comandos" de este archivo y "Probar en la compu" del `README.md`. |
| Login, permisos de Google, `config.ts` o pasos de configuración | `GUIA-CONFIGURACION.md` y "Cómo funciona" del `README.md`. |
| Algo de `TODO.md` | Sacá el ítem si quedó hecho. |
| Un área nueva (por ejemplo, fletes o comisiones en la UI) | Una spec nueva en `spec/` si tiene reglas que no se deducen del código. |

Para las specs:

- Una por tema, en `spec/<tema>.md`, en español.
- Diagramas en Mermaid (`erDiagram` para tablas, `stateDiagram-v2` para estados, `flowchart` para
  cálculos y flujos). Los diagramas tienen que coincidir con las tablas del mismo documento.
- Ejemplos con datos concretos (inventados o anonimizados) para cada caso de uso.
- Describen cómo es el sistema, no cómo llegó a ser así: el historial está en git.

Si encontrás documentación que no coincide con el código, corregila o avisá; no la dejes como está.

## Datos sensibles

- `ROSARIO ACTUALIZADO.xlsm` y los `.xlsx` generados tienen datos personales de clientes: **no se suben al
  repo** (`.gitignore` los excluye). Tampoco los copies a specs, tests ni commits: usá datos inventados o
  anonimizados.
- `src/config.ts` no tiene secretos, pero no agregues tokens ni credenciales en ningún archivo.
- La planilla real es producción: no la modifiques desde un agente sin que el usuario lo pida explícitamente.
