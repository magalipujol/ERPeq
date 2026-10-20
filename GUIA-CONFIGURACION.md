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
- El token dura una hora y "Salir" lo revoca. Para que recargar la página o abrir otra pestaña no pida
  el login de nuevo, se guarda en el navegador (`localStorage`) hasta que vence o se toca "Salir". En una
  compu compartida, tocá "Salir" al terminar.
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

1. En https://sheets.google.com, creá una hoja de cálculo en blanco y ponele un nombre (por ejemplo
   `ERPeq - Base de datos`).
2. Creá una hoja (pestaña) por cada fila de esta tabla: abajo a la izquierda, **+** (*Agregar hoja*), y
   renombrala con doble clic. El nombre tiene que ser exacto, con mayúscula inicial, tildes y sin espacios de
   más. En la fila 1 de cada hoja escribí los encabezados, uno por columna, empezando en A1:

   | Hoja | Fila 1 (columnas A, B, C…) |
   |---|---|
   | `Depósitos` | `id`, `nombre`, `localidad` |
   | `Productos` | `id`, `producto`, `unidad`, `minimo` |
   | `Contactos` | `id`, `rol`, `nombre`, `tipo_cliente`, `telefono`, `direccion`, `email`, `localidad`, `provincia`, `observaciones` |
   | `Tipos de cliente` | `tipo` |
   | `Vendedores` | `id`, `nombre`, `activo`, `localidad` |
   | `Precios` | `producto_id`, `precio`, `desde` |
   | `Reglas de comisión` | `vendedor_id`, `producto_id`, `porcentaje`, `desde` |
   | `Compras` | `fecha`, `deposito_id`, `contacto_id`, `producto_id`, `cantidad`, `precio`, `importe`, `remito`, `pedido_id`, `nota` |
   | `Pedidos` | `id`, `fecha`, `contacto_id`, `deposito_id`, `nota` |
   | `Pedidos ítems` | `pedido_id`, `linea`, `producto_id`, `cantidad`, `precio_lista`, `precio` |
   | `Pedidos estados` | `pedido_id`, `fecha`, `estado` |
   | `Pedidos vendedores` | `pedido_id`, `vendedor_id` |
   | `Ventas` | `id`, `fecha`, `pedido_id`, `deposito_id`, `nota` |
   | `Ventas ítems` | `venta_id`, `linea`, `pedido_linea`, `producto_id`, `cantidad`, `precio`, `importe`, `costo` |
   | `Ventas comisiones` | `venta_id`, `linea`, `vendedor_id`, `porcentaje_regla`, `porcentaje`, `monto` |
   | `Fletes` | `id`, `fecha`, `contacto_id`, `origen_id`, `destino_id`, `costo`, `guia`, `nota`, `salida`, `llegada_estimada` |
   | `Fletes ítems` | `flete_id`, `producto_id`, `cantidad` |
   | `Fletes estados` | `flete_id`, `fecha`, `estado` |
   | `Ajustes` | `fecha`, `deposito_id`, `producto_id`, `cantidad`, `motivo` |
   | `Socios` | `id`, `nombre`, `vendedor_id`, `rol` |
   | `Cobros` | `fecha`, `venta_id`, `importe`, `medio`, `socio_id`, `nota` |
   | `Rendiciones` | `fecha`, `de_socio_id`, `a_socio_id`, `importe`, `medio`, `nota` |
   | `Recetas` | `id`, `version`, `desde`, `producto_id`, `cantidad`, `activa` |
   | `Recetas ítems` | `receta_id`, `version`, `producto_id`, `cantidad` |
   | `Envíos` | `minimo`, `costo`, `desde` |
   | `Ventas envíos` | `venta_id`, `vendedor_id`, `costo_regla`, `costo` |

