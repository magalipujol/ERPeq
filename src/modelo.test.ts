import { describe, expect, it } from 'vitest';
import { deSerie } from './google';
import * as M from './modelo';

const fecha = (a: number, m: number, d: number) => new Date(a, m - 1, d, 12);

const vacios = (): M.Datos => ({
  depositos: [{ id: 'BB', nombre: 'General', localidad: '' }, { id: 'ROS', nombre: 'Rosario', localidad: '' }],
  productos: [], contactos: [], tipos: [], vendedores: [], precios: [], reglas: [], compras: [], pedidos: [],
  pedidosItems: [], pedidosEstados: [], pedidosVendedores: [], ventas: [], ventasItems: [], ventasComisiones: [],
  fletes: [], fletesItems: [], fletesEstados: [], pedidosFletes: [], ajustes: [],
});
const datos = (d: Partial<M.Datos>): M.Datos => ({ ...vacios(), ...d });
const producto = (id: string): M.Producto => ({ id, producto: id, unidad: 'kg', minimo: 0 });
const compra = (c: Partial<M.Compra>): M.Compra => ({
  fila: 2, fecha: fecha(2026, 10, 1), depositoId: 'BB', proveedor: 'Prov', contactoId: '', productoId: 'P001', producto: 'Almendras',
  cantidad: 1, precio: null, importe: null, remito: '', pedidoId: '', nota: '', ...c,
});
const pedido = (id: string, depositoId = 'ROS'): M.Pedido => ({
  id, fecha: fecha(2026, 10, 1), contactoId: '', cliente: 'Ana', tipo: '', localidad: '', provincia: '', depositoId, nota: '',
});
const item = (pedidoId: string, linea: number, productoId: string, cantidad: number, precio = 100): M.PedidoItem => ({
  pedidoId, linea, productoId, producto: productoId, cantidad, precioLista: precio, precio,
});
const venta = (id: string, pedidoId: string, depositoId = 'ROS', f = fecha(2026, 10, 5)): M.Venta => ({ id, fecha: f, pedidoId, depositoId, nota: '' });
const ventaItem = (ventaId: string, linea: number, pedidoLinea: number, productoId: string, cantidad: number, precio = 100, costo: number | null = 50): M.VentaItem => ({
  ventaId, linea, pedidoLinea, productoId, producto: productoId, cantidad, precio, importe: cantidad * precio, costo,
});
const flete = (id: string, origenId: string, destinoId: string, costo: number | null = null): M.Flete => ({
  id, fecha: fecha(2026, 10, 1), transporte: 'T', contactoId: '', origenId, destinoId, costo, guia: '', nota: '',
});
const estado = (ref: string, e: string): M.RegistroEstado => ({ ref, fecha: null, estado: e });

describe('parsear', () => {
  const crudo = (h: Partial<Record<M.ClaveHoja, M.Fila[]>>) => M.CLAVES.map((k) => h[k] ?? []);

  const d = M.parsear(crudo({
    productos: [['P001', ' Almendras ', '', ''], ['', 'sin id'], ['P002', 'Miel', 'unid.', '5']],
    compras: [[45658, 'BB', 'Prov', 'C0001', 'P001', 'Almendras', 10, 1000, 10000, 'R-1', 'PE0001', ''], ['', '', '', '', ''],
      [45659, 'ROS', 'Prov', '', 'P002', 'Miel', '3', '', '', '', '', '']],
    vendedores: [['VEN01', 'Guada/Hernán', ''], ['VEN02', 'Leo', 'no']],
    pedidosItems: [['PE0001', 1, 'P001', 'Almendras', 2, '', 3000]],
    ventasComisiones: [['V0001', 1, 'VEN01', 'Guada/Hernán', 3, 5, 300]],
      pedidosEstados: [['PE0001', 46000.5, 'Cerrado']],
  }), deSerie);

  it('lee cada hoja en el orden de CLAVES y saltea filas sin clave', () => {
    expect(d.productos).toStrictEqual([
      { id: 'P001', producto: 'Almendras', unidad: 'kg', minimo: 0 },
      { id: 'P002', producto: 'Miel', unidad: 'unid.', minimo: 5 },
    ]);
    // La fila 3 quedó vacía y no se cuenta.
    expect(d.compras.map((c) => [c.fila, c.productoId, c.cantidad, c.precio, c.pedidoId])).toStrictEqual([
      [2, 'P001', 10, 1000, 'PE0001'], [4, 'P002', 3, null, ''],
    ]);
    expect(d.compras[0].fecha).toStrictEqual(new Date(2025, 0, 1));
  });

  it('vendedores activos, precios sobreescritos y estados', () => {
    expect(d.vendedores.map((v) => v.activo)).toStrictEqual([true, false]);
    expect(d.pedidosItems[0]).toMatchObject({ precioLista: null, precio: 3000 });
    expect(d.ventasComisiones[0]).toMatchObject({ porcentajeRegla: 3, porcentaje: 5, monto: 300 });
    expect(d.pedidosEstados[0].estado).toBe('cerrado');
  });

  it('deja la fecha vacía si la celda no es una fecha', () => {
    const r = M.parsear(crudo({ compras: [['texto', 'BB', '', '', 'P001', '', 1]] }), deSerie);

    expect(r.compras[0].fecha).toBeNull();
  });
});

