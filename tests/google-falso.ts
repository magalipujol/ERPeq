// Reemplaza a Google en las pruebas: el script de login (GIS) y la Sheets API.
// La planilla vive en memoria y cada escritura queda registrada para poder revisarla.
import { test as base, type Page, type Route } from '@playwright/test'
import { CONFIG } from '../src/config'

// Fecha "de hoy" en todas las pruebas.
export const HOY = new Date('2026-10-16T12:00:00-03:00')

// Sheets guarda las fechas como días desde 30/12/1899.
const fecha = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return (Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000
}

type Fila = (string | number)[]

export function planillaInicial(): Record<string, Fila[]> {
  return {
    'Productos': [
      ['P001', 'Almendras', 'kg', ''],
      ['P002', 'Avena', 'kg', 50],
      ['P003', 'Miel', 'unid.', ''],
    ],
    'Compras': [
      [fecha('2026-09-10'), 'General', 'Prov A', 'P001', 'Almendras', 10, 2000, 20000, '', ''],
      [fecha('2026-10-02'), 'General', 'Prov A', 'P001', 'Almendras', 10, 1000, 10000, 'R-1', ''],
      [fecha('2026-10-03'), 'Rosario', 'Prov B', 'P002', 'Avena', 30, 500, 15000, '', ''],
    ],
    'Ventas': [
      [fecha('2026-10-05'), 'General', 'Ana', 'Minorista', 'Funes', 'Santa Fe', 'P001', 'Almendras', 4, 3000, 12000, 0, 1500, 6000, 'Leo', ''],
    ],
    'Ajustes': [
      [fecha('2026-10-06'), 'Rosario', 'P002', 'Avena', -5, 'rotura'],
    ],
    'Tipos de cliente': [
      ['Minorista', 0],
      ['Revendedor', 10],
    ],
  }
}

export interface Escritura { tipo: 'append' | 'batchUpdate'; hoja?: string; body: any }

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

// Lo que hace Sheets con valueInputOption=USER_ENTERED: "'texto" queda como texto y "aaaa-mm-dd" como fecha.
const comoLoGuardaSheets = (v: string | number) =>
  (typeof v !== 'string' ? v : v.startsWith("'") ? v.slice(1) : /^\d{4}-\d{2}-\d{2}$/.test(v) ? fecha(v) : v)

const hojaDeRango = (rango: string) => rango.match(/^'(.+)'!/)![1]

export async function instalarGoogleFalso(page: Page): Promise<GoogleFalso> {
  const hojas = planillaInicial()
  const escrituras: Escritura[] = []
  let falla: { status: number; veces: number } | null = null

  await page.clock.setFixedTime(HOY)
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
  await page.route('https://accounts.google.com/gsi/client', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: GIS }))

  await page.route('https://sheets.googleapis.com/**', async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const ruta = decodeURIComponent(url.pathname).replace(`/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}`, '')
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

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
        valueRanges: url.searchParams.getAll('ranges').map((r) => ({ range: r, values: hojas[hojaDeRango(r)] })),
      })
    }
    const append = ruta.match(/^\/values\/(.+):append$/)
    if (append && req.method() === 'POST') {
      const hoja = hojaDeRango(append[1])
      const body = req.postDataJSON()
      escrituras.push({ tipo: 'append', hoja, body })
      const desde = hojas[hoja].length + 2
      hojas[hoja].push(...body.values.map((f: Fila) => f.map(comoLoGuardaSheets)))
      const hasta = hojas[hoja].length + 1
      return json({ updates: { updatedRange: `'${hoja}'!A${desde}:Z${hasta}` } })
    }
    if (ruta === ':batchUpdate' && req.method() === 'POST') {
      escrituras.push({ tipo: 'batchUpdate', body: req.postDataJSON() })
      return json({ replies: [{}] })
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
