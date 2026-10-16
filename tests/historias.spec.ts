// Historias de usuario de punta a punta: cada prueba recorre un caso real de varias pantallas, con la
// planilla de google-falso.ts como punto de partida. Ahí está el estado inicial:
//   Almendras: 10 kg en General (BB), 0 en Rosario, 6 en camino a Rosario (F0001). Costo promedio $1.500.
//   Avena: 25 kg en Rosario; PE0002 (Ana, Guada/Hernán) pide 10 kg sin entregar. Costo promedio $500.
//   Precios de lista: Almendras $3.000, Avena $800. Miel sin precio.
//   Reglas: Leo 10% general; Guada/Hernán 3% general y 7% en Almendras.
import type { Page } from '@playwright/test'
import { AHORA, expect, HOY_SERIE, test } from './google-falso'

type Pantalla = 'Stock' | 'Pedidos' | 'Ventas' | 'Compras' | 'Fletes' | 'Precios'

const ir = async (page: Page, pantalla: Pantalla) =>
  page.getByRole('radiogroup', { name: 'Pantalla' }).getByText(pantalla, { exact: true }).click()

const filaCon = (page: Page, texto: string) =>
  page.getByRole('row').filter({ has: page.getByRole('cell', { name: texto, exact: true }) })

// Columnas del inventario: Producto, Unidad, General, Rosario, En camino, Total, Comprometido, ...
async function esperarStock(page: Page, producto: string, s: { general: string; rosario: string; camino: string; comprometido: string }) {
  const celdas = filaCon(page, producto).getByRole('cell')
  await expect(celdas.nth(2)).toHaveText(s.general)
  await expect(celdas.nth(3)).toHaveText(s.rosario)
  await expect(celdas.nth(4)).toHaveText(s.camino)
  await expect(celdas.nth(6)).toHaveText(s.comprometido)
}

const formPedido = (page: Page) => page.getByRole('form', { name: 'Nuevo pedido' })
const formEntrega = (page: Page) => page.getByRole('form', { name: 'Registrar entrega' })
const formFlete = (page: Page) => page.getByRole('form', { name: 'Nuevo flete' })
const kpi = (page: Page, nombre: string) => page.getByRole('group', { name: nombre, exact: true })

async function elegirCliente(page: Page, nombre: string) {
  const cliente = formPedido(page).getByLabel('Cliente', { exact: true })
  await cliente.fill(nombre)
  await cliente.blur()
}

async function elegirOpcion(page: Page, campo: ReturnType<Page['getByLabel']>, opcion: string) {
  await campo.click()
  await page.getByRole('option', { name: opcion }).click()
  await page.keyboard.press('Escape')
}

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#pedidos')
  await ingresar()
})

