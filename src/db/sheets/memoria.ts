// Planilla en memoria: implementa el puerto con las mismas hojas, columnas y lectura que el adaptador
// de Google Sheets, sin red ni login. Sirve para las pruebas unitarias: cada operación deja las filas
// que Sheets guardaría.
import type { BaseDeDatos } from '../puerto';
import { type Fila, leida } from './celdas';
import { CLAVES, type ClaveHoja, type Correccion, type Escritura, nombreHoja, parsear, type Reemplazo } from './hojas';
import { operaciones } from './operaciones';

export type Hojas = Record<ClaveHoja, Fila[]>;

export function crearPlanillaEnMemoria(inicial: Partial<Hojas> = {}):
  BaseDeDatos & { hojas: Hojas; escrituras: Escritura[]; reemplazos: Reemplazo[]; correcciones: Correccion[] } {
  const hojas = Object.fromEntries(CLAVES.map((k) => [k, [...(inicial[k] ?? [])]])) as Hojas;
  const escrituras: Escritura[] = [];
  const reemplazos: Reemplazo[] = [];
  const correcciones: Correccion[] = [];
  const agregar = (escritura: Escritura) => {
    for (const k of CLAVES) hojas[k].push(...(escritura[k] ?? []).map((f) => f.map(leida)));
  };
  const id = (f: Fila) => String(f[0] ?? '').trim();

  return {
    hojas, escrituras, reemplazos, correcciones,
    configurada: true,
    iniciar: async () => Promise.resolve(false),
    ingresar: async () => Promise.resolve(),
    salir: async () => Promise.resolve(),
    abrir: async () => Promise.resolve({ titulo: 'ERPeq (en memoria)', url: '', faltantes: [] }),
    leer: async () => Promise.resolve(parsear(CLAVES.map((k) => hojas[k]))),
    ...operaciones(async (escritura) => {
      escrituras.push(escritura);
      agregar(escritura);
      return Promise.resolve();
    }, async (c) => {
      // Como en Sheets: si falta una fila a reemplazar, no se escribe nada.
      const indices = c.reemplazos.map((r) => {
        const i = hojas[r.hoja].findIndex((f) => id(f) === r.id);
        if (i < 0) throw new Error(`No está en la hoja "${nombreHoja(r.hoja)}".`);
        return i;
      });
      c.reemplazos.forEach((r, j) => { hojas[r.hoja][indices[j]] = r.fila.map(leida); });
      for (const r of c.recambios) {
        hojas[r.hoja] = hojas[r.hoja].filter((f) => !r.ids.includes(id(f)));
        agregar({ [r.hoja]: r.filas });
      }
      agregar(c.agregados);
      reemplazos.push(...c.reemplazos);
      correcciones.push(c);
      return Promise.resolve();
    }),
  };
}
