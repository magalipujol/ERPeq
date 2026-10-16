import {
  Autocomplete, Badge, Button, Checkbox, Grid, Group, MultiSelect, NativeSelect, NumberInput, Paper, ScrollArea,
  SegmentedControl, Stack, Table, Text, TextInput, Title,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { normalizar, useBase, useGuardar } from '../base';
import { Encabezado, Kpis, Mensaje, Resumen } from '../componentes/comunes';
import { type Item, itemVacio } from '../componentes/item';
import { Items } from '../componentes/Items';
import { aNumero, deISO, fmtFecha, fmtMoney, fmtNum, hoyISO, numeroOCero, porFechaDesc, sumable, unicos } from '../formato';
import * as M from '../modelo';

const COLOR_ESTADO: Record<M.EstadoPedido, string> = {
  pendiente: 'yellow', parcial: 'blue', entregado: 'green', cancelado: 'gray', cerrado: 'gray',
};

export function EstadoPedido({ estado }: { estado: M.EstadoPedido }) {
  return <Badge variant="light" size="sm" color={COLOR_ESTADO[estado]}>{M.NOMBRE_ESTADO_PEDIDO[estado]}</Badge>;
}

export function Pedidos() {
  const { pedidos, stock, datos } = useBase();
  const [elegido, setElegido] = useState<string | null>(null);
  const abiertos = pedidos.filter((r) => M.pedidoAbierto(r.estado));
  const pendiente = abiertos.reduce((s, r) => s + r.lineas.reduce((a, l) => a + l.pendiente * l.precio, 0), 0);
  const conFaltante = abiertos.filter((r) => r.lineas.some((l) => l.pendiente > 0 && M.faltante(stock, l.productoId, r.pedido.depositoId) > 0)).length;
  const elegidoRes = pedidos.find((r) => r.pedido.id === elegido);
  const sel = elegidoRes && M.pedidoAbierto(elegidoRes.estado) ? elegidoRes : undefined;

  return (
    <Stack gap="md">
      <Title order={2}>Pedidos</Title>
      <Kpis label="Resumen de pedidos" items={[
        { label: 'Pedidos abiertos', valor: abiertos.length },
        { label: 'Pendiente de entregar', valor: fmtMoney(pendiente) },
        { label: 'Con faltante de stock', valor: conFaltante, alerta: conFaltante > 0 },
        { label: 'Depósitos', valor: datos.depositos.length },
      ]} />

      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6 }}><FormPedido /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          {sel
            ? <Entrega key={sel.pedido.id} resumen={sel} onCerrar={() => { setElegido(null); }} />
            : (
              <Paper>
                <Encabezado titulo="Registrar entrega" />
                {elegidoRes && (
                  <Text size="sm" mb="xs">
                    El pedido {elegidoRes.pedido.id} quedó {M.NOMBRE_ESTADO_PEDIDO[elegidoRes.estado].toLowerCase()}.
                  </Text>
                )}
                <Text c="dimmed" size="sm">Elegí un pedido abierto de la lista para registrar una entrega, cerrarlo o cancelarlo.</Text>
              </Paper>
            )}
        </Grid.Col>
      </Grid>

      <ListaPedidos elegido={elegido} onElegir={setElegido} />
    </Stack>
  );
}

// Primer texto no vacío.
const primero = (...valores: (string | undefined)[]) => valores.find((v) => v !== undefined && v !== '');

