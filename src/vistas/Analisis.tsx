import { BarChart } from '@mantine/charts';
import { Grid, Group, ScrollArea, SegmentedControl, Stack, Table, Text, Title, useMatches } from '@mantine/core';
import { useMemo, useState } from 'react';
import * as A from '../dominio/analisis';
import { useBase } from '../base';
import { Encabezado, Kpis, Seccion } from '../componentes/comunes';
import { Vinculo } from '../componentes/Fichas';
import { useFila } from '../ficha';
import { fmtFecha, fmtMoney, fmtNum } from '../formato';

const fmtPct = (n: number | null) =>
  (n === null ? '–' : n.toLocaleString('es-AR', { style: 'percent', maximumFractionDigits: 1 }));

// Cruza ventas, pedidos, comisiones y fletes para ver qué productos y clientes rinden más.
export function Analisis({ visible }: { visible: boolean }) {
  const { datos } = useBase();
  const [periodo, setPeriodo] = useState<A.Periodo>('6');
  const hoy = useMemo(() => new Date(), []);
  const desde = useMemo(() => A.inicioPeriodo(periodo, hoy), [periodo, hoy]);
  const productos = useMemo(() => A.analizarProductos(datos, desde), [datos, desde]);
  const clientes = useMemo(() => A.analizarClientes(datos, desde), [datos, desde]);
  const inactivos = useMemo(() => A.clientesInactivos(datos, hoy), [datos, hoy]);
  const fletes = A.fletesDelPeriodo(datos, desde);
  // En celular los cuatro períodos entran en una fila solo en tamaño chico.
  const tamPeriodo = useMatches({ base: 'xs', sm: 'sm' });

  const suma = (k: 'importe' | 'ganancia' | 'importeConCosto') => productos.reduce((s, p) => s + p[k], 0);
  const ganancia = suma('ganancia');
  const conCosto = suma('importeConCosto');

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2} className="titulo-pantalla">Análisis</Title>
        <SegmentedControl aria-label="Período" size={tamPeriodo} value={periodo} onChange={(v) => { setPeriodo(v); }}
          data={[...A.PERIODOS]} />
      </Group>
      <Kpis label="Resumen del período" items={[
        { label: 'Vendido', valor: fmtMoney(suma('importe')) },
        { label: 'Ganancia de productos', valor: fmtMoney(ganancia) },
        { label: 'Margen', valor: fmtPct(conCosto > 0 ? ganancia / conCosto : null) },
        { label: 'Fletes del período', valor: fmtMoney(fletes.total) },
        { label: 'Ganancia después de fletes', valor: fmtMoney(ganancia - fletes.total), alerta: ganancia - fletes.total < 0 },
      ]} />

      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6 }}>{visible && <MasVendidos productos={productos} />}</Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>{visible && <MayorGanancia productos={productos} />}</Grid.Col>
      </Grid>

      <GananciaPorProducto productos={productos} fletes={fletes} />

      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6 }}><ClientesActivos clientes={clientes} /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}><ClientesInactivos clientes={inactivos} /></Grid.Col>
      </Grid>
    </Stack>
  );
}

function Barras({ data, serie, color, formato, label }:
  { data: { producto: string; [k: string]: string | number }[]; serie: string; color: string; formato: (v: number) => string; label: string }) {
  if (data.length === 0) return <Text c="dimmed" size="sm">No hay ventas en el período.</Text>;
  return (
    <BarChart
      h={Math.max(180, data.length * 32 + 40)}
      data={data}
      dataKey="producto"
      orientation="vertical"
      series={[{ name: serie, color }]}
      valueFormatter={formato}
      yAxisProps={{ width: 160 }}
      gridAxis="x"
      aria-label={label}
    />
  );
}

