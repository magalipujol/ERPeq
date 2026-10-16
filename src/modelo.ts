// Modelo de datos de ERPeq: cómo se leen y escriben las filas de la planilla y los cálculos
// (stock por depósito, estados, precios, comisiones, ganancia). No depende del navegador, así se puede
// probar con Node. La referencia del modelo es spec/modelo-de-datos.md.

// Nombre de cada hoja y cantidad de columnas que lee la app (la fila 1 es el encabezado).
export const HOJAS = {
  depositos: ['Depósitos', 3],
  productos: ['Productos', 4],
  contactos: ['Contactos', 10],
  tipos: ['Tipos de cliente', 1],
  vendedores: ['Vendedores', 3],
  precios: ['Precios', 4],
  reglas: ['Reglas de comisión', 4],
  compras: ['Compras', 12],
  pedidos: ['Pedidos', 9],
  pedidosItems: ['Pedidos ítems', 7],
  pedidosEstados: ['Pedidos estados', 3],
  pedidosVendedores: ['Pedidos vendedores', 2],
  ventas: ['Ventas', 5],
  ventasItems: ['Ventas ítems', 9],
  ventasComisiones: ['Ventas comisiones', 7],
  fletes: ['Fletes', 9],
  fletesItems: ['Fletes ítems', 4],
  fletesEstados: ['Fletes estados', 3],
  pedidosFletes: ['Pedidos fletes', 3],
  ajustes: ['Ajustes', 6],
} as const satisfies Record<string, readonly [string, number]>;

export type ClaveHoja = keyof typeof HOJAS;
export const CLAVES = Object.keys(HOJAS) as ClaveHoja[];
export const nombreHoja = (k: ClaveHoja) => HOJAS[k][0];

const columna = (n: number) => String.fromCharCode(64 + n);
export const rango = (k: ClaveHoja) => `'${HOJAS[k][0]}'!A2:${columna(HOJAS[k][1])}`;

export type Celda = string | number | boolean | null | undefined;
export type Fila = Celda[];
// Fecha con hora (para los estados); una Date sola se guarda como fecha sin hora.
export interface Momento { momento: Date }
export type ValorCelda = string | number | boolean | Date | Momento | null | undefined;

export interface Deposito { id: string; nombre: string; localidad: string }
export interface Producto { id: string; producto: string; unidad: string; minimo: number | null }
export type Rol = 'cliente' | 'proveedor' | 'transporte';
export interface Contacto {
  id: string; rol: string; nombre: string; tipo: string; telefono: string; direccion: string; email: string;
  localidad: string; provincia: string; observaciones: string;
}
export interface Vendedor { id: string; nombre: string; activo: boolean }
export interface Precio { productoId: string; producto: string; precio: number; desde: Date | null }
export interface ReglaComision { vendedorId: string; productoId: string; porcentaje: number; desde: Date | null }
export interface Compra {
  fila: number; // número de fila en la hoja
  fecha: Date | null; depositoId: string; proveedor: string; contactoId: string; productoId: string; producto: string;
  cantidad: number; precio: number | null; importe: number | null; remito: string; pedidoId: string; nota: string;
}
export interface Pedido {
  id: string; fecha: Date | null; contactoId: string; cliente: string; tipo: string; localidad: string; provincia: string;
  depositoId: string; nota: string;
}
export interface PedidoItem {
  pedidoId: string; linea: number; productoId: string; producto: string; cantidad: number;
  precioLista: number | null; precio: number;
}
export interface RegistroEstado { ref: string; fecha: Date | null; estado: string }
export interface PedidoVendedor { pedidoId: string; vendedorId: string }
export interface Venta { id: string; fecha: Date | null; pedidoId: string; depositoId: string; nota: string }
export interface VentaItem {
  ventaId: string; linea: number; pedidoLinea: number; productoId: string; producto: string; cantidad: number;
  precio: number; importe: number; costo: number | null;
}
export interface VentaComision {
  ventaId: string; linea: number; vendedorId: string; vendedor: string; porcentajeRegla: number | null;
  porcentaje: number; monto: number;
}
export interface Flete {
  id: string; fecha: Date | null; transporte: string; contactoId: string; origenId: string; destinoId: string;
  costo: number | null; guia: string; nota: string;
}
export interface FleteItem { fleteId: string; productoId: string; producto: string; cantidad: number }
export interface PedidoFlete { pedidoId: string; fleteId: string; costoAsignado: number | null }
export interface Ajuste { fecha: Date | null; depositoId: string; productoId: string; producto: string; cantidad: number; motivo: string }

