import {
  Autocomplete, Button, Grid, Group, NativeSelect, Paper, ScrollArea, Stack, Table, Text, TextInput, Title,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { useBase, useGuardar } from '../base';
import { Encabezado, Kpis, Mensaje, Resumen, SelectorMes } from '../componentes/comunes';
import { mesElegido } from '../meses';
import { type Item, itemVacio } from '../componentes/item';
import { Items } from '../componentes/Items';
import { aNumero, deISO, fmtFecha, fmtMoney, fmtNum, hoyISO, numeroOCero, porFechaDesc, unicos } from '../formato';
import * as M from '../dominio/modelo';

export function Compras() {
  const { datos } = useBase();
  const [mesSel, setMesSel] = useState<string | null>(null);
  const fechas = useMemo(() => datos.compras.map((c) => c.fecha), [datos]);
  const mes = mesElegido(fechas, mesSel);
  const delMes = datos.compras.filter((c) => c.fecha !== null && M.claveMes(c.fecha) === mes);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Compras</Title>
        <SelectorMes fechas={fechas} value={mesSel} onChange={setMesSel} />
      </Group>
      <Kpis label="Resumen de compras" items={[
        { label: 'Comprado', valor: fmtMoney(delMes.reduce((s, c) => s + (c.importe ?? 0), 0)) },
        { label: 'Compras (líneas)', valor: delMes.length },
        { label: 'Proveedores', valor: new Set(delMes.map((c) => c.proveedor)).size },
      ]} />

      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6.5 }}><FormCompra /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 5.5 }}><DetalleCompras compras={delMes} /></Grid.Col>
      </Grid>
    </Stack>
  );
}

function FormCompra() {
  const { datos, pedidos, buscarProducto, buscarContacto, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [fecha, setFecha] = useState(hoyISO);
  const [depSel, setDepSel] = useState<string | null>(null);
  const deposito = depSel ?? datos.depositos.at(0)?.id ?? '';
  const [proveedor, setProveedor] = useState('');
  const [remito, setRemito] = useState('');
  const [pedido, setPedido] = useState('');
  const [nota, setNota] = useState('');
  const [items, setItems] = useState<Item[]>(() => [itemVacio()]);
  const proveedores = useMemo(() => unicos([
    ...datos.contactos.filter((c) => c.rol === 'proveedor').map((c) => c.nombre),
    ...datos.compras.map((c) => c.proveedor),
  ]), [datos]);
  const abiertos = pedidos.filter((r) => M.pedidoAbierto(r.estado));

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const prov = proveedor.trim();
    const falta = !fecha ? 'Elegí la fecha.'
      : !prov ? 'Ingresá el proveedor.'
      : items.some((it) => !it.producto.trim()) ? 'Falta el nombre de algún producto.'
      : items.some((it) => !(aNumero(it.cantidad) > 0)) ? 'Todas las cantidades tienen que ser mayores a 0.'
      : items.some((it) => it.precio !== '' && !(aNumero(it.precio) >= 0)) ? 'Hay un precio inválido.'
      : null;
    if (falta) { error(falta); return; }

    guardar(async () => {
      // Los productos y el proveedor nuevos se agregan en la misma escritura que la compra.
      const nuevos: M.Producto[] = [];
      const idProducto = M.generadorIds(datos.productos.map((p) => p.id), 'P', 3);
      const resolver = (it: Item) => {
        const nombre = it.producto.trim().replace(/\s+/g, ' ');
        const existente = buscarProducto(nombre) ?? nuevos.find((n) => n.producto.toLowerCase() === nombre.toLowerCase());
        if (existente) return existente;
        const p = { id: idProducto(), producto: nombre, unidad: it.unidad || 'kg', minimo: null };
        nuevos.push(p);
        return p;
      };
      const lineas = items.map((it) => ({ p: resolver(it), cantidad: aNumero(it.cantidad), precio: it.precio === '' ? null : aNumero(it.precio) }));
      const existente = buscarContacto('proveedor', prov);
      const contacto = existente ?? { id: M.siguienteId(datos.contactos.map((c) => c.id), 'C'), rol: 'proveedor', nombre: prov };

      await db.registrarCompra({
        productosNuevos: nuevos,
        proveedorNuevo: existente ? null : contacto,
        lineas: lineas.map((l) => ({
          fecha: deISO(fecha), depositoId: deposito, proveedor: prov, contactoId: contacto.id, productoId: l.p.id,
          producto: l.p.producto, cantidad: l.cantidad, precio: l.precio, remito: remito.trim(), pedidoId: pedido, nota: nota.trim(),
        })),
      });
      setItems([itemVacio()]);
      setRemito('');
      setPedido('');
      setNota('');
      return `✓ Compra a ${prov} registrada (${lineas.length} producto${lineas.length > 1 ? 's' : ''}${nuevos.length > 0 ? `, ${nuevos.length} nuevo${nuevos.length > 1 ? 's' : ''}` : ''}).`;
    });
  }

  const validos = items.filter((it) => it.producto !== '' && aNumero(it.cantidad) > 0);
  const total = validos.reduce((s, it) => s + aNumero(it.cantidad) * numeroOCero(it.precio), 0);
  const nuevos = validos.filter((it) => !buscarProducto(it.producto)).length;

  return (
    <Paper>
      <Encabezado titulo="Registrar compra" />
      <form onSubmit={enviar} noValidate aria-label="Registrar compra">
        <Stack gap="sm">
          <Group grow gap="xs" align="flex-start">
            <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.currentTarget.value); }} />
            <NativeSelect label="Depósito" data={datos.depositos.map((d) => ({ value: d.id, label: d.nombre }))} value={deposito}
              onChange={(e) => { setDepSel(e.currentTarget.value); }} />
          </Group>
          <Group grow gap="xs" align="flex-start">
            <Autocomplete label="Proveedor" maxLength={120} data={proveedores} value={proveedor} onChange={setProveedor} />
            <TextInput label="Remito" maxLength={60} placeholder="Opcional" value={remito} onChange={(e) => { setRemito(e.currentTarget.value); }} />
          </Group>

          <Items modo="compra" deposito={deposito} fecha={fecha ? deISO(fecha) : null} items={items} onChange={setItems} />
          <NativeSelect label="Para el pedido" value={pedido} onChange={(e) => { setPedido(e.currentTarget.value); }} data={[
            { value: '', label: 'Ninguno (stock general)' },
            ...abiertos.map((r) => ({ value: r.pedido.id, label: `${r.pedido.id} · ${r.pedido.cliente}` })),
          ]} />

          <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
          {validos.length > 0 && (
            <Group className="suave" px="md" py="xs" gap="xl">
              <Resumen label="Total" valor={fmtMoney(total)} />
              {nuevos > 0 && <Resumen label="Productos nuevos" valor={nuevos} />}
            </Group>
          )}
          <Button type="submit" loading={guardando}>Registrar compra</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
    </Paper>
  );
}

