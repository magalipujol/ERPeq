// Reemplaza a Google en las pruebas: el script de login (GIS) y la Sheets API.
// La planilla vive en memoria y cada escritura queda registrada para poder revisarla.
import { test as base, expect, type Locator, type Page, type Route } from '@playwright/test'
import { CONFIG } from '../src/config'

// Fecha "de hoy" en todas las pruebas.
export const HOY = new Date('2026-10-16T12:00:00-03:00')

// Sheets guarda las fechas como días desde 30/12/1899.
export const serie = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return (Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000
}
// Fecha y hora con que la app guarda los estados (la hora fija de las pruebas, 12:00).
export const AHORA = serie('2026-10-16') + 0.5
export const HOY_SERIE = serie('2026-10-16')

type Fila = (string | number | boolean)[]

// Fila 1 de cada hoja, como en la planilla real.
export const ENCABEZADOS: Record<string, string[]> = {
  'Depósitos': ['id', 'nombre', 'localidad'],
  'Productos': ['id', 'producto', 'unidad', 'minimo'],
  'Contactos': ['id', 'rol', 'nombre', 'tipo_cliente', 'telefono', 'direccion', 'email', 'localidad', 'provincia', 'observaciones'],
  'Tipos de cliente': ['tipo'],
  'Vendedores': ['id', 'nombre', 'activo', 'localidad'],
  'Precios': ['producto_id', 'precio', 'desde'],
  'Reglas de comisión': ['vendedor_id', 'producto_id', 'porcentaje', 'desde'],
  'Compras': ['fecha', 'deposito_id', 'contacto_id', 'producto_id', 'cantidad', 'precio', 'importe', 'remito', 'pedido_id', 'nota'],
  'Pedidos': ['id', 'fecha', 'contacto_id', 'deposito_id', 'nota'],
  'Pedidos ítems': ['pedido_id', 'linea', 'producto_id', 'cantidad', 'precio_lista', 'precio'],
  'Pedidos estados': ['pedido_id', 'fecha', 'estado'],
  'Pedidos vendedores': ['pedido_id', 'vendedor_id'],
  'Ventas': ['id', 'fecha', 'pedido_id', 'deposito_id', 'nota'],
  'Ventas ítems': ['venta_id', 'linea', 'pedido_linea', 'producto_id', 'cantidad', 'precio', 'importe', 'costo'],
  'Ventas comisiones': ['venta_id', 'linea', 'vendedor_id', 'porcentaje_regla', 'porcentaje', 'monto'],
  'Fletes': ['id', 'fecha', 'contacto_id', 'origen_id', 'destino_id', 'costo', 'guia', 'nota'],
  'Fletes ítems': ['flete_id', 'producto_id', 'cantidad'],
  'Fletes estados': ['flete_id', 'fecha', 'estado'],
  'Pedidos fletes': ['pedido_id', 'flete_id', 'costo_asignado'],
  'Ajustes': ['fecha', 'deposito_id', 'producto_id', 'cantidad', 'motivo'],
  'Socios': ['id', 'nombre', 'vendedor_id', 'rol'],
  'Cobros': ['fecha', 'venta_id', 'importe', 'medio', 'socio_id', 'nota'],
  'Rendiciones': ['fecha', 'de_socio_id', 'a_socio_id', 'importe', 'medio', 'nota'],
  'Recetas': ['id', 'version', 'desde', 'producto_id', 'cantidad', 'activa'],
  'Recetas ítems': ['receta_id', 'version', 'producto_id', 'cantidad'],
  'Envíos': ['minimo', 'costo', 'desde'],
  'Ventas envíos': ['venta_id', 'vendedor_id', 'costo_regla', 'costo'],
}

