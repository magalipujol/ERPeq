import { describe, expect, it } from 'vitest';
import * as M from './modelo';

const fecha = (a: number, m: number, d: number) => new Date(a, m - 1, d, 12);

const vacios = (): M.Datos => ({
  depositos: [{ id: 'BB', nombre: 'General', localidad: '' }, { id: 'ROS', nombre: 'Rosario', localidad: '' }],
  productos: [], contactos: [], tipos: [], vendedores: [], precios: [], reglas: [], compras: [], pedidos: [],
  pedidosItems: [], pedidosEstados: [], pedidosVendedores: [], ventas: [], ventasItems: [], ventasComisiones: [],
  fletes: [], fletesItems: [], fletesEstados: [], ajustes: [], socios: [], cobros: [], rendiciones: [],
  recetas: [], recetasItems: [], envios: [], ventasEnvios: [],
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
  id, fecha: fecha(2026, 10, 1), contactoId: '', origenId, destinoId, costo, guia: '', nota: '', salida: null, llegadaEstimada: null,
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
  });
  const r = new Map(M.resumirPedidos(base).map((x) => [x.pedido.id, x]));

  it('calcula el estado a partir de las entregas y de los estados manuales', () => {
    expect([...r.values()].map((x) => x.estado)).toStrictEqual(['parcial', 'entregado', 'cancelado', 'cerrado']);
  });

  it('lo pendiente es lo pedido menos lo entregado; 0 si el pedido se cerró', () => {
    expect(r.get('PE1')?.lineas.map((l) => [l.entregado, l.pendiente])).toStrictEqual([[4, 6], [0, 5]]);
    expect(r.get('PE4')?.lineas[0].pendiente).toBe(0);
  });

  it('ganancia = entregado − comisiones − costo de mercadería (los fletes son gasto del mes)', () => {
    expect(r.get('PE1')).toMatchObject({ importePedido: 1500, importeEntregado: 400, comisiones: 20, costoMercaderia: 200, ganancia: 180 });
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

describe('fleteParaFaltantes', () => {
  const depositos: M.Deposito[] = [...vacios().depositos, { id: 'CBA', nombre: 'Córdoba', localidad: '' }];
  const base = (extra: Partial<M.Datos> = {}) => {
    const d = datos({
      depositos,
      productos: [producto('P001'), producto('P002'), producto('P003')],
      compras: [
        compra({ cantidad: 100, depositoId: 'ROS' }), compra({ productoId: 'P002', cantidad: 100, depositoId: 'ROS' }),
        compra({ cantidad: 500, depositoId: 'BB' }), compra({ cantidad: 1000, depositoId: 'CBA' }),
      ],
      pedidos: [pedido('PE1'), pedido('PE2'), pedido('PE3'), pedido('PE4', 'CBA')],
      pedidosItems: [
        item('PE1', 1, 'P001', 300), item('PE1', 2, 'P002', 50), item('PE2', 1, 'P001', 80),
        item('PE3', 1, 'P003', 20), item('PE4', 1, 'P001', 900),
      ],
      fletes: [flete('F1', 'BB', 'ROS')],
      fletesItems: [{ fleteId: 'F1', productoId: 'P001', cantidad: 120 }],
      fletesEstados: [estado('F1', 'camino')],
      ...extra,
    });
    const resumenes = M.resumirPedidos(d);
    return { s: M.calcularStock(d, resumenes), r: (...ids: string[]) => resumenes.filter((x) => ids.includes(x.pedido.id)) };
  };

  it('lleva lo pendiente de los pedidos elegidos sin pasar el faltante del depósito', () => {
    const { s, r } = base();

    // Almendras en Rosario: 380 comprometidos − 100 en depósito − 120 en camino = 160 faltan. P002 alcanza: no va.
    expect(M.fleteParaFaltantes(s, depositos, 'ROS', r('PE1', 'PE2'))).toStrictEqual({
      origenId: 'BB', destinoId: 'ROS', pedidos: ['PE1', 'PE2'], items: [{ productoId: 'P001', cantidad: 160 }],
    });
    // Solo PE2: sus 80 kg entran en el faltante.
    expect(M.fleteParaFaltantes(s, depositos, 'ROS', r('PE2')).items).toStrictEqual([{ productoId: 'P001', cantidad: 80 }]);
    // P003 no tiene stock en ningún lado: va igual, y el origen es el primer depósito que no es el destino.
    expect(M.fleteParaFaltantes(s, depositos, 'ROS', r('PE3'))).toMatchObject({ origenId: 'BB', items: [{ productoId: 'P003', cantidad: 20 }] });
  });

  it('elige como origen el depósito con más stock libre para lo que hay que llevar', () => {
    // General: 380 en depósito − 300 reservados para otro flete = 80 libres. Córdoba: 1000 − 900 comprometidos = 100.
    const { s, r } = base({
      fletes: [flete('F1', 'BB', 'ROS'), flete('F2', 'BB', 'CBA')],
      fletesItems: [{ fleteId: 'F1', productoId: 'P001', cantidad: 120 }, { fleteId: 'F2', productoId: 'P001', cantidad: 300 }],
      fletesEstados: [estado('F1', 'camino'), estado('F2', 'preparacion')],
    });

    expect(M.fleteParaFaltantes(s, depositos, 'ROS', r('PE1', 'PE2')).origenId).toBe('CBA');
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

describe('envíos', () => {
  // Desde el 1/1 se cobran $5.000 a los pedidos por menos de $150.000; desde el 1/11, $6.000 por menos de $200.000.
  const envios: M.ReglaEnvio[] = [
    { minimo: 150000, costo: 5000, desde: fecha(2026, 1, 1) },
    { minimo: 200000, costo: 6000, desde: fecha(2026, 11, 1) },
  ];
  const envio = (ventaId: string, vendedorId: string, costo: number, costoRegla: number | null = costo): M.VentaEnvio => ({
    ventaId, vendedorId, costoRegla, costo,
  });

  it('se propone el costo vigente si el pedido es por menos del mínimo', () => {
    const d = caja({ envios });

    expect(M.envioPropuesto(d, 'PE0009', 100000, fecha(2026, 10, 18))).toBe(5000);
    expect(M.envioPropuesto(d, 'PE0009', 150000, fecha(2026, 10, 18))).toBe(0);
    expect(M.envioPropuesto(d, 'PE0009', 180000, fecha(2026, 11, 2))).toBe(6000);
    expect(M.envioPropuesto(caja(), 'PE0009', 100000, fecha(2026, 10, 18))).toBe(0); // sin reglas
  });

  it('se cobra una vez por pedido: si una entrega anterior ya lo registró, aunque en 0, no se vuelve a proponer', () => {
    expect(M.envioPropuesto(caja({ envios, ventasEnvios: [envio('V0001', 'VEN01', 5000)] }), 'PE0001', 8000, null)).toBe(0);
    expect(M.envioPropuesto(caja({ envios, ventasEnvios: [envio('V0001', 'VEN01', 0, 5000)] }), 'PE0001', 8000, null)).toBe(0);
    expect(M.envioPropuesto(caja({ envios, ventasEnvios: [envio('V0001', 'VEN01', 5000)] }), 'PE0002', 15000, null)).toBe(6000);
  });

  it('armarEntrega guarda el envío si se propuso o se cobró', () => {
    const v = venta('V1', 'PE1');
    const con = (costoRegla: number, costo: number) => M.armarEntrega(v, [], { vendedorId: 'VEN01', costoRegla, costo }).envio;

    expect(con(5000, 4000)).toStrictEqual({ ventaId: 'V1', vendedorId: 'VEN01', costoRegla: 5000, costo: 4000 });
    expect(con(5000, 0)).toMatchObject({ costo: 0 });
    expect(con(0, 0)).toBeNull();
    expect(M.armarEntrega(v, []).envio).toBeNull();
  });

  it('el envío suma al importe a cobrar de la venta', () => {
    const d = caja({ ventasEnvios: [envio('V0001', 'VEN01', 5000)] });

    expect(M.cuentasVentas(d).map((c) => [c.venta.id, c.importe, c.saldo])).toStrictEqual([['V0001', 13000, 13000], ['V0002', 15000, 15000]]);
  });

  it('el envío del vendedor se le acredita al socio como la comisión', () => {
    const d = caja({
      ventasComisiones: caja().ventasComisiones.slice(0, 1),
      ventasEnvios: [envio('V0001', 'VEN01', 5000)], cobros: [cobro('V0001', 13000, 'efectivo', GH)],
    });
    const [cuenta] = M.cuentasSocios(d);

    // Cobró 13.000 (8.000 + 5.000 de envío) y se queda con 240 de comisión y 5.000 de envío: debe 7.760.
    expect(cuenta).toMatchObject({ cobradoEfectivo: 13000, comisiones: 240, envios: 5000, saldo: 7760 });
    expect(cuenta.movimientos.map((m) => [m.tipo, m.importe, m.saldo])).toStrictEqual([
      ['cobro', 13000, 13000], ['comision', -240, 12760], ['envio', -5000, 7760],
    ]);
  });

  it('en la ganancia del pedido solo suma el envío que queda para el negocio', () => {
    const ganancia = (vendedorId: string) => M.resumirPedidos(caja({ ventasEnvios: [envio('V0001', vendedorId, 5000)] }))[0];

    // 8.000 − 240 de comisión − 10 × 500 de costo = 2.760.
    expect(ganancia('VEN01')).toMatchObject({ envios: 5000, ganancia: 2760 });
    expect(ganancia('')).toMatchObject({ envios: 5000, ganancia: 7760 });
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

describe('contactos y productos', () => {
  const unContacto = (id: string, rol: string, nombre: string): M.Contacto => ({
    id, rol, nombre, tipo: '', telefono: '', direccion: '', email: '', localidad: '', provincia: '', observaciones: '',
  });
  const contactos = [unContacto('C0001', 'cliente', 'Ana Pérez'), unContacto('C0002', 'proveedor', 'Prov A')];

  it('no deja dos contactos con el mismo nombre y rol, sin mirar mayúsculas ni espacios', () => {
    expect(M.problemaContacto(contactos, unContacto('C0003', 'cliente', ' ana  pérez'))).toBe('Ya hay un cliente que se llama Ana Pérez.');
    expect(M.problemaContacto(contactos, unContacto('C0003', 'proveedor', 'Ana Pérez'))).toBeNull();
    // Corregir a Ana sin cambiarle el nombre no choca consigo misma.
    expect(M.problemaContacto(contactos, unContacto('C0001', 'cliente', 'Ana Pérez'))).toBeNull();
    expect(M.problemaContacto(contactos, unContacto('C0003', 'cliente', '  '))).toBe('Ingresá el nombre.');
    expect(M.problemaContacto(contactos, unContacto('C0003', 'socio', 'Leo'))).toMatch(/cliente, proveedor o transporte/);
  });

  it('no deja dos productos con el mismo nombre ni un mínimo negativo', () => {
    const productos: M.Producto[] = [{ id: 'P001', producto: 'Almendras', unidad: 'kg', minimo: null }];

    expect(M.problemaProducto(productos, { id: 'P002', producto: 'almendras', unidad: 'kg', minimo: null })).toBe('Ya hay un producto que se llama Almendras.');
    expect(M.problemaProducto(productos, { id: 'P001', producto: 'Almendras', unidad: 'unid.', minimo: 3 })).toBeNull();
    expect(M.problemaProducto(productos, { id: 'P002', producto: 'Nueces', unidad: 'kg', minimo: -1 })).toBe('El mínimo no puede ser negativo.');
  });

  it('un contacto con pedidos, compras o fletes está en uso', () => {
    const movimientos = {
      pedidos: [{ id: 'PE0001', fecha: null, contactoId: 'C0001', depositoId: 'BB', nota: '' }],
      compras: [], fletes: [],
    };

    expect(M.contactoEnUso(movimientos, 'C0001')).toBe(true);
    expect(M.contactoEnUso(movimientos, 'C0002')).toBe(false);
  });
});

describe('corregirPedido', () => {
  // Pedido de Mar del Plata (MDP) entregado en parte: 10 de P001 a $100 (entregó 4) y 5 de P002 a $200 (sin entregar).
  // Leo cobra 10% de P001 (porcentaje editado a 12 en la entrega); Guada, 5% general.
  const base = datos({
    depositos: [{ id: 'BB', nombre: 'General', localidad: '' }, { id: 'MDP', nombre: 'Mar del Plata', localidad: '' }],
    vendedores: [
      { id: 'VEN01', nombre: 'Leo', activo: true, localidad: '' }, { id: 'VEN02', nombre: 'Guada', activo: true, localidad: '' },
    ],
    reglas: [{ vendedorId: 'VEN02', productoId: '', porcentaje: 5, desde: null }],
    precios: [{ productoId: 'P003', precio: 300, desde: null }],
    pedidos: [pedido('PE1', 'MDP')],
    pedidosItems: [item('PE1', 1, 'P001', 10), item('PE1', 2, 'P002', 5, 200)],
    pedidosVendedores: [{ pedidoId: 'PE1', vendedorId: 'VEN01' }],
    ventas: [venta('V1', 'PE1', 'MDP')],
    ventasItems: [ventaItem('V1', 1, 1, 'P001', 4)],
    ventasComisiones: [{ ventaId: 'V1', linea: 1, vendedorId: 'VEN01', porcentajeRegla: 10, porcentaje: 12, monto: 48 }],
  });
  const [anterior] = M.resumirPedidos(base);
  const lineas = (...ls: M.LineaCorregida[]) => ls;

  it('rehace las entregas con el depósito, el precio y los vendedores nuevos', () => {
    // Salía de Bahía Blanca a $90, y también comisiona Guada; P002 se cambia por 2 de P003, que tiene lista $300.
    const c = M.corregirPedido(base, anterior, { ...anterior.pedido, depositoId: 'BB' },
      lineas({ linea: 1, productoId: 'P001', cantidad: 10, precio: 90 }, { linea: 2, productoId: 'P003', cantidad: 2, precio: 300 }),
      ['VEN01', 'VEN02']);

    expect(c).toMatchObject({ pedido: { depositoId: 'BB' }, preciosNuevos: [] });
    expect(c.items).toStrictEqual([
      { pedidoId: 'PE1', linea: 1, productoId: 'P001', cantidad: 10, precioLista: 100, precio: 90 },
      { pedidoId: 'PE1', linea: 2, productoId: 'P003', cantidad: 2, precioLista: 300, precio: 300 },
    ]);
    // 4 × $90 = $360, desde Bahía Blanca; el costo no cambia. Leo conserva su 12% (360 × 12% = 43,20); Guada entra con
    // su regla, 5% (18).
    expect(c.entregas).toStrictEqual([{
      venta: venta('V1', 'PE1', 'BB'),
      items: [{ ...ventaItem('V1', 1, 1, 'P001', 4), precio: 90, importe: 360 }],
      comisiones: [
        { ventaId: 'V1', linea: 1, vendedorId: 'VEN01', porcentajeRegla: 10, porcentaje: 12, monto: 43.2 },
        { ventaId: 'V1', linea: 1, vendedorId: 'VEN02', porcentajeRegla: 5, porcentaje: 5, monto: 18 },
      ],
    }]);
  });

  it('numera las líneas nuevas después de la última y agrega su precio de lista si no tiene', () => {
    const c = M.corregirPedido(base, anterior, anterior.pedido,
      lineas({ linea: 1, productoId: 'P001', cantidad: 4, precio: 100 }, { linea: null, productoId: 'P004', cantidad: 1, precio: 50 }), []);

    expect(c.items.map((x) => [x.linea, x.productoId, x.precioLista])).toStrictEqual([[1, 'P001', 100], [3, 'P004', null]]);
    expect(c.preciosNuevos).toStrictEqual([{ productoId: 'P004', precio: 50, desde: anterior.pedido.fecha }]);
    // Sin vendedores, la entrega queda sin comisiones; el depósito sigue igual.
    expect(c.entregas[0]).toMatchObject({ comisiones: [], venta: { depositoId: 'MDP' } });
  });

  it('no deja deshacer lo entregado', () => {
    const p1 = { linea: 1, productoId: 'P001', cantidad: 10, precio: 100 };

    expect(M.problemaCorreccionPedido(anterior, lineas(p1, { linea: null, productoId: 'P003', cantidad: 1, precio: 1 }))).toBeNull();
    expect(M.problemaCorreccionPedido(anterior, lineas({ linea: 2, productoId: 'P002', cantidad: 5, precio: 200 })))
      .toBe('No se puede quitar un producto que ya se entregó.');
    expect(M.problemaCorreccionPedido(anterior, lineas({ ...p1, productoId: 'P009' }))).toBe('No se puede cambiar un producto que ya se entregó.');
    expect(M.problemaCorreccionPedido(anterior, lineas({ ...p1, cantidad: 3 }))).toBe('La cantidad no puede ser menor que lo ya entregado.');
    expect(M.problemaCorreccionPedido(anterior, lineas({ ...p1, cantidad: 0 }))).toBe('Todas las cantidades tienen que ser mayores a 0.');
  });
});
