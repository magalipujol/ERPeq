import { describe, expect, it } from 'vitest';
import * as F from './fichas';
import * as M from './modelo';

const fecha = (a: number, m: number, d: number) => new Date(a, m - 1, d, 12);
const contacto = (id: string, rol: string): M.Contacto => ({
  id, rol, nombre: id, tipo: '', telefono: '', direccion: '', email: '', localidad: '', provincia: '', observaciones: '',
});

// Ana pide 10 kg de almendras (PE1) y se le entregan 4 en V1, que pagó $ 1.000 de $ 4.000. Para el pedido se
// compraron 5 kg (fila 3) y se mandó un flete de Bahía Blanca a Rosario. La avena (P002) entra en la receta del mix.
const datos: M.Datos = {
  depositos: [{ id: 'BB', nombre: 'General', localidad: '' }, { id: 'ROS', nombre: 'Rosario', localidad: '' }],
  productos: [
    { id: 'P001', producto: 'Almendras', unidad: 'kg', minimo: 0 },
    { id: 'P002', producto: 'Avena', unidad: 'kg', minimo: 0 },
    { id: 'P003', producto: 'Mix', unidad: 'kg', minimo: 0 },
  ],
  contactos: [contacto('C1', 'cliente'), contacto('C2', 'proveedor'), contacto('C3', 'transporte')],
  tipos: [], vendedores: [{ id: 'VEN01', nombre: 'Leo', activo: true, localidad: '' }],
  precios: [{ productoId: 'P001', precio: 1000, desde: fecha(2026, 1, 1) }, { productoId: 'P001', precio: 1200, desde: fecha(2026, 11, 1) }],
  reglas: [],
  compras: [
    { fila: 2, fecha: fecha(2026, 9, 1), depositoId: 'BB', contactoId: 'C2', productoId: 'P001', cantidad: 10, precio: 500, importe: 5000, remito: '', pedidoId: '', nota: '' },
    { fila: 3, fecha: fecha(2026, 10, 2), depositoId: 'ROS', contactoId: 'C2', productoId: 'P001', cantidad: 5, precio: 800, importe: 4000, remito: '', pedidoId: 'PE1', nota: '' },
  ],
  pedidos: [
    { id: 'PE1', fecha: fecha(2026, 10, 1), contactoId: 'C1', depositoId: 'ROS', nota: '' },
    { id: 'PE2', fecha: fecha(2026, 10, 5), contactoId: 'C1', depositoId: 'ROS', nota: '' },
  ],
  pedidosItems: [
    { pedidoId: 'PE1', linea: 1, productoId: 'P001', cantidad: 10, precioLista: 1000, precio: 1000 },
    { pedidoId: 'PE2', linea: 1, productoId: 'P002', cantidad: 3, precioLista: null, precio: 100 },
  ],
  pedidosEstados: [], pedidosVendedores: [{ pedidoId: 'PE1', vendedorId: 'VEN01' }],
  ventas: [{ id: 'V1', fecha: fecha(2026, 10, 3), pedidoId: 'PE1', depositoId: 'ROS', nota: '' }],
  ventasItems: [{ ventaId: 'V1', linea: 1, pedidoLinea: 1, productoId: 'P001', cantidad: 4, precio: 1000, importe: 4000, costo: 600 }],
  ventasComisiones: [{ ventaId: 'V1', linea: 1, vendedorId: 'VEN01', porcentajeRegla: 10, porcentaje: 10, monto: 400 }],
  fletes: [{ id: 'F1', fecha: fecha(2026, 10, 2), contactoId: 'C3', origenId: 'BB', destinoId: 'ROS', costo: 900, guia: '', nota: '' }],
  fletesItems: [{ fleteId: 'F1', productoId: 'P001', cantidad: 2 }],
  fletesEstados: [{ ref: 'F1', fecha: null, estado: 'preparacion' }, { ref: 'F1', fecha: null, estado: 'camino' }],
  pedidosFletes: [{ pedidoId: 'PE1', fleteId: 'F1', costoAsignado: 300 }],
  ajustes: [], socios: [],
  cobros: [{ fecha: fecha(2026, 10, 4), ventaId: 'V1', importe: 1000, medio: 'efectivo', socioId: 'SOC01', nota: '' }],
  rendiciones: [],
  recetas: [{ id: 'RE1', version: 1, desde: fecha(2026, 1, 1), productoId: 'P003', cantidad: 1, activa: true }],
  recetasItems: [{ recetaId: 'RE1', version: 1, productoId: 'P002', cantidad: 1 }],
};
const resumenes = M.resumirPedidos(datos);
const stock = M.calcularStock(datos, resumenes);