test('pedido sin stock en Rosario: se trae de Bahía Blanca, se rompe una bolsa en el viaje y se entrega en dos veces', async ({ page, google }) => {
  // 1. Ana pide 12 kg de almendras en Rosario a un precio especial. En Rosario no hay stock.
  await elegirCliente(page, 'Ana')
  const pedido = formPedido(page)
  await expect(pedido.getByText('Guada/Hernán')).toBeVisible()
  await pedido.getByLabel('Producto', { exact: true }).fill('Almendras')
  await pedido.getByLabel('Cantidad', { exact: true }).fill('12')
  await pedido.getByLabel('Precio unitario', { exact: true }).fill('2900')
  await expect(pedido.getByText(/Disponible en Rosario: 0 kg — falta stock/)).toBeVisible()
  await expect(pedido.getByText(/Precio especial \(lista \$\s3\.000\)/)).toBeVisible()
  await pedido.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(pedido.getByText(/✓ Pedido PE0003 de Ana registrado/)).toBeVisible()

  // 2. Stock: el pedido compromete 12 kg; con los 6 que ya vienen en camino faltan 6.
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '10', rosario: '0', camino: '6', comprometido: '12' })
  await expect(kpi(page, 'Faltan para pedidos')).toContainText('1')

  // 3. Se arma un flete de Bahía Blanca a Rosario con los 6 kg que faltan; todo su costo va al pedido.
  await ir(page, 'Fletes')
  const flete = formFlete(page)
  await flete.getByLabel('Transporte', { exact: true }).fill('Interprovincial')
  await flete.getByLabel('Costo', { exact: true }).fill('8000')
  await flete.getByLabel('Producto', { exact: true }).fill('Almendras')
  await flete.getByLabel('Cantidad', { exact: true }).fill('6')
  await elegirOpcion(page, flete.getByLabel('Pedidos que lleva', { exact: true }), 'PE0003 · Ana')
  await expect(flete.getByLabel('Costo asignado a PE0003')).toHaveValue('8000')
  await flete.getByRole('button', { name: 'Registrar flete' }).click()
  await expect(flete.getByText('✓ Flete F0002 registrado (en preparación).')).toBeVisible()

  // En preparación la mercadería sigue en Bahía Blanca.
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '10', rosario: '0', camino: '6', comprometido: '12' })

  // 4. Sale el flete: deja Bahía Blanca y queda en camino. Ya no falta nada.
  await ir(page, 'Fletes')
  await page.getByRole('button', { name: 'Despachar F0002' }).click()
  await expect(page.getByText('✓ Flete F0002: en camino.')).toBeVisible()
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '4', rosario: '0', camino: '12', comprometido: '12' })
  await expect(kpi(page, 'Faltan para pedidos')).toContainText('0')

  // 5. Llegan los dos fletes a Rosario.
  await ir(page, 'Fletes')
  await page.getByRole('button', { name: 'Recibido F0002' }).click()
  await expect(page.getByText('✓ Flete F0002: finalizado.')).toBeVisible()
  await page.getByRole('button', { name: 'Recibido F0001' }).click()
  await expect(page.getByText('✓ Flete F0001: finalizado.')).toBeVisible()
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '4', rosario: '12', camino: '–', comprometido: '12' })

  // 6. Una bolsa llegó rota: se ajusta el stock de Rosario después de recibir el flete.
  const ajuste = page.getByRole('form', { name: 'Ajuste de stock' })
  await ajuste.getByLabel('Producto', { exact: true }).fill('Almendras')
  await ajuste.getByLabel('Depósito', { exact: true }).selectOption({ label: 'Rosario' })
  await ajuste.getByLabel('Cantidad', { exact: true }).fill('-1')
  await ajuste.getByLabel('Motivo', { exact: true }).fill('Bolsa rota en flete F0002')
  await ajuste.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(ajuste.getByText('✓ Ajuste registrado: -1 kg de Almendras.')).toBeVisible()
  await esperarStock(page, 'Almendras', { general: '4', rosario: '11', camino: '–', comprometido: '12' })

  // 7. Primera entrega: 10 kg, con la comisión de Guada/Hernán bajada del 7% de la regla al 6%.
  await ir(page, 'Pedidos')
  await filaCon(page, 'PE0003').getByRole('button', { name: 'Entregar' }).click()
  const entrega = formEntrega(page)
  await expect(entrega.getByText('Stock en Rosario: 11')).toBeVisible()
  await expect(entrega.getByLabel('Entregar Almendras')).toHaveValue('12')
  await entrega.getByLabel('Entregar Almendras').fill('10')
  const comision = entrega.getByLabel('Comisión Guada/Hernán Almendras')
  await expect(comision).toHaveValue('7')
  await comision.fill('6')
  await expect(entrega.getByText('Guada/Hernán (regla 7%)')).toBeVisible()
  // 10 × 2.900 = 29.000; comisión 6% = 1.740; ganancia 29.000 − 1.740 − 10 × 1.500 = 12.260.
  await expect(entrega.getByRole('group', { name: 'Importe' })).toContainText('29.000')
  await expect(entrega.getByRole('group', { name: 'Comisión' })).toContainText('1.740')
  await expect(entrega.getByRole('group', { name: 'Ganancia' })).toContainText('12.260')
  await entrega.getByRole('button', { name: 'Registrar entrega' }).click()
  await expect(entrega.getByText(/✓ Entrega V0002 registrada/)).toBeVisible()
  // La ganancia del pedido descuenta además el flete asignado: 12.260 − 8.000.
  await expect(filaCon(page, 'PE0003')).toContainText('Parcial')
  await expect(filaCon(page, 'PE0003')).toContainText(/4\.260/)

  // 8. Segunda entrega: 1 kg (el último que quedó en Rosario) con la comisión de la regla.
  await expect(entrega.getByLabel('Entregar Almendras')).toHaveValue('2')
  await entrega.getByLabel('Entregar Almendras').fill('1')
  await entrega.getByRole('button', { name: 'Registrar entrega' }).click()
  await expect(entrega.getByText(/✓ Entrega V0003 registrada/)).toBeVisible()

  // 9. El kilo que falta no se va a entregar: se cierra el pedido con pendientes.
  await entrega.getByRole('button', { name: 'Cerrar con pendientes' }).click()
  await expect(page.getByText('El pedido PE0003 quedó cerrado.')).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Mostrar' }).getByText('Todos').click()
  // Entregado 31.900 − comisiones 1.943 − costo 11 × 1.500 − flete 8.000 = 5.457.
  await expect(filaCon(page, 'PE0003')).toContainText('Cerrado')
  await expect(filaCon(page, 'PE0003')).toContainText(/31\.900/)
  await expect(filaCon(page, 'PE0003')).toContainText(/5\.457/)

  // 10. El stock queda sin comprometer y la liquidación muestra el porcentaje cambiado.
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '4', rosario: '0', camino: '–', comprometido: '–' })
  await ir(page, 'Ventas')
  const guada = page.getByRole('table', { name: 'Comisiones por vendedor' }).getByRole('row').filter({ hasText: 'Guada/Hernán' })
  await expect(guada).toContainText('1 con % distinto de la regla')
  await expect(guada).toContainText(/1\.943/)

  // Cada operación se guardó en una sola escritura.
  expect(google.escrituras).toHaveLength(9)
  expect(google.escrituras[1]).toEqual({
    'Fletes': [['F0002', HOY_SERIE, 'Interprovincial', 'C0004', 'BB', 'ROS', 8000, '', '']],
    'Fletes ítems': [['F0002', 'P001', 'Almendras', 6]],
    'Fletes estados': [['F0002', AHORA, 'preparacion']],
    'Pedidos fletes': [['PE0003', 'F0002', 8000]],
  })
  expect(google.escrituras[5]).toEqual({ 'Ajustes': [[HOY_SERIE, 'ROS', 'P001', 'Almendras', -1, 'Bolsa rota en flete F0002']] })
  expect(google.escrituras[6]).toEqual({
    'Ventas': [['V0002', HOY_SERIE, 'PE0003', 'ROS', '']],
    'Ventas ítems': [['V0002', 1, 1, 'P001', 'Almendras', 10, 2900, 29000, 1500]],
    'Ventas comisiones': [['V0002', 1, 'VEN02', 'Guada/Hernán', 7, 6, 1740]],
  })
  expect(google.escrituras[7]['Ventas comisiones']).toEqual([['V0003', 1, 'VEN02', 'Guada/Hernán', 7, 7, 203]])
})

