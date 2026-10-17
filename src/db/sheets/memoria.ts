// Planilla en memoria: implementa el puerto con las mismas hojas, columnas y lectura que el adaptador
// de Google Sheets, sin red ni login. Sirve para las pruebas unitarias: cada operación deja las filas
// que Sheets guardaría.
import type { BaseDeDatos } from '../puerto';
import { type Fila, leida } from './celdas';
import { CLAVES, type ClaveHoja, type Escritura, parsear } from './hojas';
import { operaciones } from './operaciones';

export type Hojas = Record<ClaveHoja, Fila[]>;

export function crearPlanillaEnMemoria(inicial: Partial<Hojas> = {}): BaseDeDatos & { hojas: Hojas; escrituras: Escritura[] } {
  const hojas = Object.fromEntries(CLAVES.map((k) => [k, [...(inicial[k] ?? [])]])) as Hojas;
  const escrituras: Escritura[] = [];

  return {
    hojas, escrituras,
    configurada: true,
    iniciar: async () => Promise.resolve(),
    ingresar: async () => Promise.resolve(),
    salir: async () => Promise.resolve(),
    abrir: async () => Promise.resolve({ titulo: 'ERPeq (en memoria)', url: '', faltantes: [] }),
    leer: async () => Promise.resolve(parsear(CLAVES.map((k) => hojas[k]))),
    ...operaciones(async (escritura) => {
      escrituras.push(escritura);
      for (const k of CLAVES) hojas[k].push(...(escritura[k] ?? []).map((f) => f.map(leida)));
      return Promise.resolve();
    }),
  };
}
