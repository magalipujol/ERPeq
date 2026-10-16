import { Autocomplete, Button, CloseButton, Fieldset, Grid, Group, NativeSelect, NumberInput, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { useBase } from '../base';
import { aNumero, fmtMoney, fmtNum, unicos } from '../formato';
import { redondear } from '../modelo';

export interface Item { clave: number; producto: string; cantidad: number | string; precio: number | string; unidad: string }

let siguienteClave = 0;
export const itemVacio = (): Item => ({ clave: siguienteClave++, producto: '', cantidad: '', precio: '', unidad: 'kg' });

// Líneas de productos de una venta o compra.
export function Items({ tipo, deposito, items, onChange }:
  { tipo: 'venta' | 'compra'; deposito: string; items: Item[]; onChange: (items: Item[]) => void }) {
  const { datos, buscarProducto } = useBase();
  const nombres = useMemo(() => unicos(datos.productos.map((p) => p.producto)), [datos]);

  function ultimoPrecio(id: string) {
    const fuente = tipo === 'venta' ? datos.ventas : datos.compras;
    for (let i = fuente.length - 1; i >= 0; i--) if (fuente[i].id === id && fuente[i].precio) return fuente[i].precio;
    return null;
  }

  const cambiar = (i: number, cambios: Partial<Item>) => onChange(items.map((it, j) => (j === i ? { ...it, ...cambios } : it)));

  function cambiarProducto(i: number, producto: string) {
    const cambios: Partial<Item> = { producto };
    const p = buscarProducto(producto);
    if (p && items[i].precio === '') {
      const precio = ultimoPrecio(p.id);
      if (precio) cambios.precio = precio;
    }
    cambiar(i, cambios);
  }

  return (
    <Fieldset legend="Productos" p="sm">
      <Stack gap="sm">
        {items.map((it, i) => {
          const p = buscarProducto(it.producto);
          const unidad = p ? p.unidad : (tipo === 'compra' && it.producto ? it.unidad : '');
          return (
            <div key={it.clave}>
              <Grid gap={6} align="flex-start">
                <Grid.Col span={{ base: 12, xs: 5 }}>
                  <Autocomplete
                    placeholder="Producto" aria-label="Producto" data={nombres}
                    value={it.producto} onChange={(v) => cambiarProducto(i, v)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 'auto', xs: 3 }}>
                  <NumberInput
                    placeholder="Cant." aria-label="Cantidad" allowNegative={false}
                    value={it.cantidad} onChange={(v) => cambiar(i, { cantidad: v })}
                    rightSection={<Text size="xs" c="dimmed">{unidad}</Text>} rightSectionPointerEvents="none"
                  />
                </Grid.Col>
                <Grid.Col span="auto">
                  <NumberInput
                    placeholder="Precio unit." aria-label="Precio unitario" allowNegative={false}
                    value={it.precio} onChange={(v) => cambiar(i, { precio: v })}
                    leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none"
                  />
                </Grid.Col>
                <Grid.Col span="content">
                  <CloseButton
                    mt={4} title="Quitar" aria-label="Quitar" disabled={items.length === 1}
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                  />
                </Grid.Col>
              </Grid>
              <Info tipo={tipo} item={it} deposito={deposito} onUnidad={(u) => cambiar(i, { unidad: u })} />
            </div>
          );
        })}
        <Button variant="default" size="xs" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...items, itemVacio()])}>
          + Agregar producto
        </Button>
      </Stack>
    </Fieldset>
  );
}

function Info({ tipo, item, deposito, onUnidad }:
  { tipo: 'venta' | 'compra'; item: Item; deposito: string; onUnidad: (u: string) => void }) {
  const { stock, costos, buscarProducto } = useBase();
  if (!item.producto) return null;
  const p = buscarProducto(item.producto);
  if (!p) {
    return tipo === 'venta'
      ? <Text size="xs" c="red" mt={4}>No existe ese producto.</Text>
      : (
        <Group gap={6} mt={4}>
          <Text size="xs" c="yellow.8" fw={500}>Producto nuevo.</Text>
          <Text size="xs" c="dimmed">Unidad:</Text>
          <NativeSelect size="xs" aria-label="Unidad del producto nuevo" data={['kg', 'unid.']} value={item.unidad}
            onChange={(e) => onUnidad(e.currentTarget.value)} />
        </Group>
      );
  }
  const disp = stock.get(p.id)?.[deposito] || 0;
  const costo = costos.get(p.id);
  const cant = aNumero(item.cantidad) || 0;
  if (tipo === 'venta') {
    const falta = cant > disp;
    return (
      <Text size="xs" c="dimmed" mt={4}>
        <Text span inherit c={falta ? 'yellow.8' : undefined} fw={falta ? 500 : undefined}>
          Stock en {deposito}: {fmtNum(disp)} {p.unidad}{falta ? ' — queda negativo' : ''}
        </Text>
        {' · '}Costo prom. {costo !== undefined ? fmtMoney(costo) : 'sin datos'}
      </Text>
    );
  }
  return (
    <Text size="xs" c="dimmed" mt={4}>
      Stock en {deposito}: {fmtNum(disp)} → {fmtNum(redondear(disp + cant, 3))} {p.unidad}
    </Text>
  );
}
