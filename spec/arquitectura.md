# Arquitectura

ERPeq separa en capas lo que es negocio, lo que es pantalla y lo que es guardar en la base (arquitectura
hexagonal, o de puertos y adaptadores). Hoy la única base es una planilla de Google Sheets, pero las
pantallas no lo saben: piden operaciones del negocio ("registrar un pedido") y el adaptador decide en qué
hojas y columnas se guarda.

## Capas

```mermaid
flowchart LR
  subgraph UI["UI (React + Mantine)"]
    main["main.tsx<br/>raíz de composición"]
    app["App.tsx · base.ts · BaseProvider.tsx"]
    vistas["vistas/ · componentes/"]
    mapa["mapa/<br/>ubicar.ts + argentina.json"]
  end
  subgraph db["src/db"]
    puerto["puerto.ts<br/>BaseDeDatos"]
    subgraph sheets["sheets/ (adaptador Google Sheets)"]
      index["index.ts<br/>crearBaseSheets"]
      ops["operaciones.ts"]
      hojas["hojas.ts"]
      celdas["celdas.ts"]
      google["google.ts<br/>login + Sheets API"]
      memoria["memoria.ts<br/>planilla en memoria"]
    end
  end
  dominio["src/dominio/<br/>modelo.ts: tipos y cálculos<br/>analisis.ts: análisis<br/>mapa.ts: qué va en el mapa<br/>fichas.ts: fichas y lo relacionado"]

  main --> index
  main --> app
  app --> puerto
  vistas --> puerto
  app --> dominio
  vistas --> dominio
  vistas --> mapa
  mapa --> dominio
  puerto --> dominio
  index -. implementa .-> puerto
  memoria -. implementa .-> puerto
  index --> ops
  index --> google
  memoria --> ops
  ops --> hojas
  hojas --> celdas
  hojas --> dominio
  google --> celdas
  google --> hojas
```

| Capa | Dónde | Qué tiene | Puede importar |
|---|---|---|---|
| Dominio | `src/dominio/` | Tipos (`Pedido`, `Venta`, `Flete`, `Cobro`…) y cálculos puros: stock por depósito, estados, precio vigente, comisiones, ganancia, armado de una entrega, IDs, saldo a cobrar de cada venta y cuentas entre socios (`modelo.ts`), los análisis de ventas y clientes (`analisis.ts`) qué va en el mapa de Inicio (`mapa.ts`) y lo que muestra la ficha de cada cosa (`fichas.ts`). | Nada de fuera de su carpeta. |
| Puerto | `src/db/puerto.ts` | La interfaz `BaseDeDatos` (sesión, `leer()` y operaciones), los datos de cada operación y los errores `SinAcceso` y `SesionVencida`. | Solo el dominio. |
| Adaptador Google Sheets | `src/db/sheets/` | Hojas y columnas, lectura de filas, filas que agrega cada operación, celdas y fechas, login y Sheets API. | Dominio, puerto y `src/config.ts`. Nunca la UI. |
| UI | `src/App.tsx`, `src/base.ts`, `src/BaseProvider.tsx`, `src/vistas/`, `src/componentes/`, `src/mapa/` | Pantallas y estado de la pantalla; `mapa/` ubica localidades en el dibujo del mapa. Arma los objetos del dominio (con sus IDs) y llama al puerto. | Dominio y puerto. Nunca un adaptador. |
| Raíz de composición | `src/main.tsx` | Crea el adaptador (`crearBaseSheets(CONFIG)`) y se lo pasa a `App`. | Todo. |

ESLint hace cumplir las flechas con `no-restricted-imports` (bloques `capas/*` de `eslint.config.ts`): un
import que cruza una capa en la dirección prohibida no pasa `pnpm lint` ni el pre-commit.

## El puerto

`BaseDeDatos` junta tres partes:

