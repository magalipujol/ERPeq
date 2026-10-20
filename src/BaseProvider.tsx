import { useMemo } from 'react';
import { type Base, BaseContext, normalizar } from './base';
import * as M from './dominio/modelo';
import { fmtFecha } from './formato';

export function BaseProvider({ db, info, datos, cargando, recargar, children }:
  Pick<Base, 'db' | 'info' | 'datos' | 'cargando' | 'recargar'> & { children: React.ReactNode }) {
  const base = useMemo<Base>(() => {
    const pedidos = M.resumirPedidos(datos);
    const porNombre = new Map(datos.productos.map((p) => [normalizar(p.producto), p]));
    const contactos = new Map(datos.contactos.map((c) => [`${c.rol}|${normalizar(c.nombre)}`, c]));
    const porId = new Map(datos.contactos.map((c) => [c.id, c]));
    const nombres = M.nombres(datos);
    const pedidoDe = new Map(datos.pedidos.map((p) => [p.id, p]));
    const ventaDe = new Map(datos.ventas.map((v) => [v.id, v]));
    const fleteDe = new Map(datos.fletes.map((f) => [f.id, f]));
    const etiqueta = (quien: string, fecha: Date | null) => `${quien} · ${fmtFecha(fecha)}`;
    const pedido = (id: string) => {
      const p = pedidoDe.get(id);
      return p ? etiqueta(nombres.contacto(p.contactoId), p.fecha) : '';
    };
    const venta = (id: string) => {
      const v = ventaDe.get(id);
      const p = v && pedidoDe.get(v.pedidoId);
      return v ? etiqueta(p ? nombres.contacto(p.contactoId) : '', v.fecha) : '';
    };
    const flete = (id: string) => {
      const f = fleteDe.get(id);
      return f ? etiqueta(nombres.contacto(f.contactoId), f.fecha) : '';
    };
    return {
      db, info, datos, cargando, recargar, pedidos,
      stock: M.calcularStock(datos, pedidos),
      costos: M.costosUltimaCompra(datos.compras),
      estadosFletes: M.estadosActuales(datos.fletesEstados),
      buscarProducto: (nombre) => porNombre.get(normalizar(nombre)),
      buscarContacto: (rol, nombre) => contactos.get(`${rol}|${normalizar(nombre)}`),
      nombres,
      etiquetas: { pedido, venta, flete },
      contacto: (id) => porId.get(id),
    };
  }, [db, info, datos, cargando, recargar]);
  return <BaseContext value={base}>{children}</BaseContext>;
}
