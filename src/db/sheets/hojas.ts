// Cómo se guarda el dominio en la planilla: hojas, orden de columnas, lectura de filas y filas a
// escribir. Tiene que coincidir con la planilla real y con tests/google-falso.ts. La referencia es
// spec/modelo-de-datos.md.
// Las filas guardan IDs y no copias de nombres: el nombre de un producto, contacto, vendedor o socio sale
// siempre de su hoja.
import {
  type Ajuste, type Cobro, type Compra, type ContactoNuevo, type Datos, type Flete, type FleteItem, type Pedido,
  type PedidoItem, type PedidoVendedor, type Precio, type Producto, type Receta, type RecetaItem, redondear,
  type ReglaComision, type ReglaEnvio, type Rendicion, type Socio, type Venta, type VentaComision, type VentaEnvio, type VentaItem,
} from '../../dominio/modelo';
import type { AreaOpcional } from '../puerto';
import { type Celda, deSerie, type Fila, type ValorCelda } from './celdas';

// Nombre de cada hoja y encabezados de las columnas que lee la app, en orden (la fila 1 es el encabezado).
export const HOJAS = {
  depositos: ['Depósitos', ['id', 'nombre', 'localidad']],
  productos: ['Productos', ['id', 'producto', 'unidad', 'minimo']],
  contactos: ['Contactos', ['id', 'rol', 'nombre', 'tipo_cliente', 'telefono', 'direccion', 'email', 'localidad', 'provincia', 'observaciones']],
  tipos: ['Tipos de cliente', ['tipo']],
  vendedores: ['Vendedores', ['id', 'nombre', 'activo', 'localidad']],
  precios: ['Precios', ['producto_id', 'precio', 'desde']],
  reglas: ['Reglas de comisión', ['vendedor_id', 'producto_id', 'porcentaje', 'desde']],
  compras: ['Compras', ['fecha', 'deposito_id', 'contacto_id', 'producto_id', 'cantidad', 'precio', 'importe', 'remito', 'pedido_id', 'nota']],
  pedidos: ['Pedidos', ['id', 'fecha', 'contacto_id', 'deposito_id', 'nota']],
  pedidosItems: ['Pedidos ítems', ['pedido_id', 'linea', 'producto_id', 'cantidad', 'precio_lista', 'precio']],
  pedidosEstados: ['Pedidos estados', ['pedido_id', 'fecha', 'estado']],
  pedidosVendedores: ['Pedidos vendedores', ['pedido_id', 'vendedor_id']],
  ventas: ['Ventas', ['id', 'fecha', 'pedido_id', 'deposito_id', 'nota']],
  ventasItems: ['Ventas ítems', ['venta_id', 'linea', 'pedido_linea', 'producto_id', 'cantidad', 'precio', 'importe', 'costo']],
  ventasComisiones: ['Ventas comisiones', ['venta_id', 'linea', 'vendedor_id', 'porcentaje_regla', 'porcentaje', 'monto']],
  fletes: ['Fletes', ['id', 'fecha', 'contacto_id', 'origen_id', 'destino_id', 'costo', 'guia', 'nota', 'salida', 'llegada_estimada']],
  fletesItems: ['Fletes ítems', ['flete_id', 'producto_id', 'cantidad']],
  fletesEstados: ['Fletes estados', ['flete_id', 'fecha', 'estado']],
  ajustes: ['Ajustes', ['fecha', 'deposito_id', 'producto_id', 'cantidad', 'motivo']],
  socios: ['Socios', ['id', 'nombre', 'vendedor_id', 'rol']],
  cobros: ['Cobros', ['fecha', 'venta_id', 'importe', 'medio', 'socio_id', 'nota']],
  rendiciones: ['Rendiciones', ['fecha', 'de_socio_id', 'a_socio_id', 'importe', 'medio', 'nota']],
  recetas: ['Recetas', ['id', 'version', 'desde', 'producto_id', 'cantidad', 'activa']],
  recetasItems: ['Recetas ítems', ['receta_id', 'version', 'producto_id', 'cantidad']],
  envios: ['Envíos', ['minimo', 'costo', 'desde']],
  ventasEnvios: ['Ventas envíos', ['venta_id', 'vendedor_id', 'costo_regla', 'costo']],
} as const satisfies Record<string, readonly [string, readonly string[]]>;

