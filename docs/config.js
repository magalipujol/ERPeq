// Configuración de ERPeq. Ninguno de estos valores es secreto: el Client ID y la API key solo
// funcionan desde los dominios autorizados en el proyecto de Google Cloud, y la planilla solo
// la pueden abrir las cuentas con las que esté compartida en Drive.
// Ver GUIA-CONFIGURACION.md en la raíz del repo.
window.ERPEQ_CONFIG = {
  // Proyecto de Google Cloud
  CLIENT_ID: '1067820945093-bh8uqelc10h8c1psdlgrrhmpmrgho75b.apps.googleusercontent.com',
  API_KEY: 'AIzaSyD9Q8rIxKtbwHq1KkjfkQarqRXp-ErCDAg', // restringida a la Google Picker API
  APP_ID: '1067820945093', // número del proyecto

  // La planilla que hace de base de datos: el ID es la parte de la URL entre /d/ y /edit
  SPREADSHEET_ID: '1oIfqcZla06goA_esX7YEy8f-y57jwGbppjT05Y5Q7uU',

  DEPOSITOS: ['General', 'Rosario'],
};
