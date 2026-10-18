// Análisis de ventas por producto y por cliente sobre un período. No depende del navegador, así se puede
// probar con Node. Las definiciones y fórmulas están en spec/analisis.md.
import { type Datos, estadosActuales, lineasVendidas, nombres, redondear } from './modelo';

export const PERIODOS = [
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
  { value: 'todo', label: 'Todo' },
] as const;
export type Periodo = (typeof PERIODOS)[number]['value'];

// Primer día que entra en el período (a las 0:00), o null si es "todo".
export function inicioPeriodo(periodo: Periodo, hoy: Date): Date | null {
  if (periodo === 'todo') return null;
  return new Date(hoy.getFullYear(), hoy.getMonth() - Number(periodo), hoy.getDate());
}

const enPeriodo = (f: Date | null, desde: Date | null) => f !== null && (desde === null || f >= desde);

// Número de día calendario (ignora la hora y los cambios de horario).
const dia = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

// ---------- Productos ----------

export interface AnalisisProducto {
  productoId: string; producto: string; unidad: string;
  cantidad: number; importe: number; comisiones: number;
  // Solo de las líneas con costo: las que no tienen costo no tienen ganancia.
  costo: number; ganancia: number; importeConCosto: number;
  margen: number | null; // ganancia / importeConCosto, entre 0 y 1
  lineasSinCosto: number;
}

export function analizarProductos(datos: Datos, desde: Date | null): AnalisisProducto[] {
  const productos = new Map(datos.productos.map((p) => [p.id, p]));
  const res = new Map<string, AnalisisProducto>();
  for (const l of lineasVendidas(datos)) {
    if (!enPeriodo(l.venta.fecha, desde)) continue;
    const p = productos.get(l.productoId);
    const a = res.get(l.productoId) ?? {
      productoId: l.productoId, producto: p?.producto ?? l.productoId, unidad: p?.unidad ?? 'kg',
      cantidad: 0, importe: 0, comisiones: 0, costo: 0, ganancia: 0, importeConCosto: 0, margen: null, lineasSinCosto: 0,
    };
    a.cantidad += l.cantidad;
    a.importe += l.importe;
    a.comisiones += l.comision;
    if (l.costo === null || l.ganancia === null) {
      a.lineasSinCosto += 1;
    } else {
      a.costo += l.cantidad * l.costo;
      a.ganancia += l.ganancia;
      a.importeConCosto += l.importe;
    }
    res.set(l.productoId, a);
  }
  return [...res.values()].map((a) => ({
    ...a,
    cantidad: redondear(a.cantidad, 3), importe: redondear(a.importe), comisiones: redondear(a.comisiones),
    costo: redondear(a.costo), ganancia: redondear(a.ganancia), importeConCosto: redondear(a.importeConCosto),
    margen: a.importeConCosto > 0 ? a.ganancia / a.importeConCosto : null,
  }));
}

// El más vendido por cantidad de cada unidad (no se comparan kg con unidades).
export function masVendidoPorUnidad(productos: AnalisisProducto[]) {
  const res = new Map<string, AnalisisProducto>();
  for (const p of productos) {
    const actual = res.get(p.unidad);
    if (!actual || p.cantidad > actual.cantidad) res.set(p.unidad, p);
  }
  return res;
}

// ---------- Fletes ----------

export interface FletesPeriodo { total: number; cantidad: number }

// Fletes con fecha en el período. Su costo es gasto de logística: no se asigna a pedidos ni a productos.
export function fletesDelPeriodo(datos: Datos, desde: Date | null): FletesPeriodo {
  const fletes = datos.fletes.filter((f) => enPeriodo(f.fecha, desde));
  return { total: redondear(fletes.reduce((s, f) => s + (f.costo ?? 0), 0)), cantidad: fletes.length };
}

// ---------- Clientes ----------

export interface AnalisisCliente {
  clave: string; cliente: string;
  pedidos: number; // pedidos (no cancelados) con fecha en el período
  importe: number; // entregado en el período
  ultimoPedido: Date | null; // de toda la historia
}