function DetalleCompras({ compras }: { compras: M.Compra[] }) {
  const { cargando, nombreDeposito } = useBase();
  const [buscar, setBuscar] = useState('');
  const q = buscar.trim().toLowerCase();
  const filas = compras
    .filter((c) => !q || c.proveedor.toLowerCase().includes(q) || c.producto.toLowerCase().includes(q))
    .sort(porFechaDesc);

  return (
    <Paper>
      <Encabezado titulo="Detalle del mes">
        <TextInput type="search" w={220} placeholder="Buscar…" aria-label="Buscar en compras"
          value={buscar} onChange={(e) => { setBuscar(e.currentTarget.value); }} />
      </Encabezado>
      <ScrollArea.Autosize mah={560} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1, whiteSpace: 'nowrap' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th><Table.Th>Proveedor</Table.Th><Table.Th>Producto</Table.Th>
              <Table.Th className="num">Cant.</Table.Th><Table.Th className="num">Precio</Table.Th>
              <Table.Th className="num">Importe</Table.Th><Table.Th>Depósito</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((c) => (
              <Table.Tr key={c.fila}>
                <Table.Td c="dimmed">{fmtFecha(c.fecha)}</Table.Td>
                <Table.Td>
                  {c.proveedor}
                  {c.remito && <Text size="xs" c="dimmed">Remito {c.remito}</Text>}
                  {c.pedidoId && <Text size="xs" c="dimmed">Para {c.pedidoId}</Text>}
                </Table.Td>
                <Table.Td>{c.producto}</Table.Td>
                <Table.Td className="num">{fmtNum(c.cantidad)}</Table.Td>
                <Table.Td className="num">{fmtMoney(c.precio)}</Table.Td>
                <Table.Td className="num" fw={600}>{fmtMoney(c.importe)}</Table.Td>
                <Table.Td c="dimmed">{nombreDeposito(c.depositoId)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {filas.length === 0 && <Text c="dimmed" mt="xs">No hay compras en este mes.</Text>}
    </Paper>
  );
}
