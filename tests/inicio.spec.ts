import type { Page } from '@playwright/test'
import { expect, grupoStock, ir, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/')
  await ingresar()
})

const kpi = (page: Page, nombre: string) => page.getByRole('group', { name: nombre, exact: true })

test('muestra el pantallazo: pedidos pendientes y fletes en curso', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible()
  await expect(kpi(page, 'Pedidos pendientes')).toContainText('1')
  await expect(kpi(page, 'Con faltante de stock')).toContainText('0')
  await expect(kpi(page, 'Fletes en preparación')).toContainText('0')
  await expect(kpi(page, 'Fletes en camino')).toContainText('1')

  // El pedido de Ana del 05/10 ya se entregó: solo queda el del 10/10.
  const pendientes = page.getByRole('region', { name: 'Pedidos pendientes' })
  await expect(pendientes.getByRole('article')).toHaveCount(1)
  const pe2 = pendientes.getByRole('article', { name: 'Pedido Ana · 10/10/26' })
  await expect(pe2).toContainText('Ana')
  await expect(pe2).toContainText('10/10/26')
  await expect(pe2).toContainText('desde Rosario')
  await expect(pe2).toContainText('10 Avena')
  await expect(pe2).toContainText('Pendiente')

  const f1 = page.getByRole('region', { name: 'Fletes en curso' }).getByRole('article', { name: 'Flete Interprovincial · 08/10/26' })
  await expect(f1).toContainText('Interprovincial')
  await expect(f1).toContainText('General → Rosario')
  await expect(f1).toContainText('6 Almendras')
  await expect(f1).toContainText('En camino')
})

test('el mapa muestra depósitos, pedidos pendientes y fletes en curso', async ({ page }) => {
  const mapa = page.getByRole('region', { name: 'Mapa' })
  await expect(mapa.getByRole('img', { name: /^Mapa de la zona de los depósitos/ })).toBeVisible()
  await expect(mapa.getByRole('button', { name: 'Depósito General' })).toBeVisible()
  await expect(mapa.getByRole('button', { name: 'Depósito Rosario' })).toBeVisible()
  // Ana es de Funes, a pocos kilómetros de Rosario: su pedido se marca junto al depósito de Rosario.
  await expect(mapa.getByRole('button', { name: 'Pedidos pendientes en Rosario · Funes: 1' })).toHaveText('1')
  // El flete de Interprovincial va de General (Bahía Blanca) a Rosario.
  await expect(mapa.getByRole('button', { name: 'Fletes de Bahía Blanca a Rosario · Funes: 1' })).toBeVisible()
  await expect(mapa.getByText(/Fuera del mapa/)).toBeHidden()
})

test('el mapa arranca en la zona de los depósitos y se aleja a todo el país', async ({ page }) => {
  const mapa = page.getByRole('region', { name: 'Mapa' })
  const img = mapa.getByRole('img', { name: /^Mapa de/ })
  // Los depósitos están en Bahía Blanca y Rosario: el mapa muestra solo esa parte, más ancha que alta.
  await expect(img).toHaveAccessibleName(/^Mapa de la zona de los depósitos/)
  const zona = await img.boundingBox()
  expect(zona && zona.width / zona.height).toBeGreaterThan(0.6)

  await mapa.getByRole('button', { name: 'Alejar a todo el país' }).click()
  await expect(img).toHaveAccessibleName(/^Mapa de Argentina/)
  const pais = await img.boundingBox()
  expect(pais && pais.width / pais.height).toBeLessThan(0.6)
  await expect(mapa.getByRole('button', { name: 'Depósito General' })).toBeVisible()

  await mapa.getByRole('button', { name: 'Acercar a la zona de los depósitos' }).click()
  await expect(img).toHaveAccessibleName(/^Mapa de la zona de los depósitos/)
})

test('tocar un pedido del mapa lo abre en Pedidos para entregarlo', async ({ page }) => {
  await page.getByRole('button', { name: /^Pedidos pendientes en Rosario/ }).click()
  const pedido = page.getByRole('button', { name: 'Ver pedido Ana · 10/10/26' })
  await expect(pedido).toContainText('Ana')
  await pedido.click()
  await expect(page).toHaveURL(/#pedidos$/)
  await expect(page.getByRole('heading', { name: 'Entregar pedido de Ana · 10/10/26' })).toBeVisible()
})

test('tocar un flete del mapa lo muestra resaltado en Fletes', async ({ page }) => {
  await page.getByRole('button', { name: 'Fletes de Bahía Blanca a Rosario · Funes: 1' }).click()
  const flete = page.getByRole('button', { name: 'Ver flete Interprovincial · 08/10/26' })
  await expect(flete).toContainText('General → Rosario')
  await expect(flete).toContainText('En camino')
  await flete.click()
  await expect(page).toHaveURL(/#fletes$/)
  await expect(page.getByRole('row', { name: 'Flete Interprovincial · 08/10/26' })).toHaveAttribute('aria-current', 'true')
})

test('tocar un depósito del mapa abre Stock filtrado por ese depósito', async ({ page }) => {
  await page.getByRole('button', { name: 'Depósito Rosario' }).click()
  await expect(page).toHaveURL(/#stock$/)
  await expect(page.getByRole('combobox', { name: 'Mostrar depósito' })).toHaveValue('ROS')
  await expect(grupoStock(page, 'Rosario')).toHaveCount(1)
  await expect(grupoStock(page, 'General')).toHaveCount(0)
})

test('"Tomar pedido nuevo" abre Pedidos con el cursor en el cliente', async ({ page }) => {
  await page.getByRole('button', { name: 'Tomar pedido nuevo' }).click()
  await expect(page).toHaveURL(/#pedidos$/)
  await expect(page.getByRole('form', { name: 'Nuevo pedido' }).getByLabel('Cliente', { exact: true })).toBeFocused()
})

test('los accesos a las listas completas llevan a Pedidos y Fletes', async ({ page }) => {
  await page.getByRole('button', { name: 'Ver pedidos' }).click()
  await expect(page).toHaveURL(/#pedidos$/)
  await expect(page.getByRole('heading', { name: 'Pedidos', exact: true }).first()).toBeVisible()

  await ir(page, 'Inicio')
  await page.getByRole('button', { name: 'Ver fletes' }).click()
  await expect(page).toHaveURL(/#fletes$/)
  await expect(page.getByRole('heading', { name: 'Fletes', exact: true }).first()).toBeVisible()
})
