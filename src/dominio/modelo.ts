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
// El cliente, su tipo y su localidad salen del contacto.
export interface Pedido { id: string; fecha: Date | null; contactoId: string; depositoId: string; nota: string }
export interface PedidoItem {
  pedidoId: string; linea: number; productoId: string; cantidad: number;
  precioLista: number | null; precio: number;
}
export interface RegistroEstado { ref: string; fecha: Date | null; estado: string }
export interface PedidoVendedor { pedidoId: string; vendedorId: string }
export interface Venta { id: string; fecha: Date | null; pedidoId: string; depositoId: string; nota: string }
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
export type Medio = 'efectivo' | 'transferencia';
export const MEDIOS: readonly Medio[] = ['efectivo', 'transferencia'];
export const NOMBRE_MEDIO: Record<Medio, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia' };
// `vendedores`: vendedores cuyas comisiones se le acreditan. `duenio`: el dueño de la mercadería.
// Costo de envío vigente desde `desde`: las entregas de pedidos por menos de `minimo` le cobran `costo` al cliente.
export interface ReglaEnvio { minimo: number; costo: number; desde: Date | null }
// Envío que se le cobra al cliente en una entrega. `vendedorId`: quien hizo la entrega y se queda con el envío
// (vacío si queda para el negocio). `costoRegla`: el que se propuso; `costo`: el que se cobró.
export interface VentaEnvio { ventaId: string; vendedorId: string; costoRegla: number | null; costo: number }
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
  recetas: Receta[]; recetasItems: RecetaItem[]; envios: ReglaEnvio[]; ventasEnvios: VentaEnvio[];
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

// ---------- Contactos y productos ----------

export const ROLES: readonly Rol[] = ['cliente', 'proveedor', 'transporte'];
export const NOMBRE_ROL: Record<Rol, string> = { cliente: 'Cliente', proveedor: 'Proveedor', transporte: 'Transporte' };
export const UNIDADES = ['kg', 'unid.'] as const;
// Un rol que no es de la lista se muestra como está escrito en la planilla.
export const nombreRol = (rol: string) => ((ROLES as readonly string[]).includes(rol) ? NOMBRE_ROL[rol as Rol] : rol);

const mismoNombre = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

// Por qué no se puede guardar un contacto nuevo o corregido, o null si se puede. Los formularios eligen un contacto
// por su nombre, así que no puede haber dos con el mismo nombre y rol.
export function problemaContacto(contactos: Contacto[], c: Contacto): string | null {
  if (!c.nombre.trim()) return 'Ingresá el nombre.';
  if (!(ROLES as readonly string[]).includes(c.rol)) return 'Elegí si es cliente, proveedor o transporte.';
  const otro = contactos.find((x) => x.id !== c.id && x.rol === c.rol && mismoNombre(x.nombre, c.nombre));
  return otro ? `Ya hay un ${nombreRol(c.rol).toLowerCase()} que se llama ${otro.nombre}.` : null;
}

// Lo mismo para un producto: los formularios lo eligen por su nombre.
export function problemaProducto(productos: Producto[], p: Producto): string | null {
  if (!p.producto.trim()) return 'Ingresá el nombre del producto.';
  if (!p.unidad) return 'Elegí la unidad.';
  if (p.minimo !== null && !(p.minimo >= 0)) return 'El mínimo no puede ser negativo.';
  const otro = productos.find((x) => x.id !== p.id && mismoNombre(x.producto, p.producto));
  return otro ? `Ya hay un producto que se llama ${otro.producto}.` : null;
}

// Si un contacto tiene pedidos, compras o fletes: su rol ya no se cambia, porque esas filas dejarían de cuadrar
// (un pedido a un proveedor, una compra a un cliente).
export const contactoEnUso = (datos: Pick<Datos, 'pedidos' | 'compras' | 'fletes'>, id: string) =>
  datos.pedidos.some((p) => p.contactoId === id) || datos.compras.some((c) => c.contactoId === id)
  || datos.fletes.some((f) => f.contactoId === id);

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

// Regla de envío vigente a una fecha (null si no hay ninguna).
export const reglaEnvio = (reglas: ReglaEnvio[], fecha: Date | null) => vigente(reglas, fecha);

// Envío que se propone para una entrega del pedido: el costo de la regla vigente si el pedido es por menos del
// mínimo. Se cobra una vez por pedido: si una entrega anterior ya registró el envío (aunque haya sido 0), es 0.
export function envioPropuesto(
  datos: Pick<Datos, 'envios' | 'ventas' | 'ventasEnvios'>, pedidoId: string, importePedido: number, fecha: Date | null,
) {
  const regla = reglaEnvio(datos.envios, fecha);
  if (!regla || importePedido >= regla.minimo) return 0;
  const ventas = new Set(datos.ventas.filter((v) => v.pedidoId === pedidoId).map((v) => v.id));
  return datos.ventasEnvios.some((e) => ventas.has(e.ventaId)) ? 0 : regla.costo;
}