function MasVendidos({ productos }: { productos: A.AnalisisProducto[] }) {
  const unidades = [...new Set(productos.map((p) => p.unidad))].sort();
  const [criterio, setCriterio] = useState('importe');
  const porImporte = criterio === 'importe' || !unidades.includes(criterio);
  const lista = productos
    .filter((p) => porImporte || p.unidad === criterio)
    .sort((a, b) => (porImporte ? b.importe - a.importe : b.cantidad - a.cantidad))
    .slice(0, 10);
  const top = A.masVendidoPorUnidad(productos);

  return (
    <Seccion>
      <Encabezado titulo="Productos más vendidos">
        <SegmentedControl size="xs" aria-label="Ordenar más vendidos por" value={porImporte ? 'importe' : criterio} onChange={setCriterio}
          data={[{ value: 'importe', label: 'Importe' }, ...unidades.map((u) => ({ value: u, label: `Cantidad (${u})` }))]} />
      </Encabezado>
      {unidades.length > 0 && (
        <Text size="sm" c="dimmed" mb="xs">
          Más vendido por cantidad: {unidades.map((u) => {
            const p = top.get(u);
            return p ? `${p.producto} (${fmtNum(p.cantidad)} ${u})` : '';
          }).join(' · ')}
        </Text>
      )}
      {porImporte
        ? <Barras label="Productos más vendidos por importe" serie="Vendido" color="var(--c1)" formato={fmtMoney}
          data={lista.map((p) => ({ producto: p.producto, Vendido: p.importe }))} />
        : <Barras label={`Productos más vendidos en ${criterio}`} serie="Cantidad" color="var(--c3)" formato={(v) => `${fmtNum(v)} ${criterio}`}
          data={lista.map((p) => ({ producto: p.producto, Cantidad: p.cantidad }))} />}
    </Seccion>
  );
}

function MayorGanancia({ productos }: { productos: A.AnalisisProducto[] }) {
  const [criterio, setCriterio] = useState('total');
  const total = criterio === 'total';
  const lista = productos
    .filter((p) => p.margen !== null)
    .sort((a, b) => (total ? b.ganancia - a.ganancia : (b.margen ?? 0) - (a.margen ?? 0)))
    .slice(0, 10);

  return (
    <Seccion>
      <Encabezado titulo="Productos con mayor ganancia">
        <SegmentedControl size="xs" aria-label="Ordenar ganancia por" value={criterio} onChange={setCriterio}
          data={[{ value: 'total', label: 'Total' }, { value: 'margen', label: 'Margen %' }]} />
      </Encabezado>
      {total
        ? <Barras label="Productos con mayor ganancia total" serie="Ganancia" color="var(--c2)" formato={fmtMoney}
          data={lista.map((p) => ({ producto: p.producto, Ganancia: p.ganancia }))} />
        : <Barras label="Productos con mayor margen" serie="Margen" color="var(--c2)" formato={(v) => fmtPct(v / 100)}
          data={lista.map((p) => ({ producto: p.producto, Margen: Math.round((p.margen ?? 0) * 1000) / 10 }))} />}
    </Seccion>
  );
}

