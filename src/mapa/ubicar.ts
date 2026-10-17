// Ubica localidades en el mapa de Argentina y arma lo que se dibuja: sitios (lugares con depósitos y pedidos)
// y tramos (fletes entre sitios). Sin dependencias del navegador: se prueba con Vitest.
// Los datos de `argentina.json` los genera herramientas/mapa_argentina.py. Ver spec/mapa.md.

import type { Lugar, MarcasMapa } from '../dominio/mapa';
import type * as M from '../dominio/modelo';
import argentina from './argentina.json';

export interface Punto { x: number; y: number }

// [nombre, índice de provincia, x, y, rango]
type Localidad = [string, number, number, number, number];

export const MAPA = {
  ancho: argentina.ancho,
  alto: argentina.alto,
  provincias: argentina.provincias,
};

export const normal = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

const CABA = 'ciudad autonoma de buenos aires';
const ALIAS_LOCALIDAD: Record<string, string> = {
  'caba': CABA, 'capital federal': CABA, 'capital': CABA, 'ciudad de buenos aires': CABA, 'buenos aires': CABA,
};
const ALIAS_PROVINCIA: Record<string, string> = {
  'caba': CABA, 'capital federal': CABA, 'bs as': 'buenos aires', 'pcia de buenos aires': 'buenos aires',
  'tierra del fuego': 'tierra del fuego antartida e islas del atlantico sur',
};

const provincias = argentina.provincias.map((p) => normal(p.nombre));
const porNombre = new Map<string, Localidad[]>();
for (const l of argentina.localidades as Localidad[]) {
  const n = normal(l[0]);
  porNombre.set(n, [...(porNombre.get(n) ?? []), l]);
}

// La localidad de un depósito puede traer la provincia: "Rosario, Santa Fe".
function separar(lugar: Lugar) {
  const [loc = '', ...resto] = lugar.localidad.split(',');
  return { localidad: loc, provincia: lugar.provincia || resto.join(' ') };
}

// Punto de una localidad. Si el nombre está en varias provincias se usa la provincia del lugar o, si no la
// tiene o no coincide, la de mayor rango (cabecera de departamento o parte de un aglomerado).
export function ubicar(lugar: Lugar): Punto | null {
  const s = separar(lugar);
  const loc = normal(s.localidad);
  const candidatos = porNombre.get(loc) ?? porNombre.get(ALIAS_LOCALIDAD[loc] ?? '') ?? [];
  if (candidatos.length === 0) return null;
  const prov = normal(s.provincia);
  const buscada = ALIAS_PROVINCIA[prov] ?? prov;
  const enProvincia = buscada === '' ? [] : candidatos.filter((l) => provincias[l[1]] === buscada);
  const lista = enProvincia.length > 0 ? enProvincia : candidatos;
  const mejor = lista.reduce((a, b) => (b[4] > a[4] ? b : a));
  return { x: mejor[2], y: mejor[3] };
}

export interface Sitio extends Punto {
  clave: string;
  nombre: string; // localidades del sitio, separadas por " · "
  depositos: M.Deposito[];
  pedidos: M.ResumenPedido[];
}

export interface Tramo {
  clave: string;
  desde: Sitio;
  hasta: Sitio;
  fletes: { flete: M.Flete; estado: M.EstadoFlete }[];
}

// Lo que no se pudo ubicar, para avisar debajo del mapa.
export type SinUbicar =
  | { tipo: 'deposito'; deposito: M.Deposito }
  | { tipo: 'pedido'; resumen: M.ResumenPedido }
  | { tipo: 'flete'; flete: M.Flete };

export interface Mapa { sitios: Sitio[]; tramos: Tramo[]; sinUbicar: SinUbicar[] }

// Los lugares a menos de `radio` unidades del mapa se juntan en un solo sitio (Rosario y Funes, por ejemplo),
// para que sus marcas no se tapen. El sitio queda en el primer lugar que se agregó: los depósitos van primero.
export function armarMapa(marcas: MarcasMapa, radio: number, ubicador: (l: Lugar) => Punto | null = ubicar): Mapa {
  const sitios: Sitio[] = [];
  const sinUbicar: SinUbicar[] = [];
  const sitioDe = (lugar: Lugar | null): Sitio | null => {
    const p = lugar && ubicador(lugar);
    if (!lugar || !p) return null;
    let s = sitios.find((x) => Math.hypot(x.x - p.x, x.y - p.y) <= radio);
    if (!s) {
      s = { clave: `s${sitios.length}`, x: p.x, y: p.y, nombre: '', depositos: [], pedidos: [] };
      sitios.push(s);
    }
    const nombre = separar(lugar).localidad.trim();
    const nombres = s.nombre === '' ? [] : s.nombre.split(' · ');
    if (!nombres.some((n) => normal(n) === normal(nombre))) s.nombre = [...nombres, nombre].join(' · ');
    return s;
  };

  for (const { deposito, lugar } of marcas.depositos) {
    const s = sitioDe(lugar);
    if (s) s.depositos.push(deposito);
    else sinUbicar.push({ tipo: 'deposito', deposito });
  }
  for (const { resumen, lugar } of marcas.pedidos) {
    const s = sitioDe(lugar);
    if (s) s.pedidos.push(resumen);
    else sinUbicar.push({ tipo: 'pedido', resumen });
  }

  const tramos = new Map<string, Tramo>();
  for (const { flete, estado, origen, destinos } of marcas.fletes) {
    const desde = sitioDe(origen);
    const hastas = destinos.map(sitioDe).filter((s): s is Sitio => s !== null && s !== desde);
    if (!desde || hastas.length === 0) {
      sinUbicar.push({ tipo: 'flete', flete });
      continue;
    }
    for (const hasta of hastas) {
      const clave = `${desde.clave}>${hasta.clave}`;
      const t = tramos.get(clave) ?? { clave, desde, hasta, fletes: [] };
      t.fletes.push({ flete, estado });
      tramos.set(clave, t);
    }
  }

  return { sitios, tramos: [...tramos.values()], sinUbicar };
}

// Curva de un tramo: se arquea hacia un costado para que la ida y la vuelta entre dos sitios no se pisen.
export function curva(a: Punto, b: Punto) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const c = { x: (a.x + b.x) / 2 - dy * 0.2, y: (a.y + b.y) / 2 + dx * 0.2 };
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    d: `M${r(a.x)} ${r(a.y)}Q${r(c.x)} ${r(c.y)} ${r(b.x)} ${r(b.y)}`,
    // Punto medio de la curva (t = 0,5), donde va el botón del tramo.
    medio: { x: (a.x + 2 * c.x + b.x) / 4, y: (a.y + 2 * c.y + b.y) / 4 },
  };
}
