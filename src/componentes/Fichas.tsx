import { ActionIcon, Anchor, Button, Group, Modal, NativeSelect, NumberInput, SimpleGrid, Stack, Table, Text, TextInput, Title, useMatches } from '@mantine/core';
import { IconArrowLeft, IconPencil, IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBase, useGuardar } from '../base';
import * as F from '../dominio/fichas';
import * as M from '../dominio/modelo';
import { FichaContext, useFicha } from '../ficha';
import { aISO, aNumero, deISO, fmtFecha, fmtFechaHora, fmtMoney, fmtNum, lugar } from '../formato';
import { CamposCobro, type DatosCobro } from './Cobro';
import { Confirmacion, Mensaje, Resumen } from './comunes';
import { FormCorregirPedido } from './CorregirPedido';
import { FormFlete } from './FormFlete';
import { FormContacto, FormProducto } from './Maestros';
import { EstadoFlete, EstadoPedido, Recorrido } from './estados';

// Lo que la ficha puede pedirle a otra pantalla.
interface Acciones {
  entregar: (pedidoId: string) => void;
  verFlete: (fleteId: string) => void;
}

// Cuántas fichas hay abiertas según la entrada actual del historial del navegador.
const fichasEnHistorial = (): number => {
  const estado: unknown = history.state;
  return typeof estado === 'object' && estado !== null && 'fichas' in estado && typeof estado.fichas === 'number' ? estado.fichas : 0;
};

// Modal con la ficha de lo que se tocó. Cada vínculo de la ficha abre otra encima; "Volver" regresa.
// Cada ficha abierta es una entrada del historial, así "atrás" del navegador (o del celular) vuelve a la anterior
// o cierra el modal en vez de salir de la pantalla.
export function FichaProvider({ children, onEntregar, onVerFlete }:
  { children: React.ReactNode; onEntregar: (pedidoId: string) => void; onVerFlete: (fleteId: string) => void }) {
  const [pila, setPila] = useState<F.RefFicha[]>([]);
  // Lo que se hace después de cerrar todas las fichas (ir a otra pantalla), cuando el historial ya volvió atrás.
  const despuesRef = useRef<(() => void) | null>(null);
  const abrir = useCallback((ref: F.RefFicha) => {
    history.pushState({ fichas: fichasEnHistorial() + 1 }, '');
    setPila((p) => [...p, ref]);
  }, []);
  const valor = useMemo(() => ({ abrir }), [abrir]);
  const enCelular = useMatches({ base: true, sm: false });
  const titulo = useTitulo();
  const actual = pila.at(-1);

  useEffect(() => {
    const alVolver = () => {
      const n = fichasEnHistorial();
      setPila((p) => p.slice(0, n));
      if (n === 0 && despuesRef.current) {
        const fn = despuesRef.current;
        despuesRef.current = null;
        fn();
      }
    };
    addEventListener('popstate', alVolver);
    return () => { removeEventListener('popstate', alVolver); };
  }, []);

  const cerrar = (luego?: () => void) => {
    const n = fichasEnHistorial();
    if (n > 0) {
      despuesRef.current = luego ?? null;
      history.go(-n);
    } else {
      setPila([]);
      luego?.();
    }
  };
  const acciones: Acciones = {
    entregar: (id) => { cerrar(() => { onEntregar(id); }); },
    verFlete: (id) => { cerrar(() => { onVerFlete(id); }); },
  };

  return (
    <FichaContext value={valor}>
      {children}
      <Modal opened={actual !== undefined} onClose={() => { cerrar(); }} title={actual ? titulo(actual) : ''} size="xl" fullScreen={enCelular}>
        {pila.length > 1 && (
          <Button variant="subtle" size="compact-sm" mb="sm" leftSection={<IconArrowLeft size={16} />}
            onClick={() => { history.back(); }}>
            Volver a {titulo(pila[pila.length - 2])}
          </Button>
        )}
        {actual && <Contenido key={pila.length} ficha={actual} acciones={acciones} />}
      </Modal>
    </FichaContext>
  );
}

// Texto que abre la ficha de `a`. En una tabla, va en la celda principal de la fila (la fila entera también la abre).
export function Vinculo({ a, children }: { a: F.RefFicha; children: React.ReactNode }) {
  const { abrir } = useFicha();
  return (
    <Anchor component="button" type="button" inherit ta="left" onClick={(e) => { e.stopPropagation(); abrir(a); }}>
      {children}
    </Anchor>
  );
}

