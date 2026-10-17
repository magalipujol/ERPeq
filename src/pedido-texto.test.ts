import { describe, expect, it } from 'vitest';
import { emparejar, emparejarPedido, instrucciones, leerRespuesta, MAX_NOMBRES, palabras, similitud, valorACargar } from './pedido-texto';

const PRODUCTOS = ['Almendras', 'Harina de almendras', 'Maní pelado', 'Maní con cáscara', 'Avena', 'Miel', 'Nueces mariposa'];
const CLIENTES = ['Dietética La Esquina', 'Ana', 'Almacén Natural'];

describe('palabras de un nombre', () => {
  it('saca acentos, signos, palabras vacías y plurales', () => {
    expect(palabras('  Harina de ALMENDRAS!! ')).toStrictEqual(['harina', 'almendra']);
    expect(palabras('25 kg de maní')).toStrictEqual(['25', 'mani']);
    expect(palabras('Dietética')).toStrictEqual(['dietetica']);
  });
});

describe('similitud entre nombres', () => {
  it('vale 1 con el mismo nombre escrito distinto', () => {
    expect(similitud('harina de almendra', 'Harina de almendras')).toBe(1);
    expect(similitud('MANI PELADO', 'Maní pelado')).toBe(1);
  });

  it('tolera errores de tipeo', () => {
    expect(similitud('almendars', 'Almendras')).toBeGreaterThan(0.6);
  });

  it('da poco para nombres distintos', () => {
    expect(similitud('miel', 'Avena')).toBeLessThan(0.3);
    expect(similitud('', 'Avena')).toBe(0);
  });
});

describe('emparejar con una lista', () => {
  it('exacta', () => {
    expect(emparejar('harina de almendra', PRODUCTOS)).toStrictEqual({
      texto: 'harina de almendra', valor: 'Harina de almendras', tipo: 'exacta', opciones: [],
    });
  });

  it('aproximada cuando se parece a uno solo', () => {
    expect(emparejar('nueces', PRODUCTOS)).toMatchObject({ valor: 'Nueces mariposa', tipo: 'aproximada' });
    expect(emparejar('dietetica la esquina de rosario', CLIENTES)).toMatchObject({ valor: 'Dietética La Esquina', tipo: 'aproximada' });
  });

  it('dudosa cuando se parece a varios por igual', () => {
    expect(emparejar('maní', PRODUCTOS)).toStrictEqual({
      texto: 'maní', valor: null, tipo: 'dudosa', opciones: ['Maní con cáscara', 'Maní pelado'],
    });
  });

  it('ninguna cuando no se parece a nada', () => {
    expect(emparejar('chocolate', PRODUCTOS)).toStrictEqual({ texto: 'chocolate', valor: null, tipo: 'ninguna', opciones: [] });
    expect(emparejar('  ', PRODUCTOS)).toMatchObject({ texto: '', tipo: 'ninguna' });
    expect(emparejar('Ana', [])).toMatchObject({ tipo: 'ninguna' });
  });
});

describe('leer la respuesta de la IA', () => {
  it('lee el JSON de la IA y descarta lo que no sirve', () => {
    const r = JSON.stringify({
      cliente: ' Ana ', localidad: 'Funes', provincia: 'Santa Fe',
      productos: [
        { producto: 'Almendras', cantidad: 25 },
        { producto: 'Maní', cantidad: '10,5' },
        { producto: 'Miel', cantidad: 0 },
        { producto: '', cantidad: 3 },
        'basura',
      ],
    });

    expect(leerRespuesta(r)).toStrictEqual({
      cliente: 'Ana', localidad: 'Funes', provincia: 'Santa Fe',
      productos: [
        { producto: 'Almendras', cantidad: 25 },
        { producto: 'Maní', cantidad: 10.5 },
        { producto: 'Miel', cantidad: null },
      ],
    });
  });

  it('null si no es el JSON esperado', () => {
    expect(leerRespuesta('no es json')).toBeNull();
    expect(leerRespuesta('[]')).toBeNull();
    expect(leerRespuesta('{"cliente":"Ana"}')).toBeNull();
  });

  it('campos faltantes quedan vacíos', () => {
    expect(leerRespuesta('{"productos":[]}')).toStrictEqual({ cliente: '', localidad: '', provincia: '', productos: [] });
  });
});

describe('emparejar un pedido', () => {
  it('empareja cliente, localidad y productos con los datos reales', () => {
    const p = emparejarPedido(
      {
        cliente: 'dietetica la esquina', localidad: 'rosario', provincia: 'Santa Fe',
        productos: [{ producto: 'harina de almendras', cantidad: 25 }, { producto: 'maní', cantidad: 10 }],
      },
      { productos: PRODUCTOS, clientes: CLIENTES, localidades: ['Rosario', 'Funes'] },
    );

    expect(p.cliente).toMatchObject({ valor: 'Dietética La Esquina', tipo: 'exacta' });
    expect(p.localidad).toMatchObject({ valor: 'Rosario', tipo: 'exacta' });
    expect(p.provincia).toBe('Santa Fe');
    expect(p.items.map((i) => [valorACargar(i.producto), i.producto.tipo, i.cantidad])).toStrictEqual([
      ['Harina de almendras', 'exacta', 25],
      ['maní', 'dudosa', 10],
    ]);
  });
});

describe('instrucciones para la IA', () => {
  it('incluye las listas, recortadas', () => {
    const muchos = Array.from({ length: MAX_NOMBRES + 5 }, (_, i) => `Producto ${String(i)}`);
    const t = instrucciones({ productos: muchos, clientes: [] });

    expect(t).toContain('- Producto 0');
    expect(t).not.toContain(`- Producto ${String(MAX_NOMBRES)}`);
    expect(t).toContain('Clientes:\n(ninguno)');
  });
});
