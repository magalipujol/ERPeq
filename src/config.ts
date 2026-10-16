// Configuración de ERPeq. Ninguno de estos valores es secreto: el Client ID solo funciona desde los
// orígenes autorizados en el proyecto de Google Cloud, y la planilla solo la pueden abrir las cuentas
// con las que esté compartida en Drive.
// Ver GUIA-CONFIGURACION.md en la raíz del repo.
export const CONFIG = {
  // Client ID de OAuth del proyecto de Google Cloud
  CLIENT_ID: '1067820945093-bh8uqelc10h8c1psdlgrrhmpmrgho75b.apps.googleusercontent.com',

  // La planilla que hace de base de datos: el ID es la parte de la URL entre /d/ y /edit
  SPREADSHEET_ID: '1oIfqcZla06goA_esX7YEy8f-y57jwGbppjT05Y5Q7uU',
};

export type Config = typeof CONFIG;
