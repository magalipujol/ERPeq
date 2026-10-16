// Acceso a Google: login con Google Identity Services y Sheets API.
// El token vive solo en memoria y dura ~1 hora. El permiso pedido es "spreadsheets" (ver y editar las
// hojas de cálculo del usuario); la app solo usa la planilla configurada, y Google solo la deja abrir
// si está compartida con esa cuenta.
import type { Config } from './config';
import type { Fila, ValorCelda } from './modelo';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

interface Pendiente {
  resolve: (resp: google.accounts.oauth2.TokenResponse) => void;
  reject: (err: google.accounts.oauth2.ClientConfigError) => void;
}

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let token: string | null = null;
let vence = 0;
let pendiente: Pendiente | null = null;
let alVencer: () => void = () => undefined;
let cfg: Config;

export class SesionVencida extends Error {
  constructor() { super('La sesión de Google venció. Tocá "Reconectar".'); }
}
export class SinAcceso extends Error {
  constructor() { super('Esta cuenta no tiene acceso a la planilla de ERPeq.'); }
}

export interface InfoPlanilla {
  properties: { title: string };
  spreadsheetUrl: string;
  sheets: { properties: { sheetId: number; title: string } }[];
}

async function esperar(cond: () => boolean, ms: number, error: string) {
  return new Promise<void>((resolve, reject) => {
    const limite = Date.now() + ms;
    (function chequear() {
      if (cond()) resolve();
      else if (Date.now() > limite) reject(new Error(error));
      else setTimeout(chequear, 50);
    })();
  });
}

export async function init(config: Config, { onSesionVencida }: { onSesionVencida: () => void }) {
  cfg = config;
  alVencer = onSesionVencida;
  // Los tipos de GIS declaran `google` siempre presente, pero no existe hasta que carga el script.
  await esperar(() => 'google' in window, 10000,
    'No se pudo cargar el login de Google. Revisá la conexión o algún bloqueador.');
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: cfg.CLIENT_ID,
    scope: SCOPE,
    callback: (resp) => pendiente?.resolve(resp),
    error_callback: (err) => pendiente?.reject(err),
  });
}

// Abre la ventana de Google. Tiene que llamarse desde un click para que el navegador no la bloquee.
export async function login() {
  return new Promise<void>((resolve, reject) => {
    pendiente = {
      resolve: (resp) => {
        if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
        if (!google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) {
          reject(new Error('No se otorgó el permiso para que la app acceda a la planilla.')); return;
        }
        token = resp.access_token;
        vence = Date.now() + (Number(resp.expires_in) - 60) * 1000;
        resolve();
      },
      reject: (err) => { reject(new Error(err.type === 'popup_closed' ? 'Se cerró la ventana de Google.' : (err.message || 'No se pudo ingresar.'))); },
    };
    if (!tokenClient) {
      reject(new Error('El login de Google todavía no está listo.'));
      return;
    }
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// Revoca el permiso: la próxima vez Google vuelve a pedir autorización.
export async function logout() {
  return new Promise<void>((resolve) => {
    if (!token) { resolve(); return; }
    google.accounts.oauth2.revoke(token, () => { resolve(); });
    token = null;
  });
}

interface ErrorGoogle { error?: { message?: string } }

async function req<T>(url: string, opts: RequestInit = {}): Promise<T> {
  if (!token || Date.now() > vence) {
    token = null;
    alVencer();
    throw new SesionVencida();
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (opts.body !== undefined && opts.body !== null) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    token = null;
    alVencer();
    throw new SesionVencida();
  }
  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  const mensaje = (data as ErrorGoogle | null)?.error?.message ?? `Error ${res.status} de Google`;
  // 403/404 suele ser "la planilla no está compartida con esta cuenta"; una API
  // deshabilitada en el proyecto también da 403, pero eso es un error de configuración.
  if (res.status === 404 || (res.status === 403 && !/has not been used|is disabled|API key/i.test(mensaje))) {
    throw new SinAcceso();
  }
  if (!res.ok) throw new Error(mensaje);
  return data as T;
}

const enc = encodeURIComponent;
const url = (path = '') => `${SHEETS}/${cfg.SPREADSHEET_ID}${path}`;

// Sheets guarda las fechas como días desde 30/12/1899.
export const deSerie = (s: number) => {
  const ms = (s - 25569) * 86400000;
  return new Date(ms + new Date(ms).getTimezoneOffset() * 60000);
};

export async function leer(rangos: string[]) {
  const qs = rangos.map((r) => `ranges=${enc(r)}`).join('&');
  const data = await req<{ valueRanges: { values?: Fila[] }[] }>(
    url(`/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`));
  return data.valueRanges.map((v) => v.values ?? []);
}

export async function info() {
  return req<InfoPlanilla>(url(`?fields=${enc('properties.title,spreadsheetUrl,sheets.properties(sheetId,title)')}`));
}

// Los textos se guardan con apóstrofe adelante: Sheets los toma siempre como texto
// (nunca como fórmula ni fecha). Las fechas van como "aaaa-mm-dd" y los números como números.
function celda(v: ValorCelda) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return v;
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return `'${v}`;
}

export async function agregarFilas(hoja: string, filas: ValorCelda[][]) {
  const res = await req<{ updates: { updatedRange: string } }>(
    url(`/values/${enc(`'${hoja}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`), {
      method: 'POST',
      body: JSON.stringify({ values: filas.map((f) => f.map(celda)) }),
    });
  return res.updates;
}

// Copia las fórmulas de stock de la primera fila de Productos a las filas nuevas.
export async function extenderFormulasProductos(sheetId: number, desdeFila: number, cantidad: number, colInicio: number, colFin: number) {
  await req(url(':batchUpdate'), {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        copyPaste: {
          source: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: colInicio, endColumnIndex: colFin },
          destination: { sheetId, startRowIndex: desdeFila, endRowIndex: desdeFila + cantidad, startColumnIndex: colInicio, endColumnIndex: colFin },
          pasteType: 'PASTE_FORMULA',
        },
      }],
    }),
  });
}