function useTitulo() {
  const { datos, nombres, etiquetas, contacto } = useBase();
  return (r: F.RefFicha) => {
    switch (r.tipo) {
      case 'pedido': return `Pedido de ${etiquetas.pedido(r.id)}`;
      // Una venta recién borrada ya no tiene etiqueta.
      case 'venta': return etiquetas.venta(r.id) ? `Venta a ${etiquetas.venta(r.id)}` : 'Venta borrada';
      case 'flete': return `Flete de ${etiquetas.flete(r.id)}`;
      case 'producto': return `Producto: ${nombres.producto(r.id)}`;
      case 'contacto': return `${M.nombreRol(contacto(r.id)?.rol ?? '') || 'Contacto'}: ${nombres.contacto(r.id)}`;
      case 'compra': {
        const c = F.fichaCompra(datos, r.id);
        return c ? `Compra a ${nombres.contacto(c.contactoId)} · ${fmtFecha(c.fecha)}` : 'Compra';
      }
    }
  };
}

function Contenido({ ficha, acciones }: { ficha: F.RefFicha; acciones: Acciones }) {
  switch (ficha.tipo) {
    case 'pedido': return <FichaPedido id={ficha.id} acciones={acciones} />;
    case 'venta': return <FichaVenta id={ficha.id} />;
    case 'producto': return <FichaProducto id={ficha.id} />;
    case 'contacto': return <FichaContacto id={ficha.id} />;
    case 'flete': return <FichaFlete id={ficha.id} acciones={acciones} />;
    case 'compra': return <FichaCompra id={ficha.id} />;
  }
}

// Medios y estados tal como están en la planilla: uno desconocido se muestra como está escrito.
const nombreMedio = (m: string) => ((M.MEDIOS as readonly string[]).includes(m) ? M.NOMBRE_MEDIO[m as M.Medio] : m);
const nombreEstadoFlete = (e: string) =>
  ((M.ESTADOS_FLETE as readonly string[]).includes(e) ? M.NOMBRE_ESTADO_FLETE[e as M.EstadoFlete] : e);

const NoEsta = () => <Text c="dimmed">No está en la planilla.</Text>;

// Datos de la ficha con un botón "Corregir datos" (o `etiqueta`) que los reemplaza por el formulario de `editor`.
function Corregible({ children, editor, etiqueta = 'Corregir datos' }: {
  children: React.ReactNode; editor: (listo: (texto: string) => void, cancelar: () => void) => React.JSX.Element; etiqueta?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  if (editando) return editor((texto) => { setEditando(false); setAviso(texto); }, () => { setEditando(false); });
  return (
    <Stack gap="xs">
      {children}
      <Group><Button size="xs" variant="light" onClick={() => { setAviso(null); setEditando(true); }}>{etiqueta}</Button></Group>
      {aviso !== null && <Mensaje msg={{ texto: aviso, error: false }} />}
    </Stack>
  );
}

// Datos sueltos, en dos columnas: los vacíos no se muestran.
function Datos({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <SimpleGrid cols={2} spacing="xs" verticalSpacing={6}>
      {items.filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => (
        <div key={k} role="group" aria-label={k}>
          <Text size="xs" c="dimmed">{k}</Text>
          <Text size="sm" component="div">{v}</Text>
        </div>
      ))}
    </SimpleGrid>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section aria-label={titulo}>
      <Title order={3} size="h5" mb={6}>{titulo}</Title>
      {children}
    </section>
  );
}

function Totales({ items }: { items: [string, string][] }) {
  return (
    <Group className="suave" px="md" py="xs" gap="xl">
      {items.map(([k, v]) => <Resumen key={k} label={k} valor={v} />)}
    </Group>
  );
}

