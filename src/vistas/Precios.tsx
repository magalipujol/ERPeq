import { ActionIcon, Alert, Anchor, Autocomplete, Button, Code, Grid, Group, Modal, NativeSelect, NumberInput, ScrollArea, Stack, Table, Text, TextInput, Title, useMatches } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useBase, useGuardar } from '../base';
import { faltantesDe } from '../db/puerto';
import { Confirmacion, Encabezado, Mensaje, Seccion } from '../componentes/comunes';
import { Vinculo } from '../componentes/Fichas';
import { aISO, aNumero, deISO, fmtFecha, fmtMoney, fmtNum, hoyISO, unicos } from '../formato';
import * as M from '../dominio/modelo';

// Valores por defecto con fecha `desde`: cada cambio es una fila nueva. Los pedidos y ventas ya cargados guardan su
// precio, su envío y su comisión; el costo de una venta es el vigente a su fecha.
export function Precios() {
  return (
    <Stack gap="md">
      <Title order={2} className="titulo-pantalla">Precios y envíos</Title>
      <Text c="dimmed" maw="70ch">
        Los precios y el envío se proponen al cargar pedidos y entregas. Cambiarlos no modifica lo ya cargado.
      </Text>
      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6 }}><ListaPrecios /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}><ReglasEnvio /></Grid.Col>
      </Grid>
    </Stack>
  );
}

export function Costos() {
  return (
    <Stack gap="md" maw={720}>
      <Title order={2} className="titulo-pantalla">Costos de compra</Title>
      <ListaCostos />
    </Stack>
  );
}

export function Comisiones() {
  return (
    <Stack gap="md" maw={720}>
      <Title order={2} className="titulo-pantalla">Comisiones</Title>
      <Text c="dimmed" maw="70ch">
        El porcentaje se propone al cargar cada venta. Cambiarlo no modifica las ventas ya cargadas.
      </Text>
      <ReglasComision />
    </Stack>
  );
}

// Valor por producto con su fecha `desde`: el precio de lista o el costo.
interface ValorDesde { productoId: string; valor: number; desde: Date | null }

function ListaPrecios() {
  const { datos, db } = useBase();
  return (
    <ListaPorProducto titulo="Lista de precios" que="precio" valores={datos.precios.map((p) => ({ ...p, valor: p.precio }))}
      registrar={async (productoId, precio, desde) => db.registrarPrecio({ productoId, precio, desde })} />
  );
}

// El costo de cada venta es el vigente a su fecha: un costo con `desde` anterior cambia la ganancia de las ventas
// desde ese día.
function ListaCostos() {
  const { datos, db } = useBase();
  return (
    <ListaPorProducto titulo="Costos" que="costo" valores={datos.costos.map((c) => ({ ...c, valor: c.costo }))}
      registrar={async (productoId, costo, desde) => db.registrarCosto({ productoId, costo, desde })}
      corregir={async (productoId, lista) => db.corregirCostos(productoId, lista.map((x) => ({ productoId, costo: x.valor, desde: x.desde })))}
      nota="La ganancia de cada venta usa el costo vigente a su fecha. Las compras pueden actualizarlo." />
  );
}

type Registrar = (productoId: string, valor: number, desde: Date) => Promise<void>;
// Reemplaza todos los valores de un producto: así se corrige o se borra uno.
type Corregir = (productoId: string, valores: ValorDesde[]) => Promise<void>;

// Sin mayúsculas ni acentos, para buscar.
const normal = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// El valor vigente hoy: el último con `desde` hasta hoy (sin `desde`, vale desde siempre).
function vigenteHoy(valores: ValorDesde[], hoy: Date) {
  return valores.filter((x) => !x.desde || x.desde <= hoy)
    .reduce<ValorDesde | null>((m, x) => (!m || (x.desde?.getTime() ?? 0) >= (m.desde?.getTime() ?? 0) ? x : m), null);
}

