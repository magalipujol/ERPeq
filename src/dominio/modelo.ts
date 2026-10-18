// Dominio de ERPeq: tipos y cálculos (stock por depósito, estados, precios, comisiones, ganancia).
// No sabe nada de la base de datos (hojas, columnas, celdas) ni del navegador: se prueba con Node.
// La referencia del modelo es spec/modelo-de-datos.md y las capas están en spec/arquitectura.md.

export interface Deposito { id: string; nombre: string; localidad: string }
export interface Producto { id: string; producto: string; unidad: string; minimo: number | null }
export type Rol = 'cliente' | 'proveedor' | 'transporte';
export interface Contacto {
  id: string; rol: string; nombre: string; tipo: string; telefono: string; direccion: string; email: string;
  localidad: string; provincia: string; observaciones: string;
}
// Contacto que se da de alta junto con una operación: lo que no se conoce queda vacío.
export type ContactoNuevo = Pick<Contacto, 'id' | 'rol' | 'nombre'> & Partial<Contacto>;
// `localidad`: donde trabaja el vendedor; se lo propone en los pedidos de clientes de esa localidad.
export interface Vendedor { id: string; nombre: string; activo: boolean; localidad: string }
export interface Precio { productoId: string; precio: number; desde: Date | null }
export interface ReglaComision { vendedorId: string; productoId: string; porcentaje: number; desde: Date | null }
export interface Compra {
  fila: number; // identifica la compra, que no tiene ID (en la planilla es el número de fila)
  fecha: Date | null; depositoId: string; contactoId: string; productoId: string;
  cantidad: number; precio: number | null; importe: number | null; remito: string; pedidoId: string; nota: string;
}
// El cliente, su tipo y su localidad salen del contacto. `cobraEnvio`: al cliente se le cobra el envío (el monto
// se fija en la entrega, con la configuración de *Envío* vigente a la fecha del pedido).
export interface Pedido { id: string; fecha: Date | null; contactoId: string; depositoId: string; nota: string; cobraEnvio: boolean }
export interface PedidoItem {
  pedidoId: string; linea: number; productoId: string; cantidad: number;
  precioLista: number | null; precio: number;
}
export interface RegistroEstado { ref: string; fecha: Date | null; estado: string }
export interface PedidoVendedor { pedidoId: string; vendedorId: string }
// `envio`: lo que se le cobró al cliente por el envío en esta entrega (0 si nada); se le acredita al vendedor
// `envioVendedorId` (vacío si no hay envío).
export interface Venta {
  id: string; fecha: Date | null; pedidoId: string; depositoId: string; nota: string; envio: number; envioVendedorId: string;
}
export interface VentaItem {
  ventaId: string; linea: number; pedidoLinea: number; productoId: string; cantidad: number;
  precio: number; importe: number; costo: number | null;
}
export interface VentaComision {
  ventaId: string; linea: number; vendedorId: string; porcentajeRegla: number | null;
  porcentaje: number; monto: number;
}
// Un flete mueve productos, no pedidos: su costo es un gasto de logística del mes. `salida` y `llegadaEstimada`
// son las previstas al cargarlo (fecha y hora); las reales salen de sus estados.
export interface Flete {
  id: string; fecha: Date | null; contactoId: string; origenId: string; destinoId: string;
  costo: number | null; guia: string; nota: string; salida: Date | null; llegadaEstimada: Date | null;
}
export interface FleteItem { fleteId: string; productoId: string; cantidad: number }
// Configuración del envío, con historial: los pedidos de menos de `minimo` pagan `costo` de envío.
export interface ConfigEnvio { minimo: number; costo: number; desde: Date | null }
export type Medio = 'efectivo' | 'transferencia';
export const MEDIOS: readonly Medio[] = ['efectivo', 'transferencia'];
export const NOMBRE_MEDIO: Record<Medio, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia' };
// `vendedores`: vendedores cuyas comisiones se le acreditan. `duenio`: el dueño de la mercadería.
export interface Socio { id: string; nombre: string; vendedores: string[]; duenio: boolean }
export interface Cobro { fecha: Date | null; ventaId: string; importe: number; medio: string; socioId: string; nota: string }
export interface Rendicion { fecha: Date | null; deId: string; aId: string; importe: number; medio: string; nota: string }
export interface Ajuste { fecha: Date | null; depositoId: string; productoId: string; cantidad: number; motivo: string }
// Cada versión de una receta es una fila: cambiarla o darla de baja agrega una versión nueva con su `desde`.
// `productoId` es lo que sale: un producto de Productos, con su precio de lista. `cantidad` es lo que sale de
// una tanda, en la unidad del producto (con la merma ya descontada).
export interface Receta { id: string; version: number; desde: Date | null; productoId: string; cantidad: number; activa: boolean }
export interface RecetaItem { recetaId: string; version: number; productoId: string; cantidad: number }

