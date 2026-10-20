import type { Page } from '@playwright/test'
import { AHORA, confirmarEntrega, expect, HOY_SERIE, serie, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#pedidos')
  await ingresar()
})

const formPedido = (page: Page) => page.getByRole('form', { name: 'Nuevo pedido' })
const entrega = (page: Page) => page.getByRole('form', { name: 'Registrar entrega' })
// Las filas se nombran por cliente y fecha: PE0001 es "Ana · 05/10/26" y PE0002, "Ana · 10/10/26".
const filaPedido = (page: Page, pedido: string) => page.getByRole('row', { name: `Pedido ${pedido}`, exact: true })

test('KPIs y lista de pedidos abiertos', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Pedidos abiertos' })).toContainText('1')
  await expect(page.getByRole('group', { name: 'Pendiente de entregar' })).toContainText('8.000')
  await expect(filaPedido(page, 'Ana · 10/10/26')).toContainText('Pendiente')
  await expect(filaPedido(page, 'Ana · 05/10/26')).toBeHidden()

  await page.getByRole('radiogroup', { name: 'Mostrar' }).getByText('Todos').click()
  await expect(filaPedido(page, 'Ana · 05/10/26')).toContainText('Entregado')
})

test('registra un pedido con un precio especial y un producto sin precio de lista', async ({ page, google }) => {
  const form = formPedido(page)
  const cliente = form.getByLabel('Cliente', { exact: true })
  await cliente.fill('Ana')
  await cliente.blur()
  // Muestra la localidad del contacto y propone los vendedores de su último pedido.
  await expect(form.getByText('Funes, Santa Fe')).toBeVisible()
  await expect(form.getByText('Guada/Hernán')).toBeVisible()

  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  // Propone el precio de lista; se puede sobreescribir.
  await expect(form.getByLabel('Precio unitario', { exact: true })).toHaveValue('3000')
  await form.getByLabel('Cantidad', { exact: true }).fill('2')
  await form.getByLabel('Precio unitario', { exact: true }).fill('2800')
  await expect(form.getByText(/Precio especial \(lista \$\s3\.000\)/)).toBeVisible()

  await form.getByRole('button', { name: '+ Agregar producto' }).click()
  await form.getByLabel('Producto', { exact: true }).nth(1).fill('Miel')
  await expect(form.getByText('Sin precio de lista: se agrega con este precio')).toBeVisible()
  await form.getByLabel('Cantidad', { exact: true }).nth(1).fill('1')
  await form.getByLabel('Precio unitario', { exact: true }).nth(1).fill('500')

  await expect(form.getByRole('group', { name: 'Total del pedido' })).toContainText('6.100')
  await expect(form.getByRole('group', { name: 'Precios especiales' })).toContainText('1')
  await form.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(form.getByText(/✓ Pedido de Ana registrado \(2 productos, \$\s6\.100\)\./)).toBeVisible()

  expect(google.escrituras).toEqual([{
    'Pedidos': [['PE0003', HOY_SERIE, 'C0001', 'ROS', '']],
    'Pedidos ítems': [
      ['PE0003', 1, 'P001', 2, 3000, 2800],
      ['PE0003', 2, 'P003', 1, '', 500],
    ],
    'Pedidos estados': [['PE0003', AHORA, 'abierto']],
    'Pedidos vendedores': [['PE0003', 'VEN02']],
    'Precios': [['P003', 500, HOY_SERIE]],
  }])
  await expect(filaPedido(page, 'Ana · 16/10/26')).toContainText('Pendiente')
})

test('venta directa: crea el pedido y la entrega juntos', async ({ page, google }) => {
  const form = formPedido(page)
  await form.getByLabel('Cliente', { exact: true }).fill('Ana')
  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByLabel('Cantidad', { exact: true }).fill('1')
  await form.getByLabel('Se entrega ahora (venta directa)').check()
  await form.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(form.getByText(/✓ Pedido de Ana registrado y entregado/)).toBeVisible()

  expect(google.escrituras).toHaveLength(1)
  expect(google.escrituras[0]).toMatchObject({
    'Pedidos': [['PE0003', HOY_SERIE, 'C0001', 'ROS', '']],
    'Ventas': [['V0002', HOY_SERIE, 'PE0003', 'ROS', '']],
    'Ventas ítems': [['V0002', 1, 1, 'P001', 1, 3000, 3000, 1500]],
  })
  await page.getByRole('radiogroup', { name: 'Mostrar' }).getByText('Todos').click()
  await expect(filaPedido(page, 'Ana · 16/10/26')).toContainText('Entregado')
})

