import { createContext, use, useState } from 'react';
import { mensajeDeError } from './formato';
import type { InfoBase, Operaciones } from './db/puerto';
import type * as M from './dominio/modelo';

export interface Base {
  info: InfoBase;
  datos: M.Datos;
  stock: M.Stock;
  costos: Map<string, number>;
  pedidos: M.ResumenPedido[];
  estadosFletes: Map<string, string>;
  cargando: boolean;
  buscarProducto: (nombre: string) => M.Producto | undefined;
  buscarContacto: (rol: M.Rol, nombre: string) => M.Contacto | undefined;
  // Las filas guardan IDs: los nombres salen de la hoja de cada cosa.
  nombres: M.Nombres;
  // Cómo se nombra en pantalla un pedido, una venta o un flete (los IDs no se muestran): "Ana · 10/10/26".
  etiquetas: Etiquetas;
  contacto: (id: string) => M.Contacto | undefined;
  // Operaciones de escritura de la base (cada una atómica).
  db: Operaciones;
  recargar: () => Promise<void>;
}

export interface Etiquetas {
  pedido: (id: string) => string; // cliente y fecha del pedido
  venta: (id: string) => string; // cliente del pedido y fecha de la entrega
  flete: (id: string) => string; // transportista y fecha del flete
}

export const BaseContext = createContext<Base | null>(null);

export function useBase() {
  const base = use(BaseContext);
  if (!base) throw new Error('useBase fuera de BaseProvider');
  return base;
}

export const normalizar = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Envuelve un guardado: marca el botón como ocupado, muestra el resultado y vuelve a leer la planilla.
export function useGuardar() {
  const { recargar } = useBase();
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ texto: string; error: boolean } | null>(null);

  async function ejecutar(fn: () => Promise<string>) {
    setGuardando(true);
    setMsg(null);
    try {
      const ok = await fn();
      setMsg({ texto: ok, error: false });
      // Si falla la relectura, el error ya queda en la barra de estado.
      await recargar().catch(() => undefined);
    } catch (err) {
      setMsg({ texto: `No se guardó: ${mensajeDeError(err)}`, error: true });
    } finally {
      setGuardando(false);
    }
  }

  // `ejecutar` atrapa todos sus errores, así que se puede lanzar sin esperarla.
  const guardar = (fn: () => Promise<string>) => { void ejecutar(fn); };
  const error = (texto: string) => { setMsg({ texto, error: true }); };
  return { guardando, msg, guardar, error };
}
