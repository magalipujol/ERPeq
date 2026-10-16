import { BarChart } from '@mantine/charts';
import {
  Autocomplete, Button, Grid, Group, NativeSelect, NumberInput, Paper, ScrollArea, Stack, Table, Text, TextInput, Title,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { DEPS, useBase, useGuardar } from '../base';
import { Encabezado, Kpis, Mensaje, Resumen, SelectorMes, mesElegido } from '../componentes/comunes';
import { type Item, Items, itemVacio } from '../componentes/Items';
import { aNumero, deISO, fmtFecha, fmtMes, fmtMoney, fmtNum, hoyISO, unicos } from '../formato';
import * as DB from '../google';
import * as M from '../modelo';

export function Ventas({ visible }: { visible: boolean }) {
  const { datos } = useBase();
  const [mesSel, setMes] = useState<string | null>(null);
  const fechas = useMemo(() => datos.ventas.map((v) => v.fecha), [datos]);
  const mes = mesElegido(fechas, mesSel);
  const delMes = datos.ventas.filter((v) => v.fecha && M.claveMes(v.fecha) === mes);
  const suma = (k: 'importe' | 'ganancia' | 'comision') => delMes.reduce((s, v) => s + (v[k] || 0), 0);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Ventas</Title>
        <SelectorMes fechas={fechas} value={mesSel} onChange={setMes} />
      </Group>
      <Kpis label="Resumen de ventas" items={[
        { label: 'Vendido', valor: fmtMoney(suma('importe')) },
        { label: 'Ganancia', valor: fmtMoney(suma('ganancia')) },
        { label: 'Comisiones', valor: fmtMoney(suma('comision')) },
        { label: 'Clientes distintos', valor: new Set(delMes.map((v) => v.cliente)).size },
      ]} />

      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6.5 }}><FormVenta /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 5.5 }}>{visible && <GraficoVentas />}</Grid.Col>
      </Grid>

      <DetalleVentas ventas={delMes} />
    </Stack>
  );
}

