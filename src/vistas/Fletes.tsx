import {
  Autocomplete, Badge, Button, Grid, Group, MultiSelect, NativeSelect, NumberInput, Paper, ScrollArea, SegmentedControl, Stack,
  Table, Text, TextInput, Title, useMatches,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { useBase, useGuardar } from '../base';
import { Encabezado, Kpis, Mensaje, Resumen } from '../componentes/comunes';
import { type Item, itemVacio } from '../componentes/item';
import { Items } from '../componentes/Items';
import { aNumero, deISO, fmtFecha, fmtMoney, fmtNum, hoyISO, numeroOCero, porFechaDesc, unicos } from '../formato';
import * as M from '../dominio/modelo';

const COLOR_ESTADO: Record<M.EstadoFlete, string> = { preparacion: 'yellow', camino: 'blue', finalizado: 'green', cancelado: 'gray' };
export function EstadoFlete({ estado }: { estado: M.EstadoFlete }) {
  return <Badge variant="light" size="sm" color={COLOR_ESTADO[estado]}>{M.NOMBRE_ESTADO_FLETE[estado]}</Badge>;
}

const ACCION: Record<M.EstadoFlete, string> = {
  preparacion: 'Volvió sin entregar', camino: 'Despachar', finalizado: 'Recibido', cancelado: 'Cancelar',
};

export function Fletes() {
  const { datos, estadosFletes, costos, stock } = useBase();
  const estado = (id: string) => M.estadoFlete(estadosFletes, id);
  const activos = datos.fletes.filter((f) => M.fleteEnCurso(estado(f.id)));
  let enCamino = 0;
  for (const [id, s] of stock.enTransito) enCamino += M.sumaDeps(s) * (costos.get(id) ?? 0);

  return (
    <Stack gap="md">
      <Title order={2}>Fletes</Title>
      <Kpis label="Resumen de fletes" items={[
        { label: 'En preparación', valor: activos.filter((f) => estado(f.id) === 'preparacion').length },
        { label: 'En camino', valor: activos.filter((f) => estado(f.id) === 'camino').length },
        { label: 'Mercadería en camino (a costo)', valor: fmtMoney(enCamino) },
      ]} />
      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6 }}><FormFlete /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}><ListaFletes /></Grid.Col>
      </Grid>
    </Stack>
  );
}

const nombreLugar = (nombreDeposito: (id: string) => string, id: string, afuera: string) => (id ? nombreDeposito(id) : afuera);

export function Recorrido({ flete }: { flete: M.Flete }) {
  const { nombreDeposito } = useBase();
  return <>{nombreLugar(nombreDeposito, flete.origenId, 'Proveedor')} → {nombreLugar(nombreDeposito, flete.destinoId, 'Cliente')}</>;
}