export interface Datos {
  depositos: Deposito[]; productos: Producto[]; contactos: Contacto[]; tipos: string[]; vendedores: Vendedor[];
  precios: Precio[]; reglas: ReglaComision[]; compras: Compra[]; pedidos: Pedido[]; pedidosItems: PedidoItem[];
  pedidosEstados: RegistroEstado[]; pedidosVendedores: PedidoVendedor[]; ventas: Venta[]; ventasItems: VentaItem[];
  ventasComisiones: VentaComision[]; fletes: Flete[]; fletesItems: FleteItem[]; fletesEstados: RegistroEstado[];
  ajustes: Ajuste[]; socios: Socio[]; cobros: Cobro[]; rendiciones: Rendicion[];
  recetas: Receta[]; recetasItems: RecetaItem[]; envios: ConfigEnvio[];
}

// Nombres de lo que las filas referencian por ID. Un ID que no existe se muestra tal cual.
export interface Nombres {
  producto: (id: string) => string;
  contacto: (id: string) => string;
  vendedor: (id: string) => string;
  socio: (id: string) => string;
  deposito: (id: string) => string;
}

export function nombres(datos: Pick<Datos, 'productos' | 'contactos' | 'vendedores' | 'socios' | 'depositos'>): Nombres {
  const de = <T extends { id: string }>(lista: T[], nombre: (x: T) => string) => {
    const m = new Map(lista.map((x) => [x.id, nombre(x)]));
    return (id: string) => m.get(id) ?? id;
  };
  return {
    producto: de(datos.productos, (p) => p.producto),
    contacto: de(datos.contactos, (c) => c.nombre),
    vendedor: de(datos.vendedores, (v) => v.nombre),
    socio: de(datos.socios, (s) => s.nombre),
    deposito: de(datos.depositos, (d) => d.nombre),
  };
}

export function redondear(n: number, d?: number): number;
export function redondear(n: number | null, d?: number): number | null;
export function redondear(n: number | null, d = 2) {
  return n === null ? null : Math.round(n * 10 ** d) / 10 ** d;
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
export const fleteEnCurso = (e: EstadoFlete) => e === 'preparacion' || e === 'camino';
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

// ---------- Envío ----------
// Los pedidos de menos del mínimo pagan un costo de envío, que va para el vendedor además de su comisión.
// La referencia es la sección "Envío" de spec/modelo-de-datos.md.

// Configuración de envío vigente a una fecha (null si no hay ninguna).
export const envioVigente = (envios: ConfigEnvio[], fecha: Date | null) => vigente(envios, fecha);

// Si a un pedido con este importe (sin envío) se le propone cobrar el envío.
export function proponerEnvio(envios: ConfigEnvio[], importe: number, fecha: Date | null) {
  const c = envioVigente(envios, fecha);
  return c !== null && c.costo > 0 && importe > 0 && importe < c.minimo;
}

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

// `importePedido` e `importeEntregado` son de los productos, sin envío; `envio` es lo cobrado de envío en sus
// entregas. La ganancia no cuenta el envío (va entero para el vendedor) ni los fletes (son gasto del mes).
export interface ResumenPedido {
  pedido: Pedido; estado: EstadoPedido; lineas: LineaPedido[]; vendedores: string[];
  importePedido: number; importeEntregado: number; envio: number; comisiones: number; costoMercaderia: number;
  sinCosto: boolean; ganancia: number; ventas: Venta[];
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
    return {
      pedido, estado, lineas, ventas: vs,
      vendedores: (vendedores.get(pedido.id) ?? []).map((v) => v.vendedorId),
      importePedido: redondear(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0)),
      importeEntregado, envio: redondear(vs.reduce((s, v) => s + v.envio, 0)), comisiones, costoMercaderia,
      sinCosto: its.some((it) => it.costo === null),
      ganancia: redondear(importeEntregado - comisiones - costoMercaderia),
    };
  });
}

