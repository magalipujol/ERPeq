// Fichas: tocar una fila abre un modal con sus datos y vínculos a lo relacionado. La historia que cruza
// pantallas está en historias.spec.ts; acá, las fichas de flete y compra y cómo se abren y cierran.
import { expect, ir, test } from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#fletes')
  await ingresar()
})

test('la ficha de un flete muestra la mercadería y el transporte, y "Ver en Fletes" lo resalta', async ({ page }) => {
  await page.getByRole('row', { name: 'Flete Interprovincial · 08/10/26' }).getByRole('cell').first().click()
  const flete = page.getByRole('dialog', { name: 'Flete de Interprovincial · 08/10/26' })
  await expect(flete.getByRole('group', { name: 'Recorrido' })).toContainText('General → Rosario')
  await expect(flete.getByRole('group', { name: 'Estado' })).toContainText('En camino')
  await expect(flete.getByRole('table', { name: 'Mercadería del flete' })).toContainText('Almendras')
  await expect(flete.getByText('En preparación (08/10/26) → En camino (08/10/26)')).toBeVisible()

  // El transporte lista sus fletes; Volver regresa al flete.
  await flete.getByRole('button', { name: 'Interprovincial' }).click()
  const transporte = page.getByRole('dialog', { name: 'Transporte: Interprovincial' })
  await expect(transporte.getByRole('table', { name: 'Fletes del transporte' })).toContainText('General → Rosario')
  await transporte.getByRole('button', { name: /^Volver a / }).click()

  await page.getByRole('dialog', { name: 'Flete de Interprovincial · 08/10/26' }).getByRole('button', { name: 'Ver en Fletes' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('row', { name: 'Flete Interprovincial · 08/10/26' })).toHaveAttribute('aria-current', 'true')
})

test('los botones de una fila hacen lo suyo sin abrir la ficha, y el vínculo la abre con el teclado', async ({ page }) => {
  await page.getByRole('button', { name: 'Recibido flete de Interprovincial · 08/10/26' }).click()
  await expect(page.getByText('✓ Flete de Interprovincial · 08/10/26: finalizado.')).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()

  await ir(page, 'Compras')
  const vinculo = page.getByRole('row').filter({ hasText: 'Prov B' }).getByRole('button', { name: 'Prov B' })
  await vinculo.focus()
  await page.keyboard.press('Enter')
  const compra = page.getByRole('dialog', { name: 'Compra a Prov B · 03/10/26' })
  await expect(compra.getByRole('group', { name: 'Cantidad' })).toContainText('30 kg')
  await expect(compra.getByRole('group', { name: 'Depósito' })).toContainText('Rosario')
  await page.keyboard.press('Escape')
  await expect(compra).toBeHidden()
})

test('"atrás" del navegador cierra las fichas de a una y vuelve a la pantalla anterior, sin salir de la app', async ({ page }) => {
  await ir(page, 'Compras')
  await expect(page).toHaveURL(/#compras$/)

  // Ficha del flete y, encima, la del transporte: "atrás" vuelve al flete y después cierra el modal.
  await ir(page, 'Fletes')
  await page.getByRole('row', { name: 'Flete Interprovincial · 08/10/26' }).getByRole('cell').first().click()
  await page.getByRole('dialog', { name: 'Flete de Interprovincial · 08/10/26' }).getByRole('button', { name: 'Interprovincial' }).click()
  await expect(page.getByRole('dialog', { name: 'Transporte: Interprovincial' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Flete de Interprovincial · 08/10/26' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/#fletes$/)

  // Cerrar el modal con la X también deja el historial donde estaba.
  await page.getByRole('row', { name: 'Flete Interprovincial · 08/10/26' }).getByRole('cell').first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Interprovincial' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  // Atrás vuelve a Compras y después a Fletes, la pantalla con la que se entró.
  await page.goBack()
  await expect(page).toHaveURL(/#compras$/)
  await expect(page.getByRole('row').filter({ hasText: 'Prov B' }).first()).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/#fletes$/)
  await expect(page.getByRole('row', { name: 'Flete Interprovincial · 08/10/26' })).toBeVisible()
})