function ListaPorProducto({ titulo, que, valores, registrar, corregir, nota }: {
  titulo: string; que: 'precio' | 'costo'; valores: ValorDesde[]; nota?: string; registrar: Registrar; corregir?: Corregir;
}) {
  const { datos, cargando } = useBase();
  const enCelular = useMatches({ base: true, sm: false });
  const [buscar, setBuscar] = useState('');
  const [elegido, setElegido] = useState<M.Producto | null>(null);
  const [hoy] = useState(() => new Date());
  const Que = que === 'precio' ? 'Precio' : 'Costo';

  const filas = datos.productos
    .map((p) => ({ p, actual: vigenteHoy(valores.filter((x) => x.productoId === p.id), hoy) }))
    .filter((f) => normal(f.p.producto).includes(normal(buscar)))
    .sort((a, b) => a.p.producto.localeCompare(b.p.producto, 'es'));

  return (
    <Seccion>
      <Encabezado titulo={titulo} />
      {nota && <Text size="sm" c="dimmed" mb="xs">{nota}</Text>}
      <FormValor que={que} registrar={registrar} />
      {/* Junto a la tabla: en el celular, lo que encuentra queda a la vista. */}
      <TextInput type="search" mb="xs" placeholder="Buscar producto…" aria-label={`Buscar ${que}`}
        value={buscar} onChange={(e) => { setBuscar(e.currentTarget.value); }} />
      <ScrollArea.Autosize mah={480} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }} aria-label={titulo}>
          <Table.Thead>
            <Table.Tr><Table.Th>Producto</Table.Th><Table.Th className="num">{Que}</Table.Th><Table.Th>Desde</Table.Th></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map(({ p, actual }) => (
              <Table.Tr key={p.id} className="fila-ficha"
                onClick={() => { if (!window.getSelection()?.toString()) setElegido(p); }}>
                <Table.Td>
                  <Anchor component="button" type="button" inherit ta="left"
                    onClick={(e) => { e.stopPropagation(); setElegido(p); }}>{p.producto}</Anchor>
                </Table.Td>
                <Table.Td className="num" c={actual ? undefined : 'dimmed'}>{actual ? fmtMoney(actual.valor) : `Sin ${que}`}</Table.Td>
                <Table.Td c="dimmed">{actual ? fmtFecha(actual.desde) : ''}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      <Modal opened={elegido !== null} onClose={() => { setElegido(null); }} title={elegido ? `${Que} de ${elegido.producto}` : ''}
        fullScreen={enCelular}>
        {elegido && <HistorialValor que={que} producto={elegido} hoy={hoy} registrar={registrar} corregir={corregir}
          valores={valores.filter((x) => x.productoId === elegido.id)} />}
      </Modal>
    </Seccion>
  );
}

