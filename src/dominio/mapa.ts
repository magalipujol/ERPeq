// Qué se muestra en el mapa de Inicio: depósitos, pedidos abiertos y fletes en curso, cada uno con su lugar.
// Ubicar un lugar en el mapa (coordenadas) es de la UI: acá solo se dice qué localidad le corresponde.
// Ver spec/mapa.md.

import * as M from './modelo';

// Localidad y provincia tal como están en la planilla. La provincia puede faltar (los depósitos no la tienen).
export interface Lugar { localidad: string; provincia: string }

export interface MarcasMapa {
  depositos: { deposito: M.Deposito; lugar: Lugar }[];
  // El lugar de un pedido es la localidad de su cliente.
  pedidos: { resumen: M.ResumenPedido; lugar: Lugar | null }[];
  // El origen es un depósito o, si está vacío, un proveedor (sin lugar). El destino es un depósito o, si está
  // vacío, los clientes de los pedidos que lleva el flete: un tramo por cada localidad distinta.
  fletes: { flete: M.Flete; estado: M.EstadoFlete; origen: Lugar | null; destinos: Lugar[] }[];
}

const lugarDe = (localidad: string, provincia: string): Lugar | null =>
  (localidad.trim() === '' ? null : { localidad: localidad.trim(), provincia: provincia.trim() });

const mismoLugar = (a: Lugar, b: Lugar) =>
  a.localidad.toLowerCase() === b.localidad.toLowerCase() && a.provincia.toLowerCase() === b.provincia.toLowerCase();

export function marcasDelMapa(
  datos: M.Datos, pedidos: M.ResumenPedido[], estadosFletes: Map<string, string>,
): MarcasMapa {
  const contactos = new Map(datos.contactos.map((c) => [c.id, c]));
  const depositos = new Map(datos.depositos.map((d) => [d.id, d]));
  const lugarDeContacto = (id: string) => {
    const c = contactos.get(id);
    return c ? lugarDe(c.localidad, c.provincia) : null;
  };
  const lugarDeDeposito = (id: string) => {
    const d = depositos.get(id);
    return d ? lugarDe(d.localidad, '') : null;
  };
  const clientesDelFlete = new Map<string, string[]>();
  const contactoDelPedido = new Map(datos.pedidos.map((p) => [p.id, p.contactoId]));
  for (const pf of datos.pedidosFletes) {
    const c = contactoDelPedido.get(pf.pedidoId);
    if (c !== undefined) clientesDelFlete.set(pf.fleteId, [...(clientesDelFlete.get(pf.fleteId) ?? []), c]);
  }

  return {
    depositos: datos.depositos.flatMap((d) => {
      const lugar = lugarDe(d.localidad, '');
      return lugar ? [{ deposito: d, lugar }] : [];
    }),
    pedidos: pedidos
      .filter((r) => M.pedidoAbierto(r.estado))
      .map((r) => ({ resumen: r, lugar: lugarDeContacto(r.pedido.contactoId) })),
    fletes: datos.fletes.flatMap((flete) => {
      const estado = M.estadoFlete(estadosFletes, flete.id);
      if (!M.fleteEnCurso(estado)) return [];
      const origen = flete.origenId ? lugarDeDeposito(flete.origenId) : null;
      const candidatos = flete.destinoId
        ? [lugarDeDeposito(flete.destinoId)]
        : (clientesDelFlete.get(flete.id) ?? []).map(lugarDeContacto);
      const destinos: Lugar[] = [];
      for (const l of candidatos) if (l && !destinos.some((d) => mismoLugar(d, l))) destinos.push(l);
      return [{ flete, estado, origen, destinos }];
    }),
  };
}
