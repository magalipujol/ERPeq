// Cada operación del puerto se traduce en las filas que agrega a cada hoja (una Escritura), que el
// adaptador guarda de una sola vez.
import type { Cobro, CorreccionPedido, Entrega } from '../../dominio/modelo';
import type { CompraNueva, FleteNuevo, Operaciones, PedidoNuevo } from '../puerto';
import { type Correccion, type Escritura, filas, type Reemplazo, unir } from './hojas';

export function escrituraEntrega({ venta, items, comisiones, envio }: Entrega, cobros: Cobro[] = []): Escritura {
  return {
    ventas: [filas.venta(venta)],
    ventasItems: items.map(filas.ventaItem),
    ...(comisiones.length > 0 ? { ventasComisiones: comisiones.map(filas.ventaComision) } : {}),
    ...(envio ? { ventasEnvios: [filas.ventaEnvio(envio)] } : {}),
    ...(cobros.length > 0 ? { cobros: cobros.map(filas.cobro) } : {}),
  };
}

export function escrituraPedido(p: PedidoNuevo): Escritura {
  const { id } = p.pedido;
  const escritura: Escritura = {
    pedidos: [filas.pedido(p.pedido)],
    pedidosItems: p.items.map(filas.pedidoItem),
    pedidosEstados: [filas.estado(id, 'abierto', p.momento)],
    pedidosVendedores: p.vendedores.map((v) => filas.pedidoVendedor({ pedidoId: id, vendedorId: v })),
    precios: p.preciosNuevos.map(filas.precio),
  };
  return p.entrega ? unir(escritura, escrituraEntrega(p.entrega, p.cobros)) : escritura;
}

// La cabecera del pedido y las de sus ventas se reemplazan en el lugar; sus ítems, vendedores y comisiones, que no
// tienen ID propio, se borran y se vuelven a agregar. Los estados, envíos y cobros no se tocan.
export function correccionPedido(c: CorreccionPedido): Correccion {
  const { id } = c.pedido;
  const ventas = c.entregas.map((e) => e.venta.id);
  return {
    reemplazos: [
      { hoja: 'pedidos', id, fila: filas.pedido(c.pedido) },
      ...c.entregas.map((e): Reemplazo => ({ hoja: 'ventas', id: e.venta.id, fila: filas.venta(e.venta) })),
    ],
    recambios: [
      { hoja: 'pedidosItems', ids: [id], filas: c.items.map(filas.pedidoItem) },
      { hoja: 'pedidosVendedores', ids: [id], filas: c.vendedores.map((v) => filas.pedidoVendedor({ pedidoId: id, vendedorId: v })) },
      ...(ventas.length > 0 ? [
        { hoja: 'ventasItems' as const, ids: ventas, filas: c.entregas.flatMap((e) => e.items.map(filas.ventaItem)) },
        { hoja: 'ventasComisiones' as const, ids: ventas, filas: c.entregas.flatMap((e) => e.comisiones.map(filas.ventaComision)) },
      ] : []),
    ],
    agregados: c.preciosNuevos.length > 0 ? { precios: c.preciosNuevos.map(filas.precio) } : {},
  };
}

export function escrituraFlete(f: FleteNuevo): Escritura {
  return {
    ...(f.transporteNuevo ? { contactos: [filas.contacto(f.transporteNuevo)] } : {}),
    fletes: [filas.flete(f.flete)],
    fletesItems: f.items.map(filas.fleteItem),
    fletesEstados: f.estados.map((e) => filas.estado(f.flete.id, e, f.momento)),
  };
}

export function escrituraCompra(c: CompraNueva): Escritura {
  return {
    productos: c.productosNuevos.map(filas.producto),
    ...(c.proveedorNuevo ? { contactos: [filas.contacto(c.proveedorNuevo)] } : {}),
    compras: c.lineas.map(filas.compra),
  };
}

// Implementa las operaciones del puerto sobre una función que agrega filas en una sola escritura atómica y otra
// que corrige filas ya guardadas, también de una sola vez.
export function operaciones(escribir: (e: Escritura) => Promise<void>, corregir: (c: Correccion) => Promise<void>): Operaciones {
  const reemplazar = async (r: Reemplazo) => corregir({ reemplazos: [r], recambios: [], agregados: {} });
  return {
    registrarContacto: async (c) => escribir({ contactos: [filas.contacto(c)] }),
    corregirContacto: async (c) => reemplazar({ hoja: 'contactos', id: c.id, fila: filas.contacto(c) }),
    registrarProducto: async (p, precio) => escribir({ productos: [filas.producto(p)], ...(precio ? { precios: [filas.precio(precio)] } : {}) }),
    corregirProducto: async (p) => reemplazar({ hoja: 'productos', id: p.id, fila: filas.producto(p) }),
    registrarPedido: async (p) => escribir(escrituraPedido(p)),
    corregirPedido: async (c) => corregir(correccionPedido(c)),
    registrarEntrega: async (e, cobros) => escribir(escrituraEntrega(e, cobros)),
    cambiarEstadoPedido: async (id, estado, momento) => escribir({ pedidosEstados: [filas.estado(id, estado, momento)] }),
    registrarFlete: async (f) => escribir(escrituraFlete(f)),
    cambiarEstadoFlete: async (id, estado, momento) => escribir({ fletesEstados: [filas.estado(id, estado, momento)] }),
    registrarCompra: async (c) => escribir(escrituraCompra(c)),
    registrarAjuste: async (a) => escribir({ ajustes: [filas.ajuste(a)] }),
    registrarPrecio: async (p) => escribir({ precios: [filas.precio(p)] }),
    registrarReglaComision: async (r) => escribir({ reglas: [filas.regla(r)] }),
    registrarReglaEnvio: async (r) => escribir({ envios: [filas.envio(r)] }),
    registrarCobro: async (c) => escribir({ cobros: [filas.cobro(c)] }),
    registrarRendicion: async (r) => escribir({ rendiciones: [filas.rendicion(r)] }),
    registrarReceta: async (r) => escribir({ recetas: [filas.receta(r.receta)], recetasItems: r.items.map(filas.recetaItem) }),
    registrarFabricacion: async (ajustes) => escribir({ ajustes: ajustes.map(filas.ajuste) }),
  };
}
