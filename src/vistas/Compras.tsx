import {
  Autocomplete, Button, Grid, Group, NativeSelect, Paper, ScrollArea, Stack, Table, Text, TextInput, Title,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { DEPS, useBase, useGuardar } from '../base';
import { Encabezado, Kpis, Mensaje, Resumen, SelectorMes, mesElegido } from '../componentes/comunes';
import { type Item, Items, itemVacio } from '../componentes/Items';
import { aNumero, deISO, fmtFecha, fmtMoney, fmtNum, hoyISO, unicos } from '../formato';
import * as DB from '../google';
import * as M from '../modelo';

export function Compras() {
  const { datos } = useBase();
  const [mesSel, setMes] = useState<string | null>(null);
  const fechas = useMemo(() => datos.compras.map((c) => c.fecha), [datos]);
  const mes = mesElegido(fechas, mesSel);
  const delMes = datos.compras.filter((c) => c.fecha && M.claveMes(c.fecha) === mes);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Compras</Title>
        <SelectorMes fechas={fechas} value={mesSel} onChange={setMes} />
      </Group>
      <Kpis label="Resumen de compras" items={[
        { label: 'Comprado', valor: fmtMoney(delMes.reduce((s, c) => s + (c.importe || 0), 0)) },
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
  const { info, datos, buscarProducto } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [fecha, setFecha] = useState(hoyISO);
  const [deposito, setDeposito] = useState(DEPS[0]);
  const [proveedor, setProveedor] = useState('');
  const [remito, setRemito] = useState('');
  const [nota, setNota] = useState('');
  const [items, setItems] = useState<Item[]>(() => [itemVacio()]);
  const proveedores = useMemo(() => unicos(datos.compras.map((c) => c.proveedor)), [datos]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const prov = proveedor.trim();
    const falta = !fecha ? 'Elegí la fecha.'
      : !prov ? 'Ingresá el proveedor.'
      : items.some((it) => !it.producto.trim()) ? 'Falta el nombre de algún producto.'
      : items.some((it) => !(aNumero(it.cantidad) > 0)) ? 'Todas las cantidades tienen que ser mayores a 0.'
      : items.some((it) => it.precio !== '' && !(aNumero(it.precio) >= 0)) ? 'Hay un precio inválido.'
      : null;
    if (falta) return error(falta);

    guardar(async () => {
      // Productos nuevos: se agregan a la hoja Productos y se les copian las fórmulas de stock.
      const nuevos: M.Producto[] = [];
      let sigId = M.siguienteId(datos.productos);
      const resolver = (it: Item) => {
        const nombre = it.producto.trim().replace(/\s+/g, ' ');
        const existente = buscarProducto(nombre) || nuevos.find((n) => n.producto.toLowerCase() === nombre.toLowerCase());
        if (existente) return existente;
        const p = { id: sigId, producto: nombre, unidad: it.unidad || 'kg', minimo: null };
        sigId = `P${String(Number(sigId.slice(1)) + 1).padStart(3, '0')}`;
        nuevos.push(p);
        return p;
      };
      const lineas = items.map((it) => ({ p: resolver(it), cantidad: aNumero(it.cantidad), precio: it.precio === '' ? null : aNumero(it.precio) }));

      if (nuevos.length) {
        const upd = await DB.agregarFilas('Productos', nuevos.map(M.filas.producto));
        const fila = Number(upd.updatedRange.split('!')[1].match(/\d+/)![0]) - 1;
        const hoja = info.sheets.find((s) => s.properties.title === 'Productos');
        if (hoja) await DB.extenderFormulasProductos(hoja.properties.sheetId, fila, nuevos.length, M.PRODUCTOS_COL_STOCK, M.PRODUCTOS_COL_STOCK + DEPS.length);
      }
      await DB.agregarFilas('Compras', lineas.map((l) => M.filas.compra({
        fecha: deISO(fecha), deposito, proveedor: prov, id: l.p.id, producto: l.p.producto,
        cantidad: l.cantidad, precio: l.precio, remito: remito.trim(), nota: nota.trim(),
      })));
      setItems([itemVacio()]);
      setRemito('');
      setNota('');
      return `✓ Compra a ${prov} registrada (${lineas.length} producto${lineas.length > 1 ? 's' : ''}${nuevos.length ? `, ${nuevos.length} nuevo${nuevos.length > 1 ? 's' : ''}` : ''}).`;
    });
  }

  const validos = items.filter((it) => it.producto && aNumero(it.cantidad) > 0);
  const total = validos.reduce((s, it) => s + aNumero(it.cantidad) * (aNumero(it.precio) || 0), 0);
  const nuevos = validos.filter((it) => !buscarProducto(it.producto)).length;

  return (
    <Paper>
      <Encabezado titulo="Registrar compra" />
      <form onSubmit={enviar} noValidate>
        <Stack gap="sm">
          <Group grow gap="xs" align="flex-start">
            <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.currentTarget.value)} />
            <NativeSelect label="Depósito" data={DEPS} value={deposito} onChange={(e) => setDeposito(e.currentTarget.value)} />
          </Group>
          <Group grow gap="xs" align="flex-start">
            <Autocomplete label="Proveedor" maxLength={120} data={proveedores} value={proveedor} onChange={setProveedor} />
            <TextInput label="Remito" maxLength={60} placeholder="Opcional" value={remito} onChange={(e) => setRemito(e.currentTarget.value)} />
          </Group>

          <Items tipo="compra" deposito={deposito} items={items} onChange={setItems} />

          <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => setNota(e.currentTarget.value)} />
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
  const { cargando } = useBase();
  const [buscar, setBuscar] = useState('');
  const q = buscar.trim().toLowerCase();
  const filas = compras
    .filter((c) => !q || c.proveedor.toLowerCase().includes(q) || c.producto.toLowerCase().includes(q))
    .sort((a, b) => b.fecha!.getTime() - a.fecha!.getTime());

  return (
    <Paper>
      <Encabezado titulo="Detalle del mes">
        <TextInput type="search" w={220} placeholder="Buscar…" aria-label="Buscar en compras"
          value={buscar} onChange={(e) => setBuscar(e.currentTarget.value)} />
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
            {filas.map((c, i) => (
              <Table.Tr key={i}>
                <Table.Td c="dimmed">{fmtFecha(c.fecha)}</Table.Td>
                <Table.Td>
                  {c.proveedor}
                  {c.remito && <Text size="xs" c="dimmed">Remito {c.remito}</Text>}
                </Table.Td>
                <Table.Td>{c.producto}</Table.Td>
                <Table.Td className="num">{fmtNum(c.cantidad)}</Table.Td>
                <Table.Td className="num">{fmtMoney(c.precio)}</Table.Td>
                <Table.Td className="num" fw={600}>{fmtMoney(c.importe)}</Table.Td>
                <Table.Td c="dimmed">{c.deposito}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {!filas.length && <Text c="dimmed" mt="xs">No hay compras en este mes.</Text>}
    </Paper>
  );
}
