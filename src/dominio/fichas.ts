// Fichas: lo que se muestra de un pedido, una venta, un producto, un contacto, un flete o una compra al
// tocarlo en una tabla, con lo que tiene relacionado. Puro: no sabe de la UI. Ver spec/fichas.md.
import * as M from './modelo';

export type TipoFicha = 'pedido' | 'venta' | 'producto' | 'contacto' | 'flete' | 'compra';
// `id` de una compra es su número de fila (las compras no tienen ID).
export interface RefFicha { tipo: TipoFicha; id: string }

const recientes = <T extends { fecha: Date | null }>(lista: T[]) =>
  [...lista].sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));

export interface VentaDePedido { venta: M.Venta; importe: number; cobrado: number; saldo: number }

export interface FichaPedido {
  resumen: M.ResumenPedido;
  ventas: VentaDePedido[];
  compras: M.Compra[]; // compras hechas para este pedido
}

export function fichaPedido(datos: M.Datos, resumenes: M.ResumenPedido[], id: string): FichaPedido | null {
  const resumen = resumenes.find((r) => r.pedido.id === id);
  if (!resumen) return null;
  const cuentas = new Map(M.cuentasVentas(datos).map((c) => [c.venta.id, c]));
  return {
    resumen,
    ventas: recientes(resumen.ventas).map((venta) => {
      const c = cuentas.get(venta.id);
      return { venta, importe: c?.importe ?? 0, cobrado: c?.cobrado ?? 0, saldo: c?.saldo ?? 0 };
    }),
    compras: recientes(datos.compras.filter((c) => c.pedidoId === id)),
  };
}

export interface ItemVenta extends M.VentaItem { comision: number; ganancia: number | null }

export interface FichaVenta {
  venta: M.Venta;
  pedido: M.Pedido | undefined;
  items: ItemVenta[];
  comisiones: { vendedorId: string; monto: number }[]; // por vendedor, sumando los ítems
  cobros: M.Cobro[];
  envio: M.VentaEnvio | undefined;
  importe: number; cobrado: number; saldo: number; // el importe incluye el envío
  // Importe − comisiones − envío del vendedor − costo de la mercadería. Null si algún ítem no tiene costo.
  ganancia: number | null;
}

export function fichaVenta(datos: M.Datos, id: string): FichaVenta | null {
  const cuenta = M.cuentasVentas(datos).find((c) => c.venta.id === id);
  if (!cuenta) return null;
  const items = M.lineasVendidas(datos).filter((l) => l.ventaId === id)
    .map(({ venta: _v, pedido: _p, ...it }) => it).sort((a, b) => a.linea - b.linea);
  const porVendedor = new Map<string, number>();
  for (const c of datos.ventasComisiones.filter((x) => x.ventaId === id)) {
    porVendedor.set(c.vendedorId, M.redondear((porVendedor.get(c.vendedorId) ?? 0) + c.monto));
  }
  const comision = items.reduce((s, it) => s + it.comision, 0);
  const envioVendedor = cuenta.envio && cuenta.envio.vendedorId !== '' ? cuenta.envio.costo : 0;
  return {
    venta: cuenta.venta, pedido: cuenta.pedido, items,
    comisiones: [...porVendedor].map(([vendedorId, monto]) => ({ vendedorId, monto })),
    cobros: recientes(datos.cobros.filter((c) => c.ventaId === id)),
    envio: cuenta.envio, importe: cuenta.importe, cobrado: cuenta.cobrado, saldo: cuenta.saldo,
    ganancia: items.some((it) => it.ganancia === null) ? null
      : M.redondear(cuenta.importe - comision - envioVendedor - items.reduce((s, it) => s + it.cantidad * (it.costo ?? 0), 0)),
  };
}

export interface StockDeposito {
  depositoId: string; enDeposito: number; enTransito: number; reservado: number; comprometido: number;
}
export interface PedidoConProducto { resumen: M.ResumenPedido; pendiente: number }
export interface VentaDeProducto { venta: M.Venta; pedido: M.Pedido | undefined; cantidad: number; importe: number }

export interface FichaProducto {
  producto: M.Producto;
  precio: number | null; // de lista, vigente a la fecha
  costo: number | null; // promedio de las compras
  stock: StockDeposito[];
  receta: M.VersionReceta | undefined; // receta activa que lo fabrica
  usadoEn: M.VersionReceta[]; // recetas activas que lo usan como insumo
  pedidos: PedidoConProducto[]; // pedidos abiertos con algo pendiente de este producto
  compras: M.Compra[];
  ventas: VentaDeProducto[];
}

