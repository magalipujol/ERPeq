import { Modal, SegmentedControl, ScrollArea, SimpleGrid, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAddressBook, IconBowlSpoon, IconBox, IconCash, IconChartBar, IconClipboardList, IconCoins, IconDots, IconHome, IconPackage, IconPercentage, IconPointFilled, IconReceipt2,
  IconShoppingCart, IconTag, IconTruck,
} from '@tabler/icons-react';

export interface OpcionNav<V extends string> { value: V; label: string; grupo: string }

const ICONOS: Record<string, typeof IconPackage> = {
  inicio: IconHome, stock: IconPackage, pedidos: IconClipboardList, ventas: IconReceipt2, compras: IconShoppingCart,
  recetas: IconBowlSpoon, fletes: IconTruck, precios: IconTag, costos: IconCoins, comisiones: IconPercentage, contactos: IconAddressBook, productos: IconBox, caja: IconCash,
  analisis: IconChartBar,
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

// Pantallas con botón propio en la barra inferior; todas están además en la pantalla «Más». Con OpenDyslexic entran cinco
// botones con la etiqueta entera en un celular de 360 px.
const EN_BARRA = 4;

function BotonBarra({ Icono, label, activa, className, ...props }:
  { Icono: typeof IconPackage; label: string; activa: boolean } & React.ComponentPropsWithoutRef<'button'>) {
  return (
    <UnstyledButton className={`barra-inferior-boton ${className ?? ''}`} data-activa={activa || undefined} {...props}>
      <Icono size={22} stroke={activa ? 2.2 : 1.6} aria-hidden />
      <Text span fz="0.75rem" fw={activa ? 700 : 400} lh={1.1}>{label}</Text>
    </UnstyledButton>
  );
}

// Barra de pantallas fija abajo, al alcance del pulgar. Va dentro de AppShell.Footer.
export function BarraInferior<V extends string>({ opciones, value, onChange }:
  { opciones: readonly OpcionNav<V>[]; value: V; onChange: (v: V) => void }) {
  const ir = (v: V) => { onChange(v); window.scrollTo({ top: 0 }); };
  const resto = opciones.slice(EN_BARRA);
  const [abierto, { open: abrir, close: cerrar }] = useDisclosure(false);
  const grupos = new Map<string, OpcionNav<V>[]>();
  for (const o of opciones) grupos.set(o.grupo, [...(grupos.get(o.grupo) ?? []), o]);
  return (
    <nav aria-label="Pantalla" className="barra-inferior">
      {opciones.slice(0, EN_BARRA).map((o) => (
        <BotonBarra key={o.value} Icono={ICONOS[o.value] ?? IconPointFilled} label={o.label} activa={o.value === value}
          aria-current={o.value === value ? 'page' : undefined} onClick={() => { ir(o.value); }} />
      ))}
      <BotonBarra Icono={IconDots} label="Más" activa={abierto || resto.some((o) => o.value === value)}
        aria-haspopup="dialog" onClick={abrir} />
      <Modal opened={abierto} onClose={cerrar} title="Pantallas" fullScreen>
        <Stack gap="lg">
          {[...grupos].map(([grupo, items]) => (
            <section key={grupo} aria-label={grupo}>
              <Title order={3} fz="md" c="dimmed" mb="xs">{grupo}</Title>
              <SimpleGrid cols={2} spacing="xs">
                {items.map((o) => {
                  const Icono = ICONOS[o.value] ?? IconPointFilled;
                  const activa = o.value === value;
                  return (
                    <UnstyledButton key={o.value} className="pantalla-mas" data-activa={activa || undefined}
                      aria-current={activa ? 'page' : undefined} onClick={() => { cerrar(); ir(o.value); }}>
                      <Icono size={28} stroke={activa ? 2.2 : 1.6} aria-hidden />
                      <Text span fz="sm" fw={activa ? 700 : 400} lh={1.1}>{o.label}</Text>
                    </UnstyledButton>
                  );
                })}
              </SimpleGrid>
            </section>
          ))}
        </Stack>
      </Modal>
    </nav>
  );
}
