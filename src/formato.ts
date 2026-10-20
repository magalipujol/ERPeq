export const fmtNum = (n: number | null | undefined) =>
  (n === null || n === undefined ? '–' : n.toLocaleString('es-AR', { maximumFractionDigits: 2 }));
export const fmtMoney = (n: number | null | undefined) =>
  (n === null || n === undefined ? '–' : n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }));
export const fmtFecha = (d: Date | null) =>
  (d ? d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '–');
export const fmtMes = (k: string) => {
  const [a, m] = k.split('-').map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// Fecha → valor de un <input type="date"> ("2026-10-18"); vacío si no hay fecha.
export const aISO = (d: Date | null) =>
  (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');
export const hoyISO = () => aISO(new Date());
export const deISO = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
};
// Valor de un <input type="datetime-local"> ("2026-10-18T09:30") → fecha local; null si está vacío o incompleto.
export const deISOConHora = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
};
export const fmtFechaHora = (d: Date | null) =>
  (d ? `${fmtFecha(d)} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}` : '–');
export const hora = () => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
export const unicos = (arr: (string | null | undefined)[]) =>
  [...new Set(arr.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, 'es'));

// NumberInput devuelve number, o string mientras el valor está incompleto ("1." o "").
export const aNumero = (v: number | string) => (typeof v === 'number' ? v : v === '' ? NaN : Number(v));

export const mensajeDeError = (err: unknown) => (err instanceof Error ? err.message : String(err));
export const numeroOCero = (v: number | string) => {
  const n = aNumero(v);
  return Number.isNaN(n) ? 0 : n;
};
// Para totales: un valor faltante o inválido (precio vacío → NaN) suma 0.
export const sumable = (n: number | null) => (n === null || Number.isNaN(n) ? 0 : n);
// Más reciente primero; las fechas vacías al final.
export const porFechaDesc = (a: { fecha: Date | null }, b: { fecha: Date | null }) =>
  (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0);
// "Funes, Santa Fe": localidad y provincia de un contacto, sin las que falten.
export const lugar = (c: { localidad: string; provincia: string } | undefined) =>
  [c?.localidad, c?.provincia].filter(Boolean).join(', ');