// Envío a cobrar en una entrega nueva del pedido: el costo vigente a la fecha del pedido, si el pedido cobra
// envío y ninguna entrega anterior lo cobró (se cobra una sola vez, en la primera entrega). 0 si no corresponde.
export function envioDeEntrega(r: Pick<ResumenPedido, 'pedido' | 'ventas'>, envios: ConfigEnvio[]) {
  if (!r.pedido.cobraEnvio || r.ventas.some((v) => v.envio > 0)) return 0;
  return envioVigente(envios, r.pedido.fecha)?.costo ?? 0;
}

// ---------- Propuesta para un pedido nuevo ----------

// Compara localidades sin mayúsculas ni tildes. La de un depósito puede traer la provincia: "Rosario, Santa Fe".
const claveLocalidad = (s: string) => (s.split(',')[0] ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();
export const mismaLocalidad = (a: string, b: string) => claveLocalidad(a) !== '' && claveLocalidad(a) === claveLocalidad(b);

export interface PropuestaPedido { vendedores: string[]; depositoId: string | null }

// Vendedores y depósito que se proponen para un pedido del cliente. Primero los de su localidad (los
// vendedores activos y el depósito que están ahí); lo que no se resuelve así sale de su último pedido.
// `depositoId` es null si no hay de dónde sacarlo.
export function propuestaPedido(
  datos: Pick<Datos, 'contactos' | 'vendedores' | 'depositos' | 'pedidos' | 'pedidosVendedores'>, contactoId: string,
): PropuestaPedido {
  const localidad = datos.contactos.find((c) => c.id === contactoId)?.localidad ?? '';
  const ultimo = datos.pedidos.findLast((p) => p.contactoId === contactoId);
  const locales = datos.vendedores.filter((v) => v.activo && mismaLocalidad(v.localidad, localidad)).map((v) => v.id);
  const deposito = datos.depositos.find((d) => mismaLocalidad(d.localidad, localidad));
  return {
    vendedores: locales.length > 0 ? locales
      : ultimo ? datos.pedidosVendedores.filter((v) => v.pedidoId === ultimo.id).map((v) => v.vendedorId) : [],
    depositoId: deposito?.id ?? ultimo?.depositoId ?? null,
  };
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

// Líneas pendientes de un pedido cuyo producto falta en el depósito de entrega.
export const lineasConFaltante = (s: Stock, r: ResumenPedido) =>
  r.lineas.filter((l) => l.pendiente > 0 && faltante(s, l.productoId, r.pedido.depositoId) > 0);

// Flete que propone Inicio para cubrir el faltante de algunos pedidos de un mismo depósito.
export interface FleteSugerido {
  origenId: string; destinoId: string; pedidos: string[]; items: { productoId: string; cantidad: number }[];
}

// Por producto con faltante, lo pendiente de los pedidos elegidos, sin pasar el faltante del depósito: lo que ya
// hay o viene en camino cubre primero. El origen es el otro depósito con más stock libre (en depósito, menos lo
// reservado para fletes y lo comprometido con sus pedidos) para lo que hay que llevar; '' si no hay otro depósito.
export function fleteParaFaltantes(s: Stock, depositos: Deposito[], destinoId: string, pedidos: ResumenPedido[]): FleteSugerido {
  const pendiente = new Map<string, number>();
  for (const r of pedidos) {
    for (const l of lineasConFaltante(s, r)) pendiente.set(l.productoId, (pendiente.get(l.productoId) ?? 0) + l.pendiente);
  }
  const items = [...pendiente].map(([productoId, cant]) => ({
    productoId, cantidad: redondear(Math.min(cant, faltante(s, productoId, destinoId)), 3),
  }));
  const libre = (productoId: string, d: string) => {
    const v = (m: Map<string, PorDeposito>) => m.get(productoId)?.[d] ?? 0;
    return Math.max(0, v(s.enDeposito) - v(s.reservado) - v(s.comprometido));
  };
  let origenId = '';
  let mejor = -1;
  for (const d of depositos) {
    if (d.id === destinoId) continue;
    const cubre = items.reduce((t, it) => t + Math.min(it.cantidad, libre(it.productoId, d.id)), 0);
    if (cubre > mejor) { origenId = d.id; mejor = cubre; }
  }
  return { origenId, destinoId, pedidos: pedidos.map((r) => r.pedido.id), items };
}

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

// ---------- Recetas y fabricación ----------
// La referencia es spec/recetas.md.

export interface VersionReceta { receta: Receta; items: RecetaItem[] }

// Versión vigente de cada receta a una fecha: la de `desde` más reciente que no sea posterior y, ante la misma
// fecha, la de número de versión más alto. Incluye las dadas de baja (`activa` en false).
export function recetasVigentes(datos: Pick<Datos, 'recetas' | 'recetasItems'>, fecha: Date | null): VersionReceta[] {
  const mejor = new Map<string, Receta>();
  for (const r of datos.recetas) {
    if (fecha && r.desde && r.desde > fecha) continue;
    const m = mejor.get(r.id);
    const t = r.desde?.getTime() ?? 0;
    const tm = m?.desde?.getTime() ?? 0;
    if (!m || t > tm || (t === tm && r.version >= m.version)) mejor.set(r.id, r);
  }
  return [...mejor.values()].map((receta) => ({
    receta,
    items: datos.recetasItems.filter((it) => it.recetaId === receta.id && it.version === receta.version),
  }));
}

// Número de la próxima versión de una receta (1 si es nueva).
export const siguienteVersion = (recetas: Receta[], id: string) =>
  recetas.filter((r) => r.id === id).reduce((m, r) => Math.max(m, r.version), 0) + 1;

// Suma de los insumos que se miden en la unidad dada: lo que saldría de una tanda sin merma.
export function sumaInsumos(items: { productoId: string; cantidad: number }[], productos: Producto[], unidad: string) {
  const unidadDe = new Map(productos.map((p) => [p.id, p.unidad]));
  return redondear(items.filter((it) => unidadDe.get(it.productoId) === unidad).reduce((s, it) => s + it.cantidad, 0), 3);
}

// Merma: qué parte de los insumos no sale como producto (0,1 = 10 %). Null si no hay con qué comparar.
export const merma = (entra: number, sale: number) => (entra > 0 ? redondear(1 - sale / entra, 4) : null);

export interface Insumo { productoId: string; cantidad: number }

// Una fabricación es un grupo de ajustes en un depósito, con el mismo motivo: "Fabricación FA0001 (RE0001 v2)".
export interface Fabricacion {
  id: string; fecha: Date | null; depositoId: string; recetaId: string; version: number; productoId: string; cantidad: number;
}

const MOTIVO_FABRICACION = /^Fabricación (\S+) \((\S+) v(\d+)\)$/;

// Los ajustes que descuentan los insumos y suman el producto en el depósito. Los insumos sin cantidad no generan
// ajuste.
export function armarFabricacion(f: Fabricacion, insumos: Insumo[]): Ajuste[] {
  const motivo = `Fabricación ${f.id} (${f.recetaId} v${f.version})`;
  const ajuste = (productoId: string, cantidad: number): Ajuste => ({ fecha: f.fecha, depositoId: f.depositoId, productoId, cantidad, motivo });
  return [...insumos.filter((i) => i.cantidad > 0).map((i) => ajuste(i.productoId, -i.cantidad)), ajuste(f.productoId, f.cantidad)];
}

// Fabricaciones registradas, a partir de los ajustes con motivo de fabricación. Lo que sale es el ajuste positivo.
export function fabricaciones(ajustes: Ajuste[]): Fabricacion[] {
  const res = new Map<string, Fabricacion>();
  for (const a of ajustes) {
    const m = MOTIVO_FABRICACION.exec(a.motivo);
    if (!m || a.cantidad <= 0) continue;
    res.set(m[1], { id: m[1], fecha: a.fecha, depositoId: a.depositoId, recetaId: m[2], version: Number(m[3]), productoId: a.productoId, cantidad: a.cantidad });
  }
  return [...res.values()];
}

// Costo de los insumos por unidad de lo que sale, con los costos promedio de hoy. Null si algún insumo no tiene
// costo o no sale nada. Es una estimación: no se guarda.
export function costoInsumos(insumos: Insumo[], sale: number, costos: Map<string, number>) {
  const usados = insumos.filter((i) => i.cantidad > 0);
  if (sale <= 0 || usados.some((i) => !costos.has(i.productoId))) return null;
  return redondear(usados.reduce((s, i) => s + i.cantidad * (costos.get(i.productoId) ?? 0), 0) / sale);
}

// ---------- Entregas ----------

export interface LineaEntrega {
  linea: LineaPedido; cantidad: number; costo: number | null;
  comisiones: { vendedor: Vendedor; porcentajeRegla: number; porcentaje: number }[];
}

// Una entrega (venta) de un pedido con sus ítems y comisiones, lista para guardar.
export interface Entrega { venta: Venta; items: VentaItem[]; comisiones: VentaComision[] }

// Numera los ítems entregados (se saltean las líneas sin cantidad), calcula importes y una comisión
// por vendedor y línea.
export function armarEntrega(venta: Venta, lineas: LineaEntrega[]): Entrega {
  const items: VentaItem[] = [];
  const comisiones: VentaComision[] = [];
  lineas.filter((l) => l.cantidad > 0).forEach((l, i) => {
    const importe = redondear(l.cantidad * l.linea.precio);
    const linea = i + 1;
    items.push({
      ventaId: venta.id, linea, pedidoLinea: l.linea.linea, productoId: l.linea.productoId, cantidad: l.cantidad, precio: l.linea.precio, importe, costo: l.costo,
    });
    for (const c of l.comisiones) {
      comisiones.push({
        ventaId: venta.id, linea, vendedorId: c.vendedor.id, porcentajeRegla: c.porcentajeRegla, porcentaje: c.porcentaje, monto: montoComision(importe, c.porcentaje),
      });
    }
  });
  return { venta, items, comisiones };
}

// Estados que se registran al dar de alta un flete: para uno ya despachado o terminado quedan también
// los anteriores.
export const caminoFlete = (estadoInicial: EstadoFlete): EstadoFlete[] =>
  estadoInicial === 'preparacion' ? ['preparacion']
    : estadoInicial === 'camino' ? ['preparacion', 'camino'] : ['preparacion', 'camino', 'finalizado'];

// ---------- Caja: cobros y cuentas entre socios ----------
// Cobros de las ventas, saldo a cobrar de cada venta y cuenta de cada socio frente al dueño de la
// mercadería. La referencia es la sección "Cobros y cuentas entre socios" de spec/modelo-de-datos.md.

export const duenio = (socios: Socio[]) => socios.find((s) => s.duenio);

// Socio al que se acreditan las comisiones de cada vendedor.
export function socioDeVendedor(socios: Socio[]) {
  const res = new Map<string, Socio>();
  for (const s of socios) for (const v of s.vendedores) if (!res.has(v)) res.set(v, s);
  return res;
}

// Lo que paga el cliente por cada venta: Σ importe de sus ítems + el envío.
export function importePorVenta(datos: Pick<Datos, 'ventas' | 'ventasItems'>) {
  const res = new Map<string, number>();
  for (const v of datos.ventas) if (v.envio > 0) res.set(v.id, v.envio);
  for (const it of datos.ventasItems) res.set(it.ventaId, redondear((res.get(it.ventaId) ?? 0) + it.importe));
  return res;
}

export function cobradoPorVenta(cobros: Cobro[]) {
  const res = new Map<string, number>();
  for (const c of cobros) res.set(c.ventaId, redondear((res.get(c.ventaId) ?? 0) + c.importe));
  return res;
}

export interface CuentaVenta { venta: Venta; pedido: Pedido | undefined; importe: number; cobrado: number; saldo: number }

// Todas las ventas con lo cobrado y lo que falta cobrar.
export function cuentasVentas(datos: Datos): CuentaVenta[] {
  const importes = importePorVenta(datos);
  const cobrado = cobradoPorVenta(datos.cobros);
  const pedidos = new Map(datos.pedidos.map((p) => [p.id, p]));
  return datos.ventas.map((venta) => {
    const importe = importes.get(venta.id) ?? 0;
    const c = cobrado.get(venta.id) ?? 0;
    return { venta, pedido: pedidos.get(venta.pedidoId), importe, cobrado: c, saldo: redondear(importe - c) };
  });
}

export const ventasACobrar = (datos: Datos) => cuentasVentas(datos).filter((c) => c.saldo > 0);

export type TipoMovimiento = 'cobro' | 'comision' | 'envio' | 'entrego' | 'recibio';
export interface MovimientoSocio {
  fecha: Date | null; tipo: TipoMovimiento; ref: string; detalle: string; medio: string;
  importe: number; // + suma a lo que el socio tiene del negocio; − resta
  saldo: number; // saldo de la cuenta después de este movimiento
}

export interface CuentaSocio {
  socio: Socio;
  cobradoEfectivo: number; cobradoTransferencia: number; comisiones: number; envios: number; entregado: number; recibido: number;
  // Positivo: el socio tiene plata del negocio y se la debe al dueño. Negativo: el dueño le debe.
  saldo: number;
  movimientos: MovimientoSocio[];
}

// Cuenta de cada socio que no es el dueño:
//   saldo = cobros que recibió − comisiones y envíos de sus vendedores − rendiciones que entregó + rendiciones que recibió
// Las comisiones y los envíos cuentan todos, también los de ventas que cobró otro socio o que todavía no se cobraron.
export function cuentasSocios(datos: Datos): CuentaSocio[] {
  const deVendedor = socioDeVendedor(datos.socios);
  const ventas = new Map(datos.ventas.map((v) => [v.id, v]));
  const n = nombres(datos);
  const clientes = new Map(datos.pedidos.map((p) => [p.id, n.contacto(p.contactoId)]));
  const cliente = (ventaId: string) => clientes.get(ventas.get(ventaId)?.pedidoId ?? '') ?? '';

  const cuentas = new Map(datos.socios.filter((s) => !s.duenio).map((socio) => [socio.id, {
    socio, cobradoEfectivo: 0, cobradoTransferencia: 0, comisiones: 0, envios: 0, entregado: 0, recibido: 0, saldo: 0,
    movimientos: [] as MovimientoSocio[],
  }]));

  for (const c of datos.cobros) {
    const cu = cuentas.get(c.socioId);
    if (!cu) continue;
    if (c.medio === 'efectivo') cu.cobradoEfectivo += c.importe;
    else cu.cobradoTransferencia += c.importe;
    cu.movimientos.push({ fecha: c.fecha, tipo: 'cobro', ref: c.ventaId, detalle: cliente(c.ventaId), medio: c.medio, importe: c.importe, saldo: 0 });
  }

  // Una fila por venta y socio, sumando sus ítems y vendedores.
  const comisiones = new Map<string, { socioId: string; ventaId: string; monto: number }>();
  for (const c of datos.ventasComisiones) {
    const socio = deVendedor.get(c.vendedorId);
    if (!socio || !cuentas.has(socio.id)) continue;
    const k = `${socio.id}|${c.ventaId}`;
    const x = comisiones.get(k) ?? { socioId: socio.id, ventaId: c.ventaId, monto: 0 };
    x.monto += c.monto;
    comisiones.set(k, x);
  }
  for (const x of comisiones.values()) {
    const cu = cuentas.get(x.socioId);
    if (!cu) continue;
    cu.comisiones += x.monto;
    cu.movimientos.push({
      fecha: ventas.get(x.ventaId)?.fecha ?? null, tipo: 'comision', ref: x.ventaId, detalle: cliente(x.ventaId), medio: '',
      importe: -redondear(x.monto), saldo: 0,
    });
  }

  for (const v of datos.ventas) {
    if (v.envio <= 0) continue;
    const socio = deVendedor.get(v.envioVendedorId);
    const cu = socio ? cuentas.get(socio.id) : undefined;
    if (!cu) continue;
    cu.envios += v.envio;
    cu.movimientos.push({ fecha: v.fecha, tipo: 'envio', ref: v.id, detalle: cliente(v.id), medio: '', importe: -v.envio, saldo: 0 });
  }

  for (const r of datos.rendiciones) {
    const de = cuentas.get(r.deId);
    if (de) {
      de.entregado += r.importe;
      de.movimientos.push({ fecha: r.fecha, tipo: 'entrego', ref: n.socio(r.aId), detalle: r.nota, medio: r.medio, importe: -r.importe, saldo: 0 });
    }
    const a = cuentas.get(r.aId);
    if (a) {
      a.recibido += r.importe;
      a.movimientos.push({ fecha: r.fecha, tipo: 'recibio', ref: n.socio(r.deId), detalle: r.nota, medio: r.medio, importe: r.importe, saldo: 0 });
    }
  }

  return [...cuentas.values()].map((cu) => ({
    ...cu,
    cobradoEfectivo: redondear(cu.cobradoEfectivo), cobradoTransferencia: redondear(cu.cobradoTransferencia),
    comisiones: redondear(cu.comisiones), envios: redondear(cu.envios), entregado: redondear(cu.entregado), recibido: redondear(cu.recibido),
    saldo: redondear(cu.cobradoEfectivo + cu.cobradoTransferencia - cu.comisiones - cu.envios - cu.entregado + cu.recibido),
    movimientos: conSaldo(cu.movimientos),
  }));
}

// Ordena por fecha y agrega el saldo acumulado. El orden es estable: ante la misma fecha quedan los cobros,
// después las comisiones, los envíos y las rendiciones.
function conSaldo(movimientos: MovimientoSocio[]) {
  let saldo = 0;
  return movimientos.toSorted((x, y) => (x.fecha?.getTime() ?? 0) - (y.fecha?.getTime() ?? 0))
    .map((m) => {
      saldo = redondear(saldo + m.importe);
      return { ...m, saldo };
    });
}

// Socio que propone la app para un cobro: el del primer vendedor del pedido que tenga socio; si no, el dueño.
export function socioPropuesto(socios: Socio[], vendedoresPedido: string[]) {
  const deVendedor = socioDeVendedor(socios);
  for (const v of vendedoresPedido) {
    const s = deVendedor.get(v);
    if (s) return s;
  }
  return duenio(socios) ?? socios.at(0);
}
