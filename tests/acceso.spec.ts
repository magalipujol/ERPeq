import { expect, ir, test } from './google-falso'

test('ingresa con Google y abre Inicio', async ({ page, ingresar }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ingresá con tu cuenta de Google' })).toBeVisible()
  await ingresar()
  await expect(page.getByText('ERPeq - Pruebas').filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Planilla' })).toHaveAttribute('href', 'https://docs.google.com/spreadsheets/d/prueba/edit')
})

test('cuenta sin acceso a la planilla: avisa y deja reintentar', async ({ page, google }) => {
  google.fallarProxima(403)
  await page.goto('/')
  await page.getByRole('button', { name: 'Ingresar con Google' }).click()
  await expect(page.getByRole('heading', { name: 'Tu cuenta no tiene acceso a la planilla' })).toBeVisible()

  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible()
})

test('"Usar otra cuenta" vuelve al login', async ({ page, google }) => {
  google.fallarProxima(403)
  await page.goto('/')
  await page.getByRole('button', { name: 'Ingresar con Google' }).click()
  await page.getByRole('button', { name: 'Usar otra cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Ingresá con tu cuenta de Google' })).toBeVisible()
})

test('sesión vencida: muestra el aviso y reconecta', async ({ page, google, ingresar }) => {
  await page.goto('/')
  await ingresar()
  google.fallarProxima(401)
  await page.getByRole('button', { name: 'Refrescar' }).click()
  await expect(page.getByText(/venció \(dura una hora\)/)).toBeVisible()

  await page.getByRole('button', { name: 'Reconectar' }).click()
  await expect(page.getByText(/venció \(dura una hora\)/)).toBeHidden()
  await expect(page.getByText(/^Sincronizado/)).toBeVisible()
})

test('salir vuelve al login', async ({ page, ingresar }) => {
  await page.goto('/')
  await ingresar()
  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page.getByRole('heading', { name: 'Ingresá con tu cuenta de Google' })).toBeVisible()
})

test('abre la sección que indica el #hash y lo actualiza al navegar', async ({ page, ingresar }) => {
  await page.goto('/#compras')
  await ingresar()
  await expect(page.getByRole('heading', { name: 'Compras', exact: true })).toBeVisible()

  await ir(page, 'Ventas')
  await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/#ventas$/)

  await ir(page, 'Inicio')
  await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/#inicio$/)
})