test('cambiar el precio de lista y la regla de comisión no toca los pedidos ya cargados', async ({ page, google }) => {
  // 1. Ana pide 5 kg de avena al precio de lista ($800).
  await elegirCliente(page, 'Ana')
  const pedido = formPedido(page)
  await pedido.getByLabel('Producto', { exact: true }).fill('Avena')
  await expect(pedido.getByLabel('Precio unitario', { exact: true })).toHaveValue('800')
  await pedido.getByLabel('Cantidad', { exact: true }).fill('5')
  await pedido.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(pedido.getByText(/✓ Pedido PE0003 de Ana registrado/)).toBeVisible()

  // 2. Sube el precio de lista de la avena y Guada/Hernán pasa a cobrar 4% en avena.
  await ir(page, 'Precios')
  const precio = page.getByRole('form', { name: 'Cambiar precio' })
  await precio.getByLabel('Producto', { exact: true }).fill('Avena')
  await precio.getByLabel('Precio', { exact: true }).fill('900')
  await precio.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(precio.getByText(/✓ Avena: \$\s900/)).toBeVisible()
  const regla = page.getByRole('form', { name: 'Nueva regla de comisión' })
  await regla.getByLabel('Vendedor', { exact: true }).selectOption({ label: 'Guada/Hernán' })
  await regla.getByLabel('Producto', { exact: true }).fill('Avena')
  await regla.getByLabel('Comisión', { exact: true }).fill('4')
  await regla.getByRole('button', { name: 'Guardar regla' }).click()
  await expect(regla.getByText('✓ Guada/Hernán: 4% en Avena.')).toBeVisible()

  // 3. Un pedido nuevo ya propone el precio nuevo.
  await ir(page, 'Pedidos')
  await pedido.getByLabel('Producto', { exact: true }).fill('Avena')
  await expect(pedido.getByLabel('Precio unitario', { exact: true })).toHaveValue('900')

  // 4. La entrega del pedido anterior mantiene $800 y propone la regla nueva (vigente a la fecha de entrega).
  await filaCon(page, 'PE0003').getByRole('button', { name: 'Entregar' }).click()
  const entrega = formEntrega(page)
  await expect(entrega.getByText(/\$\s800 c\/u/)).toBeVisible()
  await expect(entrega.getByLabel('Comisión Guada/Hernán Avena')).toHaveValue('4')
  await expect(entrega.getByRole('group', { name: 'Importe' })).toContainText('4.000')
  await entrega.getByRole('button', { name: 'Registrar entrega' }).click()
  // Al quedar entregado todo, el panel se cierra y lo avisa.
  await expect(page.getByText('El pedido PE0003 quedó entregado.')).toBeVisible()

  expect(google.escrituras.at(-1)).toEqual({
    'Ventas': [['V0002', HOY_SERIE, 'PE0003', 'ROS', '']],
    'Ventas ítems': [['V0002', 1, 1, 'P002', 'Avena', 5, 800, 4000, 500]],
    'Ventas comisiones': [['V0002', 1, 'VEN02', 'Guada/Hernán', 4, 4, 160]],
  })
})

