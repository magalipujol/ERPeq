// Historias de usuario de punta a punta: cada prueba recorre un caso real de varias pantallas, con la
// planilla de google-falso.ts como punto de partida. Ahí está el estado inicial:
//   Almendras: 10 kg en General (BB), 0 en Rosario, 6 en camino a Rosario (F0001, de Interprovincial, del 08/10). Costo promedio $1.500.
//   Avena: 25 kg en Rosario; PE0002 (Ana, del 10/10, Guada/Hernán) pide 10 kg sin entregar. Costo promedio $500.
//   Mix europeo: sin stock ni compras (se fabrica con una receta).
//   Precios de lista: Almendras $3.000, Avena $800, Mix europeo $2.500. Miel sin precio.
//   Reglas: Leo 10% general; Guada/Hernán 3% general y 7% en Almendras.
//   Socios: Sampatti (la empresa de Leo, dueña de la mercadería) y Guada/Hernán. Sin cobros ni rendiciones.
//   Sin recetas ni fabricaciones.
import { devices, type Page } from '@playwright/test'
import { AHORA, expect, HOY_SERIE, ir, test } from './google-falso'

const filaCon = (page: Page, texto: string) =>
  page.getByRole('row').filter({ has: page.getByRole('cell', { name: texto, exact: true }) })
// Las filas de pedidos se nombran por cliente y fecha: "Ana · 10/10/26".
const filaPedido = (page: Page, pedido: string) => page.getByRole('row', { name: `Pedido ${pedido}`, exact: true })

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
  await expect(pedido.getByText(/✓ Pedido de Ana registrado/)).toBeVisible()

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
  await elegirOpcion(page, flete.getByLabel('Pedidos que lleva', { exact: true }), 'Ana · 16/10/26')
  await expect(flete.getByLabel('Costo asignado a Ana · 16/10/26')).toHaveValue('8000')
  await flete.getByRole('button', { name: 'Registrar flete' }).click()
  await expect(flete.getByText('✓ Flete de Interprovincial registrado (en preparación).')).toBeVisible()

  // En preparación la mercadería sigue en Bahía Blanca.
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '10', rosario: '0', camino: '6', comprometido: '12' })

  // 4. Sale el flete: deja Bahía Blanca y queda en camino. Ya no falta nada.
  await ir(page, 'Fletes')
  await page.getByRole('button', { name: 'Despachar flete de Interprovincial · 16/10/26' }).click()
  await expect(page.getByText('✓ Flete de Interprovincial · 16/10/26: en camino.')).toBeVisible()
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '4', rosario: '0', camino: '12', comprometido: '12' })
  await expect(kpi(page, 'Faltan para pedidos')).toContainText('0')

  // 5. Llegan los dos fletes a Rosario.
  await ir(page, 'Fletes')
  await page.getByRole('button', { name: 'Recibido flete de Interprovincial · 16/10/26' }).click()
  await expect(page.getByText('✓ Flete de Interprovincial · 16/10/26: finalizado.')).toBeVisible()
  await page.getByRole('button', { name: 'Recibido flete de Interprovincial · 08/10/26' }).click()
  await expect(page.getByText('✓ Flete de Interprovincial · 08/10/26: finalizado.')).toBeVisible()
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
  await filaPedido(page, 'Ana · 16/10/26').getByRole('button', { name: 'Entregar' }).click()
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
  await expect(entrega.getByText(/✓ Entrega a Ana registrada \(\$\s29\.000\)/)).toBeVisible()
  // La ganancia del pedido descuenta además el flete asignado: 12.260 − 8.000.
  await expect(filaPedido(page, 'Ana · 16/10/26')).toContainText('Parcial')
  await expect(filaPedido(page, 'Ana · 16/10/26')).toContainText(/4\.260/)

  // 8. Segunda entrega: 1 kg (el último que quedó en Rosario) con la comisión de la regla.
  await expect(entrega.getByLabel('Entregar Almendras')).toHaveValue('2')
  await entrega.getByLabel('Entregar Almendras').fill('1')
  await entrega.getByRole('button', { name: 'Registrar entrega' }).click()
  await expect(entrega.getByText(/✓ Entrega a Ana registrada \(\$\s2\.900\)/)).toBeVisible()

  // 9. El kilo que falta no se va a entregar: se cierra el pedido con pendientes.
  await entrega.getByRole('button', { name: 'Cerrar con pendientes' }).click()
  await expect(page.getByText('El pedido de Ana · 16/10/26 quedó cerrado.')).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Mostrar' }).getByText('Todos').click()
  // Entregado 31.900 − comisiones 1.943 − costo 11 × 1.500 − flete 8.000 = 5.457.
  await expect(filaPedido(page, 'Ana · 16/10/26')).toContainText('Cerrado')
  await expect(filaPedido(page, 'Ana · 16/10/26')).toContainText(/31\.900/)
  await expect(filaPedido(page, 'Ana · 16/10/26')).toContainText(/5\.457/)

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
    'Fletes': [['F0002', HOY_SERIE, 'C0004', 'BB', 'ROS', 8000, '', '']],
    'Fletes ítems': [['F0002', 'P001', 6]],
    'Fletes estados': [['F0002', AHORA, 'preparacion']],
    'Pedidos fletes': [['PE0003', 'F0002', 8000]],
  })
  expect(google.escrituras[5]).toEqual({ 'Ajustes': [[HOY_SERIE, 'ROS', 'P001', -1, 'Bolsa rota en flete F0002']] })
  expect(google.escrituras[6]).toEqual({
    'Ventas': [['V0002', HOY_SERIE, 'PE0003', 'ROS', '']],
    'Ventas ítems': [['V0002', 1, 1, 'P001', 10, 2900, 29000, 1500]],
    'Ventas comisiones': [['V0002', 1, 'VEN02', 7, 6, 1740]],
  })
  expect(google.escrituras[7]['Ventas comisiones']).toEqual([['V0003', 1, 'VEN02', 7, 7, 203]])
})

