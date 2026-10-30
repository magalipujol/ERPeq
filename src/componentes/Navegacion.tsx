import { Menu, SegmentedControl, ScrollArea, Text, UnstyledButton } from '@mantine/core';
import {
  IconAddressBook, IconBowlSpoon, IconBox, IconCash, IconChartBar, IconClipboardList, IconDots, IconHome, IconPackage, IconPlus, IconPointFilled, IconReceipt2,
  IconShoppingCart, IconTag, IconTruck,
} from '@tabler/icons-react';

export interface OpcionNav<V extends string> { value: V; label: string }

const ICONOS: Record<string, typeof IconPackage> = {
  inicio: IconHome, stock: IconPackage, pedidos: IconClipboardList, ventas: IconReceipt2, compras: IconShoppingCart,
  recetas: IconBowlSpoon, fletes: IconTruck, precios: IconTag, contactos: IconAddressBook, productos: IconBox, caja: IconCash,
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

// Pantallas con botón propio en la barra inferior; las demás van en el menú «Más». Con el botón de la acción
// principal en el medio son cinco botones, que entran con la etiqueta entera en un celular de 360 px.
const EN_BARRA = 3;

// Menu.Target le pasa su propio className: se suma al de la barra en vez de reemplazarlo.
function BotonBarra({ Icono, label, activa, className, ...props }:
  { Icono: typeof IconPackage; label: string; activa: boolean } & React.ComponentPropsWithoutRef<'button'>) {
  return (
    <UnstyledButton className={`barra-inferior-boton ${className ?? ''}`} data-activa={activa || undefined} {...props}>
      <Icono size={22} stroke={activa ? 2.2 : 1.6} aria-hidden />
      <Text span fz="0.875rem" fw={activa ? 700 : 400} lh={1.1}>{label}</Text>
    </UnstyledButton>
  );
}

// Barra de pantallas fija abajo, al alcance del pulgar. Va dentro de AppShell.Footer. `accion` es la tarea más
// frecuente (tomar un pedido): un botón destacado en el medio de la barra, en todas las pantallas.
export function BarraInferior<V extends string>({ opciones, value, onChange, accion }:
  { opciones: readonly OpcionNav<V>[]; value: V; onChange: (v: V) => void; accion: { label: string; nombre: string; onClick: () => void } }) {
  const ir = (v: V) => { onChange(v); window.scrollTo({ top: 0 }); };
  const resto = opciones.slice(EN_BARRA);
  return (
    <nav aria-label="Pantalla" className="barra-inferior">
      {opciones.slice(0, EN_BARRA).flatMap((o, i) => [
        i === EN_BARRA - 1 && (
          <UnstyledButton key="accion" className="barra-inferior-boton barra-inferior-accion" aria-label={accion.nombre}
            onClick={() => { accion.onClick(); window.scrollTo({ top: 0 }); }}>
            <span className="barra-inferior-mas" aria-hidden><IconPlus size={24} stroke={2.6} /></span>
            <Text span fz="0.875rem" fw={700} lh={1.1}>{accion.label}</Text>
          </UnstyledButton>
        ),
        <BotonBarra key={o.value} Icono={ICONOS[o.value] ?? IconPointFilled} label={o.label} activa={o.value === value}
          aria-current={o.value === value ? 'page' : undefined} onClick={() => { ir(o.value); }} />,
      ])}
      <Menu position="top-end" offset={4} width={220}>
        <Menu.Target>
          <BotonBarra Icono={IconDots} label="Más" activa={resto.some((o) => o.value === value)} />
        </Menu.Target>
        <Menu.Dropdown>
          {resto.map((o) => {
            const Icono = ICONOS[o.value] ?? IconPointFilled;
            const activa = o.value === value;
            return (
              <Menu.Item key={o.value} leftSection={<Icono size={20} aria-hidden />} fz="md" fw={activa ? 700 : 400}
                className="barra-inferior-menu-item" aria-current={activa ? 'page' : undefined} onClick={() => { ir(o.value); }}>
                {o.label}
              </Menu.Item>
            );
          })}
        </Menu.Dropdown>
      </Menu>
    </nav>
  );
}
