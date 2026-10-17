import { SegmentedControl, ScrollArea, Text, UnstyledButton } from '@mantine/core';
import {
  IconClipboardList, IconHome, IconPackage, IconPointFilled, IconReceipt2, IconShoppingCart, IconTag, IconTruck,
} from '@tabler/icons-react';

export interface OpcionNav<V extends string> { value: V; label: string }

const ICONOS: Record<string, typeof IconPackage> = {
  inicio: IconHome, stock: IconPackage, pedidos: IconClipboardList, ventas: IconReceipt2, compras: IconShoppingCart,
  fletes: IconTruck, precios: IconTag,
};

// Selector de pantalla del header, para pantallas anchas. En celular se usa BarraInferior.
export function NavSuperior<V extends string>({ opciones, value, onChange }:
  { opciones: readonly OpcionNav<V>[]; value: V; onChange: (v: V) => void }) {
  return (
    <ScrollArea type="never" maw="100%" visibleFrom="sm">
      <SegmentedControl value={value} onChange={onChange} data={[...opciones]} aria-label="Pantalla" />
    </ScrollArea>
  );
}

// Barra de pantallas fija abajo, al alcance del pulgar. Va dentro de AppShell.Footer.
export function BarraInferior<V extends string>({ opciones, value, onChange }:
  { opciones: readonly OpcionNav<V>[]; value: V; onChange: (v: V) => void }) {
  return (
    <nav aria-label="Pantalla" className="barra-inferior">
      {opciones.map((o) => {
        const Icono = ICONOS[o.value] ?? IconPointFilled;
        const activa = o.value === value;
        return (
          <UnstyledButton key={o.value} className="barra-inferior-boton" aria-current={activa ? 'page' : undefined}
            onClick={() => { onChange(o.value); window.scrollTo({ top: 0 }); }}>
            <Icono size={22} stroke={activa ? 2.2 : 1.6} aria-hidden />
            <Text span size="xs" fw={activa ? 700 : 500} lh={1.1}>{o.label}</Text>
          </UnstyledButton>
        );
      })}
    </nav>
  );
}
