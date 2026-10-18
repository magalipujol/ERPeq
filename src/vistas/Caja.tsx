import { Alert, Button, Code, Grid, Group, NativeSelect, NumberInput, Paper, ScrollArea, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { type Etiquetas, useBase, useGuardar } from '../base';
import { faltantesDe } from '../db/puerto';
import { CamposCobro, type DatosCobro } from '../componentes/Cobro';
import { Encabezado, Kpis, Mensaje, Resumen } from '../componentes/comunes';
import { Vinculo } from '../componentes/Fichas';
import { useFila } from '../ficha';
import { aNumero, deISO, fmtFecha, fmtMoney, hoyISO, porFechaDesc } from '../formato';
import * as M from '../dominio/modelo';

// Quién le debe a quién, en palabras.
const textoSaldo = (cuenta: M.CuentaSocio, duenio: string) =>
  cuenta.saldo > 0 ? `${cuenta.socio.nombre} le debe ${fmtMoney(cuenta.saldo)} a ${duenio}.`
    : cuenta.saldo < 0 ? `${duenio} le debe ${fmtMoney(-cuenta.saldo)} a ${cuenta.socio.nombre}.`
      : `${cuenta.socio.nombre} y ${duenio} están al día.`;

// Cobros de las ventas y cuentas entre socios: quién tiene la plata de cada venta y cuánto le debe al dueño.
export function Caja() {
  const { datos, info } = useBase();
  const faltan = faltantesDe(info, 'caja');
  const aCobrar = useMemo(() => M.ventasACobrar(datos), [datos]);
  const cuentas = useMemo(() => M.cuentasSocios(datos), [datos]);
  const duenio = M.duenio(datos.socios);
  const [ventaSel, setVentaSel] = useState<string | null>(null);

  return (
    <Stack gap="md">
      <Title order={2}>Caja</Title>
      {faltan.length > 0 && (
        <Alert color="yellow" title="Faltan hojas en la planilla">
          <Text size="sm" mb="xs">Para registrar cobros y rendiciones, creá estas hojas con estos encabezados en la fila 1:</Text>
          {faltan.map((f) => <Text key={f.nombre} size="sm"><strong>{f.nombre}</strong>: <Code>{f.encabezados.join(', ')}</Code></Text>)}
        </Alert>
      )}
      {faltan.length === 0 && !duenio && (
        <Alert color="yellow" title="Falta el dueño">
          <Text size="sm">En la hoja <strong>Socios</strong>, marcá con <Code>dueño</Code> en la columna <Code>rol</Code> al socio dueño de la mercadería.</Text>
        </Alert>
      )}
      <Kpis label="Resumen de caja" items={[
        { label: 'A cobrar de clientes', valor: fmtMoney(aCobrar.reduce((s, c) => s + c.saldo, 0)) },
        { label: 'Ventas sin cobrar del todo', valor: aCobrar.length },
        ...cuentas.map((c) => ({
          label: `Saldo ${c.socio.nombre}`,
          valor: c.saldo > 0 ? `Debe ${fmtMoney(c.saldo)}` : c.saldo < 0 ? `Le deben ${fmtMoney(-c.saldo)}` : 'Al día',
        })),
      ]} />

      <Grid gap="md" align="flex-start">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <FormCobro key={ventaSel ?? ''} aCobrar={aCobrar} ventaId={ventaSel} onVenta={setVentaSel} deshabilitado={faltan.length > 0} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          {duenio && <FormRendicion cuentas={cuentas} duenio={duenio} deshabilitado={faltan.length > 0} />}
        </Grid.Col>
      </Grid>

      <ListaACobrar aCobrar={aCobrar} onCobrar={setVentaSel} />
      {duenio && cuentas.map((c) => <CuentaSocio key={c.socio.id} cuenta={c} duenio={duenio} />)}
    </Stack>
  );
}

function FormCobro({ aCobrar, ventaId, onVenta, deshabilitado }: {
  aCobrar: M.CuentaVenta[]; ventaId: string | null; onVenta: (id: string) => void; deshabilitado: boolean;
}) {
  const { datos, etiquetas, db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [fecha, setFecha] = useState(hoyISO);
  const [nota, setNota] = useState('');
  // Cambios del usuario sobre lo que propone la venta elegida (al cambiar de venta, el formulario se vuelve a montar).
  const [editado, setEditado] = useState<Partial<DatosCobro>>({});
  const ordenadas = aCobrar.toSorted((a, b) => porFechaDesc(a.venta, b.venta));
  const cuenta = ordenadas.find((c) => c.venta.id === ventaId) ?? ordenadas.at(0);
  const vendedores = datos.pedidosVendedores.filter((v) => v.pedidoId === cuenta?.venta.pedidoId).map((v) => v.vendedorId);
  const propuesto: DatosCobro = {
    importe: cuenta?.saldo ?? '', medio: 'efectivo', socioId: M.socioPropuesto(datos.socios, vendedores)?.id ?? '',
  };
  const valor = { ...propuesto, ...editado };
  const importe = aNumero(valor.importe);

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const dia = fecha ? deISO(fecha) : null;
    const socio = datos.socios.find((s) => s.id === valor.socioId);
    const falta = !cuenta ? 'No hay ventas para cobrar.'
      : !dia ? 'Elegí la fecha.'
      : !(importe > 0) ? 'El importe tiene que ser mayor a 0.'
      : importe > cuenta.saldo ? `No se puede cobrar más que el saldo (${fmtMoney(cuenta.saldo)}).`
      : !socio ? 'Elegí quién recibió la plata.'
      : null;
    if (falta || !cuenta || !dia || !socio) { error(falta ?? 'Faltan datos.'); return; }
    guardar(async () => {
      await db.registrarCobro({
        fecha: dia, ventaId: cuenta.venta.id, importe, medio: valor.medio, socioId: socio.id, nota: nota.trim(),
      });
      setEditado({});
      setNota('');
      return `✓ Cobro de ${fmtMoney(importe)} de la venta a ${etiquetas.venta(cuenta.venta.id)} registrado (${M.NOMBRE_MEDIO[valor.medio].toLowerCase()}, ${socio.nombre}).`;
    });
  }

  return (
    <Paper>
      <Encabezado titulo="Registrar cobro" />
      <form onSubmit={enviar} noValidate aria-label="Registrar cobro">
        <Stack gap="sm">
          <Group grow gap="xs" align="flex-start">
            <NativeSelect label="Venta" value={cuenta?.venta.id ?? ''} onChange={(e) => { onVenta(e.currentTarget.value); }}
              data={ordenadas.map((c) => ({ value: c.venta.id, label: `${etiquetas.venta(c.venta.id)} · falta ${fmtMoney(c.saldo)}` }))} />
            <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.currentTarget.value); }} />
          </Group>
          <CamposCobro valor={valor} onChange={(v) => { setEditado(v); }} socios={datos.socios} etiqueta="Importe" />
          <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
          <Button type="submit" loading={guardando} disabled={deshabilitado || !cuenta}>Registrar cobro</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
    </Paper>
  );
}

