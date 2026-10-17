// Cómo se guarda el dominio en la planilla: hojas, orden de columnas, lectura de filas y filas a
// escribir. Tiene que coincidir con la planilla real, con tests/google-falso.ts y con
// herramientas/excel_a_base.py. La referencia es spec/modelo-de-datos.md.
import {
  type Ajuste, type Compra, type ContactoNuevo, type Datos, type Flete, type FleteItem, type Pedido,
  type PedidoFlete, type PedidoItem, type PedidoVendedor, type Precio, type Producto, redondear, type ReglaComision,
  type Venta, type VentaComision, type VentaItem,
} from '../../dominio/modelo';
import { type Celda, deSerie, type Fila, type ValorCelda } from './celdas';

// Nombre de cada hoja y cantidad de columnas que lee la app (la fila 1 es el encabezado).
export const HOJAS = {
  depositos: ['Depósitos', 3],
  productos: ['Productos', 4],
  contactos: ['Contactos', 10],
  tipos: ['Tipos de cliente', 1],
  vendedores: ['Vendedores', 3],
  precios: ['Precios', 4],
  reglas: ['Reglas de comisión', 4],
  compras: ['Compras', 12],
  pedidos: ['Pedidos', 9],
  pedidosItems: ['Pedidos ítems', 7],
  pedidosEstados: ['Pedidos estados', 3],
  pedidosVendedores: ['Pedidos vendedores', 2],
  ventas: ['Ventas', 5],
  ventasItems: ['Ventas ítems', 9],
  ventasComisiones: ['Ventas comisiones', 7],
  fletes: ['Fletes', 9],
  fletesItems: ['Fletes ítems', 4],
  fletesEstados: ['Fletes estados', 3],
  pedidosFletes: ['Pedidos fletes', 3],
  ajustes: ['Ajustes', 6],
} as const satisfies Record<string, readonly [string, number]>;

export type ClaveHoja = keyof typeof HOJAS;
export const CLAVES = Object.keys(HOJAS) as ClaveHoja[];
export const nombreHoja = (k: ClaveHoja) => HOJAS[k][0];

const columna = (n: number) => String.fromCharCode(64 + n);
export const rango = (k: ClaveHoja) => `'${HOJAS[k][0]}'!A2:${columna(HOJAS[k][1])}`;


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
    vendedores: de('vendedores', 0, (f) => ({ id: txt(f[0]), nombre: txt(f[1]) || txt(f[0]), activo: txt(f[2]) === '' || bool(f[2]) })),
    precios: de('precios', 0, (f) => ({ productoId: txt(f[0]), producto: txt(f[1]), precio: num(f[2]) ?? 0, desde: fecha(f[3]) }))
      .filter((p) => p.precio > 0),
    reglas: de('reglas', 0, (f) => ({ vendedorId: txt(f[0]), productoId: txt(f[1]), porcentaje: num(f[2]) ?? 0, desde: fecha(f[3]) })),
    compras: de('compras', 4, (f, fila) => ({
      fila, fecha: fecha(f[0]), depositoId: txt(f[1]), proveedor: txt(f[2]), contactoId: txt(f[3]), productoId: txt(f[4]),
      producto: txt(f[5]), cantidad: num(f[6]) ?? 0, precio: num(f[7]), importe: num(f[8]), remito: txt(f[9]),
      pedidoId: txt(f[10]), nota: txt(f[11]),
    })),
    pedidos: de('pedidos', 0, (f) => ({
      id: txt(f[0]), fecha: fecha(f[1]), contactoId: txt(f[2]), cliente: txt(f[3]), tipo: txt(f[4]), localidad: txt(f[5]),
      provincia: txt(f[6]), depositoId: txt(f[7]), nota: txt(f[8]),
    })),
    pedidosItems: de('pedidosItems', 0, (f) => ({
      pedidoId: txt(f[0]), linea: num(f[1]) ?? 0, productoId: txt(f[2]), producto: txt(f[3]), cantidad: num(f[4]) ?? 0,
      precioLista: num(f[5]), precio: num(f[6]) ?? 0,
    })),
    pedidosEstados: estados('pedidosEstados'),
    pedidosVendedores: de('pedidosVendedores', 0, (f) => ({ pedidoId: txt(f[0]), vendedorId: txt(f[1]) })),
    ventas: de('ventas', 0, (f) => ({ id: txt(f[0]), fecha: fecha(f[1]), pedidoId: txt(f[2]), depositoId: txt(f[3]), nota: txt(f[4]) })),
    ventasItems: de('ventasItems', 0, (f) => ({
      ventaId: txt(f[0]), linea: num(f[1]) ?? 0, pedidoLinea: num(f[2]) ?? 0, productoId: txt(f[3]), producto: txt(f[4]),
      cantidad: num(f[5]) ?? 0, precio: num(f[6]) ?? 0, importe: num(f[7]) ?? 0, costo: num(f[8]),
    })),
    ventasComisiones: de('ventasComisiones', 0, (f) => ({
      ventaId: txt(f[0]), linea: num(f[1]) ?? 0, vendedorId: txt(f[2]), vendedor: txt(f[3]), porcentajeRegla: num(f[4]),
      porcentaje: num(f[5]) ?? 0, monto: num(f[6]) ?? 0,
    })),
    fletes: de('fletes', 0, (f) => ({
      id: txt(f[0]), fecha: fecha(f[1]), transporte: txt(f[2]), contactoId: txt(f[3]), origenId: txt(f[4]),
      destinoId: txt(f[5]), costo: num(f[6]), guia: txt(f[7]), nota: txt(f[8]),
    })),
    fletesItems: de('fletesItems', 0, (f) => ({ fleteId: txt(f[0]), productoId: txt(f[1]), producto: txt(f[2]), cantidad: num(f[3]) ?? 0 })),
    fletesEstados: estados('fletesEstados'),
    pedidosFletes: de('pedidosFletes', 0, (f) => ({ pedidoId: txt(f[0]), fleteId: txt(f[1]), costoAsignado: num(f[2]) })),
    ajustes: de('ajustes', 2, (f) => ({
      fecha: fecha(f[0]), depositoId: txt(f[1]), productoId: txt(f[2]), producto: txt(f[3]), cantidad: num(f[4]) ?? 0, motivo: txt(f[5]),
    })),
  };
}