3. Cargá desde la fila 2 los datos fijos: *Depósitos* (por ejemplo `BB`, `General`, `Bahía Blanca`),
   *Productos*, *Tipos de cliente*, *Vendedores* (`activo` = `sí`; `localidad`, donde trabaja), los clientes,
   proveedores y transportes en *Contactos* y los socios en *Socios* (ver el paso 3 de "Agregar las hojas de
   caja"). Los contactos y productos también se pueden cargar después desde la app, en *Contactos* y
   *Productos*. Las demás hojas quedan con el
   encabezado solo: las llena la app.
4. Copiá el **ID** de la URL: `https://docs.google.com/spreadsheets/d/`**`ESTE-ES-EL-ID`**`/edit`.

> La planilla tiene datos personales (agenda de clientes). No la compartas por canales públicos.

### Agregar las hojas de caja a una planilla que ya existe

La pantalla **Caja** (cobros de las ventas y cuentas entre socios) usa tres hojas: *Socios*, *Cobros* y
*Rendiciones*. Si la planilla no las tiene, la app funciona igual
pero la pantalla Caja avisa que faltan y no deja registrar cobros. Para agregarlas a mano:

1. Abajo a la izquierda, **+** (*Agregar hoja*) y renombrala (doble clic en la pestaña). El nombre tiene que
   ser exacto, con mayúscula inicial y sin espacios de más.
2. Escribí los encabezados en la fila 1, uno por columna, empezando en A1:

   | Hoja | Fila 1 (columnas A, B, C…) |
   |---|---|
   | `Socios` | `id`, `nombre`, `vendedor_id`, `rol` |
   | `Cobros` | `fecha`, `venta_id`, `importe`, `medio`, `socio_id`, `nota` |
   | `Rendiciones` | `fecha`, `de_socio_id`, `a_socio_id`, `importe`, `medio`, `nota` |

3. En *Socios*, cargá los socios desde la fila 2. Con los vendedores de la base (revisá los IDs en la hoja
   *Vendedores*):

   | id | nombre | vendedor_id | rol |
   |---|---|---|---|
   | SOC01 | Sampatti | VEN02 | dueño |
   | SOC02 | Guada/Hernán | VEN01 | socio |

   `vendedor_id` es el vendedor cuyas comisiones se le acreditan al socio. Exactamente un socio tiene que
   tener `dueño` en `rol`: el dueño de la mercadería.
4. *Cobros* y *Rendiciones* quedan vacías (solo el encabezado): las llena la app.
5. En la app, **Salir** y volver a ingresar (o recargar la página) para que lea las hojas nuevas.

### Agregar las hojas de recetas a una planilla que ya existe

La pantalla **Recetas** usa dos hojas: *Recetas* y *Recetas ítems*. Si la planilla no las tiene, la app funciona igual pero la pantalla Recetas avisa que faltan y
no deja guardar recetas ni fabricar. Para agregarlas, igual que las de caja: una hoja nueva por cada una, con el
nombre exacto y estos encabezados en la fila 1:

| Hoja | Fila 1 (columnas A, B, C…) |
|---|---|
| `Recetas` | `id`, `version`, `desde`, `producto_id`, `cantidad`, `activa` |
| `Recetas ítems` | `receta_id`, `version`, `producto_id`, `cantidad` |

Quedan vacías: las recetas se cargan desde la app. El producto que sale de cada receta tiene que estar antes en
*Productos* y tener precio de lista (en la pantalla Precios). Las fabricaciones se guardan en *Ajustes*. Después,
recargá la página.

### Agregar las hojas de envíos a una planilla que ya existe

El costo de envío (lo que se le cobra al cliente cuando el pedido es por menos de un monto mínimo) usa dos
hojas: *Envíos* y *Ventas envíos*. Si la planilla no las tiene, la app funciona igual, pero la pantalla Precios
avisa que faltan y las entregas no cobran envío. Para agregarlas, igual que las de caja: una hoja nueva por cada
una, con el nombre exacto (con tilde en *Envíos*) y estos encabezados en la fila 1:

| Hoja | Fila 1 (columnas A, B, C…) |
|---|---|
| `Envíos` | `minimo`, `costo`, `desde` |
| `Ventas envíos` | `venta_id`, `vendedor_id`, `costo_regla`, `costo` |

Quedan vacías. Después de recargar la página, cargá el costo en la pantalla **Precios**, en *Costo de envío*
(por ejemplo, sin cargo desde $150.000 y $5.000 de envío).

### Agregar la localidad de los vendedores a una planilla que ya existe

La hoja *Vendedores* tiene una cuarta columna, `localidad`: al tomar un pedido, la app propone los vendedores
de la localidad del cliente. Si la planilla no la tiene, la app no abre hasta agregarla: escribí `localidad` en la celda **D1** de *Vendedores* y, en cada vendedor, su localidad
tal como figura en *Contactos* (por ejemplo, `Rosario` para Guada/Hernán). Puede quedar vacía. Después,
recargá la página.

### Pasar una planilla que ya existe al modelo de fletes sin pedidos

Los fletes ya no se asignan a pedidos (su costo es gasto de logística del mes) y guardan la salida y la llegada
previstas. Si la planilla es anterior a este cambio, la app no abre hasta migrarla. Los datos que ya tiene no se
tocan:

1. En **Fletes**, escribí `salida` en **I1** y `llegada_estimada` en **J1**. Los fletes anteriores quedan vacíos.
2. La hoja **Pedidos fletes** ya no se usa: la app la ignora. Podés borrarla o dejarla como historial.
3. Recargá la página.

### Si la app dice que las columnas de una hoja no son las que espera

El mensaje dice qué hoja es, qué encabezados espera y cuáles encontró. Corregí la fila 1 de esa hoja para que
tenga exactamente esos encabezados, en ese orden (puede haber columnas de más a la derecha), y recargá la
página. Si faltan columnas en el medio, insertalas en su lugar: no las agregues al final.

## 3. Completar `src/config.ts`

```ts
export const CONFIG = {
  CLIENT_ID: '1234-abc.apps.googleusercontent.com',
  SPREADSHEET_ID: 'ID-de-la-planilla',
};
```

Los depósitos, vendedores, socios, precios y reglas de comisión se cargan en la planilla (hojas *Depósitos*,
*Vendedores*, *Socios*, *Precios* y *Reglas de comisión*), no acá.

## 4. Primer ingreso

Abrí la app → **Ingresar con Google** → elegí tu cuenta. Como la app está en modo *Prueba*,
Google muestra un aviso de "Google no verificó esta app": tocá *Continuar* y aceptá el permiso
de hojas de cálculo.

## Instalar en el celular

ERPeq se puede instalar como una app, con su ícono y sin la barra del navegador:

- **Android (Chrome):** abrí la app → menú ⋮ → **Instalar app** (o *Agregar a pantalla principal*).
- **iPhone (Safari):** abrí la app → botón *Compartir* → **Agregar a inicio**.

Se actualiza sola: cada vez que la abrís carga la última versión publicada (puede tardar hasta unos 10 minutos
después de publicar). Si la dejaste abierta en segundo plano, cerrala y abrila de nuevo para ver los cambios.
En iPhone, si cambia el ícono hay que borrarla y volver a agregarla.

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
