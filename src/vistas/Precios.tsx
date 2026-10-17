import { Autocomplete, Button, Grid, Group, NativeSelect, NumberInput, Paper, ScrollArea, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useBase, useGuardar } from '../base';
import { Encabezado, Mensaje } from '../componentes/comunes';
import { aNumero, deISO, fmtFecha, fmtMoney, fmtNum, hoyISO, unicos } from '../formato';
import type * as M from '../dominio/modelo';

// Valores por defecto: precio de lista de cada producto y porcentaje de comisión de cada vendedor.
// Cada cambio es una fila nueva con su fecha `desde`; los pedidos y ventas ya cargados no cambian.
export function Precios() {
  return (
    <Stack gap="md">
      <Title order={2}>Precios y comisiones</Title>
      <Text size="sm" c="dimmed">
        Son los valores que se proponen al cargar un pedido (precio) y una entrega (comisión). En cada pedido o entrega se
        pueden cambiar; lo que se cambia acá no modifica lo ya cargado.
      </Text>
      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6 }}><ListaPrecios /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}><ReglasComision /></Grid.Col>
      </Grid>
    </Stack>
  );
}

function ListaPrecios() {
  const { datos, buscarProducto, db, cargando } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [producto, setProducto] = useState('');
  const [precioTxt, setPrecioTxt] = useState<number | string>('');
  const [desde, setDesde] = useState(hoyISO);
  const [buscar, setBuscar] = useState('');
  const nombres = useMemo(() => unicos(datos.productos.map((p) => p.producto)), [datos]);
  const [hoy] = useState(() => new Date());

  const filas = datos.productos
    .map((p) => {
      const actual = datos.precios.filter((x) => x.productoId === p.id && (!x.desde || x.desde <= hoy))
        .reduce<M.Precio | null>((m, x) => (!m || (x.desde?.getTime() ?? 0) >= (m.desde?.getTime() ?? 0) ? x : m), null);
      return { p, actual };
    })
    .filter((f) => !buscar.trim() || f.p.producto.toLowerCase().includes(buscar.trim().toLowerCase()))
    .sort((a, b) => a.p.producto.localeCompare(b.p.producto, 'es'));

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = buscarProducto(producto);
    const precio = aNumero(precioTxt);
    if (!p) { error('Elegí un producto de la lista.'); return; }
    if (!(precio > 0)) { error('Ingresá un precio mayor a 0.'); return; }
    if (!desde) { error('Elegí desde qué fecha rige.'); return; }
    guardar(async () => {
      await db.registrarPrecio({ productoId: p.id, producto: p.producto, precio, desde: deISO(desde) });
      setPrecioTxt('');
      return `✓ ${p.producto}: ${fmtMoney(precio)} desde ${fmtFecha(deISO(desde))}.`;
    });
  }

  return (
    <Paper>
      <Encabezado titulo="Lista de precios">
        <TextInput type="search" w={200} placeholder="Buscar producto…" aria-label="Buscar precio"
          value={buscar} onChange={(e) => { setBuscar(e.currentTarget.value); }} />
      </Encabezado>
      <form onSubmit={enviar} noValidate aria-label="Cambiar precio">
        <Stack gap="xs" mb="sm">
          <Autocomplete label="Producto" data={nombres} value={producto} onChange={setProducto} />
          <Group grow gap="xs" align="flex-start">
            <NumberInput label="Precio" allowNegative={false} value={precioTxt} onChange={setPrecioTxt}
              leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none" />
            <TextInput label="Desde" type="date" value={desde} onChange={(e) => { setDesde(e.currentTarget.value); }} />
          </Group>
          <Button type="submit" loading={guardando}>Guardar precio</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
      <ScrollArea.Autosize mah={480} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }} aria-label="Lista de precios">
          <Table.Thead>
            <Table.Tr><Table.Th>Producto</Table.Th><Table.Th className="num">Precio</Table.Th><Table.Th>Desde</Table.Th></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map(({ p, actual }) => (
              <Table.Tr key={p.id}>
                <Table.Td>{p.producto}</Table.Td>
                <Table.Td className="num" c={actual ? undefined : 'dimmed'}>{actual ? fmtMoney(actual.precio) : 'Sin precio'}</Table.Td>
                <Table.Td c="dimmed">{actual ? fmtFecha(actual.desde) : ''}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
    </Paper>
  );
}