export type ClaveHoja = keyof typeof HOJAS;
export const CLAVES = Object.keys(HOJAS) as ClaveHoja[];
export const nombreHoja = (k: ClaveHoja) => HOJAS[k][0];
export const encabezados = (k: ClaveHoja): readonly string[] => HOJAS[k][1];

// Hojas que la planilla puede no tener todavía, por área: si faltan, se leen vacías y esa área no deja
// registrar nada. Con las demás, que falte una es un error (si se leyera vacía, el stock o las ventas
// saldrían mal sin aviso).
export const OPCIONALES = {
  socios: 'caja', cobros: 'caja', rendiciones: 'caja',
  recetas: 'recetas', recetasItems: 'recetas',
  envios: 'envios', ventasEnvios: 'envios',
} as const satisfies Partial<Record<ClaveHoja, AreaOpcional>>;
type Opcional = keyof typeof OPCIONALES;

// Hojas opcionales que no están entre los títulos de la planilla.
export const hojasFaltantes = (titulos: readonly string[]) =>
  (Object.keys(OPCIONALES) as Opcional[]).filter((k) => !titulos.includes(nombreHoja(k)));

// Letra de la columna `n` (1 = A).
export const letraColumna = (n: number) => String.fromCharCode(64 + n);
export const rango = (k: ClaveHoja) => `'${nombreHoja(k)}'!A1:${letraColumna(encabezados(k).length)}`;

export class FormatoDistinto extends Error {
  constructor(hoja: string, esperados: readonly string[], leidos: string[]) {
    super(`Las columnas de la hoja "${hoja}" no son las que espera la app. Tienen que ser: ${esperados.join(', ')}. `
      + `En la planilla están: ${leidos.join(', ') || '(ninguna)'}. Corregí la fila 1 de esa hoja.`);
  }
}

// Lee todas las hojas salvo las `faltantes`, que quedan vacías: pedir una hoja que no existe haría fallar
// toda la lectura. Antes de leer los datos revisa los encabezados: con las columnas corridas, la app
// leería y escribiría cada dato en otra columna.
export async function leerHojas(leer: (rangos: string[]) => Promise<Fila[][]>, faltantes: readonly ClaveHoja[] = []) {
  const claves = CLAVES.filter((k) => !faltantes.includes(k));
  const leidas = await leer(claves.map(rango));
  const datos = claves.map((k, i) => {
    const [encabezado = [], ...filasHoja] = leidas[i] ?? [];
    const leidos = encabezado.map((v) => txt(v).toLowerCase());
    if (encabezados(k).some((e, j) => leidos[j] !== e)) throw new FormatoDistinto(nombreHoja(k), encabezados(k), leidos);
    return filasHoja;
  });
  return parsear(CLAVES.map((k) => (faltantes.includes(k) ? [] : datos[claves.indexOf(k)])));
}

const txt = (v: Celda) => (v === undefined || v === null ? '' : String(v).trim());
const num = (v: Celda) => (v === '' || v === undefined || v === null || isNaN(Number(v)) ? null : Number(v));
const bool = (v: Celda) => v === true || ['si', 'sí', 'true', 'verdadero', '1'].includes(txt(v).toLowerCase());

