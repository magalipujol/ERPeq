import { describe, expect, it } from 'vitest';
import * as M from './modelo';

const fecha = (a: number, m: number, d: number) => new Date(a, m - 1, d, 12);

const vacios = (): M.Datos => ({
  depositos: [{ id: 'BB', nombre: 'General', localidad: '' }, { id: 'ROS', nombre: 'Rosario', localidad: '' }],
  productos: [], contactos: [], tipos: [], vendedores: [], precios: [], reglas: [], compras: [], pedidos: [],
  pedidosItems: [], pedidosEstados: [], pedidosVendedores: [], ventas: [], ventasItems: [], ventasComisiones: [],
  fletes: [], fletesItems: [], fletesEstados: [], pedidosFletes: [], ajustes: [], socios: [], cobros: [], rendiciones: [],
  recetas: [], recetasItems: [],
});
const datos = (d: Partial<M.Datos>): M.Datos => ({ ...vacios(), ...d });
const producto = (id: string): M.Producto => ({ id, producto: id, unidad: 'kg', minimo: 0 });
const compra = (c: Partial<M.Compra>): M.Compra => ({
  fila: 2, fecha: fecha(2026, 10, 1), depositoId: 'BB', contactoId: '', productoId: 'P001',
  cantidad: 1, precio: null, importe: null, remito: '', pedidoId: '', nota: '', ...c,
});
const pedido = (id: string, depositoId = 'ROS'): M.Pedido => ({
  id, fecha: fecha(2026, 10, 1), contactoId: '', depositoId, nota: '',
});
const item = (pedidoId: string, linea: number, productoId: string, cantidad: number, precio = 100): M.PedidoItem => ({
  pedidoId, linea, productoId, cantidad, precioLista: precio, precio,
});
const venta = (id: string, pedidoId: string, depositoId = 'ROS', f = fecha(2026, 10, 5)): M.Venta => ({ id, fecha: f, pedidoId, depositoId, nota: '' });
const ventaItem = (ventaId: string, linea: number, pedidoLinea: number, productoId: string, cantidad: number, precio = 100, costo: number | null = 50): M.VentaItem => ({
  ventaId, linea, pedidoLinea, productoId, cantidad, precio, importe: cantidad * precio, costo,
});
const flete = (id: string, origenId: string, destinoId: string, costo: number | null = null): M.Flete => ({
  id, fecha: fecha(2026, 10, 1), contactoId: '', origenId, destinoId, costo, guia: '', nota: '',
});
const estado = (ref: string, e: string): M.RegistroEstado => ({ ref, fecha: null, estado: e });

