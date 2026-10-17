import { describe, expect, it } from 'vitest';
import * as Mapa from './mapa';
import * as M from './modelo';

const contacto = (id: string, localidad: string, provincia: string): M.Contacto => ({
  id, rol: 'cliente', nombre: id, tipo: '', telefono: '', direccion: '', email: '', localidad, provincia, observaciones: '',
});
const flete = (id: string, origenId: string, destinoId: string): M.Flete => ({
  id, fecha: null, contactoId: 'T', origenId, destinoId, costo: null, guia: '', nota: '',
});

function datos(): M.Datos {
  return {
    depositos: [
      { id: 'BB', nombre: 'General', localidad: 'Bahía Blanca' },
      { id: 'ROS', nombre: 'Rosario', localidad: 'Rosario' },
      { id: 'X', nombre: 'Sin lugar', localidad: '' },
    ],
    productos: [{ id: 'P1', producto: 'Avena', unidad: 'kg', minimo: null }],
    contactos: [contacto('ANA', 'Funes', 'Santa Fe'), contacto('BETO', ' funes ', 'santa fe'), contacto('CARO', '', '')],
    tipos: [], vendedores: [], precios: [], reglas: [], compras: [],
    pedidos: [
      { id: 'PE1', fecha: null, contactoId: 'ANA', depositoId: 'ROS', nota: '' },
      { id: 'PE2', fecha: null, contactoId: 'BETO', depositoId: 'ROS', nota: '' },
      { id: 'PE3', fecha: null, contactoId: 'CARO', depositoId: 'ROS', nota: '' },
      { id: 'PE4', fecha: null, contactoId: 'ANA', depositoId: 'ROS', nota: '' },
    ],
    pedidosItems: ['PE1', 'PE2', 'PE3', 'PE4'].map((pedidoId) => ({
      pedidoId, linea: 1, productoId: 'P1', cantidad: 1, precioLista: null, precio: 100,
    })),
    pedidosEstados: [{ ref: 'PE4', fecha: null, estado: 'cancelado' }],
    pedidosVendedores: [], ventas: [], ventasItems: [], ventasComisiones: [],
    fletes: [flete('F1', 'BB', 'ROS'), flete('F2', 'ROS', ''), flete('F3', '', 'BB'), flete('F4', 'BB', 'ROS')],
    fletesItems: [],
    fletesEstados: [
      { ref: 'F1', fecha: null, estado: 'camino' },
      { ref: 'F4', fecha: null, estado: 'finalizado' },
    ],
    pedidosFletes: [
      { pedidoId: 'PE1', fleteId: 'F2', costoAsignado: null },
      { pedidoId: 'PE2', fleteId: 'F2', costoAsignado: null },
      { pedidoId: 'PE3', fleteId: 'F2', costoAsignado: null },
    ],
    ajustes: [], socios: [], cobros: [], rendiciones: [], recetas: [], recetasItems: [],
  };
}

describe('marcasDelMapa', () => {
  const d = datos();
  const m = Mapa.marcasDelMapa(d, M.resumirPedidos(d), M.estadosActuales(d.fletesEstados));

  it('ubica los depósitos por su localidad y deja afuera los que no la tienen', () => {
    expect(m.depositos.map((x) => [x.deposito.id, x.lugar])).toStrictEqual([
      ['BB', { localidad: 'Bahía Blanca', provincia: '' }],
      ['ROS', { localidad: 'Rosario', provincia: '' }],
    ]);
  });

  it('ubica cada pedido abierto en la localidad de su cliente', () => {
    // PE4 está cancelado. CARO no tiene localidad: su pedido queda sin lugar.
    expect(m.pedidos.map((x) => [x.resumen.pedido.id, x.lugar])).toStrictEqual([
      ['PE1', { localidad: 'Funes', provincia: 'Santa Fe' }],
      ['PE2', { localidad: 'funes', provincia: 'santa fe' }],
      ['PE3', null],
    ]);
  });

  it('une los fletes en curso de su origen a su destino', () => {
    // F4 ya terminó. F3 sale de un proveedor: no tiene origen en el mapa.
    expect(m.fletes.map((x) => [x.flete.id, x.estado, x.origen?.localidad ?? null, x.destinos.map((l) => l.localidad)])).toStrictEqual([
      ['F1', 'camino', 'Bahía Blanca', ['Rosario']],
      // Va a clientes: ANA y BETO están en la misma localidad (escrita distinto) y CARO no tiene.
      ['F2', 'preparacion', 'Rosario', ['Funes']],
      ['F3', 'preparacion', null, ['Bahía Blanca']],
    ]);
  });
});