function FormFlete() {
  const { datos, pedidos, buscarProducto, buscarContacto, db } = useBase();
  // En celular los tres estados no entran en una fila.
  const enCelular = useMatches({ base: true, sm: false });
  const { guardando, msg, guardar, error } = useGuardar();
  const [fecha, setFecha] = useState(hoyISO);
  const [transporte, setTransporte] = useState('');
  const [origen, setOrigen] = useState(datos.depositos.at(0)?.id ?? '');
  const [destino, setDestino] = useState(datos.depositos.at(1)?.id ?? '');
  const [costoTxt, setCostoTxt] = useState<number | string>('');
  const [guia, setGuia] = useState('');
  const [nota, setNota] = useState('');
  const [estadoInicial, setEstadoInicial] = useState<M.EstadoFlete>('preparacion');
  const [items, setItems] = useState<Item[]>(() => [itemVacio()]);
  const [pedidosSel, setPedidosSel] = useState<string[]>([]);
  const [asignado, setAsignado] = useState<Record<string, number | string>>({});

  const transportes = useMemo(() => unicos([
    ...datos.contactos.filter((c) => c.rol === 'transporte').map((c) => c.nombre), ...datos.fletes.map((f) => f.transporte),
  ]), [datos]);
  const opcionesPedidos = pedidos.filter((r) => r.estado !== 'cancelado')
    .sort((a, b) => porFechaDesc(a.pedido, b.pedido))
    .map((r) => ({ value: r.pedido.id, label: `${r.pedido.id} · ${r.pedido.cliente}` }));
  const lugares = (afuera: string) => [{ value: '', label: afuera }, ...datos.depositos.map((d) => ({ value: d.id, label: d.nombre }))];
  const transferencia = origen !== '' && destino !== '' && origen !== destino;
  const costo = aNumero(costoTxt);

  // Reparto propuesto: proporcional al importe de cada pedido. Se puede cambiar a mano.
  const importes = new Map(pedidos.map((r) => [r.pedido.id, r.importePedido]));
  const totalImportes = pedidosSel.reduce((s, id) => s + (importes.get(id) ?? 0), 0);
  const propuesto = (id: string) => (Number.isNaN(costo) || totalImportes === 0 ? 0
    : M.redondear(costo * (importes.get(id) ?? 0) / totalImportes));
  const asignacion = pedidosSel.map((id) => ({ id, costo: !(id in asignado) || asignado[id] === '' ? propuesto(id) : numeroOCero(asignado[id]) }));
  const totalAsignado = asignacion.reduce((s, a) => s + a.costo, 0);

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
      : totalAsignado > (Number.isNaN(costo) ? 0 : costo) + 0.005 ? 'Lo asignado a pedidos supera el costo del flete.'
      : null;
    if (falta || !dia) { error(falta ?? 'Elegí la fecha.'); return; }

    guardar(async () => {
      const existente = buscarContacto('transporte', nombre);
      const contactoId = existente?.id ?? M.siguienteId(datos.contactos.map((c) => c.id), 'C');
      const id = M.siguienteId(datos.fletes.map((f) => f.id), 'F');
      await db.registrarFlete({
        transporteNuevo: existente ? null : { id: contactoId, rol: 'transporte', nombre },
        flete: {
          id, fecha: dia, transporte: nombre, contactoId, origenId: origen, destinoId: destino,
          costo: Number.isNaN(costo) ? null : costo, guia: guia.trim(), nota: nota.trim(),
        },
        items: lineas.map((l) => ({ fleteId: id, productoId: l.p?.id ?? '', producto: l.p?.producto ?? '', cantidad: l.cantidad })),
        estados: M.caminoFlete(estadoInicial),
        momento: new Date(),
        pedidos: asignacion.map((a) => ({ pedidoId: a.id, fleteId: id, costoAsignado: a.costo })),
      });
      setItems([itemVacio()]);
      setPedidosSel([]);
      setAsignado({});
      setCostoTxt('');
      setGuia('');
      setNota('');
      return `✓ Flete ${id} registrado (${M.NOMBRE_ESTADO_FLETE[estadoInicial].toLowerCase()}).`;
    });
  }

  return (
    <Paper>
      <Encabezado titulo="Nuevo flete" />
      <form onSubmit={enviar} noValidate aria-label="Nuevo flete">
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

          {transferencia
            ? <Items modo="flete" deposito={origen} fecha={null} items={items} onChange={setItems} />
            : <Text size="sm" c="dimmed">Solo los fletes entre depósitos mueven stock.</Text>}

          <MultiSelect label="Pedidos que lleva" placeholder={pedidosSel.length > 0 ? undefined : 'Ninguno'} data={opcionesPedidos} searchable
            value={pedidosSel} onChange={setPedidosSel} />
          {asignacion.map((a) => (
            <Group key={a.id} gap="xs" wrap="nowrap">
              <Text size="sm" w={80}>{a.id}</Text>
              <NumberInput size="xs" w={140} allowNegative={false} aria-label={`Costo asignado a ${a.id}`}
                value={asignado[a.id] ?? propuesto(a.id)} onChange={(v) => { setAsignado((x) => ({ ...x, [a.id]: v })); }}
                leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none" />
            </Group>
          ))}

          <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
          <div>
            <Text size="sm" fw={500} mb={4}>Estado</Text>
            <SegmentedControl size="xs" value={estadoInicial} onChange={setEstadoInicial} aria-label="Estado inicial"
              orientation={enCelular ? 'vertical' : 'horizontal'} fullWidth={enCelular}
              data={(['preparacion', 'camino', 'finalizado'] as const).map((e) => ({ value: e, label: M.NOMBRE_ESTADO_FLETE[e] }))} />
          </div>
          {pedidosSel.length > 0 && (
            <Group className="suave" px="md" py="xs" gap="xl">
              <Resumen label="Asignado a pedidos" valor={fmtMoney(totalAsignado)} />
              <Resumen label="Gasto de logística" valor={fmtMoney(Math.max(0, (Number.isNaN(costo) ? 0 : costo) - totalAsignado))} />
            </Group>
          )}
          <Button type="submit" loading={guardando}>Registrar flete</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
    </Paper>
  );
}

