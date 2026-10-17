import { useMemo } from 'react';
import { type Base, BaseContext, normalizar } from './base';
import * as M from './dominio/modelo';

export function BaseProvider({ db, info, datos, cargando, recargar, children }:
  Pick<Base, 'db' | 'info' | 'datos' | 'cargando' | 'recargar'> & { children: React.ReactNode }) {
  const base = useMemo<Base>(() => {
    const pedidos = M.resumirPedidos(datos);
    const porNombre = new Map(datos.productos.map((p) => [normalizar(p.producto), p]));
    const contactos = new Map(datos.contactos.map((c) => [`${c.rol}|${normalizar(c.nombre)}`, c]));
    const porId = new Map(datos.contactos.map((c) => [c.id, c]));
    return {
      db, info, datos, cargando, recargar, pedidos,
      stock: M.calcularStock(datos, pedidos),
      costos: M.costosPromedio(datos.compras),
      estadosFletes: M.estadosActuales(datos.fletesEstados),
      buscarProducto: (nombre) => porNombre.get(normalizar(nombre)),
      buscarContacto: (rol, nombre) => contactos.get(`${rol}|${normalizar(nombre)}`),
      nombres: M.nombres(datos),
      contacto: (id) => porId.get(id),
    };
  }, [db, info, datos, cargando, recargar]);
  return <BaseContext value={base}>{children}</BaseContext>;
}
