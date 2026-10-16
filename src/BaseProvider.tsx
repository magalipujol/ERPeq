import { useMemo } from 'react';
import { type Base, BaseContext, DEPS } from './base';
import * as M from './modelo';

export function BaseProvider({ info, datos, cargando, recargar, children }:
  Pick<Base, 'info' | 'datos' | 'cargando' | 'recargar'> & { children: React.ReactNode }) {
  const base = useMemo<Base>(() => {
    const stock = M.stockPorProducto(datos, DEPS);
    const porNombre = new Map(datos.productos.map((p) => [p.producto.toLowerCase(), p]));
    return {
      info, datos, stock, cargando, recargar,
      costos: M.costosPromedio(datos.compras),
      buscarProducto: (nombre) => porNombre.get(nombre.trim().toLowerCase().replace(/\s+/g, ' ')),
      stockTotal: (id) => DEPS.reduce((s, d) => s + (stock.get(id)?.[d] ?? 0), 0),
    };
  }, [info, datos, cargando, recargar]);
  return <BaseContext value={base}>{children}</BaseContext>;
}