- **Sesión:** `configurada`, `iniciar(alVencer)`, `ingresar()`, `salir()` y `abrir()`, que devuelve el
  título y la URL de la base y lo que le falta a cada área opcional (`faltantes`, cada uno con su `area`:
  `caja` para *Socios*, *Cobros* y *Rendiciones*, `recetas` para *Recetas* y *Recetas ítems*, `envios` para
  *Envíos* y *Ventas envíos*;
  en Sheets, las hojas que no existen, con sus encabezados; la UI los filtra con `faltantesDe`), o lanza `SinAcceso` si la cuenta
  no puede abrirla. Una llamada con la sesión vencida lanza `SesionVencida` y avisa con `alVencer`.
  `iniciar` devuelve `true` si sigue vigente una sesión anterior (al recargar la página o en otra pestaña):
  la UI abre la base sin pasar por `ingresar()`. En Sheets, el token se guarda en `localStorage` hasta que
  vence; las pestañas lo comparten y, si una reconecta, las demás toman el token nuevo en su próxima llamada.
- **Lectura:** `leer()` devuelve todos los `Datos` del dominio; lo que está en `faltantes` se lee vacío.
  Las filas traen IDs y no nombres: la UI los resuelve con `nombres(datos)` del dominio. Los IDs son para
  relacionar filas y la UI no los muestra: un pedido, una venta o un flete se nombra por cliente (o
  transportista) y fecha, "Ana · 10/10/26", con `etiquetas` de `base.ts`. En Sheets, si los
  encabezados de una hoja no son los que espera el adaptador, `leer()` lanza `FormatoDistinto` y no lee nada.
  Los cálculos (stock, resúmenes de pedidos, cuentas entre socios) los hace la UI con las funciones del
  dominio.
- **Operaciones:** una por caso de uso. **Cada una es atómica**: se guarda entera o no se guarda. En Sheets
  es un solo `batchUpdate` con un `appendCells` por hoja. Las correcciones (`corregirContacto`,
  `corregirProducto`, `corregirPedido`) y `borrarVenta` son una `Correccion` del adaptador: filas que se reemplazan en el lugar
  (`updateCells`), filas sin ID propio que se borran (`deleteDimension`, de abajo hacia arriba) y se vuelven a agregar
  al final, y filas nuevas, todo en un solo `batchUpdate`. El adaptador busca los IDs en la columna A justo antes de
  escribir (la hoja pudo ordenarse a mano desde la última lectura). Si un ID a reemplazar no está, o está en más de
  una fila, falla sin escribir.

| Operación | Datos | Hojas donde agrega filas (adaptador Sheets) |
|---|---|---|
| `registrarContacto` | `Contacto` | *Contactos*. |
| `corregirContacto` | `Contacto` | Reemplaza su fila en *Contactos*. |
| `registrarProducto` | `Producto`, `precio` (o `null`) | *Productos*, *Precios* (si hay precio). |
| `corregirProducto` | `Producto` | Reemplaza su fila en *Productos*. |
| `corregirPedido` | `CorreccionPedido` (`pedido`, `items`, `vendedores`, `preciosNuevos`, `entregas`; de `corregirPedido` del dominio) | Reemplaza su fila en *Pedidos* y las de sus entregas en *Ventas*; borra y vuelve a agregar sus filas de *Pedidos ítems*, *Pedidos vendedores*, *Ventas ítems* y *Ventas comisiones*; agrega *Precios* (productos nuevos sin precio de lista). |
| `registrarPedido` | `pedido`, `items`, `vendedores`, `momento`, `preciosNuevos`, `entrega`, `cobros` (opcional) | *Pedidos*, *Pedidos ítems*, *Pedidos estados* (`abierto`), *Pedidos vendedores*, *Precios* (productos sin precio de lista) y, en una venta directa, las de `registrarEntrega`. |
| `registrarEntrega` | `Entrega` (`venta`, `items`, `comisiones`, `envio`) y `cobros` (opcional) | *Ventas*, *Ventas ítems*, *Ventas comisiones* (si hay), *Ventas envíos* (si hay), *Cobros* (si hay). |
| `borrarVenta` | `ventaId` | Borra sus filas de *Ventas*, *Ventas ítems*, *Ventas comisiones*, *Ventas envíos* y *Cobros* (en *Cobros* el ID está en la columna B). Las hojas opcionales que no existen se saltean. |
| `cambiarEstadoPedido` | `pedidoId`, `cancelado` o `cerrado`, `momento` | *Pedidos estados*. |
| `registrarFlete` | `flete` (con la salida y la llegada previstas), `items`, `estados`, `momento`, `transporteNuevo` | *Contactos* (si el transporte es nuevo), *Fletes*, *Fletes ítems*, *Fletes estados* (uno por estado). No guarda pedidos: un flete lleva productos. |
| `cambiarEstadoFlete` | `fleteId`, estado, `momento` | *Fletes estados*. |
| `registrarCompra` | `lineas`, `productosNuevos`, `proveedorNuevo` | *Productos* (nuevos), *Contactos* (si el proveedor es nuevo), *Compras* (el importe lo calcula el adaptador). |
| `registrarAjuste` | `Ajuste` | *Ajustes*. |
| `registrarPrecio` | `Precio` | *Precios*. |
| `registrarReglaComision` | `ReglaComision` | *Reglas de comisión*. |
| `registrarReglaEnvio` | `ReglaEnvio` | *Envíos*. |
| `registrarCobro` | `Cobro` | *Cobros*. |
| `registrarRendicion` | `Rendicion` | *Rendiciones*. |
| `registrarReceta` | `receta` (una versión), `items` | *Recetas*, *Recetas ítems* (si hay). |
| `registrarFabricacion` | `ajustes` (de `armarFabricacion`) | *Ajustes* (uno negativo por insumo y uno positivo por el producto). |

