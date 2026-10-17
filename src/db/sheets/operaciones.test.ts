import { describe, expect, it } from 'vitest';
import * as M from '../../dominio/modelo';
import { aSerie } from './celdas';
import { crearPlanillaEnMemoria } from './memoria';

const dia = new Date(2026, 9, 16, 12);
const DIA = Math.floor(aSerie(dia));
const MOMENTO = aSerie(dia);
const pedido: M.Pedido = {
  id: 'PE0001', fecha: dia, contactoId: 'C0001', cliente: 'Ana', tipo: 'Minorista', localidad: 'Funes', provincia: 'Santa Fe',
  depositoId: 'BB', nota: '',
};
const item: M.PedidoItem = { pedidoId: 'PE0001', linea: 1, productoId: 'P001', producto: 'Almendras', cantidad: 2, precioLista: null, precio: 3000 };
const leo: M.Vendedor = { id: 'VEN01', nombre: 'Leo', activo: true };

describe('operaciones sobre la planilla', () => {
  it('un pedido con cliente nuevo y venta directa se guarda en una sola escritura', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    const entrega = M.armarEntrega({ id: 'V0001', fecha: dia, pedidoId: 'PE0001', depositoId: 'BB', nota: '' }, [{
      linea: { ...item, entregado: 0, pendiente: 2 }, cantidad: 2, costo: 1500,
      comisiones: [{ vendedor: leo, porcentajeRegla: 10, porcentaje: 10 }],
    }]);
    await db.registrarPedido({
      pedido, items: [item], vendedores: ['VEN01'], momento: dia, entrega,
      clienteNuevo: { id: 'C0001', rol: 'cliente', nombre: 'Ana', tipo: 'Minorista', localidad: 'Funes', provincia: 'Santa Fe' },
      preciosNuevos: [{ productoId: 'P001', producto: 'Almendras', precio: 3000, desde: dia }],
    });

    expect(db.escrituras).toHaveLength(1);
    expect(db.hojas).toMatchObject({
      contactos: [['C0001', 'cliente', 'Ana', 'Minorista', '', '', '', 'Funes', 'Santa Fe', '']],
      pedidos: [['PE0001', DIA, 'C0001', 'Ana', 'Minorista', 'Funes', 'Santa Fe', 'BB', '']],
      pedidosItems: [['PE0001', 1, 'P001', 'Almendras', 2, '', 3000]],
      pedidosEstados: [['PE0001', MOMENTO, 'abierto']],
      pedidosVendedores: [['PE0001', 'VEN01']],
      precios: [['P001', 'Almendras', 3000, DIA]],
      ventas: [['V0001', DIA, 'PE0001', 'BB', '']],
      ventasItems: [['V0001', 1, 1, 'P001', 'Almendras', 2, 3000, 6000, 1500]],
      ventasComisiones: [['V0001', 1, 'VEN01', 'Leo', 10, 10, 600]],
    });

    const [r] = M.resumirPedidos(await db.leer());

    expect(r).toMatchObject({ estado: 'entregado', importeEntregado: 6000, comisiones: 600, ganancia: 2400 });
  });

  it('un flete ya despachado guarda los estados anteriores y el reparto a pedidos', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.registrarFlete({
      flete: { id: 'F0001', fecha: dia, transporte: 'Interprovincial', contactoId: 'C0004', origenId: 'BB', destinoId: 'ROS', costo: 900, guia: '', nota: '' },
      items: [{ fleteId: 'F0001', productoId: 'P001', producto: 'Almendras', cantidad: 3 }],
      estados: M.caminoFlete('camino'), momento: dia,
      pedidos: [{ pedidoId: 'PE0001', fleteId: 'F0001', costoAsignado: 900 }],
      transporteNuevo: null,
    });
    await db.cambiarEstadoFlete('F0001', 'finalizado', dia);

    expect(db.hojas.contactos).toStrictEqual([]);
    expect(db.hojas.fletesEstados).toStrictEqual([['F0001', MOMENTO, 'preparacion'], ['F0001', MOMENTO, 'camino'], ['F0001', MOMENTO, 'finalizado']]);
    expect(db.hojas.pedidosFletes).toStrictEqual([['PE0001', 'F0001', 900]]);
    expect(M.estadoFlete(M.estadosActuales((await db.leer()).fletesEstados), 'F0001')).toBe('finalizado');
  });

  it('una compra con producto y proveedor nuevos calcula el importe', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.registrarCompra({
      productosNuevos: [{ id: 'P004', producto: 'Nueces', unidad: 'kg', minimo: null }],
      proveedorNuevo: { id: 'C0005', rol: 'proveedor', nombre: 'Prov C' },
      lineas: [{
        fecha: dia, depositoId: 'BB', proveedor: 'Prov C', contactoId: 'C0005', productoId: 'P004', producto: 'Nueces',
        cantidad: 3, precio: 1.1, remito: '', pedidoId: '', nota: '',
      }],
    });

    expect(db.hojas.productos).toStrictEqual([['P004', 'Nueces', 'kg', '']]);
    expect(db.hojas.compras).toStrictEqual([[DIA, 'BB', 'Prov C', 'C0005', 'P004', 'Nueces', 3, 1.1, 3.3, '', '', '']]);
    expect((await db.leer()).compras[0]).toMatchObject({ fila: 2, cantidad: 3, precio: 1.1, importe: 3.3 });
  });

  it('las operaciones simples agregan una fila en su hoja', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.cambiarEstadoPedido('PE0002', 'cancelado', dia);
    await db.registrarAjuste({ fecha: dia, depositoId: 'BB', productoId: 'P001', producto: 'Almendras', cantidad: -2, motivo: 'conteo' });
    await db.registrarPrecio({ productoId: 'P003', producto: 'Miel', precio: 600, desde: dia });
    await db.registrarReglaComision({ vendedorId: 'VEN01', productoId: 'P002', porcentaje: 12, desde: dia });

    expect(db.escrituras).toStrictEqual([
      { pedidosEstados: [['PE0002', { momento: dia }, 'cancelado']] },
      { ajustes: [[dia, 'BB', 'P001', 'Almendras', -2, 'conteo']] },
      { precios: [['P003', 'Miel', 600, dia]] },
      { reglas: [['VEN01', 'P002', 12, dia]] },
    ]);
  });
});
