// Acceso a Google: login con Google Identity Services, selector de archivos (Picker) y Sheets API.
// El token vive solo en memoria y dura ~1 hora. El permiso pedido es drive.file: la app solo puede
// tocar la planilla que cada usuario eligió una vez en el selector, no el resto de su Drive.
window.GoogleDB = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

  let tokenClient = null;
  let token = null;
  let vence = 0;
  let pendiente = null;
  let alVencer = () => {};
  let cfg = null;

  class SesionVencida extends Error {
    constructor() { super('La sesión de Google venció. Tocá "Reconectar".'); }
  }
  class SinAcceso extends Error {
    constructor() { super('Todavía no conectaste la planilla con ERPeq.'); }
  }

  function esperar(cond, ms, error) {
    return new Promise((resolve, reject) => {
      const limite = Date.now() + ms;
      (function chequear() {
        if (cond()) resolve();
        else if (Date.now() > limite) reject(new Error(error));
        else setTimeout(chequear, 50);
      })();
    });
  }

  async function init(config, { onSesionVencida }) {
    cfg = config;
    alVencer = onSesionVencida;
    await esperar(() => window.google?.accounts?.oauth2, 10000,
      'No se pudo cargar el login de Google. Revisá la conexión o algún bloqueador.');
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cfg.CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => pendiente?.resolve(resp),
      error_callback: (err) => pendiente?.reject(err),
    });
  }

  // Abre la ventana de Google. Tiene que llamarse desde un click para que el navegador no la bloquee.
  function login() {
    return new Promise((resolve, reject) => {
      pendiente = {
        resolve: (resp) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          if (!google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) {
            return reject(new Error('No se otorgó el permiso para que la app acceda a la planilla.'));
          }
          token = resp.access_token;
          vence = Date.now() + (Number(resp.expires_in) - 60) * 1000;
          resolve();
        },
        reject: (err) => reject(new Error(err?.type === 'popup_closed' ? 'Se cerró la ventana de Google.' : (err?.message || 'No se pudo ingresar.'))),
      };
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  // Revoca el permiso: la próxima vez Google vuelve a pedir autorización.
  function logout() {
    return new Promise((resolve) => {
      if (!token) return resolve();
      google.accounts.oauth2.revoke(token, () => resolve());
      token = null;
    });
  }

  async function req(url, opts = {}) {
    if (!token || Date.now() > vence) {
      token = null;
      alVencer();
      throw new SesionVencida();
    }
    const headers = { Authorization: `Bearer ${token}` };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) {
      token = null;
      alVencer();
      throw new SesionVencida();
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    const mensaje = data?.error?.message || `Error ${res.status} de Google`;
    // 403/404 suele ser "este usuario no le dio acceso a la app a la planilla"; una API
    // deshabilitada en el proyecto también da 403, pero eso es un error de configuración.
    if (res.status === 404 || (res.status === 403 && !/has not been used|is disabled|API key/i.test(mensaje))) {
      throw new SinAcceso();
    }
    if (!res.ok) throw new Error(mensaje);
    return data;
  }

  // Selector de Google mostrando solo la planilla configurada. Al elegirla, la app gana acceso a ese archivo.
  async function conectarPlanilla() {
    if (!window.gapi) throw new Error('No se pudo cargar el selector de Google.');
    await new Promise((resolve, reject) => gapi.load('picker', { callback: resolve, onerror: reject }));
    return new Promise((resolve, reject) => {
      const vista = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        .setFileIds(cfg.SPREADSHEET_ID)
        .setMode(google.picker.DocsViewMode.LIST);
      new google.picker.PickerBuilder()
        .setAppId(cfg.APP_ID)
        .setOAuthToken(token)
        .setDeveloperKey(cfg.API_KEY)
        .setLocale('es')
        .setOrigin(location.origin)
        .setTitle('Elegí la planilla de ERPeq')
        .addView(vista)
        .setCallback((data) => {
          console.info('[ERPeq] selector:', data.action);
          if (data.action === google.picker.Action.PICKED) {
            const elegido = data.docs?.[0]?.id;
            if (elegido === cfg.SPREADSHEET_ID) resolve();
            else reject(new Error('Esa no es la planilla configurada para ERPeq.'));
          } else if (data.action === google.picker.Action.CANCEL) {
            reject(new Error('No se eligió la planilla.'));
          }
        })
        .build()
        .setVisible(true);
    });
  }

  const enc = encodeURIComponent;
  const url = (path = '') => `${SHEETS}/${cfg.SPREADSHEET_ID}${path}`;

  // Sheets guarda las fechas como días desde 30/12/1899.
  const deSerie = (s) => {
    const ms = (s - 25569) * 86400000;
    return new Date(ms + new Date(ms).getTimezoneOffset() * 60000);
  };

  async function leer(rangos) {
    const qs = rangos.map((r) => `ranges=${enc(r)}`).join('&');
    const data = await req(url(`/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`));
    return data.valueRanges.map((v) => v.values || []);
  }

  async function info() {
    return req(url(`?fields=${enc('properties.title,spreadsheetUrl,sheets.properties(sheetId,title)')}`));
  }

  // Los textos se guardan con apóstrofe adelante: Sheets los toma siempre como texto
  // (nunca como fórmula ni fecha). Las fechas van como "aaaa-mm-dd" y los números como números.
  function celda(v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') return v;
    if (v instanceof Date) {
      const p = (n) => String(n).padStart(2, '0');
      return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    }
    return `'${String(v)}`;
  }

  async function agregarFilas(hoja, filas) {
    const res = await req(url(`/values/${enc(`'${hoja}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`), {
      method: 'POST',
      body: JSON.stringify({ values: filas.map((f) => f.map(celda)) }),
    });
    return res.updates;
  }

  // Copia las fórmulas de stock de la primera fila de Productos a las filas nuevas.
  async function extenderFormulasProductos(sheetId, desdeFila, cantidad, colInicio, colFin) {
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

  return { init, login, logout, conectarPlanilla, leer, info, agregarFilas, extenderFormulasProductos, deSerie, SesionVencida, SinAcceso };
})();
