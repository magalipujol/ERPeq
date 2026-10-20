import { Grid, NativeSelect, ScrollArea, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { useBase } from '../base';
import { Encabezado, Seccion } from '../componentes/comunes';
import { Vinculo } from '../componentes/Fichas';
import { FormContacto } from '../componentes/Maestros';
import { useFila } from '../ficha';
import { lugar } from '../formato';
import * as M from '../dominio/modelo';

const PLURAL: Record<M.Rol, string> = { cliente: 'Clientes', proveedor: 'Proveedores', transporte: 'Transportes' };

// Clientes, proveedores y transportes: alta y lista. Cada uno se corrige desde su ficha.
export function Contactos() {
  return (
    <Stack gap="md">
      <Title order={2} className="titulo-pantalla">Contactos</Title>
      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Seccion>
            <Encabezado titulo="Nuevo contacto" />
            <FormContacto />
          </Seccion>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}><ListaContactos /></Grid.Col>
      </Grid>
    </Stack>
  );
}

function ListaContactos() {
  const { datos, cargando } = useBase();
  const fila = useFila();
  const [rol, setRol] = useState<string>('cliente');
  const [buscar, setBuscar] = useState('');
  const b = buscar.trim().toLowerCase();
  const filas = datos.contactos
    .filter((c) => (rol === '' || c.rol === rol)
      && (!b || [c.nombre, c.localidad, c.provincia, c.telefono].some((v) => v.toLowerCase().includes(b))))
    .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));

  return (
    <Seccion>
      <Encabezado titulo="Contactos">
        <NativeSelect aria-label="Mostrar contactos" value={rol} onChange={(e) => { setRol(e.currentTarget.value); }}
          data={[...M.ROLES.map((r) => ({ value: r, label: PLURAL[r] })), { value: '', label: 'Todos' }]} />
      </Encabezado>
      <TextInput type="search" mb="sm" placeholder="Buscar por nombre, localidad o teléfono…" aria-label="Buscar contacto"
        value={buscar} onChange={(e) => { setBuscar(e.currentTarget.value); }} />
      <Text size="xs" c="dimmed" mb="xs">Tocá un contacto para ver su ficha y corregir sus datos.</Text>
      <ScrollArea.Autosize mah={560} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }} aria-label="Lista de contactos">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              {rol === '' && <Table.Th>Es</Table.Th>}
              <Table.Th>Localidad</Table.Th>
              <Table.Th visibleFrom="sm">Teléfono</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((c) => (
              <Table.Tr key={c.id} {...fila({ tipo: 'contacto', id: c.id })}>
                <Table.Td><Vinculo a={{ tipo: 'contacto', id: c.id }}>{c.nombre}</Vinculo></Table.Td>
                {rol === '' && <Table.Td>{M.nombreRol(c.rol)}</Table.Td>}
                <Table.Td>{lugar(c)}</Table.Td>
                <Table.Td visibleFrom="sm">{c.telefono}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {filas.length === 0 && <Text c="dimmed" mt="xs">No hay contactos que coincidan.</Text>}
    </Seccion>
  );
}
