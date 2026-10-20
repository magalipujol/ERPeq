import { Autocomplete, Button, Group, MultiSelect, NativeSelect, Stack, Text, TextInput } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useBase, useGuardar } from '../base';
import * as M from '../dominio/modelo';
import { aISO, aNumero, deISO, fmtMoney, fmtNum, lugar, sumable, unicos } from '../formato';
import { Mensaje, Resumen } from './comunes';
import { type Item, itemVacio } from './item';
import { Items } from './Items';

// Corrige un pedido ya cargado: fecha, cliente, depósito, vendedores, productos, precios y nota. Si ya tiene
// entregas, se corrigen con él (depósito, precios, importes y comisiones). `onListo` se llama después de guardar.
export function FormCorregirPedido({ resumen, onListo, onCancelar }:
  { resumen: M.ResumenPedido; onListo: (texto: string) => void; onCancelar: () => void }) {
  const { datos, nombres, buscarProducto, buscarContacto, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const { pedido } = resumen;
  const [fecha, setFecha] = useState(() => aISO(pedido.fecha));
  const [deposito, setDeposito] = useState(pedido.depositoId);
  const [cliente, setCliente] = useState(() => nombres.contacto(pedido.contactoId));
  const [vendedores, setVendedores] = useState(resumen.vendedores);
  const [nota, setNota] = useState(pedido.nota);
  // Cada ítem recuerda la línea del pedido que era (las que se agregan no tienen).
  const [lineaDe] = useState(() => new Map<number, number>());
  const [items, setItems] = useState<Item[]>(() => resumen.lineas.map((l) => {
    const it = { ...itemVacio(), producto: nombres.producto(l.productoId), cantidad: l.cantidad, precio: l.precio };
    lineaDe.set(it.clave, l.linea);
    return it;
  }));

  const listas = useMemo(() => ({
    clientes: unicos(datos.contactos.filter((c) => c.rol === 'cliente').map((c) => c.nombre)),
    // Un vendedor dado de baja que ya estaba en el pedido se sigue ofreciendo.
    vendedores: datos.vendedores.filter((v) => v.activo || resumen.vendedores.includes(v.id)).map((v) => ({ value: v.id, label: v.nombre })),
  }), [datos, resumen.vendedores]);
  const existente = buscarContacto('cliente', cliente);
  const dia = fecha ? deISO(fecha) : null;
  const lineas = items.map((it) => ({ it, p: buscarProducto(it.producto), cantidad: aNumero(it.cantidad), precio: aNumero(it.precio) }));
  const entregadas = resumen.lineas.filter((l) => l.entregado > 0);
  const total = lineas.reduce((s, l) => s + (l.cantidad > 0 ? l.cantidad * sumable(l.precio) : 0), 0);

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const corregidas: M.LineaCorregida[] = lineas.map((l) => ({
      linea: lineaDe.get(l.it.clave) ?? null, productoId: l.p?.id ?? '', cantidad: l.cantidad, precio: l.precio,
    }));
    const falta = !dia ? 'Elegí la fecha.'
      : !existente ? `${cliente.trim() || 'El cliente'} no está en la lista de clientes.`
      : !deposito ? 'Elegí el depósito de entrega.'
      : lineas.some((l) => !l.p) ? 'Hay productos que no existen en la lista.'
      : M.problemaCorreccionPedido(resumen, corregidas);
    if (falta || !dia || !existente) { error(falta ?? 'Elegí la fecha.'); return; }
    guardar(async () => {
      const corregido: M.Pedido = { ...pedido, fecha: dia, contactoId: existente.id, depositoId: deposito, nota: nota.trim() };
      await db.corregirPedido(M.corregirPedido(datos, resumen, corregido, corregidas, vendedores));
      const n = resumen.ventas.length;
      const listo = `✓ Pedido de ${existente.nombre} corregido${n > 0 ? `, con ${n === 1 ? 'su entrega' : `sus ${n} entregas`}` : ''}.`;
      onListo(listo);
      return listo;
    });
  }

  return (
    <form onSubmit={enviar} noValidate aria-label="Corregir pedido">
      <Stack gap="sm">
        <Group grow gap="xs" align="flex-start">
          <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.currentTarget.value); }} />
          <NativeSelect label="Entrega desde" data={datos.depositos.map((d) => ({ value: d.id, label: d.nombre }))} value={deposito}
            onChange={(e) => { setDeposito(e.currentTarget.value); }} />
        </Group>
        <Autocomplete label="Cliente" maxLength={120} data={listas.clientes} value={cliente} onChange={setCliente}
          description={lugar(existente) || undefined} />
        <MultiSelect label="Vendedores" placeholder={vendedores.length > 0 ? undefined : 'Sin comisión'} data={listas.vendedores}
          value={vendedores} onChange={setVendedores} />
        <Items modo="pedido" deposito={deposito} fecha={dia} items={items} onChange={setItems} />
        {entregadas.length > 0 && (
          <Text size="xs" c="dimmed">
            Ya entregado: {entregadas.map((l) => `${fmtNum(l.entregado)} ${nombres.producto(l.productoId)}`).join(', ')}.
            Esos productos no se quitan ni se cambian, y su cantidad no baja de lo entregado.
          </Text>
        )}
        <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
        {resumen.ventas.length > 0 && (
          <Text size="sm" c="yellow.8">
            {resumen.ventas.length === 1 ? 'La entrega ya registrada se corrige' : `Las ${resumen.ventas.length} entregas ya registradas se corrigen`}
            {' '}también: el depósito del que salió, los precios, los importes y las comisiones. Los cobros no cambian.
          </Text>
        )}
        {total > 0 && <Group className="suave" px="md" py="xs"><Resumen label="Total del pedido" valor={fmtMoney(total)} /></Group>}
        <Group gap="xs">
          <Button type="submit" loading={guardando}>Guardar cambios</Button>
          <Button variant="default" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
        </Group>
        <Mensaje msg={msg} />
      </Stack>
    </form>
  );
}