function ReglasComision() {
  const { datos, buscarProducto, nombreVendedor, db, cargando } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [vendedor, setVendedor] = useState(datos.vendedores.at(0)?.id ?? '');
  const [producto, setProducto] = useState('');
  const [pctTxt, setPctTxt] = useState<number | string>('');
  const [desde, setDesde] = useState(hoyISO);
  const nombres = useMemo(() => unicos(datos.productos.map((p) => p.producto)), [datos]);
  const nombreProducto = new Map(datos.productos.map((p) => [p.id, p.producto]));

  // Regla vigente de cada vendedor y producto (la última agregada con `desde` hasta hoy).
  const [hoy] = useState(() => new Date());
  const vigentes = new Map<string, M.ReglaComision>();
  for (const r of datos.reglas) {
    if (r.desde && r.desde > hoy) continue;
    const k = `${r.vendedorId}|${r.productoId}`;
    const actual = vigentes.get(k);
    if (!actual || (r.desde?.getTime() ?? 0) >= (actual.desde?.getTime() ?? 0)) vigentes.set(k, r);
  }
  const filas = [...vigentes.values()].sort((a, b) => {
    const porVendedor = nombreVendedor(a.vendedorId).localeCompare(nombreVendedor(b.vendedorId), 'es');
    return porVendedor !== 0 ? porVendedor : a.productoId.localeCompare(b.productoId);
  });

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = producto.trim() ? buscarProducto(producto) : null;
    const pct = aNumero(pctTxt);
    if (!vendedor) { error('Elegí el vendedor.'); return; }
    if (p === undefined) { error('Ese producto no existe. Dejalo vacío para una regla general.'); return; }
    if (!(pct >= 0 && pct <= 100)) { error('El porcentaje tiene que estar entre 0 y 100.'); return; }
    if (!desde) { error('Elegí desde qué fecha rige.'); return; }
    guardar(async () => {
      await db.registrarReglaComision({ vendedorId: vendedor, productoId: p?.id ?? '', porcentaje: pct, desde: deISO(desde) });
      setPctTxt('');
      return `✓ ${nombreVendedor(vendedor)}: ${fmtNum(pct)}% ${p ? `en ${p.producto}` : 'general'}.`;
    });
  }

  return (
    <Paper>
      <Encabezado titulo="Reglas de comisión" />
      <form onSubmit={enviar} noValidate aria-label="Nueva regla de comisión">
        <Stack gap="xs" mb="sm">
          <Group grow gap="xs" align="flex-start">
            <NativeSelect label="Vendedor" data={datos.vendedores.map((v) => ({ value: v.id, label: v.nombre }))} value={vendedor}
              onChange={(e) => { setVendedor(e.currentTarget.value); }} />
            <Autocomplete label="Producto" placeholder="Todos" data={nombres} value={producto} onChange={setProducto} />
          </Group>
          <Group grow gap="xs" align="flex-start">
            <NumberInput label="Comisión" min={0} max={100} allowNegative={false} value={pctTxt} onChange={setPctTxt}
              rightSection={<Text size="xs" c="dimmed">%</Text>} rightSectionPointerEvents="none" />
            <TextInput label="Desde" type="date" value={desde} onChange={(e) => { setDesde(e.currentTarget.value); }} />
          </Group>
          <Button type="submit" loading={guardando}>Guardar regla</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
      <Table highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }} aria-label="Reglas vigentes">
        <Table.Thead>
          <Table.Tr><Table.Th>Vendedor</Table.Th><Table.Th>Producto</Table.Th><Table.Th className="num">%</Table.Th><Table.Th>Desde</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filas.map((r) => (
            <Table.Tr key={`${r.vendedorId}|${r.productoId}`}>
              <Table.Td>{nombreVendedor(r.vendedorId)}</Table.Td>
              <Table.Td c={r.productoId ? undefined : 'dimmed'}>{r.productoId ? nombreProducto.get(r.productoId) ?? r.productoId : 'Todos (general)'}</Table.Td>
              <Table.Td className="num">{fmtNum(r.porcentaje)}</Table.Td>
              <Table.Td c="dimmed">{fmtFecha(r.desde)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {filas.length === 0 && <Text c="dimmed" mt="xs" size="sm">No hay reglas: las comisiones se proponen en 0%.</Text>}
    </Paper>
  );
}