// Historial de un producto: todos sus valores, del más nuevo al más viejo, con el vigente marcado y los que todavía
// no rigen. Arriba, el formulario para cargar uno nuevo. Con `corregir`, cada valor se puede editar o borrar.
function HistorialValor({ que, producto, valores, hoy, registrar, corregir }: {
  que: 'precio' | 'costo'; producto: M.Producto; valores: ValorDesde[]; hoy: Date; registrar: Registrar; corregir?: Corregir;
}) {
  const { guardando, msg, guardar, error } = useGuardar();
  // Posición en `valores` (el orden de la hoja) del que se edita o se borra.
  const [editando, setEditando] = useState<number | null>(null);
  const [valorTxt, setValorTxt] = useState<number | string>('');
  const [desde, setDesde] = useState('');
  const [borrando, setBorrando] = useState<number | null>(null);
  const vigente = vigenteHoy(valores, hoy);
  const filas = valores.map((x, i) => ({ x, i })).toSorted((a, b) => (b.x.desde?.getTime() ?? 0) - (a.x.desde?.getTime() ?? 0));
  const Que = que === 'precio' ? 'Precio' : 'Costo';
  const fecha = (x: ValorDesde) => (x.desde ? fmtFecha(x.desde) : 'Siempre');

  function editar(i: number, x: ValorDesde) {
    setEditando(i);
    setValorTxt(x.valor);
    setDesde(x.desde ? aISO(x.desde) : '');
  }

  function guardarEdicion(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const valor = aNumero(valorTxt);
    const anterior = editando === null ? undefined : valores[editando];
    if (!anterior || !corregir) return;
    if (!(valor > 0)) { error(`Ingresá un ${que} mayor a 0.`); return; }
    if (!desde) { error('Elegí desde qué fecha rige.'); return; }
    const nuevo = { ...anterior, valor, desde: deISO(desde) };
    guardar(async () => {
      await corregir(producto.id, valores.map((x, i) => (i === editando ? nuevo : x)));
      setEditando(null);
      return `✓ Corregido: ${fmtMoney(valor)} desde ${fmtFecha(nuevo.desde)}.`;
    });
  }

  function borrar() {
    const i = borrando;
    const x = i === null ? undefined : valores[i];
    setBorrando(null);
    if (!x || !corregir) return;
    guardar(async () => {
      await corregir(producto.id, valores.filter((_, j) => j !== i));
      return `✓ Borrado el ${que} de ${fmtMoney(x.valor)} (${fecha(x)}).`;
    });
  }

  return (
    <Stack gap="md">
      <FormValor que={que} registrar={registrar} producto={producto} />
      {filas.length === 0 ? <Text c="dimmed">{producto.producto} todavía no tiene {que}.</Text> : (
        <Table fz="sm" aria-label={`Historial de ${que}`}>
          <Table.Thead>
            <Table.Tr><Table.Th>Desde</Table.Th><Table.Th className="num">{Que}</Table.Th><Table.Th /></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map(({ x, i }) => (i === editando ? (
              <Table.Tr key={i}>
                <Table.Td colSpan={3}>
                  <form onSubmit={guardarEdicion} noValidate aria-label={`Corregir ${que}`}>
                    <Stack gap="xs">
                      <Group grow gap="xs" align="flex-start">
                        <NumberInput label={Que} allowNegative={false} value={valorTxt} onChange={setValorTxt}
                          leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none" />
                        <TextInput label="Desde" type="date" value={desde} onChange={(e) => { setDesde(e.currentTarget.value); }} />
                      </Group>
                      <Group gap="xs" justify="flex-end">
                        <Button variant="default" onClick={() => { setEditando(null); }}>Cancelar</Button>
                        <Button type="submit" loading={guardando}>Guardar</Button>
                      </Group>
                    </Stack>
                  </form>
                </Table.Td>
              </Table.Tr>
            ) : (
              // Los valores no tienen ID: la clave es su posición en la hoja.
              <Table.Tr key={i} fw={x === vigente ? 700 : undefined}>
                <Table.Td>
                  {fecha(x)}
                  <Text size="xs" c="dimmed" fw={400}>{x === vigente ? 'Vigente' : x.desde && x.desde > hoy ? 'Todavía no rige' : ''}</Text>
                </Table.Td>
                <Table.Td className="num">{fmtMoney(x.valor)}</Table.Td>
                <Table.Td>
                  {corregir && (
                    <Group gap={4} wrap="nowrap" justify="flex-end">
                      <ActionIcon variant="subtle" size="lg" aria-label={`Editar ${que} de ${fecha(x)}`}
                        disabled={guardando} onClick={() => { editar(i, x); }}><IconPencil size={18} /></ActionIcon>
                      <ActionIcon variant="subtle" color="red" size="lg" aria-label={`Borrar ${que} de ${fecha(x)}`}
                        disabled={guardando} onClick={() => { setBorrando(i); }}><IconTrash size={18} /></ActionIcon>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            )))}
          </Table.Tbody>
        </Table>
      )}
      <Mensaje msg={msg} />
      <Text size="sm"><Vinculo a={{ tipo: 'producto', id: producto.id }}>Ver la ficha de {producto.producto}</Vinculo></Text>
      <Confirmacion abierta={borrando !== null} titulo={`¿Borrar este ${que}?`} si={`Sí, borrar ${que}`} peligro onSi={borrar}
        onNo={() => { setBorrando(null); }}>
        {borrando !== null && borrando < valores.length && (
          <Text size="sm">
            {producto.producto}: {fmtMoney(valores[borrando].valor)} ({fecha(valores[borrando])}). Desde su fecha rige el {que} anterior; si
            no hay, las ventas de esos días quedan sin {que}.
          </Text>
        )}
      </Confirmacion>
    </Stack>
  );
}

// Carga un precio o costo con su fecha `desde`. Con `producto`, es el de ese producto y no se elige.
function FormValor({ que, registrar, producto: fijo }: { que: 'precio' | 'costo'; registrar: Registrar; producto?: M.Producto }) {
  const { datos, buscarProducto } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [producto, setProducto] = useState('');
  const [valorTxt, setValorTxt] = useState<number | string>('');
  const [desde, setDesde] = useState(hoyISO);
  const productos = useMemo(() => unicos(datos.productos.map((p) => p.producto)), [datos]);
  const Que = que === 'precio' ? 'Precio' : 'Costo';

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = fijo ?? buscarProducto(producto);
    const valor = aNumero(valorTxt);
    if (!p) { error('Elegí un producto de la lista.'); return; }
    if (!(valor > 0)) { error(`Ingresá un ${que} mayor a 0.`); return; }
    if (!desde) { error('Elegí desde qué fecha rige.'); return; }
    guardar(async () => {
      await registrar(p.id, valor, deISO(desde));
      setValorTxt('');
      return `✓ ${p.producto}: ${fmtMoney(valor)} desde ${fmtFecha(deISO(desde))}.`;
    });
  }

  return (
    <form onSubmit={enviar} noValidate aria-label={`Cambiar ${que}`}>
      <Stack gap="xs" mb="sm">
        {!fijo && <Autocomplete label="Producto" data={productos} value={producto} onChange={setProducto} />}
        <Group grow gap="xs" align="flex-start">
          <NumberInput label={Que} allowNegative={false} value={valorTxt} onChange={setValorTxt}
            leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none" />
          <TextInput label="Desde" type="date" value={desde} onChange={(e) => { setDesde(e.currentTarget.value); }} />
        </Group>
        <Button type="submit" loading={guardando}>Guardar {que}</Button>
        <Mensaje msg={msg} />
      </Stack>
    </form>
  );
}

