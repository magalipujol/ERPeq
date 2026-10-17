// Pedido escrito en texto libre (un mensaje de WhatsApp, por ejemplo): el prompt y el esquema que se le pasan a
// la IA del navegador, y el emparejamiento de lo que devuelve con los clientes y productos reales.
// No depende del navegador: se prueba con Vitest.

// Lo que devuelve la IA, ya validado.
export interface PedidoLeido {
  cliente: string;
  localidad: string;
  provincia: string;
  productos: { producto: string; cantidad: number | null }[];
}

// exacta: mismo nombre salvo mayúsculas, acentos, plurales o signos.
// aproximada: se parece a un solo nombre de la lista; hay que revisarlo.
// dudosa: se parece a varios por igual (están en `opciones`).
// ninguna: no se parece a nada de la lista.
export type TipoCoincidencia = 'exacta' | 'aproximada' | 'dudosa' | 'ninguna';
export interface Coincidencia { texto: string; valor: string | null; tipo: TipoCoincidencia; opciones: string[] }

export interface PedidoEmparejado {
  cliente: Coincidencia;
  localidad: Coincidencia;
  provincia: string;
  items: { producto: Coincidencia; cantidad: number | null }[];
}

// Máximo de nombres de cada lista que van en el prompt: la ventana de contexto del modelo es chica.
export const MAX_NOMBRES = 300;

export const ESQUEMA = {
  type: 'object',
  properties: {
    cliente: { type: 'string' },
    localidad: { type: 'string' },
    provincia: { type: 'string' },
    productos: {
      type: 'array',
      items: {
        type: 'object',
        properties: { producto: { type: 'string' }, cantidad: { type: 'number' } },
        required: ['producto', 'cantidad'],
        additionalProperties: false,
      },
    },
  },
  required: ['cliente', 'localidad', 'provincia', 'productos'],
  additionalProperties: false,
} as const;

export function instrucciones(ctx: { productos: string[]; clientes: string[] }): string {
  const lista = (nombres: string[]) => nombres.slice(0, MAX_NOMBRES).map((n) => `- ${n}`).join('\n') || '(ninguno)';
  return [
    'Sos un asistente que lee pedidos de clientes de una dietética escritos en mensajes (por ejemplo de WhatsApp)',
    'y los pasa a datos. Respondé solo con JSON con estos campos:',
    '- cliente: nombre del cliente o del negocio que pide. Si está en la lista de clientes, escribilo igual que en la lista. Si no se sabe, "".',
    '- localidad y provincia: adonde va el pedido, si el mensaje lo dice. Si no, "".',
    '- productos: cada producto pedido con su cantidad (número, en kg o unidades). Si el producto está en la lista de',
    '  productos, escribilo igual que en la lista; si no, como lo escribió el cliente. Si no dice la cantidad, 0.',
    'No inventes productos ni clientes que no estén en el mensaje.',
    '',
    'Productos:',
    lista(ctx.productos),
    '',
    'Clientes:',
    lista(ctx.clientes),
  ].join('\n');
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// Valida la respuesta de la IA. Devuelve null si no es el JSON esperado.
export function leerRespuesta(respuesta: string): PedidoLeido | null {
  let datos: unknown;
  try {
    datos = JSON.parse(respuesta);
  } catch {
    return null;
  }
  if (!esObjeto(datos) || !Array.isArray(datos.productos)) return null;
  const productos = datos.productos.filter(esObjeto)
    .map((p) => {
      const n = typeof p.cantidad === 'number' ? p.cantidad : Number(texto(p.cantidad).replace(',', '.'));
      return { producto: texto(p.producto), cantidad: Number.isFinite(n) && n > 0 ? n : null };
    })
    .filter((p) => p.producto !== '');
  return { cliente: texto(datos.cliente), localidad: texto(datos.localidad), provincia: texto(datos.provincia), productos };
}

const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'x', 'kg', 'kgs', 'kilo', 'kilos', 'unid', 'unidad', 'unidades']);

