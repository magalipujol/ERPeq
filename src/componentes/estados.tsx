import { Badge } from '@mantine/core';
import { useBase } from '../base';
import * as M from '../dominio/modelo';

const COLOR_PEDIDO: Record<M.EstadoPedido, string> = {
  pendiente: 'yellow', parcial: 'blue', entregado: 'green', cancelado: 'gray', cerrado: 'gray',
};

export function EstadoPedido({ estado }: { estado: M.EstadoPedido }) {
  return <Badge variant="light" size="sm" color={COLOR_PEDIDO[estado]}>{M.NOMBRE_ESTADO_PEDIDO[estado]}</Badge>;
}

const COLOR_FLETE: Record<M.EstadoFlete, string> = { preparacion: 'yellow', camino: 'blue', finalizado: 'green', cancelado: 'gray' };

export function EstadoFlete({ estado }: { estado: M.EstadoFlete }) {
  return <Badge variant="light" size="sm" color={COLOR_FLETE[estado]}>{M.NOMBRE_ESTADO_FLETE[estado]}</Badge>;
}

const nombreLugar = (deposito: (id: string) => string, id: string, afuera: string) => (id ? deposito(id) : afuera);

export function Recorrido({ flete }: { flete: M.Flete }) {
  const { nombres } = useBase();
  return <>{nombreLugar(nombres.deposito, flete.origenId, 'Proveedor')} → {nombreLugar(nombres.deposito, flete.destinoId, 'Cliente')}</>;
}
