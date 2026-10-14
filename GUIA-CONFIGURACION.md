# Guía de configuración de ERPeq

ERPeq usa una planilla de Google Sheets como base de datos. Cada persona entra con su cuenta de Google
y la app solo puede tocar **esa planilla** (permiso `drive.file`), nada más de su Drive.

Hacen falta tres cosas, todas en la cuenta del **dueño** (hoy Leo):

1. Un proyecto de Google Cloud (gratis) que identifica a la app.
2. La planilla de datos en su Drive.
3. Completar `docs/config.js` con esos datos.

Ninguno de los valores de `config.js` es secreto: el Client ID y la API key solo funcionan desde los
dominios autorizados, y la planilla solo la abren las cuentas con las que está compartida.

---

## 1. Proyecto de Google Cloud (~10 minutos)

Entrá a https://console.cloud.google.com con la cuenta del dueño.

1. **Crear el proyecto**: selector de proyectos (arriba a la izquierda) → *Proyecto nuevo* → nombre `ERPeq` → *Crear*.
   Asegurate de que quede seleccionado.

2. **Habilitar las APIs**: menú → *APIs y servicios* → *Biblioteca*. Buscá y habilitá:
   - **Google Sheets API**
   - **Google Picker API**

3. **Pantalla de consentimiento**: menú → *Google Auth Platform* → *Comenzar*.
   - Nombre de la app: `ERPeq`. Correo de asistencia: el tuyo.
   - Público: **Externo**.
   - Datos de contacto: tu correo. Aceptá y *Crear*.

4. **Público / usuarios de prueba**: *Google Auth Platform* → *Público*.
   - Dejá el estado de publicación en **Prueba**. Así **solo las cuentas que agregues pueden entrar**.
   - En *Usuarios de prueba* → *Agregar usuarios*: tu correo y el de cualquiera que vaya a usar la app.

5. **Permisos**: *Google Auth Platform* → *Acceso a los datos* → *Agregar o quitar permisos*.
   Como la Drive API no está habilitada, el permiso no aparece en la tabla: abajo, en
   *Agrega permisos manualmente*, pegá `https://www.googleapis.com/auth/drive.file` →
   *Agregar a la tabla* → verificá que quede marcado → *Actualizar* → *Guardar*.
   Tiene que figurar en "Permisos no sensibles".

6. **Client ID**: *Google Auth Platform* → *Clientes* → *Crear cliente*.
   - Tipo: **Aplicación web**. Nombre: `ERPeq web`.
   - *Orígenes de JavaScript autorizados*:
     - `https://USUARIO.github.io` (donde se publica la app; sin barra al final)
     - `http://localhost:5500` (solo para probar en la compu; se puede borrar después)
   - No hace falta completar URIs de redireccionamiento. *Crear* y copiá el **ID de cliente**.

7. **API key (para el selector de archivos)**: *APIs y servicios* → *Credenciales* → *Crear credenciales* → *Clave de API*.
   Después tocá *Editar clave*:
   - *Restricciones de aplicaciones*: **Sitios web** → agregá estos tres:
     - `https://USUARIO.github.io/*` (donde se publica la app)
     - `http://localhost:5500/*` (para probar en la compu)
     - `https://docs.google.com/*` (**necesario**: el selector de archivos de Google corre dentro de una página
       de docs.google.com y usa la clave desde ahí. Sin esta línea aparece el error
       "La clave de desarrollador de la API no es válida" al tocar *Elegir la planilla*).
   - *Restricciones de API*: **Restringir clave** → elegí solo **Google Picker API**.
   - *Guardar* y copiá la clave.

8. **Número del proyecto**: menú → *Configuración de IAM y administración* → *Configuración* → **Número del proyecto**
   (son solo dígitos).

## 2. La planilla

La base inicial se genera desde el Excel histórico con `herramientas/excel_a_base.py`
(ver README). Eso produce `ERPeq-base.xlsx`.

1. En https://drive.google.com → *Nuevo* → *Subir archivo* → `ERPeq-base.xlsx`.
2. Abrilo y andá a *Archivo* → *Guardar como Hojas de cálculo de Google*. Se crea la planilla.
   Podés borrar el `.xlsx` subido.
3. Renombrala si querés (por ejemplo `ERPeq - Base de datos`).
4. Copiá el **ID** de la URL: `https://docs.google.com/spreadsheets/d/`**`ESTE-ES-EL-ID`**`/edit`.

> El `.xlsx` tiene datos personales (agenda de clientes). No lo subas al repositorio ni lo mandes por canales públicos.

## 3. Completar `docs/config.js`

```js
window.ERPEQ_CONFIG = {
  CLIENT_ID: '1234-abc.apps.googleusercontent.com',
  API_KEY: 'AIza...',
  APP_ID: '1234567890',
  SPREADSHEET_ID: 'ID-de-la-planilla',
  DEPOSITOS: ['General', 'Rosario'],
};
```

## 4. Primer ingreso

1. Abrí la app → **Ingresar con Google** → elegí tu cuenta. Como la app está en modo *Prueba*,
   Google muestra un aviso de "app no verificada": tocá *Continuar*.
2. La primera vez aparece **Conectá la planilla** → *Elegir la planilla* → seleccionala → *Seleccionar*.
   Esto se hace una sola vez por cuenta.

## Sumar a otra persona

1. Compartile la planilla desde Drive (*Compartir* → su correo → *Editor*).
2. Agregá su correo en *Usuarios de prueba* (paso 1.4).
3. Ella entra a la app, ingresa con su cuenta y hace el paso *Conectá la planilla* una vez.

Para sacarle el acceso: dejá de compartirle la planilla. Sin eso, la app no puede leer nada aunque pueda iniciar sesión.

## Pasarle todo a otra cuenta (de vos a Leo)

- **Planilla**: en Drive, *Compartir* → agregá a Leo como Editor → en su nombre, *Transferir la propiedad*.
  Leo acepta la invitación. Así la planilla conserva el mismo ID y el historial. Después podés quitarte el acceso.
  (Alternativa: que Leo haga *Archivo → Crear una copia*; en ese caso cambia el ID y hay que actualizar `SPREADSHEET_ID`.)
- **Proyecto de Google Cloud**: Leo crea el suyo siguiendo la sección 1 y se reemplazan `CLIENT_ID`, `API_KEY` y `APP_ID`.
  Después borrás tu proyecto de prueba (*Configuración de IAM y administración* → *Configuración* → *Cerrar*).
- **Repositorio**: si querés que también sea de Leo, *Settings* → *Transfer ownership* en GitHub, y él actualiza
  el origen autorizado (`https://LEO.github.io`) en el Client ID y la API key.