test('un cliente que no está en la lista se da de alta sin salir del pedido', async ({ page, google }) => {
  const form = formPedido(page)
  await form.getByLabel('Entrega desde', { exact: true }).selectOption({ label: 'General' })
  await form.getByLabel('Cliente', { exact: true }).fill('Bruno')
  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByLabel('Cantidad', { exact: true }).fill('1')
  await form.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(form.getByText('Bruno no está en la lista de clientes. Tocá "Dar de alta" para agregarlo.')).toBeVisible()
  expect(google.escrituras).toEqual([])

  // El alta trae el nombre escrito en el pedido. Bruno es de Rosario, como Guada/Hernán y el depósito de Rosario.
  await form.getByRole('button', { name: 'Dar de alta' }).click()
  const alta = page.getByRole('dialog', { name: 'Nuevo cliente' })
  await expect(alta.getByLabel('Nombre', { exact: true })).toHaveValue('Bruno')
  await alta.getByLabel('Tipo de cliente').selectOption('Revendedor')
  await alta.getByLabel('Localidad', { exact: true }).fill('Rosario')
  await alta.getByLabel('Provincia', { exact: true }).fill('Santa Fe')
  await alta.getByRole('button', { name: 'Dar de alta' }).click()
  await expect(alta).toBeHidden()
  expect(google.escrituras).toEqual([
    { 'Contactos': [['C0005', 'cliente', 'Bruno', 'Revendedor', '', '', '', 'Rosario', 'Santa Fe', '']] },
  ])

  // Ya es cliente: se le proponen vendedor y depósito de su localidad, y el pedido se registra.
  await expect(form.getByText('Rosario, Santa Fe')).toBeVisible()
  await expect(form.getByLabel('Entrega desde', { exact: true })).toHaveValue('ROS')
  await expect(form.getByText('Guada/Hernán')).toBeVisible()
  await form.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(form.getByText(/✓ Pedido de Bruno registrado/)).toBeVisible()
  expect(google.escrituras[1].Pedidos).toEqual([['PE0003', HOY_SERIE, 'C0005', 'ROS', '']])
})

test('propone el vendedor y el depósito de la localidad del cliente', async ({ page, google }) => {
  // Carla es de Rosario, como Guada/Hernán y el depósito de Rosario, y nunca pidió nada.
  google.hojas.Contactos.push(['C0005', 'cliente', 'Carla', 'Minorista', '', '', '', 'Rosario', 'Santa Fe', ''])
  await page.reload()
  const form = formPedido(page)
  await form.getByLabel('Entrega desde', { exact: true }).selectOption({ label: 'General' })
  const cliente = form.getByLabel('Cliente', { exact: true })
  await cliente.fill('Carla')
  await cliente.blur()
  await expect(form.getByText('Rosario, Santa Fe')).toBeVisible()
  await expect(form.getByLabel('Entrega desde', { exact: true })).toHaveValue('ROS')
  await expect(form.getByText('Guada/Hernán')).toBeVisible()
  await expect(form.getByText('Leo')).toBeHidden()

  // Lo propuesto se puede cambiar y no se vuelve a proponer al salir del campo Cliente.
  await form.getByLabel('Entrega desde', { exact: true }).selectOption({ label: 'General' })
  await cliente.focus()
  await cliente.blur()
  await expect(form.getByLabel('Entrega desde', { exact: true })).toHaveValue('BB')
})

test('entrega parcial con la comisión sobreescrita', async ({ page, google }) => {
  await filaPedido(page, 'Ana · 10/10/26').getByRole('button', { name: 'Entregar' }).click()
  const form = entrega(page)
  await expect(form.getByText('Stock en Rosario: 25')).toBeVisible()
  const comision = form.getByLabel('Comisión Guada/Hernán Avena')
  // Propone la regla general de Guada/Hernán.
  await expect(comision).toHaveValue('3')

  await form.getByLabel('Entregar Avena').fill('4')
  await comision.fill('5')
  await expect(form.getByText('Guada/Hernán (regla 3%)')).toBeVisible()
  await expect(form.getByRole('group', { name: 'Importe' })).toContainText('3.200')
  await expect(form.getByRole('group', { name: 'Comisión' })).toContainText('160')
  // 3.200 − 160 − 4 × 500 de costo.
  await expect(form.getByRole('group', { name: 'Ganancia' })).toContainText('1.040')

  await form.getByRole('button', { name: 'Registrar entrega' }).click()

  await confirmarEntrega(page)
  await expect(form.getByText(/✓ Entrega a Ana registrada/)).toBeVisible()
  expect(google.escrituras).toEqual([{
    'Ventas': [['V0002', HOY_SERIE, 'PE0002', 'ROS', '']],
    'Ventas ítems': [['V0002', 1, 1, 'P002', 4, 800, 3200, 500]],
    'Ventas comisiones': [['V0002', 1, 'VEN02', 3, 5, 160]],
  }])
  await expect(filaPedido(page, 'Ana · 10/10/26')).toContainText('Parcial')
  // Después de la entrega propone lo que queda pendiente.
  await expect(form.getByLabel('Entregar Avena')).toHaveValue('6')
})

test('no deja entregar más de lo pendiente', async ({ page }) => {
  await filaPedido(page, 'Ana · 10/10/26').getByRole('button', { name: 'Entregar' }).click()
  const cantidad = entrega(page).getByLabel('Entregar Avena')
  await cantidad.fill('11')
  await cantidad.blur()
  await expect(cantidad).toHaveValue('10')
})

