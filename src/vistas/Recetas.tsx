import {
  Alert, Autocomplete, Badge, Button, Code, Grid, Group, NativeSelect, NumberInput, Paper, ScrollArea, SegmentedControl, Stack,
  Table, Text, TextInput, Title,
} from '@mantine/core';
import { useMemo, useRef, useState } from 'react';
import { useBase, useGuardar } from '../base';
import { Encabezado, Kpis, Mensaje } from '../componentes/comunes';
import { Vinculo } from '../componentes/Fichas';
import { useFila } from '../ficha';
import { type Item, itemVacio } from '../componentes/item';
import { Items } from '../componentes/Items';
import { faltantesDe } from '../db/puerto';
import { aNumero, deISO, fmtFecha, fmtMoney, fmtNum, hoyISO, porFechaDesc, unicos } from '../formato';
import * as M from '../dominio/modelo';

// Recetas (qué insumos llevan y cuánto sale) y su fabricación, que descuenta los insumos del stock y suma el
// producto. Ver spec/recetas.md.
export function Recetas() {
  const { datos, info } = useBase();
  const faltan = faltantesDe(info, 'recetas');
  const [hoy] = useState(() => new Date());
  const vigentes = useMemo(() => M.recetasVigentes(datos, hoy), [datos, hoy]);
  const hechas = useMemo(() => M.fabricaciones(datos.ajustes), [datos]);
  const activas = vigentes.filter((v) => v.receta.activa);
  // Receta que se está editando (su ID) y cuántas veces se eligió, para recargar el formulario. `aviso` es el
  // resultado del último guardado, que el formulario recargado sigue mostrando.
  const [editar, setEditar] = useState<{ id: string | null; vez: number; aviso?: string }>({ id: null, vez: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const elegir = (id: string | null) => {
    setEditar((e) => ({ id, vez: e.vez + 1 }));
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Stack gap="md">
      <Title order={2}>Recetas</Title>
      {faltan.length > 0 && (
        <Alert color="yellow" title="Faltan hojas en la planilla">
          <Text size="sm" mb="xs">Para cargar recetas y fabricar, creá estas hojas con estos encabezados en la fila 1:</Text>
          {faltan.map((f) => <Text key={f.nombre} size="sm"><strong>{f.nombre}</strong>: <Code>{f.encabezados.join(', ')}</Code></Text>)}
        </Alert>
      )}
      <Kpis label="Resumen de recetas" items={[
        { label: 'Recetas activas', valor: activas.length },
        { label: 'Fabricaciones del mes', valor: hechas.filter((f) => f.fecha !== null && M.claveMes(f.fecha) === M.claveMes(hoy)).length },
      ]} />
      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Fabricar activas={activas} hechas={hechas} deshabilitado={faltan.length > 0} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }} ref={editorRef} className="ancla">
          <EditorReceta key={editar.vez} vigentes={vigentes} recetaId={editar.id} aviso={editar.aviso}
            onListo={(aviso) => { setEditar((e) => ({ id: null, vez: e.vez + 1, aviso })); }} deshabilitado={faltan.length > 0} />
        </Grid.Col>
      </Grid>
      <ListaRecetas vigentes={vigentes} onEditar={elegir} deshabilitado={faltan.length > 0} />
      <ListaFabricaciones hechas={hechas} />
    </Stack>
  );
}

const unidadDe = (datos: M.Datos, productoId: string) => datos.productos.find((p) => p.id === productoId)?.unidad ?? '';

// ---------- Fabricar ----------