describe('rango', () => {
  it('cubre las columnas de la hoja desde la fila 2', () => {
    expect(M.rango('ventasItems')).toBe("'Ventas ítems'!A2:I");
    expect(M.rango('tipos')).toBe("'Tipos de cliente'!A2:A");
  });
});

describe('precioVigente', () => {
  const precios: M.Precio[] = [
    { productoId: 'P001', producto: '', precio: 100, desde: fecha(2026, 1, 1) },
    { productoId: 'P001', producto: '', precio: 120, desde: fecha(2026, 6, 1) },
    { productoId: 'P001', producto: '', precio: 150, desde: fecha(2026, 12, 1) },
  ];

  it('toma el más reciente que no sea posterior a la fecha', () => {
    expect(M.precioVigente(precios, 'P001', fecha(2026, 5, 31))).toBe(100);
    expect(M.precioVigente(precios, 'P001', fecha(2026, 10, 16))).toBe(120);
    expect(M.precioVigente(precios, 'P002', fecha(2026, 10, 16))).toBeNull();
  });

  it('con la misma fecha gana la fila agregada después', () => {
    expect(M.precioVigente([...precios, { productoId: 'P001', producto: '', precio: 130, desde: fecha(2026, 6, 1) }], 'P001', fecha(2026, 7, 1))).toBe(130);
  });
});

describe('porcentajeRegla', () => {
  const reglas: M.ReglaComision[] = [
    { vendedorId: 'VEN01', productoId: '', porcentaje: 3, desde: fecha(2024, 1, 1) },
    { vendedorId: 'VEN01', productoId: 'P014', porcentaje: 7, desde: fecha(2024, 1, 1) },
    { vendedorId: 'VEN01', productoId: '', porcentaje: 4, desde: fecha(2026, 11, 1) },
  ];

  it('prefiere la regla del producto sobre la general', () => {
    expect(M.porcentajeRegla(reglas, 'VEN01', 'P014', fecha(2026, 10, 1))).toBe(7);
    expect(M.porcentajeRegla(reglas, 'VEN01', 'P001', fecha(2026, 10, 1))).toBe(3);
  });

  it('respeta la fecha desde y da 0 sin reglas', () => {
    expect(M.porcentajeRegla(reglas, 'VEN01', 'P001', fecha(2026, 11, 2))).toBe(4);
    expect(M.porcentajeRegla(reglas, 'VEN02', 'P001', fecha(2026, 11, 2))).toBe(0);
  });
});

describe('costosPromedio', () => {
  it('pondera por cantidad y saltea compras sin precio o sin cantidad', () => {
    const costos = M.costosPromedio([
      compra({ cantidad: 10, precio: 2000 }),
      compra({ cantidad: 30, precio: 1000 }),
      compra({ cantidad: 50, precio: null }),
      compra({ cantidad: 0, precio: 9999 }),
      compra({ productoId: 'P002', cantidad: 3, precio: 100 }),
    ]);

    expect(costos).toStrictEqual(new Map([['P001', 1250], ['P002', 100]]));
  });
});

