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
export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const deISO = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
};
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
