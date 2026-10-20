import { describe, expect, it } from 'vitest';
import * as M from '../../dominio/modelo';
import { aSerie } from './celdas';
import { crearPlanillaEnMemoria } from './memoria';

const dia = new Date(2026, 9, 16, 12);
const DIA = Math.floor(aSerie(dia));
const MOMENTO = aSerie(dia);
const pedido: M.Pedido = { id: 'PE0001', fecha: dia, contactoId: 'C0001', depositoId: 'BB', nota: '' };
const item: M.PedidoItem = { pedidoId: 'PE0001', linea: 1, productoId: 'P001', cantidad: 2, precioLista: null, precio: 3000 };
const leo: M.Vendedor = { id: 'VEN01', nombre: 'Leo', activo: true, localidad: '' };
const cobro: M.Cobro = { fecha: dia, ventaId: 'V0001', importe: 6000, medio: 'efectivo', socioId: 'SOC02', nota: '' };
const entrega = (id = 'V0001') => M.armarEntrega({ id, fecha: dia, pedidoId: 'PE0001', depositoId: 'BB', nota: '' }, [{
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
      pedidos: [['PE0001', DIA, 'C0001', 'BB', '']],
      pedidosItems: [['PE0001', 1, 'P001', 2, '', 3000]],
      pedidosEstados: [['PE0001', MOMENTO, 'abierto']],
      pedidosVendedores: [['PE0001', 'VEN01']],
      precios: [['P001', 3000, DIA]],
      ventas: [['V0001', DIA, 'PE0001', 'BB', '']],
      ventasItems: [['V0001', 1, 1, 'P001', 2, 3000, 6000, 1500]],
      ventasComisiones: [['V0001', 1, 'VEN01', 10, 10, 600]],
      cobros: [[DIA, 'V0001', 6000, 'efectivo', 'SOC02', '']],
    });

    const leidos = await db.leer();
    const [r] = M.resumirPedidos(leidos);

    expect(r).toMatchObject({ estado: 'entregado', importeEntregado: 6000, comisiones: 600, ganancia: 2400 });
    expect(M.ventasACobrar(leidos)).toStrictEqual([]);
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

  it('una entrega con envío lo guarda junto con la venta y lo suma a lo que hay que cobrar', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.registrarReglaEnvio({ minimo: 150000, costo: 5000, desde: dia });
    const venta: M.Venta = { id: 'V0001', fecha: dia, pedidoId: 'PE0001', depositoId: 'BB', nota: '' };
    await db.registrarEntrega(M.armarEntrega(venta, [], { vendedorId: 'VEN01', costoRegla: 5000, costo: 5000 }));

    expect(db.escrituras).toHaveLength(2);
    expect(db.escrituras[0]).toStrictEqual({ envios: [[150000, 5000, dia]] });
    expect(db.escrituras[1].ventasEnvios).toStrictEqual([['V0001', 'VEN01', 5000, 5000]]);

    const leidos = await db.leer();

    expect(leidos.envios).toStrictEqual([{ minimo: 150000, costo: 5000, desde: new Date(2026, 9, 16) }]);
    expect(M.cuentasVentas(leidos)[0]).toMatchObject({ importe: 5000, saldo: 5000 });
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

  it('un contacto o producto nuevo se agrega; corregirlo reemplaza su fila en el lugar', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria({
      contactos: [['C0001', 'cliente', 'Ana', 'Minorista', '', '', '', 'Funes', 'Santa Fe', ''], ['C0002', 'proveedor', 'Prov A']],
      productos: [['P001', 'Almendras', 'kg', '']],
    });
    const beto: M.Contacto = {
      id: 'C0003', rol: 'cliente', nombre: 'Beto', tipo: '', telefono: '341 555', direccion: '', email: '',
      localidad: 'Rosario', provincia: 'Santa Fe', observaciones: '',
    };
    await db.registrarContacto(beto);
    await db.registrarProducto({ id: 'P002', producto: 'Nueces', unidad: 'kg', minimo: 5 }, { productoId: 'P002', precio: 4000, desde: dia });
    await db.registrarProducto({ id: 'P003', producto: 'Miel', unidad: 'unid.', minimo: null }, null);
    // Ana se mudó y perdió el tipo; las almendras pasan a tener mínimo.
    await db.corregirContacto({ ...beto, id: 'C0001', nombre: 'Ana', tipo: '', telefono: '', localidad: 'Rosario' });
    await db.corregirProducto({ id: 'P001', producto: 'Almendras peladas', unidad: 'kg', minimo: 10 });

    expect(db.escrituras).toStrictEqual([
      { contactos: [['C0003', 'cliente', 'Beto', '', '341 555', '', '', 'Rosario', 'Santa Fe', '']] },
      { productos: [['P002', 'Nueces', 'kg', 5]], precios: [['P002', 4000, dia]] },
      { productos: [['P003', 'Miel', 'unid.', '']] },
    ]);
    expect(db.hojas.contactos.map((f) => f.slice(0, 3))).toStrictEqual([['C0001', 'cliente', 'Ana'], ['C0002', 'proveedor', 'Prov A'], ['C0003', 'cliente', 'Beto']]);

    const leidos = await db.leer();

    expect(leidos.contactos[0]).toMatchObject({ id: 'C0001', tipo: '', telefono: '', localidad: 'Rosario' });
    expect(leidos.productos).toMatchObject([
      { id: 'P001', producto: 'Almendras peladas', minimo: 10 }, { id: 'P002', producto: 'Nueces' }, { id: 'P003', unidad: 'unid.' },
    ]);
    expect(M.precioVigente(leidos.precios, 'P002', dia)).toBe(4000);
  });

  it('corregir un pedido reemplaza su cabecera y la de sus ventas, y rehace ítems, vendedores y comisiones', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    await db.registrarPedido({ pedido, items: [item], vendedores: ['VEN01'], momento: dia, entrega: entrega(), preciosNuevos: [] });
    // Otro pedido en las mismas hojas, que no se toca.
    await db.registrarPedido({
      pedido: { ...pedido, id: 'PE0002' }, items: [{ ...item, pedidoId: 'PE0002' }], vendedores: ['VEN01'], momento: dia, preciosNuevos: [],
      entrega: M.armarEntrega({ id: 'V0002', fecha: dia, pedidoId: 'PE0002', depositoId: 'BB', nota: '' }, [{
        linea: { ...item, pedidoId: 'PE0002', entregado: 0, pendiente: 2 }, cantidad: 2, costo: 1500,
        comisiones: [{ vendedor: leo, porcentajeRegla: 10, porcentaje: 10 }],
      }]),
    });
    const datos = await db.leer();
    const anterior = M.resumirPedidos(datos)[0];
    // Salía de Rosario a $2500 y se agrega un producto sin precio de lista.
    await db.corregirPedido(M.corregirPedido({ ...datos, vendedores: [leo] }, anterior, { ...pedido, depositoId: 'ROS' }, [
      { linea: 1, productoId: 'P001', cantidad: 2, precio: 2500 }, { linea: null, productoId: 'P002', cantidad: 1, precio: 800 },
    ], ['VEN01']));

    expect(db.escrituras).toHaveLength(2);
    expect(db.hojas).toMatchObject({
      pedidos: [['PE0001', DIA, 'C0001', 'ROS', ''], ['PE0002', DIA, 'C0001', 'BB', '']],
      pedidosItems: [['PE0002', 1, 'P001', 2, '', 3000], ['PE0001', 1, 'P001', 2, '', 2500], ['PE0001', 2, 'P002', 1, '', 800]],
      pedidosVendedores: [['PE0002', 'VEN01'], ['PE0001', 'VEN01']],
      ventas: [['V0001', DIA, 'PE0001', 'ROS', ''], ['V0002', DIA, 'PE0002', 'BB', '']],
      ventasItems: [['V0002', 1, 1, 'P001', 2, 3000, 6000, 1500], ['V0001', 1, 1, 'P001', 2, 2500, 5000, 1500]],
      ventasComisiones: [['V0002', 1, 'VEN01', 10, 10, 600], ['V0001', 1, 'VEN01', 10, 10, 500]],
      precios: [['P002', 800, DIA]],
      pedidosEstados: [['PE0001', MOMENTO, 'abierto'], ['PE0002', MOMENTO, 'abierto']],
    });
  });

  it('borrar una venta borra sus ítems, comisiones, envío y cobros, y deja las demás', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria();
    const conEnvio = { ...entrega('V0001'), envio: { ventaId: 'V0001', vendedorId: 'VEN01', costoRegla: 500, costo: 500 } };
    await db.registrarPedido({ pedido, items: [item], vendedores: ['VEN01'], momento: dia, entrega: conEnvio, cobros: [cobro], preciosNuevos: [] });
    await db.registrarEntrega(entrega('V0002'), [{ ...cobro, ventaId: 'V0002' }]);
    await db.borrarVenta('V0001');

    expect(db.hojas).toMatchObject({
      pedidos: [['PE0001', DIA, 'C0001', 'BB', '']],
      ventas: [['V0002', DIA, 'PE0001', 'BB', '']],
      ventasItems: [['V0002', 1, 1, 'P001', 2, 3000, 6000, 1500]],
      ventasComisiones: [['V0002', 1, 'VEN01', 10, 10, 600]],
      ventasEnvios: [],
      cobros: [[DIA, 'V0002', 6000, 'efectivo', 'SOC02', '']],
    });
  });

  it('corregir algo que no está en la hoja falla sin escribir', async () => {
    expect.hasAssertions();

    const db = crearPlanillaEnMemoria({ productos: [['P001', 'Almendras', 'kg', '']] });

    await expect(db.corregirProducto({ id: 'P009', producto: 'Otro', unidad: 'kg', minimo: null })).rejects.toThrow('No está en la hoja "Productos"');
    expect(db.reemplazos).toStrictEqual([]);
  });
});