test('cambiar el precio de lista y la regla de comisión no toca los pedidos ya cargados', async ({ page, google }) => {
  // 1. Ana pide 5 kg de avena al precio de lista ($800).
  await elegirCliente(page, 'Ana')
  const pedido = formPedido(page)
  await pedido.getByLabel('Producto', { exact: true }).fill('Avena')
  await expect(pedido.getByLabel('Precio unitario', { exact: true })).toHaveValue('800')
  await pedido.getByLabel('Cantidad', { exact: true }).fill('5')
  await pedido.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(pedido.getByText(/✓ Pedido de Ana registrado/)).toBeVisible()

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
  await filaPedido(page, 'Ana · 16/10/26').getByRole('button', { name: 'Entregar' }).click()
  const entrega = formEntrega(page)
  await expect(entrega.getByText(/\$\s800 c\/u/)).toBeVisible()
  await expect(entrega.getByLabel('Comisión Guada/Hernán Avena')).toHaveValue('4')
  await expect(entrega.getByRole('group', { name: 'Importe' })).toContainText('4.000')
  await entrega.getByRole('button', { name: 'Registrar entrega' }).click()
  // Al quedar entregado todo, el panel se cierra y lo avisa.
  await expect(page.getByText('El pedido de Ana · 16/10/26 quedó entregado.')).toBeVisible()

  expect(google.escrituras.at(-1)).toEqual({
    'Ventas': [['V0002', HOY_SERIE, 'PE0003', 'ROS', '']],
    'Ventas ítems': [['V0002', 1, 1, 'P002', 5, 800, 4000, 500]],
    'Ventas comisiones': [['V0002', 1, 'VEN02', 4, 4, 160]],
  })
})

