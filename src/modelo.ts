// Modelo de datos de ERPeq: cómo se leen y escriben las filas de la planilla y los cálculos
// (stock por depósito, costo promedio, ganancia). No depende del navegador, así se puede probar con Node.

export const RANGOS = {
  productos: "'Productos'!A2:D",
  compras: "'Compras'!A2:J",
  ventas: "'Ventas'!A2:P",
  ajustes: "'Ajustes'!A2:F",
  tipos: "'Tipos de cliente'!A2:B",
};
// Columnas de stock calculado en la hoja Productos (E en adelante, una por depósito).
export const PRODUCTOS_COL_STOCK = 4;

export type Celda = string | number | boolean | null | undefined;
export type Fila = Celda[];
export type ValorCelda = string | number | Date | null | undefined;

export interface Producto { id: string; producto: string; unidad: string; minimo: number | null }
export interface Compra {
  fila: number; // número de fila en la hoja
  fecha: Date | null; deposito: string; proveedor: string; id: string; producto: string;
  cantidad: number; precio: number | null; importe: number | null; remito: string; nota: string;
}
export interface Venta {
  fila: number; // número de fila en la hoja
  fecha: Date | null; deposito: string; cliente: string; tipo: string; localidad: string; provincia: string;
  id: string; producto: string; cantidad: number; precio: number | null; importe: number | null;
  comision: number; costo: number | null; ganancia: number | null; carga: string; nota: string;
}
export interface Ajuste { fecha: Date | null; deposito: string; id: string; producto: string; cantidad: number; motivo: string }
export interface TipoCliente { tipo: string; comision: number }
export interface Datos { productos: Producto[]; compras: Compra[]; ventas: Venta[]; ajustes: Ajuste[]; tipos: TipoCliente[] }
export type StockDeposito = Record<string, number>;

const txt = (v: Celda) => (v === undefined || v === null ? '' : String(v).trim());
const num = (v: Celda) => (v === '' || v === undefined || v === null || isNaN(Number(v)) ? null : Number(v));
// Los rangos empiezan en la fila 2 (la 1 es el encabezado).
const conFila = <T>(filas: Fila[], usar: (f: Fila) => boolean, armar: (f: Fila, fila: number) => T) =>
  filas.flatMap((f, i) => (usar(f) ? [armar(f, i + 2)] : []));

export function redondear(n: number, d?: number): number;
export function redondear(n: number | null, d?: number): number | null;
export function redondear(n: number | null, d = 2) {
  return n === null ? null : Math.round(n * 10 ** d) / 10 ** d;
}

export function parsear(crudo: Fila[][], deSerie: (s: number) => Date): Datos {
  const fecha = (v: Celda) => (typeof v === 'number' ? deSerie(v) : null);
  const [prod, comp, vent, ajus, tip] = crudo;
  return {
    productos: prod.filter((f) => txt(f[0])).map((f) => ({
      id: txt(f[0]), producto: txt(f[1]), unidad: txt(f[2]) || 'kg', minimo: num(f[3]) ?? 0,
    })),
    compras: conFila(comp, (f) => txt(f[3]) !== '', (f, fila) => ({
      fila, fecha: fecha(f[0]), deposito: txt(f[1]), proveedor: txt(f[2]), id: txt(f[3]), producto: txt(f[4]),
      cantidad: num(f[5]) ?? 0, precio: num(f[6]), importe: num(f[7]), remito: txt(f[8]), nota: txt(f[9]),
    })),
    ventas: conFila(vent, (f) => txt(f[6]) !== '', (f, fila) => ({
      fila, fecha: fecha(f[0]), deposito: txt(f[1]), cliente: txt(f[2]), tipo: txt(f[3]), localidad: txt(f[4]),
      provincia: txt(f[5]), id: txt(f[6]), producto: txt(f[7]), cantidad: num(f[8]) ?? 0, precio: num(f[9]),
      importe: num(f[10]), comision: num(f[11]) ?? 0, costo: num(f[12]), ganancia: num(f[13]),
      carga: txt(f[14]), nota: txt(f[15]),
    })),
    ajustes: ajus.filter((f) => txt(f[2])).map((f) => ({
      fecha: fecha(f[0]), deposito: txt(f[1]), id: txt(f[2]), producto: txt(f[3]), cantidad: num(f[4]) ?? 0,
      motivo: txt(f[5]),
    })),
    tipos: tip.filter((f) => txt(f[0])).map((f) => ({ tipo: txt(f[0]), comision: num(f[1]) ?? 0 })),
  };
}