type Sentido = 'al-duenio' | 'del-duenio';

function FormRendicion({ cuentas, duenio, deshabilitado }: { cuentas: M.CuentaSocio[]; duenio: M.Socio; deshabilitado: boolean }) {
  const { db } = useBase();
  const { guardando, msg, guardar, error } = useGuardar();
  const [fecha, setFecha] = useState(hoyISO);
  const [socioSel, setSocioSel] = useState<string | null>(null);
  const [sentidoSel, setSentidoSel] = useState<Sentido | null>(null);
  const [importeTxt, setImporteTxt] = useState<number | string | null>(null);
  const [medio, setMedio] = useState<M.Medio>('efectivo');
  const [nota, setNota] = useState('');
  const cuenta = cuentas.find((c) => c.socio.id === socioSel) ?? cuentas.at(0);
  // Propone saldar la cuenta: si el socio debe, entrega; si no, recibe.
  const sentido = sentidoSel ?? ((cuenta?.saldo ?? 0) < 0 ? 'del-duenio' : 'al-duenio');
  const importe = aNumero(importeTxt ?? Math.abs(cuenta?.saldo ?? 0));

  function enviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const dia = fecha ? deISO(fecha) : null;
    const falta = !cuenta ? 'No hay socios además del dueño.'
      : !dia ? 'Elegí la fecha.'
      : !(importe > 0) ? 'El importe tiene que ser mayor a 0.'
      : null;
    if (falta || !cuenta || !dia) { error(falta ?? 'Faltan datos.'); return; }
    const [de, a] = sentido === 'al-duenio' ? [cuenta.socio, duenio] : [duenio, cuenta.socio];
    guardar(async () => {
      await db.registrarRendicion({ fecha: dia, deId: de.id, aId: a.id, importe, medio, nota: nota.trim() });
      setImporteTxt(null);
      setSentidoSel(null);
      setNota('');
      return `✓ ${de.nombre} le entregó ${fmtMoney(importe)} a ${a.nombre}.`;
    });
  }

  return (
    <Paper>
      <Encabezado titulo="Rendición entre socios" />
      <form onSubmit={enviar} noValidate aria-label="Rendición entre socios">
        <Stack gap="sm">
          <Group grow gap="xs" align="flex-start">
            <NativeSelect label="Socio" value={cuenta?.socio.id ?? ''} data={cuentas.map((c) => ({ value: c.socio.id, label: c.socio.nombre }))}
              onChange={(e) => { setSocioSel(e.currentTarget.value); setImporteTxt(null); setSentidoSel(null); }} />
            <NativeSelect label="Sentido" value={sentido} onChange={(e) => { setSentidoSel(e.currentTarget.value as Sentido); }} data={[
              { value: 'al-duenio', label: `Le entrega a ${duenio.nombre}` }, { value: 'del-duenio', label: `${duenio.nombre} le paga` },
            ]} />
          </Group>
          {cuenta && <Text size="sm" c="dimmed">{textoSaldo(cuenta, duenio.nombre)}</Text>}
          <Group grow gap="xs" align="flex-start">
            <NumberInput label="Importe" allowNegative={false} value={importeTxt ?? Math.abs(cuenta?.saldo ?? 0)} onChange={setImporteTxt} />
            <NativeSelect label="Medio" data={M.MEDIOS.map((m) => ({ value: m, label: M.NOMBRE_MEDIO[m] }))} value={medio}
              onChange={(e) => { setMedio(e.currentTarget.value as M.Medio); }} />
            <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.currentTarget.value); }} />
          </Group>
          <TextInput label="Nota" maxLength={200} placeholder="Opcional" value={nota} onChange={(e) => { setNota(e.currentTarget.value); }} />
          <Button type="submit" loading={guardando} disabled={deshabilitado || !cuenta}>Registrar rendición</Button>
          <Mensaje msg={msg} />
        </Stack>
      </form>
    </Paper>
  );
}

