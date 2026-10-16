import { describe, expect, it } from 'vitest';
import {
  aNumero, deISO, fmtMes, fmtMoney, fmtNum, mensajeDeError, numeroOCero, porFechaDesc, sumable, unicos,
} from './formato';
import { deSerie } from './google';

describe('números de los inputs', () => {
  it('aNumero: vacío o incompleto da NaN', () => {
    expect(aNumero(3)).toBe(3);
    expect(aNumero('1.5')).toBe(1.5);
    expect(aNumero('')).toBeNaN();
    expect(aNumero('-')).toBeNaN();
  });

  it('numeroOCero: lo inválido vale 0', () => {
    expect(numeroOCero('')).toBe(0);
    expect(numeroOCero('abc')).toBe(0);
    expect(numeroOCero(-2)).toBe(-2);
  });

  it('sumable: null y NaN suman 0', () => {
    expect([sumable(null), sumable(NaN), sumable(0), sumable(7)]).toStrictEqual([0, 0, 0, 7]);
  });
});

describe('formatos es-AR', () => {
  it('números y plata', () => {
    expect(fmtNum(1234.567)).toBe('1.234,57');
    expect(fmtNum(null)).toBe('–');
    expect(fmtMoney(36500)).toMatch(/^\$\s36\.500$/);
    expect(fmtMoney(undefined)).toBe('–');
  });

  it('meses con mayúscula', () => {
    expect(fmtMes('2026-10')).toBe('Octubre de 2026');
  });
});

describe('fechas', () => {
  it('deISO: mediodía local, para que el día no cambie con la zona horaria', () => {
    const d = deISO('2026-10-16');

    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toStrictEqual([2026, 9, 16, 12]);
  });

  it('deSerie: número de serie de Sheets a fecha local', () => {
    expect(deSerie(45658)).toStrictEqual(new Date(2025, 0, 1));
  });

  it('porFechaDesc: más nuevas primero, sin fecha al final', () => {
    const a = { fecha: new Date(2026, 0, 1) };
    const b = { fecha: new Date(2026, 5, 1) };
    const sin = { fecha: null };

    expect([a, sin, b].sort(porFechaDesc)).toStrictEqual([b, a, sin]);
  });
});

describe('varios', () => {
  it('unicos: sin vacíos ni repetidos, en orden alfabético español', () => {
    expect(unicos(['Ñandú', 'avena', '', null, 'Almendras', 'avena', undefined, 'Nuez'])).toStrictEqual(['Almendras', 'avena', 'Nuez', 'Ñandú']);
  });

  it('mensajeDeError acepta cualquier cosa', () => {
    expect(mensajeDeError(new Error('falló'))).toBe('falló');
    expect(mensajeDeError('texto')).toBe('texto');
  });
});