// Costo promedio ponderado por producto, sobre todas las compras con precio (ambos depósitos).
export function costosPromedio(compras: Compra[]) {
  const acum = new Map<string, { cant: number; total: number }>();
  for (const c of compras) {
    if (c.precio === null || c.cantidad <= 0) continue;
    const a = acum.get(c.id) ?? { cant: 0, total: 0 };
    a.cant += c.cantidad;
    a.total += c.cantidad * c.precio;
    acum.set(c.id, a);
  }
  const res = new Map<string, number>();
  for (const [id, a] of acum) res.set(id, redondear(a.total / a.cant));
  return res;
}

// Stock = compras − ventas + ajustes, por depósito.
export function stockPorProducto(datos: Datos, depositos: string[]) {
  const res = new Map<string, StockDeposito>(
    datos.productos.map((p) => [p.id, Object.fromEntries(depositos.map((d) => [d, 0]))]),
  );
  const sumar = (id: string, dep: string, cant: number) => {
    const s = res.get(id);
    if (s && dep in s) s[dep] += cant;
  };
  for (const c of datos.compras) sumar(c.id, c.deposito, c.cantidad);
  for (const v of datos.ventas) sumar(v.id, v.deposito, -v.cantidad);
  for (const a of datos.ajustes) sumar(a.id, a.deposito, a.cantidad);
  for (const s of res.values()) for (const d of depositos) s[d] = redondear(s[d], 3);
  return res;
}

// Calcula importe, comisión, costo y ganancia de una línea de venta.
export function lineaVenta({ cantidad, precio, comisionPct, costo }:
  { cantidad: number; precio: number; comisionPct: number; costo: number | null | undefined }) {
  const importe = redondear(cantidad * precio);
  const comision = redondear(importe * (Number.isFinite(comisionPct) ? comisionPct : 0) / 100);
  const ganancia = costo === null || costo === undefined ? null : redondear(importe - comision - cantidad * costo);
  return { importe, comision, ganancia };
}

export const claveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export interface Mes { mes: string; importe: number; ganancia: number; comision: number; lineas: number }

export function ventasPorMes(ventas: Venta[]) {
  const meses = new Map<string, Mes>();
  for (const v of ventas) {
    if (!v.fecha) continue;
    const k = claveMes(v.fecha);
    const m = meses.get(k) ?? { mes: k, importe: 0, ganancia: 0, comision: 0, lineas: 0 };
    m.importe += v.importe ?? 0;
    m.ganancia += v.ganancia ?? 0;
    m.comision += v.comision;
    m.lineas += 1;
    meses.set(k, m);
  }
  return [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export function siguienteId(productos: Producto[]) {
  const max = productos.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, ''))), 0);
  return `P${String(max + 1).padStart(3, '0')}`;
}

// Filas tal como se escriben en cada hoja (mismo orden de columnas).
export const filas = {
  producto: (p: Producto): ValorCelda[] => [p.id, p.producto, p.unidad, p.minimo ?? ''],
  compra: (c: Omit<Compra, 'fila' | 'importe'>): ValorCelda[] => [c.fecha, c.deposito, c.proveedor, c.id, c.producto, c.cantidad, c.precio ?? '',
    c.precio === null ? '' : redondear(c.cantidad * c.precio), c.remito, c.nota],
  venta: (v: Omit<Venta, 'fila'>): ValorCelda[] => [v.fecha, v.deposito, v.cliente, v.tipo, v.localidad, v.provincia, v.id, v.producto, v.cantidad,
    v.precio, v.importe, v.comision, v.costo ?? '', v.ganancia ?? '', v.carga, v.nota],
  ajuste: (a: Ajuste): ValorCelda[] => [a.fecha, a.deposito, a.id, a.producto, a.cantidad, a.motivo],
};