function FormVenta() {
  const { datos, costos, buscarProducto } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [fecha, setFecha] = useState(hoyISO);
  const [deposito, setDeposito] = useState(DEPS[0]);
  const [cliente, setCliente] = useState('');
  const [tipoSel, setTipo] = useState<string | null>(null);
  const [comisionTxt, setComision] = useState<number | string>('');
  const [localidad, setLocalidad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [carga, setCarga] = useState('');
  const [nota, setNota] = useState('');
  const [items, setItems] = useState<Item[]>(() => [itemVacio()]);

  const listas = useMemo(() => ({
    clientes: unicos(datos.ventas.map((v) => v.cliente)),
    localidades: unicos(datos.ventas.map((v) => v.localidad)),
    provincias: unicos(datos.ventas.map((v) => v.provincia)),
    cargas: unicos(datos.ventas.map((v) => v.carga)),
    tipos: datos.tipos.map((t) => t.tipo),
  }), [datos]);
  const tipo = tipoSel && listas.tipos.includes(tipoSel) ? tipoSel : listas.tipos[0] ?? '';
  const comisionDeTipo = (t: string) => datos.tipos.find((x) => x.tipo === t)?.comision ?? 0;

  const pct = aNumero(comisionTxt) || 0;
  const lineas = items.map((it) => {
    const p = buscarProducto(it.producto);
    const cantidad = aNumero(it.cantidad);
    const precio = aNumero(it.precio);
    const costo = p ? (costos.get(p.id) ?? null) : null;
    return { p, cantidad, precio, costo, calc: p && cantidad > 0 ? M.lineaVenta({ cantidad, precio, comisionPct: pct, costo }) : null };
  });

  function elegirCliente(nombre: string) {
    setCliente(nombre);
    const n = nombre.trim().toLowerCase();
    const ultima = [...datos.ventas].reverse().find((v) => v.cliente.toLowerCase() === n);
    if (!ultima) return;
    const t = listas.tipos.includes(ultima.tipo) ? ultima.tipo : tipo;
    setTipo(t);
    setComision(comisionDeTipo(t));
    setLocalidad(ultima.localidad);
    setProvincia(ultima.provincia);
    if (!carga) setCarga(ultima.carga);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const nombre = cliente.trim();
    const falta = !fecha ? 'Elegí la fecha.'
      : !nombre ? 'Ingresá el cliente.'
      : lineas.some((l) => !l.p) ? 'Hay productos que no existen en la lista.'
      : lineas.some((l) => !(l.cantidad > 0)) ? 'Todas las cantidades tienen que ser mayores a 0.'
      : lineas.some((l) => !(l.precio >= 0)) ? 'Falta el precio de algún producto.'
      : null;
    if (falta) return error(falta);

    const base = {
      fecha: deISO(fecha), deposito, cliente: nombre, tipo,
      localidad: localidad.trim(), provincia: provincia.trim(), carga: carga.trim(), nota: nota.trim(),
    };
    guardar(async () => {
      await DB.agregarFilas('Ventas', lineas.map((l) => M.filas.venta({
        ...base, id: l.p!.id, producto: l.p!.producto, cantidad: l.cantidad, precio: l.precio,
        importe: l.calc!.importe, comision: l.calc!.comision, costo: l.costo, ganancia: l.calc!.ganancia,
      })));
      const total = lineas.reduce((s, l) => s + l.calc!.importe, 0);
      setItems([itemVacio()]);
      setCliente('');
      setNota('');
      return `✓ Venta a ${nombre} registrada (${lineas.length} producto${lineas.length > 1 ? 's' : ''}, ${fmtMoney(total)}).`;
    });
  }

  const validas = lineas.filter((l) => l.calc);
  const sumar = (k: 'importe' | 'comision' | 'ganancia') => validas.reduce((s, l) => s + (l.calc![k] || 0), 0);
  const sinCosto = validas.some((l) => l.calc!.ganancia === null);

  return (
    <Paper>
      <Encabezado titulo="Registrar venta" />
      <form onSubmit={enviar} noValidate>
        <Stack gap="sm">
          <Group grow gap="xs" align="flex-start">
            <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.currentTarget.value)} />
            <NativeSelect label="Depósito" data={DEPS} value={deposito} onChange={(e) => setDeposito(e.currentTarget.value)} />
          </Group>
          <Autocomplete label="Cliente" maxLength={120} placeholder="Nombre del cliente" data={listas.clientes}
            value={cliente} onChange={setCliente} onOptionSubmit={elegirCliente} onBlur={() => elegirCliente(cliente)} />
          <Group grow gap="xs" align="flex-start">
            <NativeSelect label="Tipo de cliente" data={listas.tipos} value={tipo}
              onChange={(e) => { setTipo(e.currentTarget.value); setComision(comisionDeTipo(e.currentTarget.value)); }} />
            <NumberInput label="Comisión" min={0} max={100} allowNegative={false} value={comisionTxt} onChange={setComision}
              rightSection={<Text size="xs" c="dimmed">%</Text>} rightSectionPointerEvents="none" />
          </Group>
          <Group grow gap="xs" align="flex-start">
            <Autocomplete label="Localidad" maxLength={80} data={listas.localidades} value={localidad} onChange={setLocalidad} />
            <Autocomplete label="Provincia" maxLength={80} data={listas.provincias} value={provincia} onChange={setProvincia} />
          </Group>
          <Autocomplete label="Carga" maxLength={60} placeholder="Quién carga / vende" data={listas.cargas} value={carga} onChange={setCarga} />

          <Items tipo="venta" deposito={deposito} items={items} onChange={setItems} />

          <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => setNota(e.currentTarget.value)} />
          {validas.length > 0 && (
            <Group className="suave" px="md" py="xs" gap="xl">
              <Resumen label="Importe" valor={fmtMoney(sumar('importe'))} />
              <Resumen label="Comisión" valor={fmtMoney(sumar('comision'))} />
              <Resumen label={`Ganancia${sinCosto ? '*' : ''}`} valor={fmtMoney(sumar('ganancia'))} />
              {sinCosto && <Text size="xs" c="dimmed" w="100%">* Hay productos sin costo de compra: su ganancia no se calcula.</Text>}
            </Group>
          )}
          <Button type="submit" loading={guardando}>Registrar venta</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
    </Paper>
  );
}