describe('fichas', () => {
  it('pedido: sus entregas con lo que falta cobrar, los fletes asignados y las compras hechas para él', () => {
    const f = F.fichaPedido(datos, resumenes, 'PE1');

    expect(f?.resumen.estado).toBe('parcial');
    expect(f?.ventas).toStrictEqual([{ venta: datos.ventas[0], importe: 4000, cobrado: 1000, saldo: 3000 }]);
    expect(f?.fletes).toStrictEqual([{ flete: datos.fletes[0], estado: 'camino', costoAsignado: 300 }]);
    expect(f?.compras.map((c) => c.fila)).toStrictEqual([3]);
    expect(F.fichaPedido(datos, resumenes, 'PE9')).toBeNull();
  });

  it('venta: ítems, comisión por vendedor, cobros y ganancia (4.000 − 400 − 4 × 600 = 1.200)', () => {
    const f = F.fichaVenta(datos, 'V1');

    expect(f).toMatchObject({ importe: 4000, cobrado: 1000, saldo: 3000, ganancia: 1200, comisiones: [{ vendedorId: 'VEN01', monto: 400 }] });
    expect(f?.pedido?.id).toBe('PE1');
    expect(f?.items).toMatchObject([{ productoId: 'P001', comision: 400, ganancia: 1200 }]);
    expect(f?.cobros).toHaveLength(1);
  });

  it('producto: precio vigente a la fecha, costo promedio y stock por depósito', () => {
    const f = F.fichaProducto(datos, resumenes, stock, M.costosPromedio(datos.compras), 'P001', fecha(2026, 10, 17));

    expect(f?.precio).toBe(1000);
    expect(f?.costo).toBe(600);
    // BB: 10 comprados − 2 en camino. ROS: 5 comprados − 4 vendidos; 2 llegando y 6 pendientes de PE1.
    expect(f?.stock).toStrictEqual([
      { depositoId: 'BB', enDeposito: 8, enTransito: 0, reservado: 0, comprometido: 0 },
      { depositoId: 'ROS', enDeposito: 1, enTransito: 2, reservado: 0, comprometido: 6 },
    ]);
  });

  it('producto: pedidos abiertos con algo pendiente, compras y ventas, de lo más reciente a lo más viejo', () => {
    const f = F.fichaProducto(datos, resumenes, stock, new Map(), 'P001', null);

    expect(f?.pedidos.map((p) => [p.resumen.pedido.id, p.pendiente])).toStrictEqual([['PE1', 6]]);
    expect(f?.compras.map((c) => c.fila)).toStrictEqual([3, 2]);
    expect(f?.ventas).toMatchObject([{ cantidad: 4, importe: 4000 }]);
    expect(f?.receta).toBeUndefined();
  });

  it('producto: la receta que lo fabrica y las recetas que lo usan', () => {
    expect(F.fichaProducto(datos, resumenes, stock, new Map(), 'P003', null)?.receta?.receta.id).toBe('RE1');
    expect(F.fichaProducto(datos, resumenes, stock, new Map(), 'P002', null)?.usadoEn.map((r) => r.receta.id)).toStrictEqual(['RE1']);
  });

  it('contacto: pedidos y saldo como cliente, compras como proveedor y fletes como transporte', () => {
    expect(F.fichaContacto(datos, resumenes, 'C1')).toMatchObject({ aCobrar: 3000, compras: [], fletes: [] });
    expect(F.fichaContacto(datos, resumenes, 'C1')?.pedidos.map((r) => r.pedido.id)).toStrictEqual(['PE2', 'PE1']);
    expect(F.fichaContacto(datos, resumenes, 'C2')?.compras).toHaveLength(2);
    expect(F.fichaContacto(datos, resumenes, 'C3')?.fletes).toMatchObject([{ estado: 'camino' }]);
  });

  it('flete y compra', () => {
    expect(F.fichaFlete(datos, 'F1')).toMatchObject({ estado: 'camino', items: [{ cantidad: 2 }], pedidos: [{ pedidoId: 'PE1' }] });
    expect(F.fichaFlete(datos, 'F1')?.historial.map((e) => e.estado)).toStrictEqual(['preparacion', 'camino']);
    expect(F.fichaCompra(datos, '3')?.pedidoId).toBe('PE1');
    expect(F.fichaCompra(datos, '9')).toBeNull();
  });
});
