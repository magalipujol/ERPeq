import { describe, expect, it } from 'vitest';
import type { Fila } from './celdas';
import * as H from './hojas';

// Encabezado esperado de la hoja de un rango.
const encabezado = (rango: string) => [...H.encabezados(H.CLAVES.find((k) => rango.startsWith(`'${H.nombreHoja(k)}'`)) ?? 'tipos')];

describe('parsear', () => {
  const crudo = (h: Partial<Record<H.ClaveHoja, Fila[]>>) => H.CLAVES.map((k) => h[k] ?? []);

  const d = H.parsear(crudo({
    productos: [['P001', ' Almendras ', '', ''], ['', 'sin id'], ['P002', 'Miel', 'unid.', '5']],
    compras: [[45658, 'BB', 'C0001', 'P001', 10, 1000, 10000, 'R-1', 'PE0001', ''], ['', '', '', '', ''],
      [45659, 'ROS', '', 'P002', '3', '', '', '', '', '']],
    vendedores: [['VEN01', 'Guada/Hernán', ''], ['VEN02', 'Leo', 'no']],
    pedidosItems: [['PE0001', 1, 'P001', 2, '', 3000]],
    ventasComisiones: [['V0001', 1, 'VEN01', 3, 5, 300]],
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
    const r = H.parsear(crudo({ compras: [['texto', 'BB', '', 'P001', 1]] }));

    expect(r.compras[0].fecha).toBeNull();
  });
});

describe('socios, cobros y rendiciones', () => {
  const crudo = (h: Partial<Record<H.ClaveHoja, Fila[]>>) => H.CLAVES.map((k) => h[k] ?? []);

  it('junta las filas de un socio y reconoce al dueño', () => {
    const d = H.parsear(crudo({
      socios: [['SOC01', 'Sampatti', 'VEN02', 'Dueño'], ['SOC02', 'Guada/Hernán', 'VEN01', 'socio'], ['SOC02', '', 'VEN03', ''], ['', 'x']],
    }));

    expect(d.socios).toStrictEqual([
      { id: 'SOC01', nombre: 'Sampatti', vendedores: ['VEN02'], duenio: true },
      { id: 'SOC02', nombre: 'Guada/Hernán', vendedores: ['VEN01', 'VEN03'], duenio: false },
    ]);
  });

  it('lee cobros y rendiciones con el medio en minúsculas', () => {
    const d = H.parsear(crudo({
      cobros: [[46311, 'V0001', 8000, 'Efectivo', 'SOC02', ''], [46311, '', 5]],
      rendiciones: [[46312, 'SOC02', 'SOC01', 5000, 'efectivo', 'Rendición semanal']],
    }));

    expect(d.cobros).toHaveLength(1);
    expect(d.cobros[0]).toMatchObject({ ventaId: 'V0001', importe: 8000, medio: 'efectivo', socioId: 'SOC02' });
    expect(d.rendiciones[0]).toMatchObject({ deId: 'SOC02', aId: 'SOC01', importe: 5000, nota: 'Rendición semanal' });
  });

  it('lee las reglas de envío (salteando las que no tienen costo) y los envíos de las ventas', () => {
    const d = H.parsear(crudo({
      envios: [[150000, 5000, 46023], [200000, '', 46327], [200000, 0, 46327]],
      ventasEnvios: [['V0001', 'VEN02', 5000, 5000], ['V0002', '', '', 3000]],
    }));

    expect(d.envios).toStrictEqual([
      { minimo: 150000, costo: 5000, desde: new Date(2026, 0, 1) }, { minimo: 200000, costo: 0, desde: new Date(2026, 10, 1) },
    ]);
    expect(d.ventasEnvios).toStrictEqual([
      { ventaId: 'V0001', vendedorId: 'VEN02', costoRegla: 5000, costo: 5000 },
      { ventaId: 'V0002', vendedorId: '', costoRegla: null, costo: 3000 },
    ]);
  });

  it('agrupa las hojas opcionales que faltan por área', () => {
    const titulos = H.CLAVES.map(H.nombreHoja).filter((t) => !['Cobros', 'Recetas', 'Recetas ítems'].includes(t));

    expect(H.hojasFaltantes(titulos).map((k) => [k, H.OPCIONALES[k]])).toStrictEqual([
      ['cobros', 'caja'], ['recetas', 'recetas'], ['recetasItems', 'recetas'],
    ]);
  });

  it('las hojas opcionales que faltan no se piden y se leen vacías', async () => {
    expect.hasAssertions();

    const titulos = H.CLAVES.map(H.nombreHoja).filter((t) => t !== 'Cobros' && t !== 'Rendiciones');
    const faltantes = H.hojasFaltantes(titulos);
    const pedidos: string[] = [];
    // Devuelve el encabezado y una fila con el nombre de la hoja de cada rango, para ver que cada hoja recibe la suya.
    const d = await H.leerHojas(async (rangos) => {
      pedidos.push(...rangos);
      return Promise.resolve(rangos.map((r) => [encabezado(r), [/^'(.+)'!/.exec(r)?.[1] ?? '', 'x', 'x', 'x']]));
    }, faltantes);

    expect(faltantes).toStrictEqual(['cobros', 'rendiciones']);
    expect(pedidos.filter((r) => r.includes('Cobros') || r.includes('Rendiciones'))).toStrictEqual([]);
    expect([d.cobros, d.rendiciones]).toStrictEqual([[], []]);
    expect(d.socios.map((s) => s.id)).toStrictEqual(['Socios']);
    expect(d.ajustes.map((a) => a.depositoId)).toStrictEqual(['x']);
  });
});

describe('rango', () => {
  it('cubre las columnas de la hoja desde el encabezado', () => {
    expect(H.rango('ventasItems')).toBe("'Ventas ítems'!A1:H");
    expect(H.rango('tipos')).toBe("'Tipos de cliente'!A1:A");
  });
});

describe('encabezados', () => {
  const leer = (pedidos: Fila) => async (rangos: string[]) =>
    Promise.resolve(rangos.map((r) => (r.startsWith("'Pedidos'") ? [pedidos, ['PE0001', 46000, 'C0001', 'BB', '']] : [encabezado(r)])));

  it('acepta mayúsculas, espacios y columnas de más a la derecha', async () => {
    expect.hasAssertions();

    const d = await H.leerHojas(leer(['ID', ' fecha', 'contacto_id', 'deposito_id', 'nota', 'otra']));

    expect(d.pedidos).toMatchObject([{ id: 'PE0001', contactoId: 'C0001', depositoId: 'BB' }]);
  });

  it('una hoja con otras columnas no se lee', async () => {
    expect.hasAssertions();

    const otras = ['id', 'fecha', 'contacto_id', 'cliente', 'deposito_id', 'nota'];

    await expect(H.leerHojas(leer(otras))).rejects.toThrow(H.FormatoDistinto);
    await expect(H.leerHojas(leer(otras))).rejects.toThrow(/hoja "Pedidos".*En la planilla están: id, fecha, contacto_id, cliente/);
  });
});

describe('filas', () => {
  it('compra: calcula el importe y deja vacío el precio desconocido', () => {
    const base = { fecha: new Date(2026, 9, 1, 12), depositoId: 'BB', contactoId: '', productoId: 'P001', remito: '', pedidoId: '', nota: '' };

    expect(H.filas.compra({ ...base, cantidad: 3, precio: 1.1 })[6]).toBe(3.3);
    expect(H.filas.compra({ ...base, cantidad: 3, precio: null }).slice(5, 7)).toStrictEqual(['', '']);
  });

  it('unir junta las filas por hoja', () => {
    expect(H.unir({ ventas: [['a']] }, { ventas: [['b']], ajustes: [['c']] })).toStrictEqual({ ventas: [['a'], ['b']], ajustes: [['c']] });
  });
});