function ListaFletes() {
  const { datos, estadosFletes, cargando, db } = useBase();
  const { guardando, msg, guardar } = useGuardar();
  const [filtro, setFiltro] = useState('activos');
  const items = new Map<string, M.FleteItem[]>();
  for (const it of datos.fletesItems) items.set(it.fleteId, [...(items.get(it.fleteId) ?? []), it]);
  const pedidos = new Map<string, string[]>();
  for (const p of datos.pedidosFletes) pedidos.set(p.fleteId, [...(pedidos.get(p.fleteId) ?? []), p.pedidoId]);

  const filas = datos.fletes
    .map((f) => ({ f, estado: M.estadoFlete(estadosFletes, f.id) }))
    .filter((x) => filtro === 'todos' || M.fleteEnCurso(x.estado))
    .sort((a, b) => porFechaDesc(a.f, b.f));

  function cambiar(id: string, estado: M.EstadoFlete) {
    guardar(async () => {
      await db.cambiarEstadoFlete(id, estado, new Date());
      return `✓ Flete ${id}: ${M.NOMBRE_ESTADO_FLETE[estado].toLowerCase()}.`;
    });
  }

  return (
    <Paper>
      <Encabezado titulo="Fletes">
        <SegmentedControl size="xs" value={filtro} onChange={setFiltro} aria-label="Mostrar fletes"
          data={[{ value: 'activos', label: 'Activos' }, { value: 'todos', label: 'Todos' }]} />
      </Encabezado>
      <Mensaje msg={msg} />
      <ScrollArea.Autosize mah={640} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Flete</Table.Th><Table.Th>Recorrido</Table.Th><Table.Th className="num">Costo</Table.Th><Table.Th>Estado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map(({ f, estado }) => (
              <Table.Tr key={f.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{f.id}</Text>
                  <Text size="xs" c="dimmed">{fmtFecha(f.fecha)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{f.transporte}</Text>
                  <Text size="xs" c="dimmed"><Recorrido flete={f} /></Text>
                  {(items.get(f.id) ?? []).map((it) => <Text key={it.productoId} size="xs">{fmtNum(it.cantidad)} {it.producto}</Text>)}
                  {pedidos.has(f.id) && <Text size="xs" c="dimmed">Pedidos: {(pedidos.get(f.id) ?? []).join(', ')}</Text>}
                </Table.Td>
                <Table.Td className="num">{fmtMoney(f.costo)}</Table.Td>
                <Table.Td>
                  <EstadoFlete estado={estado} />
                  <Stack gap={4} mt={6} align="flex-start">
                    {M.SIGUIENTES_FLETE[estado].map((e) => (
                      <Button key={e} size="compact-xs" variant={e === 'cancelado' || e === 'preparacion' ? 'subtle' : 'light'}
                        disabled={guardando} onClick={() => { cambiar(f.id, e); }} aria-label={`${ACCION[e]} ${f.id}`}>
                        {ACCION[e]}
                      </Button>
                    ))}
                  </Stack>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {filas.length === 0 && <Text c="dimmed" mt="xs">No hay fletes {filtro === 'activos' ? 'activos' : ''}.</Text>}
    </Paper>
  );
}
