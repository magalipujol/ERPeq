import { describe, expect, it } from 'vitest';
import * as A from './analisis';
import type * as M from './modelo';

const fecha = (a: number, m: number, d: number) => new Date(a, m - 1, d, 12);
const HOY = fecha(2026, 10, 16);

// [producto, cantidad, precio, costo, comisión]
type Linea = [string, number, number, number | null, number?];
// Pedido entregado completo el mismo día en que se pidió.
interface PedidoPrueba { id: string; cliente: string; fecha: Date; lineas: Linea[]; cancelado?: boolean }

function armar(pedidos: PedidoPrueba[], extra: Partial<M.Datos> = {}): M.Datos {
  const d: M.Datos = {
    depositos: [], productos: [
      { id: 'P001', producto: 'Almendras', unidad: 'kg', minimo: 0 },
      { id: 'P002', producto: 'Avena', unidad: 'kg', minimo: 0 },
      { id: 'P003', producto: 'Miel', unidad: 'unid.', minimo: 0 },
    ],
    contactos: [], tipos: [], vendedores: [], precios: [], reglas: [], compras: [], pedidos: [],
    pedidosItems: [], pedidosEstados: [], pedidosVendedores: [], ventas: [], ventasItems: [], ventasComisiones: [],
    fletes: [], fletesItems: [], fletesEstados: [], pedidosFletes: [], ajustes: [], ...extra,
  };
  for (const p of pedidos) {
    d.pedidos.push({
      id: p.id, fecha: p.fecha, contactoId: `C-${p.cliente}`, cliente: p.cliente, tipo: '', localidad: '', provincia: '',
      depositoId: 'BB', nota: '',
    });
    if (p.cancelado === true) d.pedidosEstados.push({ ref: p.id, fecha: null, estado: 'cancelado' });
    const ventaId = `V-${p.id}`;
    d.ventas.push({ id: ventaId, fecha: p.fecha, pedidoId: p.id, depositoId: 'BB', nota: '' });
    p.lineas.forEach(([productoId, cantidad, precio, costo, comision], i) => {
      d.ventasItems.push({
        ventaId, linea: i + 1, pedidoLinea: i + 1, productoId, producto: productoId, cantidad, precio, importe: cantidad * precio, costo,
      });
      if (comision !== undefined) {
        d.ventasComisiones.push({ ventaId, linea: i + 1, vendedorId: 'VEN01', vendedor: 'Leo', porcentajeRegla: null, porcentaje: 0, monto: comision });
      }
    });
  }
  return d;
}

// Un pedido por fecha, todos del mismo cliente y con la misma línea.
const serie = (prefijo: string, cliente: string, fechas: Date[], linea: Linea): PedidoPrueba[] =>
  fechas.map((f, i) => ({ id: `${prefijo}${i}`, cliente, fecha: f, lineas: [linea] }));

describe('inicioPeriodo', () => {
  it('resta meses a hoy y empieza a las 0:00', () => {
    expect(A.inicioPeriodo('3', HOY)).toStrictEqual(new Date(2026, 6, 16));
    expect(A.inicioPeriodo('12', HOY)).toStrictEqual(new Date(2025, 9, 16));
    expect(A.inicioPeriodo('todo', HOY)).toBeNull();
  });
});

describe('analizarProductos', () => {
  const d = armar([
    { id: 'PE1', cliente: 'Ana', fecha: fecha(2026, 10, 5), lineas: [['P001', 4, 3000, 1500, 1200], ['P003', 2, 1000, null]] },
    { id: 'PE2', cliente: 'Bruno', fecha: fecha(2026, 9, 1), lineas: [['P001', 2, 3000, 1500], ['P002', 10, 800, 500, 240]] },
    { id: 'PE3', cliente: 'Bruno', fecha: fecha(2026, 1, 10), lineas: [['P002', 100, 800, 500]] },
  ]);

  it('suma importe, comisiones, costo y ganancia por producto en el período', () => {
    const ps = A.analizarProductos(d, A.inicioPeriodo('3', HOY));
    const almendras = ps.find((p) => p.productoId === 'P001');

    // 6 kg × $3.000 = $18.000; costo 6 × $1.500 = $9.000; comisión $1.200 → ganancia $7.800.
    expect(almendras).toMatchObject({ cantidad: 6, importe: 18000, comisiones: 1200, costo: 9000, ganancia: 7800, lineasSinCosto: 0 });
    expect(almendras?.margen).toBeCloseTo(7800 / 18000);
    // La venta de enero queda afuera de los últimos 3 meses.
    expect(ps.find((p) => p.productoId === 'P002')).toMatchObject({ cantidad: 10, importe: 8000, ganancia: 2760 });
  });

  it('las líneas sin costo suman importe pero no ganancia ni margen', () => {
    const miel = A.analizarProductos(d, null).find((p) => p.productoId === 'P003');

    expect(miel).toMatchObject({ importe: 2000, ganancia: 0, importeConCosto: 0, margen: null, lineasSinCosto: 1, unidad: 'unid.' });
  });

  it('el más vendido por cantidad se elige dentro de cada unidad', () => {
    const top = A.masVendidoPorUnidad(A.analizarProductos(d, null));

    expect(top.get('kg')?.producto).toBe('Avena');
    expect(top.get('unid.')?.producto).toBe('Miel');
  });
});