describe('resumirPedidos', () => {
  const base = datos({
    pedidos: [pedido('PE1'), pedido('PE2'), pedido('PE3'), pedido('PE4')],
    pedidosItems: [item('PE1', 1, 'P001', 10), item('PE1', 2, 'P002', 5), item('PE2', 1, 'P001', 3), item('PE3', 1, 'P001', 2), item('PE4', 1, 'P001', 4)],
    ventas: [venta('V1', 'PE1'), venta('V2', 'PE2'), venta('V3', 'PE4')],
    ventasItems: [ventaItem('V1', 1, 1, 'P001', 4), ventaItem('V2', 1, 1, 'P001', 3), ventaItem('V3', 1, 1, 'P001', 1)],
    ventasComisiones: [{ ventaId: 'V1', linea: 1, vendedorId: 'VEN01', vendedor: '', porcentajeRegla: 3, porcentaje: 5, monto: 20 }],
    pedidosEstados: [estado('PE3', 'abierto'), estado('PE3', 'cancelado'), estado('PE4', 'cerrado')],
    pedidosFletes: [{ pedidoId: 'PE1', fleteId: 'F1', costoAsignado: 30 }],
  });
  const r = new Map(M.resumirPedidos(base).map((x) => [x.pedido.id, x]));

  it('calcula el estado a partir de las entregas y de los estados manuales', () => {
    expect([...r.values()].map((x) => x.estado)).toStrictEqual(['parcial', 'entregado', 'cancelado', 'cerrado']);
  });

  it('lo pendiente es lo pedido menos lo entregado; 0 si el pedido se cerró', () => {
    expect(r.get('PE1')?.lineas.map((l) => [l.entregado, l.pendiente])).toStrictEqual([[4, 6], [0, 5]]);
    expect(r.get('PE4')?.lineas[0].pendiente).toBe(0);
  });

  it('ganancia = entregado − comisiones − costo de mercadería − fletes asignados', () => {
    expect(r.get('PE1')).toMatchObject({ importePedido: 1500, importeEntregado: 400, comisiones: 20, costoMercaderia: 200, fletes: 30, ganancia: 150 });
  });
});

describe('calcularStock', () => {
  const productos = [producto('P001')];

  it('compras, ventas por depósito de la venta y ajustes', () => {
    const s = M.calcularStock(datos({
      productos,
      compras: [compra({ cantidad: 10 }), compra({ cantidad: 5, depositoId: 'ROS' })],
      pedidos: [pedido('PE1', 'ROS')], pedidosItems: [item('PE1', 1, 'P001', 2)],
      ventas: [venta('V1', 'PE1', 'ROS')], ventasItems: [ventaItem('V1', 1, 1, 'P001', 2)],
      ajustes: [{ fecha: null, depositoId: 'BB', productoId: 'P001', producto: '', cantidad: -1.5, motivo: '' }],
    }));

    expect(s.enDeposito.get('P001')).toStrictEqual({ BB: 8.5, ROS: 3 });
  });

  // Ejemplo de la spec: 800 en Bahía Blanca, 100 en Rosario, un flete de 500.
  const conFlete = (...estados: string[]) => M.calcularStock(datos({
    productos,
    compras: [compra({ cantidad: 800 }), compra({ cantidad: 100, depositoId: 'ROS' })],
    fletes: [flete('F1', 'BB', 'ROS')],
    fletesItems: [{ fleteId: 'F1', productoId: 'P001', producto: '', cantidad: 500 }],
    fletesEstados: estados.map((e) => estado('F1', e)),
  }));

  it('en preparación: sigue en el origen, reservado', () => {
    const s = conFlete('preparacion');

    expect(s.enDeposito.get('P001')).toStrictEqual({ BB: 800, ROS: 100 });
    expect(s.reservado.get('P001')).toStrictEqual({ BB: 500, ROS: 0 });
  });

  it('en camino: sale del origen y queda en tránsito hacia el destino', () => {
    const s = conFlete('preparacion', 'camino');

    expect(s.enDeposito.get('P001')).toStrictEqual({ BB: 300, ROS: 100 });
    expect(s.enTransito.get('P001')).toStrictEqual({ BB: 0, ROS: 500 });
  });

  it('finalizado: entra en el destino', () => {
    const s = conFlete('preparacion', 'camino', 'finalizado');

    expect(s.enDeposito.get('P001')).toStrictEqual({ BB: 300, ROS: 600 });
    expect(M.sumaDeps(s.enTransito.get('P001'))).toBe(0);
  });

  it('cancelado o que volvió a preparación: no mueve stock', () => {
    expect(conFlete('preparacion', 'cancelado').enDeposito.get('P001')).toStrictEqual({ BB: 800, ROS: 100 });
    expect(conFlete('preparacion', 'camino', 'preparacion').enDeposito.get('P001')).toStrictEqual({ BB: 800, ROS: 100 });
  });

  it('compromete lo pendiente de pedidos abiertos y calcula el faltante', () => {
    const s = M.calcularStock(datos({
      productos,
      compras: [compra({ cantidad: 100, depositoId: 'ROS' })],
      pedidos: [pedido('PE1', 'ROS'), pedido('PE2', 'ROS')],
      pedidosItems: [item('PE1', 1, 'P001', 300), item('PE2', 1, 'P001', 50)],
      pedidosEstados: [estado('PE2', 'cancelado')],
      fletes: [flete('F1', 'BB', 'ROS')],
      fletesItems: [{ fleteId: 'F1', productoId: 'P001', producto: '', cantidad: 120 }],
      fletesEstados: [estado('F1', 'camino')],
    }));

    expect(s.comprometido.get('P001')).toStrictEqual({ BB: 0, ROS: 300 });
    // 300 comprometidos − 100 en Rosario − 120 en camino.
    expect(M.faltante(s, 'P001', 'ROS')).toBe(80);
  });
});

