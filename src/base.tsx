import { createContext, useContext, useMemo, useState } from 'react';
import { CONFIG } from './config';
import type { InfoPlanilla } from './google';
import * as M from './modelo';

export const DEPS = CONFIG.DEPOSITOS;

export interface Base {
  info: InfoPlanilla;
  datos: M.Datos;
  stock: Map<string, M.StockDeposito>;
  costos: Map<string, number>;
  cargando: boolean;
  buscarProducto: (nombre: string) => M.Producto | undefined;
  stockTotal: (id: string) => number;
  recargar: () => Promise<void>;
}

const Contexto = createContext<Base | null>(null);

export function useBase() {
  const base = useContext(Contexto);
  if (!base) throw new Error('useBase fuera de BaseProvider');
  return base;
}

export function BaseProvider({ info, datos, cargando, recargar, children }:
  Pick<Base, 'info' | 'datos' | 'cargando' | 'recargar'> & { children: React.ReactNode }) {
  const base = useMemo<Base>(() => {
    const stock = M.stockPorProducto(datos, DEPS);
    const porNombre = new Map(datos.productos.map((p) => [p.producto.toLowerCase(), p]));
    return {
      info, datos, stock, cargando, recargar,
      costos: M.costosPromedio(datos.compras),
      buscarProducto: (nombre) => porNombre.get(String(nombre).trim().toLowerCase().replace(/\s+/g, ' ')),
      stockTotal: (id) => DEPS.reduce((s, d) => s + (stock.get(id)?.[d] || 0), 0),
    };
  }, [info, datos, cargando, recargar]);
  return <Contexto.Provider value={base}>{children}</Contexto.Provider>;
}

// Envuelve un guardado: marca el botón como ocupado, muestra el resultado y vuelve a leer la planilla.
export function useGuardar() {
  const { recargar } = useBase();
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ texto: string; error: boolean } | null>(null);

  async function guardar(fn: () => Promise<string>) {
    setGuardando(true);
    setMsg(null);
    try {
      const ok = await fn();
      setMsg({ texto: ok, error: false });
      await recargar().catch(() => {});
    } catch (err) {
      setMsg({ texto: `No se guardó: ${(err as Error).message}`, error: true });
    } finally {
      setGuardando(false);
    }
  }

  const error = (texto: string) => setMsg({ texto, error: true });
  return { guardando, msg, guardar, error };
}
