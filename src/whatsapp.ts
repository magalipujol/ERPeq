// Mensaje de texto con pedidos para mandar a un grupo de WhatsApp. Sin dependencias del navegador.
import { fmtFecha, fmtNum } from './formato';
import * as M from './dominio/modelo';

export type CriterioMensaje = 'abiertos' | 'hoy' | 'semana';

export const NOMBRE_CRITERIO: Record<CriterioMensaje, string> = {
  abiertos: 'Pedidos abiertos', hoy: 'Pedidos de hoy', semana: 'Pedidos de los últimos 7 días',
};

const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Abiertos: pendientes o parciales, de cualquier fecha. Hoy y últimos 7 días (hoy incluido): por fecha del
// pedido, sin los cancelados. Más reciente primero.
export function pedidosParaMensaje(pedidos: M.ResumenPedido[], criterio: CriterioMensaje, hoy: Date) {
  const desde = inicioDelDia(hoy);
  if (criterio === 'semana') desde.setDate(desde.getDate() - 6);
  return pedidos
    .filter((r) => criterio === 'abiertos'
      ? M.pedidoAbierto(r.estado)
      : r.estado !== 'cancelado' && r.pedido.fecha !== null && r.pedido.fecha >= desde)
    .sort((a, b) => (b.pedido.fecha?.getTime() ?? 0) - (a.pedido.fecha?.getTime() ?? 0));
}

export interface Nombres extends M.Nombres {
  unidad: (productoId: string) => string;
  lugar: (contactoId: string) => string; // localidad y provincia del cliente
}

function linea(l: M.LineaPedido, n: Nombres) {
  const cantidad = [fmtNum(l.cantidad), n.unidad(l.productoId)].filter(Boolean).join(' ');
  const detalle = l.entregado <= 0 ? ''
    : l.pendiente > 0 ? ` (entregado ${fmtNum(l.entregado)}, faltan ${fmtNum(l.pendiente)})`
      : ' (entregado)';
  return `• ${cantidad} ${n.producto(l.productoId)}${detalle}`;
}

function bloque(r: M.ResumenPedido, n: Nombres) {
  const { pedido } = r;
  const lugar = n.lugar(pedido.contactoId);
  const res = [
    `*${n.contacto(pedido.contactoId)}* · ${pedido.id} · ${fmtFecha(pedido.fecha)}`,
    [lugar, `desde ${n.deposito(pedido.depositoId)}`].filter(Boolean).join(' · '),
    `Estado: ${M.NOMBRE_ESTADO_PEDIDO[r.estado]}`,
  ];
  if (r.vendedores.length > 0) res.push(`Vendedores: ${r.vendedores.map(n.vendedor).join(', ')}`);
  res.push(...r.lineas.map((l) => linea(l, n)));
  if (pedido.nota) res.push(`_${pedido.nota}_`);
  return res.join('\n');
}

// Formato de WhatsApp: *negrita* y _cursiva_. No incluye importes.
export function mensajePedidos(pedidos: M.ResumenPedido[], criterio: CriterioMensaje, hoy: Date, n: Nombres) {
  const titulo = `*${NOMBRE_CRITERIO[criterio]}* (${fmtFecha(hoy)})`;
  if (pedidos.length === 0) return `${titulo}\nNo hay pedidos.`;
  const cuantos = `${pedidos.length} pedido${pedidos.length > 1 ? 's' : ''}`;
  return [`${titulo}\n${cuantos}`, ...pedidos.map((r) => bloque(r, n))].join('\n\n');
}

export const enlaceWhatsApp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