test('se compra un producto nuevo y se vende en el momento a un cliente que todavía no compró', async ({ page, google }) => {
  // 0. Bruno se agrega a mano en Contactos, sin localidad: el pedido no le propone vendedor y sale de Rosario,
  //    el último depósito de la lista.
  google.hojas.Contactos.push(['C0005', 'cliente', 'Bruno', 'Minorista', '', '', '', '', '', ''])
  await page.reload()

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

  // 2. Bruno compra 3 kg en el momento por medio de Leo. Las pasas no tienen precio de lista.
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
  await expect(pedido.getByText(/✓ Pedido de Bruno registrado y entregado/)).toBeVisible()

  expect(google.escrituras[1]).toEqual({
    'Pedidos': [['PE0003', HOY_SERIE, 'C0005', 'ROS', '']],
    'Pedidos ítems': [['PE0003', 1, 'P005', 3, '', 1800]],
    'Pedidos estados': [['PE0003', AHORA, 'abierto']],
    'Pedidos vendedores': [['PE0003', 'VEN01']],
    'Precios': [['P005', 1800, HOY_SERIE]],
    'Ventas': [['V0002', HOY_SERIE, 'PE0003', 'ROS', '']],
    'Ventas ítems': [['V0002', 1, 1, 'P005', 3, 1800, 5400, 1000]],
    // Leo cobra su 10% general.
    'Ventas comisiones': [['V0002', 1, 'VEN01', 10, 10, 540]],
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
  await expect(flete.getByText('✓ Flete de Expreso nuevo registrado (en preparación).')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar flete de Expreso nuevo · 16/10/26' }).click()
  await expect(page.getByText('✓ Flete de Expreso nuevo · 16/10/26: cancelado.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Despachar flete de Expreso nuevo · 16/10/26' })).toBeHidden()

  // 2. El flete que estaba en camino vuelve sin entregar: los 6 kg regresan a Bahía Blanca.
  await page.getByRole('button', { name: 'Volvió sin entregar flete de Interprovincial · 08/10/26' }).click()
  await expect(page.getByText('✓ Flete de Interprovincial · 08/10/26: en preparación.')).toBeVisible()
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '16', rosario: '0', camino: '–', comprometido: '–' })

  // 3. Sale de nuevo y esta vez llega.
  await ir(page, 'Fletes')
  await page.getByRole('button', { name: 'Despachar flete de Interprovincial · 08/10/26' }).click()
  await expect(page.getByText('✓ Flete de Interprovincial · 08/10/26: en camino.')).toBeVisible()
  await page.getByRole('button', { name: 'Recibido flete de Interprovincial · 08/10/26' }).click()
  await expect(page.getByText('✓ Flete de Interprovincial · 08/10/26: finalizado.')).toBeVisible()
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
  // 1. Ana pide 40 kg de avena en Rosario: hay 25 y ya hay 10 comprometidos con el pedido de Ana del 10/10.
  await elegirCliente(page, 'Ana')
  const pedido = formPedido(page)
  await pedido.getByLabel('Producto', { exact: true }).fill('Avena')
  await pedido.getByLabel('Cantidad', { exact: true }).fill('40')
  await expect(pedido.getByText(/Disponible en Rosario: 15 kg — falta stock/)).toBeVisible()
  await pedido.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(pedido.getByText(/✓ Pedido de Ana registrado/)).toBeVisible()
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
  await compra.getByLabel('Para el pedido', { exact: true }).selectOption({ label: 'Ana · 16/10/26' })
  await compra.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(compra.getByText('✓ Compra a Prov B registrada (1 producto).')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Para el pedido de Ana · 16/10/26' })).toContainText('Avena')

  // 3. Ya no falta nada.
  await ir(page, 'Stock')
  await esperarStock(page, 'Avena', { general: '0', rosario: '55', camino: '–', comprometido: '50' })
  await expect(kpi(page, 'Faltan para pedidos')).toContainText('0')
  await ir(page, 'Pedidos')
  await expect(kpi(page, 'Con faltante de stock')).toContainText('0')
})

test.describe('desde el celular', () => {
  // Corre en los dos proyectos, siempre con la pantalla de un Pixel 7.
  const { defaultBrowserType: _navegador, ...pixel7 } = devices['Pixel 7']
  test.use(pixel7)

  test('Leo toma un pedido de un cliente de Bahía Blanca y lo entrega en el momento', async ({ page, google }) => {
    google.hojas.Contactos.push(['C0005', 'cliente', 'Bruno', 'Minorista', '', '', '', 'Bahía Blanca', 'Buenos Aires', ''])
    await page.reload()

    // 1. Llega a Pedidos con la barra inferior; la página no se desborda a lo ancho.
    await ir(page, 'Stock')
    await ir(page, 'Pedidos')
    await expect(page.getByRole('navigation', { name: 'Pantalla' }).getByRole('button', { name: 'Pedidos' }))
      .toHaveAttribute('aria-current', 'page')
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(desborde).toBeLessThanOrEqual(0)

    // 2. Bruno pide 2 kg de almendras. Es de Bahía Blanca, como Leo y el depósito General: el pedido los
    //    propone a los dos.
    const pedido = formPedido(page)
    await elegirCliente(page, 'Bruno')
    await expect(pedido.getByLabel('Entrega desde', { exact: true })).toHaveValue('BB')
    await expect(pedido.getByText('Leo')).toBeVisible()
    await pedido.getByLabel('Producto', { exact: true }).fill('Almendras')
    await pedido.getByLabel('Cantidad', { exact: true }).fill('2')
    await expect(pedido.getByLabel('Precio unitario', { exact: true })).toHaveValue('3000')
    await pedido.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(pedido.getByText(/✓ Pedido de Bruno registrado \(1 producto, \$\s6\.000\)\./)).toBeVisible()
    expect(Object.keys(google.escrituras[0])).not.toContain('Contactos')
    expect(google.escrituras[0]).toMatchObject({
      'Pedidos': [['PE0003', HOY_SERIE, 'C0005', 'BB', '']],
      'Pedidos vendedores': [['PE0003', 'VEN01']],
    })

    // 3. En la lista compacta ve el pedido con su estado; al tocar Entregar, el formulario sube a la vista.
    const fila = filaPedido(page, 'Bruno · 16/10/26')
    await expect(fila).toContainText('2 Almendras')
    await expect(fila.getByText('Pendiente').filter({ visible: true })).toBeVisible()
    await fila.getByRole('button', { name: 'Entregar' }).click()
    const entrega = formEntrega(page)
    await expect(entrega.getByLabel('Entregar Almendras')).toBeInViewport()
    await expect(entrega.getByRole('group', { name: 'Comisión' })).toContainText('600')
    await entrega.getByRole('button', { name: 'Registrar entrega' }).click()
    // Era todo lo pendiente: el pedido queda entregado y sale de la lista de abiertos.
    await expect(page.getByText('El pedido de Bruno · 16/10/26 quedó entregado.')).toBeVisible()
    await expect(fila).toBeHidden()
    expect(google.escrituras[1]).toEqual({
      'Ventas': [['V0002', HOY_SERIE, 'PE0003', 'BB', '']],
      'Ventas ítems': [['V0002', 1, 1, 'P001', 2, 3000, 6000, 1500]],
      'Ventas comisiones': [['V0002', 1, 'VEN01', 10, 10, 600]],
    })
  })
})

test('desde Inicio se toma un pedido sin stock y queda destacado entre los pendientes', async ({ page }) => {
  // 1. Inicio muestra lo pendiente: el pedido de avena de Ana y el flete de Interprovincial en camino a Rosario.
  await ir(page, 'Inicio')
  const pendientes = page.getByRole('region', { name: 'Pedidos pendientes' })
  const fletes = page.getByRole('region', { name: 'Fletes en curso' })
  await expect(pendientes.getByRole('article')).toHaveCount(1)
  await expect(pendientes.getByRole('article', { name: 'Pedido Ana · 10/10/26' })).toContainText('10 Avena')
  await expect(fletes.getByRole('article', { name: 'Flete Interprovincial · 08/10/26' })).toContainText('En camino')
  await expect(kpi(page, 'Con faltante de stock')).toContainText('0')

  // 2. Llama un cliente: el acceso directo lleva al formulario con el cursor en "Cliente".
  await page.getByRole('button', { name: 'Tomar pedido nuevo' }).click()
  await expect(page).toHaveURL(/#pedidos$/)
  await expect(formPedido(page).getByLabel('Cliente', { exact: true })).toBeFocused()
  await elegirCliente(page, 'Ana')
  const pedido = formPedido(page)
  await pedido.getByLabel('Producto', { exact: true }).fill('Almendras')
  await pedido.getByLabel('Cantidad', { exact: true }).fill('12')
  await pedido.getByLabel('Precio unitario', { exact: true }).fill('3000')
  await pedido.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(pedido.getByText(/✓ Pedido de Ana registrado/)).toBeVisible()

  // 3. De vuelta en Inicio el pedido nuevo aparece destacado: en Rosario hay 0 kg y vienen 6 en camino.
  await ir(page, 'Inicio')
  await expect(kpi(page, 'Pedidos pendientes')).toContainText('2')
  await expect(kpi(page, 'Con faltante de stock')).toContainText('1')
  const nuevo = pendientes.getByRole('article', { name: 'Pedido Ana · 16/10/26' })
  await expect(nuevo).toContainText('Falta stock de Almendras')
  await expect(pendientes.getByRole('article', { name: 'Pedido Ana · 10/10/26' })).not.toContainText('Falta stock')

  // 4. Se despacha un flete con los 6 kg que faltan y el pedido deja de estar en falta.
  await page.getByRole('button', { name: 'Ver fletes' }).click()
  const flete = formFlete(page)
  await flete.getByLabel('Transporte', { exact: true }).fill('Interprovincial')
  await flete.getByLabel('Producto', { exact: true }).fill('Almendras')
  await flete.getByLabel('Cantidad', { exact: true }).fill('6')
  await flete.getByRole('radiogroup', { name: 'Estado inicial' }).getByText('En camino').click()
  await flete.getByRole('button', { name: 'Registrar flete' }).click()
  await expect(flete.getByText('✓ Flete de Interprovincial registrado (en camino).')).toBeVisible()

  await ir(page, 'Inicio')
  await expect(fletes.getByRole('article')).toHaveCount(2)
  await expect(kpi(page, 'Fletes en camino')).toContainText('2')
  await expect(kpi(page, 'Con faltante de stock')).toContainText('0')
  await expect(nuevo).not.toContainText('Falta stock')
})

test('Guada/Hernán cobra en efectivo, rinde una parte y Sampatti le paga la comisión de una venta que cobró por transferencia', async ({ page, google }) => {
  const cuenta = page.getByRole('region', { name: 'Cuenta de Guada/Hernán' })
  const rendicion = page.getByRole('form', { name: 'Rendición entre socios' })
  const aCobrar = page.getByRole('table', { name: 'Ventas a cobrar' })

  // 1. Guada/Hernán entrega los 10 kg de avena del pedido de Ana del 10/10 ($ 8.000) y cobra todo en efectivo en la entrega.
  await filaPedido(page, 'Ana · 10/10/26').getByRole('button', { name: 'Entregar' }).click()
  const entrega = formEntrega(page)
  await expect(entrega.getByRole('group', { name: 'Comisión' })).toContainText('240')
  await expect(entrega.getByLabel('Recibió', { exact: true })).toHaveValue('SOC02')
  await expect(entrega.getByLabel('Medio', { exact: true })).toHaveValue('efectivo')
  await entrega.getByLabel('Cobrado en la entrega', { exact: true }).fill('8000')
  await entrega.getByRole('button', { name: 'Registrar entrega' }).click()
  await expect(page.getByText('El pedido de Ana · 10/10/26 quedó entregado.')).toBeVisible()

  // 2. Tiene $ 8.000 de Sampatti y $ 240 son su comisión: le debe $ 7.760.
  await ir(page, 'Caja')
  await expect(kpi(page, 'Saldo Guada/Hernán')).toContainText(/Debe \$\s7\.760/)
  await expect(cuenta).toContainText(/Guada\/Hernán le debe \$\s7\.760 a Sampatti/)
  await expect(cuenta.getByRole('row').filter({ hasText: 'Cobro de la venta a Ana · 16/10/26' })).toContainText('Efectivo')
  await expect(aCobrar.getByRole('row', { name: 'Venta a Ana · 16/10/26' })).toHaveCount(0)

  // 3. Le rinde $ 7.000 en efectivo a Sampatti: le quedan $ 760 por rendir.
  await expect(rendicion.getByLabel('Sentido', { exact: true })).toHaveValue('al-duenio')
  await expect(rendicion.getByLabel('Importe', { exact: true })).toHaveValue('7760')
  await rendicion.getByLabel('Importe', { exact: true }).fill('7000')
  await rendicion.getByRole('button', { name: 'Registrar rendición' }).click()
  await expect(rendicion.getByText(/✓ Guada\/Hernán le entregó \$\s7\.000 a Sampatti/)).toBeVisible()
  await expect(cuenta).toContainText(/Guada\/Hernán le debe \$\s760 a Sampatti/)

  // 4. Guada/Hernán vende en el momento 5 kg de almendras desde Bahía Blanca ($ 15.000, comisión 7% = $ 1.050).
  await ir(page, 'Pedidos')
  await elegirCliente(page, 'Ana')
  const pedido = formPedido(page)
  await expect(pedido.getByText('Guada/Hernán')).toBeVisible()
  await pedido.getByLabel('Entrega desde', { exact: true }).selectOption({ label: 'General' })
  await pedido.getByLabel('Producto', { exact: true }).fill('Almendras')
  await pedido.getByLabel('Cantidad', { exact: true }).fill('5')
  await pedido.getByLabel('Se entrega ahora (venta directa)').check()
  await pedido.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(pedido.getByText(/✓ Pedido de Ana registrado y entregado/)).toBeVisible()

  // 5. La cobra Sampatti por transferencia. La comisión es de Guada/Hernán: Sampatti le debe 1.050 − 760 = $ 290.
  await ir(page, 'Caja')
  await aCobrar.getByRole('button', { name: 'Cobrar venta a Ana · 16/10/26' }).click()
  const cobro = page.getByRole('form', { name: 'Registrar cobro' })
  await expect(cobro.getByLabel('Venta', { exact: true })).toHaveValue('V0003')
  await expect(cobro.getByLabel('Importe', { exact: true })).toHaveValue('15000')
  await cobro.getByLabel('Medio', { exact: true }).selectOption({ label: 'Transferencia' })
  await cobro.getByLabel('Recibió', { exact: true }).selectOption({ label: 'Sampatti' })
  await cobro.getByRole('button', { name: 'Registrar cobro' }).click()
  await expect(cobro.getByText(/✓ Cobro de \$\s15\.000 de la venta a Ana · 16\/10\/26 registrado \(transferencia, Sampatti\)/)).toBeVisible()
  await expect(aCobrar.getByRole('row', { name: 'Venta a Ana · 16/10/26' })).toHaveCount(0)
  await expect(kpi(page, 'Saldo Guada/Hernán')).toContainText(/Le deben \$\s290/)
  await expect(cuenta).toContainText(/Sampatti le debe \$\s290 a Guada\/Hernán/)

  // 6. Sampatti le paga lo que le debe y quedan al día.
  await expect(rendicion.getByLabel('Sentido', { exact: true })).toHaveValue('del-duenio')
  await expect(rendicion.getByLabel('Importe', { exact: true })).toHaveValue('290')
  await rendicion.getByLabel('Medio', { exact: true }).selectOption({ label: 'Transferencia' })
  await rendicion.getByRole('button', { name: 'Registrar rendición' }).click()
  await expect(cuenta).toContainText('Guada/Hernán y Sampatti están al día.')

  // La entrega y su cobro se guardaron juntos; cada cobro y cada rendición, en una escritura.
  expect(google.escrituras).toHaveLength(5)
  expect(google.escrituras[0]).toEqual({
    'Ventas': [['V0002', HOY_SERIE, 'PE0002', 'ROS', '']],
    'Ventas ítems': [['V0002', 1, 1, 'P002', 10, 800, 8000, 500]],
    'Ventas comisiones': [['V0002', 1, 'VEN02', 3, 3, 240]],
    'Cobros': [[HOY_SERIE, 'V0002', 8000, 'efectivo', 'SOC02', '']],
  })
  expect(google.escrituras[1]).toEqual({ 'Rendiciones': [[HOY_SERIE, 'SOC02', 'SOC01', 7000, 'efectivo', '']] })
  expect(google.escrituras[2]['Ventas comisiones']).toEqual([['V0003', 1, 'VEN02', 7, 7, 1050]])
  expect(google.escrituras[3]).toEqual({ 'Cobros': [[HOY_SERIE, 'V0003', 15000, 'transferencia', 'SOC01', '']] })
  expect(google.escrituras[4]).toEqual({ 'Rendiciones': [[HOY_SERIE, 'SOC01', 'SOC02', 290, 'transferencia', '']] })
})

test('corregir en la planilla el nombre de un cliente y de un producto cambia todas las pantallas', async ({ page, google }) => {
  // 1. El pedido del 10/10 es de Ana y pide Avena.
  await expect(filaPedido(page, 'Ana · 10/10/26')).toContainText('Ana')
  await expect(filaPedido(page, 'Ana · 10/10/26')).toContainText('Avena')

  // 2. Se corrigen a mano los nombres en Contactos y Productos. Pedidos, ventas y fletes guardan solo los
  //    IDs (C0001, P002), así que no hay nada más que tocar.
  google.hojas.Contactos[0][2] = 'Ana María'
  google.hojas.Productos[1][1] = 'Avena arrollada'
  await page.reload()

  // 3. Pedidos, Inicio y Ventas muestran los nombres nuevos.
  await expect(filaPedido(page, 'Ana María · 10/10/26')).toContainText('Avena arrollada')
  await ir(page, 'Inicio')
  const pendiente = page.getByRole('article', { name: 'Pedido Ana María · 10/10/26' })
  await expect(pendiente).toContainText('Ana María')
  await expect(pendiente).toContainText('Avena arrollada')
  await ir(page, 'Ventas')
  await expect(filaCon(page, 'Ana María')).toContainText('Almendras')

  // 4. Un pedido nuevo de Ana María usa su contacto: muestra la localidad de Contactos y no agrega otro contacto.
  await ir(page, 'Pedidos')
  await elegirCliente(page, 'Ana María')
  const pedido = formPedido(page)
  await expect(pedido.getByText('Funes, Santa Fe')).toBeVisible()
  await pedido.getByLabel('Producto', { exact: true }).fill('Avena arrollada')
  await pedido.getByLabel('Cantidad', { exact: true }).fill('2')
  await pedido.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(pedido.getByText(/✓ Pedido de Ana María registrado/)).toBeVisible()

  expect(Object.keys(google.escrituras[0])).not.toContain('Contactos')
  expect(google.escrituras[0].Pedidos).toEqual([['PE0003', HOY_SERIE, 'C0001', 'ROS', '']])
  expect(google.escrituras[0]['Pedidos ítems']).toEqual([['PE0003', 1, 'P002', 2, 800, 800]])
})

test('llegan las almendras a Rosario, se arma la receta del mix europeo y se fabrica con más merma de la prevista', async ({ page, google }) => {
  // 1. Llega el flete F0001: Rosario queda con 6 kg de almendras y 25 de avena.
  await ir(page, 'Fletes')
  await page.getByRole('button', { name: 'Recibido flete de Interprovincial · 08/10/26' }).click()
  await expect(page.getByText('✓ Flete de Interprovincial · 08/10/26: finalizado.')).toBeVisible()

  // 2. Receta del mix europeo (ya está en Productos, con precio de lista), cargada en gramos: 600 g de almendras y 400 de avena por tanda.
  //    Sin merma saldría 1 kg; se estima un 5 %: salen 950 g.
  await ir(page, 'Recetas')
  const receta = page.getByRole('form', { name: 'Receta' })
  await receta.getByLabel('Producto que sale').fill('Mix europeo')
  await expect(receta.getByText(/Precio de lista: \$\s2\.500 por kg/)).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Cantidades en' }).getByText('g', { exact: true }).click()
  await receta.getByLabel('Producto', { exact: true }).fill('Almendras')
  await receta.getByLabel('Cantidad', { exact: true }).fill('600')
  await receta.getByRole('button', { name: '+ Agregar producto' }).click()
  await receta.getByLabel('Producto', { exact: true }).nth(1).fill('Avena')
  await receta.getByLabel('Cantidad', { exact: true }).nth(1).fill('400')
  await receta.getByLabel('Sale por tanda').fill('950')
  await receta.getByRole('button', { name: 'Guardar receta' }).click()
  await expect(receta.getByText('✓ Receta de Mix europeo guardada.')).toBeVisible()

  // 3. Se fabrican 2 tandas en Rosario: usa 1,2 kg de almendras y 0,8 de avena. Se esperaban 1,9 kg pero salen 1,85
  //    (7,5 % de merma). Los insumos cuestan 1,2 × $1.500 + 0,8 × $500 = $2.200 / 1,85 kg = $1.189,19 el kg.
  const fabricar = page.getByRole('form', { name: 'Fabricar' })
  await fabricar.getByLabel('Depósito').selectOption('Rosario')
  await fabricar.getByLabel('Tandas').fill('2')
  await expect(fabricar.getByLabel('Salió')).toHaveAttribute('placeholder', '1,9')
  const insumos = fabricar.getByRole('table', { name: 'Insumos a descontar' })
  await expect(insumos.getByRole('row', { name: /Almendras/ })).toContainText('1,2 kg')
  await expect(insumos.getByRole('row', { name: /Almendras/ })).toContainText('6')
  await fabricar.getByLabel('Salió').fill('1.85')
  await expect(fabricar.getByText(/Merma: 7,5 % · Insumos: \$\s1\.189 por kg/)).toBeVisible()
  await fabricar.getByRole('button', { name: 'Registrar fabricación' }).click()
  await expect(fabricar.getByText('✓ Fabricado: 1,85 kg de Mix europeo en Rosario.')).toBeVisible()

  // Una sola escritura con los ajustes que mueven el stock; el motivo dice qué receta y versión se usó.
  expect(google.escrituras.at(-1)).toEqual({
    'Ajustes': [
      [HOY_SERIE, 'ROS', 'P001', -1.2, 'Fabricación FA0001 (RE0001 v1)'],
      [HOY_SERIE, 'ROS', 'P002', -0.8, 'Fabricación FA0001 (RE0001 v1)'],
      [HOY_SERIE, 'ROS', 'P004', 1.85, 'Fabricación FA0001 (RE0001 v1)'],
    ],
  })
  await expect(page.getByRole('table', { name: 'Últimas fabricaciones' })).toContainText('Versión 1')

  // 4. Stock en Rosario: 6 − 1,2 = 4,8 kg de almendras; 25 − 0,8 = 24,2 de avena; 1,85 de mix.
  await ir(page, 'Stock')
  await esperarStock(page, 'Almendras', { general: '10', rosario: '4,8', camino: '–', comprometido: '–' })
  await esperarStock(page, 'Avena', { general: '0', rosario: '24,2', camino: '–', comprometido: '10' })
  await esperarStock(page, 'Mix europeo', { general: '0', rosario: '1,85', camino: '–', comprometido: '–' })
})
