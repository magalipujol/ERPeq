import { Grid, ScrollArea, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { useBase } from '../base';
import { Encabezado, Seccion } from '../componentes/comunes';
import { Vinculo } from '../componentes/Fichas';
import { FormProducto } from '../componentes/Maestros';
import { useFila } from '../ficha';
import { fmtNum } from '../formato';

// Productos: alta y lista. Cada uno se corrige desde su ficha; el precio de lista se cambia en Precios.
export function Productos() {
  return (
    <Stack gap="md">
      <Title order={2} className="titulo-pantalla">Productos</Title>
      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Seccion>
            <Encabezado titulo="Nuevo producto" />
            <FormProducto />
          </Seccion>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}><ListaProductos /></Grid.Col>
      </Grid>
    </Stack>
  );
}

function ListaProductos() {
  const { datos, cargando } = useBase();
  const fila = useFila();
  const [buscar, setBuscar] = useState('');
  const b = buscar.trim().toLowerCase();
  const filas = datos.productos
    .filter((p) => !b || p.producto.toLowerCase().includes(b))
    .sort((x, y) => x.producto.localeCompare(y.producto, 'es'));

  return (
    <Seccion>
      <Encabezado titulo="Productos">
        <TextInput type="search" w={200} placeholder="Buscar producto…" aria-label="Buscar producto"
          value={buscar} onChange={(e) => { setBuscar(e.currentTarget.value); }} />
      </Encabezado>
      <Text size="xs" c="dimmed" mb="xs">Tocá un producto para ver su ficha y corregir sus datos.</Text>
      <ScrollArea.Autosize mah={560} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }} aria-label="Lista de productos">
          <Table.Thead>
            <Table.Tr><Table.Th>Producto</Table.Th><Table.Th>Unidad</Table.Th><Table.Th className="num">Mínimo</Table.Th></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((p) => (
              <Table.Tr key={p.id} {...fila({ tipo: 'producto', id: p.id })}>
                <Table.Td><Vinculo a={{ tipo: 'producto', id: p.id }}>{p.producto}</Vinculo></Table.Td>
                <Table.Td>{p.unidad}</Table.Td>
                <Table.Td className="num">{p.minimo !== null && p.minimo > 0 ? fmtNum(p.minimo) : ''}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {filas.length === 0 && <Text c="dimmed" mt="xs">No hay productos que coincidan.</Text>}
    </Seccion>
  );
}
