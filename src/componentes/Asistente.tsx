// Asistente que responde preguntas sobre los datos con un modelo de lenguaje que corre en el dispositivo (LiteRT-LM
// sobre WebGPU). Solo consulta: sus herramientas son las de src/dominio/asistente.ts. Ver spec/asistente.md.
import { AutoToolChat, Engine, type Message } from '@litert-lm/core';
import { Alert, Button, Drawer, Group, Loader, Paper, Progress, Stack, Text, Textarea } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useEffect, useRef, useState } from 'react';
import { useBase } from '../base';
import { HERRAMIENTAS } from '../dominio/asistente';
import { mensajeDeError } from '../formato';

// Gemma 4 E2B para WebGPU (~2 GB), fijado a un commit: cambiar la URL vuelve a descargar el modelo.
const MODELO = 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/3d48132a00cf76de57d926de30f5c5c5ed9b8c0d/gemma-4-E2B-it-gpu.litertlm';
const CACHE = 'erpeq-modelo';

// El modelo se guarda en Cache Storage para no bajarlo en cada visita; queda solo la versión de MODELO.
async function modelo(progreso: (fraccion: number) => void): Promise<Blob> {
  const cache = await caches.open(CACHE);
  for (const r of await cache.keys()) if (r.url !== MODELO) await cache.delete(r);
  const guardado = await cache.match(MODELO);
  if (guardado) return guardado.blob();
  const r = await fetch(MODELO);
  if (!r.ok || !r.body) throw new Error(`No se pudo descargar el modelo (HTTP ${r.status}).`);
  const total = Number(r.headers.get('content-length'));
  let bajado = 0;
  const contando = r.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(parte, salida) {
      bajado += parte.byteLength;
      if (total > 0) progreso(bajado / total);
      salida.enqueue(parte);
    },
  }));
  await cache.put(MODELO, new Response(contando, { headers: r.headers }));
  await navigator.storage.persist().catch(() => false);
  const listo = await cache.match(MODELO);
  if (!listo) throw new Error('No se pudo guardar el modelo en el dispositivo.');
  return listo.blob();
}

// Un solo motor por pestaña: cerrar y abrir el asistente no vuelve a cargar el modelo en la GPU.
let motor: Promise<Engine> | null = null;
async function cargarMotor(progreso: (fraccion: number) => void) {
  motor ??= modelo(progreso).then(async (model) => Engine.create({ model, mainExecutorSettings: { maxNumTokens: 4096 } }));
  motor.catch(() => { motor = null; });
  return motor;
}

const textoDe = (m: Message) =>
  typeof m.content === 'string' ? m.content : (m.content ?? []).map((p) => (p.type === 'text' ? p.text : '')).join('');

const PREFACIO = () => `Sos el asistente de ERPeq, el sistema de una dietética que vende por mayor.
Respondé en español rioplatense, corto y claro. Hoy es ${new Date().toLocaleDateString('es-AR', { dateStyle: 'full' })}.
Para cualquier dato (stock, pedidos, ventas, cobros, precios, clientes) usá las herramientas: nunca inventes números.
Los importes están en pesos. Solo podés consultar: si te piden cargar, corregir o borrar algo, explicá que se hace desde la pantalla de la app.`;

interface Mensaje { id: number; rol: 'usuario' | 'asistente'; texto: string }
type Estado = { fase: 'sin-webgpu' | 'inicio' | 'listo' } | { fase: 'cargando'; progreso: number } | { fase: 'error'; texto: string };

