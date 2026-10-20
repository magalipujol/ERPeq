// Contactos y productos: alta en su pantalla y corrección desde la ficha, que reemplaza la fila en la planilla.
import { expect, HOY_SERIE, ir, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#contactos')
  await ingresar()
})

test('da de alta un proveedor y no deja repetir el nombre', async ({ page, google }) => {
  // El alta arranca con el rol que se está mirando en la lista.
  await page.getByLabel('Mostrar contactos').selectOption({ label: 'Proveedores' })
  await page.getByRole('button', { name: 'Nuevo contacto' }).click()
  const form = page.getByRole('dialog', { name: 'Nuevo contacto' }).getByRole('form', { name: 'Nuevo contacto' })
  await expect(form.getByLabel('Es', { exact: true })).toHaveValue('proveedor')
  await expect(form.getByLabel('Tipo de cliente')).toHaveCount(0)
  await form.getByLabel('Nombre', { exact: true }).fill('prov a')
  await form.getByRole('button', { name: 'Dar de alta' }).click()
  await expect(form.getByText('Ya hay un proveedor que se llama Prov A.')).toBeVisible()

  await form.getByLabel('Nombre', { exact: true }).fill('Granos del Sur')
  await form.getByLabel('Teléfono', { exact: true }).fill('291 444 5555')
  await form.getByRole('button', { name: 'Dar de alta' }).click()
  // El modal se cierra y el aviso queda sobre la lista, donde ya aparece el proveedor.
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('✓ Proveedor Granos del Sur dado de alta.')).toBeVisible()
  expect(google.escrituras).toEqual([
    { 'Contactos': [['C0005', 'proveedor', 'Granos del Sur', '', '291 444 5555', '', '', '', '', '']] },
  ])
  await expect(page.getByRole('table', { name: 'Lista de contactos' })).toContainText('Granos del Sur')
})

test('corrige un cliente desde su ficha: reemplaza su fila y no deja cambiarle el rol si tiene pedidos', async ({ page, google }) => {
  await page.getByRole('table', { name: 'Lista de contactos' }).getByRole('button', { name: 'Ana' }).click()
  const ficha = page.getByRole('dialog', { name: 'Cliente: Ana' })
  await expect(ficha.getByRole('group', { name: 'Localidad' })).toContainText('Funes, Santa Fe')
  await ficha.getByRole('button', { name: 'Corregir datos' }).click()

  const form = ficha.getByRole('form', { name: 'Corregir Ana' })
  await expect(form.getByLabel('Es', { exact: true })).toBeDisabled()
  await form.getByLabel('Nombre', { exact: true }).fill('Ana María')
  await form.getByLabel('Localidad', { exact: true }).fill('Rosario')
  await form.getByLabel('Tipo de cliente').selectOption('Sin tipo')
  await form.getByRole('button', { name: 'Guardar cambios' }).click()

  const corregida = page.getByRole('dialog', { name: 'Cliente: Ana María' })
  await expect(corregida.getByText('✓ Datos de Ana María corregidos.')).toBeVisible()
  await expect(corregida.getByRole('group', { name: 'Localidad' })).toContainText('Rosario, Santa Fe')
  expect(google.escrituras).toEqual([])
  expect(google.reemplazos).toEqual([
    { hoja: 'Contactos', fila: 2, valores: ['C0001', 'cliente', 'Ana María', '', '', '', '', 'Rosario', 'Santa Fe', ''] },
  ])
  expect(google.hojas.Contactos).toHaveLength(4)

  // El nombre nuevo se ve en todas las pantallas: los pedidos guardan el ID.
  await page.keyboard.press('Escape')
  await ir(page, 'Pedidos')
  await expect(page.getByRole('row', { name: 'Pedido Ana María · 10/10/26', exact: true })).toBeVisible()
})

test('da de alta un producto con su precio y corrige otro desde la ficha', async ({ page, google }) => {
  await ir(page, 'Productos')
  await page.getByRole('button', { name: 'Nuevo producto' }).click()
  const form = page.getByRole('dialog', { name: 'Nuevo producto' }).getByRole('form', { name: 'Nuevo producto' })
  await form.getByLabel('Nombre', { exact: true }).fill('Nueces')
  await form.getByLabel('Stock mínimo', { exact: true }).fill('5')
  await form.getByLabel('Precio de lista', { exact: true }).fill('4000')
  await form.getByRole('button', { name: 'Dar de alta' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText(/✓ Nueces dado de alta a \$\s4\.000\./)).toBeVisible()
  await expect(page.getByRole('table', { name: 'Lista de productos' })).toContainText('Nueces')
  expect(google.escrituras).toEqual([{ 'Productos': [['P005', 'Nueces', 'kg', 5]], 'Precios': [['P005', 4000, HOY_SERIE]] }])

  await page.getByRole('table', { name: 'Lista de productos' }).getByRole('button', { name: 'Miel' }).click()
  const ficha = page.getByRole('dialog', { name: 'Producto: Miel' })
  await ficha.getByRole('button', { name: 'Corregir datos' }).click()
  const corregir = ficha.getByRole('form', { name: 'Corregir Miel' })
  await corregir.getByLabel('Unidad', { exact: true }).selectOption('kg')
  await expect(corregir.getByText('Las cantidades ya cargadas no se convierten: quedan en kg.')).toBeVisible()
  await corregir.getByLabel('Nombre', { exact: true }).fill('Miel de campo')
  await corregir.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('dialog', { name: 'Producto: Miel de campo' }).getByText('✓ Miel de campo corregido.')).toBeVisible()
  expect(google.reemplazos).toEqual([{ hoja: 'Productos', fila: 4, valores: ['P003', 'Miel de campo', 'kg', ''] }])
})
