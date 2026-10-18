import { Group, Paper, type PaperProps, Select, SimpleGrid, Text, Title } from '@mantine/core';
import { fmtMes } from '../formato';
import { mesElegido, mesesDisponibles } from '../meses';

export interface Kpi { label: string; valor: React.ReactNode; alerta?: boolean }

// Una cifra nunca se corta en dos renglones: si no entra en la tarjeta (un importe de millones en un celular de
// 360 px), la letra se achica hasta que entre. Cada carácter de OpenDyslexic en negrita ocupa unos 0,7em.
const estiloCifra = (valor: React.ReactNode): React.CSSProperties => {
  const largo = typeof valor === 'string' || typeof valor === 'number' ? String(valor).length : 0;
  return {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    fontSize: largo > 0 ? `min(var(--mantine-h2-font-size), calc(100cqi / ${largo * 0.72}))` : undefined,
  };
};

export function Kpis({ items, label }: { items: Kpi[]; label: string }) {
  return (
    <SimpleGrid cols={{ base: 2, md: items.length }} spacing={{ base: 'xs', sm: 'sm' }} role="group" aria-label={label}>
      {items.map((k) => (
        <Paper key={k.label} p={{ base: 'xs', sm: 'sm' }} px={{ base: 'sm', sm: 'md' }} role="group" aria-label={k.label} style={{ containerType: 'inline-size' }}>
          <Text size="xs" c="dimmed">{k.label}</Text>
          <Title order={3} size="h2" lh={1.3} c={k.alerta === true ? 'red' : undefined} style={estiloCifra(k.valor)}>
            {k.valor}
          </Title>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

// Cada bloque de una pantalla (un formulario, una lista, un gráfico). En la compu es una tarjeta; en el celular
// queda plano, sin borde ni relleno, para que las tarjetas de adentro (pedidos, productos) usen todo el ancho.
export function Seccion({ className, ...props }: PaperProps & React.ComponentProps<'div'>) {
  return <Paper p={{ base: 0, sm: 'md' }} className={className === undefined ? 'seccion' : `seccion ${className}`} {...props} />;
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

export function Resumen({ label, valor, c }: { label: string; valor: string | number; c?: string }) {
  return (
    <div role="group" aria-label={label}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={700} c={c} style={{ fontVariantNumeric: 'tabular-nums' }}>{valor}</Text>
    </div>
  );
}