function FormPedido() {
  const { datos, costos, buscarProducto, buscarContacto, escribir } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [fecha, setFecha] = useState(hoyISO);
  const [depSel, setDepSel] = useState<string | null>(null);
  const deposito = depSel ?? datos.depositos.at(-1)?.id ?? '';
  const [cliente, setCliente] = useState('');
  const [tipoSel, setTipoSel] = useState<string | null>(null);
  const [localidad, setLocalidad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [nota, setNota] = useState('');
  const [entregarAhora, setEntregarAhora] = useState(false);
  const [items, setItems] = useState<Item[]>(() => [itemVacio()]);

  const listas = useMemo(() => ({
    clientes: unicos([...datos.contactos.filter((c) => c.rol === 'cliente').map((c) => c.nombre), ...datos.pedidos.map((p) => p.cliente)]),
    localidades: unicos([...datos.contactos.map((c) => c.localidad), ...datos.pedidos.map((p) => p.localidad)]),
    provincias: unicos([...datos.contactos.map((c) => c.provincia), ...datos.pedidos.map((p) => p.provincia)]),
    tipos: datos.tipos,
    vendedores: datos.vendedores.filter((v) => v.activo).map((v) => ({ value: v.id, label: v.nombre })),
  }), [datos]);
  const tipo = tipoSel !== null && listas.tipos.includes(tipoSel) ? tipoSel : listas.tipos[0] ?? '';
  const dia = fecha ? deISO(fecha) : null;

  const lineas = items.map((it) => {
    const p = buscarProducto(it.producto);
    return { p, cantidad: aNumero(it.cantidad), precio: aNumero(it.precio), lista: p ? M.precioVigente(datos.precios, p.id, dia) : null };
  });

  // Completa los datos del cliente con su contacto o su último pedido.
  function elegirCliente(nombre: string) {
    setCliente(nombre);
    const n = normalizar(nombre);
    const contacto = buscarContacto('cliente', nombre);
    const ultimo = datos.pedidos.findLast((p) => normalizar(p.cliente) === n);
    const t = primero(contacto?.tipo, ultimo?.tipo);
    if (t && listas.tipos.includes(t)) setTipoSel(t);
    const loc = primero(contacto?.localidad, ultimo?.localidad);
    const prov = primero(contacto?.provincia, ultimo?.provincia);
    if (loc) setLocalidad(loc);
    if (prov) setProvincia(prov);
    if (ultimo && vendedores.length === 0) {
      setVendedores(datos.pedidosVendedores.filter((v) => v.pedidoId === ultimo.id).map((v) => v.vendedorId));
    }
  }

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const nombre = cliente.trim();
    const falta = !dia ? 'Elegí la fecha.'
      : !nombre ? 'Ingresá el cliente.'
      : !deposito ? 'Elegí el depósito de entrega.'
      : lineas.some((l) => !l.p) ? 'Hay productos que no existen en la lista.'
      : lineas.some((l) => !(l.cantidad > 0)) ? 'Todas las cantidades tienen que ser mayores a 0.'
      : lineas.some((l) => !(l.precio >= 0)) ? 'Falta el precio de algún producto.'
      : null;
    if (falta || !dia) { error(falta ?? 'Elegí la fecha.'); return; }

    guardar(async () => {
      const existente = buscarContacto('cliente', nombre);
      const contactoId = existente?.id ?? M.siguienteId(datos.contactos.map((c) => c.id), 'C');
      const id = M.siguienteId(datos.pedidos.map((p) => p.id), 'PE');
      const pedido: M.Pedido = {
        id, fecha: dia, contactoId, cliente: nombre, tipo, localidad: localidad.trim(), provincia: provincia.trim(),
        depositoId: deposito, nota: nota.trim(),
      };
      const pItems: M.PedidoItem[] = lineas.map((l, i) => ({
        pedidoId: id, linea: i + 1, productoId: l.p?.id ?? '', producto: l.p?.producto ?? '', cantidad: l.cantidad,
        precioLista: l.lista, precio: l.precio,
      }));
      // Los productos sin precio de lista quedan con el precio de este pedido.
      const preciosNuevos = lineas.filter((l) => l.lista === null && l.p !== undefined)
        .map((l) => M.filas.precio({ productoId: l.p?.id ?? '', producto: l.p?.producto ?? '', precio: l.precio, desde: dia }));

      let escritura: M.Escritura = {
        ...(existente ? {} : {
          contactos: [M.filas.contacto({ id: contactoId, rol: 'cliente', nombre, tipo, localidad: pedido.localidad, provincia: pedido.provincia })],
        }),
        pedidos: [M.filas.pedido(pedido)],
        pedidosItems: pItems.map(M.filas.pedidoItem),
        pedidosEstados: [M.filas.estado(id, 'abierto', new Date())],
        pedidosVendedores: vendedores.map((v) => M.filas.pedidoVendedor({ pedidoId: id, vendedorId: v })),
        precios: preciosNuevos,
      };
      if (entregarAhora) {
        const vend = datos.vendedores.filter((v) => vendedores.includes(v.id));
        const venta: M.Venta = { id: M.siguienteId(datos.ventas.map((v) => v.id), 'V'), fecha: dia, pedidoId: id, depositoId: deposito, nota: '' };
        escritura = M.unir(escritura, M.escribirEntrega(venta, pItems.map((it) => {
          const porcentaje = (v: M.Vendedor) => M.porcentajeRegla(datos.reglas, v.id, it.productoId, dia);
          return {
            linea: { ...it, entregado: 0, pendiente: it.cantidad }, cantidad: it.cantidad, costo: costos.get(it.productoId) ?? null,
            comisiones: vend.map((v) => ({ vendedor: v, porcentajeRegla: porcentaje(v), porcentaje: porcentaje(v) })),
          };
        })));
      }
      await escribir(escritura);
      const total = pItems.reduce((s, it) => s + it.cantidad * it.precio, 0);
      setItems([itemVacio()]);
      setCliente('');
      setNota('');
      setEntregarAhora(false);
      return `✓ Pedido ${id} de ${nombre} registrado${entregarAhora ? ' y entregado' : ''} (${pItems.length} producto${pItems.length > 1 ? 's' : ''}, ${fmtMoney(total)}).`;
    });
  }

  const total = lineas.reduce((s, l) => s + (l.cantidad > 0 ? l.cantidad * sumable(l.precio) : 0), 0);
  const especiales = lineas.filter((l) => l.lista !== null && !Number.isNaN(l.precio) && l.precio !== l.lista).length;

  return (
    <Paper>
      <Encabezado titulo="Nuevo pedido" />
      <form onSubmit={enviar} noValidate aria-label="Nuevo pedido">
        <Stack gap="sm">
          <Group grow gap="xs" align="flex-start">
            <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.currentTarget.value); }} />
            <NativeSelect label="Entrega desde" data={datos.depositos.map((d) => ({ value: d.id, label: d.nombre }))} value={deposito}
              onChange={(e) => { setDepSel(e.currentTarget.value); }} />
          </Group>
          <Autocomplete label="Cliente" maxLength={120} placeholder="Nombre del cliente" data={listas.clientes}
            value={cliente} onChange={setCliente} onOptionSubmit={elegirCliente} onBlur={() => { elegirCliente(cliente); }} />
          <Group grow gap="xs" align="flex-start">
            <NativeSelect label="Tipo de cliente" data={listas.tipos} value={tipo} onChange={(e) => { setTipoSel(e.currentTarget.value); }} />
            <MultiSelect label="Vendedores" placeholder={vendedores.length > 0 ? undefined : 'Sin comisión'} data={listas.vendedores}
              value={vendedores} onChange={setVendedores} />
          </Group>
          <Group grow gap="xs" align="flex-start">
            <Autocomplete label="Localidad" maxLength={80} data={listas.localidades} value={localidad} onChange={setLocalidad} />
            <Autocomplete label="Provincia" maxLength={80} data={listas.provincias} value={provincia} onChange={setProvincia} />
          </Group>

          <Items modo="pedido" deposito={deposito} fecha={dia} items={items} onChange={setItems} />

          <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
          <Checkbox label="Se entrega ahora (venta directa)" checked={entregarAhora} onChange={(e) => { setEntregarAhora(e.currentTarget.checked); }} />
          {total > 0 && (
            <Group className="suave" px="md" py="xs" gap="xl">
              <Resumen label="Total del pedido" valor={fmtMoney(total)} />
              {especiales > 0 && <Resumen label="Precios especiales" valor={especiales} />}
            </Group>
          )}
          <Button type="submit" loading={guardando}>Registrar pedido</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
    </Paper>
  );
}

