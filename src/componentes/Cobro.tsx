import { Group, NativeSelect, NumberInput } from '@mantine/core';
import type * as M from '../dominio/modelo';
import { MEDIOS, NOMBRE_MEDIO } from '../dominio/modelo';

export interface DatosCobro { importe: number | string; medio: M.Medio; socioId: string }

// Importe, medio y socio que recibe la plata. Se usa al cobrar una venta y al registrar una entrega.
export function CamposCobro({ valor, onChange, socios, etiqueta = 'Importe cobrado', placeholder }: {
  valor: DatosCobro; onChange: (v: DatosCobro) => void; socios: M.Socio[]; etiqueta?: string; placeholder?: string;
}) {
  return (
    <Group grow gap="xs" align="flex-start">
      <NumberInput label={etiqueta} allowNegative={false}
        placeholder={placeholder} value={valor.importe} onChange={(importe) => { onChange({ ...valor, importe }); }} />
      <NativeSelect label="Medio" data={MEDIOS.map((m) => ({ value: m, label: NOMBRE_MEDIO[m] }))} value={valor.medio}
        onChange={(e) => { onChange({ ...valor, medio: e.currentTarget.value as M.Medio }); }} />
      <NativeSelect label="Recibió" data={socios.map((s) => ({ value: s.id, label: s.nombre }))} value={valor.socioId}
        onChange={(e) => { onChange({ ...valor, socioId: e.currentTarget.value }); }} />
    </Group>
  );
}