test('se compra un producto nuevo y se vende en el momento a un cliente nuevo', async ({ page, google }) => {
  // 1. Llegan 20 kg de pasas, un producto nuevo, de un proveedor nuevo, al depósito de Rosario.
  await ir(page, 'Compras')
  const compra = page.getByRole('form', { name: 'Registrar compra' })
  await compra.getByLabel('Depósito', { exact: true }).selectOption({ label: 'Rosario' })
  await compra.getByLabel('Proveedor', { exact: true }).fill('Prov C')
  await compra.getByLabel('Producto', { exact: true }).fill('Pasas')
  await compra.getByLabel('Cantidad', { exact: true }).fill('20')
  await compra.getByLabel('Precio unitario', { exact: true }).fill('1000')
  await compra.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(compra.getByText('✓ Compra a Prov C registrada (1 producto, 1 nuevo).')).toBeVisible()

  // 2. Bruno, cliente nuevo, compra 3 kg en el momento por medio de Leo. Las pasas no tienen precio de lista.
  await ir(page, 'Pedidos')
  await elegirCliente(page, 'Bruno')
  const pedido = formPedido(page)
  await elegirOpcion(page, pedido.getByLabel('Vendedores', { exact: true }), 'Leo')
  await pedido.getByLabel('Producto', { exact: true }).fill('Pasas')
  await expect(pedido.getByText('Sin precio de lista: se agrega con este precio')).toBeVisible()
  await expect(pedido.getByText(/Disponible en Rosario: 20 kg/)).toBeVisible()
  await pedido.getByLabel('Cantidad', { exact: true }).fill('3')
  await pedido.getByLabel('Precio unitario', { exact: true }).fill('1800')
  await pedido.getByLabel('Se entrega ahora (venta directa)').check()
  await pedido.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(pedido.getByText(/✓ Pedido PE0003 de Bruno registrado y entregado/)).toBeVisible()

  expect(google.escrituras[1]).toEqual({
    'Contactos': [['C0006', 'cliente', 'Bruno', 'Minorista', '', '', '', '', '', '']],
    'Pedidos': [['PE0003', HOY_SERIE, 'C0006', 'Bruno', 'Minorista', '', '', 'ROS', '']],
    'Pedidos ítems': [['PE0003', 1, 'P004', 'Pasas', 3, '', 1800]],
    'Pedidos estados': [['PE0003', AHORA, 'abierto']],
    'Pedidos vendedores': [['PE0003', 'VEN01']],
    'Precios': [['P004', 'Pasas', 1800, HOY_SERIE]],
    'Ventas': [['V0002', HOY_SERIE, 'PE0003', 'ROS', '']],
    'Ventas ítems': [['V0002', 1, 1, 'P004', 'Pasas', 3, 1800, 5400, 1000]],
    // Leo cobra su 10% general.
    'Ventas comisiones': [['V0002', 1, 'VEN01', 'Leo', 10, 10, 540]],
  })

  // 3. La venta aparece con su ganancia: 5.400 − 540 − 3 × 1.000 = 1.860. Quedan 17 kg.
  await ir(page, 'Ventas')
  const venta = filaCon(page, 'Bruno')
  await expect(venta).toContainText('Pasas')
  await expect(venta).toContainText(/1\.860/)
  await ir(page, 'Stock')
  await esperarStock(page, 'Pasas', { general: '0', rosario: '17', camino: '–', comprometido: '–' })

  // 4. El próximo pedido de Bruno ya propone a Leo y el precio de lista nuevo.
  await ir(page, 'Pedidos')
  await elegirCliente(page, 'Bruno')
  await expect(pedido.getByText('Leo')).toBeVisible()
  await pedido.getByLabel('Producto', { exact: true }).fill('Pasas')
  await expect(pedido.getByLabel('Precio unitario', { exact: true })).toHaveValue('1800')
  await expect(pedido.getByText(/Precio de lista \$\s1\.800/)).toBeVisible()
})

