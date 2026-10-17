import { describe, expect, it } from 'vitest';
import type { Lugar, MarcasMapa } from '../dominio/mapa';
import type * as M from '../dominio/modelo';
import * as U from './ubicar';

const lugar = (localidad: string, provincia = ''): Lugar => ({ localidad, provincia });

describe('ubicar', () => {
  it('encuentra localidades sin importar tildes, mayúsculas ni espacios', () => {
    const rosario = U.ubicar(lugar('Rosario'));

    expect(rosario).not.toBeNull();
    expect(U.ubicar(lugar('  ROSARIO '))).toStrictEqual(rosario);
    expect(U.ubicar(lugar('Bahia Blanca'))).toStrictEqual(U.ubicar(lugar('Bahía Blanca')));
  });

  it('usa la provincia para elegir entre localidades con el mismo nombre', () => {
    const jujuy = U.ubicar(lugar('San Pedro', 'Jujuy'));
    const misiones = U.ubicar(lugar('San Pedro', 'Misiones'));

    expect(jujuy).not.toStrictEqual(misiones);
    // Jujuy está al norte (y más chica) y Misiones al este (x más grande).
    expect(jujuy?.y ?? 0).toBeLessThan(misiones?.y ?? 0);
    expect(misiones?.x ?? 0).toBeGreaterThan(jujuy?.x ?? 0);
  });

  it('acepta la provincia dentro de la localidad, como en los depósitos', () => {
    expect(U.ubicar(lugar('San Pedro, Misiones'))).toStrictEqual(U.ubicar(lugar('San Pedro', 'Misiones')));
  });

  it('reconoce los nombres habituales de la Ciudad de Buenos Aires', () => {
    const caba = U.ubicar(lugar('Ciudad Autónoma de Buenos Aires'));

    expect(caba).not.toBeNull();
    expect(U.ubicar(lugar('CABA'))).toStrictEqual(caba);
    expect(U.ubicar(lugar('Capital Federal'))).toStrictEqual(caba);
  });

  it('devuelve null si la localidad no existe', () => {
    expect(U.ubicar(lugar('Ciudad Gótica'))).toBeNull();
  });
});

describe('armarMapa', () => {
  const PUNTOS: Record<string, { x: number; y: number }> = {
    Rosario: { x: 100, y: 100 }, Funes: { x: 97, y: 100 }, 'Bahía Blanca': { x: 80, y: 200 },
  };
  const ubicador = (l: Lugar) => PUNTOS[l.localidad] ?? null;
  const deposito = (id: string, localidad: string): M.Deposito => ({ id, nombre: id, localidad });
  const resumen = (id: string) => ({ pedido: { id } }) as M.ResumenPedido;
  const flete = (id: string) => ({ id }) as M.Flete;

  const marcas: MarcasMapa = {
    depositos: [{ deposito: deposito('ROS', 'Rosario'), lugar: lugar('Rosario') }, { deposito: deposito('BB', 'Bahía Blanca'), lugar: lugar('Bahía Blanca') }],
    pedidos: [
      { resumen: resumen('PE1'), lugar: lugar('Funes') },
      { resumen: resumen('PE2'), lugar: lugar('Bahía Blanca') },
      { resumen: resumen('PE3'), lugar: lugar('Ciudad Gótica') },
      { resumen: resumen('PE4'), lugar: null },
    ],
    fletes: [
      { flete: flete('F1'), estado: 'camino', origen: lugar('Bahía Blanca'), destinos: [lugar('Rosario')] },
      { flete: flete('F2'), estado: 'preparacion', origen: lugar('Bahía Blanca'), destinos: [lugar('Funes')] },
      { flete: flete('F3'), estado: 'preparacion', origen: null, destinos: [lugar('Rosario')] },
      { flete: flete('F4'), estado: 'preparacion', origen: lugar('Rosario'), destinos: [lugar('Funes')] },
    ],
  };
  const m = U.armarMapa(marcas, 5, ubicador);

  it('junta los lugares cercanos en un sitio, ubicado en el depósito', () => {
    expect(m.sitios.map((s) => ({ nombre: s.nombre, x: s.x, deps: s.depositos.map((d) => d.id), peds: s.pedidos.map((r) => r.pedido.id) })))
      .toStrictEqual([
        // Funes está a 3 unidades de Rosario: queda en el mismo sitio.
        { nombre: 'Rosario · Funes', x: 100, deps: ['ROS'], peds: ['PE1'] },
        { nombre: 'Bahía Blanca', x: 80, deps: ['BB'], peds: ['PE2'] },
      ]);
  });

  it('agrupa los fletes con el mismo origen y destino en un tramo', () => {
    expect(m.tramos.map((t) => [t.desde.nombre, t.hasta.nombre, t.fletes.map((f) => f.flete.id)])).toStrictEqual([
      ['Bahía Blanca', 'Rosario · Funes', ['F1', 'F2']],
    ]);
  });

  it('avisa lo que no pudo ubicar', () => {
    // F3 sale de un proveedor; F4 va de Rosario a Funes, que están en el mismo sitio.
    expect(m.sinUbicar.map((x) => (x.tipo === 'deposito' ? x.deposito.id : x.tipo === 'pedido' ? x.resumen.pedido.id : x.flete.id)))
      .toStrictEqual(['PE3', 'PE4', 'F3', 'F4']);
  });
});

describe('curva', () => {
  it('pasa por el costado del segmento y su punto medio queda sobre la curva', () => {
    const c = U.curva({ x: 0, y: 0 }, { x: 100, y: 0 });

    expect(c.d).toBe('M0 0Q50 20 100 0');
    expect(c.medio).toStrictEqual({ x: 50, y: 10 });
  });
});