// Porcentaje editado por línea y vendedor; si no está, vale el de la regla.
type Porcentajes = Record<string, number | string>;
const claveCom = (linea: number, vendedor: string) => `${linea}|${vendedor}`;

function Entrega({ resumen, onCerrar }: { resumen: M.ResumenPedido; onCerrar: () => void }) {
  const { datos, stock, costos, nombreDeposito, escribir } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const { pedido } = resumen;
  const [fecha, setFecha] = useState(hoyISO);
  const [nota, setNota] = useState('');
  // Solo las cantidades editadas; las demás proponen entregar todo lo pendiente.
  const [cantidades, setCantidades] = useState<Record<number, number | string>>({});
  const [editados, setEditados] = useState<Porcentajes>({});
  const dia = fecha ? deISO(fecha) : null;
  const vendedores = datos.vendedores.filter((v) => resumen.vendedores.includes(v.id));
  const pendientes = resumen.lineas.filter((l) => l.pendiente > 0);

  const lineas = pendientes.map((l) => {
    const cantidad = numeroOCero(cantidades[l.linea] ?? l.pendiente);
    const importe = M.redondear(cantidad * l.precio);
    const comisiones = vendedores.map((v) => {
      const porcentajeRegla = M.porcentajeRegla(datos.reglas, v.id, l.productoId, dia);
      const k = claveCom(l.linea, v.id);
      const porcentaje = !(k in editados) || editados[k] === '' ? porcentajeRegla : numeroOCero(editados[k]);
      return { vendedor: v, porcentajeRegla, porcentaje, monto: M.montoComision(importe, porcentaje) };
    });
    const costo = costos.get(l.productoId) ?? null;
    return { linea: l, cantidad, importe, comisiones, costo };
  });
  const aEntregar = lineas.filter((l) => l.cantidad > 0);
  const importe = aEntregar.reduce((s, l) => s + l.importe, 0);
  const comision = aEntregar.reduce((s, l) => s + l.comisiones.reduce((a, c) => a + c.monto, 0), 0);
  const ganancia = importe - comision - aEntregar.reduce((s, l) => s + l.cantidad * (l.costo ?? 0), 0);

  function entregar() {
    const falta = !dia ? 'Elegí la fecha.'
      : aEntregar.length === 0 ? 'Indicá qué cantidad se entrega.'
      : lineas.some((l) => l.cantidad > l.linea.pendiente) ? 'No se puede entregar más de lo pendiente.'
      : null;
    if (falta || !dia) { error(falta ?? 'Elegí la fecha.'); return; }
    guardar(async () => {
      const venta: M.Venta = { id: M.siguienteId(datos.ventas.map((v) => v.id), 'V'), fecha: dia, pedidoId: pedido.id, depositoId: pedido.depositoId, nota: nota.trim() };
      await escribir(M.escribirEntrega(venta, aEntregar));
      // La próxima entrega vuelve a proponer lo pendiente y los porcentajes de las reglas.
      setCantidades({});
      setEditados({});
      setNota('');
      return `✓ Entrega ${venta.id} registrada (${fmtMoney(importe)}).`;
    });
  }

  function cambiarEstado(estado: 'cancelado' | 'cerrado') {
    guardar(async () => {
      await escribir({ pedidosEstados: [M.filas.estado(pedido.id, estado, new Date())] });
      return `✓ Pedido ${pedido.id} ${estado}.`;
    });
  }

  return (
    <Paper>
      <Encabezado titulo={`Entregar ${pedido.id}`}>
        <Button size="xs" variant="default" onClick={onCerrar}>Cerrar</Button>
      </Encabezado>
      <Stack gap="sm" role="form" aria-label="Registrar entrega">
        <Text size="sm">
          {pedido.cliente} · {[pedido.localidad, pedido.provincia].filter(Boolean).join(', ')} · desde {nombreDeposito(pedido.depositoId)}
          {vendedores.length > 0 && <> · {vendedores.map((v) => v.nombre).join(', ')}</>}
        </Text>
        <TextInput label="Fecha de entrega" type="date" value={fecha} onChange={(e) => { setFecha(e.currentTarget.value); }} />
        {lineas.map(({ linea: l, cantidad, comisiones }) => {
          const enDep = stock.enDeposito.get(l.productoId)?.[pedido.depositoId] ?? 0;
          return (
            <Paper key={l.linea} p="xs" radius="md" withBorder>
              <Group justify="space-between" gap="xs" wrap="nowrap" align="flex-start">
                <div>
                  <Text fw={500} size="sm">{l.producto}</Text>
                  <Text size="xs" c="dimmed">
                    Pedido {fmtNum(l.cantidad)} · entregado {fmtNum(l.entregado)} · {fmtMoney(l.precio)} c/u
                    {l.precioLista !== null && l.precioLista !== l.precio && ` (lista ${fmtMoney(l.precioLista)})`}
                  </Text>
                  <Text size="xs" c={cantidad > enDep ? 'yellow.8' : 'dimmed'} fw={cantidad > enDep ? 500 : undefined}>
                    Stock en {nombreDeposito(pedido.depositoId)}: {fmtNum(enDep)}{cantidad > enDep ? ' — queda negativo' : ''}
                  </Text>
                </div>
                <NumberInput w={110} aria-label={`Entregar ${l.producto}`} allowNegative={false} max={l.pendiente}
                  value={cantidades[l.linea] ?? l.pendiente} onChange={(v) => { setCantidades((c) => ({ ...c, [l.linea]: v })); }} />
              </Group>
              {comisiones.length > 0 && (
                <Group gap="xs" mt={6}>
                  {comisiones.map((c) => (
                    <Group key={c.vendedor.id} gap={4} wrap="nowrap">
                      <NumberInput size="xs" w={80} min={0} max={100} allowNegative={false} aria-label={`Comisión ${c.vendedor.nombre} ${l.producto}`}
                        value={editados[claveCom(l.linea, c.vendedor.id)] ?? c.porcentajeRegla}
                        onChange={(v) => { setEditados((e) => ({ ...e, [claveCom(l.linea, c.vendedor.id)]: v })); }}
                        rightSection={<Text size="xs" c="dimmed">%</Text>} rightSectionPointerEvents="none" />
                      <Text size="xs" c={c.porcentaje !== c.porcentajeRegla ? 'blue' : 'dimmed'}>
                        {c.vendedor.nombre}{c.porcentaje !== c.porcentajeRegla ? ` (regla ${fmtNum(c.porcentajeRegla)}%)` : ''}
                      </Text>
                    </Group>
                  ))}
                </Group>
              )}
            </Paper>
          );
        })}
        <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
        {aEntregar.length > 0 && (
          <Group className="suave" px="md" py="xs" gap="xl">
            <Resumen label="Importe" valor={fmtMoney(importe)} />
            <Resumen label="Comisión" valor={fmtMoney(comision)} />
            <Resumen label="Ganancia" valor={fmtMoney(ganancia)} />
          </Group>
        )}
        <Group gap="xs">
          <Button onClick={entregar} loading={guardando}>Registrar entrega</Button>
          {resumen.ventas.length === 0
            ? <Button variant="default" color="red" onClick={() => { cambiarEstado('cancelado'); }} disabled={guardando}>Cancelar pedido</Button>
            : <Button variant="default" onClick={() => { cambiarEstado('cerrado'); }} disabled={guardando}>Cerrar con pendientes</Button>}
        </Group>
        <Mensaje msg={msg} />
      </Stack>
    </Paper>
  );
}

