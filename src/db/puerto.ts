// Puerto de la base de datos: lo que la UI necesita de la base, en términos del dominio. La UI solo
// conoce esta interfaz; cómo se guarda (hojas, columnas, celdas, API) es asunto de cada adaptador.
// Ver spec/arquitectura.md.
import type {
  Ajuste, Cobro, Compra, ContactoNuevo, Datos, Entrega, EstadoFlete, Flete, FleteItem, Pedido, PedidoFlete, PedidoItem, Precio,
  Producto, ReglaComision, Rendicion,
} from '../dominio/modelo';

export class SesionVencida extends Error {
  constructor() { super('La sesión de Google venció. Tocá "Reconectar".'); }
}
export class SinAcceso extends Error {
  constructor() { super('Esta cuenta no tiene acceso a la planilla de ERPeq.'); }
}

// Algo que la base todavía no tiene y hay que crear a mano (en Sheets, una hoja con sus encabezados).
export interface Faltante { nombre: string; encabezados: string[] }

export interface InfoBase {
  titulo: string;
  url: string;
  // Lo que falta para la caja (socios, cobros y rendiciones). Mientras falte algo, esos datos se leen
  // vacíos y no se registran cobros ni rendiciones; el resto de la app funciona igual.
  faltantes: Faltante[];
}

export interface PedidoNuevo {
  pedido: Pedido;
  items: PedidoItem[];
  vendedores: string[]; // IDs de los vendedores que comisionan
  momento: Date; // del estado inicial "abierto"
  clienteNuevo: ContactoNuevo | null;
  // Productos sin precio de lista, que quedan con el precio de este pedido.
  preciosNuevos: Precio[];
  // Venta directa: el pedido se entrega en la misma operación.
  entrega: Entrega | null;
  // Cobros de la venta directa, en la misma operación.
  cobros?: Cobro[];
}

export interface FleteNuevo {
  flete: Flete;
  items: FleteItem[];
  estados: EstadoFlete[]; // en orden, todos con el mismo momento
  momento: Date;
  pedidos: PedidoFlete[];
  transporteNuevo: ContactoNuevo | null;
}

export interface CompraNueva {
  lineas: Omit<Compra, 'fila' | 'importe'>[]; // el importe lo calcula la base: cantidad × precio
  productosNuevos: Producto[];
  proveedorNuevo: ContactoNuevo | null;
}

// Login y apertura de la base.
export interface Sesion {
  readonly configurada: boolean;
  // Prepara el login; `alVencer` se llama cuando la sesión vence y hay que reconectar. Devuelve true si
  // sigue vigente una sesión anterior (por ejemplo, al recargar la página): se puede abrir sin ingresar.
  iniciar: (alVencer: () => void) => Promise<boolean>;
  // Tiene que llamarse desde un click: puede abrir una ventana.
  ingresar: () => Promise<void>;
  salir: () => Promise<void>;
  // Lanza SinAcceso si la cuenta no puede abrir la base.
  abrir: () => Promise<InfoBase>;
}

// Operaciones de escritura. Cada una es atómica: se guarda todo o nada.
export interface Operaciones {
  registrarPedido: (p: PedidoNuevo) => Promise<void>;
  // Los cobros opcionales se guardan junto con la venta.
  registrarEntrega: (e: Entrega, cobros?: Cobro[]) => Promise<void>;
  cambiarEstadoPedido: (pedidoId: string, estado: 'cancelado' | 'cerrado', momento: Date) => Promise<void>;
  registrarFlete: (f: FleteNuevo) => Promise<void>;
  cambiarEstadoFlete: (fleteId: string, estado: EstadoFlete, momento: Date) => Promise<void>;
  registrarCompra: (c: CompraNueva) => Promise<void>;
  registrarAjuste: (a: Ajuste) => Promise<void>;
  registrarPrecio: (p: Precio) => Promise<void>;
  registrarReglaComision: (r: ReglaComision) => Promise<void>;
  registrarCobro: (c: Cobro) => Promise<void>;
  registrarRendicion: (r: Rendicion) => Promise<void>;
}

export interface BaseDeDatos extends Sesion, Operaciones {
  leer: () => Promise<Datos>;
}
