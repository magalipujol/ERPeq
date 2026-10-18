import { Anchor, Button, Group, Modal, SimpleGrid, Stack, Table, Text, Title, useMatches } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useBase } from '../base';
import * as F from '../dominio/fichas';
import * as M from '../dominio/modelo';
import { FichaContext, useFicha } from '../ficha';
import { fmtFecha, fmtMoney, fmtNum, lugar } from '../formato';
import { Resumen } from './comunes';
import { EstadoFlete, EstadoPedido, Recorrido } from './estados';

// Lo que la ficha puede pedirle a otra pantalla.
interface Acciones {
  entregar: (pedidoId: string) => void;
  verFlete: (fleteId: string) => void;
}

// Modal con la ficha de lo que se tocó. Cada vínculo de la ficha abre otra encima; "Volver" regresa.
export function FichaProvider({ children, onEntregar, onVerFlete }:
  { children: React.ReactNode; onEntregar: (pedidoId: string) => void; onVerFlete: (fleteId: string) => void }) {
  const [pila, setPila] = useState<F.RefFicha[]>([]);
  const abrir = useCallback((ref: F.RefFicha) => { setPila((p) => [...p, ref]); }, []);
  const valor = useMemo(() => ({ abrir }), [abrir]);
  const enCelular = useMatches({ base: true, sm: false });
  const titulo = useTitulo();
  const actual = pila.at(-1);
  const cerrar = () => { setPila([]); };
  const acciones: Acciones = {
    entregar: (id) => { cerrar(); onEntregar(id); },
    verFlete: (id) => { cerrar(); onVerFlete(id); },
  };

  return (
    <FichaContext value={valor}>
      {children}
      <Modal opened={actual !== undefined} onClose={cerrar} title={actual ? titulo(actual) : ''} size="xl" fullScreen={enCelular}>
        {pila.length > 1 && (
          <Button variant="subtle" size="compact-sm" mb="sm" leftSection={<IconArrowLeft size={16} />}
            onClick={() => { setPila((p) => p.slice(0, -1)); }}>
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

const ROL: Record<string, string> = { cliente: 'Cliente', proveedor: 'Proveedor', transporte: 'Transporte' };

function useTitulo() {
  const { datos, nombres, etiquetas, contacto } = useBase();
  return (r: F.RefFicha) => {
    switch (r.tipo) {
      case 'pedido': return `Pedido de ${etiquetas.pedido(r.id)}`;
      case 'venta': return `Venta a ${etiquetas.venta(r.id)}`;
      case 'flete': return `Flete de ${etiquetas.flete(r.id)}`;
      case 'producto': return `Producto: ${nombres.producto(r.id)}`;
      case 'contacto': return `${ROL[contacto(r.id)?.rol ?? ''] ?? 'Contacto'}: ${nombres.contacto(r.id)}`;
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
  const { datos, pedidos, nombres, etiquetas } = useBase();
  const f = F.fichaPedido(datos, pedidos, id);
  if (!f) return <NoEsta />;
  const { resumen: r } = f;
  return (
    <Stack gap="md">
      <Datos items={[
        ['Cliente', <Vinculo key="c" a={{ tipo: 'contacto', id: r.pedido.contactoId }}>{nombres.contacto(r.pedido.contactoId)}</Vinculo>],
        ['Fecha', fmtFecha(r.pedido.fecha)],
        ['Entrega desde', nombres.deposito(r.pedido.depositoId)],
        ['Estado', <EstadoPedido key="e" estado={r.estado} />],
        ['Vendedores', r.vendedores.map(nombres.vendedor).join(', ') || 'Sin comisión'],
        ['Nota', r.pedido.nota],
      ]} />
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
        ...(r.ventas.length > 0 ? [['Ganancia', `${fmtMoney(r.ganancia)}${r.sinCosto ? '*' : ''}`] as [string, string]] : []),
      ]} />
      {r.sinCosto && <Text size="xs" c="dimmed">* Hay productos sin costo de compra: la ganancia no los descuenta.</Text>}
      {f.ventas.length > 0 && (
        <Seccion titulo="Entregas">
          <Tabla label="Entregas del pedido" columnas={[{ titulo: 'Venta' }, { titulo: 'Importe', num: true }, { titulo: 'A cobrar', num: true }]}
            filas={f.ventas.map((v) => [
              <Vinculo key="v" a={{ tipo: 'venta', id: v.venta.id }}>{fmtFecha(v.venta.fecha)} · {nombres.deposito(v.venta.depositoId)}</Vinculo>,
              fmtMoney(v.importe), v.saldo > 0 ? fmtMoney(v.saldo) : '–',
            ])} />
        </Seccion>
      )}
      {f.fletes.length > 0 && (
        <Seccion titulo="Fletes">
          <Tabla label="Fletes del pedido" columnas={[{ titulo: 'Flete' }, { titulo: 'Estado' }, { titulo: 'Costo asignado', num: true }]}
            filas={f.fletes.map((x) => [
              <Vinculo key="f" a={{ tipo: 'flete', id: x.flete.id }}>{etiquetas.flete(x.flete.id)}</Vinculo>,
              <EstadoFlete key="e" estado={x.estado} />, fmtMoney(x.costoAsignado),
            ])} />
        </Seccion>
      )}
      {f.compras.length > 0 && <Seccion titulo="Compras para este pedido"><TablaCompras compras={f.compras} /></Seccion>}
    </Stack>
  );
}

function FichaVenta({ id }: { id: string }) {
  const { datos, nombres, etiquetas } = useBase();
  const f = F.fichaVenta(datos, id);
  if (!f) return <NoEsta />;
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
      {f.cobros.length > 0 && (
        <Seccion titulo="Cobros">
          <Tabla label="Cobros de la venta" columnas={[{ titulo: 'Fecha' }, { titulo: 'Importe', num: true }, { titulo: 'Medio' }, { titulo: 'Recibió' }]}
            filas={f.cobros.map((c) => [
              fmtFecha(c.fecha), fmtMoney(c.importe), nombreMedio(c.medio), nombres.socio(c.socioId),
            ])} />
        </Seccion>
      )}
    </Stack>
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
      <Datos items={[
        ['Unidad', p.unidad],
        ['Precio de lista', f.precio === null ? 'Sin precio' : fmtMoney(f.precio)],
        ['Costo promedio', f.costo === null ? 'Sin compras con precio' : fmtMoney(f.costo)],
        ['Mínimo', p.minimo !== null && p.minimo > 0 ? unidad(p.minimo) : ''],
      ]} />
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
      <Datos items={[
        ['Tipo de cliente', c.tipo], ['Teléfono', c.telefono], ['Dirección', c.direccion], ['Email', c.email],
        ['Localidad', lugar(c)], ['Observaciones', c.observaciones],
      ]} />
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
  const { datos, nombres, etiquetas } = useBase();
  const f = F.fichaFlete(datos, id);
  if (!f) return <NoEsta />;
  return (
    <Stack gap="md">
      <Datos items={[
        ['Transporte', <Vinculo key="t" a={{ tipo: 'contacto', id: f.flete.contactoId }}>{nombres.contacto(f.flete.contactoId)}</Vinculo>],
        ['Fecha', fmtFecha(f.flete.fecha)],
        ['Recorrido', <Recorrido key="r" flete={f.flete} />],
        ['Estado', <EstadoFlete key="e" estado={f.estado} />],
        ['Costo', fmtMoney(f.flete.costo)],
        ['Guía', f.flete.guia],
        ['Nota', f.flete.nota],
      ]} />
      <Group><Button size="xs" variant="light" onClick={() => { acciones.verFlete(id); }}>Ver en Fletes</Button></Group>
      {f.items.length > 0 && (
        <Seccion titulo="Mercadería">
          <Tabla label="Mercadería del flete" columnas={[{ titulo: 'Producto' }, { titulo: 'Cant.', num: true }]}
            filas={f.items.map((it) => [
              <Vinculo key="p" a={{ tipo: 'producto', id: it.productoId }}>{nombres.producto(it.productoId)}</Vinculo>, fmtNum(it.cantidad),
            ])} />
        </Seccion>
      )}
      {f.pedidos.length > 0 && (
        <Seccion titulo="Pedidos">
          <Tabla label="Pedidos del flete" columnas={[{ titulo: 'Pedido' }, { titulo: 'Costo asignado', num: true }]}
            filas={f.pedidos.map((pf) => [
              <Vinculo key="p" a={{ tipo: 'pedido', id: pf.pedidoId }}>{etiquetas.pedido(pf.pedidoId) || pf.pedidoId}</Vinculo>,
              fmtMoney(pf.costoAsignado),
            ])} />
        </Seccion>
      )}
      <Seccion titulo="Estados">
        <Text size="sm">
          {f.historial.map((e) => `${nombreEstadoFlete(e.estado)} (${fmtFecha(e.fecha)})`).join(' → ') || '–'}
        </Text>
      </Seccion>
    </Stack>
  );
}

function FichaCompra({ id }: { id: string }) {
  const { datos, nombres, etiquetas } = useBase();
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
      ['Pedido', c.pedidoId && <Vinculo key="pe" a={{ tipo: 'pedido', id: c.pedidoId }}>{etiquetas.pedido(c.pedidoId) || c.pedidoId}</Vinculo>],
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
