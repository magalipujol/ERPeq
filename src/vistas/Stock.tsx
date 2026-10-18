import { BarChart } from '@mantine/charts';
import {
  Autocomplete, Badge, Box, Button, Grid, Group, NativeSelect, NumberInput, Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Table,
  Text, TextInput, Title, UnstyledButton,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useBase, useGuardar } from '../base';
import { Encabezado, Kpis, Mensaje, Resumen, Seccion } from '../componentes/comunes';
import { Vinculo } from '../componentes/Fichas';
import { useFila } from '../ficha';
import { aNumero, fmtMoney, fmtNum, unicos } from '../formato';
import * as M from '../dominio/modelo';

// `urgencia`: para ordenar por estado, de lo más urgente (0) a lo que está bien.
interface Estado { color: string; texto: string; urgencia: number }

const minimoDe = (p: M.Producto) => p.minimo ?? 0;
const bajoMinimo = (f: FilaStock) => minimoDe(f) !== 0 && f.total < minimoDe(f);

function estadoStock(p: M.Producto, total: number): Estado {
  const minimo = minimoDe(p);
  if (total < 0) return { color: 'red', texto: 'Negativo', urgencia: 0 };
  if (minimo > 0 && total < minimo) return { color: 'red', texto: 'Reponer', urgencia: 1 };
  if (minimo > 0 && total < minimo * 1.5) return { color: 'yellow', texto: 'Atención', urgencia: 2 };
  if (total === 0) return { color: 'gray', texto: 'Sin stock', urgencia: 3 };
  return { color: 'green', texto: 'OK', urgencia: 4 };
}

interface FilaStock extends M.Producto {
  s: M.PorDeposito; transito: number; total: number; faltante: number;
  costo: number | null; valor: number | null; estado: Estado;
}

export function Stock({ visible, deposito, onDeposito }: { visible: boolean; deposito: string; onDeposito: (id: string) => void }) {
  const { datos, stock, costos } = useBase();

  const filas = useMemo<FilaStock[]>(() => datos.productos.map((p) => {
    const s = stock.enDeposito.get(p.id) ?? {};
    const transito = M.sumaDeps(stock.enTransito.get(p.id));
    const total = M.redondear(M.sumaDeps(s) + transito, 3);
    const costo = costos.get(p.id) ?? null;
    return {
      ...p, s, transito, total, costo,
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
          <Stack gap="md">
            <StockPorDeposito deposito={deposito} onDeposito={onDeposito} />
            <StockTotal filas={filas} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 'content' }} w={{ md: 340 }}>
          <AjusteStock />
        </Grid.Col>
      </Grid>

      {visible && <GraficoStock filas={filas} deposito={deposito} />}
    </Stack>
  );
}

interface Columna<F> { key: string; titulo: string; num?: boolean; valor: (f: F) => string | number | null }
interface Orden { key: string; dir: number }

function ordenar<F>(filas: F[], cols: Columna<F>[], orden: Orden) {
  const valor = cols.find((c) => c.key === orden.key)?.valor ?? (() => null);
  return [...filas].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null) return 1;
    if (vb === null) return -1;
    return (typeof va === 'string' ? va.localeCompare(vb as string, 'es') : va - (vb as number)) * orden.dir;
  });
}

function Cabecera<F>({ cols, orden, onOrden }: { cols: Columna<F>[]; orden: Orden; onOrden: (o: Orden) => void }) {
  return (
    <Table.Thead>
      <Table.Tr>
        {cols.map((c) => (
          <Table.Th key={c.key} className={c.num === true ? 'num' : undefined}>
            <UnstyledButton fz="sm" fw={700} onClick={() => { onOrden({ key: c.key, dir: orden.key === c.key ? -orden.dir : 1 }); }}>
              <Group gap={2} wrap="nowrap" justify={c.num === true ? 'flex-end' : undefined}>
                {c.titulo}
                {orden.key === c.key && (orden.dir > 0 ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />)}
              </Group>
            </UnstyledButton>
          </Table.Th>
        ))}
      </Table.Tr>
    </Table.Thead>
  );
}

const guion = (v: number) => (v !== 0 ? fmtNum(v) : '–');

// Una fila por producto y depósito. Lo que viene en camino cuenta para el depósito de destino.
interface FilaDeposito {
  id: string; producto: string; unidad: string;
  enDeposito: number; camino: number; comprometido: number; faltante: number;
}