export interface Datos {
  depositos: Deposito[]; productos: Producto[]; contactos: Contacto[]; tipos: string[]; vendedores: Vendedor[];
  precios: Precio[]; reglas: ReglaComision[]; compras: Compra[]; pedidos: Pedido[]; pedidosItems: PedidoItem[];
  pedidosEstados: RegistroEstado[]; pedidosVendedores: PedidoVendedor[]; ventas: Venta[]; ventasItems: VentaItem[];
  ventasComisiones: VentaComision[]; fletes: Flete[]; fletesItems: FleteItem[]; fletesEstados: RegistroEstado[];
  pedidosFletes: PedidoFlete[]; ajustes: Ajuste[];
}

const txt = (v: Celda) => (v === undefined || v === null ? '' : String(v).trim());
const num = (v: Celda) => (v === '' || v === undefined || v === null || isNaN(Number(v)) ? null : Number(v));
const bool = (v: Celda) => v === true || ['si', 'sí', 'true', 'verdadero', '1'].includes(txt(v).toLowerCase());

export function redondear(n: number, d?: number): number;
export function redondear(n: number | null, d?: number): number | null;
export function redondear(n: number | null, d = 2) {
  return n === null ? null : Math.round(n * 10 ** d) / 10 ** d;
}

// `crudo` trae las filas de cada hoja en el orden de CLAVES.
export function parsear(crudo: Fila[][], deSerie: (s: number) => Date): Datos {
  const fecha = (v: Celda) => (typeof v === 'number' ? deSerie(v) : null);
  const h = Object.fromEntries(CLAVES.map((k, i) => [k, crudo[i] ?? []])) as Record<ClaveHoja, Fila[]>;
  // Saltea las filas cuya columna `clave` está vacía.
  const de = <T>(k: ClaveHoja, clave: number, armar: (f: Fila, fila: number) => T) =>
    h[k].flatMap((f, i) => (txt(f[clave]) !== '' ? [armar(f, i + 2)] : []));
  const estados = (k: 'pedidosEstados' | 'fletesEstados') =>
    de(k, 0, (f) => ({ ref: txt(f[0]), fecha: fecha(f[1]), estado: txt(f[2]).toLowerCase() }));

  return {
    depositos: de('depositos', 0, (f) => ({ id: txt(f[0]), nombre: txt(f[1]) || txt(f[0]), localidad: txt(f[2]) })),
    productos: de('productos', 0, (f) => ({ id: txt(f[0]), producto: txt(f[1]), unidad: txt(f[2]) || 'kg', minimo: num(f[3]) ?? 0 })),
    contactos: de('contactos', 0, (f) => ({
      id: txt(f[0]), rol: txt(f[1]).toLowerCase(), nombre: txt(f[2]), tipo: txt(f[3]), telefono: txt(f[4]),
      direccion: txt(f[5]), email: txt(f[6]), localidad: txt(f[7]), provincia: txt(f[8]), observaciones: txt(f[9]),
    })),
    tipos: de('tipos', 0, (f) => txt(f[0])),
    vendedores: de('vendedores', 0, (f) => ({ id: txt(f[0]), nombre: txt(f[1]) || txt(f[0]), activo: txt(f[2]) === '' || bool(f[2]) })),
    precios: de('precios', 0, (f) => ({ productoId: txt(f[0]), producto: txt(f[1]), precio: num(f[2]) ?? 0, desde: fecha(f[3]) }))
      .filter((p) => p.precio > 0),
    reglas: de('reglas', 0, (f) => ({ vendedorId: txt(f[0]), productoId: txt(f[1]), porcentaje: num(f[2]) ?? 0, desde: fecha(f[3]) })),
    compras: de('compras', 4, (f, fila) => ({
      fila, fecha: fecha(f[0]), depositoId: txt(f[1]), proveedor: txt(f[2]), contactoId: txt(f[3]), productoId: txt(f[4]),
      producto: txt(f[5]), cantidad: num(f[6]) ?? 0, precio: num(f[7]), importe: num(f[8]), remito: txt(f[9]),
      pedidoId: txt(f[10]), nota: txt(f[11]),
    })),
    pedidos: de('pedidos', 0, (f) => ({
      id: txt(f[0]), fecha: fecha(f[1]), contactoId: txt(f[2]), cliente: txt(f[3]), tipo: txt(f[4]), localidad: txt(f[5]),
      provincia: txt(f[6]), depositoId: txt(f[7]), nota: txt(f[8]),
    })),
    pedidosItems: de('pedidosItems', 0, (f) => ({
      pedidoId: txt(f[0]), linea: num(f[1]) ?? 0, productoId: txt(f[2]), producto: txt(f[3]), cantidad: num(f[4]) ?? 0,
      precioLista: num(f[5]), precio: num(f[6]) ?? 0,
    })),
    pedidosEstados: estados('pedidosEstados'),
    pedidosVendedores: de('pedidosVendedores', 0, (f) => ({ pedidoId: txt(f[0]), vendedorId: txt(f[1]) })),
    ventas: de('ventas', 0, (f) => ({ id: txt(f[0]), fecha: fecha(f[1]), pedidoId: txt(f[2]), depositoId: txt(f[3]), nota: txt(f[4]) })),
    ventasItems: de('ventasItems', 0, (f) => ({
      ventaId: txt(f[0]), linea: num(f[1]) ?? 0, pedidoLinea: num(f[2]) ?? 0, productoId: txt(f[3]), producto: txt(f[4]),
      cantidad: num(f[5]) ?? 0, precio: num(f[6]) ?? 0, importe: num(f[7]) ?? 0, costo: num(f[8]),
    })),
    ventasComisiones: de('ventasComisiones', 0, (f) => ({
      ventaId: txt(f[0]), linea: num(f[1]) ?? 0, vendedorId: txt(f[2]), vendedor: txt(f[3]), porcentajeRegla: num(f[4]),
      porcentaje: num(f[5]) ?? 0, monto: num(f[6]) ?? 0,
    })),
    fletes: de('fletes', 0, (f) => ({
      id: txt(f[0]), fecha: fecha(f[1]), transporte: txt(f[2]), contactoId: txt(f[3]), origenId: txt(f[4]),
      destinoId: txt(f[5]), costo: num(f[6]), guia: txt(f[7]), nota: txt(f[8]),
    })),
    fletesItems: de('fletesItems', 0, (f) => ({ fleteId: txt(f[0]), productoId: txt(f[1]), producto: txt(f[2]), cantidad: num(f[3]) ?? 0 })),
    fletesEstados: estados('fletesEstados'),
    pedidosFletes: de('pedidosFletes', 0, (f) => ({ pedidoId: txt(f[0]), fleteId: txt(f[1]), costoAsignado: num(f[2]) })),
    ajustes: de('ajustes', 2, (f) => ({
      fecha: fecha(f[0]), depositoId: txt(f[1]), productoId: txt(f[2]), producto: txt(f[3]), cantidad: num(f[4]) ?? 0, motivo: txt(f[5]),
    })),
  };
}