test('un flete cancelado y uno que vuelve sin entregar no mueven stock', async ({ page, google }) => {
  // 1. Se arma un flete de 4 kg de almendras a Rosario, pero no sale: se cancela.
  await ir(page, 'Fletes')
  const flete = formFlete(page)
  await flete.getByLabel('Transporte', { exact: true }).fill('Expreso nuevo')
  await flete.getByLabel('Producto', { exact: true }).fill('Almendras')
  await flete.getByLabel('Cantidad', { exact: true }).fill('4')
  await flete.getByRole('button', { name: 'Registrar flete' }).click()
  await expect(flete.getByText('✓ Flete F0002 registrado (en preparación).')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar F0002' }).click()
  await expect(page.getByText('✓ Flete F0002: cancelado.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Despachar F0002' })).toBeHidden()

  // 2. El flete que estaba en camino vuelve sin entregar: los 6 kg regresan a Bahía Blanca.
  await page.getByRole('button', { name: 'Volvió sin entregar F0001' }).click()
  await expect(page.getByText('✓ Flete F0001: en preparación.')).toBeVisible()
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '16', rosario: '0', camino: '–', comprometido: '–' })

  // 3. Sale de nuevo y esta vez llega.
  await ir(page, 'Fletes')
  await page.getByRole('button', { name: 'Despachar F0001' }).click()
  await expect(page.getByText('✓ Flete F0001: en camino.')).toBeVisible()
  await page.getByRole('button', { name: 'Recibido F0001' }).click()
  await expect(page.getByText('✓ Flete F0001: finalizado.')).toBeVisible()
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '10', rosario: '6', camino: '–', comprometido: '–' })

  expect(google.escrituras.slice(1).map((e) => e['Fletes estados'])).toEqual([
    [['F0002', AHORA, 'cancelado']],
    [['F0001', AHORA, 'preparacion']],
    [['F0001', AHORA, 'camino']],
    [['F0001', AHORA, 'finalizado']],
  ])
  // El transporte nuevo quedó en Contactos junto con el flete.
  expect(google.escrituras[0].Contactos).toEqual([['C0005', 'transporte', 'Expreso nuevo', '', '', '', '', '', '', '']])
})

test('una compra hecha para un pedido cubre lo que faltaba', async ({ page }) => {
  // 1. Ana pide 40 kg de avena en Rosario: hay 25 y ya hay 10 comprometidos con PE0002.
  await elegirCliente(page, 'Ana')
  const pedido = formPedido(page)
  await pedido.getByLabel('Producto', { exact: true }).fill('Avena')
  await pedido.getByLabel('Cantidad', { exact: true }).fill('40')
  await expect(pedido.getByText(/Disponible en Rosario: 15 kg — falta stock/)).toBeVisible()
  await pedido.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(pedido.getByText(/✓ Pedido PE0003 de Ana registrado/)).toBeVisible()
  await expect(kpi(page, 'Con faltante de stock')).toContainText('2')

  await ir(page, 'Stock')
  await esperarStock(page, 'Avena', { general: '0', rosario: '25', camino: '–', comprometido: '50' })
  await expect(kpi(page, 'Faltan para pedidos')).toContainText('1')

  // 2. Se compran 30 kg en Rosario para ese pedido.
  await ir(page, 'Compras')
  const compra = page.getByRole('form', { name: 'Registrar compra' })
  await compra.getByLabel('Depósito', { exact: true }).selectOption({ label: 'Rosario' })
  await compra.getByLabel('Proveedor', { exact: true }).fill('Prov B')
  await compra.getByLabel('Producto', { exact: true }).fill('Avena')
  await compra.getByLabel('Cantidad', { exact: true }).fill('30')
  await compra.getByLabel('Para el pedido', { exact: true }).selectOption({ label: 'PE0003 · Ana' })
  await compra.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(compra.getByText('✓ Compra a Prov B registrada (1 producto).')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Para PE0003' })).toContainText('Avena')

  // 3. Ya no falta nada.
  await ir(page, 'Stock')
  await esperarStock(page, 'Avena', { general: '0', rosario: '55', camino: '–', comprometido: '50' })
  await expect(kpi(page, 'Faltan para pedidos')).toContainText('0')
  await ir(page, 'Pedidos')
  await expect(kpi(page, 'Con faltante de stock')).toContainText('0')
})