const COLS_DEPOSITO: Columna<FilaDeposito>[] = [
  { key: 'producto', titulo: 'Producto', valor: (f) => f.producto }, { key: 'unidad', titulo: 'Unidad', valor: (f) => f.unidad },
  { key: 'enDeposito', titulo: 'En depósito', num: true, valor: (f) => f.enDeposito },
  { key: 'camino', titulo: 'En camino', num: true, valor: (f) => f.camino },
  { key: 'comprometido', titulo: 'Comprometido', num: true, valor: (f) => f.comprometido },
];

// Orden en celular, donde no hay encabezados de columna para tocar.
interface OpcionOrden { value: string; label: string; orden: Orden }

function SelectorOrden({ opciones, orden, onOrden }: { opciones: OpcionOrden[]; orden: Orden; onOrden: (o: Orden) => void }) {
  const actual = opciones.find((o) => o.orden.key === orden.key && o.orden.dir === orden.dir)?.value ?? '';
  return (
    <NativeSelect aria-label="Ordenar" hiddenFrom="sm" value={actual} data={opciones.map(({ value, label }) => ({ value, label }))}
      onChange={(e) => { const o = opciones.find((x) => x.value === e.currentTarget.value); if (o) onOrden(o.orden); }} />
  );
}

const ORDEN_DEPOSITO: OpcionOrden[] = [
  { value: 'producto', label: 'Por producto', orden: { key: 'producto', dir: 1 } },
  { value: 'mas', label: 'Más stock primero', orden: { key: 'enDeposito', dir: -1 } },
  { value: 'menos', label: 'Menos stock primero', orden: { key: 'enDeposito', dir: 1 } },
  { value: 'comprometido', label: 'Más comprometido primero', orden: { key: 'comprometido', dir: -1 } },
];

