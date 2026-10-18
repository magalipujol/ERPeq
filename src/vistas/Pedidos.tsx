import {
  Autocomplete, Box, Button, Checkbox, Grid, Group, MultiSelect, NativeSelect, NumberInput, Paper, ScrollArea,
  SegmentedControl, Stack, Table, Text, TextInput, Title,
} from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBase, useGuardar } from '../base';
import { faltantesDe } from '../db/puerto';
import { CamposCobro, type DatosCobro } from '../componentes/Cobro';
import { Encabezado, Kpis, Mensaje, Resumen } from '../componentes/comunes';
import { EstadoPedido } from '../componentes/estados';
import { Vinculo } from '../componentes/Fichas';
import { useFila } from '../ficha';
import { ExportarWhatsApp } from '../componentes/ExportarWhatsApp';
import { type Item, itemVacio } from '../componentes/item';
import { Items } from '../componentes/Items';
import { aNumero, deISO, fmtFecha, fmtMoney, fmtNum, hoyISO, lugar, numeroOCero, porFechaDesc, sumable, unicos } from '../formato';
import * as M from '../dominio/modelo';

// `nuevo` cambia cada vez que se pide tomar un pedido nuevo desde otra pantalla: lleva el foco al formulario.
// `abrir` cambia cada vez que otra pantalla (el mapa de Inicio) pide ver un pedido: lo elige para entregarlo.
export function Pedidos({ nuevo = 0, abrir = null }: { nuevo?: number; abrir?: PedidoElegido | null }) {
  const { pedidos, stock, datos, etiquetas } = useBase();
  const [elegido, setElegido] = useState<string | null>(abrir?.id ?? null);
  const [abrirAnterior, setAbrirAnterior] = useState(abrir);
  if (abrir !== abrirAnterior) {
    setAbrirAnterior(abrir);
    if (abrir) setElegido(abrir.id);
  }
  const abiertos = pedidos.filter((r) => M.pedidoAbierto(r.estado));
  const pendiente = abiertos.reduce((s, r) => s + r.lineas.reduce((a, l) => a + l.pendiente * l.precio, 0), 0);
  const conFaltante = abiertos.filter((r) => M.lineasConFaltante(stock, r).length > 0).length;
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
        <Grid.Col span={{ base: 12, md: 6 }}><FormPedido nuevo={nuevo} /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          {sel
            ? <Entrega key={sel.pedido.id} resumen={sel} onCerrar={() => { setElegido(null); }} />
            : (
              <Paper>
                <Encabezado titulo="Registrar entrega" />
                {elegidoRes && (
                  <Text size="sm" mb="xs">
                    El pedido de {etiquetas.pedido(elegidoRes.pedido.id)} quedó {M.NOMBRE_ESTADO_PEDIDO[elegidoRes.estado].toLowerCase()}.
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

function FormPedido({ nuevo }: { nuevo: number }) {
  const { datos, costos, buscarProducto, buscarContacto, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const clienteRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (nuevo === 0) return;
    clienteRef.current?.scrollIntoView({ block: 'center' });
    clienteRef.current?.focus();
  }, [nuevo]);
  const [fecha, setFecha] = useState(hoyISO);
  const [depSel, setDepSel] = useState<string | null>(null);
  const deposito = depSel ?? datos.depositos.at(-1)?.id ?? '';
  const [cliente, setCliente] = useState('');
  // Cliente para el que ya se propusieron vendedores y depósito: no se vuelven a proponer hasta que cambie.
  const [propuestoPara, setPropuestoPara] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [nota, setNota] = useState('');
  const [entregarAhora, setEntregarAhora] = useState(false);
  // Null mientras no se toque: vale lo que propone el mínimo de envío para el total del pedido.
  const [envioElegido, setEnvioElegido] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[]>(() => [itemVacio()]);

  const listas = useMemo(() => ({
    clientes: unicos(datos.contactos.filter((c) => c.rol === 'cliente').map((c) => c.nombre)),
    vendedores: datos.vendedores.filter((v) => v.activo).map((v) => ({ value: v.id, label: v.nombre })),
  }), [datos]);
  // Los clientes se dan de alta y se corrigen en la hoja Contactos: el pedido solo elige uno que ya existe.
  const existente = buscarContacto('cliente', cliente);
  const dia = fecha ? deISO(fecha) : null;

  const lineas = items.map((it) => {
    const p = buscarProducto(it.producto);
    return { p, cantidad: aNumero(it.cantidad), precio: aNumero(it.precio), lista: p ? M.precioVigente(datos.precios, p.id, dia) : null };
  });
  const total = lineas.reduce((s, l) => s + (l.cantidad > 0 ? l.cantidad * sumable(l.precio) : 0), 0);
  const configEnvio = M.envioVigente(datos.envios, dia);
  const cobraEnvio = configEnvio !== null && (envioElegido ?? M.proponerEnvio(datos.envios, total, dia));

  // Propone los vendedores y el depósito de la localidad del cliente o, si no hay, los de su último pedido.
  function elegirCliente(nombre: string) {
    setCliente(nombre);
    const contacto = buscarContacto('cliente', nombre);
    if (!contacto || contacto.id === propuestoPara) return;
    setPropuestoPara(contacto.id);
    const propuesta = M.propuestaPedido(datos, contacto.id);
    setVendedores(propuesta.vendedores);
    if (propuesta.depositoId !== null) setDepSel(propuesta.depositoId);
  }

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const nombre = cliente.trim();
    const falta = !dia ? 'Elegí la fecha.'
      : !nombre ? 'Ingresá el cliente.'
      : !existente ? `${nombre} no está en la lista de clientes. Los clientes se agregan en la hoja Contactos de la planilla.`
      : !deposito ? 'Elegí el depósito de entrega.'
      : lineas.some((l) => !l.p) ? 'Hay productos que no existen en la lista.'
      : lineas.some((l) => !(l.cantidad > 0)) ? 'Todas las cantidades tienen que ser mayores a 0.'
      : lineas.some((l) => !(l.precio >= 0)) ? 'Falta el precio de algún producto.'
      : null;
    if (falta || !dia || !existente) { error(falta ?? 'Elegí la fecha.'); return; }

    guardar(async () => {
      const contactoId = existente.id;
      const id = M.siguienteId(datos.pedidos.map((p) => p.id), 'PE');
      const pedido: M.Pedido = { id, fecha: dia, contactoId, depositoId: deposito, nota: nota.trim(), cobraEnvio };
      const pItems: M.PedidoItem[] = lineas.map((l, i) => ({
        pedidoId: id, linea: i + 1, productoId: l.p?.id ?? '', cantidad: l.cantidad,
        precioLista: l.lista, precio: l.precio,
      }));
      // Los productos sin precio de lista quedan con el precio de este pedido.
      const preciosNuevos = lineas.filter((l) => l.lista === null && l.p !== undefined)
        .map((l) => ({ productoId: l.p?.id ?? '', precio: l.precio, desde: dia }));

      let entrega: M.Entrega | null = null;
      if (entregarAhora) {
        const vend = datos.vendedores.filter((v) => vendedores.includes(v.id));
        const envio = M.envioDeEntrega({ pedido, ventas: [] }, datos.envios);
        const venta: M.Venta = {
          id: M.siguienteId(datos.ventas.map((v) => v.id), 'V'), fecha: dia, pedidoId: id, depositoId: deposito, nota: '',
          envio, envioVendedorId: envio > 0 ? (vendedores[0] ?? '') : '',
        };
        entrega = M.armarEntrega(venta, pItems.map((it) => {
          const porcentaje = (v: M.Vendedor) => M.porcentajeRegla(datos.reglas, v.id, it.productoId, dia);
          return {
            linea: { ...it, entregado: 0, pendiente: it.cantidad }, cantidad: it.cantidad, costo: costos.get(it.productoId) ?? null,
            comisiones: vend.map((v) => ({ vendedor: v, porcentajeRegla: porcentaje(v), porcentaje: porcentaje(v) })),
          };
        }));
      }
      await db.registrarPedido({
        pedido, items: pItems, vendedores, momento: new Date(), preciosNuevos, entrega,
      });
      const importe = pItems.reduce((s, it) => s + it.cantidad * it.precio, 0);
      setItems([itemVacio()]);
      setCliente('');
      setPropuestoPara(null);
      setNota('');
      setEntregarAhora(false);
      setEnvioElegido(null);
      return `✓ Pedido de ${nombre} registrado${entregarAhora ? ' y entregado' : ''} (${pItems.length} producto${pItems.length > 1 ? 's' : ''}, ${fmtMoney(importe)}${cobraEnvio ? ' + envío' : ''}).`;
    });
  }

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
          <Autocomplete ref={clienteRef} label="Cliente" maxLength={120} placeholder="Nombre del cliente" data={listas.clientes}
            value={cliente} onChange={setCliente} onOptionSubmit={elegirCliente} onBlur={() => { elegirCliente(cliente); }}
            description={lugar(existente) || undefined} />
          <MultiSelect label="Vendedores" placeholder={vendedores.length > 0 ? undefined : 'Sin comisión'} data={listas.vendedores}
            value={vendedores} onChange={setVendedores} />

          <Items modo="pedido" deposito={deposito} fecha={dia} items={items} onChange={setItems} />

          <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
          {configEnvio && (
            <Checkbox label={`Cobrar envío (${fmtMoney(configEnvio.costo)})`} checked={cobraEnvio}
              description={`Se propone en los pedidos de menos de ${fmtMoney(configEnvio.minimo)}. Va para el vendedor, además de su comisión.`}
              onChange={(e) => { setEnvioElegido(e.currentTarget.checked); }} />
          )}
          <Checkbox label="Se entrega ahora (venta directa)" checked={entregarAhora} onChange={(e) => { setEntregarAhora(e.currentTarget.checked); }} />
          {total > 0 && (
            <Group className="suave" px="md" py="xs" gap="xl">
              <Resumen label="Total del pedido" valor={fmtMoney(total)} />
              {cobraEnvio && <Resumen label="Con envío" valor={fmtMoney(total + configEnvio.costo)} />}
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
  const { datos, info, stock, costos, nombres, etiquetas, contacto, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const { pedido } = resumen;
  // Cobro opcional en la misma operación; solo si la base ya tiene lo necesario para la caja.
  const conCobro = datos.socios.length > 0 && faltantesDe(info, 'caja').length === 0;
  const [cobro, setCobro] = useState<DatosCobro>(() => ({
    importe: '', medio: 'efectivo', socioId: M.socioPropuesto(datos.socios, resumen.vendedores)?.id ?? '',
  }));
  const cobrado = aNumero(cobro.importe);
  const [fecha, setFecha] = useState(hoyISO);
  const [nota, setNota] = useState('');
  // Solo las cantidades editadas; las demás proponen entregar todo lo pendiente.
  const [cantidades, setCantidades] = useState<Record<number, number | string>>({});
  const [editados, setEditados] = useState<Porcentajes>({});
  const dia = fecha ? deISO(fecha) : null;
  const vendedores = datos.vendedores.filter((v) => resumen.vendedores.includes(v.id));
  const pendientes = resumen.lineas.filter((l) => l.pendiente > 0);
  // Se elige desde la lista, que en celular queda debajo: lo trae a la vista.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);

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
  // El envío se cobra en la primera entrega y se le acredita a uno de los vendedores (el primero, si no se elige otro).
  const envio = aEntregar.length > 0 ? M.envioDeEntrega(resumen, datos.envios) : 0;
  const [envioVendedor, setEnvioVendedor] = useState(resumen.vendedores[0] ?? '');

  function entregar() {
    const falta = !dia ? 'Elegí la fecha.'
      : aEntregar.length === 0 ? 'Indicá qué cantidad se entrega.'
      : lineas.some((l) => l.cantidad > l.linea.pendiente) ? 'No se puede entregar más de lo pendiente.'
      : cobrado > M.redondear(importe + envio) ? 'No se puede cobrar más que el importe de la entrega.'
      : null;
    if (falta || !dia) { error(falta ?? 'Elegí la fecha.'); return; }
    const socio = datos.socios.find((s) => s.id === cobro.socioId);
    guardar(async () => {
      const venta: M.Venta = {
        id: M.siguienteId(datos.ventas.map((v) => v.id), 'V'), fecha: dia, pedidoId: pedido.id, depositoId: pedido.depositoId,
        nota: nota.trim(), envio, envioVendedorId: envio > 0 ? envioVendedor : '',
      };
      const cobros: M.Cobro[] = conCobro && cobrado > 0 && socio ? [{
        fecha: dia, ventaId: venta.id, importe: cobrado, medio: cobro.medio, socioId: socio.id, nota: '',
      }] : [];
      await db.registrarEntrega(M.armarEntrega(venta, aEntregar), cobros);
      setCobro((c) => ({ ...c, importe: '' }));
      // La próxima entrega vuelve a proponer lo pendiente y los porcentajes de las reglas.
      setCantidades({});
      setEditados({});
      setNota('');
      return `✓ Entrega a ${nombres.contacto(pedido.contactoId)} registrada (${fmtMoney(importe + envio)}${envio > 0 ? ', con envío' : ''}).`;
    });
  }

  function cambiarEstado(estado: 'cancelado' | 'cerrado') {
    guardar(async () => {
      await db.cambiarEstadoPedido(pedido.id, estado, new Date());
      return `✓ Pedido de ${etiquetas.pedido(pedido.id)} ${estado}.`;
    });
  }

  return (
    <Paper ref={ref} className="ancla">
      <Encabezado titulo={`Entregar pedido de ${etiquetas.pedido(pedido.id)}`}>
        <Button size="xs" variant="default" onClick={onCerrar}>Cerrar</Button>
      </Encabezado>
      <Stack gap="sm" role="form" aria-label="Registrar entrega">
        <Text size="sm">
          {[nombres.contacto(pedido.contactoId), lugar(contacto(pedido.contactoId)), `desde ${nombres.deposito(pedido.depositoId)}`]
            .filter(Boolean).join(' · ')}
          {vendedores.length > 0 && <> · {vendedores.map((v) => v.nombre).join(', ')}</>}
        </Text>
        <TextInput label="Fecha de entrega" type="date" value={fecha} onChange={(e) => { setFecha(e.currentTarget.value); }} />
        {lineas.map(({ linea: l, cantidad, comisiones }) => {
          const enDep = stock.enDeposito.get(l.productoId)?.[pedido.depositoId] ?? 0;
          return (
            <Paper key={l.linea} p="xs" radius="md" withBorder>
              <Group justify="space-between" gap="xs" wrap="nowrap" align="flex-start">
                <div>
                  <Text fw={500} size="sm">{nombres.producto(l.productoId)}</Text>
                  <Text size="xs" c="dimmed">
                    Pedido {fmtNum(l.cantidad)} · entregado {fmtNum(l.entregado)} · {fmtMoney(l.precio)} c/u
                    {l.precioLista !== null && l.precioLista !== l.precio && ` (lista ${fmtMoney(l.precioLista)})`}
                  </Text>
                  <Text size="xs" c={cantidad > enDep ? 'yellow.8' : 'dimmed'} fw={cantidad > enDep ? 500 : undefined}>
                    Stock en {nombres.deposito(pedido.depositoId)}: {fmtNum(enDep)}{cantidad > enDep ? ' — queda negativo' : ''}
                  </Text>
                </div>
                <NumberInput w={110} aria-label={`Entregar ${nombres.producto(l.productoId)}`} allowNegative={false} max={l.pendiente}
                  value={cantidades[l.linea] ?? l.pendiente} onChange={(v) => { setCantidades((c) => ({ ...c, [l.linea]: v })); }} />
              </Group>
              {comisiones.length > 0 && (
                <Group gap="xs" mt={6}>
                  {comisiones.map((c) => (
                    <Group key={c.vendedor.id} gap={4} wrap="nowrap">
                      <NumberInput size="xs" w={80} min={0} max={100} allowNegative={false} aria-label={`Comisión ${c.vendedor.nombre} ${nombres.producto(l.productoId)}`}
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
        {envio > 0 && vendedores.length > 1 && (
          <NativeSelect label={`El envío (${fmtMoney(envio)}) va para`} value={envioVendedor}
            data={vendedores.map((v) => ({ value: v.id, label: v.nombre }))}
            onChange={(e) => { setEnvioVendedor(e.currentTarget.value); }} />
        )}
        <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
        {conCobro && <CamposCobro valor={cobro} onChange={setCobro} socios={datos.socios} etiqueta="Cobrado en la entrega" placeholder="Sin cobrar" />}
        {aEntregar.length > 0 && (
          <Group className="suave" px="md" py="xs" gap="xl">
            <Resumen label="Importe" valor={fmtMoney(importe)} />
            {envio > 0 && <Resumen label="Envío" valor={fmtMoney(envio)} />}
            <Resumen label="Comisión" valor={fmtMoney(comision)} />
            <Resumen label="Ganancia" valor={fmtMoney(ganancia)} />
          </Group>
        )}
        {envio > 0 && (
          <Text size="xs" c="dimmed">
            El cliente paga {fmtMoney(importe + envio)}: el envío va para
            {' '}{vendedores.find((v) => v.id === envioVendedor)?.nombre ?? 'el dueño (el pedido no tiene vendedor)'} y no cuenta en la ganancia.
          </Text>
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

// Pedido que otra pantalla pide abrir; `vez` cambia aunque se pida dos veces seguidas el mismo.
export interface PedidoElegido { id: string; vez: number }

function ListaPedidos({ elegido, onElegir }: { elegido: string | null; onElegir: (id: string) => void }) {
  const { pedidos, cargando, nombres, etiquetas } = useBase();
  const fila = useFila();
  const [filtro, setFiltro] = useState('abiertos');
  const [buscar, setBuscar] = useState('');
  const q = buscar.trim().toLowerCase();
  const filas = pedidos
    .filter((r) => filtro === 'todos' || M.pedidoAbierto(r.estado))
    .filter((r) => !q || nombres.contacto(r.pedido.contactoId).toLowerCase().includes(q)      || r.lineas.some((l) => nombres.producto(l.productoId).toLowerCase().includes(q)))
    .sort((a, b) => porFechaDesc(a.pedido, b.pedido));

  return (
    <Paper>
      <Encabezado titulo="Pedidos">
        <Group gap="xs">
          <TextInput type="search" w={{ base: 260, xs: 220 }} placeholder="Buscar cliente o producto…" aria-label="Buscar pedidos"
            value={buscar} onChange={(e) => { setBuscar(e.currentTarget.value); }} />
          <SegmentedControl size="xs" value={filtro} onChange={setFiltro} aria-label="Mostrar"
            data={[{ value: 'abiertos', label: 'Abiertos' }, { value: 'todos', label: 'Todos' }]} />
          <ExportarWhatsApp />
        </Group>
      </Encabezado>
      <ScrollArea.Autosize mah={560} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1, whiteSpace: 'nowrap' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th visibleFrom="sm">Fecha</Table.Th><Table.Th>Cliente</Table.Th>
              <Table.Th visibleFrom="sm">Productos</Table.Th><Table.Th visibleFrom="sm">Estado</Table.Th>
              <Table.Th className="num" visibleFrom="sm">Importe</Table.Th><Table.Th className="num" visibleFrom="sm">Entregado</Table.Th>
              <Table.Th className="num" visibleFrom="sm">Ganancia</Table.Th><Table.Th visibleFrom="sm">Desde</Table.Th><Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((r) => (
              <Table.Tr key={r.pedido.id} aria-label={`Pedido ${etiquetas.pedido(r.pedido.id)}`}
                bg={r.pedido.id === elegido ? 'var(--erp-soft)' : undefined} {...fila({ tipo: 'pedido', id: r.pedido.id })}>
                <Table.Td c="dimmed" visibleFrom="sm">{fmtFecha(r.pedido.fecha)}</Table.Td>
                <Table.Td style={{ whiteSpace: 'normal' }} fw={500}>
                  <Vinculo a={{ tipo: 'pedido', id: r.pedido.id }}>{nombres.contacto(r.pedido.contactoId)}</Vinculo>
                  {r.vendedores.length > 0 && <Text size="xs" c="dimmed">{r.vendedores.map(nombres.vendedor).join(', ')}</Text>}
                  {/* En celular, los datos de las columnas ocultas van debajo del cliente. */}
                  <Box hiddenFrom="sm" mt={4}>
                    <ProductosPedido resumen={r} />
                    <Group gap={6} mt={4}>
                      <EstadoPedido estado={r.estado} />
                      <Text size="sm" fw={500}>{fmtMoney(r.importePedido)}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">{fmtFecha(r.pedido.fecha)} · desde {nombres.deposito(r.pedido.depositoId)}</Text>
                  </Box>
                </Table.Td>
                <Table.Td style={{ whiteSpace: 'normal' }} miw={200} visibleFrom="sm"><ProductosPedido resumen={r} /></Table.Td>
                <Table.Td visibleFrom="sm"><EstadoPedido estado={r.estado} /></Table.Td>
                <Table.Td className="num" visibleFrom="sm">
                  {fmtMoney(r.importePedido)}
                  {r.pedido.cobraEnvio && <Text size="xs" c="dimmed">+ envío</Text>}
                </Table.Td>
                <Table.Td className="num" visibleFrom="sm">{fmtMoney(r.importeEntregado)}</Table.Td>
                <Table.Td className="num" c={r.ganancia < 0 ? 'red' : undefined} visibleFrom="sm">
                  {r.ventas.length > 0 ? `${fmtMoney(r.ganancia)}${r.sinCosto ? '*' : ''}` : '–'}
                </Table.Td>
                <Table.Td c="dimmed" visibleFrom="sm">{nombres.deposito(r.pedido.depositoId)}</Table.Td>
                <Table.Td>
                  {M.pedidoAbierto(r.estado) && (
                    <Button size="compact-sm" variant="light" onClick={() => { onElegir(r.pedido.id); }}>Entregar</Button>
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

function ProductosPedido({ resumen }: { resumen: M.ResumenPedido }) {
  const { nombres } = useBase();
  return resumen.lineas.map((l) => (
    <Text key={l.linea} size="xs">
      {fmtNum(l.cantidad)} {nombres.producto(l.productoId)}
      {l.pendiente > 0 && l.entregado > 0 && <Text span inherit c="dimmed"> (faltan {fmtNum(l.pendiente)})</Text>}
    </Text>
  ));
}