// Minúsculas, sin acentos ni signos, sin palabras vacías y en singular.
export function palabras(s: string): string[] {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ').trim().split(' ')
    .filter((p) => p !== '' && !VACIAS.has(p))
    .map((p) => (p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p));
}

function bigramas(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

// Coeficiente de Dice sobre pares de letras: 1 si son iguales, 0 si no comparten ningún par.
function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigramas(a);
  const bb = bigramas(b);
  let comunes = 0;
  for (const [k, n] of ba) comunes += Math.min(n, bb.get(k) ?? 0);
  return (2 * comunes) / (a.length - 1 + b.length - 1);
}

function parecidoPalabra(a: string, b: string): number {
  if (a === b) return 1;
  if (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.9;
  const d = dice(a, b);
  return d >= 0.6 ? d : 0;
}

// Parecido entre 0 y 1 y qué parte de las palabras del texto está en el nombre. Combina las palabras en común
// (que estén todas las del texto y todas las del nombre) con el parecido letra a letra, que tolera errores de
// tipeo.
function comparar(a: string, b: string): { puntaje: number; cobertura: number } {
  const pa = palabras(a);
  const pb = palabras(b);
  if (pa.length === 0 || pb.length === 0) return { puntaje: 0, cobertura: 0 };
  if (pa.join(' ') === pb.join(' ')) return { puntaje: 1, cobertura: 1 };
  const cubre = (xs: string[], ys: string[]) => xs.reduce((s, x) => s + Math.max(...ys.map((y) => parecidoPalabra(x, y))), 0) / xs.length;
  const cobertura = cubre(pa, pb);
  const precision = cubre(pb, pa);
  const f1 = cobertura + precision > 0 ? (2 * cobertura * precision) / (cobertura + precision) : 0;
  return { puntaje: Math.min(0.99, Math.max(f1, dice(pa.join(''), pb.join('')))), cobertura };
}

export const similitud = (a: string, b: string) => comparar(a, b).puntaje;

export const UMBRAL = 0.6;
// Si el segundo mejor queda a menos de esto del primero, no se elige ninguno.
const EMPATE = 0.05;

export function emparejar(textoLeido: string, candidatos: string[]): Coincidencia {
  const t = textoLeido.trim();
  const nada: Coincidencia = { texto: t, valor: null, tipo: 'ninguna', opciones: [] };
  if (!t) return nada;
  const comparados = [...new Set(candidatos)].map((c) => ({ c, ...comparar(t, c) }))
    .sort((a, b) => (b.puntaje !== a.puntaje ? b.puntaje - a.puntaje : a.c.localeCompare(b.c, 'es')));
  const mejor = comparados.at(0);
  if (mejor === undefined || mejor.puntaje < UMBRAL) return nada;
  if (mejor.puntaje === 1) return { texto: t, valor: mejor.c, tipo: 'exacta', opciones: [] };
  // "maní" con "Maní pelado" y "Maní con cáscara" en la lista: los dos contienen el texto entero.
  const contienen = comparados.filter((x) => x.cobertura >= 0.9).map((x) => x.c);
  const empatados = comparados.filter((x) => mejor.puntaje - x.puntaje < EMPATE).map((x) => x.c);
  const opciones = contienen.length > 1 ? contienen : empatados;
  if (opciones.length > 1) return { texto: t, valor: null, tipo: 'dudosa', opciones: opciones.toSorted((a, b) => a.localeCompare(b, 'es')) };
  return { texto: t, valor: mejor.c, tipo: 'aproximada', opciones: [] };
}

export function emparejarPedido(leido: PedidoLeido, ctx: { productos: string[]; clientes: string[]; localidades: string[] }): PedidoEmparejado {
  return {
    cliente: emparejar(leido.cliente, ctx.clientes),
    localidad: emparejar(leido.localidad, ctx.localidades),
    provincia: leido.provincia,
    items: leido.productos.map((p) => ({ producto: emparejar(p.producto, ctx.productos), cantidad: p.cantidad })),
  };
}

// Lo que se carga en el formulario: el nombre de la lista si coincidió; si no, lo que leyó la IA, para que la
// persona lo corrija.
export const valorACargar = (c: Coincidencia) => c.valor ?? c.texto;
