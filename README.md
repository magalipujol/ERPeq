# ERPeq

Gestión de stock, pedidos, ventas, compras y fletes para una dietética, con Google Sheets como base de datos.
Es una página estática (sin servidor) hecha con React, TypeScript y Mantine, que se publica en GitHub Pages.

## Cómo funciona

- Cada usuario entra con su cuenta de Google (Google Identity Services). El token dura una hora y se guarda en `localStorage`: recargar la página o abrir otra pestaña no vuelve a pedir el login. Se borra al salir o cuando vence.
- La app pide el permiso `spreadsheets` y trabaja solo sobre la planilla configurada, que tiene que estar compartida
  con la cuenta del usuario. El proyecto queda en modo Prueba: solo entran los usuarios de prueba cargados.
- Lee y escribe directo con la Sheets API desde el navegador. Las escrituras son siempre filas nuevas, y cada
  operación (un pedido con sus ítems, una entrega con sus comisiones) va en un solo `batchUpdate`: se guarda
  entera o no se guarda. El stock, el costo y los estados se calculan a partir de los movimientos.
- Las pantallas no conocen la planilla: usan una interfaz con una operación por caso de uso (registrar un pedido,
  una entrega, un flete…), y el adaptador de Google Sheets la traduce en filas. Ver
  [spec/arquitectura.md](spec/arquitectura.md).
