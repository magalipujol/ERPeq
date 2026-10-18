import { Badge, Button, Grid, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { lazy, Suspense } from 'react';
import { useBase } from '../base';
import { Encabezado, Kpis } from '../componentes/comunes';
import { fmtFecha, fmtMoney, fmtNum } from '../formato';
import * as M from '../dominio/modelo';
import { EstadoFlete, EstadoPedido, Recorrido } from '../componentes/estados';

// El mapa trae las localidades de todo el país (≈ 150 KB): se carga aparte para no demorar el resto de la app.
const Mapa = lazy(async () => import('../componentes/Mapa').then((m) => ({ default: m.Mapa })));

// Más viejo primero: lo que lleva más tiempo esperando va arriba.
const porFechaAsc = (a: { fecha: Date | null }, b: { fecha: Date | null }) =>
  (a.fecha?.getTime() ?? 0) - (b.fecha?.getTime() ?? 0);

export function Inicio({ onNuevoPedido, onIr, onPedido, onFlete, onDeposito }: {
  onNuevoPedido: () => void; onIr: (vista: 'pedidos' | 'fletes') => void;
  onPedido: (id: string) => void; onFlete: (id: string) => void; onDeposito: (id: string) => void;
}) {
  const { pedidos, stock, datos, estadosFletes, cargando, nombres, etiquetas } = useBase();

  const abiertos = pedidos
    .filter((r) => M.pedidoAbierto(r.estado))
    .map((r) => ({ r, faltan: M.lineasConFaltante(stock, r) }))
    .sort((a, b) => porFechaAsc(a.r.pedido, b.r.pedido));
  const conFaltante = abiertos.filter((x) => x.faltan.length > 0).length;

  const fletes = datos.fletes
    .map((f) => ({ f, estado: M.estadoFlete(estadosFletes, f.id) }))
    .filter((x) => M.fleteEnCurso(x.estado))
    .sort((a, b) => porFechaAsc(a.f, b.f));
  const enCamino = fletes.filter((x) => x.estado === 'camino').length;
  const itemsFlete = new Map<string, M.FleteItem[]>();
  for (const it of datos.fletesItems) itemsFlete.set(it.fleteId, [...(itemsFlete.get(it.fleteId) ?? []), it]);

  return (
    <Stack gap="md">
      <Title order={2}>Inicio</Title>

      <Button size="lg" leftSection={<IconPlus size={20} />} onClick={onNuevoPedido} style={{ alignSelf: 'flex-start' }}>
        Tomar pedido nuevo
      </Button>

      <Kpis label="Pantallazo general" items={[
        { label: 'Pedidos pendientes', valor: abiertos.length },
        { label: 'Con faltante de stock', valor: conFaltante, alerta: conFaltante > 0 },
        { label: 'Fletes en preparación', valor: fletes.length - enCamino },
        { label: 'Fletes en camino', valor: enCamino },
      ]} />

      <Grid gap="md" align="flex-start" style={{ opacity: cargando ? 0.5 : 1 }}>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper role="region" aria-label="Mapa">
            <Encabezado titulo="Mapa" />
            <Suspense fallback={<Group justify="center" py="xl"><Loader aria-label="Cargando el mapa" /></Group>}>
              <Mapa onPedido={onPedido} onFlete={onFlete} onDeposito={onDeposito} />
            </Suspense>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="md">
            <Paper role="region" aria-label="Pedidos pendientes">
              <Encabezado titulo="Pedidos pendientes">
                <Button size="xs" variant="default" onClick={() => { onIr('pedidos'); }}>Ver pedidos</Button>
              </Encabezado>
              <Stack gap="xs">
                {abiertos.map(({ r, faltan }) => (
                  <Paper key={r.pedido.id} p="xs" radius="md" withBorder role="article" aria-label={`Pedido ${etiquetas.pedido(r.pedido.id)}`}
                    style={faltan.length > 0 ? { borderColor: 'var(--mantine-color-red-5)' } : undefined}>
                    <Group justify="space-between" gap="xs" wrap="nowrap" align="flex-start">
                      <div>
                        <Text size="sm" fw={500}>{nombres.contacto(r.pedido.contactoId)}</Text>
                        <Text size="xs" c="dimmed">{fmtFecha(r.pedido.fecha)} · desde {nombres.deposito(r.pedido.depositoId)} · {fmtMoney(r.importePedido)}</Text>
                        {r.lineas.filter((l) => l.pendiente > 0).map((l) => (
                          <Text key={l.linea} size="xs">{fmtNum(l.pendiente)} {nombres.producto(l.productoId)}</Text>
                        ))}
                        {faltan.length > 0 && (
                          <Text size="xs" c="red" fw={500}>Falta stock de {faltan.map((l) => nombres.producto(l.productoId)).join(', ')}</Text>
                        )}
                      </div>
                      <Stack gap={4} align="flex-end">
                        <EstadoPedido estado={r.estado} />
                        {faltan.length > 0 && <Badge variant="filled" size="sm" color="red">Falta stock</Badge>}
                      </Stack>
                    </Group>
                  </Paper>
                ))}
              </Stack>
              {abiertos.length === 0 && <Text c="dimmed">No hay pedidos pendientes.</Text>}
            </Paper>

            <Paper role="region" aria-label="Fletes en curso">
              <Encabezado titulo="Fletes en curso">
                <Button size="xs" variant="default" onClick={() => { onIr('fletes'); }}>Ver fletes</Button>
              </Encabezado>
              <Stack gap="xs">
                {fletes.map(({ f, estado }) => (
                  <Paper key={f.id} p="xs" radius="md" withBorder role="article" aria-label={`Flete ${etiquetas.flete(f.id)}`}>
                    <Group justify="space-between" gap="xs" wrap="nowrap" align="flex-start">
                      <div>
                        <Text size="sm" fw={500}>{nombres.contacto(f.contactoId)}</Text>
                        <Text size="xs" c="dimmed">
                          {fmtFecha(f.fecha)} · <Recorrido flete={f} />
                        </Text>
                        {(itemsFlete.get(f.id) ?? []).map((it) => <Text key={it.productoId} size="xs">{fmtNum(it.cantidad)} {nombres.producto(it.productoId)}</Text>)}
                      </div>
                      <EstadoFlete estado={estado} />
                    </Group>
                  </Paper>
                ))}
              </Stack>
              {fletes.length === 0 && <Text c="dimmed">No hay fletes en curso.</Text>}
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