// Tabla corta de la ficha: encabezados y filas ya armadas. Las columnas con `num` van alineadas a la derecha.
function Tabla({ label, columnas, filas }: { label: string; columnas: { titulo: string; num?: boolean }[]; filas: React.ReactNode[][] }) {
  return (
    <Table.ScrollContainer minWidth={0}>
      <Table fz="sm" aria-label={label} style={{ whiteSpace: 'nowrap' }}>
        <Table.Thead>
          <Table.Tr>{columnas.map((c) => <Table.Th key={c.titulo} className={c.num === true ? 'num' : undefined}>{c.titulo}</Table.Th>)}</Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filas.map((f, i) => (
            // eslint-disable-next-line @eslint-react/no-array-index-key -- las filas no tienen estado propio
            <Table.Tr key={i}>
              {f.map((celda, j) => <Table.Td key={columnas[j].titulo} className={columnas[j].num === true ? 'num' : undefined}>{celda}</Table.Td>)}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

const MAX_FILAS = 10;
// Las listas largas (compras, ventas, pedidos de un cliente) muestran las más recientes.
function Recientes<T>({ lista, children }: { lista: T[]; children: (visibles: T[]) => React.ReactNode }) {
  return (
    <>
      {children(lista.slice(0, MAX_FILAS))}
      {lista.length > MAX_FILAS && <Text size="xs" c="dimmed" mt={4}>Y {lista.length - MAX_FILAS} más anteriores.</Text>}
    </>
  );
}

function FichaPedido({ id, acciones }: { id: string; acciones: Acciones }) {
  const { datos, pedidos, nombres } = useBase();
  const f = F.fichaPedido(datos, pedidos, id);
  if (!f) return <NoEsta />;
  const { resumen: r } = f;
  return (
    <Stack gap="md">
      <Corregible etiqueta="Corregir pedido"
        editor={(listo, cancelar) => <FormCorregirPedido resumen={r} onListo={listo} onCancelar={cancelar} />}>
        <Datos items={[
          ['Cliente', <Vinculo key="c" a={{ tipo: 'contacto', id: r.pedido.contactoId }}>{nombres.contacto(r.pedido.contactoId)}</Vinculo>],
          ['Fecha', fmtFecha(r.pedido.fecha)],
          ['Entrega desde', nombres.deposito(r.pedido.depositoId)],
          ['Estado', <EstadoPedido key="e" estado={r.estado} />],
          ['Vendedores', r.vendedores.map(nombres.vendedor).join(', ') || 'Sin comisión'],
          ['Nota', r.pedido.nota],
        ]} />
      </Corregible>
      {M.pedidoAbierto(r.estado) && (
        <Group><Button size="xs" variant="light" onClick={() => { acciones.entregar(id); }}>Registrar entrega</Button></Group>
      )}
      <Seccion titulo="Productos">
        <Tabla label="Productos del pedido" columnas={[
          { titulo: 'Producto' }, { titulo: 'Cant.', num: true }, { titulo: 'Precio', num: true },
          { titulo: 'Entregado', num: true }, { titulo: 'Pendiente', num: true },
        ]} filas={r.lineas.map((l) => [
          <Vinculo key="p" a={{ tipo: 'producto', id: l.productoId }}>{nombres.producto(l.productoId)}</Vinculo>,
          fmtNum(l.cantidad),
          <span key="pr">{fmtMoney(l.precio)}{l.precioLista !== null && l.precioLista !== l.precio && <Text span size="xs" c="dimmed"> (lista {fmtMoney(l.precioLista)})</Text>}</span>,
          fmtNum(l.entregado), fmtNum(l.pendiente),
        ])} />
      </Seccion>
      <Totales items={[
        ['Importe', fmtMoney(r.importePedido)], ['Entregado', fmtMoney(r.importeEntregado)],
        ...(r.envios > 0 ? [['Envío', fmtMoney(r.envios)] as [string, string]] : []),
        ...(r.ventas.length > 0 ? [['Ganancia', `${fmtMoney(r.ganancia)}${r.sinCosto ? '*' : ''}`] as [string, string]] : []),
      ]} />
      {r.sinCosto && <Text size="xs" c="dimmed">* Hay productos sin costo: la ganancia no los descuenta.</Text>}
      {f.ventas.length > 0 && (
        <Seccion titulo="Entregas">
          <Tabla label="Entregas del pedido" columnas={[{ titulo: 'Venta' }, { titulo: 'Importe', num: true }, { titulo: 'A cobrar', num: true }]}
            filas={f.ventas.map((v) => [
              <Vinculo key="v" a={{ tipo: 'venta', id: v.venta.id }}>{fmtFecha(v.venta.fecha)} · {nombres.deposito(v.venta.depositoId)}</Vinculo>,
              fmtMoney(v.importe), v.saldo > 0 ? fmtMoney(v.saldo) : '–',
            ])} />
        </Seccion>
      )}
    </Stack>
  );
}

function FichaVenta({ id }: { id: string }) {
  const { datos, nombres, etiquetas, db } = useBase();
  const { guardando, msg, guardar } = useGuardar();
  const [confirmando, setConfirmando] = useState(false);
  // Pedido de la venta que se borró, para ofrecer volver a él.
  const [borrada, setBorrada] = useState<string | null>(null);
  const f = F.fichaVenta(datos, id);
  if (borrada !== null || (!f && msg !== null)) {
    return (
      <Stack gap="xs" align="flex-start">
        <Mensaje msg={msg} />
        {borrada && <Vinculo a={{ tipo: 'pedido', id: borrada }}>Ver el pedido de {etiquetas.pedido(borrada)}</Vinculo>}
      </Stack>
    );
  }
  if (!f) return <NoEsta />;

  function borrar() {
    setConfirmando(false);
    if (!f) return;
    const pedidoId = f.pedido?.id ?? null;
    const quien = f.pedido ? nombres.contacto(f.pedido.contactoId) : '';
    guardar(async () => {
      await db.borrarVenta(id);
      setBorrada(pedidoId);
      return `✓ Venta${quien ? ` a ${quien}` : ''} borrada. El stock volvió a ${nombres.deposito(f.venta.depositoId)}.`;
    });
  }

  return (
    <Stack gap="md">
      <Datos items={[
        ['Cliente', f.pedido && <Vinculo key="c" a={{ tipo: 'contacto', id: f.pedido.contactoId }}>{nombres.contacto(f.pedido.contactoId)}</Vinculo>],
        ['Pedido', f.pedido && <Vinculo key="p" a={{ tipo: 'pedido', id: f.pedido.id }}>{etiquetas.pedido(f.pedido.id)}</Vinculo>],
        ['Fecha', fmtFecha(f.venta.fecha)],
        ['Depósito', nombres.deposito(f.venta.depositoId)],
        ['Comisiones', f.comisiones.map((c) => `${nombres.vendedor(c.vendedorId)} ${fmtMoney(c.monto)}`).join(', ')],
        ['Nota', f.venta.nota],
      ]} />
      <Seccion titulo="Productos">
        <Tabla label="Productos entregados" columnas={[
          { titulo: 'Producto' }, { titulo: 'Cant.', num: true }, { titulo: 'Precio', num: true }, { titulo: 'Importe', num: true },
          { titulo: 'Costo', num: true }, { titulo: 'Ganancia', num: true },
        ]} filas={f.items.map((it) => [
          <Vinculo key="p" a={{ tipo: 'producto', id: it.productoId }}>{nombres.producto(it.productoId)}</Vinculo>,
          fmtNum(it.cantidad), fmtMoney(it.precio), fmtMoney(it.importe), fmtMoney(it.costo), fmtMoney(it.ganancia),
        ])} />
      </Seccion>
      <Totales items={[
        ['Importe', fmtMoney(f.importe)], ['Cobrado', fmtMoney(f.cobrado)], ['A cobrar', fmtMoney(f.saldo)], ['Ganancia', fmtMoney(f.ganancia)],
      ]} />
      {f.envio && <EnvioVenta envio={f.envio} pedidoId={f.venta.pedidoId} />}
      {f.cobros.length > 0 && <CobrosVenta ventaId={id} cobros={f.cobros} />}
      <Group>
        <Button size="xs" variant="light" color="red" loading={guardando} onClick={() => { setConfirmando(true); }}>Borrar venta</Button>
      </Group>
      <Mensaje msg={msg} />
      <Confirmacion abierta={confirmando} titulo="¿Borrar la venta?" si="Sí, borrar venta" peligro onSi={borrar}
        onNo={() => { setConfirmando(false); }}>
        <Text size="sm">
          Venta a {etiquetas.venta(id)}: {fmtMoney(f.importe)}, desde {nombres.deposito(f.venta.depositoId)}.
        </Text>
        <Text size="sm">
          Se borran también sus comisiones{f.envio ? ', el envío' : ''}
          {f.cobrado > 0 ? ` y sus cobros (${fmtMoney(f.cobrado)} cobrados)` : ''}. El stock vuelve
          a {nombres.deposito(f.venta.depositoId)} y lo entregado vuelve a quedar pendiente en el pedido.
        </Text>
        <Text size="sm" fw={700}>No se puede deshacer.</Text>
      </Confirmacion>
    </Stack>
  );
}

// Cobros de una venta, del más nuevo al más viejo, cada uno con su corrección y su borrado. Los cobros no tienen ID:
// se reemplazan todos los de la venta, en el orden de la hoja, con el corregido en su lugar.
function CobrosVenta({ ventaId, cobros }: { ventaId: string; cobros: M.Cobro[] }) {
  const { datos, nombres, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [editando, setEditando] = useState<M.Cobro | null>(null);
  const [borrando, setBorrando] = useState<M.Cobro | null>(null);
  const [fecha, setFecha] = useState('');
  const [valor, setValor] = useState<DatosCobro>({ importe: '', medio: 'efectivo', socioId: '' });
  const [nota, setNota] = useState('');
  const deLaVenta = () => datos.cobros.filter((c) => c.ventaId === ventaId);
  const describir = (c: M.Cobro) => `${fmtMoney(c.importe)} del ${fmtFecha(c.fecha)}`;

  function editar(c: M.Cobro) {
    setEditando(c);
    setFecha(aISO(c.fecha));
    setValor({ importe: c.importe, medio: (M.MEDIOS as readonly string[]).includes(c.medio) ? c.medio as M.Medio : 'efectivo', socioId: c.socioId });
    setNota(c.nota);
  }

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const anterior = editando;
    const importe = aNumero(valor.importe);
    if (!anterior) return;
    if (!fecha) { error('Elegí la fecha.'); return; }
    if (!(importe > 0)) { error('El importe tiene que ser mayor a 0.'); return; }
    if (!datos.socios.some((s) => s.id === valor.socioId)) { error('Elegí quién recibió la plata.'); return; }
    const nuevo: M.Cobro = { ...anterior, fecha: deISO(fecha), importe, medio: valor.medio, socioId: valor.socioId, nota: nota.trim() };
    guardar(async () => {
      await db.corregirCobros(ventaId, deLaVenta().map((c) => (c === anterior ? nuevo : c)));
      setEditando(null);
      return `✓ Cobro corregido: ${describir(nuevo)}.`;
    });
  }

  function borrar() {
    const c = borrando;
    setBorrando(null);
    if (!c) return;
    guardar(async () => {
      await db.corregirCobros(ventaId, deLaVenta().filter((x) => x !== c));
      return `✓ Cobro de ${describir(c)} borrado.`;
    });
  }

  return (
    <Seccion titulo="Cobros">
      <Tabla label="Cobros de la venta" columnas={[{ titulo: 'Fecha' }, { titulo: 'Importe', num: true }, { titulo: 'Medio' }, { titulo: 'Recibió' }, { titulo: '' }]}
        filas={cobros.map((c) => [
          fmtFecha(c.fecha), fmtMoney(c.importe), nombreMedio(c.medio), nombres.socio(c.socioId),
          <Group key="a" gap={4} wrap="nowrap" justify="flex-end">
            <ActionIcon variant="subtle" size="lg" aria-label={`Editar cobro de ${describir(c)}`} disabled={guardando}
              onClick={() => { editar(c); }}><IconPencil size={18} /></ActionIcon>
            <ActionIcon variant="subtle" color="red" size="lg" aria-label={`Borrar cobro de ${describir(c)}`} disabled={guardando}
              onClick={() => { setBorrando(c); }}><IconTrash size={18} /></ActionIcon>
          </Group>,
        ])} />
      {editando && (
        <form onSubmit={enviar} noValidate aria-label="Corregir cobro">
          <Stack gap="xs" mt="xs">
            <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.currentTarget.value); }} />
            <CamposCobro valor={valor} onChange={setValor} socios={datos.socios} etiqueta="Importe" />
            <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
            <Group gap="xs" justify="flex-end">
              <Button variant="default" onClick={() => { setEditando(null); }}>Cancelar</Button>
              <Button type="submit" loading={guardando}>Guardar cobro</Button>
            </Group>
          </Stack>
        </form>
      )}
      <Mensaje msg={msg} />
      <Confirmacion abierta={borrando !== null} titulo="¿Borrar este cobro?" si="Sí, borrar cobro" peligro onSi={borrar}
        onNo={() => { setBorrando(null); }}>
        {borrando && <Text size="sm">Cobro de {describir(borrando)}, recibido por {nombres.socio(borrando.socioId)}. Vuelve a quedar a cobrar.</Text>}
      </Confirmacion>
    </Seccion>
  );
}

// Envío de una venta: se corrige el costo y para quién es (un vendedor del pedido o el negocio).
function EnvioVenta({ envio, pedidoId }: { envio: M.VentaEnvio; pedidoId: string }) {
  const { datos, nombres, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [editando, setEditando] = useState(false);
  const [costoTxt, setCostoTxt] = useState<number | string>(envio.costo);
  const [para, setPara] = useState(envio.vendedorId);
  const vendedores = [...new Set([
    ...datos.pedidosVendedores.filter((v) => v.pedidoId === pedidoId).map((v) => v.vendedorId), envio.vendedorId,
  ])].filter((v) => v !== '');
  const quien = (v: string) => (v ? nombres.vendedor(v) : 'el negocio');

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const costo = aNumero(costoTxt);
    if (!(costo >= 0)) { error('El costo no puede ser negativo.'); return; }
    guardar(async () => {
      await db.corregirEnvio(envio.ventaId, { ...envio, costo, vendedorId: para });
      setEditando(false);
      return `✓ Envío corregido: ${fmtMoney(costo)} para ${quien(para)}.`;
    });
  }

  return (
    <Seccion titulo="Envío">
      {editando ? (
        <form onSubmit={enviar} noValidate aria-label="Corregir envío">
          <Stack gap="xs">
            <Group grow gap="xs" align="flex-start">
              <NumberInput label="Costo de envío" allowNegative={false} value={costoTxt} onChange={setCostoTxt}
                leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none" />
              <NativeSelect label="El envío es para" value={para} onChange={(e) => { setPara(e.currentTarget.value); }}
                data={[...vendedores.map((v) => ({ value: v, label: nombres.vendedor(v) })), { value: '', label: 'El negocio' }]} />
            </Group>
            <Group gap="xs" justify="flex-end">
              <Button variant="default" onClick={() => { setEditando(false); }}>Cancelar</Button>
              <Button type="submit" loading={guardando}>Guardar envío</Button>
            </Group>
          </Stack>
        </form>
      ) : (
        <Group gap="xs">
          <Text size="sm">{envio.costo > 0 ? `${fmtMoney(envio.costo)} · para ${quien(envio.vendedorId)}` : 'Sin cargo'}</Text>
          <Button size="xs" variant="light" onClick={() => { setCostoTxt(envio.costo); setPara(envio.vendedorId); setEditando(true); }}>Corregir envío</Button>
        </Group>
      )}
      <Mensaje msg={msg} />
    </Seccion>
  );
}

function FichaProducto({ id }: { id: string }) {
  const { datos, pedidos, stock, costos, nombres, etiquetas } = useBase();
  const [hoy] = useState(() => new Date());
  const f = F.fichaProducto(datos, pedidos, stock, costos, id, hoy);
  if (!f) return <NoEsta />;
  const { producto: p } = f;
  const unidad = (n: number) => `${fmtNum(n)} ${p.unidad}`;
  return (
    <Stack gap="md">
      <Corregible editor={(listo, cancelar) => <FormProducto producto={p} onListo={listo} onCancelar={cancelar} />}>
        <Datos items={[
          ['Unidad', p.unidad],
          ['Precio de lista', f.precio === null ? 'Sin precio' : fmtMoney(f.precio)],
          ['Costo', f.costo === null ? 'Sin costo' : fmtMoney(f.costo)],
          ['Mínimo', p.minimo !== null && p.minimo > 0 ? unidad(p.minimo) : ''],
        ]} />
      </Corregible>
      <Seccion titulo="Stock">
        <Tabla label="Stock por depósito" columnas={[
          { titulo: 'Depósito' }, { titulo: 'En depósito', num: true }, { titulo: 'En camino', num: true },
          { titulo: 'En fletes en preparación', num: true }, { titulo: 'Comprometido', num: true },
        ]} filas={f.stock.map((s) => [
          nombres.deposito(s.depositoId), fmtNum(s.enDeposito), fmtNum(s.enTransito), fmtNum(s.reservado), fmtNum(s.comprometido),
        ])} />
      </Seccion>
      {f.receta && (
        <Seccion titulo="Receta">
          <Text size="sm" mb={4}>Una tanda da {unidad(f.receta.receta.cantidad)}:</Text>
          <Tabla label="Insumos de la receta" columnas={[{ titulo: 'Insumo' }, { titulo: 'Cantidad', num: true }]}
            filas={f.receta.items.map((it) => [
              <Vinculo key="p" a={{ tipo: 'producto', id: it.productoId }}>{nombres.producto(it.productoId)}</Vinculo>,
              `${fmtNum(it.cantidad)} ${datos.productos.find((x) => x.id === it.productoId)?.unidad ?? ''}`,
            ])} />
        </Seccion>
      )}
      {f.usadoEn.length > 0 && (
        <Seccion titulo="Se usa en">
          <Group gap="md">
            {f.usadoEn.map((r) => (
              <Vinculo key={r.receta.id} a={{ tipo: 'producto', id: r.receta.productoId }}>{nombres.producto(r.receta.productoId)}</Vinculo>
            ))}
          </Group>
        </Seccion>
      )}
      {f.pedidos.length > 0 && (
        <Seccion titulo="Pedidos abiertos">
          <Tabla label="Pedidos abiertos con este producto" columnas={[{ titulo: 'Pedido' }, { titulo: 'Desde' }, { titulo: 'Pendiente', num: true }]}
            filas={f.pedidos.map((x) => [
              <Vinculo key="p" a={{ tipo: 'pedido', id: x.resumen.pedido.id }}>{etiquetas.pedido(x.resumen.pedido.id)}</Vinculo>,
              nombres.deposito(x.resumen.pedido.depositoId), unidad(x.pendiente),
            ])} />
        </Seccion>
      )}
      {f.ventas.length > 0 && (
        <Seccion titulo="Ventas">
          <Recientes lista={f.ventas}>
            {(ventas) => (
              <Tabla label="Ventas del producto" columnas={[{ titulo: 'Venta' }, { titulo: 'Cant.', num: true }, { titulo: 'Importe', num: true }]}
                filas={ventas.map((v) => [
                  <Vinculo key="v" a={{ tipo: 'venta', id: v.venta.id }}>{etiquetas.venta(v.venta.id)}</Vinculo>,
                  fmtNum(v.cantidad), fmtMoney(v.importe),
                ])} />
            )}
          </Recientes>
        </Seccion>
      )}
      {f.compras.length > 0 && (
        <Seccion titulo="Compras">
          <Recientes lista={f.compras}>{(compras) => <TablaCompras compras={compras} />}</Recientes>
        </Seccion>
      )}
    </Stack>
  );
}

function FichaContacto({ id }: { id: string }) {
  const { datos, pedidos, etiquetas } = useBase();
  const f = F.fichaContacto(datos, pedidos, id);
  if (!f) return <NoEsta />;
  const { contacto: c } = f;
  return (
    <Stack gap="md">
      <Corregible editor={(listo, cancelar) => <FormContacto contacto={c} onListo={listo} onCancelar={cancelar} />}>
        <Datos items={[
          ['Tipo de cliente', c.tipo], ['Teléfono', c.telefono], ['Dirección', c.direccion], ['Email', c.email],
          ['Localidad', lugar(c)], ['Observaciones', c.observaciones],
        ]} />
      </Corregible>
      {f.pedidos.length > 0 && (
        <>
          <Totales items={[
            ['Pedidos', String(f.pedidos.length)],
            ['Comprado', fmtMoney(f.pedidos.reduce((s, r) => s + r.importeEntregado, 0))],
            ['A cobrar', fmtMoney(f.aCobrar)],
          ]} />
          <Seccion titulo="Pedidos">
            <Recientes lista={f.pedidos}>
              {(lista) => (
                <Tabla label="Pedidos del cliente" columnas={[{ titulo: 'Pedido' }, { titulo: 'Estado' }, { titulo: 'Importe', num: true }]}
                  filas={lista.map((r) => [
                    <Vinculo key="p" a={{ tipo: 'pedido', id: r.pedido.id }}>{fmtFecha(r.pedido.fecha)}</Vinculo>,
                    <EstadoPedido key="e" estado={r.estado} />, fmtMoney(r.importePedido),
                  ])} />
              )}
            </Recientes>
          </Seccion>
        </>
      )}
      {f.compras.length > 0 && (
        <Seccion titulo="Compras">
          <Recientes lista={f.compras}>{(compras) => <TablaCompras compras={compras} />}</Recientes>
        </Seccion>
      )}
      {f.fletes.length > 0 && (
        <Seccion titulo="Fletes">
          <Recientes lista={f.fletes}>
            {(lista) => (
              <Tabla label="Fletes del transporte" columnas={[{ titulo: 'Flete' }, { titulo: 'Recorrido' }, { titulo: 'Estado' }]}
                filas={lista.map((x) => [
                  <Vinculo key="f" a={{ tipo: 'flete', id: x.flete.id }}>{etiquetas.flete(x.flete.id)}</Vinculo>,
                  <Recorrido key="r" flete={x.flete} />, <EstadoFlete key="e" estado={x.estado} />,
                ])} />
            )}
          </Recientes>
        </Seccion>
      )}
    </Stack>
  );
}

function FichaFlete({ id, acciones }: { id: string; acciones: Acciones }) {
  const { datos, nombres, etiquetas, db } = useBase();
  const { guardando, msg, guardar } = useGuardar();
  const [confirmando, setConfirmando] = useState(false);
  const f = F.fichaFlete(datos, id);
  if (!f && msg !== null) return <Mensaje msg={msg} />;
  if (!f) return <NoEsta />;

  function borrar() {
    setConfirmando(false);
    const nombre = etiquetas.flete(id);
    guardar(async () => {
      await db.borrarFlete(id);
      return `✓ Flete de ${nombre} borrado.`;
    });
  }

  return (
    <Stack gap="md">
      <Corregible etiqueta="Corregir flete" editor={(listo, cancelar) => (
        <FormFlete corregir={{ flete: f.flete, items: f.items, onListo: listo, onCancelar: cancelar }} />
      )}>
        <Datos items={[
          ['Transporte', <Vinculo key="t" a={{ tipo: 'contacto', id: f.flete.contactoId }}>{nombres.contacto(f.flete.contactoId)}</Vinculo>],
          ['Fecha', fmtFecha(f.flete.fecha)],
          ['Recorrido', <Recorrido key="r" flete={f.flete} />],
          ['Estado', <EstadoFlete key="e" estado={f.estado} />],
          ['Costo', fmtMoney(f.flete.costo)],
          ['Salida prevista', f.flete.salida ? fmtFechaHora(f.flete.salida) : ''],
          ['Llegada estimada', f.flete.llegadaEstimada ? fmtFechaHora(f.flete.llegadaEstimada) : ''],
          ['Guía', f.flete.guia],
          ['Nota', f.flete.nota],
        ]} />
      </Corregible>
      <Group><Button size="xs" variant="light" onClick={() => { acciones.verFlete(id); }}>Ver en Fletes</Button></Group>
      {f.items.length > 0 && (
        <Seccion titulo="Mercadería">
          <Tabla label="Mercadería del flete" columnas={[{ titulo: 'Producto' }, { titulo: 'Cant.', num: true }]}
            filas={f.items.map((it) => [
              <Vinculo key="p" a={{ tipo: 'producto', id: it.productoId }}>{nombres.producto(it.productoId)}</Vinculo>, fmtNum(it.cantidad),
            ])} />
        </Seccion>
      )}
      <Seccion titulo="Estados">
        <Text size="sm">
          {f.historial.map((e) => `${nombreEstadoFlete(e.estado)} (${fmtFecha(e.fecha)})`).join(' → ') || '–'}
        </Text>
      </Seccion>
      <Group>
        <Button size="xs" variant="light" color="red" loading={guardando} onClick={() => { setConfirmando(true); }}>Borrar flete</Button>
      </Group>
      <Mensaje msg={msg} />
      <Confirmacion abierta={confirmando} titulo="¿Borrar el flete?" si="Sí, borrar flete" peligro onSi={borrar}
        onNo={() => { setConfirmando(false); }}>
        <Text size="sm">Flete de {etiquetas.flete(id)}: se borran también su mercadería y sus estados.</Text>
        {f.items.length > 0 && (f.estado === 'camino' || f.estado === 'finalizado') && (
          <Text size="sm">La mercadería vuelve al stock de {nombres.deposito(f.flete.origenId)}.</Text>
        )}
        <Text size="sm" fw={700}>No se puede deshacer.</Text>
      </Confirmacion>
    </Stack>
  );
}

function FichaCompra({ id }: { id: string }) {
  const { datos, nombres } = useBase();
  const c = F.fichaCompra(datos, id);
  if (!c) return <NoEsta />;
  const unidad = datos.productos.find((p) => p.id === c.productoId)?.unidad ?? '';
  return (
    <Datos items={[
      ['Proveedor', <Vinculo key="c" a={{ tipo: 'contacto', id: c.contactoId }}>{nombres.contacto(c.contactoId)}</Vinculo>],
      ['Producto', <Vinculo key="p" a={{ tipo: 'producto', id: c.productoId }}>{nombres.producto(c.productoId)}</Vinculo>],
      ['Fecha', fmtFecha(c.fecha)],
      ['Depósito', nombres.deposito(c.depositoId)],
      ['Cantidad', `${fmtNum(c.cantidad)} ${unidad}`],
      ['Precio unitario', fmtMoney(c.precio)],
      ['Importe', fmtMoney(c.importe)],
      ['Remito', c.remito],
      ['Nota', c.nota],
    ]} />
  );
}

function TablaCompras({ compras }: { compras: M.Compra[] }) {
  const { nombres } = useBase();
  return (
    <Tabla label="Compras" columnas={[
      { titulo: 'Compra' }, { titulo: 'Producto' }, { titulo: 'Cant.', num: true }, { titulo: 'Importe', num: true }, { titulo: 'Depósito' },
    ]} filas={compras.map((c) => [
      <Vinculo key="c" a={{ tipo: 'compra', id: String(c.fila) }}>{fmtFecha(c.fecha)} · {nombres.contacto(c.contactoId)}</Vinculo>,
      nombres.producto(c.productoId), fmtNum(c.cantidad), fmtMoney(c.importe), nombres.deposito(c.depositoId),
    ])} />
  );
}
