import { unicos } from './formato';
import { claveMes } from './dominio/modelo';

// Meses para elegir. Por defecto: el mes actual si tiene movimientos; si no, el último mes con datos.
export function mesesDisponibles(fechas: (Date | null)[]) {
  const conDatos = unicos(fechas.filter((f): f is Date => f !== null).map(claveMes)).reverse();
  const hoy = claveMes(new Date());
  const meses = conDatos.includes(hoy) ? conDatos : [hoy, ...conDatos];
  const porDefecto = conDatos.includes(hoy) || conDatos.length === 0 ? hoy : conDatos[0];
  return { meses, porDefecto };
}

// Mes efectivo (el elegido, si sigue existiendo, o el de por defecto).
export function mesElegido(fechas: (Date | null)[], value: string | null) {
  const { meses, porDefecto } = mesesDisponibles(fechas);
  return value !== null && meses.includes(value) ? value : porDefecto;
}
