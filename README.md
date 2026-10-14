# ERPeq

Gestión de stock, ventas y compras para una dietética, con Google Sheets como base de datos.
Es una página estática (sin servidor) que se publica en GitHub Pages.

## Cómo funciona

- Cada usuario entra con su cuenta de Google (Google Identity Services). El token dura una hora y vive solo en memoria.
- La app pide el permiso `spreadsheets` y trabaja solo sobre la planilla configurada, que tiene que estar compartida
  con la cuenta del usuario. El proyecto queda en modo Prueba: solo entran los usuarios de prueba cargados.
- Lee y escribe directo con la Sheets API desde el navegador. Las escrituras son siempre filas nuevas (append):
  el stock y el costo se calculan a partir de los movimientos.

## Estructura de la planilla

| Hoja | Contenido |
|---|---|
| Productos | ID, nombre, unidad, stock mínimo. Las columnas *Stock General* / *Stock Rosario* son fórmulas. |
| Compras | Una fila por producto comprado (suma stock al depósito). |
| Ventas | Una fila por producto vendido (resta stock). Guarda el costo promedio al momento de la venta y la ganancia. |
| Ajustes | Correcciones de stock (+/−) con motivo. |
| Tipos de cliente | Comisión % por defecto de cada tipo. Editable. |
| Fletes, Contactos | Datos importados del Excel (todavía sin pantalla en la app). |

**Stock** = compras − ventas + ajustes, por depósito.
**Costo promedio** = promedio ponderado de todas las compras con precio del producto.
**Ganancia** = importe − comisión − cantidad × costo promedio.

## Archivos

- `docs/`: la app (lo que publica GitHub Pages, carpeta `/docs`).
  - `config.js`: Client ID de Google y ID de la planilla.
  - `modelo.js`: lectura/escritura de filas y cálculos (sin dependencias del navegador).
  - `google.js`: login y Sheets API.
  - `app.js`: la interfaz.
- `herramientas/excel_a_base.py`: convierte el Excel histórico en la planilla inicial.
- `GUIA-CONFIGURACION.md`: paso a paso para configurar Google y la planilla.

## Generar la base desde el Excel

```sh
pip install openpyxl
py herramientas/excel_a_base.py "ROSARIO ACTUALIZADO.xlsm" "ERPeq-base.xlsx"
```

Muestra un resumen con los productos con stock negativo y los datos a revisar.
**El `.xlsx` generado tiene datos personales: no lo subas al repo** (`.gitignore` ya lo excluye).

## Probar en la compu

```sh
npx http-server docs -p 5500 -c-1
```

y abrir http://localhost:5500 (tiene que estar autorizado como origen en el proyecto de Google).
