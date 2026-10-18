import { describe, expect, it } from 'vitest';
import * as M from '../../dominio/modelo';
import { aSerie } from './celdas';
import { crearPlanillaEnMemoria } from './memoria';

const dia = new Date(2026, 9, 16, 12);
const DIA = Math.floor(aSerie(dia));
const MOMENTO = aSerie(dia);
const pedido: M.Pedido = { id: 'PE0001', fecha: dia, contactoId: 'C0001', depositoId: 'BB', nota: '', cobraEnvio: false };
const item: M.PedidoItem = { pedidoId: 'PE0001', linea: 1, productoId: 'P001', cantidad: 2, precioLista: null, precio: 3000 };
const leo: M.Vendedor = { id: 'VEN01', nombre: 'Leo', activo: true, localidad: '' };
const cobro: M.Cobro = { fecha: dia, ventaId: 'V0001', importe: 6000, medio: 'efectivo', socioId: 'SOC02', nota: '' };
const entrega = (id = 'V0001', envio = 0) => M.armarEntrega({
  id, fecha: dia, pedidoId: 'PE0001', depositoId: 'BB', nota: '', envio, envioVendedorId: envio > 0 ? 'VEN01' : '',
}, [{
  linea: { ...item, entregado: 0, pendiente: 2 }, cantidad: 2, costo: 1500,
  comisiones: [{ vendedor: leo, porcentajeRegla: 10, porcentaje: 10 }],
}]);

