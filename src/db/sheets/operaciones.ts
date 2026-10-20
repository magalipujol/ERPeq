// Cada operación del puerto se traduce en las filas que agrega a cada hoja (una Escritura), que el
// adaptador guarda de una sola vez.
import type { Cobro, Entrega } from '../../dominio/modelo';
import type { CompraNueva, FleteNuevo, Operaciones, PedidoNuevo } from '../puerto';
import { type Escritura, filas, type Reemplazo, unir } from './hojas';

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
// que reemplaza una fila.
export function operaciones(escribir: (e: Escritura) => Promise<void>, reemplazar: (r: Reemplazo) => Promise<void>): Operaciones {
  return {
    registrarContacto: async (c) => escribir({ contactos: [filas.contacto(c)] }),
    corregirContacto: async (c) => reemplazar({ hoja: 'contactos', id: c.id, fila: filas.contacto(c) }),
    registrarProducto: async (p, precio) => escribir({ productos: [filas.producto(p)], ...(precio ? { precios: [filas.precio(precio)] } : {}) }),
    corregirProducto: async (p) => reemplazar({ hoja: 'productos', id: p.id, fila: filas.producto(p) }),
    registrarPedido: async (p) => escribir(escrituraPedido(p)),
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
