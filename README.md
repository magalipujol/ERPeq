# ERPeq

Gestión de stock, pedidos, ventas, compras y fletes para una dietética, con Google Sheets como base de datos.
Es una página estática (sin servidor) hecha con React, TypeScript y Mantine, que se publica en GitHub Pages.

## Cómo funciona

- Cada usuario entra con su cuenta de Google (Google Identity Services). El token dura una hora y vive solo en memoria.
- La app pide el permiso `spreadsheets` y trabaja solo sobre la planilla configurada, que tiene que estar compartida
  con la cuenta del usuario. El proyecto queda en modo Prueba: solo entran los usuarios de prueba cargados.
- Lee y escribe directo con la Sheets API desde el navegador. Las escrituras son siempre filas nuevas, y cada
  operación (un pedido con sus ítems, una entrega con sus comisiones) va en un solo `batchUpdate`: se guarda
  entera o no se guarda. El stock, el costo y los estados se calculan a partir de los movimientos.
- Las pantallas no conocen la planilla: usan una interfaz con una operación por caso de uso (registrar un pedido,
  una entrega, un flete…), y el adaptador de Google Sheets la traduce en filas. Ver
  [spec/arquitectura.md](spec/arquitectura.md).
- **Experimental:** en Chrome de escritorio con IA integrada (Gemini Nano), la pantalla Pedidos muestra un cuadro
  *Pegar pedido* que completa el formulario a partir de un mensaje de un cliente. Corre en la computadora (no manda
  nada a ningún servidor) y nunca guarda solo. En otros navegadores no aparece. Detalle, requisitos y cómo
  activarlo en [spec/pedido-texto.md](spec/pedido-texto.md).

## Estructura de la planilla

El detalle (columnas, diagramas y casos de uso) está en [spec/modelo-de-datos.md](spec/modelo-de-datos.md).

| Hojas | Contenido |
|---|---|
| Depósitos, Productos, Contactos, Tipos de cliente, Vendedores | Datos maestros. |
| Precios, Reglas de comisión | Valores por defecto (precio de lista y % de comisión por vendedor y producto), con fecha desde. |
| Pedidos, Pedidos ítems, Pedidos estados, Pedidos vendedores | Lo que pide el cliente, con el precio fijado al crearlo. Reserva stock. |
| Ventas, Ventas ítems, Ventas comisiones | Cada entrega de un pedido: descuenta stock y genera la comisión. |
| Compras, Ajustes | Entradas y correcciones de stock. |
| Fletes, Fletes ítems, Fletes estados, Pedidos fletes | Viajes con su costo; los que van entre depósitos mueven stock según su estado. |

**Stock** = compras − entregas + ajustes ± fletes entre depósitos (en camino: sale del origen; finalizado: entra en el destino).
**Costo promedio** = promedio ponderado de todas las compras con precio del producto.
**Ganancia de un pedido** = lo entregado − comisiones − cantidad × costo promedio − fletes asignados.

## Archivos

- `src/`: la app.
  - `config.ts`: Client ID de Google y ID de la planilla.
  - `dominio/modelo.ts`: tipos y cálculos del negocio (sin base de datos ni navegador).
  - `db/puerto.ts`: lo que la app necesita de la base (leer y una operación por caso de uso).
  - `db/sheets/`: la implementación sobre Google Sheets (hojas y columnas, login, Sheets API) y una
    planilla en memoria para las pruebas.
  - `main.tsx`: arranca la app con la base de Google Sheets; `App.tsx`: pantallas de acceso y navegación;
    `vistas/`: Stock, Pedidos, Ventas, Compras, Fletes y Precios.
  - `pedido-texto.ts` y `componentes/PegarPedido.tsx`: pedido desde un mensaje pegado con la IA de Chrome (experimental).
- `spec/`: especificaciones (`modelo-de-datos.md`, `arquitectura.md`, `pedido-texto.md`).
- `.github/workflows/ci.yml`: lint, tipos y pruebas en cada pull request y push.
- `.github/workflows/deploy.yml`: corre el CI y, si pasa, compila y publica en GitHub Pages en cada push a `main`
  (en *Settings → Pages*, la fuente tiene que ser **GitHub Actions**).
- `herramientas/excel_a_base.py`: convierte el Excel histórico en la planilla inicial.
- `GUIA-CONFIGURACION.md`: paso a paso para configurar Google y la planilla.

## Generar la base desde el Excel

```sh
uv run --with openpyxl herramientas/excel_a_base.py "ROSARIO ACTUALIZADO.xlsm" "ERPeq-base.xlsx"
```

(o `pip install openpyxl` y `python herramientas/excel_a_base.py ...`). Muestra un resumen con las reglas de
comisión deducidas, los productos con stock negativo y los datos a revisar. Para cargarla en la planilla ver
`GUIA-CONFIGURACION.md`.
**El `.xlsx` generado tiene datos personales: no lo subas al repo** (`.gitignore` ya lo excluye).

## Probar en la compu

Hace falta Node 24 y pnpm (`corepack enable` lo instala).

```sh
pnpm install
pnpm dev
```

y abrir http://localhost:5500 (tiene que estar autorizado como origen en el proyecto de Google).

`pnpm build` deja la versión publicable en `dist/`; `pnpm preview` la sirve en el mismo puerto.

## Pruebas

- **Unitarias** (Vitest, `src/**/*.test.ts`): los cálculos del dominio, `formato.ts`, `meses.ts`, `pedido-texto.ts` y el adaptador
  de Sheets (lectura de filas, celdas y las filas que agrega cada operación, sobre una planilla en memoria).
  Tardan menos de un segundo.
- **De punta a punta** (Playwright, `tests/`): la app entera contra el build. Google está simulado
  (`tests/google-falso.ts`): no hace falta cuenta ni se toca la planilla real.

```sh
pnpm test:unit                          # unitarias
pnpm test:unit:watch                    # unitarias, re-corriendo al guardar
pnpm exec playwright install chromium   # la primera vez, para las de punta a punta
pnpm test:e2e
pnpm test:e2e:ui                        # para verlas paso a paso
pnpm test                               # todas
```

En GitHub corren antes de cada publicación: si alguna falla, no se publica.

## Lint

ESLint con las reglas más estrictas de typescript-eslint (`strictTypeChecked` + `stylisticTypeChecked`),
`@eslint-react` (`strict-type-checked`), reglas de hooks de React, accesibilidad (`jsx-a11y` estricto),
Vitest (`all`) y Playwright para las pruebas. No se admiten warnings.

```sh
pnpm lint
pnpm lint:fix    # arregla lo que se pueda solo
```

## Antes de cada commit

`pnpm install` instala un hook de git (husky) que, antes de cada commit, corre ESLint sobre los archivos
agregados (lint-staged) y las pruebas unitarias. Si algo falla, el commit no se hace.
Las de punta a punta quedan para GitHub porque tardan más (compilan y abren un navegador).