describe('operaciones sobre la planilla', () => {
  it('un pedido con venta directa se guarda en una sola escritura', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.registrarPedido({
      pedido, items: [item], vendedores: ['VEN01'], momento: dia, entrega: entrega(), cobros: [cobro],
      preciosNuevos: [{ productoId: 'P001', precio: 3000, desde: dia }],
    });

    expect(db.escrituras).toHaveLength(1);
    expect(db.hojas).toMatchObject({
      pedidos: [['PE0001', DIA, 'C0001', 'BB', '', 'no']],
      pedidosItems: [['PE0001', 1, 'P001', 2, '', 3000]],
      pedidosEstados: [['PE0001', MOMENTO, 'abierto']],
      pedidosVendedores: [['PE0001', 'VEN01']],
      precios: [['P001', 3000, DIA]],
      ventas: [['V0001', DIA, 'PE0001', 'BB', '', '', '']],
      ventasItems: [['V0001', 1, 1, 'P001', 2, 3000, 6000, 1500]],
      ventasComisiones: [['V0001', 1, 'VEN01', 10, 10, 600]],
      cobros: [[DIA, 'V0001', 6000, 'efectivo', 'SOC02', '']],
    });

    const leidos = await db.leer();
    const [r] = M.resumirPedidos(leidos);

    expect(r).toMatchObject({ estado: 'entregado', importeEntregado: 6000, comisiones: 600, ganancia: 2400 });
    expect(M.ventasACobrar(leidos)).toStrictEqual([]);
  });

  it('el envío de una venta directa queda en la venta con el vendedor que lo lleva, y suma a lo que se cobra', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.registrarEnvio({ minimo: 150000, costo: 5000, desde: dia });
    await db.registrarPedido({
      pedido: { ...pedido, cobraEnvio: true }, items: [item], vendedores: ['VEN01'], momento: dia, entrega: entrega('V0001', 5000),
      cobros: [{ ...cobro, importe: 11000 }], preciosNuevos: [],
    });

    expect(db.hojas).toMatchObject({
      envios: [[150000, 5000, DIA]],
      pedidos: [['PE0001', DIA, 'C0001', 'BB', '', 'sí']],
      ventas: [['V0001', DIA, 'PE0001', 'BB', '', 5000, 'VEN01']],
    });

    const leidos = await db.leer();

    // `desde` se guarda como fecha sin hora.
    expect(leidos.envios).toStrictEqual([{ minimo: 150000, costo: 5000, desde: new Date(2026, 9, 16) }]);
    expect(M.resumirPedidos(leidos)[0]).toMatchObject({ envio: 5000, ganancia: 2400 });
    // 6.000 de productos + 5.000 de envío, cobrados enteros.
    expect(M.cuentasVentas(leidos)[0]).toMatchObject({ importe: 11000, cobrado: 11000, saldo: 0 });
  });

  it('una entrega con cobro guarda la venta y el cobro juntos; sin cobro, no toca Cobros', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.registrarEntrega(entrega(), [{ ...cobro, importe: 2000 }]);
    await db.registrarEntrega(entrega('V0002'));

    expect(db.escrituras).toHaveLength(2);
    expect(db.escrituras[0].cobros).toStrictEqual([[dia, 'V0001', 2000, 'efectivo', 'SOC02', '']]);
    expect(db.escrituras[0].ventas).toHaveLength(1);
    expect(db.escrituras[1]).not.toHaveProperty('cobros');
    expect(M.cuentasVentas(await db.leer()).find((c) => c.venta.id === 'V0001')).toMatchObject({ importe: 6000, cobrado: 2000, saldo: 4000 });
  });

  it('un flete ya despachado guarda los estados anteriores y la salida y llegada previstas', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.registrarFlete({
      flete: {
        id: 'F0001', fecha: dia, contactoId: 'C0004', origenId: 'BB', destinoId: 'ROS', costo: 900, guia: '', nota: '',
        salida: dia, llegadaEstimada: null,
      },
      items: [{ fleteId: 'F0001', productoId: 'P001', cantidad: 3 }],
      estados: M.caminoFlete('camino'), momento: dia,
      transporteNuevo: null,
    });
    await db.cambiarEstadoFlete('F0001', 'finalizado', dia);

    expect(db.hojas.contactos).toStrictEqual([]);
    expect(db.hojas.fletesEstados).toStrictEqual([['F0001', MOMENTO, 'preparacion'], ['F0001', MOMENTO, 'camino'], ['F0001', MOMENTO, 'finalizado']]);
    expect(db.hojas.fletes).toStrictEqual([['F0001', DIA, 'C0004', 'BB', 'ROS', 900, '', '', MOMENTO, '']]);
    expect((await db.leer()).fletes[0]).toMatchObject({ salida: dia, llegadaEstimada: null });
    expect(M.estadoFlete(M.estadosActuales((await db.leer()).fletesEstados), 'F0001')).toBe('finalizado');
  });

  it('una compra con producto y proveedor nuevos calcula el importe', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.registrarCompra({
      productosNuevos: [{ id: 'P004', producto: 'Nueces', unidad: 'kg', minimo: null }],
      proveedorNuevo: { id: 'C0005', rol: 'proveedor', nombre: 'Prov C' },
      lineas: [{
        fecha: dia, depositoId: 'BB', contactoId: 'C0005', productoId: 'P004',
        cantidad: 3, precio: 1.1, remito: '', pedidoId: '', nota: '',
      }],
    });

    expect(db.hojas.productos).toStrictEqual([['P004', 'Nueces', 'kg', '']]);
    expect(db.hojas.compras).toStrictEqual([[DIA, 'BB', 'C0005', 'P004', 3, 1.1, 3.3, '', '', '']]);
    expect((await db.leer()).compras[0]).toMatchObject({ fila: 2, cantidad: 3, precio: 1.1, importe: 3.3 });
  });

  it('una receta y una fabricación se guardan cada una en una escritura', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.registrarReceta({
      receta: { id: 'RE0001', version: 1, desde: dia, productoId: 'P009', cantidad: 0.95, activa: true },
      items: [{ recetaId: 'RE0001', version: 1, productoId: 'P001', cantidad: 0.6 }, { recetaId: 'RE0001', version: 1, productoId: 'P002', cantidad: 0.4 }],
    });
    await db.registrarReceta({ receta: { id: 'RE0001', version: 2, desde: dia, productoId: 'P009', cantidad: 0, activa: false }, items: [] });
    await db.registrarFabricacion(M.armarFabricacion(
      { id: 'FA0001', fecha: dia, depositoId: 'BB', recetaId: 'RE0001', version: 1, productoId: 'P009', cantidad: 0.95 },
      [{ productoId: 'P001', cantidad: 0.6 }, { productoId: 'P002', cantidad: 0.4 }],
    ));

    expect(db.escrituras).toHaveLength(3);
    expect(db.hojas).toMatchObject({
      recetas: [['RE0001', 1, DIA, 'P009', 0.95, 'sí'], ['RE0001', 2, DIA, 'P009', 0, 'no']],
      recetasItems: [['RE0001', 1, 'P001', 0.6], ['RE0001', 1, 'P002', 0.4]],
      ajustes: [
        [DIA, 'BB', 'P001', -0.6, 'Fabricación FA0001 (RE0001 v1)'],
        [DIA, 'BB', 'P002', -0.4, 'Fabricación FA0001 (RE0001 v1)'],
        [DIA, 'BB', 'P009', 0.95, 'Fabricación FA0001 (RE0001 v1)'],
      ],
    });

    const leidos = await db.leer();

    expect(leidos.recetas.map((r) => [r.version, r.activa])).toStrictEqual([[1, true], [2, false]]);
    expect(M.fabricaciones(leidos.ajustes)).toMatchObject([{ id: 'FA0001', recetaId: 'RE0001', version: 1, productoId: 'P009', cantidad: 0.95 }]);
  });

  it('las operaciones simples agregan una fila en su hoja', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.cambiarEstadoPedido('PE0002', 'cancelado', dia);
    await db.registrarAjuste({ fecha: dia, depositoId: 'BB', productoId: 'P001', cantidad: -2, motivo: 'conteo' });
    await db.registrarPrecio({ productoId: 'P003', precio: 600, desde: dia });
    await db.registrarReglaComision({ vendedorId: 'VEN01', productoId: 'P002', porcentaje: 12, desde: dia });
    await db.registrarCobro(cobro);
    await db.registrarRendicion({ fecha: dia, deId: 'SOC02', aId: 'SOC01', importe: 5000, medio: 'transferencia', nota: 'semanal' });

    expect(db.escrituras).toStrictEqual([
      { pedidosEstados: [['PE0002', { momento: dia }, 'cancelado']] },
      { ajustes: [[dia, 'BB', 'P001', -2, 'conteo']] },
      { precios: [['P003', 600, dia]] },
      { reglas: [['VEN01', 'P002', 12, dia]] },
      { cobros: [[dia, 'V0001', 6000, 'efectivo', 'SOC02', '']] },
      { rendiciones: [[dia, 'SOC02', 'SOC01', 5000, 'transferencia', 'semanal']] },
    ]);
  });
});