// Costo de cada producto: el precio unitario de su última compra con precio, de cualquier depósito. La última es la
// de fecha más reciente; a igual fecha, la fila agregada después. Una compra sin fecha cuenta como la más vieja.
export function costosUltimaCompra(compras: Compra[]) {
  const ultima = new Map<string, Compra>();
  for (const c of compras) {
    if (c.precio === null || c.cantidad <= 0) continue;
    const previa = ultima.get(c.productoId);
    if (!previa || (c.fecha?.getTime() ?? 0) >= (previa.fecha?.getTime() ?? 0)) ultima.set(c.productoId, c);
  }
  return new Map([...ultima].map(([id, c]) => [id, c.precio ?? 0]));
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
  sinCosto: boolean; ganancia: number; ventas: Venta[];
  envios: number; // envío cobrado al cliente en sus entregas
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
  const envioDeVenta = new Map(datos.ventasEnvios.map((e) => [e.ventaId, e]));

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
    const envios = vs.flatMap((v) => envioDeVenta.get(v.id) ?? []);
    // El envío que se queda el vendedor entra y sale: solo suma a la ganancia el que queda para el negocio.
    const enviosNegocio = envios.reduce((s, e) => s + (e.vendedorId === '' ? e.costo : 0), 0);
    return {
      pedido, estado, lineas, ventas: vs,
      vendedores: (vendedores.get(pedido.id) ?? []).map((v) => v.vendedorId),
      importePedido: redondear(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0)),
      importeEntregado, comisiones, costoMercaderia,
      envios: redondear(envios.reduce((s, e) => s + e.costo, 0)),
      sinCosto: its.some((it) => it.costo === null),
      // Los fletes no se asignan a pedidos: son gasto de logística del mes.
      ganancia: redondear(importeEntregado + enviosNegocio - comisiones - costoMercaderia),
    };
  });
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

// Costo de los insumos por unidad de lo que sale, con los costos de hoy (los de la última compra). Null si algún insumo no tiene
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

// Una entrega (venta) de un pedido con sus ítems, comisiones y envío, lista para guardar.
export interface Entrega { venta: Venta; items: VentaItem[]; comisiones: VentaComision[]; envio: VentaEnvio | null }

export type EnvioEntrega = Omit<VentaEnvio, 'ventaId'>;

// Numera los ítems entregados (se saltean las líneas sin cantidad), calcula importes y una comisión
// por vendedor y línea. El envío se guarda si se propuso o se cobró: así las entregas siguientes del pedido
// ya no lo proponen.
export function armarEntrega(venta: Venta, lineas: LineaEntrega[], envio: EnvioEntrega | null = null): Entrega {
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
  const conEnvio = envio !== null && (envio.costo > 0 || (envio.costoRegla ?? 0) > 0);
  return { venta, items, comisiones, envio: envio && conEnvio ? { ventaId: venta.id, ...envio } : null };
}

// ---------- Corrección de un pedido ----------

// Línea del pedido corregido. `linea` es el número que tenía en el pedido, o null si se agrega.
export interface LineaCorregida { linea: number | null; productoId: string; cantidad: number; precio: number }

// Un pedido corregido y sus entregas ya registradas, rehechas con el depósito, los precios y los vendedores nuevos.
export interface CorreccionPedido {
  pedido: Pedido; items: PedidoItem[]; vendedores: string[];
  preciosNuevos: Precio[]; // productos sin precio de lista, que quedan con el precio del pedido
  entregas: Omit<Entrega, 'envio'>[];
}

// Por qué no se puede corregir así el pedido, o null si se puede. Lo ya entregado de una línea no se deshace: la
// línea no se quita, no cambia de producto y su cantidad no baja de lo entregado.
export function problemaCorreccionPedido(resumen: ResumenPedido, lineas: LineaCorregida[]): string | null {
  if (lineas.length === 0) return 'El pedido tiene que tener al menos un producto.';
  if (lineas.some((l) => !(l.cantidad > 0))) return 'Todas las cantidades tienen que ser mayores a 0.';
  if (lineas.some((l) => !(l.precio >= 0))) return 'Falta el precio de algún producto.';
  for (const l of resumen.lineas.filter((x) => x.entregado > 0)) {
    const nueva = lineas.find((x) => x.linea === l.linea);
    if (!nueva) return 'No se puede quitar un producto que ya se entregó.';
    if (nueva.productoId !== l.productoId) return 'No se puede cambiar un producto que ya se entregó.';
    if (nueva.cantidad < l.entregado) return 'La cantidad no puede ser menor que lo ya entregado.';
  }
  return null;
}