describe('escribirEntrega', () => {
  it('numera los ítems entregados, calcula importes y una comisión por vendedor', () => {
    const vend: M.Vendedor = { id: 'VEN01', nombre: 'Guada/Hernán', activo: true };
    const linea = (n: number, precio: number): M.LineaPedido => ({ ...item('PE1', n, `P00${n}`, 25, precio), entregado: 0, pendiente: 25 });
    const e = M.escribirEntrega(venta('V1', 'PE1'), [
      { linea: linea(1, 4080), cantidad: 25, costo: 1450, comisiones: [{ vendedor: vend, porcentajeRegla: 7, porcentaje: 7 }] },
      { linea: linea(2, 2550), cantidad: 0, costo: null, comisiones: [] },
      { linea: linea(3, 2550), cantidad: 10, costo: null, comisiones: [{ vendedor: vend, porcentajeRegla: 3, porcentaje: 5 }] },
    ]);

    expect(e.ventasItems).toStrictEqual([
      ['V1', 1, 1, 'P001', 'P001', 25, 4080, 102000, 1450],
      ['V1', 2, 3, 'P003', 'P003', 10, 2550, 25500, ''],
    ]);
    expect(e.ventasComisiones).toStrictEqual([
      ['V1', 1, 'VEN01', 'Guada/Hernán', 7, 7, 7140],
      ['V1', 2, 'VEN01', 'Guada/Hernán', 3, 5, 1275],
    ]);
  });
});

describe('lineasVendidas y ventasPorMes', () => {
  it('suma la comisión de cada ítem y agrupa por mes de la venta', () => {
    const d = datos({
      pedidos: [pedido('PE1')],
      ventas: [venta('V1', 'PE1', 'ROS', fecha(2026, 9, 1)), venta('V2', 'PE1', 'ROS', fecha(2026, 10, 2))],
      ventasItems: [ventaItem('V1', 1, 1, 'P001', 1, 100, 40), ventaItem('V2', 1, 1, 'P001', 2, 100, null)],
      ventasComisiones: [
        { ventaId: 'V1', linea: 1, vendedorId: 'A', vendedor: '', porcentajeRegla: null, porcentaje: 5, monto: 5 },
        { ventaId: 'V1', linea: 1, vendedorId: 'B', vendedor: '', porcentajeRegla: null, porcentaje: 5, monto: 5 },
      ],
    });
    const lineas = M.lineasVendidas(d);

    expect(lineas.map((l) => [l.comision, l.ganancia])).toStrictEqual([[10, 50], [0, null]]);
    expect(M.ventasPorMes(lineas)).toStrictEqual([
      { mes: '2026-09', importe: 100, ganancia: 50, comision: 10, lineas: 1 },
      { mes: '2026-10', importe: 200, ganancia: 0, comision: 0, lineas: 1 },
    ]);
  });
});

describe('estados de flete', () => {
  it('sin estados cuenta como en preparación', () => {
    expect(M.estadoFlete(new Map(), 'F1')).toBe('preparacion');
    expect(M.estadoFlete(M.estadosActuales([estado('F1', 'camino'), estado('F1', 'finalizado')]), 'F1')).toBe('finalizado');
  });
});

describe('iDs', () => {
  it('sigue al mayor ID con el mismo prefijo', () => {
    expect(M.siguienteId(['PE0002', 'PE0010', 'P0099'], 'PE')).toBe('PE0011');
    expect(M.siguienteId([], 'P', 3)).toBe('P001');
  });

  it('el generador da IDs consecutivos', () => {
    const sig = M.generadorIds(['P007'], 'P', 3);

    expect([sig(), sig()]).toStrictEqual(['P008', 'P009']);
  });
});

describe('filas', () => {
  it('compra: calcula el importe y deja vacío el precio desconocido', () => {
    const base = { fecha: fecha(2026, 10, 1), depositoId: 'BB', proveedor: 'Prov', contactoId: '', productoId: 'P001', producto: 'Almendras', remito: '', pedidoId: '', nota: '' };

    expect(M.filas.compra({ ...base, cantidad: 3, precio: 1.1 })[8]).toBe(3.3);
    expect(M.filas.compra({ ...base, cantidad: 3, precio: null }).slice(7, 9)).toStrictEqual(['', '']);
  });

  it('unir junta las filas por hoja', () => {
    expect(M.unir({ ventas: [['a']] }, { ventas: [['b']], ajustes: [['c']] })).toStrictEqual({ ventas: [['a'], ['b']], ajustes: [['c']] });
  });
});
