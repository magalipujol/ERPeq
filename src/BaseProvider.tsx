import { useMemo } from 'react';
import { type Base, BaseContext, normalizar } from './base';
import * as DB from './google';
import * as M from './modelo';

export function BaseProvider({ info, datos, cargando, recargar, children }:
  Pick<Base, 'info' | 'datos' | 'cargando' | 'recargar'> & { children: React.ReactNode }) {
  const base = useMemo<Base>(() => {
    const pedidos = M.resumirPedidos(datos);
    const porNombre = new Map(datos.productos.map((p) => [normalizar(p.producto), p]));
    const contactos = new Map(datos.contactos.map((c) => [`${c.rol}|${normalizar(c.nombre)}`, c]));
    const depositos = new Map(datos.depositos.map((d) => [d.id, d.nombre]));
    const vendedores = new Map(datos.vendedores.map((v) => [v.id, v.nombre]));
    return {
      info, datos, cargando, recargar, pedidos,
      stock: M.calcularStock(datos, pedidos),
      costos: M.costosPromedio(datos.compras),
      estadosFletes: M.estadosActuales(datos.fletesEstados),
      buscarProducto: (nombre) => porNombre.get(normalizar(nombre)),
      buscarContacto: (rol, nombre) => contactos.get(`${rol}|${normalizar(nombre)}`),
      nombreDeposito: (id) => depositos.get(id) ?? id,
      nombreVendedor: (id) => vendedores.get(id) ?? id,
      escribir: async (escritura) => DB.escribir(info, escritura),
    };
  }, [info, datos, cargando, recargar]);
  return <BaseContext value={base}>{children}</BaseContext>;
}