// Pedidos no cancelados, agrupados por cliente (ID de contacto).
function pedidosPorCliente(datos: Datos) {
  const estados = estadosActuales(datos.pedidosEstados);
  const nombre = nombres(datos).contacto;
  const res = new Map<string, { cliente: string; pedidos: Datos['pedidos'] }>();
  for (const p of datos.pedidos) {
    if (estados.get(p.id) === 'cancelado') continue;
    const clave = p.contactoId;
    if (clave === '') continue;
    const c = res.get(clave) ?? { cliente: nombre(clave), pedidos: [] };
    c.pedidos.push(p);
    res.set(clave, c);
  }
  return res;
}

// Importe entregado por pedido, contando solo las ventas que cumplen `filtro`.
function importePorPedido(datos: Datos, filtro: (fecha: Date | null) => boolean) {
  const ventas = new Map(datos.ventas.map((v) => [v.id, v]));
  const res = new Map<string, number>();
  for (const it of datos.ventasItems) {
    const v = ventas.get(it.ventaId);
    if (!v || !filtro(v.fecha)) continue;
    res.set(v.pedidoId, (res.get(v.pedidoId) ?? 0) + it.importe);
  }
  return res;
}

// Primera comparación distinta de cero, para ordenar por varios criterios.
const porOrden = (...comparaciones: number[]) => comparaciones.find((c) => c !== 0) ?? 0;

const ultimaFecha = (fechas: (Date | null)[]) =>
  fechas.reduce<Date | null>((m, f) => (f && (!m || f > m) ? f : m), null);

export function analizarClientes(datos: Datos, desde: Date | null): AnalisisCliente[] {
  const importe = importePorPedido(datos, (f) => enPeriodo(f, desde));
  const res: AnalisisCliente[] = [];
  for (const [clave, c] of pedidosPorCliente(datos)) {
    const pedidos = c.pedidos.filter((p) => enPeriodo(p.fecha, desde)).length;
    const total = redondear(c.pedidos.reduce((s, p) => s + (importe.get(p.id) ?? 0), 0));
    if (pedidos === 0 && total === 0) continue;
    res.push({ clave, cliente: c.cliente, pedidos, importe: total, ultimoPedido: ultimaFecha(c.pedidos.map((p) => p.fecha)) });
  }
  return res.sort((a, b) => porOrden(b.pedidos - a.pedidos, b.importe - a.importe, a.cliente.localeCompare(b.cliente, 'es')));
}

// Criterio de cliente inactivo (ver spec/analisis.md).
export const INACTIVO = { minimoPedidos: 3, factor: 2, minimoDias: 30 } as const;

export interface ClienteInactivo {
  clave: string; cliente: string; pedidos: number; intervalo: number; ultimoPedido: Date;
  diasSinComprar: number; importeHistorico: number;
}

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Clientes que compraban con regularidad y dejaron de comprar. Usa toda la historia, no el período.
export function clientesInactivos(datos: Datos, hoy: Date): ClienteInactivo[] {
  const importe = importePorPedido(datos, () => true);
  const res: ClienteInactivo[] = [];
  for (const [clave, c] of pedidosPorCliente(datos)) {
    // Varios pedidos el mismo día cuentan como una compra.
    const dias = [...new Set(c.pedidos.flatMap((p) => (p.fecha && p.fecha <= hoy ? [dia(p.fecha)] : [])))]
      .sort((a, b) => a - b);
    if (dias.length < INACTIVO.minimoPedidos) continue;
    const intervalo = mediana(dias.slice(1).map((d, i) => d - dias[i]));
    const ultimoPedido = ultimaFecha(c.pedidos.map((p) => (p.fecha !== null && p.fecha <= hoy ? p.fecha : null)));
    if (!ultimoPedido) continue;
    const diasSinComprar = dia(hoy) - dia(ultimoPedido);
    if (diasSinComprar <= Math.max(INACTIVO.factor * intervalo, INACTIVO.minimoDias)) continue;
    res.push({
      clave, cliente: c.cliente, pedidos: dias.length, intervalo: Math.round(intervalo), ultimoPedido, diasSinComprar,
      importeHistorico: redondear(c.pedidos.reduce((s, p) => s + (importe.get(p.id) ?? 0), 0)),
    });
  }
  return res.sort((a, b) => porOrden(b.importeHistorico - a.importeHistorico, b.diasSinComprar - a.diasSinComprar));
}