// ---------- Estados ----------

// El estado actual es el de la última fila agregada para esa referencia.
export function estadosActuales(registros: RegistroEstado[]) {
  const res = new Map<string, string>();
  for (const r of registros) res.set(r.ref, r.estado);
  return res;
}

export const ESTADOS_FLETE = ['preparacion', 'camino', 'finalizado', 'cancelado'] as const;
export type EstadoFlete = (typeof ESTADOS_FLETE)[number];
export const NOMBRE_ESTADO_FLETE: Record<EstadoFlete, string> = {
  preparacion: 'En preparación', camino: 'En camino', finalizado: 'Finalizado', cancelado: 'Cancelado',
};
// Cambios de estado permitidos desde cada estado.
export const SIGUIENTES_FLETE: Record<EstadoFlete, EstadoFlete[]> = {
  preparacion: ['camino', 'cancelado'],
  camino: ['finalizado', 'preparacion'],
  finalizado: [],
  cancelado: [],
};
export const estadoFlete = (estados: Map<string, string>, id: string): EstadoFlete => {
  const e = estados.get(id);
  return (ESTADOS_FLETE as readonly string[]).includes(e ?? '') ? (e as EstadoFlete) : 'preparacion';
};

export type EstadoPedido = 'pendiente' | 'parcial' | 'entregado' | 'cancelado' | 'cerrado';
export const NOMBRE_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  pendiente: 'Pendiente', parcial: 'Parcial', entregado: 'Entregado', cancelado: 'Cancelado', cerrado: 'Cerrado',
};
export const pedidoAbierto = (e: EstadoPedido) => e === 'pendiente' || e === 'parcial';

