import { Button, Grid, ScrollArea, SegmentedControl, Stack, Table, Text, Title } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { type BorradorFlete, FormFlete } from '../componentes/FormFlete';
import { useBase, useGuardar } from '../base';
import { Encabezado, Kpis, Mensaje, Seccion } from '../componentes/comunes';
import { EstadoFlete, Recorrido } from '../componentes/estados';
import { Vinculo } from '../componentes/Fichas';
import { useFila } from '../ficha';
import { fmtFecha, fmtFechaHora, fmtMoney, fmtNum, porFechaDesc } from '../formato';
import * as M from '../dominio/modelo';

const ACCION: Record<M.EstadoFlete, string> = {
  preparacion: 'Volvió sin entregar', camino: 'Despachar', finalizado: 'Recibido', cancelado: 'Cancelar',
};

// Flete que otra pantalla (el mapa de Inicio) pide ver; `vez` cambia aunque se pida dos veces seguidas el mismo.
export interface FleteResaltado { id: string; vez: number }
export function Fletes({ resaltar = null, borrador = null }: { resaltar?: FleteResaltado | null; borrador?: BorradorFlete | null }) {
  const { datos, estadosFletes, costos, stock } = useBase();
  const estado = (id: string) => M.estadoFlete(estadosFletes, id);
  const activos = datos.fletes.filter((f) => M.fleteEnCurso(estado(f.id)));
  let enCamino = 0;
  for (const [id, s] of stock.enTransito) enCamino += M.sumaDeps(s) * (costos.get(id) ?? 0);

  return (
    <Stack gap="md">
      <Title order={2} className="titulo-pantalla">Fletes</Title>
      <Kpis label="Resumen de fletes" items={[
        { label: 'En preparación', valor: activos.filter((f) => estado(f.id) === 'preparacion').length },
        { label: 'En camino', valor: activos.filter((f) => estado(f.id) === 'camino').length },
        { label: 'Mercadería en camino (a costo)', valor: fmtMoney(enCamino) },
      ]} />
      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6 }}><FormFlete borrador={borrador} /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}><ListaFletes resaltar={resaltar} /></Grid.Col>
      </Grid>
    </Stack>
  );
}

function ListaFletes({ resaltar }: { resaltar: FleteResaltado | null }) {
  const { datos, estadosFletes, cargando, nombres, etiquetas, db } = useBase();
  const { guardando, msg, guardar } = useGuardar();
  const fila = useFila();
  const [filtro, setFiltro] = useState('activos');
  const tablaRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    if (!resaltar) return;
    tablaRef.current?.querySelector(`[data-flete="${resaltar.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [resaltar]);
  const items = new Map<string, M.FleteItem[]>();
  for (const it of datos.fletesItems) items.set(it.fleteId, [...(items.get(it.fleteId) ?? []), it]);

  const filas = datos.fletes
    .map((f) => ({ f, estado: M.estadoFlete(estadosFletes, f.id) }))
    .filter((x) => filtro === 'todos' || M.fleteEnCurso(x.estado))
    .sort((a, b) => porFechaDesc(a.f, b.f));

  function cambiar(id: string, estado: M.EstadoFlete) {
    guardar(async () => {
      await db.cambiarEstadoFlete(id, estado, new Date());
      return `✓ Flete de ${etiquetas.flete(id)}: ${M.NOMBRE_ESTADO_FLETE[estado].toLowerCase()}.`;
    });
  }

  return (
    <Seccion>
      <Encabezado titulo="Fletes">
        <SegmentedControl size="xs" value={filtro} onChange={setFiltro} aria-label="Mostrar fletes"
          data={[{ value: 'activos', label: 'Activos' }, { value: 'todos', label: 'Todos' }]} />
      </Encabezado>
      <Mensaje msg={msg} />
      <ScrollArea.Autosize mah={640} type="auto">
        <Table ref={tablaRef} stickyHeader highlightOnHover fz="sm" style={{ opacity: cargando ? 0.5 : 1 }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th><Table.Th>Recorrido</Table.Th><Table.Th className="num">Costo</Table.Th><Table.Th>Estado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map(({ f, estado }) => (
              <Table.Tr key={f.id} data-flete={f.id} aria-label={`Flete ${etiquetas.flete(f.id)}`} bg={f.id === resaltar?.id ? 'var(--erp-soft)' : undefined}
                aria-current={f.id === resaltar?.id ? 'true' : undefined} {...fila({ tipo: 'flete', id: f.id })}>
                <Table.Td c="dimmed">{fmtFecha(f.fecha)}</Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}><Vinculo a={{ tipo: 'flete', id: f.id }}>{nombres.contacto(f.contactoId)}</Vinculo></Text>
                  <Text size="xs" c="dimmed"><Recorrido flete={f} /></Text>
                  {(items.get(f.id) ?? []).map((it) => <Text key={it.productoId} size="xs">{fmtNum(it.cantidad)} {nombres.producto(it.productoId)}</Text>)}
                  {(f.salida ?? f.llegadaEstimada) && (
                    <Text size="xs" c="dimmed">
                      {[f.salida && `Sale ${fmtFechaHora(f.salida)}`, f.llegadaEstimada && `llega ${fmtFechaHora(f.llegadaEstimada)}`]
                        .filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td className="num">{fmtMoney(f.costo)}</Table.Td>
                <Table.Td>
                  <EstadoFlete estado={estado} />
                  <Stack gap={4} mt={6} align="flex-start">
                    {M.SIGUIENTES_FLETE[estado].map((e) => (
                      <Button key={e} size="compact-xs" variant={e === 'cancelado' || e === 'preparacion' ? 'subtle' : 'light'}
                        disabled={guardando} onClick={() => { cambiar(f.id, e); }} aria-label={`${ACCION[e]} flete de ${etiquetas.flete(f.id)}`}>
                        {ACCION[e]}
                      </Button>
                    ))}
                  </Stack>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {filas.length === 0 && <Text c="dimmed" mt="xs">No hay fletes {filtro === 'activos' ? 'activos' : ''}.</Text>}
    </Seccion>
  );
}