function ReglasComision() {
  const { datos, buscarProducto, nombres, db, cargando } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [vendedor, setVendedor] = useState(datos.vendedores.at(0)?.id ?? '');
  const [producto, setProducto] = useState('');
  const [pctTxt, setPctTxt] = useState<number | string>('');
  const [desde, setDesde] = useState(hoyISO);
  const productos = useMemo(() => unicos(datos.productos.map((p) => p.producto)), [datos]);
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
    const porVendedor = nombres.vendedor(a.vendedorId).localeCompare(nombres.vendedor(b.vendedorId), 'es');
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
      return `✓ ${nombres.vendedor(vendedor)}: ${fmtNum(pct)}% ${p ? `en ${p.producto}` : 'general'}.`;
    });
  }

  return (
    <Seccion>
      <Encabezado titulo="Reglas de comisión" />
      <form onSubmit={enviar} noValidate aria-label="Nueva regla de comisión">
        <Stack gap="xs" mb="sm">
          <Group grow gap="xs" align="flex-start">
            <NativeSelect label="Vendedor" data={datos.vendedores.map((v) => ({ value: v.id, label: v.nombre }))} value={vendedor}
              onChange={(e) => { setVendedor(e.currentTarget.value); }} />
            <Autocomplete label="Producto" placeholder="Todos" data={productos} value={producto} onChange={setProducto} />
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
      <ScrollArea type="auto">
        <Table highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }} aria-label="Reglas vigentes">
          <Table.Thead>
            <Table.Tr><Table.Th>Vendedor</Table.Th><Table.Th>Producto</Table.Th><Table.Th className="num">%</Table.Th><Table.Th>Desde</Table.Th></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((r) => (
              <Table.Tr key={`${r.vendedorId}|${r.productoId}`}>
                <Table.Td>{nombres.vendedor(r.vendedorId)}</Table.Td>
                <Table.Td c={r.productoId ? undefined : 'dimmed'}>{r.productoId ? nombreProducto.get(r.productoId) ?? r.productoId : 'Todos (general)'}</Table.Td>
                <Table.Td className="num">{fmtNum(r.porcentaje)}</Table.Td>
                <Table.Td c="dimmed">{fmtFecha(r.desde)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {filas.length === 0 && <Text c="dimmed" mt="xs" size="sm">No hay reglas: las comisiones se proponen en 0%.</Text>}
    </Seccion>
  );
}

// Costo de envío: las entregas de pedidos por menos del mínimo le cobran el envío al cliente. Cada cambio es una
// fila nueva con su `desde`; un costo de 0 deja de cobrarlo.
function ReglasEnvio() {
  const { datos, info, db, cargando } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const faltan = faltantesDe(info, 'envios');
  const [minimoTxt, setMinimoTxt] = useState<number | string>('');
  const [costoTxt, setCostoTxt] = useState<number | string>('');
  const [desde, setDesde] = useState(hoyISO);
  const [hoy] = useState(() => new Date());
  const vigente = M.reglaEnvio(datos.envios, hoy);
  const filas = datos.envios.toSorted((a, b) => (b.desde?.getTime() ?? 0) - (a.desde?.getTime() ?? 0));

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const minimo = aNumero(minimoTxt);
    const costo = aNumero(costoTxt);
    if (!(minimo >= 0)) { error('Ingresá el monto mínimo sin cargo de envío.'); return; }
    if (!(costo >= 0)) { error('Ingresá el costo del envío (0 para no cobrarlo).'); return; }
    if (!desde) { error('Elegí desde qué fecha rige.'); return; }
    guardar(async () => {
      await db.registrarReglaEnvio({ minimo, costo, desde: deISO(desde) });
      setMinimoTxt('');
      setCostoTxt('');
      return costo > 0
        ? `✓ Envío de ${fmtMoney(costo)} para pedidos por menos de ${fmtMoney(minimo)}, desde ${fmtFecha(deISO(desde))}.`
        : `✓ Desde ${fmtFecha(deISO(desde))} no se cobra envío.`;
    });
  }

  return (
    <Seccion>
      <Encabezado titulo="Costo de envío" />
      {faltan.length > 0 ? (
        <Alert color="yellow" title="Faltan hojas en la planilla">
          <Text size="sm" mb="xs">Para cobrar envíos, creá estas hojas con estos encabezados en la fila 1:</Text>
          {faltan.map((f) => <Text key={f.nombre} size="sm"><strong>{f.nombre}</strong>: <Code>{f.encabezados.join(', ')}</Code></Text>)}
        </Alert>
      ) : (
        <>
          <Text size="sm" mb="xs" c={vigente && vigente.costo > 0 ? undefined : 'dimmed'}>
            {vigente && vigente.costo > 0
              ? `Hoy: los pedidos por menos de ${fmtMoney(vigente.minimo)} pagan ${fmtMoney(vigente.costo)} de envío. El envío es para quien hace la entrega.`
              : 'Hoy no se cobra envío.'}
          </Text>
          <form onSubmit={enviar} noValidate aria-label="Cambiar costo de envío">
            <Stack gap="xs" mb="sm">
              <Group grow gap="xs" align="flex-start">
                <NumberInput label="Sin cargo desde" allowNegative={false} value={minimoTxt} onChange={setMinimoTxt}
                  leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none" />
                <NumberInput label="Costo del envío" allowNegative={false} value={costoTxt} onChange={setCostoTxt}
                  leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none" />
              </Group>
              <TextInput label="Desde" type="date" value={desde} onChange={(e) => { setDesde(e.currentTarget.value); }} />
              <Button type="submit" loading={guardando}>Guardar envío</Button>
              <Mensaje msg={msg} />
            </Stack>
          </form>
          {filas.length > 0 && (
            <ScrollArea type="auto">
              <Table highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }} aria-label="Costos de envío">
                <Table.Thead>
                  <Table.Tr><Table.Th className="num">Sin cargo desde</Table.Th><Table.Th className="num">Costo</Table.Th><Table.Th>Desde</Table.Th></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filas.map((r, i) => (
                    // Las reglas no tienen ID y no se reordenan: el índice alcanza como clave.
                    // eslint-disable-next-line @eslint-react/no-array-index-key
                    <Table.Tr key={i} fw={r === vigente ? 600 : undefined}>
                      <Table.Td className="num">{fmtMoney(r.minimo)}</Table.Td>
                      <Table.Td className="num">{r.costo > 0 ? fmtMoney(r.costo) : 'Sin cargo'}</Table.Td>
                      <Table.Td c="dimmed">{fmtFecha(r.desde)}{r === vigente ? ' (vigente)' : ''}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </>
      )}
    </Seccion>
  );
}
