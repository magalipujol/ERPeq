import type { Page } from '@playwright/test'
import { expect, HOY_SERIE, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#recetas')
  await ingresar()
})

const formReceta = (page: Page) => page.getByRole('form', { name: 'Receta' })
const formFabricar = (page: Page) => page.getByRole('form', { name: 'Fabricar' })

async function cargarInsumo(page: Page, i: number, producto: string, cantidad: string) {
  const form = formReceta(page)
  if (i > 0) await form.getByRole('button', { name: '+ Agregar producto' }).click()
  await form.getByLabel('Producto', { exact: true }).nth(i).fill(producto)
  await form.getByLabel('Cantidad', { exact: true }).nth(i).fill(cantidad)
}

// Receta de almendras con avena: 600 g + 400 g → sale 950 g (5 % de merma).
async function crearMix(page: Page) {
  const form = formReceta(page)
  await form.getByLabel('Producto que sale').fill('Mix europeo')
  await expect(form.getByText(/Precio de lista: \$\s2\.500 por kg/)).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Cantidades en' }).getByText('g', { exact: true }).click()
  await cargarInsumo(page, 0, 'Almendras', '600')
  await cargarInsumo(page, 1, 'Avena', '400')
  const sale = form.getByLabel('Sale por tanda')
  // Sin cargar nada propone la suma de los insumos.
  await expect(sale).toHaveAttribute('placeholder', '1.000')
  await sale.fill('950')
  await expect(form.getByText('Merma: 5 %')).toBeVisible()
  await form.getByRole('button', { name: 'Guardar receta' }).click()
  await expect(form.getByText('✓ Receta de Mix europeo guardada.')).toBeVisible()
}

test('crea una receta de un producto que ya existe y la guarda en kg', async ({ page, google }) => {
  await crearMix(page)

  expect(google.escrituras).toEqual([{
    'Recetas': [['RE0001', 1, HOY_SERIE, 'P004', 0.95, 'sí']],
    'Recetas ítems': [['RE0001', 1, 'P001', 0.6], ['RE0001', 1, 'P002', 0.4]],
  }])
  const fila = page.getByRole('row', { name: 'Receta de Mix europeo' })
  await expect(fila).toContainText('0,6 kg Almendras')
  await expect(fila).toContainText('merma 5 %')
  await expect(fila).toContainText(/\$\s2\.500\/kg/)
  // Una tanda: 0,6 × $1.500 + 0,4 × $500 = $1.100 por 0,95 kg → $1.157,89 el kg (se muestra sin centavos).
  await expect(fila).toContainText(/\$\s1\.158\/kg/)
})

test('editar una receta agrega una versión y darla de baja la saca de Fabricar', async ({ page, google }) => {
  await crearMix(page)
  await page.getByRole('button', { name: 'Editar Mix europeo' }).click()
  const form = formReceta(page)
  await expect(page.getByRole('heading', { name: 'Editar receta de Mix europeo' })).toBeVisible()
  await expect(form.getByLabel('Producto que sale')).toBeDisabled()
  await form.getByLabel('Cantidad', { exact: true }).first().fill('0.7')
  await form.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('✓ Receta de Mix europeo guardada (versión 2).')).toBeVisible()
  expect(google.escrituras[1]).toEqual({
    'Recetas': [['RE0001', 2, HOY_SERIE, 'P004', 0.95, 'sí']],
    'Recetas ítems': [['RE0001', 2, 'P001', 0.7], ['RE0001', 2, 'P002', 0.4]],
  })

  await expect(formFabricar(page).getByLabel('Receta')).toHaveValue('RE0001')
  await page.getByRole('button', { name: 'Dar de baja Mix europeo' }).click()
  await expect(page.getByText('✓ Receta de Mix europeo dada de baja.')).toBeVisible()
  expect(google.escrituras[2].Recetas[0]).toEqual(['RE0001', 3, expect.any(Number), 'P004', 0.95, 'no'])
  await expect(formFabricar(page).getByRole('button', { name: 'Registrar fabricación' })).toBeDisabled()
  await expect(page.getByRole('row', { name: 'Receta de Mix europeo' })).toHaveCount(0)

  await page.getByRole('radiogroup', { name: 'Mostrar recetas' }).getByText('Todas').click()
  await expect(page.getByRole('row', { name: 'Receta de Mix europeo' })).toContainText('De baja')
})

test('no deja guardar una receta de un producto que no existe o sin precio de lista', async ({ page, google }) => {
  const form = formReceta(page)
  await cargarInsumo(page, 0, 'Almendras', '1')
  await form.getByLabel('Producto que sale').fill('Mix tropical')
  await expect(form.getByText('No existe ese producto: cargalo primero en Productos.')).toBeVisible()
  await form.getByRole('button', { name: 'Guardar receta' }).click()
  await expect(form.getByText('No existe el producto "Mix tropical": cargalo primero en Productos.')).toBeVisible()

  await form.getByLabel('Producto que sale').fill('Miel')
  await expect(form.getByText('Sin precio de lista: cargalo en Precios.')).toBeVisible()
  await form.getByRole('button', { name: 'Guardar receta' }).click()
  await expect(form.getByText('Miel no tiene precio de lista: cargalo en Precios.')).toBeVisible()
  expect(google.escrituras).toHaveLength(0)
})

test('no deja guardar una receta con insumos que no existen o sin cantidad', async ({ page, google }) => {
  const form = formReceta(page)
  await form.getByLabel('Producto que sale').fill('Mix europeo')
  await cargarInsumo(page, 0, 'Mango', '1')
  await form.getByRole('button', { name: 'Guardar receta' }).click()
  await expect(form.getByText('No existe el insumo "Mango".')).toBeVisible()

  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByLabel('Cantidad', { exact: true }).fill('')
  await form.getByRole('button', { name: 'Guardar receta' }).click()
  await expect(form.getByText('Cada insumo necesita una cantidad mayor a 0.')).toBeVisible()
  expect(google.escrituras).toHaveLength(0)
})

test('si la planilla no tiene las hojas de recetas, avisa cuáles crear y no deja guardar', async ({ page, google }) => {
  for (const hoja of ['Recetas', 'Recetas ítems']) Reflect.deleteProperty(google.hojas, hoja)
  // La sesión quedó guardada: al recargar abre la planilla sin volver a ingresar.
  await page.reload()
  await page.getByText(/^Sincronizado/).waitFor()

  await expect(page.getByText('Faltan hojas en la planilla')).toBeVisible()
  await expect(page.getByText('receta_id, version, producto_id, cantidad', { exact: true })).toBeVisible()
  await expect(formReceta(page).getByRole('button', { name: 'Guardar receta' })).toBeDisabled()
})