function Fabricar({ activas, hechas, deshabilitado }: { activas: M.VersionReceta[]; hechas: M.Fabricacion[]; deshabilitado: boolean }) {
  const { datos, stock, costos, nombres, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [recetaSel, setRecetaSel] = useState<string | null>(null);
  const [depSel, setDepSel] = useState<string | null>(null);
  const [fecha, setFecha] = useState(hoyISO);
  const [tandasTxt, setTandasTxt] = useState<number | string>(1);
  const [salioTxt, setSalioTxt] = useState<number | string>('');

  const opciones = [...activas].sort((a, b) =>
    nombres.producto(a.receta.productoId).localeCompare(nombres.producto(b.receta.productoId), 'es'));
  const elegida = opciones.find((v) => v.receta.id === recetaSel) ?? opciones.at(0);
  const deposito = depSel ?? datos.depositos.at(0)?.id ?? '';
  const tandas = aNumero(tandasTxt);
  const tandasOk = tandas > 0 ? tandas : 0;
  const insumos = (elegida?.items ?? []).map((it) => ({ productoId: it.productoId, cantidad: M.redondear(it.cantidad * tandasOk, 3) }));
  const propuesta = M.redondear((elegida?.receta.cantidad ?? 0) * tandasOk, 3);
  const salio = salioTxt === '' ? propuesta : aNumero(salioTxt);
  const unidad = elegida ? unidadDe(datos, elegida.receta.productoId) : '';
  const entra = M.sumaInsumos(insumos, datos.productos, unidad);
  const mermaReal = M.merma(entra, salio);
  const id = M.siguienteId(hechas.map((f) => f.id), 'FA');
  const costoUnitario = M.costoInsumos(insumos, salio, costos);

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!elegida) { error('No hay recetas activas: cargá una primero.'); return; }
    if (!deposito) { error('Elegí el depósito.'); return; }
    if (!fecha) { error('Elegí la fecha.'); return; }
    if (!(tandas > 0)) { error('Las tandas tienen que ser más de 0.'); return; }
    if (!(salio > 0)) { error('Ingresá cuánto salió.'); return; }
    const nombre = nombres.producto(elegida.receta.productoId);
    const ajustes = M.armarFabricacion({
      id, fecha: deISO(fecha), depositoId: deposito, recetaId: elegida.receta.id, version: elegida.receta.version,
      productoId: elegida.receta.productoId, cantidad: salio,
    }, insumos);
    guardar(async () => {
      await db.registrarFabricacion(ajustes);
      setSalioTxt('');
      return `✓ Fabricado: ${fmtNum(salio)} ${unidad} de ${nombre} en ${nombres.deposito(deposito)}.`;
    });
  }

  return (
    <Paper>
      <Encabezado titulo="Fabricar" />
      <form onSubmit={enviar} noValidate aria-label="Fabricar">
        <Stack gap="xs">
          <NativeSelect label="Receta" value={elegida?.receta.id ?? ''} onChange={(e) => { setRecetaSel(e.currentTarget.value); setSalioTxt(''); }}
            data={opciones.length > 0
              ? opciones.map((v) => ({ value: v.receta.id, label: nombres.producto(v.receta.productoId) }))
              : [{ value: '', label: 'No hay recetas activas' }]} />
          <Group grow gap="xs" align="flex-start">
            <NativeSelect label="Depósito" value={deposito} onChange={(e) => { setDepSel(e.currentTarget.value); }}
              data={datos.depositos.map((d) => ({ value: d.id, label: d.nombre }))} />
            <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.currentTarget.value); }} />
          </Group>
          <Group grow gap="xs" align="flex-start">
            <NumberInput label="Tandas" allowNegative={false} decimalScale={3} value={tandasTxt}
              onChange={(v) => { setTandasTxt(v); setSalioTxt(''); }}
              description={elegida ? `Una tanda: ${fmtNum(elegida.receta.cantidad)} ${unidad}` : undefined} />
            <NumberInput label="Salió" allowNegative={false} decimalScale={3} value={salioTxt} onChange={setSalioTxt}
              placeholder={fmtNum(propuesta)} description="Lo que pesó al terminar"
              rightSection={<Text size="xs" c="dimmed">{unidad}</Text>} rightSectionPointerEvents="none" />
          </Group>

          {elegida && (
            <Table fz="sm" aria-label="Insumos a descontar">
              <Table.Thead>
                <Table.Tr><Table.Th>Insumo</Table.Th><Table.Th className="num">Usa</Table.Th><Table.Th className="num">En {nombres.deposito(deposito)}</Table.Th></Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {insumos.map((i) => {
                  const hay = stock.enDeposito.get(i.productoId)?.[deposito] ?? 0;
                  const falta = i.cantidad > hay;
                  return (
                    <Table.Tr key={i.productoId}>
                      <Table.Td>{nombres.producto(i.productoId)}</Table.Td>
                      <Table.Td className="num">{fmtNum(i.cantidad)} {unidadDe(datos, i.productoId)}</Table.Td>
                      <Table.Td className="num" c={falta ? 'yellow.8' : 'dimmed'} fw={falta ? 600 : undefined}>
                        {fmtNum(hay)}{falta ? ' — no alcanza' : ''}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
          {elegida && (
            <Text size="sm" c="dimmed">
              {mermaReal !== null && <>Merma: {fmtNum(M.redondear(mermaReal * 100, 1))} % · </>}
              Insumos: {costoUnitario !== null ? `${fmtMoney(costoUnitario)} por ${unidad}` : 'sin costo (falta el de algún insumo)'}
            </Text>
          )}
          <Button type="submit" loading={guardando} disabled={deshabilitado || !elegida}>Registrar fabricación</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
    </Paper>
  );
}

// ---------- Alta, cambio y baja de recetas ----------

const deCantidad = (cantidad: number, unidad: string, gramos: boolean) => (gramos && unidad === 'kg' ? M.redondear(cantidad * 1000, 3) : cantidad);
const aCantidad = (valor: number, unidad: string, gramos: boolean) => (gramos && unidad === 'kg' ? M.redondear(valor / 1000, 6) : valor);

// Cada guardado es una versión nueva de la receta con su fecha `desde`; las fabricaciones ya hechas no cambian.
function EditorReceta({ vigentes, recetaId, aviso, onListo, deshabilitado }: {
  vigentes: M.VersionReceta[]; recetaId: string | null; aviso?: string; onListo: (aviso?: string) => void; deshabilitado: boolean;
}) {
  const { datos, nombres, buscarProducto, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const actual = vigentes.find((v) => v.receta.id === recetaId);
  const unidadSalidaActual = actual ? unidadDe(datos, actual.receta.productoId) : 'kg';
  const [gramos, setGramos] = useState(false);
  const [producto, setProducto] = useState(actual ? nombres.producto(actual.receta.productoId) : '');
  const [items, setItems] = useState<Item[]>(() => (actual
    ? actual.items.map((it) => ({ ...itemVacio(), producto: nombres.producto(it.productoId), cantidad: it.cantidad }))
    : [itemVacio()]));
  const [saleTxt, setSaleTxt] = useState<number | string>(actual ? actual.receta.cantidad : '');
  const [desde, setDesde] = useState(hoyISO);
  const productos = useMemo(() => unicos(datos.productos.map((p) => p.producto)), [datos]);

  const salida = buscarProducto(producto);
  const unidad = salida?.unidad ?? unidadSalidaActual;
  const [hoy] = useState(() => new Date());
  const precio = salida ? M.precioVigente(datos.precios, salida.id, hoy) : null;
  const lineas = items.filter((it) => it.producto.trim() !== '').map((it) => {
    const p = buscarProducto(it.producto);
    return { p, nombre: it.producto.trim(), cantidad: p ? aCantidad(aNumero(it.cantidad), p.unidad, gramos) : NaN };
  });
  const insumos = lineas.flatMap((l) => (l.p && l.cantidad > 0 ? [{ productoId: l.p.id, cantidad: l.cantidad }] : []));
  // Sin merma, sale lo mismo que entra: se propone la suma de los insumos de la misma unidad.
  const entra = M.sumaInsumos(insumos, datos.productos, unidad);
  const sale = saleTxt === '' ? entra : aCantidad(aNumero(saleTxt), unidad, gramos);
  const mermaPct = M.merma(entra, sale);

  // Cambiar entre kg y g convierte lo ya cargado.
  function cambiarGramos(g: boolean) {
    const conv = (v: number | string, u: string) =>
      (v === '' || Number.isNaN(aNumero(v)) ? v : deCantidad(aCantidad(aNumero(v), u, gramos), u, g));
    setItems(items.map((it) => ({ ...it, cantidad: conv(it.cantidad, buscarProducto(it.producto)?.unidad ?? '') })));
    setSaleTxt(conv(saleTxt, unidad));
    setGramos(g);
  }

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const nombre = producto.trim();
    if (!nombre) { error('Elegí qué producto sale de la receta.'); return; }
    if (!salida) { error(`No existe el producto "${nombre}": cargalo primero en Productos.`); return; }
    if (precio === null) { error(`${salida.producto} no tiene precio de lista: cargalo en Precios.`); return; }
    const malo = lineas.find((l) => !l.p);
    if (malo) { error(`No existe el insumo "${malo.nombre}".`); return; }
    if (lineas.some((l) => !(l.cantidad > 0))) { error('Cada insumo necesita una cantidad mayor a 0.'); return; }
    if (insumos.length === 0) { error('Agregá al menos un insumo.'); return; }
    if (insumos.some((i) => i.productoId === salida.id)) { error('El producto que sale no puede ser también un insumo.'); return; }
    if (new Set(insumos.map((i) => i.productoId)).size !== insumos.length) { error('Hay un insumo repetido: sumá las cantidades en una línea.'); return; }
    if (!(sale > 0)) { error('Ingresá cuánto sale de una tanda.'); return; }
    if (!desde) { error('Elegí desde qué fecha rige.'); return; }
    const otra = vigentes.find((v) => v.receta.activa && v.receta.productoId === salida.id && v.receta.id !== recetaId);
    if (otra) { error(`Ya hay una receta de ${nombre}: editala desde la lista.`); return; }

    const id = recetaId ?? M.siguienteId(datos.recetas.map((r) => r.id), 'RE');
    const version = M.siguienteVersion(datos.recetas, id);
    const receta: M.Receta = {
      id, version, desde: deISO(desde), productoId: salida.id, cantidad: M.redondear(sale, 6), activa: true,
    };
    guardar(async () => {
      await db.registrarReceta({ receta, items: insumos.map((i) => ({ recetaId: id, version, ...i })) });
      // Vacía el formulario: lo reemplaza por uno nuevo que muestra este aviso.
      const texto = `✓ Receta de ${nombre} guardada${version > 1 ? ` (versión ${version})` : ''}.`;
      onListo(texto);
      return texto;
    });
  }

  return (
    <Paper>
      <Encabezado titulo={actual ? `Editar receta de ${nombres.producto(actual.receta.productoId)}` : 'Nueva receta'}>
        <Group gap="xs">
          <SegmentedControl size="xs" value={gramos ? 'g' : 'kg'} onChange={(v) => { cambiarGramos(v === 'g'); }} aria-label="Cantidades en"
            data={[{ value: 'kg', label: 'kg' }, { value: 'g', label: 'g' }]} />
          {actual && <Button size="xs" variant="default" onClick={() => { onListo(); }}>Cancelar</Button>}
        </Group>
      </Encabezado>
      <form onSubmit={enviar} noValidate aria-label="Receta">
        <Stack gap="xs">
          <Autocomplete label="Producto que sale" placeholder="Nombre del producto" data={productos} value={producto} onChange={setProducto}
            disabled={actual !== undefined} />
          {producto.trim() !== '' && (
            !salida ? <Text size="xs" c="red">No existe ese producto: cargalo primero en Productos.</Text>
              : precio === null ? <Text size="xs" c="yellow.8" fw={500}>Sin precio de lista: cargalo en Precios.</Text>
                : <Text size="xs" c="dimmed">Precio de lista: {fmtMoney(precio)} por {salida.unidad}</Text>
          )}
          <Items modo="receta" deposito="" fecha={null} items={items} onChange={setItems} gramos={gramos} />
          <Group grow gap="xs" align="flex-start">
            <NumberInput label="Sale por tanda" allowNegative={false} decimalScale={6} value={saleTxt} onChange={setSaleTxt}
              placeholder={fmtNum(deCantidad(entra, unidad, gramos))}
              description={mermaPct !== null ? `Merma: ${fmtNum(M.redondear(mermaPct * 100, 1))} %` : 'Sin merma, sale lo que entra'}
              rightSection={<Text size="xs" c="dimmed">{gramos && unidad === 'kg' ? 'g' : unidad}</Text>} rightSectionPointerEvents="none" />
            <TextInput label="Desde" type="date" value={desde} onChange={(e) => { setDesde(e.currentTarget.value); }} />
          </Group>
          <Button type="submit" loading={guardando} disabled={deshabilitado}>{actual ? 'Guardar cambios' : 'Guardar receta'}</Button>
          <Mensaje msg={msg ?? (aviso === undefined ? null : { texto: aviso, error: false })} />
        </Stack>
      </form>
    </Paper>
  );
}

function ListaRecetas({ vigentes, onEditar, deshabilitado }:
  { vigentes: M.VersionReceta[]; onEditar: (id: string) => void; deshabilitado: boolean }) {
  const { datos, costos, nombres, cargando, db } = useBase();
  const { guardando, msg, guardar } = useGuardar();
  const fila = useFila();
  const [filtro, setFiltro] = useState('activas');
  const filas = vigentes
    .filter((v) => filtro === 'todas' || v.receta.activa)
    .sort((a, b) => nombres.producto(a.receta.productoId).localeCompare(nombres.producto(b.receta.productoId), 'es'));

  // Activar o dar de baja agrega una versión con los mismos insumos, desde hoy.
  function cambiarActiva({ receta, items }: M.VersionReceta, activa: boolean) {
    const version = M.siguienteVersion(datos.recetas, receta.id);
    const nombre = nombres.producto(receta.productoId);
    guardar(async () => {
      await db.registrarReceta({
        receta: { ...receta, version, desde: new Date(), activa },
        items: items.map((it) => ({ ...it, version })),
      });
      return activa ? `✓ Receta de ${nombre} activada.` : `✓ Receta de ${nombre} dada de baja.`;
    });
  }

  // Costo de los insumos de una tanda dividido lo que sale; sin costo si falta el de algún insumo.
  const costo = ({ receta, items }: M.VersionReceta) => M.costoInsumos(items, receta.cantidad, costos);
  const [hoy] = useState(() => new Date());

  return (
    <Paper>
      <Encabezado titulo="Recetas">
        <SegmentedControl size="xs" value={filtro} onChange={setFiltro} aria-label="Mostrar recetas"
          data={[{ value: 'activas', label: 'Activas' }, { value: 'todas', label: 'Todas' }]} />
      </Encabezado>
      <Mensaje msg={msg} />
      <ScrollArea type="auto">
        <Table highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }} aria-label="Lista de recetas">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Producto</Table.Th><Table.Th>Insumos por tanda</Table.Th><Table.Th className="num">Sale</Table.Th>
              <Table.Th className="num">Precio</Table.Th><Table.Th className="num">Costo insumos</Table.Th><Table.Th>Desde</Table.Th><Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((v) => {
              const unidad = unidadDe(datos, v.receta.productoId);
              const m = M.merma(M.sumaInsumos(v.items, datos.productos, unidad), v.receta.cantidad);
              const c = costo(v);
              const precio = M.precioVigente(datos.precios, v.receta.productoId, hoy);
              const nombre = nombres.producto(v.receta.productoId);
              return (
                <Table.Tr key={v.receta.id} aria-label={`Receta de ${nombre}`} {...fila({ tipo: 'producto', id: v.receta.productoId })}>
                  <Table.Td fw={500}>
                    <Vinculo a={{ tipo: 'producto', id: v.receta.productoId }}>{nombre}</Vinculo>
                    {!v.receta.activa && <Badge ml={6} size="sm" variant="light" color="gray">De baja</Badge>}
                  </Table.Td>
                  <Table.Td>
                    {v.items.map((it) => <Text key={it.productoId} size="xs">{fmtNum(it.cantidad)} {unidadDe(datos, it.productoId)} {nombres.producto(it.productoId)}</Text>)}
                  </Table.Td>
                  <Table.Td className="num">
                    {fmtNum(v.receta.cantidad)} {unidad}
                    {m !== null && m !== 0 && <Text size="xs" c="dimmed">merma {fmtNum(M.redondear(m * 100, 1))} %</Text>}
                  </Table.Td>
                  <Table.Td className="num" c={precio === null ? 'yellow.8' : undefined}>{precio === null ? 'Sin precio' : `${fmtMoney(precio)}/${unidad}`}</Table.Td>
                  <Table.Td className="num" c={c === null ? 'dimmed' : undefined}>{c === null ? 'Sin costo' : `${fmtMoney(c)}/${unidad}`}</Table.Td>
                  <Table.Td c="dimmed">
                    {fmtFecha(v.receta.desde)}
                    {v.receta.version > 1 && <Text size="xs">versión {v.receta.version}</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Button size="compact-sm" variant="light" onClick={() => { onEditar(v.receta.id); }} aria-label={`Editar ${nombre}`}>Editar</Button>
                      <Button size="compact-sm" variant="subtle" disabled={guardando || deshabilitado}
                        onClick={() => { cambiarActiva(v, !v.receta.activa); }} aria-label={`${v.receta.activa ? 'Dar de baja' : 'Activar'} ${nombre}`}>
                        {v.receta.activa ? 'Dar de baja' : 'Activar'}
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {filas.length === 0 && <Text c="dimmed" mt="xs" size="sm">No hay recetas{filtro === 'activas' ? ' activas' : ''}.</Text>}
    </Paper>
  );
}

function ListaFabricaciones({ hechas }: { hechas: M.Fabricacion[] }) {
  const { datos, nombres, cargando } = useBase();
  const filas = [...hechas].sort(porFechaDesc).slice(0, 30);
  if (filas.length === 0) return null;
  return (
    <Paper>
      <Encabezado titulo="Últimas fabricaciones" />
      <ScrollArea type="auto">
        <Table highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }} aria-label="Últimas fabricaciones">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th><Table.Th>Producto</Table.Th><Table.Th className="num">Salió</Table.Th>
              <Table.Th>Depósito</Table.Th><Table.Th>Receta</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((f) => {
              const unidad = unidadDe(datos, f.productoId);
              return (
                <Table.Tr key={f.id}>
                  <Table.Td c="dimmed">{fmtFecha(f.fecha)}</Table.Td>
                  <Table.Td fw={500}>{nombres.producto(f.productoId)}</Table.Td>
                  <Table.Td className="num">{fmtNum(f.cantidad)} {unidad}</Table.Td>
                  <Table.Td>{nombres.deposito(f.depositoId)}</Table.Td>
                  <Table.Td c="dimmed">Versión {f.version}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  );
}