Los IDs (`PE0003`, `V0004`, `C0012`…) los genera la UI con `siguienteId` del dominio a partir de los datos
leídos, así el mensaje de confirmación puede nombrarlos. El momento de los estados lo pasa la UI (`new Date()`).

## Ejemplo: venta directa

Ana (cliente nueva) pide 2 kg de Almendras a $3000 con el vendedor Leo (10%) y se le entrega en el momento.
La pantalla de Pedidos arma con el dominio el `Pedido` `PE0001`, su ítem y la entrega (`armarEntrega`
numera los ítems, calcula el importe de $6000 y la comisión de $600) y llama una sola vez a:

```ts
db.registrarPedido({ pedido, items, vendedores: ['VEN01'], momento, preciosNuevos: [], entrega })
```

El adaptador de Sheets lo traduce en un `batchUpdate` que agrega una fila en *Contactos*, *Pedidos*,
*Pedidos ítems*, *Pedidos estados*, *Pedidos vendedores*, *Ventas*, *Ventas ítems* y *Ventas comisiones*.
Si Google rechaza el pedido, no queda ninguna.

```mermaid
flowchart LR
  form["Pedidos.tsx<br/>formulario"] -->|"armarEntrega()"| dom["dominio"]
  form -->|"registrarPedido()"| puerto["puerto"]
  puerto --> ops["operaciones.ts<br/>escrituraPedido()"]
  ops -->|"Escritura: filas por hoja"| g["google.ts<br/>escribir()"]
  g -->|"1 batchUpdate"| s[("Google Sheets")]
```

## Pruebas por capa

| Capa | Prueba |
|---|---|
| Dominio | `src/dominio/modelo.test.ts`, `src/dominio/analisis.test.ts`, `src/dominio/mapa.test.ts` y `src/dominio/fichas.test.ts` (Vitest), con objetos del dominio. |
| Mapa | `src/mapa/ubicar.test.ts` (Vitest): ubicar localidades y armar sitios y tramos. |
| Adaptador Sheets | `src/db/sheets/*.test.ts` (Vitest): lectura de filas (`hojas.test.ts`), celdas y fechas (`celdas.test.ts`) y las filas exactas que agrega cada operación (`operaciones.test.ts`), sobre la planilla en memoria de `memoria.ts`, que usa las mismas hojas, columnas y lectura que el adaptador real. |
| Todo junto | `tests/` (Playwright): la app compilada contra Google simulado (`tests/google-falso.ts`), verificando las filas que llegan a cada `batchUpdate`. |

## Por qué carpetas y no un paquete

Se evaluó mover la base a un paquete de un workspace pnpm (`packages/db`). Para este repo (una sola app,
sin otros consumidores) agrega un `package.json`, un `tsconfig` y referencias de compilación más, y cambios en
el lockfile, sin dar un límite más fuerte: desde la app se podría seguir importando cualquier archivo del
paquete por ruta relativa, y haría falta ESLint igual. Las carpetas con reglas de ESLint dan el mismo límite
con menos piezas. `src/db/` tiene una sola entrada por adaptador (`sheets/index.ts`) y un puerto sin
dependencias fuera del dominio, así que pasarla a un paquete más adelante es mover carpetas.
