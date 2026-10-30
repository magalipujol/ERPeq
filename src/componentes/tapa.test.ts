import { describe, expect, it } from 'vitest';
import { letrasTapa, tonoTapa } from './tapa';

describe('tapa', () => {
  it('toma las dos primeras letras, o las iniciales de las dos primeras palabras', () => {
    expect(letrasTapa('almendras')).toBe('Al');
    expect(letrasTapa('  Mix europeo tostado ')).toBe('Me');
    expect(letrasTapa('A')).toBe('A');
  });

  it('el tono depende solo del ID', () => {
    expect(tonoTapa('P0001')).toBe(tonoTapa('P0001'));
    expect(tonoTapa('P0001')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
