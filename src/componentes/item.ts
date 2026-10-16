export interface Item { clave: number; producto: string; cantidad: number | string; precio: number | string; unidad: string }

let siguienteClave = 0;
export const itemVacio = (): Item => ({ clave: siguienteClave++, producto: '', cantidad: '', precio: '', unidad: 'kg' });
