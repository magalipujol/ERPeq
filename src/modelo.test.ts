import { describe, expect, it } from 'vitest';
import { deSerie } from './google';
import * as M from './modelo';

const fecha = (a: number, m: number, d: number) => new Date(a, m - 1, d, 12);

const compra = (c: Partial<M.Compra>): M.Compra => ({
  fila: 2, fecha: fecha(2026, 10, 1), deposito: 'General', proveedor: 'Prov', id: 'P001', producto: 'Almendras',
  cantidad: 1, precio: null, importe: null, remito: '', nota: '', ...c,
});
const venta = (v: Partial<M.Venta>): M.Venta => ({
  fila: 2, fecha: fecha(2026, 10, 1), deposito: 'General', cliente: 'Ana', tipo: 'Minorista', localidad: '', provincia: '',
  id: 'P001', producto: 'Almendras', cantidad: 1, precio: null, importe: null, comision: 0, costo: null, ganancia: null,
  carga: '', nota: '', ...v,
});
const datos = (d: Partial<M.Datos>): M.Datos => ({ productos: [], compras: [], ventas: [], ajustes: [], tipos: [], ...d });
const producto = (id: string): M.Producto => ({ id, producto: id, unidad: 'kg', minimo: 0 });

describe('parsear', () => {
  const vacio: M.Fila[] = [];

  const parseado = M.parsear([
    [['P001', ' Almendras ', '', ''], ['', 'sin id'], ['P002', 'Miel', 'unid.', '5']],
    [[45658, 'General', 'Prov', 'P001', 'Almendras', 10, 1000, 10000, 'R-1', ''], ['', '', '', ''], [45659, 'Rosario', 'Prov', 'P002', 'Miel', '3', '', '', '', '']],
    [[45660, 'General', 'Ana', 'Minorista', 'Funes', 'Santa Fe', 'P001', 'Almendras', 2, 3000, 6000, '', 1000, 4000, 'Leo', 'nota']],
    [[45661, 'General', 'P001', 'Almendras', -1, 'rotura']],
    [['Minorista', 0], ['Revendedor', '10'], ['', 5]],
  ], deSerie);

  it('productos: limpia textos, unidad kg por defecto y saltea filas sin ID', () => {
    expect(parseado.productos).toStrictEqual([
      { id: 'P001', producto: 'Almendras', unidad: 'kg', minimo: 0 },
      { id: 'P002', producto: 'Miel', unidad: 'unid.', minimo: 5 },
    ]);
  });

  it('compras: guarda la fila real de la hoja y deja vacío lo que falta', () => {
    // La fila 3 quedó vacía y no se cuenta.
    expect(parseado.compras.map((c) => [c.fila, c.id, c.cantidad, c.precio, c.importe])).toStrictEqual([
      [2, 'P001', 10, 1000, 10000],
      [4, 'P002', 3, null, null],
    ]);
    expect(parseado.compras[0].fecha).toStrictEqual(new Date(2025, 0, 1));
  });

  it('ventas, ajustes y tipos de cliente', () => {
    expect(parseado.ventas[0]).toMatchObject({ fila: 2, cliente: 'Ana', cantidad: 2, comision: 0, costo: 1000, ganancia: 4000, nota: 'nota' });
    expect(parseado.ajustes[0]).toMatchObject({ id: 'P001', cantidad: -1, motivo: 'rotura' });
    expect(parseado.tipos).toStrictEqual([{ tipo: 'Minorista', comision: 0 }, { tipo: 'Revendedor', comision: 10 }]);
  });

  it('deja la fecha vacía si la celda no es una fecha', () => {
    const r = M.parsear([vacio, [['texto', 'General', '', 'P001', '', 1]], vacio, vacio, vacio], deSerie);

    expect(r.compras[0].fecha).toBeNull();
  });
});

describe('costosPromedio', () => {
  it('pondera por cantidad y saltea compras sin precio o sin cantidad', () => {
    const costos = M.costosPromedio([
      compra({ cantidad: 10, precio: 2000 }),
      compra({ cantidad: 30, precio: 1000 }),
      compra({ cantidad: 50, precio: null }),
      compra({ cantidad: 0, precio: 9999 }),
      compra({ id: 'P002', cantidad: 3, precio: 100 }),
    ]);

    expect(costos).toStrictEqual(new Map([['P001', 1250], ['P002', 100]]));
  });

  it('redondea a 2 decimales', () => {
    expect(M.costosPromedio([compra({ cantidad: 3, precio: 1 }), compra({ cantidad: 0.5, precio: 2 })]).get('P001')).toBe(1.14);
  });
});

