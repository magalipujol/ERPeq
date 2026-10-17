// Adaptador Google Sheets: implementa el puerto sobre la planilla configurada.
import type { Config } from '../../config';
import type { BaseDeDatos } from '../puerto';
import * as G from './google';
import { HOJAS_OPCIONALES, hojasFaltantes, leerHojas, nombreHoja } from './hojas';
import { operaciones } from './operaciones';

export function crearBaseSheets(config: Config): BaseDeDatos {
  // Hace falta para saber el sheetId de cada hoja al escribir.
  let planilla: G.InfoPlanilla | null = null;
  const faltantes = () => (planilla ? hojasFaltantes(planilla.sheets.map((s) => s.properties.title)) : []);

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
      return {
        titulo: planilla.properties.title, url: planilla.spreadsheetUrl,
        faltantes: faltantes().map((k) => ({ nombre: nombreHoja(k), encabezados: [...HOJAS_OPCIONALES[k]] })),
      };
    },
    leer: async () => leerHojas(G.leer, faltantes()),
    ...operaciones(async (escritura) => {
      if (!planilla) throw new Error('La planilla no está abierta.');
      await G.escribir(planilla, escritura);
    }),
  };
}