// Un grupo por depósito con los productos que tienen algo ahí: stock, algo en camino o pedidos por entregar.
// `deposito` vacío muestra todos los grupos; si no, solo el de ese depósito. Lo elige el selector de la tabla
// o el ícono del depósito en el mapa de Inicio. En escritorio es una tabla; en celular, una tarjeta por producto.
function StockPorDeposito({ deposito, onDeposito }: { deposito: string; onDeposito: (id: string) => void }) {
  const { datos, stock, cargando } = useBase();
  const fila = useFila();
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState('');
  const [orden, setOrden] = useState<Orden>({ key: 'producto', dir: 1 });

  const grupos = useMemo(() => datos.depositos.map((d) => ({
    deposito: d,
    filas: datos.productos.map((p): FilaDeposito => {
      const de = (m: Map<string, M.PorDeposito>) => m.get(p.id)?.[d.id] ?? 0;
      return {
        id: p.id, producto: p.producto, unidad: p.unidad, enDeposito: de(stock.enDeposito), camino: de(stock.enTransito),
        comprometido: de(stock.comprometido), faltante: M.faltante(stock, p.id, d.id),
      };
    }).filter((f) => f.enDeposito !== 0 || f.camino !== 0 || f.comprometido !== 0),
  })), [datos, stock]);

  const q = buscar.trim().toLowerCase();
  const visibles = grupos
    .filter((g) => !deposito || g.deposito.id === deposito)
    .map((g) => ({
      ...g,
      filas: ordenar(g.filas
        .filter((f) => !q || f.producto.toLowerCase().includes(q))
        .filter((f) => !filtro
          || (filtro === 'con' && f.enDeposito > 0)
          || (filtro === 'neg' && f.enDeposito < 0)
          || (filtro === 'falta' && f.faltante > 0)), COLS_DEPOSITO, orden),
    }))
    .filter((g) => g.filas.length > 0);

  const nombreGrupo = (d: M.Deposito) => (
    <>
      {d.nombre}
      {d.localidad && d.localidad !== d.nombre && <Text span c="dimmed" fz="sm" fw={400}> · {d.localidad}</Text>}
    </>
  );
  const faltan = (f: FilaDeposito) => (f.faltante > 0 ? `Faltan ${fmtNum(f.faltante)} ${f.unidad}` : undefined);

  return (
    <Seccion>
      <Encabezado titulo="Stock por depósito">
        <Group gap="xs">
          <TextInput type="search" w={{ base: '100%', sm: 200 }} placeholder="Buscar producto…" aria-label="Buscar producto"
            value={buscar} onChange={(e) => { setBuscar(e.currentTarget.value); }} />
          <NativeSelect aria-label="Mostrar depósito" value={deposito} onChange={(e) => { onDeposito(e.currentTarget.value); }} data={[
            { value: '', label: 'Todos los depósitos' }, ...datos.depositos.map((d) => ({ value: d.id, label: d.nombre })),
          ]} />
          <NativeSelect aria-label="Filtrar" value={filtro} onChange={(e) => { setFiltro(e.currentTarget.value); }} data={[
            { value: '', label: 'Todos' }, { value: 'con', label: 'Con stock' },
            { value: 'neg', label: 'Stock negativo' }, { value: 'falta', label: 'Faltan para pedidos' },
          ]} />
          <SelectorOrden opciones={ORDEN_DEPOSITO} orden={orden} onOrden={setOrden} />
        </Group>
      </Encabezado>
      <ScrollArea.Autosize mah={560} type="auto" visibleFrom="sm">
        <Table stickyHeader highlightOnHover fz="sm" aria-label="Stock por depósito"
          style={{ opacity: cargando ? 0.5 : 1, whiteSpace: 'nowrap' }}>
          <Cabecera cols={COLS_DEPOSITO} orden={orden} onOrden={setOrden} />
          {visibles.map((g) => (
            <Table.Tbody key={g.deposito.id} aria-label={g.deposito.nombre}>
              <Table.Tr className="grupo">
                <Table.Th colSpan={COLS_DEPOSITO.length} scope="colgroup">{nombreGrupo(g.deposito)}</Table.Th>
              </Table.Tr>
              {g.filas.map((f) => (
                <Table.Tr key={f.id} {...fila({ tipo: 'producto', id: f.id })}>
                  <Table.Td fw={500} miw={180} style={{ whiteSpace: 'normal' }}><Vinculo a={{ tipo: 'producto', id: f.id }}>{f.producto}</Vinculo></Table.Td>
                  <Table.Td c="dimmed">{f.unidad}</Table.Td>
                  <Table.Td className="num" c={f.enDeposito < 0 ? 'red' : undefined} fw={f.enDeposito < 0 ? 600 : undefined}>{fmtNum(f.enDeposito)}</Table.Td>
                  <Table.Td className="num" c="dimmed">{guion(f.camino)}</Table.Td>
                  <Table.Td className="num" c={f.faltante > 0 ? 'yellow.8' : 'dimmed'} fw={f.faltante > 0 ? 600 : undefined} title={faltan(f)}>
                    {guion(f.comprometido)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          ))}
        </Table>
      </ScrollArea.Autosize>
      <Box component="section" aria-label="Stock por depósito" hiddenFrom="sm" style={{ opacity: cargando ? 0.5 : 1 }}>
        <Stack gap="md">
          {visibles.map((g) => (
            <Box component="section" key={g.deposito.id} aria-label={g.deposito.nombre}>
              <Title order={3} size="h5" mb="xs">{nombreGrupo(g.deposito)}</Title>
              <Stack gap="xs">
                {g.filas.map((f) => (
                  <Tarjeta key={f.id} producto={f} {...fila({ tipo: 'producto', id: f.id })}
                    principal={<Resumen label="En depósito" valor={fmtNum(f.enDeposito)} c={f.enDeposito < 0 ? 'red' : undefined} />}
                    nota={f.faltante > 0 && <Text size="sm" c="yellow.8" fw={600} mt={6}>{faltan(f)} para pedidos.</Text>}>
                    <Resumen label="En camino" valor={guion(f.camino)} />
                    <Resumen label="Comprometido" valor={guion(f.comprometido)} c={f.faltante > 0 ? 'yellow.8' : undefined} />
                  </Tarjeta>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
      {visibles.length === 0 && <Text c="dimmed" mt="xs">No hay productos que coincidan.</Text>}
    </Seccion>
  );
}

// Una fila de tabla en celular: arriba el producto (con su estado, si hay) y su dato principal; debajo, en una
// fila, los demás datos con su etiqueta.
function Tarjeta({ producto, estado, principal, nota, children, ...props }: {
  producto: { id: string; producto: string; unidad: string }; estado?: Estado; principal: React.ReactNode;
  nota?: React.ReactNode; children: React.ReactNode[];
} & ReturnType<ReturnType<typeof useFila>>) {
  return (
    <Paper component="article" aria-label={producto.producto} p="sm" radius="md" {...props}>
      <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
        <Stack gap={4} align="flex-start" miw={0}>
          <Text fw={600}>
            <Vinculo a={{ tipo: 'producto', id: producto.id }}>{producto.producto}</Vinculo>
            <Text span c="dimmed" fz="sm" fw={400}> · {producto.unidad}</Text>
          </Text>
          {estado && <Badge variant="light" color={estado.color} size="sm">{estado.texto}</Badge>}
        </Stack>
        <Box ta="right" style={{ whiteSpace: 'nowrap' }}>{principal}</Box>
      </Group>
      <SimpleGrid cols={children.length} spacing="xs" mt="xs">{children}</SimpleGrid>
      {nota}
    </Paper>
  );
}

const COLS_TOTAL: Columna<FilaStock>[] = [
  { key: 'producto', titulo: 'Producto', valor: (f) => f.producto }, { key: 'unidad', titulo: 'Unidad', valor: (f) => f.unidad },
  { key: 'depositos', titulo: 'En depósitos', num: true, valor: (f) => M.sumaDeps(f.s) },
  { key: 'transito', titulo: 'En camino', num: true, valor: (f) => f.transito },
  { key: 'total', titulo: 'Total', num: true, valor: (f) => f.total },
  { key: 'minimo', titulo: 'Mínimo', num: true, valor: (f) => f.minimo },
  { key: 'estado', titulo: 'Estado', valor: (f) => f.estado.urgencia },
];

const ORDEN_TOTAL: OpcionOrden[] = [
  { value: 'producto', label: 'Por producto', orden: { key: 'producto', dir: 1 } },
  { value: 'menos', label: 'Menos stock primero', orden: { key: 'total', dir: 1 } },
  { value: 'mas', label: 'Más stock primero', orden: { key: 'total', dir: -1 } },
  { value: 'estado', label: 'Más urgente primero', orden: { key: 'estado', dir: 1 } },
];

// Una fila por producto con el stock de todos los depósitos más lo que está en camino, contra su mínimo.
// En escritorio es una tabla; en celular, una tarjeta por producto.
function StockTotal({ filas }: { filas: FilaStock[] }) {
  const { cargando } = useBase();
  const fila = useFila();
  const [filtro, setFiltro] = useState('');
  const [orden, setOrden] = useState<Orden>({ key: 'producto', dir: 1 });

  const visibles = ordenar(filas.filter((f) => !filtro
    || (filtro === 'con' && minimoDe(f) !== 0)
    || (filtro === 'bajo' && bajoMinimo(f))), COLS_TOTAL, orden);

  return (
    <Seccion>
      <Encabezado titulo="Stock total">
        <Group gap="xs">
          <NativeSelect aria-label="Filtrar stock total" value={filtro} onChange={(e) => { setFiltro(e.currentTarget.value); }} data={[
            { value: '', label: 'Todos' }, { value: 'con', label: 'Con mínimo' }, { value: 'bajo', label: 'Bajo el mínimo' },
          ]} />
          <SelectorOrden opciones={ORDEN_TOTAL} orden={orden} onOrden={setOrden} />
        </Group>
      </Encabezado>
      <ScrollArea.Autosize mah={560} type="auto" visibleFrom="sm">
        <Table stickyHeader highlightOnHover fz="sm" aria-label="Stock total"
          style={{ opacity: cargando ? 0.5 : 1, whiteSpace: 'nowrap' }}>
          <Cabecera cols={COLS_TOTAL} orden={orden} onOrden={setOrden} />
          <Table.Tbody>
            {visibles.map((f) => (
              <Table.Tr key={f.id} {...fila({ tipo: 'producto', id: f.id })}>
                <Table.Td fw={500} miw={180} style={{ whiteSpace: 'normal' }}><Vinculo a={{ tipo: 'producto', id: f.id }}>{f.producto}</Vinculo></Table.Td>
                <Table.Td c="dimmed">{f.unidad}</Table.Td>
                <Table.Td className="num">{fmtNum(M.sumaDeps(f.s))}</Table.Td>
                <Table.Td className="num" c="dimmed">{guion(f.transito)}</Table.Td>
                <Table.Td className="num" fw={600} c={f.total < 0 ? 'red' : undefined}>{fmtNum(f.total)}</Table.Td>
                <Table.Td className="num" c="dimmed">{guion(minimoDe(f))}</Table.Td>
                <Table.Td><Badge variant="light" color={f.estado.color} size="sm">{f.estado.texto}</Badge></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      <Stack component="section" aria-label="Stock total" gap="xs" hiddenFrom="sm" style={{ opacity: cargando ? 0.5 : 1 }}>
        {visibles.map((f) => (
          <Tarjeta key={f.id} producto={f} estado={f.estado} {...fila({ tipo: 'producto', id: f.id })}
            principal={<Resumen label="Total" valor={fmtNum(f.total)} c={f.total < 0 ? 'red' : undefined} />}>
            <Resumen label="Mínimo" valor={guion(minimoDe(f))} />
            <Resumen label="En depósitos" valor={fmtNum(M.sumaDeps(f.s))} />
            <Resumen label="En camino" valor={guion(f.transito)} />
          </Tarjeta>
        ))}
      </Stack>
      {visibles.length === 0 && <Text c="dimmed" mt="xs">No hay productos que coincidan.</Text>}
    </Seccion>
  );
}

function AjusteStock() {
  const { datos, stock, buscarProducto, nombres, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [producto, setProducto] = useState('');
  const [depSel, setDepSel] = useState<string | null>(null);
  const deposito = depSel ?? datos.depositos.at(0)?.id ?? '';
  const [cantidadTxt, setCantidadTxt] = useState<number | string>('');
  const [motivo, setMotivo] = useState('');
  const productos = useMemo(() => unicos(datos.productos.map((p) => p.producto)), [datos]);

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
      await db.registrarAjuste({ fecha: new Date(), depositoId: deposito, productoId: p.id, cantidad, motivo: mot });
      setCantidadTxt('');
      setMotivo('');
      return `✓ Ajuste registrado: ${cantidad > 0 ? '+' : ''}${fmtNum(cantidad)} ${p.unidad} de ${p.producto}.`;
    });
  }

  return (
    <Seccion>
      <Encabezado titulo="Ajuste de stock" />
      <Text size="sm" c="dimmed" mt={-8} mb="sm">Para corregir diferencias. Para restar, usá un número negativo.</Text>
      <form onSubmit={enviar} noValidate aria-label="Ajuste de stock">
        <Stack gap="sm">
          <Autocomplete label="Producto" placeholder="Buscar producto…" data={productos} value={producto} onChange={setProducto} />
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
              Stock en {nombres.deposito(deposito)}: {fmtNum(antes)} → <strong>{fmtNum(M.redondear(antes + cantidad, 3))} {p.unidad}</strong>
            </Text>
          ) : producto && !p ? (
            <Text size="sm" className="suave" px="sm" py={8}>No existe ese producto.</Text>
          ) : null}
          <Button type="submit" loading={guardando}>Registrar ajuste</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
    </Seccion>
  );
}

const COLORES = ['var(--c1)', 'var(--c2)', 'var(--c3)'];

function GraficoStock({ filas, deposito }: { filas: FilaStock[]; deposito: string }) {
  const { datos } = useBase();
  const deps = datos.depositos.filter((d) => !deposito || d.id === deposito);
  const enDeps = (f: FilaStock) => deps.reduce((a, d) => a + Math.max(0, f.s[d.id] ?? 0), 0);
  const unidades = unicos(filas.map((f) => f.unidad));
  const [elegida, setElegida] = useState<string | null>(null);
  const unidad = elegida && unidades.includes(elegida) ? elegida : unidades.includes('kg') ? 'kg' : unidades[0];

  const items = filas
    .filter((f) => f.unidad === unidad && enDeps(f) > 0)
    .sort((a, b) => enDeps(b) - enDeps(a))
    .slice(0, 12)
    .map((f) => ({ producto: f.producto, ...Object.fromEntries(deps.map((d) => [d.nombre, Math.max(0, f.s[d.id] ?? 0)])) }));

  return (
    <Seccion>
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
        series={deps.map((d) => ({ name: d.nombre, color: COLORES[datos.depositos.indexOf(d) % COLORES.length] }))}
        valueFormatter={(v) => `${fmtNum(v)} ${unidad}`}
        yAxisProps={{ width: 180 }}
        gridAxis="x"
        aria-label="Stock por producto y depósito"
      />
    </Seccion>
  );
}
