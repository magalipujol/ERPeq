// Tapa de un producto: un tono fijo y dos letras (ver `Tapa` en comunes.tsx).

// Tonos de las tapas: oscuros, para que el aro y la banda del frasco se distingan sobre blanco; las letras van en tinta.
const TONOS_TAPA = ['#8a5a2b', '#1f7a55', '#a8530a', '#6b4ba8', '#2f5da8', '#a8324a', '#3d6b1f', '#0f6e7a', '#7a4a6b', '#5e6420'];

// El tono sale del ID para que no cambie cuando se agregan productos o se corrige el nombre.
export const tonoTapa = (id: string) => TONOS_TAPA[Array.from(id, (c) => c.charCodeAt(0)).reduce((h, c) => (h * 31 + c) >>> 0, 7) % TONOS_TAPA.length];

// "Almendras" → "Al"; "Mix europeo" → "Me": inicial de las dos primeras palabras, o las dos primeras letras.
export function letrasTapa(nombre: string) {
  const [a = '', b = ''] = nombre.trim().split(/\s+/);
  return b ? (a.charAt(0).toUpperCase() + b.charAt(0).toLowerCase()) : (a.charAt(0).toUpperCase() + a.charAt(1).toLowerCase());
}