// ---------- Precios y comisiones ----------

const vigente = <T extends { desde: Date | null }>(lista: T[], fecha: Date | null) => {
  let mejor: T | null = null;
  for (const x of lista) {
    if (fecha && x.desde && x.desde > fecha) continue;
    // Ante la misma fecha gana la fila agregada después.
    if (!mejor || (x.desde?.getTime() ?? 0) >= (mejor.desde?.getTime() ?? 0)) mejor = x;
  }
  return mejor;
};

// Precio de lista vigente a una fecha: la fila con `desde` más reciente que no sea posterior.
export function precioVigente(precios: Precio[], productoId: string, fecha: Date | null) {
  return vigente(precios.filter((p) => p.productoId === productoId), fecha)?.precio ?? null;
}

// Porcentaje por defecto: regla del vendedor para el producto o, si no hay, su regla general.
export function porcentajeRegla(reglas: ReglaComision[], vendedorId: string, productoId: string, fecha: Date | null) {
  const delVendedor = reglas.filter((r) => r.vendedorId === vendedorId);
  const especifica = vigente(delVendedor.filter((r) => r.productoId === productoId), fecha);
  const general = vigente(delVendedor.filter((r) => r.productoId === ''), fecha);
  return (especifica ?? general)?.porcentaje ?? 0;
}

export const montoComision = (importe: number, porcentaje: number) =>
  redondear(importe * (Number.isFinite(porcentaje) ? porcentaje : 0) / 100);

// Costo promedio ponderado por producto, sobre todas las compras con precio (todos los depósitos).
export function costosPromedio(compras: Compra[]) {
  const acum = new Map<string, { cant: number; total: number }>();
  for (const c of compras) {
    if (c.precio === null || c.cantidad <= 0) continue;
    const a = acum.get(c.productoId) ?? { cant: 0, total: 0 };
    a.cant += c.cantidad;
    a.total += c.cantidad * c.precio;
    acum.set(c.productoId, a);
  }
  const res = new Map<string, number>();
  for (const [id, a] of acum) res.set(id, redondear(a.total / a.cant));
  return res;
}

// ---------- Pedidos ----------

const claveLinea = (pedidoId: string, linea: number) => `${pedidoId}#${linea}`;

// Cantidad entregada de cada línea de pedido ("PE0001#1" → cantidad).
export function entregadoPorLinea(datos: Pick<Datos, 'ventas' | 'ventasItems'>) {
  const pedidoDe = new Map(datos.ventas.map((v) => [v.id, v.pedidoId]));
  const res = new Map<string, number>();
  for (const it of datos.ventasItems) {
    const pedido = pedidoDe.get(it.ventaId);
    if (pedido === undefined) continue;
    const k = claveLinea(pedido, it.pedidoLinea);
    res.set(k, redondear((res.get(k) ?? 0) + it.cantidad, 3));
  }
  return res;
}

export interface LineaPedido extends PedidoItem { entregado: number; pendiente: number }

export interface ResumenPedido {
  pedido: Pedido; estado: EstadoPedido; lineas: LineaPedido[]; vendedores: string[];
  importePedido: number; importeEntregado: number; comisiones: number; costoMercaderia: number;
  sinCosto: boolean; fletes: number; ganancia: number; ventas: Venta[];
}