export function fichaProducto(
  datos: M.Datos, resumenes: M.ResumenPedido[], stock: M.Stock, costos: Map<string, number>, id: string, fecha: Date | null,
): FichaProducto | null {
  const producto = datos.productos.find((p) => p.id === id);
  if (!producto) return null;
  const de = (m: Map<string, M.PorDeposito>, d: string) => m.get(id)?.[d] ?? 0;
  const recetas = M.recetasVigentes(datos, fecha).filter((r) => r.receta.activa);
  const ventas = new Map<string, VentaDeProducto>();
  for (const l of M.lineasVendidas(datos).filter((x) => x.productoId === id)) {
    const v = ventas.get(l.ventaId) ?? { venta: l.venta, pedido: l.pedido, cantidad: 0, importe: 0 };
    v.cantidad = M.redondear(v.cantidad + l.cantidad, 3);
    v.importe = M.redondear(v.importe + l.importe);
    ventas.set(l.ventaId, v);
  }
  return {
    producto,
    precio: M.precioVigente(datos.precios, id, fecha),
    costo: costos.get(id) ?? null,
    stock: datos.depositos.map((d) => ({
      depositoId: d.id, enDeposito: de(stock.enDeposito, d.id), enTransito: de(stock.enTransito, d.id),
      reservado: de(stock.reservado, d.id), comprometido: de(stock.comprometido, d.id),
    })),
    receta: recetas.find((r) => r.receta.productoId === id),
    usadoEn: recetas.filter((r) => r.items.some((it) => it.productoId === id)),
    pedidos: resumenes.filter((r) => M.pedidoAbierto(r.estado)).flatMap((resumen) => {
      const pendiente = M.redondear(resumen.lineas.filter((l) => l.productoId === id).reduce((s, l) => s + l.pendiente, 0), 3);
      return pendiente > 0 ? [{ resumen, pendiente }] : [];
    }).sort((a, b) => (b.resumen.pedido.fecha?.getTime() ?? 0) - (a.resumen.pedido.fecha?.getTime() ?? 0)),
    compras: recientes(datos.compras.filter((c) => c.productoId === id)),
    ventas: [...ventas.values()].sort((a, b) => (b.venta.fecha?.getTime() ?? 0) - (a.venta.fecha?.getTime() ?? 0)),
  };
}

export interface FichaContacto {
  contacto: M.Contacto;
  pedidos: M.ResumenPedido[]; // como cliente
  aCobrar: number; // saldo de sus ventas
  compras: M.Compra[]; // como proveedor
  fletes: { flete: M.Flete; estado: M.EstadoFlete }[]; // como transporte
}

export function fichaContacto(datos: M.Datos, resumenes: M.ResumenPedido[], id: string): FichaContacto | null {
  const contacto = datos.contactos.find((c) => c.id === id);
  if (!contacto) return null;
  const estados = M.estadosActuales(datos.fletesEstados);
  return {
    contacto,
    pedidos: resumenes.filter((r) => r.pedido.contactoId === id)
      .sort((a, b) => (b.pedido.fecha?.getTime() ?? 0) - (a.pedido.fecha?.getTime() ?? 0)),
    aCobrar: M.redondear(M.cuentasVentas(datos).filter((c) => c.pedido?.contactoId === id).reduce((s, c) => s + c.saldo, 0)),
    compras: recientes(datos.compras.filter((c) => c.contactoId === id)),
    fletes: recientes(datos.fletes.filter((f) => f.contactoId === id)).map((flete) => ({ flete, estado: M.estadoFlete(estados, flete.id) })),
  };
}

export interface FichaFlete {
  flete: M.Flete;
  estado: M.EstadoFlete;
  historial: M.RegistroEstado[]; // en el orden en que se agregaron
  items: M.FleteItem[];
}

export function fichaFlete(datos: M.Datos, id: string): FichaFlete | null {
  const flete = datos.fletes.find((f) => f.id === id);
  if (!flete) return null;
  return {
    flete,
    estado: M.estadoFlete(M.estadosActuales(datos.fletesEstados), id),
    historial: datos.fletesEstados.filter((e) => e.ref === id),
    items: datos.fletesItems.filter((it) => it.fleteId === id),
  };
}

export const fichaCompra = (datos: Pick<M.Datos, 'compras'>, id: string) => datos.compras.find((c) => String(c.fila) === id) ?? null;