describe('stockPorProducto', () => {
  it('suma compras, resta ventas y aplica ajustes por depósito', () => {
    const stock = M.stockPorProducto(datos({
      productos: [producto('P001'), producto('P002')],
      compras: [compra({ cantidad: 10 }), compra({ cantidad: 5, deposito: 'Rosario' })],
      ventas: [venta({ cantidad: 4 })],
      ajustes: [{ fecha: null, deposito: 'Rosario', id: 'P001', producto: '', cantidad: -1.5, motivo: '' }],
    }), ['General', 'Rosario']);

    expect(stock.get('P001')).toStrictEqual({ General: 6, Rosario: 3.5 });
    expect(stock.get('P002')).toStrictEqual({ General: 0, Rosario: 0 });
  });

  it('ignora depósitos y productos desconocidos', () => {
    const stock = M.stockPorProducto(datos({
      productos: [producto('P001')],
      compras: [compra({ deposito: 'Otro', cantidad: 9 }), compra({ id: 'P999', cantidad: 9 })],
    }), ['General']);

    expect(stock).toStrictEqual(new Map([['P001', { General: 0 }]]));
  });

  it('redondea a 3 decimales para evitar errores de coma flotante', () => {
    const stock = M.stockPorProducto(datos({
      productos: [producto('P001')],
      compras: [compra({ cantidad: 0.1 }), compra({ cantidad: 0.2 })],
    }), ['General']);

    expect(stock.get('P001')?.General).toBe(0.3);
  });
});

describe('lineaVenta', () => {
  it('calcula importe, comisión y ganancia', () => {
    expect(M.lineaVenta({ cantidad: 2, precio: 3000, comisionPct: 10, costo: 1500 }))
      .toStrictEqual({ importe: 6000, comision: 600, ganancia: 2400 });
  });

  it('sin costo conocido no calcula ganancia', () => {
    expect(M.lineaVenta({ cantidad: 1, precio: 100, comisionPct: 0, costo: null }).ganancia).toBeNull();
    expect(M.lineaVenta({ cantidad: 1, precio: 100, comisionPct: 0, costo: undefined }).ganancia).toBeNull();
  });

  it('toma una comisión inválida como 0', () => {
    expect(M.lineaVenta({ cantidad: 1, precio: 100, comisionPct: NaN, costo: 50 }))
      .toStrictEqual({ importe: 100, comision: 0, ganancia: 50 });
  });
});

describe('ventasPorMes', () => {
  it('agrupa por mes, ordena y saltea ventas sin fecha', () => {
    expect(M.ventasPorMes([
      venta({ fecha: fecha(2026, 10, 5), importe: 100, ganancia: 40, comision: 5 }),
      venta({ fecha: fecha(2026, 9, 1), importe: 50, ganancia: null }),
      venta({ fecha: fecha(2026, 10, 20), importe: 200, ganancia: 60 }),
      venta({ fecha: null, importe: 999 }),
    ])).toStrictEqual([
      { mes: '2026-09', importe: 50, ganancia: 0, comision: 0, lineas: 1 },
      { mes: '2026-10', importe: 300, ganancia: 100, comision: 5, lineas: 2 },
    ]);
  });
});

describe('siguienteId', () => {
  it('sigue al mayor ID existente', () => {
    expect(M.siguienteId([producto('P002'), producto('P010'), producto('P003')])).toBe('P011');
  });

  it('arranca en P001 sin productos', () => {
    expect(M.siguienteId([])).toBe('P001');
  });
});

describe('filas', () => {
  it('compra: calcula el importe y deja vacío el precio desconocido', () => {
    const base = { fecha: fecha(2026, 10, 1), deposito: 'General', proveedor: 'Prov', id: 'P001', producto: 'Almendras', remito: '', nota: '' };

    expect(M.filas.compra({ ...base, cantidad: 3, precio: 1.1 })[7]).toBe(3.3);
    expect(M.filas.compra({ ...base, cantidad: 3, precio: null }).slice(6, 8)).toStrictEqual(['', '']);
  });

  it('producto: mínimo vacío si no se indicó', () => {
    expect(M.filas.producto({ id: 'P004', producto: 'Pasas', unidad: 'kg', minimo: null })).toStrictEqual(['P004', 'Pasas', 'kg', '']);
  });
});