// Filas de datos de cada hoja (sin el encabezado).
export function planillaInicial(): Record<string, Fila[]> {
  return {
    'Depósitos': [['BB', 'General', 'Bahía Blanca'], ['ROS', 'Rosario', 'Rosario']],
    'Productos': [
      ['P001', 'Almendras', 'kg', ''],
      ['P002', 'Avena', 'kg', 50],
      ['P003', 'Miel', 'unid.', ''],
      ['P004', 'Mix europeo', 'kg', ''],
    ],
    'Contactos': [
      ['C0001', 'cliente', 'Ana', 'Minorista', '', '', '', 'Funes', 'Santa Fe', ''],
      ['C0002', 'proveedor', 'Prov A', '', '', '', '', '', '', ''],
      ['C0003', 'proveedor', 'Prov B', '', '', '', '', '', '', ''],
      ['C0004', 'transporte', 'Interprovincial', '', '', '', '', '', '', ''],
    ],
    'Tipos de cliente': [['Minorista'], ['Revendedor']],
    'Vendedores': [['VEN01', 'Leo', 'sí', 'Bahía Blanca'], ['VEN02', 'Guada/Hernán', 'sí', 'Rosario']],
    'Precios': [
      ['P001', 3000, serie('2026-01-01')],
      ['P002', 800, serie('2026-01-01')],
      ['P004', 2500, serie('2026-01-01')],
    ],
    'Reglas de comisión': [
      ['VEN01', '', 10, serie('2026-01-01')],
      ['VEN02', '', 3, serie('2026-01-01')],
      ['VEN02', 'P001', 7, serie('2026-01-01')],
    ],
    'Compras': [
      [serie('2026-09-10'), 'BB', 'C0002', 'P001', 10, 2000, 20000, '', '', ''],
      [serie('2026-10-02'), 'BB', 'C0002', 'P001', 10, 1000, 10000, 'R-1', '', ''],
      [serie('2026-10-03'), 'ROS', 'C0003', 'P002', 30, 500, 15000, '', '', ''],
    ],
    'Pedidos': [
      ['PE0001', serie('2026-10-05'), 'C0001', 'BB', ''],
      ['PE0002', serie('2026-10-10'), 'C0001', 'ROS', ''],
    ],
    'Pedidos ítems': [
      ['PE0001', 1, 'P001', 4, 3000, 3000],
      ['PE0002', 1, 'P002', 10, 800, 800],
    ],
    'Pedidos estados': [['PE0001', serie('2026-10-05'), 'abierto'], ['PE0002', serie('2026-10-10'), 'abierto']],
    'Pedidos vendedores': [['PE0001', 'VEN01'], ['PE0002', 'VEN02']],
    'Ventas': [['V0001', serie('2026-10-05'), 'PE0001', 'BB', '']],
    'Ventas ítems': [['V0001', 1, 1, 'P001', 4, 3000, 12000, 1500]],
    'Ventas comisiones': [['V0001', 1, 'VEN01', 10, 10, 1200]],
    'Fletes': [['F0001', serie('2026-10-08'), 'C0004', 'BB', 'ROS', 5000, '', '']],
    'Fletes ítems': [['F0001', 'P001', 6]],
    'Fletes estados': [['F0001', serie('2026-10-08'), 'preparacion'], ['F0001', serie('2026-10-08'), 'camino']],
    'Pedidos fletes': [],
    'Ajustes': [
      [serie('2026-10-06'), 'ROS', 'P002', -5, 'rotura'],
    ],
    // Sampatti es la empresa de Leo y la dueña de la mercadería.
    'Socios': [['SOC01', 'Sampatti', 'VEN01', 'dueño'], ['SOC02', 'Guada/Hernán', 'VEN02', 'socio']],
    'Cobros': [],
    'Rendiciones': [],
    'Recetas': [],
    'Recetas ítems': [],
    'Envíos': [],
    'Ventas envíos': [],
  }
}

// Filas agregadas por hoja en un mismo batchUpdate (una operación de la app).
export type Escritura = Record<string, Fila[]>

export interface GoogleFalso {
  hojas: Record<string, Fila[]>
  escrituras: Escritura[]
  // Respuesta forzada para la próxima petición a la Sheets API (403, 401, ...).
  fallarProxima: (status: number, veces?: number) => void
}