function GraficoVentas() {
  const { datos } = useBase();
  const meses = M.ventasPorMes(datos.ventas).slice(-12).map((m) => ({
    mes: fmtMes(m.mes).replace(/ de /, ' '), Vendido: Math.round(m.importe), Ganancia: Math.round(m.ganancia),
  }));
  return (
    <Paper>
      <Encabezado titulo="Ventas por mes" />
      <BarChart
        h={300}
        data={meses}
        dataKey="mes"
        withLegend
        legendProps={{ verticalAlign: 'bottom' }}
        series={[{ name: 'Vendido', color: 'var(--c1)' }, { name: 'Ganancia', color: 'var(--c2)' }]}
        valueFormatter={fmtMoney}
        yAxisProps={{ tickFormatter: (v: number) => `$${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M` }}
        gridAxis="y"
        aria-label="Vendido y ganancia por mes"
      />
    </Paper>
  );
}

function DetalleVentas({ ventas }: { ventas: M.Venta[] }) {
  const { cargando } = useBase();
  const [buscar, setBuscar] = useState('');
  const q = buscar.trim().toLowerCase();
  const filas = ventas
    .filter((v) => !q || v.cliente.toLowerCase().includes(q) || v.producto.toLowerCase().includes(q))
    .sort((a, b) => b.fecha!.getTime() - a.fecha!.getTime());

  return (
    <Paper>
      <Encabezado titulo="Detalle del mes">
        <TextInput type="search" w={220} placeholder="Buscar cliente o producto…" aria-label="Buscar en ventas"
          value={buscar} onChange={(e) => setBuscar(e.currentTarget.value)} />
      </Encabezado>
      <ScrollArea.Autosize mah={560} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1, whiteSpace: 'nowrap' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th><Table.Th>Cliente</Table.Th><Table.Th>Producto</Table.Th>
              <Table.Th className="num">Cant.</Table.Th><Table.Th className="num">Precio</Table.Th>
              <Table.Th className="num">Importe</Table.Th><Table.Th className="num">Comisión</Table.Th>
              <Table.Th className="num">Ganancia</Table.Th><Table.Th>Depósito</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((v, i) => (
              <Table.Tr key={i}>
                <Table.Td c="dimmed">{fmtFecha(v.fecha)}</Table.Td>
                <Table.Td>
                  {v.cliente}
                  {v.nota && <Text size="xs" c="dimmed" style={{ whiteSpace: 'normal' }}>{v.nota}</Text>}
                </Table.Td>
                <Table.Td>{v.producto}</Table.Td>
                <Table.Td className="num">{fmtNum(v.cantidad)}</Table.Td>
                <Table.Td className="num">{fmtMoney(v.precio)}</Table.Td>
                <Table.Td className="num" fw={600}>{fmtMoney(v.importe)}</Table.Td>
                <Table.Td className="num" c="dimmed">{v.comision ? fmtMoney(v.comision) : '–'}</Table.Td>
                <Table.Td className="num" c={(v.ganancia ?? 0) < 0 ? 'red' : undefined} fw={(v.ganancia ?? 0) < 0 ? 600 : undefined}>
                  {fmtMoney(v.ganancia)}
                </Table.Td>
                <Table.Td c="dimmed">{v.deposito}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {!filas.length && <Text c="dimmed" mt="xs">No hay ventas en este mes.</Text>}
    </Paper>
  );
}
