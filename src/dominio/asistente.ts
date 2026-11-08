// Herramientas de solo lectura del asistente: el modelo de lenguaje las llama para responder con datos de la planilla.
// Devuelven JSON con nombres (nunca IDs) y listas cortas, porque todo entra en el contexto del modelo.
// Ver spec/asistente.md.
import { analizarProductos, clientesInactivos, inicioPeriodo, type Periodo } from './analisis';
import * as M from './modelo';

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type Args = Record<string, unknown>;

interface Parametro { type: 'string' | 'integer'; description: string; enum?: string[] }

export interface Herramienta {
  name: string;
  description: string;
  parameters: { type: 'object'; properties: Record<string, Parametro>; required?: string[] };
  ejecutar: (datos: M.Datos, args: Args, hoy: Date) => Json;
}

const MAXIMO = 20; // filas por respuesta

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
// Filtro por nombre: vacío deja pasar todo; si no, busca el texto dentro del nombre, sin tildes ni mayúsculas.
const coincide = (nombre: string, filtro: unknown) =>
  typeof filtro !== 'string' || filtro.trim() === '' || sinTildes(nombre).includes(sinTildes(filtro));
const fecha = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);
const recortar = (filas: Json[]): Json =>
  filas.length > MAXIMO ? { filas: filas.slice(0, MAXIMO), mostradas: MAXIMO, total: filas.length } : filas;

const PERIODOS: Periodo[] = ['3', '6', '12', 'todo'];

export const HERRAMIENTAS: Herramienta[] = [
  {
    name: 'consultar_stock',
    description: 'Stock de los productos: en cada depósito, en camino, comprometido en pedidos abiertos, y si está bajo el mínimo.',
    parameters: { type: 'object', properties: { producto: { type: 'string', description: 'Parte del nombre del producto. Vacío: todos.' } } },
    ejecutar(datos, { producto }) {
      const stock = M.calcularStock(datos);
      const deposito = M.nombres(datos).deposito;
      const porDeposito = (fila: M.PorDeposito | undefined) =>
        Object.fromEntries(Object.entries(fila ?? {}).filter(([, n]) => n !== 0).map(([d, n]) => [deposito(d), n]));
      return recortar(datos.productos.filter((p) => coincide(p.producto, producto)).map((p) => {
        const total = M.sumaDeps(stock.enDeposito.get(p.id));
        return {
          producto: p.producto, unidad: p.unidad, total, porDeposito: porDeposito(stock.enDeposito.get(p.id)),
          enCamino: M.sumaDeps(stock.enTransito.get(p.id)), comprometido: M.sumaDeps(stock.comprometido.get(p.id)),
          minimo: p.minimo, bajoMinimo: p.minimo !== null && total < p.minimo,
        };
      }));
    },
  },
  {
    name: 'pedidos_abiertos',
    description: 'Pedidos pendientes o entregados en parte, con lo que falta entregar de cada producto.',
    parameters: { type: 'object', properties: { cliente: { type: 'string', description: 'Parte del nombre del cliente. Vacío: todos.' } } },
    ejecutar(datos, { cliente }) {
      const n = M.nombres(datos);
      return recortar(M.resumirPedidos(datos)
        .filter((r) => M.pedidoAbierto(r.estado) && coincide(n.contacto(r.pedido.contactoId), cliente))
        .map((r) => ({
          cliente: n.contacto(r.pedido.contactoId), fecha: fecha(r.pedido.fecha), estado: M.NOMBRE_ESTADO_PEDIDO[r.estado],
          deposito: n.deposito(r.pedido.depositoId), importe: r.importePedido,
          pendiente: r.lineas.filter((l) => l.pendiente > 0).map((l) => ({ producto: n.producto(l.productoId), cantidad: l.pendiente })),
        })));
    },
  },
  {
    name: 'ventas_a_cobrar',
    description: 'Ventas (entregas) con saldo sin cobrar, y el total a cobrar.',
    parameters: { type: 'object', properties: { cliente: { type: 'string', description: 'Parte del nombre del cliente. Vacío: todos.' } } },
    ejecutar(datos, { cliente }) {
      const n = M.nombres(datos);
      const filas = M.ventasACobrar(datos)
        .map((c) => ({ cliente: n.contacto(c.pedido?.contactoId ?? ''), fecha: fecha(c.venta.fecha), importe: c.importe, cobrado: c.cobrado, saldo: c.saldo }))
        .filter((f) => coincide(f.cliente, cliente));
      return { total: M.redondear(filas.reduce((s, f) => s + f.saldo, 0)), ventas: recortar(filas) };
    },
  },
  {
    name: 'ventas_por_mes',
    description: 'Importe vendido, comisiones y ganancia de cada mes, del más reciente al más viejo.',
    parameters: { type: 'object', properties: { meses: { type: 'integer', description: 'Cuántos meses (por defecto 6).' } } },
    ejecutar(datos, { meses }) {
      const cuantos = typeof meses === 'number' && meses > 0 ? Math.min(meses, 24) : 6;
      return M.ventasPorMes(M.lineasVendidas(datos)).reverse().slice(0, cuantos)
        .map((m) => ({ mes: m.mes, importe: M.redondear(m.importe), comision: M.redondear(m.comision), ganancia: M.redondear(m.ganancia) }));
    },
  },
  {
    name: 'productos_mas_vendidos',
    description: 'Productos ordenados por importe vendido en un período, con cantidad, ganancia y margen.',
    parameters: {
      type: 'object',
      properties: { periodo: { type: 'string', enum: PERIODOS, description: 'Últimos 3, 6 o 12 meses, o todo. Por defecto 3.' } },
    },
    ejecutar(datos, { periodo }, hoy) {
      const p = PERIODOS.find((x) => x === periodo) ?? '3';
      return recortar(analizarProductos(datos, inicioPeriodo(p, hoy)).sort((a, b) => b.importe - a.importe).map((a) => ({
        producto: a.producto, unidad: a.unidad, cantidad: a.cantidad, importe: a.importe, ganancia: a.ganancia,
        margen: a.margen === null ? null : `${Math.round(a.margen * 100)} %`,
      })));
    },
  },
  {
    name: 'clientes_inactivos',
    description: 'Clientes que compraban seguido y dejaron de comprar, con los días sin comprar.',
    parameters: { type: 'object', properties: {} },
    ejecutar(datos, _args, hoy) {
      return recortar(clientesInactivos(datos, hoy).map((c) => ({
        cliente: c.cliente, ultimoPedido: fecha(c.ultimoPedido), diasSinComprar: c.diasSinComprar,
        cadaCuantosDias: c.intervalo, importeHistorico: c.importeHistorico,
      })));
    },
  },
  {
    name: 'precios',
    description: 'Precio de lista y costo vigentes hoy de los productos.',
    parameters: { type: 'object', properties: { producto: { type: 'string', description: 'Parte del nombre del producto. Vacío: todos.' } } },
    ejecutar(datos, { producto }, hoy) {
      const costos = M.costosVigentes(datos.costos, hoy);
      return recortar(datos.productos.filter((p) => coincide(p.producto, producto)).map((p) => ({
        producto: p.producto, unidad: p.unidad, precio: M.precioVigente(datos.precios, p.id, hoy), costo: costos.get(p.id) ?? null,
      })));
    },
  },
];