// Script que ocupa el lugar de https://accounts.google.com/gsi/client.
const GIS = `
window.google = { accounts: { oauth2: {
  initTokenClient(cfg) {
    return { requestAccessToken() { setTimeout(() => cfg.callback({ access_token: 'token-falso', expires_in: 3599 })); } };
  },
  hasGrantedAllScopes() { return true; },
  revoke(_t, cb) { cb && cb(); },
} } };`

interface Celda { userEnteredValue?: { stringValue?: string; numberValue?: number; boolValue?: boolean } }
interface AppendCells { appendCells: { sheetId: number; rows: { values: Celda[] }[] } }

const valor = (c: Celda) => c.userEnteredValue?.stringValue ?? c.userEnteredValue?.numberValue ?? c.userEnteredValue?.boolValue ?? ''

const hojaDeRango = (rango: string) => {
  const m = /^'(.+)'!/.exec(rango)
  if (!m) throw new Error(`rango sin hoja: ${rango}`)
  return m[1]
}

export async function instalarGoogleFalso(page: Page): Promise<GoogleFalso> {
  const hojas = planillaInicial()
  const escrituras: Escritura[] = []
  let falla: { status: number; veces: number } | null = null

  await page.clock.setFixedTime(HOY)
  await page.route('https://accounts.google.com/gsi/client', async (r) =>
    r.fulfill({ contentType: 'application/javascript', body: GIS }))

  await page.route('https://sheets.googleapis.com/**', async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const ruta = decodeURIComponent(url.pathname).replace(`/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}`, '')
    const json = async (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (req.headers().authorization !== 'Bearer token-falso') return json({ error: { message: 'sin token' } }, 401)
    if (falla) {
      const { status } = falla
      if (--falla.veces <= 0) falla = null
      return json({ error: { message: `falla forzada ${status}` } }, status)
    }

    if (ruta === '' && req.method() === 'GET') {
      return json({
        properties: { title: 'ERPeq - Pruebas' },
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/prueba/edit',
        sheets: Object.keys(hojas).map((title, i) => ({ properties: { sheetId: 100 + i, title } })),
      })
    }
    if (ruta === '/values:batchGet') {
      return json({
        valueRanges: url.searchParams.getAll('ranges').map((r) => {
          const hoja = hojaDeRango(r)
          return { range: r, values: [ENCABEZADOS[hoja], ...hojas[hoja]] }
        }),
      })
    }
    if (ruta === ':batchUpdate' && req.method() === 'POST') {
      const { requests } = req.postDataJSON() as { requests: AppendCells[] }
      const titulos = Object.keys(hojas)
      const escritura: Escritura = {}
      for (const { appendCells } of requests) {
        const hoja = titulos[appendCells.sheetId - 100]
        const filas = appendCells.rows.map((r) => r.values.map(valor))
        escritura[hoja] = [...(escritura[hoja] ?? []), ...filas]
        hojas[hoja].push(...filas)
      }
      escrituras.push(escritura)
      return json({ replies: requests.map(() => ({})) })
    }
    return json({ error: { message: `ruta no simulada: ${req.method()} ${ruta}` } }, 500)
  })

  return {
    hojas,
    escrituras,
    fallarProxima: (status, veces = 1) => { falla = { status, veces } },
  }
}

export const test = base.extend<{ google: GoogleFalso; ingresar: () => Promise<void> }>({
  google: async ({ page }, use) => use(await instalarGoogleFalso(page)),
  // Depende de `google` para que el login falso esté instalado antes de usarlo.
  ingresar: async ({ page, google: _google }, use) => {
    await use(async () => {
      await page.getByRole('button', { name: 'Ingresar con Google' }).click()
      await page.getByText(/^Sincronizado/).waitFor()
    })
  },
})

export { expect } from '@playwright/test'

export type Pantalla = 'Inicio' | 'Stock' | 'Pedidos' | 'Ventas' | 'Compras' | 'Recetas' | 'Fletes' | 'Precios' | 'Caja' | 'Análisis'

// En celular, estas pantallas están en el menú «Más» de la barra inferior.
const EN_MAS: readonly Pantalla[] = ['Compras', 'Recetas', 'Fletes', 'Precios', 'Caja', 'Análisis']

