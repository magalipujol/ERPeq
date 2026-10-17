/**
 * Saca de la planilla de ERPeq las columnas con nombres copiados (cliente, producto, vendedor, socio,
 * proveedor, transporte, y el tipo, la localidad y la provincia del pedido). Desde que la app las dejó de
 * usar, el nombre de cada cosa sale solo de su hoja (Productos, Contactos, Vendedores, Socios) por su ID.
 *
 * Se corre una sola vez, en la planilla real, desde Extensiones → Apps Script:
 *   1. Pegar este archivo en el editor y guardar.
 *   2. Ejecutar `revisar`: no cambia nada. En el registro de ejecución lista los problemas (filas con un
 *      nombre copiado pero sin ID, o con un ID que no existe) y lo que va a hacer `migrar`.
 *   3. Si no hay problemas, hacer una copia de la planilla (Archivo → Hacer una copia) como respaldo y
 *      ejecutar `migrar`.
 * Correrlo de nuevo no hace nada: las columnas que ya no están se saltean.
 */

// Columnas a sacar de cada hoja y la columna con el ID del que sale ese dato.
const QUITAR = {
  'Precios': { producto: 'producto_id' },
  'Compras': { proveedor: 'contacto_id', producto: 'producto_id' },
  'Pedidos': { cliente: 'contacto_id', tipo_cliente: 'contacto_id', localidad: 'contacto_id', provincia: 'contacto_id' },
  'Pedidos ítems': { producto: 'producto_id' },
  'Ventas ítems': { producto: 'producto_id' },
  'Ventas comisiones': { vendedor: 'vendedor_id' },
  'Fletes': { transporte: 'contacto_id' },
  'Fletes ítems': { producto: 'producto_id' },
  'Ajustes': { producto: 'producto_id' },
  'Cobros': { socio: 'socio_id' },
};

// Hoja en la que está cada ID (columna `id`).
const REFERENCIA = { producto_id: 'Productos', contacto_id: 'Contactos', vendedor_id: 'Vendedores', socio_id: 'Socios' };

// Datos del cliente que hoy están en cada pedido y pasan a salir solo del contacto. Si el contacto los tiene
// vacíos, se completan con los del último pedido del cliente para no perderlos.
const DEL_CONTACTO = ['tipo_cliente', 'localidad', 'provincia'];

const texto = (v) => String(v === null || v === undefined ? '' : v).trim();

function leerHoja(planilla, nombre) {
  const hoja = planilla.getSheetByName(nombre);
  if (!hoja) return null;
  const valores = hoja.getDataRange().getValues();
  const encabezados = (valores[0] || []).map((v) => texto(v).toLowerCase());
  return { hoja, encabezados, filas: valores.slice(1), col: (n) => encabezados.indexOf(n) };
}

// Revisa la planilla y arma el plan de la migración, sin cambiar nada.
function planificar(planilla) {
  const problemas = [];
  const columnas = []; // { nombre, hoja, indices }
  let distintos = 0;

  const ids = {};
  for (const [columna, nombre] of Object.entries(REFERENCIA)) {
    const h = leerHoja(planilla, nombre);
    ids[columna] = new Set(h ? h.filas.map((f) => texto(f[h.col('id')])).filter(Boolean) : []);
  }
  const contactos = leerHoja(planilla, 'Contactos');
  const nombreContacto = new Map(contactos.filas.map((f) => [texto(f[contactos.col('id')]), texto(f[contactos.col('nombre')])]));

  for (const [nombre, quitar] of Object.entries(QUITAR)) {
    const h = leerHoja(planilla, nombre);
    if (!h) continue;
    const indices = Object.keys(quitar).map((c) => h.col(c)).filter((i) => i >= 0);
    if (indices.length === 0) continue;
    columnas.push({ nombre, hoja: h.hoja, indices });
    h.filas.forEach((f, i) => {
      if (f.every((v) => texto(v) === '')) return;
      for (const [copia, columnaId] of Object.entries(quitar)) {
        const c = h.col(copia);
        const valor = c >= 0 ? texto(f[c]) : '';
        const id = texto(f[h.col(columnaId)]);
        if (valor === '') continue;
        if (id === '') problemas.push(`${nombre}, fila ${i + 2}: ${copia} «${valor}» sin ${columnaId}.`);
        else if (!ids[columnaId].has(id)) problemas.push(`${nombre}, fila ${i + 2}: ${columnaId} ${id} no está en ${REFERENCIA[columnaId]}.`);
        else if (columnaId === 'contacto_id' && (copia === 'cliente' || copia === 'proveedor' || copia === 'transporte')
          && valor.toLowerCase() !== nombreContacto.get(id).toLowerCase()) distintos += 1;
      }
    });
  }

  // Datos del cliente que faltan en Contactos y están en sus pedidos: gana el último pedido.
  const completar = new Map(); // "fila|columna" → valor
  const pedidos = leerHoja(planilla, 'Pedidos');
  const filaContacto = new Map(contactos.filas.map((f, i) => [texto(f[contactos.col('id')]), i]));
  if (pedidos && pedidos.col('cliente') >= 0) {
    for (const f of pedidos.filas) {
      const i = filaContacto.get(texto(f[pedidos.col('contacto_id')]));
      if (i === undefined) continue;
      for (const c of DEL_CONTACTO) {
        const valor = pedidos.col(c) >= 0 ? texto(f[pedidos.col(c)]) : '';
        if (valor !== '' && texto(contactos.filas[i][contactos.col(c)]) === '') completar.set(`${i}|${c}`, valor);
      }
    }
  }

  return { problemas, columnas, distintos, completar, contactos };
}

function informar(plan) {
  for (const p of plan.problemas) console.log(`PROBLEMA: ${p}`);
  for (const c of plan.columnas) {
    console.log(`${c.nombre}: se borran las columnas ${c.indices.map((i) => c.hoja.getRange(1, i + 1).getValue()).join(', ')}.`);
  }
  for (const [clave, valor] of plan.completar) {
    const [i, c] = clave.split('|');
    console.log(`Contactos, fila ${Number(i) + 2}: sin ${c}, se completa con «${valor}» (de su último pedido).`);
  }
  if (plan.distintos > 0) {
    console.log(`Filas con un nombre copiado distinto al de Contactos: ${plan.distintos}. La app muestra el de Contactos.`);
  }
  if (plan.columnas.length === 0) console.log('La planilla ya está migrada.');
  console.log(plan.problemas.length > 0
    ? `Problemas: ${plan.problemas.length}. Corregilos en la planilla (completando el ID) antes de migrar.`
    : 'Sin problemas.');
}

function revisar() {
  informar(planificar(SpreadsheetApp.getActiveSpreadsheet()));
}

function migrar() {
  const plan = planificar(SpreadsheetApp.getActiveSpreadsheet());
  informar(plan);
  if (plan.problemas.length > 0) throw new Error('No se migró nada: hay problemas (ver el registro).');

  for (const [clave, valor] of plan.completar) {
    const [i, c] = clave.split('|');
    plan.contactos.hoja.getRange(Number(i) + 2, plan.contactos.col(c) + 1).setValue(valor);
  }
  // De derecha a izquierda, para que borrar una columna no corra las que faltan.
  for (const c of plan.columnas) {
    for (const i of [...c.indices].sort((a, b) => b - a)) c.hoja.deleteColumn(i + 1);
  }
  console.log('Migración terminada.');
}
