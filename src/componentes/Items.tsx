import { Autocomplete, Button, CloseButton, Fieldset, Grid, Group, NativeSelect, NumberInput, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { useBase } from '../base';
import { aNumero, fmtMoney, fmtNum, numeroOCero, unicos } from '../formato';
import * as M from '../dominio/modelo';
import { type Item, itemVacio } from './item';

// compra: puede crear productos nuevos y sugiere el último precio de compra.
// pedido: sugiere el precio de lista vigente, que se puede sobreescribir.
// flete: sin precio.
export type ModoItems = 'compra' | 'pedido' | 'flete';

// Líneas de productos de una compra, un pedido o un flete.
export function Items({ modo, deposito, fecha, items, onChange }:
  { modo: ModoItems; deposito: string; fecha: Date | null; items: Item[]; onChange: (items: Item[]) => void }) {
  const { datos, buscarProducto } = useBase();
  const nombres = useMemo(() => unicos(datos.productos.map((p) => p.producto)), [datos]);

  function precioSugerido(id: string) {
    if (modo === 'pedido') return M.precioVigente(datos.precios, id, fecha);
    // Un precio 0 no sirve como sugerencia: se sigue buscando.
    for (let i = datos.compras.length - 1; i >= 0; i--) {
      const { productoId, precio } = datos.compras[i];
      if (productoId === id && precio !== null && precio !== 0) return precio;
    }
    return null;
  }

  const cambiar = (i: number, cambios: Partial<Item>) => { onChange(items.map((it, j) => (j === i ? { ...it, ...cambios } : it))); };

  function cambiarProducto(i: number, producto: string) {
    const cambios: Partial<Item> = { producto };
    const p = buscarProducto(producto);
    if (p && modo !== 'flete' && items[i].precio === '') {
      const precio = precioSugerido(p.id);
      if (precio !== null) cambios.precio = precio;
    }
    cambiar(i, cambios);
  }

  return (
    <Fieldset legend="Productos" p="sm">
      <Stack gap="sm">
        {items.map((it, i) => {
          const p = buscarProducto(it.producto);
          const unidad = p ? p.unidad : (modo === 'compra' && it.producto ? it.unidad : '');
          return (
            <div key={it.clave}>
              <Grid gap={6} align="flex-start">
                <Grid.Col span={{ base: 12, xs: modo === 'flete' ? 8 : 5 }}>
                  <Autocomplete
                    placeholder="Producto" aria-label="Producto" data={nombres}
                    value={it.producto} onChange={(v) => { cambiarProducto(i, v); }}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 'auto', xs: modo === 'flete' ? 'auto' : 3 }}>
                  <NumberInput
                    placeholder="Cant." aria-label="Cantidad" allowNegative={false}
                    value={it.cantidad} onChange={(v) => { cambiar(i, { cantidad: v }); }}
                    rightSection={<Text size="xs" c="dimmed">{unidad}</Text>} rightSectionPointerEvents="none"
                  />
                </Grid.Col>
                {modo !== 'flete' && (
                  <Grid.Col span="auto">
                    <NumberInput
                      placeholder="Precio unit." aria-label="Precio unitario" allowNegative={false}
                      value={it.precio} onChange={(v) => { cambiar(i, { precio: v }); }}
                      leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none"
                    />
                  </Grid.Col>
                )}
                <Grid.Col span="content">
                  <CloseButton
                    mt={4} title="Quitar" aria-label="Quitar" disabled={items.length === 1}
                    onClick={() => { onChange(items.filter((_, j) => j !== i)); }}
                  />
                </Grid.Col>
              </Grid>
              <Info modo={modo} item={it} deposito={deposito} fecha={fecha} onUnidad={(u) => { cambiar(i, { unidad: u }); }} />
            </div>
          );
        })}
        <Button variant="default" size="xs" style={{ alignSelf: 'flex-start' }} onClick={() => { onChange([...items, itemVacio()]); }}>
          + Agregar producto
        </Button>
      </Stack>
    </Fieldset>
  );
}

function Info({ modo, item, deposito, fecha, onUnidad }:
  { modo: ModoItems; item: Item; deposito: string; fecha: Date | null; onUnidad: (u: string) => void }) {
  const { datos, stock, nombreDeposito, buscarProducto } = useBase();
  if (!item.producto) return null;
  const p = buscarProducto(item.producto);
  if (!p) {
    return modo !== 'compra'
      ? <Text size="xs" c="red" mt={4}>No existe ese producto.</Text>
      : (
        <Group gap={6} mt={4}>
          <Text size="xs" c="yellow.8" fw={500}>Producto nuevo.</Text>
          <Text size="xs" c="dimmed">Unidad:</Text>
          <NativeSelect size="xs" aria-label="Unidad del producto nuevo" data={['kg', 'unid.']} value={item.unidad}
            onChange={(e) => { onUnidad(e.currentTarget.value); }} />
        </Group>
      );
  }
  const dep = nombreDeposito(deposito);
  const enDep = stock.enDeposito.get(p.id)?.[deposito] ?? 0;
  const cant = numeroOCero(item.cantidad);
  if (modo === 'compra') {
    return <Text size="xs" c="dimmed" mt={4}>Stock en {dep}: {fmtNum(enDep)} → {fmtNum(M.redondear(enDep + cant, 3))} {p.unidad}</Text>;
  }
  if (modo === 'flete') {
    if (!deposito) return null;
    const falta = cant > enDep;
    return (
      <Text size="xs" mt={4} c={falta ? 'yellow.8' : 'dimmed'} fw={falta ? 500 : undefined}>
        Stock en {dep}: {fmtNum(enDep)} {p.unidad}{falta ? ' — no alcanza' : ''}
      </Text>
    );
  }
  const lista = M.precioVigente(datos.precios, p.id, fecha);
  const precio = aNumero(item.precio);
  const especial = lista !== null && !Number.isNaN(precio) && precio !== lista;
  const disponible = M.redondear(enDep - (stock.comprometido.get(p.id)?.[deposito] ?? 0), 3);
  return (
    <Text size="xs" c="dimmed" mt={4}>
      Disponible en {dep}: {fmtNum(disponible)} {p.unidad}
      {disponible < cant && <Text span inherit c="yellow.8" fw={500}> — falta stock</Text>}
      {' · '}
      {lista === null
        ? <Text span inherit c="yellow.8">Sin precio de lista: se agrega con este precio</Text>
        : especial
          ? <Text span inherit c="blue" fw={500}>Precio especial (lista {fmtMoney(lista)})</Text>
          : <>Precio de lista {fmtMoney(lista)}</>}
    </Text>
  );
}