// `crudo` trae las filas de cada hoja en el orden de CLAVES.
export function parsear(crudo: Fila[][]): Datos {
  const fecha = (v: Celda) => (typeof v === 'number' ? deSerie(v) : null);
  const h = Object.fromEntries(CLAVES.map((k, i) => [k, crudo[i] ?? []])) as Record<ClaveHoja, Fila[]>;
  // Saltea las filas cuya columna `clave` está vacía.
  const de = <T>(k: ClaveHoja, clave: number, armar: (f: Fila, fila: number) => T) =>
    h[k].flatMap((f, i) => (txt(f[clave]) !== '' ? [armar(f, i + 2)] : []));
  const estados = (k: 'pedidosEstados' | 'fletesEstados') =>
    de(k, 0, (f) => ({ ref: txt(f[0]), fecha: fecha(f[1]), estado: txt(f[2]).toLowerCase() }));

  return {
    depositos: de('depositos', 0, (f) => ({ id: txt(f[0]), nombre: txt(f[1]) || txt(f[0]), localidad: txt(f[2]) })),
    productos: de('productos', 0, (f) => ({ id: txt(f[0]), producto: txt(f[1]), unidad: txt(f[2]) || 'kg', minimo: num(f[3]) ?? 0 })),
    contactos: de('contactos', 0, (f) => ({
      id: txt(f[0]), rol: txt(f[1]).toLowerCase(), nombre: txt(f[2]), tipo: txt(f[3]), telefono: txt(f[4]),
      direccion: txt(f[5]), email: txt(f[6]), localidad: txt(f[7]), provincia: txt(f[8]), observaciones: txt(f[9]),
    })),
    tipos: de('tipos', 0, (f) => txt(f[0])),
    vendedores: de('vendedores', 0, (f) => ({
      id: txt(f[0]), nombre: txt(f[1]) || txt(f[0]), activo: txt(f[2]) === '' || bool(f[2]), localidad: txt(f[3]),
    })),
    precios: de('precios', 0, (f) => ({ productoId: txt(f[0]), precio: num(f[1]) ?? 0, desde: fecha(f[2]) }))
      .filter((p) => p.precio > 0),
    reglas: de('reglas', 0, (f) => ({ vendedorId: txt(f[0]), productoId: txt(f[1]), porcentaje: num(f[2]) ?? 0, desde: fecha(f[3]) })),
    compras: de('compras', 3, (f, fila) => ({
      fila, fecha: fecha(f[0]), depositoId: txt(f[1]), contactoId: txt(f[2]), productoId: txt(f[3]), cantidad: num(f[4]) ?? 0,
      precio: num(f[5]), importe: num(f[6]), remito: txt(f[7]), pedidoId: txt(f[8]), nota: txt(f[9]),
    })),
    pedidos: de('pedidos', 0, (f) => ({
      id: txt(f[0]), fecha: fecha(f[1]), contactoId: txt(f[2]), depositoId: txt(f[3]), nota: txt(f[4]),
    })),
    pedidosItems: de('pedidosItems', 0, (f) => ({
      pedidoId: txt(f[0]), linea: num(f[1]) ?? 0, productoId: txt(f[2]), cantidad: num(f[3]) ?? 0, precioLista: num(f[4]),
      precio: num(f[5]) ?? 0,
    })),
    pedidosEstados: estados('pedidosEstados'),
    pedidosVendedores: de('pedidosVendedores', 0, (f) => ({ pedidoId: txt(f[0]), vendedorId: txt(f[1]) })),
    ventas: de('ventas', 0, (f) => ({ id: txt(f[0]), fecha: fecha(f[1]), pedidoId: txt(f[2]), depositoId: txt(f[3]), nota: txt(f[4]) })),
    ventasItems: de('ventasItems', 0, (f) => ({
      ventaId: txt(f[0]), linea: num(f[1]) ?? 0, pedidoLinea: num(f[2]) ?? 0, productoId: txt(f[3]), cantidad: num(f[4]) ?? 0,
      precio: num(f[5]) ?? 0, importe: num(f[6]) ?? 0, costo: num(f[7]),
    })),
    ventasComisiones: de('ventasComisiones', 0, (f) => ({
      ventaId: txt(f[0]), linea: num(f[1]) ?? 0, vendedorId: txt(f[2]), porcentajeRegla: num(f[3]), porcentaje: num(f[4]) ?? 0,
      monto: num(f[5]) ?? 0,
    })),
    fletes: de('fletes', 0, (f) => ({
      id: txt(f[0]), fecha: fecha(f[1]), contactoId: txt(f[2]), origenId: txt(f[3]), destinoId: txt(f[4]), costo: num(f[5]),
      guia: txt(f[6]), nota: txt(f[7]), salida: fecha(f[8]), llegadaEstimada: fecha(f[9]),
    })),
    fletesItems: de('fletesItems', 0, (f) => ({ fleteId: txt(f[0]), productoId: txt(f[1]), cantidad: num(f[2]) ?? 0 })),
    fletesEstados: estados('fletesEstados'),
    ajustes: de('ajustes', 2, (f) => ({
      fecha: fecha(f[0]), depositoId: txt(f[1]), productoId: txt(f[2]), cantidad: num(f[3]) ?? 0, motivo: txt(f[4]),
    })),
    socios: parsearSocios(h.socios),
    cobros: de('cobros', 1, (f) => ({
      fecha: fecha(f[0]), ventaId: txt(f[1]), importe: num(f[2]) ?? 0, medio: txt(f[3]).toLowerCase(), socioId: txt(f[4]),
      nota: txt(f[5]),
    })),
    rendiciones: de('rendiciones', 1, (f) => ({
      fecha: fecha(f[0]), deId: txt(f[1]), aId: txt(f[2]), importe: num(f[3]) ?? 0, medio: txt(f[4]).toLowerCase(), nota: txt(f[5]),
    })),
    recetas: de('recetas', 0, (f) => ({
      id: txt(f[0]), version: num(f[1]) ?? 1, desde: fecha(f[2]), productoId: txt(f[3]), cantidad: num(f[4]) ?? 0,
      activa: txt(f[5]) === '' || bool(f[5]),
    })),
    recetasItems: de('recetasItems', 0, (f) => ({ recetaId: txt(f[0]), version: num(f[1]) ?? 1, productoId: txt(f[2]), cantidad: num(f[3]) ?? 0 })),
    envios: de('envios', 1, (f) => ({ minimo: num(f[0]) ?? 0, costo: num(f[1]) ?? 0, desde: fecha(f[2]) })),
    ventasEnvios: de('ventasEnvios', 0, (f) => ({
      ventaId: txt(f[0]), vendedorId: txt(f[1]), costoRegla: num(f[2]), costo: num(f[3]) ?? 0,
    })),
  };
}