export function resumirPedidos(datos: Datos): ResumenPedido[] {
  const entregado = entregadoPorLinea(datos);
  const estados = estadosActuales(datos.pedidosEstados);
  const porPedido = <T extends { pedidoId: string }>(lista: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of lista) m.set(x.pedidoId, [...(m.get(x.pedidoId) ?? []), x]);
    return m;
  };
  const items = porPedido(datos.pedidosItems);
  const ventas = porPedido(datos.ventas);
  const vendedores = porPedido(datos.pedidosVendedores);
  const fletes = porPedido(datos.pedidosFletes);
  const ventaItems = new Map<string, VentaItem[]>();
  for (const it of datos.ventasItems) ventaItems.set(it.ventaId, [...(ventaItems.get(it.ventaId) ?? []), it]);
  const comisionDeVenta = new Map<string, number>();
  for (const c of datos.ventasComisiones) comisionDeVenta.set(c.ventaId, (comisionDeVenta.get(c.ventaId) ?? 0) + c.monto);

  return datos.pedidos.map((pedido) => {
    const manual = estados.get(pedido.id);
    const cerrado = manual === 'cancelado' || manual === 'cerrado';
    const lineas = (items.get(pedido.id) ?? []).map((it) => {
      const ent = entregado.get(claveLinea(pedido.id, it.linea)) ?? 0;
      return { ...it, entregado: ent, pendiente: cerrado ? 0 : Math.max(0, redondear(it.cantidad - ent, 3)) };
    });
    const vs = ventas.get(pedido.id) ?? [];
    const its = vs.flatMap((v) => ventaItems.get(v.id) ?? []);
    const hayEntregas = its.length > 0;
    const estado: EstadoPedido = manual === 'cancelado' ? 'cancelado' : manual === 'cerrado' ? 'cerrado'
      : lineas.every((l) => l.pendiente === 0) && hayEntregas ? 'entregado'
        : hayEntregas ? 'parcial' : 'pendiente';
    const importeEntregado = redondear(its.reduce((s, it) => s + it.importe, 0));
    const comisiones = redondear(vs.reduce((s, v) => s + (comisionDeVenta.get(v.id) ?? 0), 0));
    const costoMercaderia = redondear(its.reduce((s, it) => s + it.cantidad * (it.costo ?? 0), 0));
    const costoFletes = redondear((fletes.get(pedido.id) ?? []).reduce((s, f) => s + (f.costoAsignado ?? 0), 0));
    return {
      pedido, estado, lineas, ventas: vs,
      vendedores: (vendedores.get(pedido.id) ?? []).map((v) => v.vendedorId),
      importePedido: redondear(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0)),
      importeEntregado, comisiones, costoMercaderia, fletes: costoFletes,
      sinCosto: its.some((it) => it.costo === null),
      ganancia: redondear(importeEntregado - comisiones - costoMercaderia - costoFletes),
    };
  });
}

// ---------- Stock ----------

export type PorDeposito = Record<string, number>;
export interface Stock {
  enDeposito: Map<string, PorDeposito>; // stock(p, d)
  enTransito: Map<string, PorDeposito>; // por depósito de destino
  reservado: Map<string, PorDeposito>; // en fletes en preparación, por depósito de origen
  comprometido: Map<string, PorDeposito>; // pendiente de pedidos abiertos, por depósito de entrega
}

export function calcularStock(datos: Datos, resumenes = resumirPedidos(datos)): Stock {
  const deps = datos.depositos.map((d) => d.id);
  const nuevo = () => new Map<string, PorDeposito>(datos.productos.map((p) => [p.id, Object.fromEntries(deps.map((d) => [d, 0]))]));
  const s: Stock = { enDeposito: nuevo(), enTransito: nuevo(), reservado: nuevo(), comprometido: nuevo() };
  const sumar = (m: Map<string, PorDeposito>, prod: string, dep: string, cant: number) => {
    const fila = m.get(prod);
    if (fila && dep in fila) fila[dep] += cant;
  };

  for (const c of datos.compras) sumar(s.enDeposito, c.productoId, c.depositoId, c.cantidad);
  const depVenta = new Map(datos.ventas.map((v) => [v.id, v.depositoId]));
  for (const it of datos.ventasItems) sumar(s.enDeposito, it.productoId, depVenta.get(it.ventaId) ?? '', -it.cantidad);
  for (const a of datos.ajustes) sumar(s.enDeposito, a.productoId, a.depositoId, a.cantidad);

  const estados = estadosActuales(datos.fletesEstados);
  const fletes = new Map(datos.fletes.map((f) => [f.id, f]));
  for (const it of datos.fletesItems) {
    const f = fletes.get(it.fleteId);
    if (!f) continue;
    const estado = estadoFlete(estados, f.id);
    if (estado === 'preparacion') sumar(s.reservado, it.productoId, f.origenId, it.cantidad);
    if (estado === 'camino' || estado === 'finalizado') sumar(s.enDeposito, it.productoId, f.origenId, -it.cantidad);
    if (estado === 'camino') sumar(s.enTransito, it.productoId, f.destinoId, it.cantidad);
    if (estado === 'finalizado') sumar(s.enDeposito, it.productoId, f.destinoId, it.cantidad);
  }

  for (const r of resumenes) {
    if (!pedidoAbierto(r.estado)) continue;
    for (const l of r.lineas) sumar(s.comprometido, l.productoId, r.pedido.depositoId, l.pendiente);
  }

  for (const m of Object.values(s) as Map<string, PorDeposito>[]) {
    for (const fila of m.values()) for (const d of deps) fila[d] = redondear(fila[d], 3);
  }
  return s;
}

