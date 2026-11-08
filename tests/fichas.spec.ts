// Fichas: tocar una fila abre un modal con sus datos y vínculos a lo relacionado. La historia que cruza
// pantallas está en historias.spec.ts; acá, las fichas de flete y compra y cómo se abren y cierran.
import { expect, ir, serie, test } from './google-falso'

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

test('desde la ficha de un flete se corrige y se borra', async ({ page, google }) => {
  await page.getByRole('row', { name: 'Flete Interprovincial · 08/10/26' }).getByRole('cell').first().click()
  const ficha = page.getByRole('dialog', { name: 'Flete de Interprovincial · 08/10/26' })

  // 1. El costo pasa de $ 5.000 a $ 6.000 y lleva 4 kg de almendras en vez de 6. Los estados no se tocan.
  await ficha.getByRole('button', { name: 'Corregir flete' }).click()
  const form = ficha.getByRole('form', { name: 'Corregir flete' })
  await expect(form.getByLabel('Transporte', { exact: true })).toHaveValue('Interprovincial')
  await form.getByLabel('Costo', { exact: true }).fill('6000')
  await form.getByLabel('Cantidad', { exact: true }).fill('4')
  await form.getByRole('button', { name: 'Guardar corrección' }).click()
  await expect(ficha.getByText('✓ Flete de Interprovincial corregido.')).toBeVisible()
  expect(google.reemplazos).toEqual([{ hoja: 'Fletes', fila: 2, valores: ['F0001', serie('2026-10-08'), 'C0004', 'BB', 'ROS', 6000, '', '', '', ''] }])
  expect(google.hojas['Fletes ítems']).toEqual([['F0001', 'P001', 4]])
  expect(google.hojas['Fletes estados']).toHaveLength(2)

  // 2. Borrarlo saca el flete, su mercadería y sus estados.
  await ficha.getByRole('button', { name: 'Borrar flete' }).click()
  await page.getByRole('dialog', { name: '¿Borrar el flete?' }).getByRole('button', { name: 'Sí, borrar flete' }).click()
  await expect(ficha.getByText('✓ Flete de Interprovincial · 08/10/26 borrado.')).toBeVisible()
  expect([google.hojas.Fletes, google.hojas['Fletes ítems'], google.hojas['Fletes estados']]).toEqual([[], [], []])
})

test('desde la ficha de una venta se corrigen y borran sus cobros y se corrige el envío', async ({ page, google }) => {
  // La venta de Ana del 05/10 ($ 12.000) tiene dos cobros y un envío de $ 500 para Leo.
  google.hojas.Cobros.push(
    [serie('2026-10-06'), 'V0001', 5000, 'efectivo', 'SOC01', ''], [serie('2026-10-07'), 'V0001', 2000, 'efectivo', 'SOC01', ''],
  )
  google.hojas['Ventas envíos'].push(['V0001', 'VEN01', 500, 500])
  await page.getByRole('button', { name: 'Refrescar' }).click()
  await ir(page, 'Ventas')
  await page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Ana', exact: true }) }).getByRole('cell', { name: 'Almendras' }).click()
  const ficha = page.getByRole('dialog', { name: 'Venta a Ana · 05/10/26' })

  // 1. El cobro de $ 2.000 fue por transferencia y de $ 2.500.
  await ficha.getByRole('button', { name: /^Editar cobro de \$\s2\.000/ }).click()
  const form = ficha.getByRole('form', { name: 'Corregir cobro' })
  await form.getByLabel('Importe', { exact: true }).fill('2500')
  await form.getByLabel('Medio', { exact: true }).selectOption('transferencia')
  await form.getByRole('button', { name: 'Guardar cobro' }).click()
  await expect(ficha.getByText(/✓ Cobro corregido: \$\s2\.500 del 07\/10\/26\./)).toBeVisible()
  expect(google.hojas.Cobros).toEqual([
    [serie('2026-10-06'), 'V0001', 5000, 'efectivo', 'SOC01', ''], [serie('2026-10-07'), 'V0001', 2500, 'transferencia', 'SOC01', ''],
  ])

  // 2. El de $ 5.000 se borra: queda a cobrar 12.000 + 500 de envío − 2.500 = 10.000.
  await ficha.getByRole('button', { name: /^Borrar cobro de \$\s5\.000/ }).click()
  await page.getByRole('dialog', { name: '¿Borrar este cobro?' }).getByRole('button', { name: 'Sí, borrar cobro' }).click()
  await expect(ficha.getByText(/✓ Cobro de \$\s5\.000 del 06\/10\/26 borrado\./)).toBeVisible()
  expect(google.hojas.Cobros).toHaveLength(1)
  await expect(ficha.getByText(/A cobrar\s*\$\s10\.000/)).toBeVisible()

  // 3. El envío era para el negocio.
  await ficha.getByRole('button', { name: 'Corregir envío' }).click()
  const envio = ficha.getByRole('form', { name: 'Corregir envío' })
  await envio.getByLabel('El envío es para', { exact: true }).selectOption({ label: 'El negocio' })
  await envio.getByRole('button', { name: 'Guardar envío' }).click()
  await expect(ficha.getByText(/✓ Envío corregido: \$\s500 para el negocio\./)).toBeVisible()
  expect(google.hojas['Ventas envíos']).toEqual([['V0001', '', 500, 500]])
})