describe('fletesDelPeriodo', () => {
  it('separa lo asignado a pedidos del gasto de logística', () => {
    const flete = (id: string, f: Date, costo: number): M.Flete => ({
      id, fecha: f, transporte: 'T', contactoId: '', origenId: 'BB', destinoId: 'ROS', costo, guia: '', nota: '',
    });
    const d = armar([], {
      fletes: [flete('F1', fecha(2026, 10, 1), 5000), flete('F2', fecha(2025, 1, 1), 9999)],
      pedidosFletes: [{ pedidoId: 'PE1', fleteId: 'F1', costoAsignado: 3000 }, { pedidoId: 'PE9', fleteId: 'F2', costoAsignado: 9999 }],
    });

    expect(A.fletesDelPeriodo(d, A.inicioPeriodo('6', HOY))).toStrictEqual({ total: 5000, asignados: 3000, sinAsignar: 2000 });
  });
});

describe('analizarClientes', () => {
  const d = armar([
    { id: 'PE1', cliente: 'Ana', fecha: fecha(2026, 10, 5), lineas: [['P001', 4, 3000, 1500]] },
    { id: 'PE2', cliente: 'Bruno', fecha: fecha(2026, 9, 1), lineas: [['P002', 1, 800, 500]] },
    { id: 'PE3', cliente: 'Bruno', fecha: fecha(2026, 9, 20), lineas: [['P002', 1, 800, 500]] },
    { id: 'PE4', cliente: 'Carla', fecha: fecha(2025, 3, 1), lineas: [['P002', 1, 800, 500]] },
    { id: 'PE5', cliente: 'Ana', fecha: fecha(2026, 10, 10), lineas: [['P001', 1, 3000, 1500]], cancelado: true },
  ]);

  it('ordena por cantidad de pedidos y después por importe, sin los pedidos cancelados', () => {
    const cs = A.analizarClientes(d, A.inicioPeriodo('3', HOY));

    expect(cs.map((c) => [c.cliente, c.pedidos, c.importe])).toStrictEqual([['Bruno', 2, 1600], ['Ana', 1, 12000]]);
    expect(cs[1].ultimoPedido).toStrictEqual(fecha(2026, 10, 5));
  });

  it('con "todo" entran los clientes sin compras recientes', () => {
    expect(A.analizarClientes(d, null).map((c) => c.cliente)).toStrictEqual(['Bruno', 'Ana', 'Carla']);
  });
});

describe('clientesInactivos', () => {
  const d = armar([
    // Bruno compraba cada 30 días y su último pedido fue hace 189: inactivo.
    ...serie('PB', 'Bruno', [fecha(2026, 1, 10), fecha(2026, 2, 9), fecha(2026, 3, 11), fecha(2026, 4, 10)], ['P003', 2, 1000, 600]),
    // Carla compra cada mes y la última vez fue hace 15 días: activa.
    ...serie('PC', 'Carla', [fecha(2026, 8, 1), fecha(2026, 9, 1), fecha(2026, 10, 1)], ['P002', 1, 800, 500]),
    // Dani compró dos veces: no alcanza para saber su ritmo.
    ...serie('PD', 'Dani', [fecha(2025, 1, 1), fecha(2025, 2, 1)], ['P002', 1, 800, 500]),
    // Eva compraba cada semana; hace 25 días que no compra, menos que el mínimo de 30.
    ...serie('PE', 'Eva', [fecha(2026, 9, 7), fecha(2026, 9, 14), fecha(2026, 9, 21)], ['P002', 1, 800, 500]),
  ]);

  it('marca a quien no compra hace más del doble de su intervalo habitual (y más de 30 días)', () => {
    expect(A.clientesInactivos(d, HOY)).toStrictEqual([{
      clave: 'C-Bruno', cliente: 'Bruno', pedidos: 4, intervalo: 30, ultimoPedido: fecha(2026, 4, 10), diasSinComprar: 189,
      importeHistorico: 8000,
    }]);
  });

  it('un cliente frecuente pasa a inactivo recién después de 30 días', () => {
    expect(A.clientesInactivos(d, fecha(2026, 10, 22)).map((c) => c.cliente)).toStrictEqual(['Bruno', 'Eva']);
  });

  it('varios pedidos el mismo día cuentan como una compra', () => {
    const e = armar(serie('X', 'Fede', [fecha(2026, 1, 1), fecha(2026, 1, 1), fecha(2026, 2, 1)], ['P002', 1, 800, 500]));

    expect(A.clientesInactivos(e, HOY)).toStrictEqual([]);
  });
});
