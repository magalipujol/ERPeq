import { Badge, Button, Group, List, Paper, Progress, Text, Textarea } from '@mantine/core';
import { useEffect, useState } from 'react';
import { mensajeDeError } from '../formato';
import {
  type Coincidencia, emparejarPedido, ESQUEMA, instrucciones, leerRespuesta, type PedidoEmparejado,
} from '../pedido-texto';

// Lo que se usa de la Prompt API de Chrome (Gemini Nano en el dispositivo). TypeScript no la trae.
type Disponibilidad = 'unavailable' | 'downloadable' | 'downloading' | 'available';
interface OpcionesIdioma {
  expectedInputs: { type: 'text'; languages: string[] }[];
  expectedOutputs: { type: 'text'; languages: string[] }[];
}
interface SesionIA {
  prompt: (texto: string, opciones: { responseConstraint: object }) => Promise<string>;
  destroy: () => void;
}
interface ApiIA {
  availability: (opciones: OpcionesIdioma) => Promise<Disponibilidad>;
  create: (opciones: OpcionesIdioma & {
    initialPrompts: { role: 'system'; content: string }[];
    monitor: (m: EventTarget) => void;
  }) => Promise<SesionIA>;
}

const api = (): ApiIA | undefined => (globalThis as { LanguageModel?: ApiIA }).LanguageModel;
const IDIOMA: OpcionesIdioma = {
  expectedInputs: [{ type: 'text', languages: ['es'] }],
  expectedOutputs: [{ type: 'text', languages: ['es'] }],
};

export interface ContextoPedido { productos: string[]; clientes: string[]; localidades: string[] }

// Experimental: convierte un mensaje pegado en un pedido con la IA integrada de Chrome. Solo precarga el
// formulario; la persona revisa y registra. Si el navegador no tiene la API, no se muestra.
export function PegarPedido({ contexto, onPrecargar }: { contexto: ContextoPedido; onPrecargar: (p: PedidoEmparejado) => void }) {
  const [disponible, setDisponible] = useState<Disponibilidad>('unavailable');
  const [texto, setTexto] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [descarga, setDescarga] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [leido, setLeido] = useState<PedidoEmparejado | null>(null);

  useEffect(() => {
    const ia = api();
    if (!ia) return;
    let vigente = true;
    ia.availability(IDIOMA).then((d) => { if (vigente) setDisponible(d); }, () => undefined);
    return () => { vigente = false; };
  }, []);

  if (disponible === 'unavailable') return null;

  async function interpretar() {
    const ia = api();
    if (!ia || !texto.trim()) return;
    setLeyendo(true);
    setError('');
    setLeido(null);
    let sesion: SesionIA | undefined;
    try {
      // La primera vez create() descarga el modelo; necesita que la persona haya hecho clic (este botón).
      sesion = await ia.create({
        ...IDIOMA,
        initialPrompts: [{ role: 'system', content: instrucciones(contexto) }],
        monitor: (m) => {
          m.addEventListener('downloadprogress', (e) => { setDescarga((e as ProgressEvent).loaded); });
        },
      });
      setDescarga(null);
      setDisponible('available');
      const pedido = leerRespuesta(await sesion.prompt(texto, { responseConstraint: ESQUEMA }));
      if (!pedido) { setError('La IA no devolvió un pedido. Probá de nuevo o cargalo a mano.'); return; }
      const emparejado = emparejarPedido(pedido, contexto);
      setLeido(emparejado);
      onPrecargar(emparejado);
    } catch (e) {
      setError(`No se pudo interpretar: ${mensajeDeError(e)}`);
    } finally {
      sesion?.destroy();
      setDescarga(null);
      setLeyendo(false);
    }
  }

  return (
    <Paper withBorder p="sm" radius="md" mb="sm" role="region" aria-label="Pegar pedido">
      <Group gap="xs" mb={6}>
        <Text fw={500} size="sm">Pegar pedido</Text>
        <Badge size="xs" variant="light" color="grape">Experimental</Badge>
      </Group>
      <Textarea
        aria-label="Mensaje del pedido" autosize minRows={2} maxRows={6} maxLength={2000}
        placeholder="Pegá el mensaje del cliente (por ejemplo, de WhatsApp)"
        value={texto} onChange={(e) => { setTexto(e.currentTarget.value); }}
      />
      <Group gap="xs" mt={6}>
        <Button size="xs" variant="light" onClick={() => { void interpretar(); }} loading={leyendo} disabled={!texto.trim()}>
          Completar el pedido
        </Button>
        <Text size="xs" c="dimmed">
          {disponible === 'available'
            ? 'La IA corre en esta computadora: el mensaje no sale del navegador.'
            : 'La primera vez Chrome descarga el modelo de IA (varios GB). Después corre sin conexión.'}
        </Text>
      </Group>
      {descarga !== null && <Progress mt={6} size="sm" value={descarga * 100} aria-label="Descarga del modelo" />}
      {error && <Text size="sm" c="red" mt={6} role="alert">{error}</Text>}
      {leido && <Revision pedido={leido} />}
    </Paper>
  );
}

// Lo que no coincidió exacto con los datos reales, para que la persona lo revise.
function Revision({ pedido }: { pedido: PedidoEmparejado }) {
  const avisos = [
    aviso('Cliente', pedido.cliente, 'cliente nuevo'),
    aviso('Localidad', pedido.localidad, 'localidad nueva'),
    ...pedido.items.map((it) => aviso('Producto', it.producto, 'no existe: elegí uno de la lista')),
    ...pedido.items.filter((it) => it.cantidad === null).map((it) => `Cantidad de «${it.producto.texto}»: no la dice el mensaje.`),
    ...(pedido.items.length === 0 ? ['No se encontraron productos en el mensaje.'] : []),
  ].filter((a) => a !== null);
  return (
    <div role="status" aria-label="Revisión del pedido pegado">
      <Text size="sm" mt={6} c={avisos.length > 0 ? 'yellow.8' : 'green'} fw={500}>
        {avisos.length > 0 ? 'Formulario completado. Revisá:' : 'Formulario completado. Revisalo y registralo.'}
      </Text>
      {avisos.length > 0 && <List size="xs" spacing={2}>{avisos.map((a) => <List.Item key={a}>{a}</List.Item>)}</List>}
    </div>
  );
}

function aviso(campo: string, c: Coincidencia, siNoHay: string): string | null {
  if (!c.texto || c.tipo === 'exacta') return null;
  if (c.tipo === 'aproximada') return `${campo}: «${c.texto}» se cargó como «${c.valor ?? ''}».`;
  if (c.tipo === 'dudosa') return `${campo}: «${c.texto}» puede ser ${c.opciones.join(' o ')}.`;
  return `${campo}: «${c.texto}», ${siNoHay}.`;
}
