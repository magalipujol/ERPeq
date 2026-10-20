import { Autocomplete, Button, Group, NativeSelect, NumberInput, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useBase, useGuardar } from '../base';
import * as M from '../dominio/modelo';
import { aNumero, deISO, fmtMoney, hoyISO, unicos } from '../formato';
import { Mensaje } from './comunes';

// Formularios de alta y corrección de contactos y productos. Sin `contacto` (o `producto`) dan de alta uno nuevo y
// quedan vacíos para cargar el siguiente; con él, corrigen ese. `onListo` se llama después de guardar, con el texto
// del resultado y lo que se guardó.

const VACIO: Omit<M.Contacto, 'id'> = {
  rol: 'cliente', nombre: '', tipo: '', telefono: '', direccion: '', email: '', localidad: '', provincia: '', observaciones: '',
};

export function FormContacto({ contacto, inicial, onListo, onCancelar }: {
  contacto?: M.Contacto; inicial?: Partial<M.Contacto>;
  onListo?: (texto: string, c: M.Contacto) => void; onCancelar?: () => void;
}) {
  const { datos, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [c, setC] = useState<Omit<M.Contacto, 'id'>>(() => ({ ...VACIO, ...inicial, ...contacto }));
  const campo = <K extends keyof M.Contacto>(k: K) => (v: M.Contacto[K]) => { setC((x) => ({ ...x, [k]: v })); };
  const texto = (k: 'nombre' | 'telefono' | 'direccion' | 'email' | 'observaciones') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { campo(k)(e.currentTarget.value); };
  const enUso = contacto !== undefined && M.contactoEnUso(datos, contacto.id);
  const listas = useMemo(() => ({
    localidades: unicos([...datos.contactos.map((x) => x.localidad), ...datos.depositos.map((d) => d.localidad)]),
    provincias: unicos(datos.contactos.map((x) => x.provincia)),
  }), [datos]);
  // Un tipo que está en el contacto pero no en la hoja Tipos de cliente se sigue ofreciendo.
  const tipos = unicos([...datos.tipos, c.tipo]);

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const limpio = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.trim()])) as Omit<M.Contacto, 'id'>;
    const guardado: M.Contacto = {
      ...limpio, id: contacto?.id ?? M.siguienteId(datos.contactos.map((x) => x.id), 'C'),
      tipo: limpio.rol === 'cliente' ? limpio.tipo : '',
    };
    const problema = M.problemaContacto(datos.contactos, guardado);
    if (problema) { error(problema); return; }
    guardar(async () => {
      if (contacto) await db.corregirContacto(guardado);
      else await db.registrarContacto(guardado);
      const rol = M.NOMBRE_ROL[guardado.rol as M.Rol];
      const listo = contacto ? `✓ Datos de ${guardado.nombre} corregidos.` : `✓ ${rol} ${guardado.nombre} dado de alta.`;
      if (!contacto) setC({ ...VACIO, rol: guardado.rol });
      onListo?.(listo, guardado);
      return listo;
    });
  }

  return (
    <form onSubmit={enviar} noValidate aria-label={contacto ? `Corregir ${contacto.nombre}` : 'Nuevo contacto'}>
      <Stack gap="xs">
        <Group grow gap="xs" align="flex-start">
          <NativeSelect label="Es" data={M.ROLES.map((r) => ({ value: r, label: M.NOMBRE_ROL[r] }))} value={c.rol}
            onChange={(e) => { campo('rol')(e.currentTarget.value); }} disabled={enUso}
            description={enUso ? 'Tiene movimientos: no se cambia' : undefined} />
          {c.rol === 'cliente' && (
            <NativeSelect label="Tipo de cliente" data={[{ value: '', label: 'Sin tipo' }, ...tipos.map((t) => ({ value: t, label: t }))]}
              value={c.tipo} onChange={(e) => { campo('tipo')(e.currentTarget.value); }} />
          )}
        </Group>
        <TextInput label="Nombre" maxLength={120} value={c.nombre} onChange={texto('nombre')} />
        <Group grow gap="xs" align="flex-start">
          <Autocomplete label="Localidad" maxLength={80} data={listas.localidades} value={c.localidad} onChange={campo('localidad')} />
          <Autocomplete label="Provincia" maxLength={80} data={listas.provincias} value={c.provincia} onChange={campo('provincia')} />
        </Group>
        <Group grow gap="xs" align="flex-start">
          <TextInput label="Teléfono" type="tel" maxLength={40} value={c.telefono} onChange={texto('telefono')} />
          <TextInput label="Email" type="email" maxLength={120} value={c.email} onChange={texto('email')} />
        </Group>
        <TextInput label="Dirección" maxLength={200} value={c.direccion} onChange={texto('direccion')} />
        <Textarea label="Observaciones" maxLength={500} autosize minRows={1} value={c.observaciones} onChange={texto('observaciones')} />
        <Group gap="xs">
          <Button type="submit" loading={guardando}>{contacto ? 'Guardar cambios' : 'Dar de alta'}</Button>
          {onCancelar && <Button variant="default" onClick={onCancelar} disabled={guardando}>Cancelar</Button>}
        </Group>
        <Mensaje msg={msg} />
      </Stack>
    </form>
  );
}

