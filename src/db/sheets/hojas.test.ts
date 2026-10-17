import { describe, expect, it } from 'vitest';
import type { Fila } from './celdas';
import * as H from './hojas';

describe('parsear', () => {
  const crudo = (h: Partial<Record<H.ClaveHoja, Fila[]>>) => H.CLAVES.map((k) => h[k] ?? []);

  const d = H.parsear(crudo({
    productos: [['P001', ' Almendras ', '', ''], ['', 'sin id'], ['P002', 'Miel', 'unid.', '5']],
    compras: [[45658, 'BB', 'Prov', 'C0001', 'P001', 'Almendras', 10, 1000, 10000, 'R-1', 'PE0001', ''], ['', '', '', '', ''],
      [45659, 'ROS', 'Prov', '', 'P002', 'Miel', '3', '', '', '', '', '']],
    vendedores: [['VEN01', 'Guada/Hernán', ''], ['VEN02', 'Leo', 'no']],
    pedidosItems: [['PE0001', 1, 'P001', 'Almendras', 2, '', 3000]],
    ventasComisiones: [['V0001', 1, 'VEN01', 'Guada/Hernán', 3, 5, 300]],
    pedidosEstados: [['PE0001', 46000.5, 'Cerrado']],
  }));

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
    const r = H.parsear(crudo({ compras: [['texto', 'BB', '', '', 'P001', '', 1]] }));

    expect(r.compras[0].fecha).toBeNull();
  });
});

describe('rango', () => {
  it('cubre las columnas de la hoja desde la fila 2', () => {
    expect(H.rango('ventasItems')).toBe("'Ventas ítems'!A2:I");
    expect(H.rango('tipos')).toBe("'Tipos de cliente'!A2:A");
  });
});

describe('filas', () => {
  it('compra: calcula el importe y deja vacío el precio desconocido', () => {
    const base = { fecha: new Date(2026, 9, 1, 12), depositoId: 'BB', proveedor: 'Prov', contactoId: '', productoId: 'P001', producto: 'Almendras', remito: '', pedidoId: '', nota: '' };

    expect(H.filas.compra({ ...base, cantidad: 3, precio: 1.1 })[8]).toBe(3.3);
    expect(H.filas.compra({ ...base, cantidad: 3, precio: null }).slice(7, 9)).toStrictEqual(['', '']);
  });

  it('unir junta las filas por hoja', () => {
    expect(H.unir({ ventas: [['a']] }, { ventas: [['b']], ajustes: [['c']] })).toStrictEqual({ ventas: [['a'], ['b']], ajustes: [['c']] });
  });
});
