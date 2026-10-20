import { Button, Group, Modal, NativeSelect, ScrollArea, Stack, Table, Text, TextInput, Title, useMatches } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useBase } from '../base';
import { Encabezado, Mensaje, Seccion } from '../componentes/comunes';
import { Vinculo } from '../componentes/Fichas';
import { FormContacto } from '../componentes/Maestros';
import { useFila } from '../ficha';
import { lugar } from '../formato';
import * as M from '../dominio/modelo';

const PLURAL: Record<M.Rol, string> = { cliente: 'Clientes', proveedor: 'Proveedores', transporte: 'Transportes' };

// Clientes, proveedores y transportes: lista y alta (en un modal). Cada uno se corrige desde su ficha.
export function Contactos() {
  const { datos, cargando } = useBase();
  const fila = useFila();
  const enCelular = useMatches({ base: true, sm: false });
  const [alta, setAlta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [rol, setRol] = useState<string>('cliente');
  const [buscar, setBuscar] = useState('');
  const b = buscar.trim().toLowerCase();
  const filas = datos.contactos
    .filter((c) => (rol === '' || c.rol === rol)
      && (!b || [c.nombre, c.localidad, c.provincia, c.telefono].some((v) => v.toLowerCase().includes(b))))
    .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));

  return (
    <Stack gap="md">
      <Title order={2} className="titulo-pantalla">Contactos</Title>
      <Seccion>
      <Encabezado titulo="Contactos">
        <Group gap="xs">
          <NativeSelect aria-label="Mostrar contactos" value={rol} onChange={(e) => { setRol(e.currentTarget.value); }}
            data={[...M.ROLES.map((r) => ({ value: r, label: PLURAL[r] })), { value: '', label: 'Todos' }]} />
          <Button leftSection={<IconPlus size={16} />} onClick={() => { setAviso(null); setAlta(true); }}>Nuevo contacto</Button>
        </Group>
      </Encabezado>
      {aviso !== null && <Mensaje msg={{ texto: aviso, error: false }} />}
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
      <Modal opened={alta} onClose={() => { setAlta(false); }} title="Nuevo contacto" fullScreen={enCelular}>
        {/* Arranca con el rol que se está mirando en la lista. */}
        <FormContacto inicial={{ rol: rol || 'cliente' }} onCancelar={() => { setAlta(false); }}
          onListo={(texto) => { setAlta(false); setAviso(texto); }} />
      </Modal>
    </Stack>
  );
}
