import {
  ActionIcon, Alert, AppShell, Box, Button, Code, Container, Group, Paper, Stack, Text, ThemeIcon, Title, Tooltip,
} from '@mantine/core';
import { IconBrandGoogleFilled, IconExternalLink, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { BaseProvider } from './BaseProvider';
import { FichaProvider } from './componentes/Fichas';
import { BarraInferior, NavSuperior } from './componentes/Navegacion';
import { type BaseDeDatos, type InfoBase, SesionVencida, SinAcceso } from './db/puerto';
import type * as M from './dominio/modelo';
import { hora, mensajeDeError } from './formato';
import { Analisis } from './vistas/Analisis';
import { Caja } from './vistas/Caja';
import { Compras } from './vistas/Compras';
import { type FleteResaltado, Fletes } from './vistas/Fletes';
import { Inicio } from './vistas/Inicio';
import { type PedidoElegido, Pedidos } from './vistas/Pedidos';
import { Precios } from './vistas/Precios';
import { Recetas } from './vistas/Recetas';
import { Stock } from './vistas/Stock';
import { Ventas } from './vistas/Ventas';

type Pantalla = 'config' | 'login' | 'sin-acceso' | 'app';
const NAV = [
  { value: 'inicio', label: 'Inicio' }, { value: 'stock', label: 'Stock' }, { value: 'pedidos', label: 'Pedidos' }, { value: 'ventas', label: 'Ventas' },
  { value: 'compras', label: 'Compras' }, { value: 'recetas', label: 'Recetas' }, { value: 'fletes', label: 'Fletes' }, { value: 'precios', label: 'Precios' },
  { value: 'caja', label: 'Caja' },
  { value: 'analisis', label: 'Análisis' },
] as const;
type Vista = (typeof NAV)[number]['value'];
const VISTAS: readonly string[] = NAV.map((n) => n.value);
const ESTADO_INICIAL = { texto: 'Stock, pedidos, ventas y fletes', error: false };

const vistaDelHash = (): Vista => {
  const h = location.hash.slice(1);
  return VISTAS.includes(h) ? (h as Vista) : 'inicio';
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
  // Cada "Tomar pedido nuevo" de Inicio lo incrementa para que Pedidos enfoque el formulario.
  const [nuevoPedido, setNuevoPedido] = useState(0);
  // Lo que el mapa de Inicio pide ver en otra pantalla.
  const [pedidoElegido, setPedidoElegido] = useState<PedidoElegido | null>(null);
  const [fleteResaltado, setFleteResaltado] = useState<FleteResaltado | null>(null);
  const [depositoStock, setDepositoStock] = useState('');

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
  const abrirBase = useCallback(async () => {
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
  }, [db, cargar]);

  useEffect(() => {
    if (faltaConfig) return;
    db.iniciar(() => { setVencida(true); })
      .then(async (conSesion) => {
        setListo(true);
        if (!conSesion) return;
        // Sesión guardada (de antes de recargar o de otra pestaña): se abre la planilla sin pasar por "Ingresar con Google".
        setOcupado(true);
        try {
          await abrirBase();
        } catch (err) {
          // Si Google ya no acepta el token, se ingresa de nuevo como siempre.
          if (err instanceof SesionVencida) setVencida(false);
          else setMsg(mensajeDeError(err));
          setInfo(null);
          setDatos(null);
          setEstado(ESTADO_INICIAL);
        } finally {
          setOcupado(false);
        }
      })
      .catch((err: unknown) => { setMsg(mensajeDeError(err)); });
  }, [db, faltaConfig, abrirBase]);

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

  // Cada cambio de pantalla es una entrada del historial: "atrás" vuelve a la pantalla anterior en vez de salir de la app.
  function irA(v: Vista) {
    setVista(v);
    if (location.hash !== `#${v}`) history.pushState(null, '', `#${v}`);
  }
  useEffect(() => {
    const alVolver = () => { setVista(vistaDelHash()); };
    addEventListener('popstate', alVolver);
    return () => { removeEventListener('popstate', alVolver); };
  }, []);
  const verPedido = (id: string) => { irA('pedidos'); setPedidoElegido((p) => ({ id, vez: (p?.vez ?? 0) + 1 })); };
  const verFlete = (id: string) => { irA('fletes'); setFleteResaltado((f) => ({ id, vez: (f?.vez ?? 0) + 1 })); };

  const enApp = pantalla === 'app' && info !== null && datos !== null;

  return (
    <AppShell header={{ height: { base: 68, sm: enApp ? 116 : 68, xl: 68 } }} footer={enApp ? { height: { base: 64, sm: 0 } } : undefined}>
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" gap="xs" py={8} className="fila-header">
            <Group gap="sm" wrap="nowrap" miw={0}>
              <ThemeIcon size={42} radius="md" variant="light" aria-hidden>🌿</ThemeIcon>
              <Box miw={0}>
                <Title order={1} size="h3">ERPeq</Title>
                <Text size="xs" c={estado.error ? 'red' : 'dimmed'} lineClamp={1}>
                  {info && <Text span inherit c="dimmed" hiddenFrom="md">{info.titulo} · </Text>}
                  <span>{estado.texto}</span>
                </Text>
              </Box>
            </Group>
            {enApp && <NavSuperior opciones={NAV} value={vista} onChange={irA} />}
            {(pantalla === 'app' || pantalla === 'sin-acceso') && (
              <Group gap={6} wrap="nowrap">
                {info && (
                  <>
                    <Text size="xs" c="dimmed" maw={220} truncate visibleFrom="md">{info.titulo}</Text>
                    <Button component="a" href={info.url} target="_blank" rel="noopener" size="xs" variant="default"
                      rightSection={<IconExternalLink size={14} />} visibleFrom="sm">Planilla</Button>
                    <ActionIcon component="a" href={info.url} target="_blank" rel="noopener" variant="default"
                      size="lg" hiddenFrom="sm" aria-label="Planilla">
                      <IconExternalLink size={18} />
                    </ActionIcon>
                    <Tooltip label="Volver a leer la planilla">
                      <ActionIcon variant="default" size="lg" onClick={() => { void cargar().catch(() => undefined); }} loading={cargando} aria-label="Refrescar">
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

      {enApp && (
        <AppShell.Footer hiddenFrom="sm">
          <BarraInferior opciones={NAV} value={vista} onChange={irA} />
        </AppShell.Footer>
      )}

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
              <FichaProvider onEntregar={verPedido} onVerFlete={verFlete}>
                <Box display={vista === 'inicio' ? undefined : 'none'}>
                  <Inicio onIr={irA} onNuevoPedido={() => { irA('pedidos'); setNuevoPedido((n) => n + 1); }}
                    onPedido={verPedido} onFlete={verFlete}
                    onDeposito={(id) => { irA('stock'); setDepositoStock(id); }} />
                </Box>
                <Box display={vista === 'stock' ? undefined : 'none'}><Stock visible={vista === 'stock'} deposito={depositoStock} onDeposito={setDepositoStock} /></Box>
                <Box display={vista === 'pedidos' ? undefined : 'none'}><Pedidos nuevo={nuevoPedido} abrir={pedidoElegido} /></Box>
                <Box display={vista === 'ventas' ? undefined : 'none'}><Ventas visible={vista === 'ventas'} /></Box>
                <Box display={vista === 'compras' ? undefined : 'none'}><Compras /></Box>
                <Box display={vista === 'recetas' ? undefined : 'none'}><Recetas /></Box>
                <Box display={vista === 'fletes' ? undefined : 'none'}><Fletes resaltar={fleteResaltado} /></Box>
                <Box display={vista === 'precios' ? undefined : 'none'}><Precios /></Box>
                <Box display={vista === 'caja' ? undefined : 'none'}><Caja /></Box>
                <Box display={vista === 'analisis' ? undefined : 'none'}><Analisis visible={vista === 'analisis'} /></Box>
              </FichaProvider>
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