describe('precioVigente', () => {
  const precios: M.Precio[] = [
    { productoId: 'P001', precio: 100, desde: fecha(2026, 1, 1) },
    { productoId: 'P001', precio: 120, desde: fecha(2026, 6, 1) },
    { productoId: 'P001', precio: 150, desde: fecha(2026, 12, 1) },
  ];

  it('toma el más reciente que no sea posterior a la fecha', () => {
    expect(M.precioVigente(precios, 'P001', fecha(2026, 5, 31))).toBe(100);
    expect(M.precioVigente(precios, 'P001', fecha(2026, 10, 16))).toBe(120);
    expect(M.precioVigente(precios, 'P002', fecha(2026, 10, 16))).toBeNull();
  });

  it('con la misma fecha gana la fila agregada después', () => {
    expect(M.precioVigente([...precios, { productoId: 'P001', precio: 130, desde: fecha(2026, 6, 1) }], 'P001', fecha(2026, 7, 1))).toBe(130);
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
    ventasComisiones: [{ ventaId: 'V1', linea: 1, vendedorId: 'VEN01', porcentajeRegla: 3, porcentaje: 5, monto: 20 }],
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

describe('propuestaPedido', () => {
  const contacto = (id: string, localidad: string): M.Contacto => ({
    id, rol: 'cliente', nombre: id, tipo: '', telefono: '', direccion: '', email: '', localidad, provincia: '', observaciones: '',
  });
  const base = datos({
    depositos: [{ id: 'BB', nombre: 'General', localidad: 'Bahía Blanca' }, { id: 'ROS', nombre: 'Rosario', localidad: 'Rosario, Santa Fe' }],
    contactos: [contacto('C1', 'ROSARIO'), contacto('C2', 'Funes'), contacto('C3', ''), contacto('C4', 'Bahia Blanca')],
    vendedores: [
      { id: 'VEN01', nombre: 'Leo', activo: true, localidad: '' },
      { id: 'VEN02', nombre: 'Guada/Hernán', activo: true, localidad: 'Rosario' },
      { id: 'VEN03', nombre: 'Ex', activo: false, localidad: 'Rosario' },
    ],
    pedidos: [{ ...pedido('PE1', 'BB'), contactoId: 'C1' }, { ...pedido('PE2', 'BB'), contactoId: 'C2' }],
    pedidosVendedores: [{ pedidoId: 'PE1', vendedorId: 'VEN01' }, { pedidoId: 'PE2', vendedorId: 'VEN01' }],
  });

  it('propone los vendedores activos y el depósito de la localidad del cliente, sin mirar tildes ni mayúsculas', () => {
    expect(M.propuestaPedido(base, 'C1')).toStrictEqual({ vendedores: ['VEN02'], depositoId: 'ROS' });
  });

  it('si en su localidad no hay vendedor ni depósito, propone los de su último pedido', () => {
    expect(M.propuestaPedido(base, 'C2')).toStrictEqual({ vendedores: ['VEN01'], depositoId: 'BB' });
  });

  it('resuelve cada cosa por separado y no propone nada si no hay de dónde sacarlo', () => {
    expect(M.propuestaPedido(base, 'C4')).toStrictEqual({ vendedores: [], depositoId: 'BB' });
    expect(M.propuestaPedido(base, 'C3')).toStrictEqual({ vendedores: [], depositoId: null });
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
      ajustes: [{ fecha: null, depositoId: 'BB', productoId: 'P001', cantidad: -1.5, motivo: '' }],
    }));

    expect(s.enDeposito.get('P001')).toStrictEqual({ BB: 8.5, ROS: 3 });
  });

  // Ejemplo de la spec: 800 en Bahía Blanca, 100 en Rosario, un flete de 500.
  const conFlete = (...estados: string[]) => M.calcularStock(datos({
    productos,
    compras: [compra({ cantidad: 800 }), compra({ cantidad: 100, depositoId: 'ROS' })],
    fletes: [flete('F1', 'BB', 'ROS')],
    fletesItems: [{ fleteId: 'F1', productoId: 'P001', cantidad: 500 }],
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
      fletesItems: [{ fleteId: 'F1', productoId: 'P001', cantidad: 120 }],
      fletesEstados: [estado('F1', 'camino')],
    }));

    expect(s.comprometido.get('P001')).toStrictEqual({ BB: 0, ROS: 300 });
    // 300 comprometidos − 100 en Rosario − 120 en camino.
    expect(M.faltante(s, 'P001', 'ROS')).toBe(80);
  });

  it('marca las líneas pendientes de un pedido cuyo producto falta en su depósito', () => {
    const d = datos({
      productos: [...productos, producto('P002')],
      compras: [compra({ cantidad: 100, depositoId: 'ROS' }), compra({ productoId: 'P002', cantidad: 100, depositoId: 'ROS' })],
      pedidos: [pedido('PE1', 'ROS')],
      pedidosItems: [item('PE1', 1, 'P001', 300), item('PE1', 2, 'P002', 50)],
    });
    const [r] = M.resumirPedidos(d);
    const s = M.calcularStock(d, [r]);

    expect(M.lineasConFaltante(s, r).map((l) => l.productoId)).toStrictEqual(['P001']);
  });
});