test('cancela un pedido sin entregas', async ({ page, google }) => {
  await filaPedido(page, 'Ana · 10/10/26').getByRole('button', { name: 'Entregar' }).click()
  await entrega(page).getByRole('button', { name: 'Cancelar pedido' }).click()
  await expect(page.getByText('El pedido de Ana · 10/10/26 quedó cancelado.')).toBeVisible()
  expect(google.escrituras).toEqual([{ 'Pedidos estados': [['PE0002', AHORA, 'cancelado']] }])
  await expect(filaPedido(page, 'Ana · 10/10/26')).toBeHidden()
})

test('corrige un pedido sin entregas desde su ficha: reemplaza sus filas', async ({ page, google }) => {
  await filaPedido(page, 'Ana · 10/10/26').getByRole('button', { name: 'Ana' }).click()
  const ficha = page.getByRole('dialog', { name: 'Pedido de Ana · 10/10/26' })
  await ficha.getByRole('button', { name: 'Corregir pedido' }).click()

  // Eran 10 kg de avena desde Rosario: son 12 a $ 750 desde General, más 2 kg de almendras a precio de lista.
  const form = ficha.getByRole('form', { name: 'Corregir pedido' })
  await expect(form.getByText('entregas ya registradas')).toBeHidden()
  await form.getByLabel('Entrega desde', { exact: true }).selectOption({ label: 'General' })
  await form.getByLabel('Cantidad', { exact: true }).fill('12')
  await form.getByLabel('Precio unitario', { exact: true }).fill('750')
  await form.getByRole('button', { name: '+ Agregar producto' }).click()
  await form.getByLabel('Producto', { exact: true }).nth(1).fill('Almendras')
  await form.getByLabel('Cantidad', { exact: true }).nth(1).fill('2')
  await form.getByRole('button', { name: 'Guardar cambios' }).click()

  await expect(ficha.getByText('✓ Pedido de Ana corregido.')).toBeVisible()
  await expect(ficha.getByRole('group', { name: 'Entrega desde' })).toHaveText(/General/)
  // La cabecera se reemplaza en el lugar; los ítems y vendedores se borran y se vuelven a agregar, en un solo batchUpdate.
  expect(google.reemplazos).toEqual([{ hoja: 'Pedidos', fila: 3, valores: ['PE0002', serie('2026-10-10'), 'C0001', 'BB', ''] }])
  expect(google.borrados).toEqual([
    { hoja: 'Pedidos ítems', fila: 3, valores: ['PE0002', 1, 'P002', 10, 800, 800] },
    { hoja: 'Pedidos vendedores', fila: 3, valores: ['PE0002', 'VEN02'] },
  ])
  expect(google.escrituras).toEqual([{
    'Pedidos ítems': [['PE0002', 1, 'P002', 12, 800, 750], ['PE0002', 2, 'P001', 2, 3000, 3000]],
    'Pedidos vendedores': [['PE0002', 'VEN02']],
  }])
})

test('no deja corregir un pedido por debajo de lo ya entregado', async ({ page, google }) => {
  await page.getByRole('radiogroup', { name: 'Mostrar' }).getByText('Todos').click()
  await filaPedido(page, 'Ana · 05/10/26').getByRole('button', { name: 'Ana' }).click()
  const ficha = page.getByRole('dialog', { name: 'Pedido de Ana · 05/10/26' })
  await ficha.getByRole('button', { name: 'Corregir pedido' }).click()

  const form = ficha.getByRole('form', { name: 'Corregir pedido' })
  await expect(form.getByText('Ya entregado: 4 Almendras.')).toBeVisible()
  await expect(form.getByText(/La entrega ya registrada se corrige también/)).toBeVisible()
  await form.getByLabel('Cantidad', { exact: true }).fill('3')
  await form.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(form.getByText('La cantidad no puede ser menor que lo ya entregado.')).toBeVisible()
  expect(google.reemplazos).toEqual([])
})

test('registrar una entrega pide confirmar: con "Volver" no se guarda nada', async ({ page, google }) => {
  await filaPedido(page, 'Ana · 10/10/26').getByRole('button', { name: 'Entregar' }).click()
  await entrega(page).getByRole('button', { name: 'Registrar entrega' }).click()

  // 10 kg de avena a $ 800 = $ 8.000, desde Rosario.
  const confirmacion = page.getByRole('dialog', { name: '¿Registrar la entrega?' })
  await expect(confirmacion).toContainText('A Ana, desde Rosario, el 16/10/26:')
  await expect(confirmacion).toContainText(/10 Avena · \$\s8\.000/)
  await expect(confirmacion).toContainText('descuenta el stock de Rosario')
  await confirmacion.getByRole('button', { name: 'Volver' }).click()
  await expect(confirmacion).toBeHidden()
  expect(google.escrituras).toEqual([])
  await expect(filaPedido(page, 'Ana · 10/10/26')).toContainText('Pendiente')
})
