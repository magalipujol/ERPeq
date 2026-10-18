import { BarChart } from '@mantine/charts';
import { Grid, Group, ScrollArea, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useBase } from '../base';
import { Encabezado, Kpis, Seccion, SelectorMes } from '../componentes/comunes';
import { Vinculo } from '../componentes/Fichas';
import { useFila } from '../ficha';
import { fmtFecha, fmtMes, fmtMoney, fmtNum, porFechaDesc } from '../formato';
import { mesElegido } from '../meses';
import * as M from '../dominio/modelo';

// Las ventas son las entregas de los pedidos: se cargan desde la pantalla Pedidos.
export function Ventas({ visible }: { visible: boolean }) {
  const { datos } = useBase();
  const [mesSel, setMesSel] = useState<string | null>(null);
  const lineas = useMemo(() => M.lineasVendidas(datos), [datos]);
  const fechas = useMemo(() => datos.ventas.map((v) => v.fecha), [datos]);
  const mes = mesElegido(fechas, mesSel);
  const enMes = (f: Date | null) => f !== null && M.claveMes(f) === mes;
  const delMes = lineas.filter((l) => enMes(l.venta.fecha));
  const fletesMes = datos.fletes.filter((f) => enMes(f.fecha)).reduce((s, f) => s + (f.costo ?? 0), 0);
  const suma = (k: 'importe' | 'comision' | 'ganancia') => delMes.reduce((s, l) => s + (l[k] ?? 0), 0);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2} className="titulo-pantalla">Ventas</Title>
        <SelectorMes fechas={fechas} value={mesSel} onChange={setMesSel} />
      </Group>
      <Kpis label="Resumen de ventas" items={[
        { label: 'Vendido', valor: fmtMoney(suma('importe')) },
        { label: 'Comisiones', valor: fmtMoney(suma('comision')) },
        { label: 'Ganancia (antes de fletes)', valor: fmtMoney(suma('ganancia')) },
        { label: 'Fletes del mes', valor: fmtMoney(fletesMes) },
        { label: 'Clientes distintos', valor: new Set(delMes.map((l) => l.pedido?.contactoId)).size },
      ]} />

      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6.5 }}>{visible && <GraficoVentas lineas={lineas} />}</Grid.Col>
        <Grid.Col span={{ base: 12, md: 5.5 }}><ComisionesMes mes={mes} /></Grid.Col>
      </Grid>

      <DetalleVentas lineas={delMes} />
    </Stack>
  );
}

function GraficoVentas({ lineas }: { lineas: M.LineaVendida[] }) {
  const meses = M.ventasPorMes(lineas).slice(-12).map((m) => ({
    mes: fmtMes(m.mes).replace(/ de /, ' '), Vendido: Math.round(m.importe), Ganancia: Math.round(m.ganancia),
  }));
  return (
    <Seccion>
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
    </Seccion>
  );
}

// Liquidación del mes: comisión de cada vendedor por las entregas del mes.
function ComisionesMes({ mes }: { mes: string }) {
  const { datos, nombres } = useBase();
  const fechaVenta = new Map(datos.ventas.map((v) => [v.id, v.fecha]));
  const porVendedor = new Map<string, { monto: number; ventas: Set<string>; editadas: number }>();
  for (const c of datos.ventasComisiones) {
    const f = fechaVenta.get(c.ventaId);
    if (!f || M.claveMes(f) !== mes) continue;
    const v = porVendedor.get(c.vendedorId) ?? { monto: 0, ventas: new Set(), editadas: 0 };
    v.monto += c.monto;
    v.ventas.add(c.ventaId);
    if (c.porcentajeRegla !== null && c.porcentajeRegla !== c.porcentaje) v.editadas += 1;
    porVendedor.set(c.vendedorId, v);
  }
  const filas = [...porVendedor.entries()].sort((a, b) => b[1].monto - a[1].monto);

  return (
    <Seccion>
      <Encabezado titulo="Comisiones del mes" />
      <Table fz="sm" aria-label="Comisiones por vendedor">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Vendedor</Table.Th><Table.Th className="num">Entregas</Table.Th><Table.Th className="num">Comisión</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filas.map(([id, v]) => (
            <Table.Tr key={id}>
              <Table.Td>
                {nombres.vendedor(id)}
                {v.editadas > 0 && <Text size="xs" c="dimmed">{v.editadas} con % distinto de la regla</Text>}
              </Table.Td>
              <Table.Td className="num">{v.ventas.size}</Table.Td>
              <Table.Td className="num" fw={600}>{fmtMoney(v.monto)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {filas.length === 0 && <Text c="dimmed" mt="xs" size="sm">No hay comisiones en este mes.</Text>}
    </Seccion>
  );
}

function DetalleVentas({ lineas }: { lineas: M.LineaVendida[] }) {
  const { cargando, nombres } = useBase();
  const fila = useFila();
  const [buscar, setBuscar] = useState('');
  const q = buscar.trim().toLowerCase();
  const filas = lineas
    .filter((l) => !q || [nombres.contacto(l.pedido?.contactoId ?? ''), nombres.producto(l.productoId)].some((t) => t.toLowerCase().includes(q)))
    .sort((a, b) => porFechaDesc(a.venta, b.venta));

  return (
    <Seccion>
      <Encabezado titulo="Detalle del mes">
        <TextInput type="search" w={220} placeholder="Buscar cliente o producto…" aria-label="Buscar en ventas"
          value={buscar} onChange={(e) => { setBuscar(e.currentTarget.value); }} />
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
            {filas.map((l) => (
              <Table.Tr key={`${l.ventaId}#${l.linea}`} {...fila({ tipo: 'venta', id: l.ventaId })}>
                <Table.Td c="dimmed">{fmtFecha(l.venta.fecha)}</Table.Td>
                <Table.Td>
                  {l.pedido && <Vinculo a={{ tipo: 'venta', id: l.ventaId }}>{nombres.contacto(l.pedido.contactoId)}</Vinculo>}
                  {l.venta.nota && <Text size="xs" c="dimmed" style={{ whiteSpace: 'normal' }}>{l.venta.nota}</Text>}
                </Table.Td>
                <Table.Td>{nombres.producto(l.productoId)}</Table.Td>
                <Table.Td className="num">{fmtNum(l.cantidad)}</Table.Td>
                <Table.Td className="num">{fmtMoney(l.precio)}</Table.Td>
                <Table.Td className="num" fw={600}>{fmtMoney(l.importe)}</Table.Td>
                <Table.Td className="num" c="dimmed">{l.comision !== 0 ? fmtMoney(l.comision) : '–'}</Table.Td>
                <Table.Td className="num" c={(l.ganancia ?? 0) < 0 ? 'red' : undefined} fw={(l.ganancia ?? 0) < 0 ? 600 : undefined}>
                  {fmtMoney(l.ganancia)}
                </Table.Td>
                <Table.Td c="dimmed">{nombres.deposito(l.venta.depositoId)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {filas.length === 0 && <Text c="dimmed" mt="xs">No hay ventas en este mes.</Text>}
    </Seccion>
  );
}
