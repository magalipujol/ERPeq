import { BarChart } from '@mantine/charts';
import {
  Autocomplete, Badge, Button, Grid, Group, NativeSelect, NumberInput, Paper, ScrollArea, SegmentedControl, Stack, Table,
  Text, TextInput, UnstyledButton,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useBase, useGuardar } from '../base';
import { Encabezado, Kpis, Mensaje } from '../componentes/comunes';
import { aNumero, fmtMoney, fmtNum, unicos } from '../formato';
import * as M from '../modelo';

interface Estado { color: string; texto: string }

const minimoDe = (p: M.Producto) => p.minimo ?? 0;
const bajoMinimo = (f: FilaStock) => minimoDe(f) !== 0 && f.total < minimoDe(f);

function estadoStock(p: M.Producto, total: number): Estado {
  const minimo = minimoDe(p);
  if (total < 0) return { color: 'red', texto: 'Negativo' };
  if (minimo > 0 && total < minimo) return { color: 'red', texto: 'Reponer' };
  if (minimo > 0 && total < minimo * 1.5) return { color: 'yellow', texto: 'Atención' };
  if (total === 0) return { color: 'gray', texto: 'Sin stock' };
  return { color: 'green', texto: 'OK' };
}

interface FilaStock extends M.Producto {
  s: M.PorDeposito; transito: number; total: number; comprometido: number; faltante: number;
  costo: number | null; valor: number | null; estado: Estado;
}

export function Stock({ visible }: { visible: boolean }) {
  const { datos, stock, costos } = useBase();

  const filas = useMemo<FilaStock[]>(() => datos.productos.map((p) => {
    const s = stock.enDeposito.get(p.id) ?? {};
    const transito = M.sumaDeps(stock.enTransito.get(p.id));
    const total = M.redondear(M.sumaDeps(s) + transito, 3);
    const costo = costos.get(p.id) ?? null;
    return {
      ...p, s, transito, total, costo,
      comprometido: M.sumaDeps(stock.comprometido.get(p.id)),
      faltante: M.redondear(datos.depositos.reduce((a, d) => a + M.faltante(stock, p.id, d.id), 0), 3),
      valor: costo !== null && total > 0 ? total * costo : null, estado: estadoStock(p, total),
    };
  }), [datos, stock, costos]);

  const bajos = filas.filter(bajoMinimo).length;
  const negs = filas.filter((f) => Object.values(f.s).some((v) => v < 0)).length;
  const faltan = filas.filter((f) => f.faltante > 0).length;

  return (
    <Stack gap="md">
      <Kpis label="Resumen de stock" items={[
        { label: 'Productos con stock', valor: filas.filter((f) => f.total > 0).length },
        { label: 'Bajo el mínimo', valor: bajos, alerta: bajos > 0 },
        { label: 'Stock negativo', valor: negs, alerta: negs > 0 },
        { label: 'Faltan para pedidos', valor: faltan, alerta: faltan > 0 },
        { label: 'Valor del stock (a costo)', valor: fmtMoney(filas.reduce((s, f) => s + (f.valor ?? 0), 0)) },
      ]} />

      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 'auto' }} miw={0}>
          <Inventario filas={filas} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 'content' }} w={{ md: 340 }}>
          <AjusteStock />
        </Grid.Col>
      </Grid>

      {visible && <GraficoStock filas={filas} />}
    </Stack>
  );
}

interface Columna { key: string; titulo: string; num?: boolean }