export const sumaDeps = (fila: PorDeposito | undefined) => redondear(Object.values(fila ?? {}).reduce((a, b) => a + b, 0), 3);

// Lo que falta en el depósito para cubrir los pedidos abiertos, contando lo que ya viene en camino.
export const faltante = (s: Stock, productoId: string, depositoId: string) => {
  const v = (m: Map<string, PorDeposito>) => m.get(productoId)?.[depositoId] ?? 0;
  return Math.max(0, redondear(v(s.comprometido) - v(s.enDeposito) - v(s.enTransito), 3));
};

// ---------- Ventas por mes ----------

export const claveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export interface LineaVendida extends VentaItem {
  venta: Venta; pedido: Pedido | undefined; comision: number; ganancia: number | null;
}

export function lineasVendidas(datos: Datos): LineaVendida[] {
  const ventas = new Map(datos.ventas.map((v) => [v.id, v]));
  const pedidos = new Map(datos.pedidos.map((p) => [p.id, p]));
  const comision = new Map<string, number>();
  for (const c of datos.ventasComisiones) {
    const k = `${c.ventaId}#${c.linea}`;
    comision.set(k, (comision.get(k) ?? 0) + c.monto);
  }
  return datos.ventasItems.flatMap((it) => {
    const venta = ventas.get(it.ventaId);
    if (!venta) return [];
    const com = redondear(comision.get(`${it.ventaId}#${it.linea}`) ?? 0);
    return [{
      ...it, venta, pedido: pedidos.get(venta.pedidoId), comision: com,
      ganancia: it.costo === null ? null : redondear(it.importe - com - it.cantidad * it.costo),
    }];
  });
}

export interface Mes { mes: string; importe: number; ganancia: number; comision: number; lineas: number }

