// Puerto de la base de datos: lo que la UI necesita de la base, en términos del dominio. La UI solo
// conoce esta interfaz; cómo se guarda (hojas, columnas, celdas, API) es asunto de cada adaptador.
// Ver spec/arquitectura.md.
import type {
  Ajuste, Cobro, Compra, Contacto, ContactoNuevo, CorreccionPedido, Datos, Entrega, EstadoFlete, Flete, FleteItem, Pedido, PedidoItem,
  Precio, Producto, Receta, RecetaItem, ReglaComision, ReglaEnvio, Rendicion,
} from '../dominio/modelo';

export class SesionVencida extends Error {
  constructor() { super('La sesión de Google venció. Tocá "Reconectar".'); }
}
export class SinAcceso extends Error {
  constructor() { super('Esta cuenta no tiene acceso a la planilla de ERPeq.'); }
}

// Áreas que funcionan solo si la base tiene sus datos: la caja (socios, cobros y rendiciones), las recetas
// (recetas y sus insumos) y los envíos (reglas de envío y envíos cobrados en las entregas).
export type AreaOpcional = 'caja' | 'recetas' | 'envios';

// Algo que la base todavía no tiene y hay que crear a mano (en Sheets, una hoja con sus encabezados).
export interface Faltante { area: AreaOpcional; nombre: string; encabezados: string[] }

export interface InfoBase {
  titulo: string;
  url: string;
  // Lo que falta de cada área. Mientras falte algo, esos datos se leen vacíos y el área no registra nada;
  // el resto de la app funciona igual.
  faltantes: Faltante[];
}

export const faltantesDe = (info: InfoBase, area: AreaOpcional) => info.faltantes.filter((f) => f.area === area);

export interface PedidoNuevo {
  pedido: Pedido;
  items: PedidoItem[];
  vendedores: string[]; // IDs de los vendedores que comisionan
  momento: Date; // del estado inicial "abierto"
  // Productos sin precio de lista, que quedan con el precio de este pedido.
  preciosNuevos: Precio[];
  // Venta directa: el pedido se entrega en la misma operación.
  entrega: Entrega | null;
  // Cobros de la venta directa, en la misma operación.
  cobros?: Cobro[];
}

// Un flete lleva productos, no pedidos: no guarda para qué pedidos va.
export interface FleteNuevo {
  flete: Flete;
  items: FleteItem[];
  estados: EstadoFlete[]; // en orden, todos con el mismo momento
  momento: Date;
  transporteNuevo: ContactoNuevo | null;
}

// Una versión nueva de una receta (alta, cambio o baja).
export interface RecetaNueva { receta: Receta; items: RecetaItem[] }

export interface CompraNueva {
  lineas: Omit<Compra, 'fila' | 'importe'>[]; // el importe lo calcula la base: cantidad × precio
  productosNuevos: Producto[];
  proveedorNuevo: ContactoNuevo | null;
}

// Login y apertura de la base.
export interface Sesion {
  readonly configurada: boolean;
  // Prepara el login; `alVencer` se llama cuando la sesión vence y hay que reconectar. Devuelve true si
  // sigue vigente una sesión anterior (al recargar la página o en otra pestaña): se puede abrir sin ingresar.
  iniciar: (alVencer: () => void) => Promise<boolean>;
  // Tiene que llamarse desde un click: puede abrir una ventana.
  ingresar: () => Promise<void>;
  salir: () => Promise<void>;
  // Lanza SinAcceso si la cuenta no puede abrir la base.
  abrir: () => Promise<InfoBase>;
}

// Operaciones de escritura. Cada una es atómica: se guarda todo o nada.
// Los contactos, productos y pedidos se dan de alta y se corrigen: `corregir…` reemplaza los datos del que tiene ese ID.
export interface Operaciones {
  registrarContacto: (c: Contacto) => Promise<void>;
  corregirContacto: (c: Contacto) => Promise<void>;
  // El precio de lista, si se da, se guarda junto con el producto.
  registrarProducto: (p: Producto, precio: Precio | null) => Promise<void>;
  corregirProducto: (p: Producto) => Promise<void>;
  registrarPedido: (p: PedidoNuevo) => Promise<void>;
  // Reemplaza el pedido, sus ítems y vendedores, y sus entregas ya registradas (corregirPedido del dominio).
  corregirPedido: (c: CorreccionPedido) => Promise<void>;
  // Los cobros opcionales se guardan junto con la venta.
  registrarEntrega: (e: Entrega, cobros?: Cobro[]) => Promise<void>;
  cambiarEstadoPedido: (pedidoId: string, estado: 'cancelado' | 'cerrado', momento: Date) => Promise<void>;
  registrarFlete: (f: FleteNuevo) => Promise<void>;
  cambiarEstadoFlete: (fleteId: string, estado: EstadoFlete, momento: Date) => Promise<void>;
  registrarCompra: (c: CompraNueva) => Promise<void>;
  registrarAjuste: (a: Ajuste) => Promise<void>;
  registrarPrecio: (p: Precio) => Promise<void>;
  registrarReglaComision: (r: ReglaComision) => Promise<void>;
  registrarReglaEnvio: (r: ReglaEnvio) => Promise<void>;
  registrarCobro: (c: Cobro) => Promise<void>;
  registrarRendicion: (r: Rendicion) => Promise<void>;
  registrarReceta: (r: RecetaNueva) => Promise<void>;
  // Los ajustes de una fabricación (armarFabricacion): descuentan los insumos y suman el producto.
  registrarFabricacion: (ajustes: Ajuste[]) => Promise<void>;
}

export interface BaseDeDatos extends Sesion, Operaciones {
  leer: () => Promise<Datos>;
}
