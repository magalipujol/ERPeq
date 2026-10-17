// Adaptador Google Sheets: implementa el puerto sobre la planilla configurada.
import type { Config } from '../../config';
import type { BaseDeDatos } from '../puerto';
import * as G from './google';
import { CLAVES, parsear, rango } from './hojas';
import { operaciones } from './operaciones';

export function crearBaseSheets(config: Config): BaseDeDatos {
  // Hace falta para saber el sheetId de cada hoja al escribir.
  let planilla: G.InfoPlanilla | null = null;

  return {
    configurada: config.CLIENT_ID !== '' && config.SPREADSHEET_ID !== '',
    iniciar: async (alVencer) => G.init(config, { onSesionVencida: alVencer }),
    ingresar: G.login,
    salir: async () => {
      await G.logout();
      planilla = null;
    },
    abrir: async () => {
      planilla = await G.info();
      return { titulo: planilla.properties.title, url: planilla.spreadsheetUrl };
    },
    leer: async () => parsear(await G.leer(CLAVES.map(rango))),
    ...operaciones(async (escritura) => {
      if (!planilla) throw new Error('La planilla no está abierta.');
      await G.escribir(planilla, escritura);
    }),
  };
}
