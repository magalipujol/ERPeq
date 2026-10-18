import { ActionIcon, Box, Popover, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconBuildingWarehouse, IconTruck } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useBase } from '../base';
import { marcasDelMapa } from '../dominio/mapa';
import * as M from '../dominio/modelo';
import { fmtFecha, fmtMoney } from '../formato';
import { armarMapa, curva, MAPA, type Sitio, type SinUbicar, type Tramo } from '../mapa/ubicar';
import { EstadoFlete, Recorrido } from '../vistas/Fletes';

// Unidades del mapa (1 unidad ≈ 5,5 km): lugares más cerca que esto comparten marca.
const RADIO = 12;

const COLOR_TRAMO: Record<'preparacion' | 'camino', string> = {
  preparacion: 'var(--mantine-color-yellow-6)', camino: 'var(--mantine-color-blue-6)',
};

const pos = (p: { x: number; y: number }) => ({ left: `${(p.x / MAPA.ancho) * 100}%`, top: `${(p.y / MAPA.alto) * 100}%` });

export interface AccionesMapa {
  onPedido: (id: string) => void;
  onFlete: (id: string) => void;
  onDeposito: (id: string) => void;
}

export function Mapa({ onPedido, onFlete, onDeposito }: AccionesMapa) {
  const { datos, pedidos, estadosFletes } = useBase();
  const mapa = useMemo(() => armarMapa(marcasDelMapa(datos, pedidos, estadosFletes), RADIO), [datos, pedidos, estadosFletes]);
  // Un solo globo abierto a la vez: la clave del sitio o del tramo.
  const [abierto, setAbierto] = useState<string | null>(null);
  const alternar = (clave: string) => { setAbierto((a) => (a === clave ? null : clave)); };
  const globo = (clave: string) => ({
    opened: abierto === clave,
    onChange: (o: boolean) => { if (!o) setAbierto((a) => (a === clave ? null : a)); },
  });

  return (
    <Stack gap="xs">
      <Box className="mapa" style={{ width: `min(100%, calc(70vh * ${MAPA.ancho} / ${MAPA.alto}))`, aspectRatio: `${MAPA.ancho} / ${MAPA.alto}` }}>
        <svg viewBox={`0 0 ${MAPA.ancho} ${MAPA.alto}`} width="100%" height="100%" role="img"
          aria-label="Mapa de Argentina con depósitos, pedidos pendientes y fletes en curso">
          <defs>
            {(['preparacion', 'camino'] as const).map((e) => (
              <marker key={e} id={`flecha-${e}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill={COLOR_TRAMO[e]} />
              </marker>
            ))}
          </defs>
          {MAPA.provincias.map((p) => <path key={p.nombre} d={p.d} className="mapa-provincia"><title>{p.nombre}</title></path>)}
          {mapa.tramos.map((t) => <LineaTramo key={t.clave} tramo={t} onClick={() => { alternar(t.clave); }} />)}
        </svg>

        {mapa.tramos.map((t) => (
          <MarcaTramo key={t.clave} tramo={t} globo={globo(t.clave)} onAlternar={() => { alternar(t.clave); }}
            onFlete={(id) => { setAbierto(null); onFlete(id); }} />
        ))}

        {mapa.sitios.map((s) => (
          <MarcaSitio key={s.clave} sitio={s} globo={globo(s.clave)} onAlternar={() => { alternar(s.clave); }}
            onPedido={(id) => { setAbierto(null); onPedido(id); }} onDeposito={onDeposito} />
        ))}
      </Box>
      <Leyenda />
      {mapa.sinUbicar.length > 0 && <SinUbicarAviso items={mapa.sinUbicar} />}
    </Stack>
  );
}

function LineaTramo({ tramo, onClick }: { tramo: Tramo; onClick: () => void }) {
  const { d } = curva(tramo.desde, tramo.hasta);
  const estado = tramo.fletes.some((f) => f.estado === 'camino') ? 'camino' : 'preparacion';
  return (
    <g className={`mapa-tramo mapa-tramo-${estado}`}>
      <path d={d} stroke={COLOR_TRAMO[estado]} markerEnd={`url(#flecha-${estado})`} />
      {/* Franja invisible más ancha que la línea, para poder tocarla con el dedo. Para el teclado y los lectores de
          pantalla está el botón del camión, que hace lo mismo. */}
      <path d={d} className="mapa-tramo-toque" aria-hidden onClick={onClick} />
    </g>
  );
}

interface Globo { opened: boolean; onChange: (o: boolean) => void }

function MarcaTramo({ tramo, globo, onAlternar, onFlete }: {
  tramo: Tramo; globo: Globo; onAlternar: () => void; onFlete: (id: string) => void;
}) {
  const { nombres, etiquetas } = useBase();
  const nombre = `${tramo.desde.nombre} a ${tramo.hasta.nombre}`;
  return (
    // El div ubica la marca: el ActionIcon usa su propio `transform` al apretarlo.
    <div className="mapa-marca" style={pos(curva(tramo.desde, tramo.hasta).medio)}>
      <Popover {...globo} position="top" withArrow shadow="md" width={280}>
        <Popover.Target>
          <ActionIcon size="md" radius="xl" color={tramo.fletes.some((f) => f.estado === 'camino') ? 'blue' : 'yellow'}
            aria-label={`Fletes de ${nombre}: ${tramo.fletes.length}`} onClick={onAlternar}>
            <IconTruck size={16} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <Text size="sm" fw={700} mb={4}>Fletes de {nombre}</Text>
          <Stack gap={4}>
            {tramo.fletes.map(({ flete, estado }) => (
              <Enlace key={flete.id} onClick={() => { onFlete(flete.id); }} etiqueta={`Ver flete ${etiquetas.flete(flete.id)}`}>
                <Text size="sm" fw={500}>{nombres.contacto(flete.contactoId)} · {fmtFecha(flete.fecha)}</Text>
                <Text size="xs" c="dimmed"><Recorrido flete={flete} /></Text>
                <EstadoFlete estado={estado} />
              </Enlace>
            ))}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </div>
  );
}

function MarcaSitio({ sitio, globo, onAlternar, onPedido, onDeposito }: {
  sitio: Sitio; globo: Globo; onAlternar: () => void;
  onPedido: (id: string) => void; onDeposito: (id: string) => void;
}) {
  const { nombres, etiquetas, stock } = useBase();
  const n = sitio.pedidos.length;
  const conFaltante = sitio.pedidos.some((r) => M.lineasConFaltante(stock, r).length > 0);

  return (
    <div className="mapa-marca mapa-sitio" style={pos(sitio)}>
      {sitio.depositos.length > 0
        ? sitio.depositos.map((d) => (
          <ActionIcon key={d.id} size="lg" radius="xl" variant="filled" aria-label={`Depósito ${d.nombre}`} title={`Depósito ${d.nombre}: ver stock`}
            onClick={() => { onDeposito(d.id); }}>
            <IconBuildingWarehouse size={18} />
          </ActionIcon>
        ))
        : <span className="mapa-punto" title={sitio.nombre} />}
      {n > 0 && (
        <Popover {...globo} position="top" withArrow shadow="md" width={280}>
          <Popover.Target>
            <UnstyledButton className={`mapa-burbuja${conFaltante ? ' mapa-burbuja-falta' : ''}`}
              aria-label={`Pedidos pendientes en ${sitio.nombre}: ${n}`} onClick={onAlternar}>
              {n}
            </UnstyledButton>
          </Popover.Target>
          <Popover.Dropdown>
            <Text size="sm" fw={700} mb={4}>Pedidos pendientes en {sitio.nombre}</Text>
            <Stack gap={4}>
              {sitio.pedidos.map((r) => (
                <Enlace key={r.pedido.id} onClick={() => { onPedido(r.pedido.id); }} etiqueta={`Ver pedido ${etiquetas.pedido(r.pedido.id)}`}>
                  <Text size="sm" fw={500}>{nombres.contacto(r.pedido.contactoId)}</Text>
                  <Text size="xs" c="dimmed">{fmtFecha(r.pedido.fecha)} · {fmtMoney(r.importePedido)} · desde {nombres.deposito(r.pedido.depositoId)}</Text>
                </Enlace>
              ))}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      )}
    </div>
  );
}

function Enlace({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <UnstyledButton className="mapa-enlace" aria-label={etiqueta} onClick={onClick}>{children}</UnstyledButton>
  );
}

function Leyenda() {
  return (
    <Text size="xs" c="dimmed" component="div" className="mapa-leyenda">
      <span><IconBuildingWarehouse size={14} aria-hidden /> depósito (ver su stock)</span>
      <span><span className="mapa-burbuja mapa-burbuja-chica" aria-hidden>n</span> pedidos pendientes</span>
      <span><span className="mapa-raya" style={{ background: COLOR_TRAMO.preparacion }} aria-hidden /> flete en preparación</span>
      <span><span className="mapa-raya" style={{ background: COLOR_TRAMO.camino }} aria-hidden /> flete en camino</span>
    </Text>
  );
}

function SinUbicarAviso({ items }: { items: SinUbicar[] }) {
  const { nombres, etiquetas, contacto } = useBase();
  const texto = (x: SinUbicar) => {
    switch (x.tipo) {
      case 'deposito': return `depósito ${x.deposito.nombre} (${x.deposito.localidad})`;
      case 'pedido': {
        const loc = contacto(x.resumen.pedido.contactoId)?.localidad ?? '';
        return `pedido de ${nombres.contacto(x.resumen.pedido.contactoId)} (${loc || 'sin localidad'})`;
      }
      case 'flete': return `flete ${etiquetas.flete(x.flete.id)}`;
    }
  };
  return (
    <Text size="xs" c="dimmed">
      Fuera del mapa (localidad vacía o que no se encontró, flete desde un proveedor o dentro de la misma zona): {items.map(texto).join(', ')}.
    </Text>
  );
}