export function ventasPorMes(lineas: LineaVendida[]) {
  const meses = new Map<string, Mes>();
  for (const l of lineas) {
    if (!l.venta.fecha) continue;
    const k = claveMes(l.venta.fecha);
    const m = meses.get(k) ?? { mes: k, importe: 0, ganancia: 0, comision: 0, lineas: 0 };
    m.importe += l.importe;
    m.ganancia += l.ganancia ?? 0;
    m.comision += l.comision;
    m.lineas += 1;
    meses.set(k, m);
  }
  return [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

// ---------- IDs ----------

// Siguiente ID con el prefijo dado: "PE" y ["PE0001", "PE0007"] → "PE0008".
export function siguienteId(ids: string[], prefijo: string, ancho = 4) {
  const max = ids.reduce((m, id) => {
    const n = id.startsWith(prefijo) ? Number(id.slice(prefijo.length)) : NaN;
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `${prefijo}${String(max + 1).padStart(ancho, '0')}`;
}

// Genera IDs consecutivos a partir de los existentes.
export function generadorIds(ids: string[], prefijo: string, ancho = 4) {
  let ultimo = siguienteId(ids, prefijo, ancho);
  let primero = true;
  return () => {
    if (!primero) ultimo = siguienteId([ultimo], prefijo, ancho);
    primero = false;
    return ultimo;
  };
}

// ---------- Filas a escribir (mismo orden de columnas que cada hoja) ----------

const vacio = (v: number | null | undefined) => v ?? '';

export const filas = {
  producto: (p: Producto): ValorCelda[] => [p.id, p.producto, p.unidad, vacio(p.minimo)],
  contacto: (c: Pick<Contacto, 'id' | 'rol' | 'nombre'> & Partial<Contacto>): ValorCelda[] => [
    c.id, c.rol, c.nombre, c.tipo, c.telefono, c.direccion, c.email, c.localidad, c.provincia, c.observaciones,
  ],
  precio: (p: Precio): ValorCelda[] => [p.productoId, p.producto, p.precio, p.desde],
  regla: (r: ReglaComision): ValorCelda[] => [r.vendedorId, r.productoId, r.porcentaje, r.desde],
  compra: (c: Omit<Compra, 'fila' | 'importe'>): ValorCelda[] => [
    c.fecha, c.depositoId, c.proveedor, c.contactoId, c.productoId, c.producto, c.cantidad, vacio(c.precio),
    c.precio === null ? '' : redondear(c.cantidad * c.precio), c.remito, c.pedidoId, c.nota,
  ],
  pedido: (p: Pedido): ValorCelda[] => [p.id, p.fecha, p.contactoId, p.cliente, p.tipo, p.localidad, p.provincia, p.depositoId, p.nota],
  pedidoItem: (i: PedidoItem): ValorCelda[] => [i.pedidoId, i.linea, i.productoId, i.producto, i.cantidad, vacio(i.precioLista), i.precio],
  estado: (ref: string, estado: string, momento: Date): ValorCelda[] => [ref, { momento }, estado],
  pedidoVendedor: (p: PedidoVendedor): ValorCelda[] => [p.pedidoId, p.vendedorId],
  venta: (v: Venta): ValorCelda[] => [v.id, v.fecha, v.pedidoId, v.depositoId, v.nota],
  ventaItem: (i: VentaItem): ValorCelda[] => [i.ventaId, i.linea, i.pedidoLinea, i.productoId, i.producto, i.cantidad, i.precio, i.importe, vacio(i.costo)],
  ventaComision: (c: VentaComision): ValorCelda[] => [c.ventaId, c.linea, c.vendedorId, c.vendedor, vacio(c.porcentajeRegla), c.porcentaje, c.monto],
  flete: (f: Flete): ValorCelda[] => [f.id, f.fecha, f.transporte, f.contactoId, f.origenId, f.destinoId, vacio(f.costo), f.guia, f.nota],
  fleteItem: (i: FleteItem): ValorCelda[] => [i.fleteId, i.productoId, i.producto, i.cantidad],
  pedidoFlete: (p: PedidoFlete): ValorCelda[] => [p.pedidoId, p.fleteId, vacio(p.costoAsignado)],
  ajuste: (a: Ajuste): ValorCelda[] => [a.fecha, a.depositoId, a.productoId, a.producto, a.cantidad, a.motivo],
};

// Filas por hoja que se escriben juntas en una operación.
export type Escritura = Partial<Record<ClaveHoja, ValorCelda[][]>>;

// ---------- Operaciones ----------

export interface LineaNuevoPedido { producto: Producto; cantidad: number; precio: number; precioLista: number | null }
export interface LineaEntrega {
  linea: LineaPedido; cantidad: number; costo: number | null;
  comisiones: { vendedor: Vendedor; porcentajeRegla: number; porcentaje: number }[];
}

// Arma las filas de una entrega (venta) de un pedido.
export function escribirEntrega(venta: Venta, lineas: LineaEntrega[]): Escritura {
  const items: VentaItem[] = [];
  const comisiones: VentaComision[] = [];
  lineas.filter((l) => l.cantidad > 0).forEach((l, i) => {
    const importe = redondear(l.cantidad * l.linea.precio);
    const linea = i + 1;
    items.push({
      ventaId: venta.id, linea, pedidoLinea: l.linea.linea, productoId: l.linea.productoId, producto: l.linea.producto,
      cantidad: l.cantidad, precio: l.linea.precio, importe, costo: l.costo,
    });
    for (const c of l.comisiones) {
      comisiones.push({
        ventaId: venta.id, linea, vendedorId: c.vendedor.id, vendedor: c.vendedor.nombre,
        porcentajeRegla: c.porcentajeRegla, porcentaje: c.porcentaje, monto: montoComision(importe, c.porcentaje),
      });
    }
  });
  return {
    ventas: [filas.venta(venta)],
    ventasItems: items.map(filas.ventaItem),
    ...(comisiones.length > 0 ? { ventasComisiones: comisiones.map(filas.ventaComision) } : {}),
  };
}

// Une varias escrituras en una.
export function unir(...escrituras: Escritura[]): Escritura {
  const res: Escritura = {};
  for (const e of escrituras) {
    for (const k of Object.keys(e) as ClaveHoja[]) res[k] = [...(res[k] ?? []), ...(e[k] ?? [])];
  }
  return res;
}