export function Asistente({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { datos } = useBase();
  const celular = useMediaQuery('(max-width: 48em)');
  const [estado, setEstado] = useState<Estado>('gpu' in navigator ? { fase: 'inicio' } : { fase: 'sin-webgpu' });
  const [guardado, setGuardado] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [consultando, setConsultando] = useState('');
  const chatRef = useRef<AutoToolChat | null>(null);
  // Las herramientas leen los datos del momento de la pregunta, aunque la planilla se haya releído después.
  const datosRef = useRef(datos);
  useEffect(() => { datosRef.current = datos; }, [datos]);

  useEffect(() => {
    void caches.match(MODELO).then((r) => { setGuardado(r !== undefined); }).catch(() => undefined);
    // `navigator.gpu` puede existir sin un adaptador (GPU en la lista de bloqueo, WebGPU apagado en Linux): se
    // pregunta antes de ofrecer la descarga de 2 GB.
    if (!('gpu' in navigator)) return;
    void navigator.gpu.requestAdapter().then((a) => { if (!a) setEstado({ fase: 'sin-webgpu' }); })
      .catch(() => { setEstado({ fase: 'sin-webgpu' }); });
  }, []);

  async function nuevaConversacion(engine: Engine) {
    await chatRef.current?.delete();
    chatRef.current = new AutoToolChat({
      engine,
      config: { preface: { messages: [{ role: 'system', content: PREFACIO() }] } },
      tools: HERRAMIENTAS.map(({ ejecutar, ...h }) => ({
        ...h, execute: (args) => ejecutar(datosRef.current, args, new Date()),
      })),
      onToolProgress: (e) => { setConsultando(e.status === 'started' ? e.name.replaceAll('_', ' ') : ''); },
    });
    setMensajes([]);
  }

  async function activar() {
    setEstado({ fase: 'cargando', progreso: 0 });
    try {
      const engine = await cargarMotor((progreso) => { setEstado({ fase: 'cargando', progreso }); });
      await nuevaConversacion(engine);
      setGuardado(true);
      setEstado({ fase: 'listo' });
    } catch (err) {
      setEstado({ fase: 'error', texto: mensajeDeError(err) });
    }
  }

  async function enviar() {
    const texto = pregunta.trim();
    if (texto === '' || !chatRef.current || ocupado) return;
    setPregunta('');
    setOcupado(true);
    setMensajes((m) => [...m, { id: m.length, rol: 'usuario', texto }, { id: m.length + 1, rol: 'asistente', texto: '' }]);
    const agregar = (parte: string) => {
      setMensajes((m) => [...m.slice(0, -1), { id: m.length - 1, rol: 'asistente', texto: (m.at(-1)?.texto ?? '') + parte }]);
    };
    try {
      const lector = chatRef.current.sendMessageStreaming(texto).getReader();
      for (let r = await lector.read(); !r.done; r = await lector.read()) agregar(textoDe(r.value));
    } catch (err) {
      agregar(`\n(No pude responder: ${mensajeDeError(err)})`);
    } finally {
      setConsultando('');
      setOcupado(false);
    }
  }

  return (
    <Drawer opened={abierto} onClose={onCerrar} position="right" size={celular ? '100%' : 'md'} keepMounted title="Asistente">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Responde preguntas sobre stock, pedidos, ventas, cobros y precios. Corre en este dispositivo: los datos no salen
          de acá. Solo consulta; para cargar o corregir algo, usá las pantallas.
        </Text>

        {estado.fase === 'sin-webgpu' && (
          <Alert color="yellow">
            Este navegador no tiene WebGPU disponible, que el asistente necesita. Probá con Chrome actualizado; en Linux
            hay que activarlo en <code>chrome://flags</code> (<em>Unsafe WebGPU Support</em> y <em>Vulkan</em>).
            En <code>chrome://gpu</code> se ve si WebGPU está habilitado.
          </Alert>
        )}
        {(estado.fase === 'inicio' || estado.fase === 'error') && (
          <>
            {estado.fase === 'error' && <Alert color="red">No se pudo cargar el asistente: {estado.texto}</Alert>}
            {!guardado && <Text size="sm">La primera vez descarga un modelo de unos 2 GB (mejor con wifi). Después queda guardado.</Text>}
            <Button onClick={() => { void activar(); }}>{guardado ? 'Activar' : 'Descargar y activar'}</Button>
          </>
        )}
        {estado.fase === 'cargando' && (
          <Stack gap={4}>
            <Text size="sm">{estado.progreso < 1 && !guardado ? `Descargando el modelo… ${Math.round(estado.progreso * 100)} %` : 'Cargando el modelo…'}</Text>
            <Progress value={estado.progreso * 100} animated={estado.progreso >= 1 || guardado} aria-label="Carga del modelo" />
          </Stack>
        )}

        {estado.fase === 'listo' && (
          <>
            {mensajes.map((m) => (
              <Paper key={m.id} p="sm" bg={m.rol === 'usuario' ? 'var(--mantine-color-default-hover)' : undefined}
                ml={m.rol === 'usuario' ? 'xl' : 0} withBorder={m.rol === 'asistente'}>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{m.texto === '' ? '…' : m.texto}</Text>
              </Paper>
            ))}
            {consultando !== '' && <Group gap="xs"><Loader size="xs" /><Text size="sm" c="dimmed">Consultando {consultando}…</Text></Group>}
            <Textarea placeholder="¿Cuánta almendra queda? ¿Quién me debe plata?" value={pregunta} autosize minRows={2}
              onChange={(e) => { setPregunta(e.currentTarget.value); }} aria-label="Pregunta"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }} />
            <Group justify="space-between">
              <Button variant="default" size="xs" disabled={ocupado}
                onClick={() => { void cargarMotor(() => undefined).then(nuevaConversacion); }}>Nueva conversación</Button>
              <Button onClick={() => { void enviar(); }} loading={ocupado} disabled={pregunta.trim() === ''}>Preguntar</Button>
            </Group>
          </>
        )}
      </Stack>
    </Drawer>
  );
}
