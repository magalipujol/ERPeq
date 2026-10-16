// Acceso a Google: login con Google Identity Services y Sheets API.
// El token vive solo en memoria y dura ~1 hora. El permiso pedido es "spreadsheets" (ver y editar las
// hojas de cálculo del usuario); la app solo usa la planilla configurada, y Google solo la deja abrir
// si está compartida con esa cuenta.
import type { Config } from './config';
import { type ClaveHoja, type Escritura, type Fila, nombreHoja, type ValorCelda } from './modelo';

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

// Fecha local → número de serie de Sheets (días desde 30/12/1899, con la hora como fracción).
export const aSerie = (d: Date) =>
  (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - Date.UTC(1899, 11, 30)) / 86400000;

interface DatoCelda {
  userEnteredValue?: { stringValue?: string; numberValue?: number; boolValue?: boolean };
  userEnteredFormat?: { numberFormat: { type: 'DATE' | 'DATE_TIME'; pattern: string } };
}

// Con appendCells los textos quedan siempre como texto (nunca fórmula ni fecha), así que no hace falta
// el apóstrofe adelante.
export function celda(v: ValorCelda): DatoCelda {
  if (v === null || v === undefined || v === '') return {};
  if (typeof v === 'number') return { userEnteredValue: { numberValue: v } };
  if (typeof v === 'boolean') return { userEnteredValue: { boolValue: v } };
  if (typeof v === 'string') return { userEnteredValue: { stringValue: v } };
  if (v instanceof Date) {
    return {
      userEnteredValue: { numberValue: Math.floor(aSerie(v)) },
      userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } },
    };
  }
  return {
    userEnteredValue: { numberValue: aSerie(v.momento) },
    userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'dd/mm/yyyy hh:mm' } },
  };
}

// Agrega filas al final de varias hojas en un solo batchUpdate: Google aplica todo o nada, así una
// operación (por ejemplo, un pedido con sus ítems) nunca queda a medias.
export async function escribir(planilla: InfoPlanilla, escritura: Escritura) {
  const requests = (Object.entries(escritura) as [ClaveHoja, ValorCelda[][]][])
    .filter(([, filas]) => filas.length > 0)
    .map(([clave, filas]) => {
      const titulo = nombreHoja(clave);
      const hoja = planilla.sheets.find((s) => s.properties.title === titulo);
      if (!hoja) throw new Error(`Falta la hoja "${titulo}" en la planilla.`);
      return {
        appendCells: {
          sheetId: hoja.properties.sheetId,
          rows: filas.map((f) => ({ values: f.map(celda) })),
          fields: 'userEnteredValue,userEnteredFormat.numberFormat',
        },
      };
    });
  if (requests.length === 0) return;
  await req(url(':batchUpdate'), { method: 'POST', body: JSON.stringify({ requests }) });
}