function GananciaPorProducto({ productos, fletes }: { productos: A.AnalisisProducto[]; fletes: A.FletesPeriodo }) {
  const fila = useFila();
  const filas = [...productos].sort((a, b) => b.ganancia - a.ganancia);
  const sinCosto = productos.filter((p) => p.lineasSinCosto > 0).length;
  return (
    <Seccion>
      <Encabezado titulo="Ganancia por producto" />
      <ScrollArea.Autosize mah={480} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ whiteSpace: 'nowrap' }} aria-label="Ganancia por producto">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Producto</Table.Th><Table.Th className="num">Cantidad</Table.Th><Table.Th className="num">Vendido</Table.Th>
              <Table.Th className="num">Comisiones</Table.Th><Table.Th className="num">Costo</Table.Th>
              <Table.Th className="num">Ganancia</Table.Th><Table.Th className="num">Margen</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((p) => (
              <Table.Tr key={p.productoId} {...fila({ tipo: 'producto', id: p.productoId })}>
                <Table.Td>
                  <Vinculo a={{ tipo: 'producto', id: p.productoId }}>{p.producto}</Vinculo>
                  {p.lineasSinCosto > 0 && <Text size="xs" c="dimmed">{p.lineasSinCosto} {p.lineasSinCosto === 1 ? 'venta' : 'ventas'} sin costo</Text>}
                </Table.Td>
                <Table.Td className="num">{fmtNum(p.cantidad)} {p.unidad}</Table.Td>
                <Table.Td className="num">{fmtMoney(p.importe)}</Table.Td>
                <Table.Td className="num" c="dimmed">{fmtMoney(p.comisiones)}</Table.Td>
                <Table.Td className="num" c="dimmed">{fmtMoney(p.costo)}</Table.Td>
                <Table.Td className="num" fw={600} c={p.ganancia < 0 ? 'red' : undefined}>{fmtMoney(p.ganancia)}</Table.Td>
                <Table.Td className="num">{fmtPct(p.margen)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {filas.length === 0 && <Text c="dimmed" mt="xs">No hay ventas en el período.</Text>}
      <Text size="xs" c="dimmed" mt="xs">
        Ganancia = vendido − comisiones − costo. Los fletes son gasto de logística y no se reparten entre productos:
        en el período son {fletes.cantidad} y suman {fmtMoney(fletes.total)}.
        {sinCosto > 0 && ' Las ventas sin costo no cuentan para la ganancia ni el margen.'}
      </Text>
    </Seccion>
  );
}

function ClientesActivos({ clientes }: { clientes: A.AnalisisCliente[] }) {
  const fila = useFila();
  return (
    <Seccion>
      <Encabezado titulo="Clientes más activos" />
      <ScrollArea.Autosize mah={420} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ whiteSpace: 'nowrap' }} aria-label="Clientes más activos">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Cliente</Table.Th><Table.Th className="num">Pedidos</Table.Th>
              <Table.Th className="num">Comprado</Table.Th><Table.Th className="num">Último pedido</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {clientes.slice(0, 20).map((c) => (
              <Table.Tr key={c.clave} {...fila({ tipo: 'contacto', id: c.clave })}>
                <Table.Td><Vinculo a={{ tipo: 'contacto', id: c.clave }}>{c.cliente}</Vinculo></Table.Td>
                <Table.Td className="num">{c.pedidos}</Table.Td>
                <Table.Td className="num" fw={600}>{fmtMoney(c.importe)}</Table.Td>
                <Table.Td className="num" c="dimmed">{fmtFecha(c.ultimoPedido)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {clientes.length === 0 && <Text c="dimmed" mt="xs" size="sm">No hay pedidos en el período.</Text>}
    </Seccion>
  );
}

function ClientesInactivos({ clientes }: { clientes: A.ClienteInactivo[] }) {
  const fila = useFila();
  const { minimoPedidos, factor, minimoDias } = A.INACTIVO;
  return (
    <Seccion>
      <Encabezado titulo="Clientes que dejaron de comprar" />
      <Text size="xs" c="dimmed" mb="xs">
        Con {minimoPedidos} compras o más y sin comprar hace más de {factor} veces su intervalo habitual (y más
        de {minimoDias} días). Toma toda la historia, no el período elegido.
      </Text>
      <ScrollArea.Autosize mah={420} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ whiteSpace: 'nowrap' }} aria-label="Clientes que dejaron de comprar">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Cliente</Table.Th><Table.Th className="num">Compras</Table.Th><Table.Th className="num">Cada</Table.Th>
              <Table.Th className="num">Último pedido</Table.Th><Table.Th className="num">Sin comprar</Table.Th>
              <Table.Th className="num">Comprado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {clientes.map((c) => (
              <Table.Tr key={c.clave} {...fila({ tipo: 'contacto', id: c.clave })}>
                <Table.Td><Vinculo a={{ tipo: 'contacto', id: c.clave }}>{c.cliente}</Vinculo></Table.Td>
                <Table.Td className="num">{c.pedidos}</Table.Td>
                <Table.Td className="num" c="dimmed">{c.intervalo} días</Table.Td>
                <Table.Td className="num">{fmtFecha(c.ultimoPedido)}</Table.Td>
                <Table.Td className="num" fw={600} c="red">{c.diasSinComprar} días</Table.Td>
                <Table.Td className="num">{fmtMoney(c.importeHistorico)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {clientes.length === 0 && <Text c="dimmed" mt="xs" size="sm">No hay clientes inactivos.</Text>}
    </Seccion>
  );
}