function Inventario({ filas }: { filas: FilaStock[] }) {
  const { datos, cargando } = useBase();
  const deps = datos.depositos;
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState('');
  const [orden, setOrden] = useState({ key: 'producto', dir: 1 });

  const cols: Columna[] = [
    { key: 'producto', titulo: 'Producto' }, { key: 'unidad', titulo: 'Unidad' },
    ...deps.map((d) => ({ key: `dep:${d.id}`, titulo: d.nombre, num: true })),
    { key: 'transito', titulo: 'En camino', num: true }, { key: 'total', titulo: 'Total', num: true },
    { key: 'comprometido', titulo: 'Comprometido', num: true }, { key: 'minimo', titulo: 'Mínimo', num: true },
    { key: 'estado', titulo: 'Estado' }, { key: 'costo', titulo: 'Costo prom.', num: true }, { key: 'valor', titulo: 'Valor', num: true },
  ];

  const q = buscar.trim().toLowerCase();
  const valor = (f: FilaStock): string | number | null =>
    (orden.key.startsWith('dep:') ? f.s[orden.key.slice(4)]
      : orden.key === 'estado' ? f.estado.texto
        : f[orden.key as keyof FilaStock] as string | number | null);
  const visibles = filas
    .filter((f) => !q || f.producto.toLowerCase().includes(q))
    .filter((f) => !filtro
      || (filtro === 'con' && f.total > 0)
      || (filtro === 'neg' && Object.values(f.s).some((v) => v < 0))
      || (filtro === 'bajo' && bajoMinimo(f))
      || (filtro === 'falta' && f.faltante > 0))
    .sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      if (va === null) return 1;
      if (vb === null) return -1;
      return (typeof va === 'string' ? va.localeCompare(vb as string, 'es') : va - (vb as number)) * orden.dir;
    });

  const ordenar = (key: string) => { setOrden((o) => ({ key, dir: o.key === key ? -o.dir : 1 })); };

  return (
    <Paper>
      <Encabezado titulo="Inventario">
        <Group gap="xs">
          <TextInput type="search" w={200} placeholder="Buscar producto…" aria-label="Buscar producto"
            value={buscar} onChange={(e) => { setBuscar(e.currentTarget.value); }} />
          <NativeSelect aria-label="Filtrar" value={filtro} onChange={(e) => { setFiltro(e.currentTarget.value); }} data={[
            { value: '', label: 'Todos' }, { value: 'con', label: 'Con stock' },
            { value: 'neg', label: 'Stock negativo' }, { value: 'bajo', label: 'Bajo el mínimo' },
            { value: 'falta', label: 'Faltan para pedidos' },
          ]} />
        </Group>
      </Encabezado>
      <ScrollArea.Autosize mah={560} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1, whiteSpace: 'nowrap' }}>
          <Table.Thead>
            <Table.Tr>
              {cols.map((c) => (
                <Table.Th key={c.key} className={c.num === true ? 'num' : undefined}>
                  <UnstyledButton fz="xs" fw={600} c="dimmed" tt="uppercase" onClick={() => { ordenar(c.key); }}>
                    <Group gap={2} wrap="nowrap" justify={c.num === true ? 'flex-end' : undefined}>
                      {c.titulo}
                      {orden.key === c.key && (orden.dir > 0 ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />)}
                    </Group>
                  </UnstyledButton>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibles.map((f) => (
              <Table.Tr key={f.id}>
                <Table.Td fw={500} miw={180} style={{ whiteSpace: 'normal' }}>{f.producto}</Table.Td>
                <Table.Td c="dimmed">{f.unidad}</Table.Td>
                {deps.map((d) => {
                  const v = f.s[d.id] ?? 0;
                  return <Table.Td key={d.id} className="num" c={v < 0 ? 'red' : undefined} fw={v < 0 ? 600 : undefined}>{fmtNum(v)}</Table.Td>;
                })}
                <Table.Td className="num" c="dimmed">{f.transito !== 0 ? fmtNum(f.transito) : '–'}</Table.Td>
                <Table.Td className="num" fw={600} c={f.total < 0 ? 'red' : undefined}>{fmtNum(f.total)}</Table.Td>
                <Table.Td className="num" c={f.faltante > 0 ? 'yellow.8' : 'dimmed'} fw={f.faltante > 0 ? 600 : undefined}
                  title={f.faltante > 0 ? `Faltan ${fmtNum(f.faltante)} ${f.unidad}` : undefined}>
                  {f.comprometido !== 0 ? fmtNum(f.comprometido) : '–'}
                </Table.Td>
                <Table.Td className="num" c="dimmed">{minimoDe(f) !== 0 ? fmtNum(f.minimo) : '–'}</Table.Td>
                <Table.Td><Badge variant="light" color={f.estado.color} size="sm">{f.estado.texto}</Badge></Table.Td>
                <Table.Td className="num" c="dimmed">{fmtMoney(f.costo)}</Table.Td>
                <Table.Td className="num">{fmtMoney(f.valor)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {visibles.length === 0 && <Text c="dimmed" mt="xs">No hay productos que coincidan.</Text>}
    </Paper>
  );
}

function AjusteStock() {
  const { datos, stock, buscarProducto, nombreDeposito, escribir } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [producto, setProducto] = useState('');
  const [depSel, setDepSel] = useState<string | null>(null);
  const deposito = depSel ?? datos.depositos.at(0)?.id ?? '';
  const [cantidadTxt, setCantidadTxt] = useState<number | string>('');
  const [motivo, setMotivo] = useState('');
  const nombres = useMemo(() => unicos(datos.productos.map((p) => p.producto)), [datos]);

  const p = buscarProducto(producto);
  const cantidad = aNumero(cantidadTxt);
  const antes = p ? stock.enDeposito.get(p.id)?.[deposito] ?? 0 : 0;
  const hayCantidad = cantidad !== 0 && !Number.isNaN(cantidad);

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const mot = motivo.trim();
    if (!p) { error('Elegí un producto de la lista.'); return; }
    if (!hayCantidad) { error('Ingresá una cantidad distinta de 0.'); return; }
    if (!mot) { error('Indicá el motivo.'); return; }
    guardar(async () => {
      await escribir({ ajustes: [M.filas.ajuste({ fecha: new Date(), depositoId: deposito, productoId: p.id, producto: p.producto, cantidad, motivo: mot })] });
      setCantidadTxt('');
      setMotivo('');
      return `✓ Ajuste registrado: ${cantidad > 0 ? '+' : ''}${fmtNum(cantidad)} ${p.unidad} de ${p.producto}.`;
    });
  }

  return (
    <Paper>
      <Encabezado titulo="Ajuste de stock" />
      <Text size="xs" c="dimmed" mt={-8} mb="sm">Para corregir diferencias (rotura, conteo, faltantes). Usá cantidades negativas para restar.</Text>
      <form onSubmit={enviar} noValidate aria-label="Ajuste de stock">
        <Stack gap="sm">
          <Autocomplete label="Producto" placeholder="Buscar producto…" data={nombres} value={producto} onChange={setProducto} />
          <Group grow gap="xs" align="flex-start">
            <NativeSelect label="Depósito" data={datos.depositos.map((d) => ({ value: d.id, label: d.nombre }))} value={deposito}
              onChange={(e) => { setDepSel(e.currentTarget.value); }} />
            <NumberInput label="Cantidad" placeholder="−5 ó 10" value={cantidadTxt} onChange={setCantidadTxt}
              rightSection={<Text size="xs" c="dimmed">{p?.unidad}</Text>} rightSectionPointerEvents="none" />
          </Group>
          <TextInput label="Motivo" maxLength={150} placeholder="Ej.: conteo físico, rotura" value={motivo}
            onChange={(e) => { setMotivo(e.currentTarget.value); }} />
          {p && hayCantidad ? (
            <Text size="sm" className="suave" px="sm" py={8}>
              Stock en {nombreDeposito(deposito)}: {fmtNum(antes)} → <strong>{fmtNum(M.redondear(antes + cantidad, 3))} {p.unidad}</strong>
            </Text>
          ) : producto && !p ? (
            <Text size="sm" className="suave" px="sm" py={8}>No existe ese producto.</Text>
          ) : null}
          <Button type="submit" loading={guardando}>Registrar ajuste</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
    </Paper>
  );
}

const COLORES = ['var(--c1)', 'var(--c2)', 'var(--c3)'];

function GraficoStock({ filas }: { filas: FilaStock[] }) {
  const { datos } = useBase();
  const deps = datos.depositos;
  const unidades = unicos(filas.map((f) => f.unidad));
  const [elegida, setElegida] = useState<string | null>(null);
  const unidad = elegida && unidades.includes(elegida) ? elegida : unidades.includes('kg') ? 'kg' : unidades[0];

  const items = filas
    .filter((f) => f.unidad === unidad && f.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)
    .map((f) => ({ producto: f.producto, ...Object.fromEntries(deps.map((d) => [d.nombre, Math.max(0, f.s[d.id] ?? 0)])) }));

  return (
    <Paper>
      <Encabezado titulo="Productos con más stock">
        {unidades.length > 1 && <SegmentedControl size="xs" value={unidad} onChange={setElegida} data={unidades} aria-label="Unidad" />}
      </Encabezado>
      <BarChart
        h={Math.max(180, items.length * 36 + 70)}
        data={items}
        dataKey="producto"
        type="stacked"
        orientation="vertical"
        withLegend
        legendProps={{ verticalAlign: 'top', align: 'right' }}
        series={deps.map((d, i) => ({ name: d.nombre, color: COLORES[i % COLORES.length] }))}
        valueFormatter={(v) => `${fmtNum(v)} ${unidad}`}
        yAxisProps={{ width: 180 }}
        gridAxis="x"
        aria-label="Stock por producto y depósito"
      />
    </Paper>
  );
}
