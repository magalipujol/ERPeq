import { Group, Paper, Select, SimpleGrid, Text, Title } from '@mantine/core';
import { fmtMes } from '../formato';
import { mesElegido, mesesDisponibles } from '../meses';

export interface Kpi { label: string; valor: React.ReactNode; alerta?: boolean }

export function Kpis({ items, label }: { items: Kpi[]; label: string }) {
  return (
    <SimpleGrid cols={{ base: 2, md: items.length }} spacing="sm" role="group" aria-label={label}>
      {items.map((k) => (
        <Paper key={k.label} p="sm" px="md" role="group" aria-label={k.label}>
          <Text size="xs" c="dimmed">{k.label}</Text>
          <Title order={3} size="h2" c={k.alerta === true ? 'red' : undefined} style={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
            {k.valor}
          </Title>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

export function Mensaje({ msg }: { msg: { texto: string; error: boolean } | null }) {
  return (
    <Text size="sm" mih="1.3em" c={msg?.error === true ? 'red' : 'green'} role="status">{msg?.texto}</Text>
  );
}

export function Encabezado({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <Group justify="space-between" mb="sm" gap="xs">
      <Title order={2} size="h4">{titulo}</Title>
      {children}
    </Group>
  );
}

export function SelectorMes({ fechas, value, onChange }:
  { fechas: (Date | null)[]; value: string | null; onChange: (mes: string) => void }) {
  const { meses } = mesesDisponibles(fechas);
  const elegido = mesElegido(fechas, value);
  return (
    <Select
      aria-label="Mes" w={200} allowDeselect={false} value={elegido}
      data={meses.map((m) => ({ value: m, label: fmtMes(m) }))}
      onChange={(v) => { if (v !== null) onChange(v); }}
    />
  );
}

export function Resumen({ label, valor }: { label: string; valor: string | number }) {
  return (
    <div role="group" aria-label={label}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>{valor}</Text>
    </div>
  );
}
