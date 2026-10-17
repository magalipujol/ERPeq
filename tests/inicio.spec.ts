import type { Page } from '@playwright/test'
import { expect, ir, test } from './google-falso'

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

  // PE0001 ya se entregó: solo queda PE0002.
  const pendientes = page.getByRole('region', { name: 'Pedidos pendientes' })
  await expect(pendientes.getByRole('article')).toHaveCount(1)
  const pe2 = pendientes.getByRole('article', { name: 'Pedido PE0002' })
  await expect(pe2).toContainText('PE0002 · Ana')
  await expect(pe2).toContainText('desde Rosario')
  await expect(pe2).toContainText('10 Avena')
  await expect(pe2).toContainText('Pendiente')

  const f1 = page.getByRole('region', { name: 'Fletes en curso' }).getByRole('article', { name: 'Flete F0001' })
  await expect(f1).toContainText('F0001 · Interprovincial')
  await expect(f1).toContainText('General → Rosario')
  await expect(f1).toContainText('6 Almendras')
  await expect(f1).toContainText('En camino')
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