// Un socio puede tener varias filas, una por vendedor cuyas comisiones se le acreditan. Junta las filas
// de cada socio: el nombre de la primera, todos sus vendedores y si alguna dice "dueño" en `rol`.
function parsearSocios(filasSocios: Fila[]): Socio[] {
  const res = new Map<string, Socio>();
  for (const f of filasSocios) {
    const id = txt(f[0]);
    if (id === '') continue;
    const s = res.get(id) ?? { id, nombre: '', vendedores: [], duenio: false };
    s.nombre ||= txt(f[1]);
    if (txt(f[2]) !== '' && !s.vendedores.includes(txt(f[2]))) s.vendedores.push(txt(f[2]));
    s.duenio ||= ['dueño', 'dueno', 'duenio'].includes(txt(f[3]).toLowerCase());
    res.set(id, s);
  }
  return [...res.values()].map((s) => ({ ...s, nombre: s.nombre || s.id }));
}

// ---------- Filas a escribir (mismo orden de columnas que cada hoja) ----------

const vacio = (v: number | null | undefined) => v ?? '';

export const filas = {
  producto: (p: Producto): ValorCelda[] => [p.id, p.producto, p.unidad, vacio(p.minimo)],
  contacto: (c: ContactoNuevo): ValorCelda[] => [
    c.id, c.rol, c.nombre, c.tipo, c.telefono, c.direccion, c.email, c.localidad, c.provincia, c.observaciones,
  ],
  precio: (p: Precio): ValorCelda[] => [p.productoId, p.precio, p.desde],
  regla: (r: ReglaComision): ValorCelda[] => [r.vendedorId, r.productoId, r.porcentaje, r.desde],
  compra: (c: Omit<Compra, 'fila' | 'importe'>): ValorCelda[] => [
    c.fecha, c.depositoId, c.contactoId, c.productoId, c.cantidad, vacio(c.precio),
    c.precio === null ? '' : redondear(c.cantidad * c.precio), c.remito, c.pedidoId, c.nota,
  ],
  pedido: (p: Pedido): ValorCelda[] => [p.id, p.fecha, p.contactoId, p.depositoId, p.nota],
  pedidoItem: (i: PedidoItem): ValorCelda[] => [i.pedidoId, i.linea, i.productoId, i.cantidad, vacio(i.precioLista), i.precio],
  estado: (ref: string, estado: string, momento: Date): ValorCelda[] => [ref, { momento }, estado],
  pedidoVendedor: (p: PedidoVendedor): ValorCelda[] => [p.pedidoId, p.vendedorId],
  venta: (v: Venta): ValorCelda[] => [v.id, v.fecha, v.pedidoId, v.depositoId, v.nota],
  ventaItem: (i: VentaItem): ValorCelda[] => [i.ventaId, i.linea, i.pedidoLinea, i.productoId, i.cantidad, i.precio, i.importe, vacio(i.costo)],
  ventaComision: (c: VentaComision): ValorCelda[] => [c.ventaId, c.linea, c.vendedorId, vacio(c.porcentajeRegla), c.porcentaje, c.monto],
  flete: (f: Flete): ValorCelda[] => [
    f.id, f.fecha, f.contactoId, f.origenId, f.destinoId, vacio(f.costo), f.guia, f.nota,
    f.salida ? { momento: f.salida } : '', f.llegadaEstimada ? { momento: f.llegadaEstimada } : '',
  ],
  fleteItem: (i: FleteItem): ValorCelda[] => [i.fleteId, i.productoId, i.cantidad],
  ajuste: (a: Ajuste): ValorCelda[] => [a.fecha, a.depositoId, a.productoId, a.cantidad, a.motivo],
  cobro: (c: Cobro): ValorCelda[] => [c.fecha, c.ventaId, c.importe, c.medio, c.socioId, c.nota],
  rendicion: (r: Rendicion): ValorCelda[] => [r.fecha, r.deId, r.aId, r.importe, r.medio, r.nota],
  receta: (r: Receta): ValorCelda[] => [r.id, r.version, r.desde, r.productoId, r.cantidad, r.activa ? 'sí' : 'no'],
  recetaItem: (i: RecetaItem): ValorCelda[] => [i.recetaId, i.version, i.productoId, i.cantidad],
  envio: (r: ReglaEnvio): ValorCelda[] => [r.minimo, r.costo, r.desde],
  ventaEnvio: (e: VentaEnvio): ValorCelda[] => [e.ventaId, e.vendedorId, vacio(e.costoRegla), e.costo],
};

// Filas por hoja que se escriben juntas en una operación.
export type Escritura = Partial<Record<ClaveHoja, ValorCelda[][]>>;

// Fila que reemplaza a la que tiene `id` en la primera columna de su hoja.
export interface Reemplazo { hoja: ClaveHoja; id: string; fila: ValorCelda[] }

// Filas que ocupan el lugar de todas las que tienen alguno de los `ids` en la columna `columna` de su hoja (0 = A, la
// primera si no se dice): las de antes se borran y estas se agregan al final (pueden ser más, menos o ninguna).
export interface Recambio { hoja: ClaveHoja; ids: string[]; filas: ValorCelda[][]; columna?: number }

// Corrección de filas ya guardadas, que se escribe de una sola vez: reemplazos en el lugar, recambios y filas nuevas.
export interface Correccion { reemplazos: Reemplazo[]; recambios: Recambio[]; agregados: Escritura }

// Une varias escrituras en una.
export function unir(...escrituras: Escritura[]): Escritura {
  const res: Escritura = {};
  for (const e of escrituras) {
    for (const k of Object.keys(e) as ClaveHoja[]) res[k] = [...(res[k] ?? []), ...(e[k] ?? [])];
  }
  return res;
}
