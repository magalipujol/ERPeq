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
| `pnpm lint` / `pnpm lint:fix` | ESLint con `--max-warnings 0`. |
| `pnpm test:unit` | Vitest (`src/**/*.test.ts`). |
| `pnpm test:e2e` | Playwright contra el build (`pnpm build` + `vite preview`), en Chromium escritorio y Pixel 7. |
| `pnpm build` | Compila a `dist/`. |

El hook de pre-commit (husky) corre `lint-staged` (ESLint sobre los archivos cambiados) y `pnpm test:unit`.
CI (`.github/workflows/ci.yml`) corre typecheck, lint, unit y e2e. Un push a `main` además publica en
GitHub Pages (`deploy.yml`).

Antes de dar un cambio por terminado: `pnpm typecheck && pnpm lint && pnpm test:unit`, y `pnpm test:e2e`
si tocaste pantallas o la lectura/escritura de la planilla.

Cada flujo nuevo que cruce pantallas (por ejemplo, pedido → flete → entrega) se registra como una historia
en `tests/historias.spec.ts`: una prueba por historia, con los pasos numerados en comentarios y los números
esperados explicados (de dónde sale cada total). Ahí es donde aparecen los bugs entre pantallas.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/modelo.ts` | Modelo de datos: hojas y columnas (`HOJAS`), tipos, parseo de filas, filas a escribir (`filas`) y cálculos (stock, estados, precios, comisiones, ganancia). **No depende del navegador**: se prueba con Vitest. |
| `src/google.ts` | Login (Google Identity Services) y Sheets API. `escribir` agrega filas en varias hojas en un solo `batchUpdate`. |
| `src/base.ts`, `src/BaseProvider.tsx` | Contexto de React con los datos cargados y los cálculos derivados. |
| `src/vistas/` | Pantallas: Stock, Pedidos (alta y entregas), Ventas, Compras, Fletes y Precios (precios y reglas de comisión). |
| `src/componentes/` | Componentes compartidos (carga de ítems, etc.). |
| `src/config.ts` | Client ID de Google e ID de la planilla. No son secretos. |
| `tests/` | Pruebas e2e. `tests/google-falso.ts` reemplaza a Google con una planilla en memoria (su estado inicial está resumido al principio de `historias.spec.ts`). `tests/historias.spec.ts` tiene las historias de usuario de punta a punta; el resto prueba una pantalla cada uno. |
| `spec/` | Especificaciones. `spec/modelo-de-datos.md` es la referencia del modelo de datos. |
| `herramientas/excel_a_base.py` | Convierte el Excel histórico en la planilla inicial. |
| `README.md` | Qué es, cómo funciona, estructura de la planilla, cómo correrlo. |
| `GUIA-CONFIGURACION.md` | Paso a paso para configurar Google Cloud y la planilla (para el dueño, no técnico). |
| `TODO.md` | Pendientes. |

## Reglas del modelo de datos

- **Solo se agregan filas** a la planilla. Las correcciones son filas nuevas (ajustes); el stock y el costo
  promedio se calculan a partir de los movimientos.
- Lo que tiene que quedar fijo al momento de una operación (costo, comisión, ganancia de una venta) se
  guarda en la fila. Lo demás se calcula.
- Los valores por defecto (precio de lista, % de comisión) viven en *Precios* y *Reglas de comisión*. Cada
  operación guarda el valor por defecto que se propuso y el que se usó (`precio_lista`/`precio`,
  `porcentaje_regla`/`porcentaje`).
- Una operación escribe todas sus filas con un solo `escribir` (un `batchUpdate`): nunca la partas en
  varias llamadas.
- El orden de columnas de cada hoja está definido en `HOJAS` y `filas` de `src/modelo.ts`, y tiene que
  coincidir con la planilla real, con `tests/google-falso.ts` y con `herramientas/excel_a_base.py`.
- `spec/modelo-de-datos.md` describe el modelo implementado. Si cambiás el modelo, actualizalo junto con
  sus diagramas y las preguntas abiertas que resuelvas.

## Documentación siempre actualizada

Cada cambio deja la documentación al día **en el mismo commit**. Antes de terminar, revisá esta tabla:

| Si cambiaste… | Actualizá |
|---|---|
| Hojas, columnas, tipos o cálculos de `src/modelo.ts` | `spec/modelo-de-datos.md` (tablas y diagramas Mermaid), la sección "Estructura de la planilla" del `README.md`, `tests/google-falso.ts` y, si afecta la carga inicial, `herramientas/excel_a_base.py`. |
| Una decisión de diseño del modelo (sin código todavía) | `spec/modelo-de-datos.md`: el cambio y, si queda algo sin decidir, en "Preguntas abiertas". |
| Archivos o carpetas (nuevos, movidos, borrados) | La tabla "Estructura" de este archivo y la sección "Archivos" del `README.md`. |
| Scripts de `package.json`, CI o hooks | La tabla "Comandos" de este archivo y "Probar en la compu" del `README.md`. |
| Login, permisos de Google, `config.ts` o pasos de configuración | `GUIA-CONFIGURACION.md` y "Cómo funciona" del `README.md`. |
| Algo de `TODO.md` | Sacá el ítem si quedó hecho. |
| Un área nueva (por ejemplo, fletes o comisiones en la UI) | Una spec nueva en `spec/` si tiene reglas que no se deducen del código. |

Para las specs:

- Una por tema, en `spec/<tema>.md`, en español.
- Diagramas en Mermaid (`erDiagram` para tablas, `stateDiagram-v2` para estados, `flowchart` para
  cálculos y flujos). Los diagramas tienen que coincidir con las tablas del mismo documento.
- Ejemplos con datos concretos (como los del Excel) para cada caso de uso.
- Describen cómo es el sistema, no cómo llegó a ser así: el historial está en git.

Si encontrás documentación que no coincide con el código, corregila o avisá; no la dejes como está.

## Datos sensibles

- `ROSARIO ACTUALIZADO.xlsm` y los `.xlsx` generados tienen datos personales de clientes: **no se suben al
  repo** (`.gitignore` los excluye). Tampoco los copies a specs, tests ni commits: usá datos inventados o
  anonimizados.
- `src/config.ts` no tiene secretos, pero no agregues tokens ni credenciales en ningún archivo.
- La planilla real es producción: no la modifiques desde un agente sin que el usuario lo pida explícitamente.
