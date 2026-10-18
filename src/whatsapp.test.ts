import { describe, expect, it } from 'vitest';
import type * as M from './dominio/modelo';
import { enlaceWhatsApp, mensajePedidos, pedidosParaMensaje } from './whatsapp';

const fecha = (a: number, m: number, d: number) => new Date(a, m - 1, d, 12);
const HOY = fecha(2026, 10, 16);

const linea = (l: Partial<M.LineaPedido>): M.LineaPedido => ({
  pedidoId: 'PE0001', linea: 1, productoId: 'P001', cantidad: 1, precioLista: null, precio: 100,
  entregado: 0, pendiente: 1, ...l,
});
const resumen = (id: string, estado: M.EstadoPedido, f: Date | null, lineas: M.LineaPedido[] = [], extra: Partial<M.Pedido> = {}): M.ResumenPedido => ({
  pedido: { id, fecha: f, contactoId: 'C0001', depositoId: 'ROS', nota: '', ...extra },
  estado, lineas, vendedores: [], importePedido: 0, importeEntregado: 0, comisiones: 0, costoMercaderia: 0,
  sinCosto: false, fletes: 0, ganancia: 0, ventas: [], envios: 0,
});
const de = (m: Partial<Record<string, string>>, otro?: string) => (id: string) => m[id] ?? otro ?? id;
const nombres = {
  deposito: de({ ROS: 'Rosario', BB: 'General' }),
  vendedor: de({ VEN01: 'Leo', VEN02: 'Guada/Hernán' }),
  producto: de({ P001: 'Almendras', P002: 'Avena', P003: 'Miel', X: 'Caja' }),
  contacto: de({ C0001: 'Ana', C0002: 'Bruno' }),
  socio: de({}),
  unidad: de({ P001: 'kg', P002: 'kg', P003: 'unid.' }, ''),
  lugar: de({ C0002: 'Funes, Santa Fe' }, ''),
};
const ids = (rs: M.ResumenPedido[]) => rs.map((r) => r.pedido.id);

describe('qué pedidos entran en el mensaje', () => {
  const pedidos = [
    resumen('PE1', 'pendiente', fecha(2026, 9, 1)),
    resumen('PE2', 'parcial', fecha(2026, 10, 12)),
    resumen('PE3', 'entregado', fecha(2026, 10, 16)),
    resumen('PE4', 'cancelado', fecha(2026, 10, 16)),
    resumen('PE5', 'pendiente', fecha(2026, 10, 10)),
    resumen('PE6', 'cerrado', fecha(2026, 10, 9)),
    resumen('PE7', 'pendiente', null),
  ];

  it('abiertos: pendientes y parciales de cualquier fecha, más recientes primero', () => {
    expect(ids(pedidosParaMensaje(pedidos, 'abiertos', HOY))).toStrictEqual(['PE2', 'PE5', 'PE1', 'PE7']);
  });

  it('hoy: los de la fecha de hoy, sin cancelados', () => {
    expect(ids(pedidosParaMensaje(pedidos, 'hoy', HOY))).toStrictEqual(['PE3']);
  });

  it('últimos 7 días: hoy y los 6 anteriores, sin cancelados', () => {
    expect(ids(pedidosParaMensaje(pedidos, 'semana', HOY))).toStrictEqual(['PE3', 'PE2', 'PE5']);
  });
});

describe('texto del mensaje', () => {
  it('arma un bloque por pedido con productos, unidades y lo que falta entregar', () => {
    const pedidos = [
      {
        ...resumen('PE0003', 'parcial', fecha(2026, 10, 12), [
          linea({ linea: 1, productoId: 'P002', cantidad: 10, entregado: 4, pendiente: 6 }),
          linea({ linea: 2, productoId: 'P003', cantidad: 2, entregado: 2, pendiente: 0 }),
        ], { contactoId: 'C0002', nota: 'Llamar antes' }),
        vendedores: ['VEN01', 'VEN02'],
      },
      resumen('PE0002', 'pendiente', fecha(2026, 10, 10), [linea({ cantidad: 1.5, pendiente: 1.5 })], { depositoId: 'BB' }),
    ];

    expect(mensajePedidos(pedidos, 'abiertos', HOY, nombres)).toBe([
      '*Pedidos abiertos* (16/10/26)',
      '2 pedidos',
      '',
      '*Bruno* · 12/10/26',
      'Funes, Santa Fe · desde Rosario',
      'Estado: Parcial',
      'Vendedores: Leo, Guada/Hernán',
      '• 10 kg Avena (entregado 4, faltan 6)',
      '• 2 unid. Miel (entregado)',
      '_Llamar antes_',
      '',
      '*Ana* · 10/10/26',
      'desde General',
      'Estado: Pendiente',
      '• 1,5 kg Almendras',
    ].join('\n'));
  });

  it('producto sin unidad', () => {
    const r = resumen('PE1', 'pendiente', HOY, [linea({ productoId: 'X', cantidad: 3 })]);

    expect(mensajePedidos([r], 'hoy', HOY, nombres)).toContain('\n• 3 Caja');
  });

  it('sin pedidos', () => {
    expect(mensajePedidos([], 'hoy', HOY, nombres)).toBe('*Pedidos de hoy* (16/10/26)\nNo hay pedidos.');
  });
});

describe('enlace a WhatsApp', () => {
  it('codifica el texto en la URL de wa.me', () => {
    expect(enlaceWhatsApp('*Hola* & chau\n• 1,5 kg')).toBe('https://wa.me/?text=*Hola*%20%26%20chau%0A%E2%80%A2%201%2C5%20kg');
  });
});