function ListaACobrar({ aCobrar, onCobrar }: { aCobrar: M.CuentaVenta[]; onCobrar: (id: string) => void }) {
  const { cargando, nombres, etiquetas } = useBase();
  const fila = useFila();
  const filas = aCobrar.toSorted((a, b) => porFechaDesc(a.venta, b.venta));
  return (
    <Paper>
      <Encabezado titulo="Ventas a cobrar" />
      <ScrollArea.Autosize mah={420} type="auto">
        <Table stickyHeader highlightOnHover fz="sm" aria-label="Ventas a cobrar" style={{ opacity: cargando ? 0.5 : 1, whiteSpace: 'nowrap' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th><Table.Th>Cliente</Table.Th><Table.Th className="num">Importe</Table.Th>
              <Table.Th className="num">Cobrado</Table.Th><Table.Th className="num">Falta</Table.Th><Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((c) => (
              <Table.Tr key={c.venta.id} aria-label={`Venta a ${etiquetas.venta(c.venta.id)}`} {...fila({ tipo: 'venta', id: c.venta.id })}>
                <Table.Td c="dimmed">{fmtFecha(c.venta.fecha)}</Table.Td>
                <Table.Td fw={500}>
                  {c.pedido && <Vinculo a={{ tipo: 'venta', id: c.venta.id }}>{nombres.contacto(c.pedido.contactoId)}</Vinculo>}
                </Table.Td>
                <Table.Td className="num">{fmtMoney(c.importe)}</Table.Td>
                <Table.Td className="num" c="dimmed">{c.cobrado > 0 ? fmtMoney(c.cobrado) : '–'}</Table.Td>
                <Table.Td className="num" fw={600}>{fmtMoney(c.saldo)}</Table.Td>
                <Table.Td>
                  <Button size="compact-xs" variant="light" aria-label={`Cobrar venta a ${etiquetas.venta(c.venta.id)}`} onClick={() => { onCobrar(c.venta.id); }}>Cobrar</Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {filas.length === 0 && <Text c="dimmed" mt="xs">No hay ventas por cobrar.</Text>}
    </Paper>
  );
}

// En cobros, comisiones y envíos, `ref` es la venta.
const CONCEPTO: Record<M.TipoMovimiento, (m: M.MovimientoSocio, e: Etiquetas) => string> = {
  cobro: (m, e) => `Cobro de la venta a ${e.venta(m.ref)}`,
  comision: (m, e) => `Comisión de la venta a ${e.venta(m.ref)}`,
  envio: (m, e) => `Envío de la venta a ${e.venta(m.ref)}`,
  entrego: (m) => `Entregó a ${m.ref}${m.detalle ? ` · ${m.detalle}` : ''}`,
  recibio: (m) => `Recibió de ${m.ref}${m.detalle ? ` · ${m.detalle}` : ''}`,
};

function CuentaSocio({ cuenta, duenio }: { cuenta: M.CuentaSocio; duenio: M.Socio }) {
  const { etiquetas } = useBase();
  const nombre = cuenta.socio.nombre;
  const filas = cuenta.movimientos;
  const medio = (m: string) => (M.MEDIOS as readonly string[]).includes(m) ? M.NOMBRE_MEDIO[m as M.Medio] : m;

  return (
    <Paper role="region" aria-label={`Cuenta de ${nombre}`}>
      <Encabezado titulo={`Cuenta de ${nombre} con ${duenio.nombre}`} />
      <Text fw={600} mb="xs" c={cuenta.saldo > 0 ? 'red' : undefined}>{textoSaldo(cuenta, duenio.nombre)}</Text>
      <Group className="suave" px="md" py="xs" gap="xl" mb="sm">
        <Resumen label="Cobró en efectivo" valor={fmtMoney(cuenta.cobradoEfectivo)} />
        <Resumen label="Cobró por transferencia" valor={fmtMoney(cuenta.cobradoTransferencia)} />
        <Resumen label="Comisiones" valor={fmtMoney(cuenta.comisiones)} />
        {cuenta.envios > 0 && <Resumen label="Envíos" valor={fmtMoney(cuenta.envios)} />}
        <Resumen label={`Entregó a ${duenio.nombre}`} valor={fmtMoney(cuenta.entregado)} />
        <Resumen label={`Recibió de ${duenio.nombre}`} valor={fmtMoney(cuenta.recibido)} />
      </Group>
      <ScrollArea.Autosize mah={420} type="auto">
        <Table fz="sm" aria-label={`Movimientos de ${nombre}`} style={{ whiteSpace: 'nowrap' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th><Table.Th>Concepto</Table.Th><Table.Th>Medio</Table.Th>
              <Table.Th className="num">Importe</Table.Th><Table.Th className="num">Saldo</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((m, i) => (
              // Los movimientos no tienen ID y no se reordenan: el índice alcanza como clave.
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <Table.Tr key={i}>
                <Table.Td c="dimmed">{fmtFecha(m.fecha)}</Table.Td>
                <Table.Td>{CONCEPTO[m.tipo](m, etiquetas)}</Table.Td>
                <Table.Td c="dimmed">{medio(m.medio)}</Table.Td>
                <Table.Td className="num" c={m.importe < 0 ? 'red' : undefined}>{fmtMoney(m.importe)}</Table.Td>
                <Table.Td className="num" fw={500}>{fmtMoney(m.saldo)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {filas.length === 0 && <Text c="dimmed" mt="xs" size="sm">Sin movimientos.</Text>}
    </Paper>
  );
}