export function FormProducto({ producto, onListo, onCancelar }: {
  producto?: M.Producto; onListo?: (texto: string, p: M.Producto) => void; onCancelar?: () => void;
}) {
  const { datos, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [nombre, setNombre] = useState(producto?.producto ?? '');
  const [unidad, setUnidad] = useState<string>(producto?.unidad ?? 'kg');
  const [minimo, setMinimo] = useState<number | string>(producto && producto.minimo !== null && producto.minimo > 0 ? producto.minimo : '');
  const [precio, setPrecio] = useState<number | string>('');
  // Una unidad que está en la planilla pero no en la lista se sigue ofreciendo.
  const unidades = unicos([...M.UNIDADES, unidad]);

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const min = minimo === '' ? null : aNumero(minimo);
    const pre = precio === '' ? null : aNumero(precio);
    const guardado: M.Producto = {
      id: producto?.id ?? M.siguienteId(datos.productos.map((p) => p.id), 'P', 3), producto: nombre.trim(), unidad, minimo: min,
    };
    const problema = M.problemaProducto(datos.productos, guardado)
      ?? (pre !== null && !(pre > 0) ? 'El precio tiene que ser mayor a 0, o dejalo vacío.' : null);
    if (problema) { error(problema); return; }
    guardar(async () => {
      if (producto) await db.corregirProducto(guardado);
      else await db.registrarProducto(guardado, pre === null ? null : { productoId: guardado.id, precio: pre, desde: deISO(hoyISO()) });
      const listo = producto ? `✓ ${guardado.producto} corregido.`
        : `✓ ${guardado.producto} dado de alta${pre === null ? ', sin precio de lista' : ` a ${fmtMoney(pre)}`}.`;
      if (!producto) { setNombre(''); setMinimo(''); setPrecio(''); }
      onListo?.(listo, guardado);
      return listo;
    });
  }

  return (
    <form onSubmit={enviar} noValidate aria-label={producto ? `Corregir ${producto.producto}` : 'Nuevo producto'}>
      <Stack gap="xs">
        <TextInput label="Nombre" maxLength={120} value={nombre} onChange={(e) => { setNombre(e.currentTarget.value); }} />
        <Group grow gap="xs" align="flex-start">
          <NativeSelect label="Unidad" data={unidades} value={unidad} onChange={(e) => { setUnidad(e.currentTarget.value); }} />
          <NumberInput label="Stock mínimo" allowNegative={false} placeholder="Sin mínimo" value={minimo} onChange={setMinimo} />
        </Group>
        {producto && unidad !== producto.unidad && (
          <Text size="xs" c="yellow.8">Las cantidades ya cargadas no se convierten: quedan en {unidad}.</Text>
        )}
        {!producto && (
          <NumberInput label="Precio de lista" allowNegative={false} placeholder="Opcional" value={precio} onChange={setPrecio}
            leftSection={<Text size="xs" c="dimmed">$</Text>} leftSectionPointerEvents="none"
            description="Rige desde hoy. Después se cambia en Precios." />
        )}
        <Group gap="xs">
          <Button type="submit" loading={guardando}>{producto ? 'Guardar cambios' : 'Dar de alta'}</Button>
          {onCancelar && <Button variant="default" onClick={onCancelar} disabled={guardando}>Cancelar</Button>}
        </Group>
        <Mensaje msg={msg} />
      </Stack>
    </form>
  );
}
