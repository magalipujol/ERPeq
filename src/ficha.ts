import { createContext, use } from 'react';
import type { RefFicha } from './dominio/fichas';

// Abre la ficha de algo (pedido, venta, producto…) en el modal. Desde una ficha abierta, la nueva se apila y
// "Volver" regresa a la anterior.
export interface Ficha { abrir: (ref: RefFicha) => void }

export const FichaContext = createContext<Ficha | null>(null);

export function useFicha() {
  const ficha = use(FichaContext);
  if (!ficha) throw new Error('useFicha fuera de FichaProvider');
  return ficha;
}

// Props de una fila de tabla que abre su ficha al tocarla. Los botones, vínculos y campos de la fila siguen
// haciendo lo suyo, y seleccionar texto no la abre.
export function useFila() {
  const { abrir } = useFicha();
  return (ref: RefFicha) => ({
    className: 'fila-ficha',
    onClick: (e: React.MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea, label')) return;
      if (window.getSelection()?.toString()) return;
      abrir(ref);
    },
  });
}