function ListaPedidos({ elegido, onElegir }: { elegido: string | null; onElegir: (id: string) => void }) {
  const { pedidos, cargando, nombreDeposito, nombreVendedor } = useBase();
  const [filtro, setFiltro] = useState('abiertos');
  const [buscar, setBuscar] = useState('');
  const q = buscar.trim().toLowerCase();
  const filas = pedidos
    .filter((r) => filtro === 'todos' || M.pedidoAbierto(r.estado))
    .filter((r) => !q || r.pedido.cliente.toLowerCase().includes(q) || r.pedido.id.toLowerCase().includes(q)
      || r.lineas.some((l) => l.producto.toLowerCase().includes(q)))
    .sort((a, b) => porFechaDesc(a.pedido, b.pedido));

  return (
    <Paper>
      <Encabezado titulo="Pedidos">
        <Group gap="xs">
          <TextInput type="search" w={220} placeholder="Buscar cliente, pedido o producto…" aria-label="Buscar pedidos"
            value={buscar} onChange={(e) => { setBuscar(e.currentTarget.value); }} />
          <SegmentedControl size="xs" value={filtro} onChange={setFiltro} aria-label="Mostrar"
            data={[{ value: 'abiertos', label: 'Abiertos' }, { value: 'todos', label: 'Todos' }]} />
        </Group>
      </Encabezado>
      <ScrollArea.Autosize mah={560} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1, whiteSpace: 'nowrap' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pedido</Table.Th><Table.Th>Fecha</Table.Th><Table.Th>Cliente</Table.Th><Table.Th>Productos</Table.Th>
              <Table.Th>Estado</Table.Th><Table.Th className="num">Importe</Table.Th><Table.Th className="num">Entregado</Table.Th>
              <Table.Th className="num">Ganancia</Table.Th><Table.Th>Desde</Table.Th><Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((r) => (
              <Table.Tr key={r.pedido.id} bg={r.pedido.id === elegido ? 'var(--erp-soft)' : undefined}>
                <Table.Td fw={500}>{r.pedido.id}</Table.Td>
                <Table.Td c="dimmed">{fmtFecha(r.pedido.fecha)}</Table.Td>
                <Table.Td>
                  {r.pedido.cliente}
                  {r.vendedores.length > 0 && <Text size="xs" c="dimmed">{r.vendedores.map(nombreVendedor).join(', ')}</Text>}
                </Table.Td>
                <Table.Td style={{ whiteSpace: 'normal' }} miw={200}>
                  {r.lineas.map((l) => (
                    <Text key={l.linea} size="xs">
                      {fmtNum(l.cantidad)} {l.producto}
                      {l.pendiente > 0 && l.entregado > 0 && <Text span inherit c="dimmed"> (faltan {fmtNum(l.pendiente)})</Text>}
                    </Text>
                  ))}
                </Table.Td>
                <Table.Td><EstadoPedido estado={r.estado} /></Table.Td>
                <Table.Td className="num">{fmtMoney(r.importePedido)}</Table.Td>
                <Table.Td className="num">{fmtMoney(r.importeEntregado)}</Table.Td>
                <Table.Td className="num" c={r.ganancia < 0 ? 'red' : undefined}>
                  {r.ventas.length > 0 ? `${fmtMoney(r.ganancia)}${r.sinCosto ? '*' : ''}` : '–'}
                </Table.Td>
                <Table.Td c="dimmed">{nombreDeposito(r.pedido.depositoId)}</Table.Td>
                <Table.Td>
                  {M.pedidoAbierto(r.estado) && (
                    <Button size="compact-xs" variant="light" onClick={() => { onElegir(r.pedido.id); }}>Entregar</Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {filas.length === 0 && <Text c="dimmed" mt="xs">No hay pedidos {filtro === 'abiertos' ? 'abiertos' : ''}.</Text>}
      {filas.some((r) => r.sinCosto) && <Text size="xs" c="dimmed" mt="xs">* Hay productos sin costo de compra: la ganancia no los descuenta.</Text>}
    </Paper>
  );
}
