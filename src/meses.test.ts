import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mesElegido, mesesDisponibles } from './meses';

const f = (a: number, m: number) => new Date(a, m - 1, 10);

describe('meses', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('con movimientos este mes: ofrece solo meses con datos, del más nuevo al más viejo', () => {
    expect(mesesDisponibles([f(2026, 9), f(2026, 10), null, f(2026, 9)]))
      .toStrictEqual({ meses: ['2026-10', '2026-09'], porDefecto: '2026-10' });
  });

  it('sin movimientos este mes: agrega el mes actual pero elige el último con datos', () => {
    expect(mesesDisponibles([f(2026, 8)])).toStrictEqual({ meses: ['2026-10', '2026-08'], porDefecto: '2026-08' });
  });

  it('sin datos: el mes actual', () => {
    expect(mesesDisponibles([])).toStrictEqual({ meses: ['2026-10'], porDefecto: '2026-10' });
  });

  it('mesElegido respeta la elección si sigue disponible', () => {
    const fechas = [f(2026, 8), f(2026, 10)];

    expect(mesElegido(fechas, '2026-08')).toBe('2026-08');
    expect(mesElegido(fechas, '2025-01')).toBe('2026-10');
    expect(mesElegido(fechas, null)).toBe('2026-10');
  });
});
