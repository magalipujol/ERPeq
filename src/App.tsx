import {
  ActionIcon, Alert, AppShell, Box, Button, Code, Container, Group, Paper, ScrollArea, SegmentedControl, Stack, Text,
  ThemeIcon, Title, Tooltip,
} from '@mantine/core';
import { IconBrandGoogleFilled, IconExternalLink, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { BaseProvider } from './BaseProvider';
import { type BaseDeDatos, type InfoBase, SinAcceso } from './db/puerto';
import type * as M from './dominio/modelo';
import { hora, mensajeDeError } from './formato';
import { Compras } from './vistas/Compras';
import { Fletes } from './vistas/Fletes';
import { Pedidos } from './vistas/Pedidos';
import { Precios } from './vistas/Precios';
import { Stock } from './vistas/Stock';
import { Ventas } from './vistas/Ventas';

type Pantalla = 'config' | 'login' | 'sin-acceso' | 'app';
const NAV = [
  { value: 'stock', label: 'Stock' }, { value: 'pedidos', label: 'Pedidos' }, { value: 'ventas', label: 'Ventas' },
  { value: 'compras', label: 'Compras' }, { value: 'fletes', label: 'Fletes' }, { value: 'precios', label: 'Precios' },
] as const;
type Vista = (typeof NAV)[number]['value'];
const VISTAS: readonly string[] = NAV.map((n) => n.value);
const ESTADO_INICIAL = { texto: 'Stock, pedidos, ventas y fletes', error: false };

const vistaDelHash = (): Vista => {
  const h = location.hash.slice(1);
  return VISTAS.includes(h) ? (h as Vista) : 'stock';
};

export function App({ db }: { db: BaseDeDatos }) {
  const faltaConfig = !db.configurada;
  const [pantalla, setPantalla] = useState<Pantalla>(faltaConfig ? 'config' : 'login');
  const [vista, setVista] = useState<Vista>(vistaDelHash);
  const [listo, setListo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [vencida, setVencida] = useState(false);
  const [info, setInfo] = useState<InfoBase | null>(null);
  const [datos, setDatos] = useState<M.Datos | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (faltaConfig) return;
    db.iniciar(() => { setVencida(true); })
      .then(() => { setListo(true); })
      .catch((err: unknown) => { setMsg(mensajeDeError(err)); });
  }, [db, faltaConfig]);

  const cargar = useCallback(async () => {
    setEstado({ texto: 'Leyendo la planilla…', error: false });
    setCargando(true);
    try {
      setDatos(await db.leer());
      setEstado({ texto: `Sincronizado ${hora()}`, error: false });
    } catch (err) {
      setEstado({ texto: `No se pudo leer la planilla: ${mensajeDeError(err)}`, error: true });
      throw err;
    } finally {
      setCargando(false);
    }
  }, [db]);

  // Devuelve false si la planilla no está compartida con la cuenta que ingresó.
  async function abrirBase() {
    try {
      setInfo(await db.abrir());
    } catch (err) {
      if (err instanceof SinAcceso) {
        setPantalla('sin-acceso');
        return false;
      }
      throw err;
    }
    await cargar();
    setPantalla('app');
    return true;
  }

  async function conBoton(fn: () => Promise<void>) {
    setMsg('');
    setOcupado(true);
    try {
      await fn();
    } catch (err) {
      setMsg(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  }

  const ingresar = async () => conBoton(async () => {
    await db.ingresar();
    await abrirBase();
  });

  const reintentarAcceso = async () => conBoton(async () => {
    if (!(await abrirBase())) setMsg('Sigue sin acceso. Revisá que la planilla esté compartida con esta cuenta.');
  });

  async function reconectar() {
    try {
      await db.ingresar();
      setVencida(false);
      if (info) await cargar();
    } catch (err) {
      setEstado({ texto: mensajeDeError(err), error: true });
    }
  }

  async function salir() {
    await db.salir();
    setInfo(null);
    setDatos(null);
    setVencida(false);
    setMsg('');
    setEstado(ESTADO_INICIAL);
    setPantalla('login');
  }

  function irA(v: Vista) {
    setVista(v);
    history.replaceState(null, '', `#${v}`);
  }

  const enApp = pantalla === 'app' && info !== null && datos !== null;

  return (
    <AppShell header={{ height: { base: enApp ? 116 : 68, lg: 68 } }}>
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" gap="xs" py={8}>
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={42} radius="md" variant="light" aria-hidden>🌿</ThemeIcon>
              <div>
                <Title order={1} size="h3">ERPeq</Title>
                <Text size="xs" c={estado.error ? 'red' : 'dimmed'} lineClamp={1}>{estado.texto}</Text>
              </div>
            </Group>
            {enApp && (
              <ScrollArea type="never" maw="100%">
                <SegmentedControl value={vista} onChange={(v) => { irA(v); }} data={[...NAV]} aria-label="Pantalla" />
              </ScrollArea>
            )}
            {(pantalla === 'app' || pantalla === 'sin-acceso') && (
              <Group gap={6}>
                {info && (
                  <>
                    <Text size="xs" c="dimmed" maw={220} truncate>{info.titulo}</Text>
                    <Button component="a" href={info.url} target="_blank" rel="noopener" size="xs" variant="default"
                      rightSection={<IconExternalLink size={14} />}>Planilla</Button>
                    <Tooltip label="Volver a leer la planilla">
                      <ActionIcon variant="default" size="md" onClick={() => { void cargar().catch(() => undefined); }} loading={cargando} aria-label="Refrescar">
                        <IconRefresh size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </>
                )}
                <Button size="xs" variant="default" onClick={() => { void salir(); }}>Salir</Button>
              </Group>
            )}
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        {vencida && (
          <Alert color="yellow" radius={0} py="xs">
            <Container size="xl">
              <Group justify="space-between">
                <Text size="sm">La sesión de Google venció (dura una hora). Lo que estabas cargando no se perdió.</Text>
                <Button size="xs" onClick={() => { void reconectar(); }}>Reconectar</Button>
              </Group>
            </Container>
          </Alert>
        )}
        <Container size="xl" py="lg" pb={56}>
          {pantalla === 'config' && (
            <Puerta titulo="Falta configurar ERPeq">
              <Text>Esta copia todavía no tiene cargados los datos del proyecto de Google ni la planilla.
                Hay que completarlos en <Code>src/config.ts</Code>.</Text>
              <Text c="dimmed">Los pasos están en <Code>GUIA-CONFIGURACION.md</Code>, en la raíz del repositorio.</Text>
            </Puerta>
          )}

          {pantalla === 'login' && (
            <Puerta titulo="Ingresá con tu cuenta de Google">
              <Text>ERPeq trabaja sobre una planilla de Google Sheets que tiene que estar compartida con tu cuenta.
                Google te va a pedir permiso para ver y editar tus hojas de cálculo: la app solo usa la planilla de ERPeq.</Text>
              <Button leftSection={<IconBrandGoogleFilled size={18} />} onClick={() => { void ingresar(); }} disabled={!listo} loading={ocupado}>
                Ingresar con Google
              </Button>
              {msg !== '' && <Text c="red" role="alert">{msg}</Text>}
            </Puerta>
          )}

          {pantalla === 'sin-acceso' && (
            <Puerta titulo="Tu cuenta no tiene acceso a la planilla">
              <Text>Ingresaste bien, pero la planilla de ERPeq no está compartida con esta cuenta de Google.</Text>
              <Text c="dimmed">Pedile al dueño que te la comparta como <strong>Editor</strong> desde Google Drive y después tocá
                "Reintentar". Si entraste con otra cuenta por error, tocá "Usar otra cuenta".</Text>
              <Group gap="xs">
                <Button onClick={() => { void reintentarAcceso(); }} loading={ocupado}>Reintentar</Button>
                <Button variant="default" onClick={() => { void salir(); }}>Usar otra cuenta</Button>
              </Group>
              {msg !== '' && <Text c="red" role="alert">{msg}</Text>}
            </Puerta>
          )}

          {enApp && (
            <BaseProvider db={db} info={info} datos={datos} cargando={cargando} recargar={cargar}>
              <Box display={vista === 'stock' ? undefined : 'none'}><Stock visible={vista === 'stock'} /></Box>
              <Box display={vista === 'pedidos' ? undefined : 'none'}><Pedidos /></Box>
              <Box display={vista === 'ventas' ? undefined : 'none'}><Ventas visible={vista === 'ventas'} /></Box>
              <Box display={vista === 'compras' ? undefined : 'none'}><Compras /></Box>
              <Box display={vista === 'fletes' ? undefined : 'none'}><Fletes /></Box>
              <Box display={vista === 'precios' ? undefined : 'none'}><Precios /></Box>
            </BaseProvider>
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

function Puerta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Paper maw={560} mx="auto" mt={40} p="xl">
      <Stack gap="sm">
        <Title order={2} size="h3">{titulo}</Title>
        {children}
      </Stack>
    </Paper>
  );
}
