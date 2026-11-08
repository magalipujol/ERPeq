import { describe, expect, it } from 'vitest';
import { HERRAMIENTAS } from './asistente';
import type * as M from './modelo';

const hoy = new Date(2026, 10, 8);
const contacto = (id: string, nombre: string): M.Contacto => ({
  id, rol: 'cliente', nombre, tipo: '', telefono: '', direccion: '', email: '', localidad: '', provincia: '', observaciones: '',
});

// Ana pide 10 kg de almendras (a $1000) y se le entregan 4; paga $1500 de los $4000 entregados.
// En el depósito entraron 30 kg por compra: quedan 26.
function datos(): M.Datos {
  return {
    depositos: [{ id: 'BB', nombre: 'General', localidad: '' }],
    productos: [
      { id: 'P1', producto: 'Almendras', unidad: 'kg', minimo: 50 },
      { id: 'P2', producto: 'Azúcar mascabo', unidad: 'kg', minimo: null },
    ],
    contactos: [contacto('C1', 'Ana Pérez'), contacto('C2', 'Beto')],
    tipos: [], vendedores: [], reglas: [], socios: [], rendiciones: [], recetas: [], recetasItems: [], envios: [], ventasEnvios: [],
    precios: [{ productoId: 'P1', precio: 1000, desde: new Date(2026, 0, 1) }],
    costos: [{ productoId: 'P1', costo: 600, desde: new Date(2026, 0, 1) }],
    compras: [{
      fila: 2, fecha: new Date(2026, 9, 1), depositoId: 'BB', contactoId: 'C2', productoId: 'P1',
      cantidad: 30, precio: 600, importe: 18000, remito: '', nota: '',
    }],
    pedidos: [{ id: 'PE1', fecha: new Date(2026, 9, 10), contactoId: 'C1', depositoId: 'BB', nota: '' }],
    pedidosItems: [{ pedidoId: 'PE1', linea: 1, productoId: 'P1', cantidad: 10, precioLista: 1000, precio: 1000 }],
    pedidosEstados: [], pedidosVendedores: [],
    ventas: [{ id: 'VE1', fecha: new Date(2026, 9, 12), pedidoId: 'PE1', depositoId: 'BB', nota: '' }],
    ventasItems: [{ ventaId: 'VE1', linea: 1, pedidoLinea: 1, productoId: 'P1', cantidad: 4, precio: 1000, importe: 4000 }],
    ventasComisiones: [], fletes: [], fletesItems: [], fletesEstados: [], ajustes: [],
    cobros: [{ fecha: new Date(2026, 9, 13), ventaId: 'VE1', importe: 1500, medio: 'efectivo', socioId: '', nota: '' }],
  };
}

const usar = (nombre: string, args: Record<string, unknown> = {}) => {
  const h = HERRAMIENTAS.find((x) => x.name === nombre);
  if (!h) throw new Error(nombre);
  return h.ejecutar(datos(), args, hoy);
};

describe('herramientas del asistente', () => {
  it('stock por nombre, sin tildes ni mayúsculas, con depósitos por nombre', () => {
    expect(usar('consultar_stock', { producto: 'ALMEN' })).toStrictEqual([{
      producto: 'Almendras', unidad: 'kg', total: 26, porDeposito: { General: 26 },
      enCamino: 0, comprometido: 6, minimo: 50, bajoMinimo: true,
    }]);
    expect(usar('consultar_stock', { producto: 'azucar' })).toHaveLength(1);
    expect(usar('consultar_stock')).toHaveLength(2);
  });

  it('pedidos abiertos con lo pendiente y sin IDs', () => {
    expect(usar('pedidos_abiertos', { cliente: 'ana' })).toStrictEqual([{
      cliente: 'Ana Pérez', fecha: '2026-10-10', estado: 'Parcial', deposito: 'General', importe: 10000,
      pendiente: [{ producto: 'Almendras', cantidad: 6 }],
    }]);
    expect(usar('pedidos_abiertos', { cliente: 'beto' })).toStrictEqual([]);
  });

  it('ventas a cobrar con su total', () => {
    expect(usar('ventas_a_cobrar')).toStrictEqual({
      total: 2500,
      ventas: [{ cliente: 'Ana Pérez', fecha: '2026-10-12', importe: 4000, cobrado: 1500, saldo: 2500 }],
    });
  });

  it('ventas por mes y más vendidos: ganancia = 4000 − 4 × 600', () => {
    expect(usar('ventas_por_mes')).toStrictEqual([{ mes: '2026-10', importe: 4000, comision: 0, ganancia: 1600 }]);
    expect(usar('productos_mas_vendidos', { periodo: '3' })).toStrictEqual([{
      producto: 'Almendras', unidad: 'kg', cantidad: 4, importe: 4000, ganancia: 1600, margen: '40 %',
    }]);
  });

  it('precio y costo vigentes', () => {
    expect(usar('precios', { producto: 'almendras' })).toStrictEqual([{ producto: 'Almendras', unidad: 'kg', precio: 1000, costo: 600 }]);
  });

  it('recorta las listas largas', () => {
    const d = datos();
    d.productos = Array.from({ length: 25 }, (_, i) => ({ id: `P${i}`, producto: `Prod ${i}`, unidad: 'kg', minimo: null }));
    const h = HERRAMIENTAS.find((x) => x.name === 'precios');

    expect(h?.ejecutar(d, {}, hoy)).toMatchObject({ mostradas: 20, total: 25 });
  });
});
