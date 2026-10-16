# Guía de configuración de ERPeq

ERPeq usa una planilla de Google Sheets como base de datos. Cada persona entra con su cuenta de Google
y la app lee y escribe esa planilla con la Sheets API, directo desde el navegador (no hay servidor).

Hacen falta tres cosas, todas en la cuenta del **dueño** (hoy Leo):

1. Un proyecto de Google Cloud (gratis) que identifica a la app.
2. La planilla de datos en su Drive.
3. Completar `src/config.ts` con esos datos.

Ninguno de los valores de `config.ts` es secreto: el Client ID solo funciona desde los orígenes
autorizados, y la planilla solo la abren las cuentas con las que está compartida.

## Sobre el permiso que pide la app

La app pide el permiso **"Ver, editar, crear y borrar tus hojas de cálculo de Google Sheets"**
(`spreadsheets`). Google no ofrece uno más chico que funcione sin pasos extra, así que técnicamente
el token de sesión sirve para cualquier planilla de esa cuenta. Lo que limita el riesgo:

- La app está en modo **Prueba**: solo pueden iniciar sesión las cuentas cargadas como usuarios de prueba.
- El código solo usa la planilla configurada en `config.ts`, y es público para revisarlo.
- El token dura una hora, vive solo en memoria y "Salir" lo revoca.
- La página bloquea scripts de terceros (Content-Security-Policy), salvo el login de Google.

---

## 1. Proyecto de Google Cloud (~10 minutos)

Entrá a https://console.cloud.google.com con la cuenta del dueño.

1. **Crear el proyecto**: selector de proyectos (arriba a la izquierda) → *Proyecto nuevo* → nombre `ERPeq` → *Crear*.
   Asegurate de que quede seleccionado.

2. **Habilitar la API**: menú → *APIs y servicios* → *Biblioteca* → buscá **Google Sheets API** → *Habilitar*.

3. **Pantalla de consentimiento**: menú → *Google Auth Platform* → *Comenzar*.
   - Nombre de la app: `ERPeq`. Correo de asistencia: el tuyo.
   - Público: **Externo**.
   - Datos de contacto: tu correo. Aceptá y *Crear*.

4. **Público / usuarios de prueba**: *Google Auth Platform* → *Público*.
   - Dejá el estado de publicación en **Prueba**. Así **solo las cuentas que agregues pueden entrar**.
   - En *Usuarios de prueba* → *Agregar usuarios*: tu correo y el de cualquiera que vaya a usar la app.
     Ojo: el dueño del proyecto **no** está incluido automáticamente; si falta, Google muestra
     "Acceso bloqueado: … no completó el proceso de verificación".

5. **Permisos**: *Google Auth Platform* → *Acceso a los datos* → *Agregar o quitar permisos* →
   buscá `spreadsheets` y marcá **`.../auth/spreadsheets`** (Google Sheets API) → *Actualizar* → *Guardar*.
   Si no aparece en la tabla, abajo en *Agrega permisos manualmente* pegá
   `https://www.googleapis.com/auth/spreadsheets` → *Agregar a la tabla*.
   Va a figurar en "Permisos sensibles": es normal y, en modo Prueba, no requiere verificación de Google.

6. **Client ID**: *Google Auth Platform* → *Clientes* → *Crear cliente*.
   - Tipo: **Aplicación web**. Nombre: `ERPeq web`.
   - *Orígenes de JavaScript autorizados* (solo el dominio, sin ruta ni barra final):
     - `https://USUARIO.github.io` (donde se publica la app)
     - `http://localhost:5500` (solo para probar en la compu; se puede borrar después)
   - No hace falta completar URIs de redireccionamiento. *Crear* y copiá el **ID de cliente**.

## 2. La planilla

La base inicial se genera desde el Excel histórico con `herramientas/excel_a_base.py`
(ver README). Eso produce `ERPeq-base.xlsx`.

1. En https://drive.google.com → *Nuevo* → *Subir archivo* → `ERPeq-base.xlsx`.
2. Abrilo y andá a *Archivo* → *Guardar como Hojas de cálculo de Google*. Se abre la planilla convertida
   en otra pestaña. (Si arriba, al lado del nombre, dice **.XLSX**, todavía es el Excel: la API no puede usarlo.)
   Podés borrar el `.xlsx` subido.
3. Renombrala si querés (por ejemplo `ERPeq - Base de datos`).
4. Copiá el **ID** de la URL: `https://docs.google.com/spreadsheets/d/`**`ESTE-ES-EL-ID`**`/edit`.

> El `.xlsx` tiene datos personales (agenda de clientes). No lo subas al repositorio ni lo mandes por canales públicos.

## 3. Completar `src/config.ts`

```ts
export const CONFIG = {
  CLIENT_ID: '1234-abc.apps.googleusercontent.com',
  SPREADSHEET_ID: 'ID-de-la-planilla',
  DEPOSITOS: ['General', 'Rosario'],
};
```

## 4. Primer ingreso

Abrí la app → **Ingresar con Google** → elegí tu cuenta. Como la app está en modo *Prueba*,
Google muestra un aviso de "Google no verificó esta app": tocá *Continuar* y aceptá el permiso
de hojas de cálculo.

## Sumar a otra persona

1. Compartile la planilla desde Drive (*Compartir* → su correo → *Editor*).
2. Agregá su correo en *Usuarios de prueba* (paso 1.4).
3. Listo: entra a la app con su cuenta.

Para sacarle el acceso: dejá de compartirle la planilla y sacala de los usuarios de prueba.

## Pasarle todo a otra cuenta (de vos a Leo)

- **Planilla**: en Drive, *Compartir* → agregá a Leo como Editor → en su nombre, *Transferir la propiedad*.
  Leo acepta la invitación. Así la planilla conserva el mismo ID y el historial. Después podés quitarte el acceso.
  (Alternativa: que Leo haga *Archivo → Crear una copia*; en ese caso cambia el ID y hay que actualizar `SPREADSHEET_ID`.)
- **Proyecto de Google Cloud**: Leo crea el suyo siguiendo la sección 1 y se reemplaza `CLIENT_ID`.
  Después borrás tu proyecto de prueba (*Configuración de IAM y administración* → *Configuración* → *Cerrar*).
- **Repositorio**: si querés que también sea de Leo, *Settings* → *Transfer ownership* en GitHub, y él agrega
  `https://LEO.github.io` como origen autorizado en su Client ID.