- Se puede instalar en el celular como app (manifiesto en `public/manifest.webmanifest`). No tiene service worker:
  cada vez que se abre carga la versión publicada, así que se actualiza sola con cada deploy. Una app que quedó
  abierta en segundo plano sigue con la versión anterior hasta que se cierra o se recarga. Ver
  [GUIA-CONFIGURACION.md](GUIA-CONFIGURACION.md#instalar-en-el-celular).

## Estructura de la planilla

El detalle (columnas, diagramas y casos de uso) está en [spec/modelo-de-datos.md](spec/modelo-de-datos.md).

| Hojas | Contenido |
|---|---|
| Depósitos, Productos, Contactos, Tipos de cliente, Vendedores | Datos maestros. |
| Precios, Reglas de comisión | Valores por defecto (precio de lista y % de comisión por vendedor y producto), con fecha desde. |
| Pedidos, Pedidos ítems, Pedidos estados, Pedidos vendedores | Lo que pide el cliente, con el precio fijado al crearlo. Reserva stock. |
| Ventas, Ventas ítems, Ventas comisiones | Cada entrega de un pedido: descuenta stock y genera la comisión. |
| Compras, Ajustes | Entradas y correcciones de stock. |
| Recetas, Recetas ítems | Recetas de productos de *Productos* (insumos por tanda y cuánto sale, con versiones). Cada fabricación se guarda en *Ajustes*. Si faltan, la app las lee vacías y la pantalla Recetas avisa. |
| Fletes, Fletes ítems, Fletes estados, Pedidos fletes | Viajes con su costo; los que van entre depósitos mueven stock según su estado. |
| Socios, Cobros, Rendiciones | Quién cobró cada venta (efectivo o transferencia) y lo que los socios se rinden entre sí. Si faltan, la app las lee vacías y la pantalla Caja avisa. |

Cada fila guarda los IDs de lo que referencia (producto, contacto, vendedor, socio), nunca sus nombres: el nombre
se corrige en *Productos*, *Contactos*, *Vendedores* o *Socios* y cambia en toda la app. La app revisa los
encabezados de cada hoja y no abre una planilla con las columnas distintas a las que espera.

**Stock** = compras − entregas + ajustes (incluidas las fabricaciones) ± fletes entre depósitos (en camino: sale del origen; finalizado: entra en el destino).
**Costo promedio** = promedio ponderado de todas las compras con precio del producto.
**Ganancia de un pedido** = lo entregado − comisiones − cantidad × costo promedio − fletes asignados.
**Saldo de un socio con el dueño** = lo que cobró − las comisiones de sus vendedores − lo que le rindió + lo que recibió del dueño.

## Archivos

- `src/`: la app.
  - `config.ts`: Client ID de Google y ID de la planilla.
  - `dominio/modelo.ts`: tipos y cálculos del negocio (sin base de datos ni navegador).
  - `dominio/analisis.ts`: cálculos de la pantalla Análisis (sin base de datos ni navegador).
  - `dominio/mapa.ts`: qué va en el mapa de Inicio y en qué localidad (sin base de datos ni navegador).
  - `mapa/`: el mapa de Argentina (`argentina.json`: provincias y localidades ya proyectadas) y `ubicar.ts`,
    que ubica localidades y arma las marcas.
  - `db/puerto.ts`: lo que la app necesita de la base (leer y una operación por caso de uso).
  - `db/sheets/`: la implementación sobre Google Sheets (hojas y columnas, login, Sheets API) y una
    planilla en memoria para las pruebas.
  - `main.tsx`: arranca la app con la base de Google Sheets; `App.tsx`: pantallas de acceso y navegación;
    `vistas/`: Inicio (pantalla por defecto: acceso directo a un pedido nuevo, mapa con depósitos, pedidos
    pendientes y fletes en curso, y sus listas), Stock, Pedidos, Ventas, Compras, Recetas, Fletes, Precios, Caja y Análisis.
  - `componentes/`: piezas compartidas (carga de ítems, navegación entre pantallas, KPIs, el mapa de Inicio).
  - `celular.css`: ajustes para pantallas de menos de 768 px (barra inferior con menú *Más*, campos de 44 px).
  - `fuentes/`: la tipografía OpenDyslexic (regular y negrita) y su licencia (SIL Open Font License).
  - `whatsapp.ts`: arma el mensaje con los pedidos para mandar a un grupo de WhatsApp (botón *Exportar a WhatsApp* en Pedidos).
- `public/`: lo que se publica tal cual: el manifiesto de la app instalable y sus íconos (`icono.svg` es el
  original; los PNG los genera `herramientas/iconos.mjs`).
- `spec/`: especificaciones (`modelo-de-datos.md`, `arquitectura.md`, `legibilidad.md`, `analisis.md`, `mapa.md` y `recetas.md`).
- `diseño/experimental/`: propuesta de rediseño para celular, una pantalla por archivo `.dc.html` y una hoja
  con colores, íconos y letra (`Sistema.dc.html`). Es referencia: no se abre sola en el navegador.
- `.github/workflows/ci.yml`: lint, tipos y pruebas en cada pull request y push.
- `.github/workflows/deploy.yml`: corre el CI y, si pasa, compila y publica en GitHub Pages en cada push a `main`
  (en *Settings → Pages*, la fuente tiene que ser **GitHub Actions**).
- `herramientas/excel_a_base.py`: convierte el Excel histórico en la planilla inicial.
- `herramientas/iconos.mjs`: genera los íconos PNG desde `public/icono.svg` (`node herramientas/iconos.mjs`, usa
  el Chromium de Playwright).
- `herramientas/mapa_argentina.py`: genera `src/mapa/argentina.json` con los datos abiertos de Georef (IGN e INDEC).
- `herramientas/normalizar_planilla.gs`: Apps Script que saca de una planilla vieja las columnas con nombres
  copiados (ver "Migrar una planilla con nombres copiados").
- `GUIA-CONFIGURACION.md`: paso a paso para configurar Google y la planilla.

## Generar la base desde el Excel

```sh
uv run --with openpyxl herramientas/excel_a_base.py "ROSARIO ACTUALIZADO.xlsm" "ERPeq-base.xlsx"
```

(o `pip install openpyxl` y `python herramientas/excel_a_base.py ...`). Muestra un resumen con las reglas de
comisión deducidas, los productos con stock negativo y los datos a revisar. Para cargarla en la planilla ver
`GUIA-CONFIGURACION.md`.
**El `.xlsx` generado tiene datos personales: no lo subas al repo** (`.gitignore` ya lo excluye).

## Migrar una planilla con nombres copiados

Las planillas de antes guardaban en *Pedidos*, *Compras*, *Fletes*, los ítems, las comisiones y los cobros una
copia del nombre del cliente, producto, vendedor o socio. La app ya no las abre. Para migrarla, en la planilla:

1. *Extensiones → Apps Script*, pegar `herramientas/normalizar_planilla.gs` y guardar.
2. Ejecutar `revisar`. No cambia nada: el registro de ejecución lista los problemas (filas con un nombre pero
   sin ID) y las columnas que se van a borrar. Corregir los problemas completando el ID.
3. Hacer una copia de respaldo (*Archivo → Hacer una copia*) y ejecutar `migrar`.

El detalle está en "Planillas con nombres copiados" de `spec/modelo-de-datos.md`.

## Probar en la compu

Hace falta Node 24 y pnpm (`corepack enable` lo instala).

```sh
pnpm install
pnpm dev
```

y abrir http://localhost:5500 (tiene que estar autorizado como origen en el proyecto de Google).

`pnpm build` deja la versión publicable en `dist/`; `pnpm preview` la sirve en el mismo puerto.

## Pruebas

- **Unitarias** (Vitest, `src/**/*.test.ts`): los cálculos del dominio (`modelo.ts` y `analisis.ts`), `formato.ts`, `meses.ts`, `whatsapp.ts` y el adaptador
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
