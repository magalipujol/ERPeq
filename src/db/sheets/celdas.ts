// Valores de celda de Google Sheets: lo que se lee, lo que se escribe y las fechas como número de serie.

export type Celda = string | number | boolean | null | undefined;
export type Fila = Celda[];
// Fecha con hora (para los estados); una Date sola se guarda como fecha sin hora.
export interface Momento { momento: Date }
export type ValorCelda = string | number | boolean | Date | Momento | null | undefined;

// Sheets guarda las fechas como días desde 30/12/1899.
export const deSerie = (s: number) => {
  const ms = (s - 25569) * 86400000;
  return new Date(ms + new Date(ms).getTimezoneOffset() * 60000);
};

// Fecha local → número de serie de Sheets (días desde 30/12/1899, con la hora como fracción).
export const aSerie = (d: Date) =>
  (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - Date.UTC(1899, 11, 30)) / 86400000;

export interface DatoCelda {
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

// Lo que Sheets devuelve al leer (UNFORMATTED_VALUE, fechas como SERIAL_NUMBER) para un valor escrito.
export function leida(v: ValorCelda): string | number | boolean {
  const d = celda(v).userEnteredValue;
  return d?.numberValue ?? d?.stringValue ?? d?.boolValue ?? '';
}