// ---------- Filas a escribir (mismo orden de columnas que cada hoja) ----------

const vacio = (v: number | null | undefined) => v ?? '';

export const filas = {
  producto: (p: Producto): ValorCelda[] => [p.id, p.producto, p.unidad, vacio(p.minimo)],
  contacto: (c: ContactoNuevo): ValorCelda[] => [
    c.id, c.rol, c.nombre, c.tipo, c.telefono, c.direccion, c.email, c.localidad, c.provincia, c.observaciones,
  ],
  precio: (p: Precio): ValorCelda[] => [p.productoId, p.producto, p.precio, p.desde],
  regla: (r: ReglaComision): ValorCelda[] => [r.vendedorId, r.productoId, r.porcentaje, r.desde],
  compra: (c: Omit<Compra, 'fila' | 'importe'>): ValorCelda[] => [
    c.fecha, c.depositoId, c.proveedor, c.contactoId, c.productoId, c.producto, c.cantidad, vacio(c.precio),
    c.precio === null ? '' : redondear(c.cantidad * c.precio), c.remito, c.pedidoId, c.nota,
  ],
  pedido: (p: Pedido): ValorCelda[] => [p.id, p.fecha, p.contactoId, p.cliente, p.tipo, p.localidad, p.provincia, p.depositoId, p.nota],
  pedidoItem: (i: PedidoItem): ValorCelda[] => [i.pedidoId, i.linea, i.productoId, i.producto, i.cantidad, vacio(i.precioLista), i.precio],
  estado: (ref: string, estado: string, momento: Date): ValorCelda[] => [ref, { momento }, estado],
  pedidoVendedor: (p: PedidoVendedor): ValorCelda[] => [p.pedidoId, p.vendedorId],
  venta: (v: Venta): ValorCelda[] => [v.id, v.fecha, v.pedidoId, v.depositoId, v.nota],
  ventaItem: (i: VentaItem): ValorCelda[] => [i.ventaId, i.linea, i.pedidoLinea, i.productoId, i.producto, i.cantidad, i.precio, i.importe, vacio(i.costo)],
  ventaComision: (c: VentaComision): ValorCelda[] => [c.ventaId, c.linea, c.vendedorId, c.vendedor, vacio(c.porcentajeRegla), c.porcentaje, c.monto],
  flete: (f: Flete): ValorCelda[] => [f.id, f.fecha, f.transporte, f.contactoId, f.origenId, f.destinoId, vacio(f.costo), f.guia, f.nota],
  fleteItem: (i: FleteItem): ValorCelda[] => [i.fleteId, i.productoId, i.producto, i.cantidad],
  pedidoFlete: (p: PedidoFlete): ValorCelda[] => [p.pedidoId, p.fleteId, vacio(p.costoAsignado)],
  ajuste: (a: Ajuste): ValorCelda[] => [a.fecha, a.depositoId, a.productoId, a.producto, a.cantidad, a.motivo],
};

// Filas por hoja que se escriben juntas en una operación.
export type Escritura = Partial<Record<ClaveHoja, ValorCelda[][]>>;

// Une varias escrituras en una.
export function unir(...escrituras: Escritura[]): Escritura {
  const res: Escritura = {};
  for (const e of escrituras) {
    for (const k of Object.keys(e) as ClaveHoja[]) res[k] = [...(res[k] ?? []), ...(e[k] ?? [])];
  }
  return res;
}