// Arma el pedido corregido. Las líneas que siguen con el mismo producto conservan su número y su precio de lista;
// las nuevas (o con otro producto) toman el precio de lista vigente a la fecha del pedido y, si no hay, el precio del
// pedido pasa a la lista, como al registrarlo. Las entregas del pedido
// toman el depósito nuevo si salían del anterior, el precio nuevo de su línea (con su importe y sus comisiones) y
// los vendedores nuevos: el que sigue conserva su porcentaje y el que se agrega cobra el de la regla vigente a la
// fecha de la entrega. El costo, las cantidades, los envíos y los cobros no cambian.
export function corregirPedido(
  datos: Pick<Datos, 'precios' | 'reglas' | 'vendedores' | 'ventasItems' | 'ventasComisiones'>,
  anterior: ResumenPedido, pedido: Pedido, lineas: LineaCorregida[], vendedores: string[],
): CorreccionPedido {
  const { id } = anterior.pedido;
  let siguiente = Math.max(0, ...anterior.lineas.map((l) => l.linea));
  const conservadas = new Set<number>();
  const items: PedidoItem[] = lineas.map((l) => {
    const previa = anterior.lineas.find((x) => x.linea === l.linea && x.productoId === l.productoId);
    if (previa) conservadas.add(previa.linea);
    return {
      pedidoId: id, linea: l.linea ?? ++siguiente, productoId: l.productoId, cantidad: l.cantidad,
      precioLista: previa ? previa.precioLista : precioVigente(datos.precios, l.productoId, pedido.fecha), precio: l.precio,
    };
  });
  const preciosNuevos = unicosPor(items.filter((it) => !conservadas.has(it.linea) && it.precioLista === null), (it) => it.productoId)
    .map((it) => ({ productoId: it.productoId, precio: it.precio, desde: pedido.fecha }));

  const precioDe = new Map(items.map((it) => [it.linea, it.precio]));
  const conocidos = new Set(datos.vendedores.map((v) => v.id));
  const entregas = anterior.ventas.map((v) => {
    const venta = { ...v, depositoId: v.depositoId === anterior.pedido.depositoId ? pedido.depositoId : v.depositoId };
    const previas = datos.ventasComisiones.filter((c) => c.ventaId === v.id);
    const ventaItems = datos.ventasItems.filter((it) => it.ventaId === v.id).map((it) => {
      const precio = precioDe.get(it.pedidoLinea) ?? it.precio;
      return { ...it, precio, importe: redondear(it.cantidad * precio) };
    });
    const comisiones = ventaItems.flatMap((it) => vendedores.flatMap((vendedorId) => {
      const previa = previas.find((c) => c.linea === it.linea && c.vendedorId === vendedorId);
      if (!previa && !conocidos.has(vendedorId)) return [];
      const regla = previa ? previa.porcentajeRegla : porcentajeRegla(datos.reglas, vendedorId, it.productoId, v.fecha);
      const porcentaje = previa ? previa.porcentaje : regla ?? 0;
      return [{ ventaId: v.id, linea: it.linea, vendedorId, porcentajeRegla: regla, porcentaje, monto: montoComision(it.importe, porcentaje) }];
    }));
    return { venta, items: ventaItems, comisiones };
  });
  return { pedido: { ...pedido, id }, items, vendedores, preciosNuevos, entregas };
}

const unicosPor = <T>(lista: T[], clave: (x: T) => string) => [...new Map(lista.map((x) => [clave(x), x])).values()];

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

// Importe de cada venta: Σ importe de sus ítems + envío.
export function importePorVenta(datos: Pick<Datos, 'ventasItems' | 'ventasEnvios'>) {
  const res = new Map<string, number>();
  for (const it of datos.ventasItems) res.set(it.ventaId, redondear((res.get(it.ventaId) ?? 0) + it.importe));
  for (const e of datos.ventasEnvios) res.set(e.ventaId, redondear((res.get(e.ventaId) ?? 0) + e.costo));
  return res;
}

export function cobradoPorVenta(cobros: Cobro[]) {
  const res = new Map<string, number>();
  for (const c of cobros) res.set(c.ventaId, redondear((res.get(c.ventaId) ?? 0) + c.importe));
  return res;
}

// `importe` incluye el envío.
export interface CuentaVenta {
  venta: Venta; pedido: Pedido | undefined; importe: number; envio: VentaEnvio | undefined; cobrado: number; saldo: number;
}

// Todas las ventas con lo cobrado y lo que falta cobrar.
export function cuentasVentas(datos: Datos): CuentaVenta[] {
  const importes = importePorVenta(datos);
  const cobrado = cobradoPorVenta(datos.cobros);
  const pedidos = new Map(datos.pedidos.map((p) => [p.id, p]));
  const envios = new Map(datos.ventasEnvios.map((e) => [e.ventaId, e]));
  return datos.ventas.map((venta) => {
    const importe = importes.get(venta.id) ?? 0;
    const c = cobrado.get(venta.id) ?? 0;
    return { venta, pedido: pedidos.get(venta.pedidoId), importe, envio: envios.get(venta.id), cobrado: c, saldo: redondear(importe - c) };
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

  for (const e of datos.ventasEnvios) {
    const socio = deVendedor.get(e.vendedorId);
    const cu = socio && cuentas.get(socio.id);
    if (!cu || e.costo === 0) continue;
    cu.envios += e.costo;
    cu.movimientos.push({
      fecha: ventas.get(e.ventaId)?.fecha ?? null, tipo: 'envio', ref: e.ventaId, detalle: cliente(e.ventaId), medio: '',
      importe: -e.costo, saldo: 0,
    });
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
// después las comisiones y envíos y después las rendiciones.
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
