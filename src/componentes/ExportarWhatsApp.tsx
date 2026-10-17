import { Anchor, Button, Group, Modal, Paper, ScrollArea, SegmentedControl, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useBase } from '../base';
import { mensajeDeError } from '../formato';
import { type CriterioMensaje, enlaceWhatsApp, mensajePedidos, pedidosParaMensaje } from '../whatsapp';
import { Mensaje } from './comunes';

const CRITERIOS: { value: CriterioMensaje; label: string }[] = [
  { value: 'abiertos', label: 'Abiertos' }, { value: 'hoy', label: 'De hoy' }, { value: 'semana', label: 'Últimos 7 días' },
];

// Botón que abre la vista previa del mensaje con los pedidos, para copiarlo o compartirlo por WhatsApp.
export function ExportarWhatsApp() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button size="xs" variant="light" color="green" onClick={() => { setAbierto(true); }}>Exportar a WhatsApp</Button>
      <Modal opened={abierto} onClose={() => { setAbierto(false); }} title="Exportar a WhatsApp" size="lg">
        {abierto && <Contenido />}
      </Modal>
    </>
  );
}

function Contenido() {
  const { pedidos, datos, nombreDeposito, nombreVendedor } = useBase();
  const [criterio, setCriterio] = useState<CriterioMensaje>('abiertos');
  const [msg, setMsg] = useState<{ texto: string; error: boolean } | null>(null);
  const [hoy] = useState(() => new Date());
  const unidades = new Map(datos.productos.map((p) => [p.id, p.unidad]));
  const elegidos = pedidosParaMensaje(pedidos, criterio, hoy);
  const texto = mensajePedidos(elegidos, criterio, hoy, {
    deposito: nombreDeposito, vendedor: nombreVendedor, unidad: (id) => unidades.get(id) ?? '',
  });
  const vacio = elegidos.length === 0;
  // Web Share abre el selector de apps del celular; en la compu suele no estar.
  const puedeCompartir = 'share' in navigator;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setMsg({ texto: '✓ Mensaje copiado. Pegalo en el grupo.', error: false });
    } catch (err) {
      setMsg({ texto: `No se pudo copiar: ${mensajeDeError(err)}`, error: true });
    }
  }

  async function compartir() {
    try {
      await navigator.share({ text: texto });
    } catch (err) {
      // Cerrar el selector sin elegir una app no es un error.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setMsg({ texto: `No se pudo compartir: ${mensajeDeError(err)}`, error: true });
    }
  }

  return (
    <Stack gap="sm">
      <SegmentedControl size="xs" data={CRITERIOS} value={criterio} aria-label="Pedidos a exportar"
        onChange={(v) => { setCriterio(v); setMsg(null); }} />
      <Paper withBorder p="sm" radius="md" className="suave">
        <ScrollArea.Autosize mah={360} type="auto">
          <Text size="sm" ff="monospace" style={{ whiteSpace: 'pre-wrap' }} role="document" aria-label="Vista previa del mensaje">
            {texto}
          </Text>
        </ScrollArea.Autosize>
      </Paper>
      <Group gap="xs">
        <Button onClick={() => { void copiar(); }} disabled={vacio}>Copiar</Button>
        {puedeCompartir && (
          <Button variant="default" onClick={() => { void compartir(); }} disabled={vacio}>Compartir…</Button>
        )}
        {!vacio && (
          <Anchor href={enlaceWhatsApp(texto)} target="_blank" rel="noopener noreferrer" size="sm">Abrir en WhatsApp</Anchor>
        )}
      </Group>
      <Mensaje msg={msg} />
    </Stack>
  );
}
