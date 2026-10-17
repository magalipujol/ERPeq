import { describe, expect, it } from 'vitest';
import { aSerie, celda, deSerie, leida } from './celdas';

describe('celdas para appendCells', () => {
  it('textos, números y vacíos', () => {
    expect(celda('=SUMA(A1)')).toStrictEqual({ userEnteredValue: { stringValue: '=SUMA(A1)' } });
    expect(celda(3.5)).toStrictEqual({ userEnteredValue: { numberValue: 3.5 } });
    expect(celda('')).toStrictEqual({});
    expect(celda(null)).toStrictEqual({});
  });

  it('una fecha se guarda sin hora y un momento con hora', () => {
    const d = new Date(2026, 9, 16, 12, 0);

    expect(celda(d).userEnteredValue?.numberValue).toBe(46311);
    expect(celda({ momento: d }).userEnteredValue?.numberValue).toBe(46311.5);
    expect(celda({ momento: d }).userEnteredFormat?.numberFormat.type).toBe('DATE_TIME');
  });

  it('deSerie: número de serie de Sheets a fecha local', () => {
    expect(deSerie(45658)).toStrictEqual(new Date(2025, 0, 1));
  });

  it('aSerie es la inversa de deSerie', () => {
    const d = new Date(2026, 0, 2, 18, 30);

    expect(deSerie(aSerie(d))).toStrictEqual(d);
  });

  it('leida: lo que devuelve Sheets al leer un valor escrito', () => {
    const d = new Date(2026, 9, 16, 12, 0);

    expect([leida('x'), leida(2), leida(''), leida(null), leida(d), leida({ momento: d })]).toStrictEqual(['x', 2, '', '', 46311, 46311.5]);
  });
});