describe('armarEntrega', () => {
  it('numera los ítems entregados, calcula importes y una comisión por vendedor', () => {
    const vend: M.Vendedor = { id: 'VEN01', nombre: 'Guada/Hernán', activo: true, localidad: '' };
    const linea = (n: number, precio: number): M.LineaPedido => ({ ...item('PE1', n, `P00${n}`, 25, precio), entregado: 0, pendiente: 25 });
    const e = M.armarEntrega(venta('V1', 'PE1'), [
      { linea: linea(1, 4080), cantidad: 25, costo: 1450, comisiones: [{ vendedor: vend, porcentajeRegla: 7, porcentaje: 7 }] },
      { linea: linea(2, 2550), cantidad: 0, costo: null, comisiones: [] },
      { linea: linea(3, 2550), cantidad: 10, costo: null, comisiones: [{ vendedor: vend, porcentajeRegla: 3, porcentaje: 5 }] },
    ]);

    expect(e.items.map((i) => [i.linea, i.pedidoLinea, i.productoId, i.cantidad, i.importe, i.costo])).toStrictEqual([
      [1, 1, 'P001', 25, 102000, 1450],
      [2, 3, 'P003', 10, 25500, null],
    ]);
    expect(e.comisiones.map((c) => [c.linea, c.vendedorId, c.porcentajeRegla, c.porcentaje, c.monto])).toStrictEqual([
      [1, 'VEN01', 7, 7, 7140],
      [2, 'VEN01', 3, 5, 1275],
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
        { ventaId: 'V1', linea: 1, vendedorId: 'A', porcentajeRegla: null, porcentaje: 5, monto: 5 },
        { ventaId: 'V1', linea: 1, vendedorId: 'B', porcentajeRegla: null, porcentaje: 5, monto: 5 },
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

  it('un flete dado de alta ya despachado registra también los estados anteriores', () => {
    expect(M.caminoFlete('preparacion')).toStrictEqual(['preparacion']);
    expect(M.caminoFlete('finalizado')).toStrictEqual(['preparacion', 'camino', 'finalizado']);
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

// ---------- Caja ----------

// Ejemplo de la spec: Guada/Hernán (VEN01) entrega V0001 por $8.000 con 3% de comisión y cobra en efectivo;
// Sampatti cobra por transferencia V0002, de $15.000, con 7% de comisión para Guada/Hernán.
const SAMPATTI: M.Socio = { id: 'SOC01', nombre: 'Sampatti', vendedores: ['VEN02'], duenio: true };
const GH: M.Socio = { id: 'SOC02', nombre: 'Guada/Hernán', vendedores: ['VEN01'], duenio: false };

const contacto = (id: string, nombre: string): M.Contacto => ({
  id, rol: 'cliente', nombre, tipo: '', telefono: '', direccion: '', email: '', localidad: '', provincia: '', observaciones: '',
});

const caja = (d: Partial<M.Datos> = {}): M.Datos => datos({
  contactos: [contacto('C0001', 'Ana'), contacto('C0002', 'Bruno')],
  pedidos: [
    { id: 'PE0001', fecha: fecha(2026, 10, 1), contactoId: 'C0001', depositoId: 'ROS', nota: '' },
    { id: 'PE0002', fecha: fecha(2026, 10, 1), contactoId: 'C0002', depositoId: 'BB', nota: '' },
  ],
  ventas: [
    { id: 'V0001', fecha: fecha(2026, 10, 2), pedidoId: 'PE0001', depositoId: 'ROS', nota: '' },
    { id: 'V0002', fecha: fecha(2026, 10, 4), pedidoId: 'PE0002', depositoId: 'BB', nota: '' },
  ],
  ventasItems: [
    { ventaId: 'V0001', linea: 1, pedidoLinea: 1, productoId: 'P002', cantidad: 10, precio: 800, importe: 8000, costo: 500 },
    { ventaId: 'V0002', linea: 1, pedidoLinea: 1, productoId: 'P001', cantidad: 3, precio: 3000, importe: 9000, costo: 1500 },
    { ventaId: 'V0002', linea: 2, pedidoLinea: 2, productoId: 'P003', cantidad: 3, precio: 2000, importe: 6000, costo: null },
  ],
  ventasComisiones: [
    { ventaId: 'V0001', linea: 1, vendedorId: 'VEN01', porcentajeRegla: 3, porcentaje: 3, monto: 240 },
    { ventaId: 'V0002', linea: 1, vendedorId: 'VEN01', porcentajeRegla: 7, porcentaje: 7, monto: 630 },
    { ventaId: 'V0002', linea: 2, vendedorId: 'VEN01', porcentajeRegla: 7, porcentaje: 7, monto: 420 },
  ],
  socios: [SAMPATTI, GH],
  ...d,
});

const cobro = (ventaId: string, importe: number, medio: M.Medio, socio: M.Socio, f = fecha(2026, 10, 2)): M.Cobro => ({
  fecha: f, ventaId, importe, medio, socioId: socio.id, nota: '',
});
const rendicion = (de: M.Socio, a: M.Socio, importe: number, f = fecha(2026, 10, 3)): M.Rendicion => ({
  fecha: f, deId: de.id, aId: a.id, importe, medio: 'efectivo', nota: '',
});

describe('cuentasVentas', () => {
  it('lo cobrado se descuenta del importe de la venta, en uno o varios cobros', () => {
    const d = caja({ cobros: [cobro('V0002', 10000, 'transferencia', SAMPATTI), cobro('V0002', 2000, 'efectivo', GH)] });

    expect(M.cuentasVentas(d).map((c) => [c.venta.id, c.pedido?.contactoId, c.importe, c.cobrado, c.saldo])).toStrictEqual([
      ['V0001', 'C0001', 8000, 0, 8000], ['V0002', 'C0002', 15000, 12000, 3000],
    ]);
  });

  it('ventasACobrar deja solo las que tienen saldo', () => {
    const d = caja({ cobros: [cobro('V0001', 8000, 'efectivo', GH)] });

    expect(M.ventasACobrar(d).map((c) => c.venta.id)).toStrictEqual(['V0002']);
  });
});

describe('cuentasSocios', () => {
  const de = (d: M.Datos) => {
    const cuentas = M.cuentasSocios(d);

    expect(cuentas.map((c) => c.socio.id)).toStrictEqual(['SOC02']); // el dueño no tiene cuenta

    return cuentas[0];
  };

  it('quien cobra en efectivo le debe al dueño lo cobrado menos su comisión', () => {
    // V0002 todavía no se cobró, pero su comisión ya cuenta.
    const sinV2 = caja({ ventasComisiones: caja().ventasComisiones.slice(0, 1), cobros: [cobro('V0001', 8000, 'efectivo', GH)] });

    expect(de(sinV2)).toMatchObject({ cobradoEfectivo: 8000, comisiones: 240, saldo: 7760 });
  });

  it('una rendición baja el saldo y una venta cobrada por el dueño lo deja debiéndole la comisión', () => {
    const d = caja({
      cobros: [cobro('V0001', 8000, 'efectivo', GH), cobro('V0002', 15000, 'transferencia', SAMPATTI, fecha(2026, 10, 4))],
      rendiciones: [rendicion(GH, SAMPATTI, 7000)],
    });
    const cuenta = de(d);

    // 8.000 − 240 − 7.000 − (630 + 420) = −290: Sampatti le debe $290.
    expect(cuenta).toMatchObject({ cobradoEfectivo: 8000, cobradoTransferencia: 0, comisiones: 1290, entregado: 7000, recibido: 0, saldo: -290 });
    expect(cuenta.movimientos.map((m) => [m.tipo, m.ref, m.importe, m.saldo])).toStrictEqual([
      ['cobro', 'V0001', 8000, 8000], ['comision', 'V0001', -240, 7760], ['entrego', 'Sampatti', -7000, 760],
      ['comision', 'V0002', -1050, -290],
    ]);
  });

  it('lo que el dueño le paga al socio sube su saldo', () => {
    const d = caja({ cobros: [cobro('V0002', 15000, 'transferencia', SAMPATTI)], rendiciones: [rendicion(SAMPATTI, GH, 1290)] });

    expect(de(d).saldo).toBe(0);
  });

  it('las comisiones de vendedores sin socio o del dueño no entran en ninguna cuenta', () => {
    const d = caja({ socios: [SAMPATTI, { ...GH, vendedores: [] }] });

    expect(de(d)).toMatchObject({ comisiones: 0, saldo: 0, movimientos: [] });
  });
});

describe('socioPropuesto', () => {
  it('el socio del vendedor del pedido; si no tiene, el dueño', () => {
    expect(M.socioPropuesto([SAMPATTI, GH], ['VEN09', 'VEN01'])).toBe(GH);
    expect(M.socioPropuesto([GH, SAMPATTI], [])).toBe(SAMPATTI);
    expect(M.socioPropuesto([], ['VEN01'])).toBeUndefined();
  });
});

describe('nombres', () => {
  it('salen de la hoja de cada cosa por ID; un ID que no existe se muestra tal cual', () => {
    const n = M.nombres(caja({ productos: [producto('P001')], vendedores: [{ id: 'VEN01', nombre: 'Guada/Hernán', activo: true, localidad: '' }] }));

    expect([n.producto('P001'), n.contacto('C0002'), n.vendedor('VEN01'), n.socio('SOC01'), n.deposito('BB')])
      .toStrictEqual(['P001', 'Bruno', 'Guada/Hernán', 'Sampatti', 'General']);
    expect([n.producto('P999'), n.contacto('')]).toStrictEqual(['P999', '']);
  });

  it('el cliente de los movimientos de un socio es el nombre actual del contacto', () => {
    const d = caja({ cobros: [cobro('V0001', 8000, 'efectivo', GH)] });
    d.contactos[0] = { ...d.contactos[0], nombre: 'Ana María' };

    expect(M.cuentasSocios(d)[0].movimientos.filter((m) => m.ref === 'V0001').map((m) => m.detalle))
      .toStrictEqual(['Ana María', 'Ana María']);
  });
});

describe('recetas', () => {
  const receta = (version: number, desde: Date | null, activa = true): M.Receta => ({
    id: 'RE0001', version, desde, productoId: 'MIX', cantidad: 0.95, activa,
  });
  const insumo = (version: number, productoId: string, cantidad: number): M.RecetaItem => ({ recetaId: 'RE0001', version, productoId, cantidad });
  const d = {
    recetas: [receta(1, fecha(2026, 9, 1)), receta(2, fecha(2026, 10, 1)), receta(3, fecha(2026, 10, 1), false)],
    recetasItems: [insumo(1, 'P001', 1), insumo(2, 'P001', 0.6), insumo(2, 'P002', 0.4)],
  };

  it('la versión vigente es la de desde más reciente y, ante la misma fecha, la de número más alto', () => {
    const [sept] = M.recetasVigentes(d, fecha(2026, 9, 15));

    expect(sept.receta.version).toBe(1);
    expect(sept.items.map((i) => i.productoId)).toStrictEqual(['P001']);
    // El 1/10 hay dos versiones: la 3 la da de baja.
    expect(M.recetasVigentes(d, fecha(2026, 10, 5))[0].receta).toMatchObject({ version: 3, activa: false });
    expect(M.recetasVigentes(d, fecha(2026, 8, 1))).toStrictEqual([]);
  });

  it('numera la versión siguiente', () => {
    expect(M.siguienteVersion(d.recetas, 'RE0001')).toBe(4);
    expect(M.siguienteVersion(d.recetas, 'RE0002')).toBe(1);
  });

  it('suma los insumos de la misma unidad y calcula la merma', () => {
    const productos = [producto('P001'), producto('P002'), { ...producto('P003'), unidad: 'unid.' }];
    const items = [{ productoId: 'P001', cantidad: 0.6 }, { productoId: 'P002', cantidad: 0.4 }, { productoId: 'P003', cantidad: 2 }];

    // Las 2 unidades de P003 no se suman a los kilos.
    expect(M.sumaInsumos(items, productos, 'kg')).toBe(1);
    // Entra 1 kg y salen 950 g: 5 % de merma.
    expect(M.merma(1, 0.95)).toBe(0.05);
    expect(M.merma(0, 1)).toBeNull();
  });
});

describe('fabricación', () => {
  const fab: M.Fabricacion = { id: 'FA0001', fecha: fecha(2026, 10, 16), depositoId: 'BB', recetaId: 'RE0001', version: 2, productoId: 'MIX', cantidad: 1.9 };
  const insumos = [{ productoId: 'P001', cantidad: 1.2 }, { productoId: 'P002', cantidad: 0.8 }, { productoId: 'P003', cantidad: 0 }];

  it('descuenta los insumos y suma el producto con ajustes del mismo motivo', () => {
    // El insumo con cantidad 0 no genera ajuste.
    expect(M.armarFabricacion(fab, insumos).map((a) => [a.productoId, a.cantidad, a.depositoId, a.motivo])).toStrictEqual([
      ['P001', -1.2, 'BB', 'Fabricación FA0001 (RE0001 v2)'],
      ['P002', -0.8, 'BB', 'Fabricación FA0001 (RE0001 v2)'],
      ['MIX', 1.9, 'BB', 'Fabricación FA0001 (RE0001 v2)'],
    ]);
  });

  it('reconstruye las fabricaciones desde los ajustes e ignora los demás', () => {
    const conteo: M.Ajuste = { fecha: null, depositoId: 'BB', productoId: 'P001', cantidad: 3, motivo: 'conteo' };
    const ajustes = [...M.armarFabricacion(fab, insumos), conteo];

    expect(M.fabricaciones(ajustes)).toStrictEqual([fab]);
  });

  it('estima el costo de los insumos por unidad de lo que sale', () => {
    const costos = new Map([['P001', 10000], ['P002', 5000]]);

    // 1,2 × $10.000 + 0,8 × $5.000 = $16.000 / 1,9 kg = $8.421,05 el kg.
    expect(M.costoInsumos(insumos, 1.9, costos)).toBe(8421.05);
    expect(M.costoInsumos(insumos, 1.9, new Map([['P001', 10000]]))).toBeNull();
    expect(M.costoInsumos(insumos, 0, costos)).toBeNull();
  });
});