// Menos de 768 px: el breakpoint `sm` de Mantine.
export const esCelular = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

// Cambia de pantalla con el selector del header (escritorio) o la barra inferior (celular): el que esté visible.
export const ir = async (page: Page, pantalla: Pantalla) => {
  const nav = page.getByLabel('Pantalla', { exact: true }).filter({ visible: true })
  if (esCelular(page) && EN_MAS.includes(pantalla)) {
    await nav.getByRole('button', { name: 'Más' }).click()
    return page.getByRole('menuitem', { name: pantalla, exact: true }).click()
  }
  return nav.getByText(pantalla, { exact: true }).click()
}

// Stock: en escritorio son tablas y en celular, tarjetas. Estas funciones encuentran lo mismo en los dos.

// El grupo de un depósito en «Stock por depósito»: un grupo de filas de la tabla o una sección de tarjetas.
export const grupoStock = (page: Page, deposito: string) => esCelular(page)
  ? page.getByRole('region', { name: 'Stock por depósito' }).getByRole('region', { name: deposito })
  : page.getByRole('table', { name: 'Stock por depósito' }).getByRole('rowgroup', { name: deposito })

// Los productos de un grupo de «Stock por depósito» (sin el encabezado del grupo).
export const productosEn = (page: Page, deposito: string) => esCelular(page)
  ? grupoStock(page, deposito).getByRole('article')
  : grupoStock(page, deposito).getByRole('row').filter({ has: page.getByRole('cell') })

// Un producto en el grupo de un depósito.
export const stockEn = (page: Page, deposito: string, producto: string) => esCelular(page)
  ? grupoStock(page, deposito).getByRole('article', { name: producto, exact: true })
  : productosEn(page, deposito).filter({ has: page.getByRole('cell', { name: producto, exact: true }) })

// Los productos de «Stock total».
export const productosTotal = (page: Page) => esCelular(page)
  ? page.getByRole('region', { name: 'Stock total' }).getByRole('article')
  : page.getByRole('table', { name: 'Stock total' }).getByRole('row').filter({ has: page.getByRole('cell') })

// Un producto de «Stock total».
export const stockTotal = (page: Page, producto: string) => esCelular(page)
  ? page.getByRole('region', { name: 'Stock total' }).getByRole('article', { name: producto, exact: true })
  : productosTotal(page).filter({ has: page.getByRole('cell', { name: producto, exact: true }) })

// Columna de cada dato en las tablas de stock: Producto, Unidad, En depósito, En camino, Comprometido y
// Producto, Unidad, En depósitos, En camino, Total, Mínimo, Estado.
const COLUMNA_STOCK = { 'En depósito': 2, 'En depósitos': 2, 'En camino': 3, 'Comprometido': 4, 'Total': 4, 'Mínimo': 5 }

// Los datos de un producto de stock: la celda de su columna o el valor con esa etiqueta en la tarjeta.
export async function esperarDatosStock(page: Page, fila: Locator, datos: Partial<Record<keyof typeof COLUMNA_STOCK, string>>) {
  for (const [dato, esperado] of Object.entries(datos) as [keyof typeof COLUMNA_STOCK, string][]) {
    const celda = esCelular(page)
      ? fila.getByRole('group', { name: dato, exact: true }).getByRole('paragraph').last()
      : fila.getByRole('cell').nth(COLUMNA_STOCK[dato])
    await expect(celda).toHaveText(esperado)
  }
}

// Ordena una lista de stock: con el encabezado de la columna (escritorio, `clics` veces) o con el selector
// «Ordenar» de la lista (celular).
export async function ordenarStock(page: Page, lista: 'Stock por depósito' | 'Stock total', columna: string, clics: number, opcion: string) {
  if (esCelular(page)) {
    await page.getByRole('combobox', { name: 'Ordenar' }).nth(lista === 'Stock total' ? 1 : 0).selectOption({ label: opcion })
    return
  }
  const boton = page.getByRole('table', { name: lista }).getByRole('button', { name: columna, exact: true })
  for (let i = 0; i < clics; i++) await boton.click()
}
