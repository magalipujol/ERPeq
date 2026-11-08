import { Autocomplete, Button, Group, NativeSelect, NumberInput, SegmentedControl, Stack, Text, TextInput, useMatches } from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBase, useGuardar } from '../base';
import { Encabezado, Mensaje, Seccion } from './comunes';
import { type Item, itemVacio } from './item';
import { Items } from './Items';
import { aISO, aISOConHora, aNumero, deISO, deISOConHora, hoyISO, unicos } from '../formato';
import * as M from '../dominio/modelo';

// Flete que Inicio propone para cubrir el faltante de pedidos: se carga en el formulario para revisarlo y registrarlo.
export interface BorradorFlete extends M.FleteSugerido { vez: number }


// Un flete que se corrige desde su ficha: el formulario arranca con sus datos y su mercadería, y no elige estado.
export interface FleteACorregir { flete: M.Flete; items: M.FleteItem[]; onListo: (texto: string) => void; onCancelar: () => void }

// Carga un flete nuevo o, con `corregir`, corrige uno ya cargado.
export function FormFlete({ borrador = null, corregir }: { borrador?: BorradorFlete | null; corregir?: FleteACorregir }) {
  const { datos, buscarProducto, buscarContacto, etiquetas, nombres, db } = useBase();
  const formRef = useRef<HTMLFormElement>(null);
  // En celular los tres estados no entran en una fila.
  const enCelular = useMatches({ base: true, sm: false });
  const { guardando, msg, guardar, error } = useGuardar();
  const inicial = corregir?.flete;
  const [fecha, setFecha] = useState(() => (inicial ? aISO(inicial.fecha) : hoyISO()));
  const [transporte, setTransporte] = useState(() => (inicial ? nombres.contacto(inicial.contactoId) : ''));
  const [origen, setOrigen] = useState(inicial?.origenId ?? datos.depositos.at(0)?.id ?? '');
  const [destino, setDestino] = useState(inicial?.destinoId ?? datos.depositos.at(1)?.id ?? '');
  const [costoTxt, setCostoTxt] = useState<number | string>(inicial?.costo ?? '');
  const [guia, setGuia] = useState(inicial?.guia ?? '');
  const [nota, setNota] = useState(inicial?.nota ?? '');
  // Fecha y hora previstas, del <input type="datetime-local">; la llegada es opcional.
  const [salida, setSalida] = useState(() => aISOConHora(inicial?.salida ?? null));
  const [llegada, setLlegada] = useState(() => aISOConHora(inicial?.llegadaEstimada ?? null));
  const [estadoInicial, setEstadoInicial] = useState<M.EstadoFlete>('preparacion');
  const [items, setItems] = useState<Item[]>(() => (corregir && corregir.items.length > 0
    ? corregir.items.map((it) => ({ ...itemVacio(), producto: nombres.producto(it.productoId), cantidad: it.cantidad }))
    : [itemVacio()]));
  // Pedidos para los que Inicio propuso el flete. Solo se muestran: el flete no guarda pedidos.
  const [paraPedidos, setParaPedidos] = useState<string[]>([]);
  const [borradorAnterior, setBorradorAnterior] = useState(borrador);
  if (borrador !== borradorAnterior) {
    setBorradorAnterior(borrador);
    if (borrador) {
      setOrigen(borrador.origenId);
      setDestino(borrador.destinoId);
      setItems(borrador.items.length > 0
        ? borrador.items.map((it) => ({ ...itemVacio(), producto: nombres.producto(it.productoId), cantidad: it.cantidad }))
        : [itemVacio()]);
      setParaPedidos(borrador.pedidos);
    }
  }
  useEffect(() => {
    if (borrador) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [borrador]);

  const transportes = useMemo(() => unicos([
    ...datos.contactos.filter((c) => c.rol === 'transporte').map((c) => c.nombre),
  ]), [datos]);
  const lugares = (afuera: string) => [{ value: '', label: afuera }, ...datos.depositos.map((d) => ({ value: d.id, label: d.nombre }))];
  const transferencia = origen !== '' && destino !== '' && origen !== destino;
  const costo = aNumero(costoTxt);
  const salidaPrevista = deISOConHora(salida);
  const llegadaEstimada = deISOConHora(llegada);

  const lineas = items.filter((it) => it.producto.trim() !== '').map((it) => ({ p: buscarProducto(it.producto), cantidad: aNumero(it.cantidad) }));

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const nombre = transporte.trim();
    const dia = fecha ? deISO(fecha) : null;
    const falta = !dia ? 'Elegí la fecha.'
      : !nombre ? 'Ingresá el transporte.'
      : origen !== '' && origen === destino ? 'El origen y el destino tienen que ser distintos.'
      : !Number.isNaN(costo) && costo < 0 ? 'El costo no puede ser negativo.'
      : lineas.length > 0 && !transferencia ? 'Solo un flete entre dos depósitos lleva productos.'
      : lineas.some((l) => !l.p) ? 'Hay productos que no existen en la lista.'
      : lineas.some((l) => !(l.cantidad > 0)) ? 'Todas las cantidades tienen que ser mayores a 0.'
      : salidaPrevista && llegadaEstimada && llegadaEstimada < salidaPrevista ? 'La llegada estimada no puede ser antes de la salida.'
      : null;
    if (falta || !dia) { error(falta ?? 'Elegí la fecha.'); return; }

    guardar(async () => {
      const existente = buscarContacto('transporte', nombre);
      const contactoId = existente?.id ?? M.siguienteId(datos.contactos.map((c) => c.id), 'C');
      const id = corregir?.flete.id ?? M.siguienteId(datos.fletes.map((f) => f.id), 'F');
      const flete: M.Flete = {
        id, fecha: dia, contactoId, origenId: origen, destinoId: destino,
        costo: Number.isNaN(costo) ? null : costo, guia: guia.trim(), nota: nota.trim(),
        salida: salidaPrevista, llegadaEstimada,
      };
      const transporteNuevo = existente ? null : { id: contactoId, rol: 'transporte', nombre };
      const itemsFlete = transferencia ? lineas.map((l) => ({ fleteId: id, productoId: l.p?.id ?? '', cantidad: l.cantidad })) : [];
      if (corregir) {
        await db.corregirFlete({ flete, items: itemsFlete, transporteNuevo });
        const listo = `✓ Flete de ${nombre} corregido.`;
        corregir.onListo(listo);
        return listo;
      }
      await db.registrarFlete({ transporteNuevo, flete, items: itemsFlete, estados: M.caminoFlete(estadoInicial), momento: new Date() });
      setItems([itemVacio()]);
      setParaPedidos([]);
      setCostoTxt('');
      setGuia('');
      setNota('');
      setSalida('');
      setLlegada('');
      return `✓ Flete de ${nombre} registrado (${M.NOMBRE_ESTADO_FLETE[estadoInicial].toLowerCase()}).`;
    });
  }

  return (
    <Seccion>
      {!corregir && <Encabezado titulo="Nuevo flete" />}
      <form ref={formRef} onSubmit={enviar} noValidate aria-label={corregir ? 'Corregir flete' : 'Nuevo flete'}>
        <Stack gap="sm">
          <Group grow gap="xs" align="flex-start">
            <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.currentTarget.value); }} />
            <Autocomplete label="Transporte" maxLength={120} data={transportes} value={transporte} onChange={setTransporte} />
          </Group>
          <Group grow gap="xs" align="flex-start">
            <NativeSelect label="Origen" data={lugares('Proveedor / afuera')} value={origen} onChange={(e) => { setOrigen(e.currentTarget.value); }} />
            <NativeSelect label="Destino" data={lugares('Cliente / afuera')} value={destino} onChange={(e) => { setDestino(e.currentTarget.value); }} />
          </Group>
          <Group grow gap="xs" align="flex-start">
            <NumberInput label="Costo" allowNegative={false} value={costoTxt} onChange={setCostoTxt}
              leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none" />
            <TextInput label="Guía" maxLength={60} placeholder="Opcional" value={guia} onChange={(e) => { setGuia(e.currentTarget.value); }} />
          </Group>
          <Group grow gap="xs" align="flex-start">
            <TextInput label="Salida prevista" type="datetime-local" value={salida} onChange={(e) => { setSalida(e.currentTarget.value); }} />
            <TextInput label="Llegada estimada" type="datetime-local" description="Opcional" value={llegada}
              onChange={(e) => { setLlegada(e.currentTarget.value); }} />
          </Group>

          {transferencia
            ? <Items modo="flete" deposito={origen} fecha={null} items={items} onChange={setItems} />
            : <Text size="sm" c="dimmed">Solo los fletes entre depósitos mueven stock.</Text>}
          {paraPedidos.length > 0 && (
            <Text size="xs" c="dimmed">Propuesto para cubrir lo que les falta a: {paraPedidos.map(etiquetas.pedido).join(', ')}.</Text>
          )}
          <Text size="xs" c="dimmed">El costo es gasto de logística del mes: no se reparte entre pedidos.</Text>

          <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
          {!corregir && <div>
            <Text size="sm" fw={500} mb={4}>Estado</Text>
            <SegmentedControl size="xs" value={estadoInicial} onChange={setEstadoInicial} aria-label="Estado inicial"
              orientation={enCelular ? 'vertical' : 'horizontal'} fullWidth={enCelular}
              data={(['preparacion', 'camino', 'finalizado'] as const).map((e) => ({ value: e, label: M.NOMBRE_ESTADO_FLETE[e] }))} />
          </div>}
          {corregir ? (
            <Group gap="xs" justify="flex-end">
              <Button variant="default" onClick={corregir.onCancelar}>Cancelar</Button>
              <Button type="submit" loading={guardando}>Guardar corrección</Button>
            </Group>
          ) : <Button type="submit" loading={guardando}>Registrar flete</Button>}
          <Mensaje msg={msg} />
        </Stack>
      </form>
    </Seccion>
  );
}
