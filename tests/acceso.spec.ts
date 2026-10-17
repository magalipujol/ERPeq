import { expect, HOY, instalarGoogleFalso, ir, test } from './google-falso'

test('ingresa con Google y abre Inicio', async ({ page, ingresar }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ingresá con tu cuenta de Google' })).toBeVisible()
  await ingresar()
  await expect(page.getByText('ERPeq - Pruebas').filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Planilla' })).toHaveAttribute('href', 'https://docs.google.com/spreadsheets/d/prueba/edit')
})

// La fuente se sirve desde el propio sitio: si la Content-Security-Policy la bloquea, la app se ve igual pero
// con Verdana, y ninguna otra prueba lo nota.
test('carga OpenDyslexic en regular y negrita', async ({ page, ingresar }) => {
  await page.goto('/')
  await ingresar()
  const estados = await page.evaluate(async () => {
    await Promise.all([document.fonts.load('400 16px OpenDyslexic'), document.fonts.load('700 16px OpenDyslexic')])
    return [...document.fonts].filter((f) => f.family === 'OpenDyslexic').map((f) => `${f.weight} ${f.status}`)
  })
  expect(estados.sort()).toEqual(['400 loaded', '700 loaded'])
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

test('recargar la página mantiene la sesión mientras dure el token', async ({ page, ingresar }) => {
  await page.goto('/#compras')
  await ingresar()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Compras', exact: true })).toBeVisible()
  await expect(page.getByText(/^Sincronizado/)).toBeVisible()
})

test('otra pestaña usa la misma sesión', async ({ page, context, ingresar }) => {
  await page.goto('/')
  await ingresar()
  const otra = await context.newPage()
  await instalarGoogleFalso(otra)
  await otra.goto('/#compras')
  await expect(otra.getByRole('heading', { name: 'Compras', exact: true })).toBeVisible()
  await expect(otra.getByText(/^Sincronizado/)).toBeVisible()
})

test('después de salir, recargar vuelve a pedir el login', async ({ page, ingresar }) => {
  await page.goto('/')
  await ingresar()
  await page.getByRole('button', { name: 'Salir' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ingresá con tu cuenta de Google' })).toBeVisible()
})

test('con el token vencido, recargar vuelve a pedir el login', async ({ page, ingresar }) => {
  await page.goto('/')
  await ingresar()
  // El token falso dura 3599 s; la app lo da por vencido un minuto antes.
  await page.clock.setFixedTime(new Date(HOY.getTime() + 60 * 60 * 1000))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ingresá con tu cuenta de Google' })).toBeVisible()
  await expect(page.getByText(/venció/)).toBeHidden()
})

test('si Google rechaza el token guardado, vuelve al login sin aviso de sesión vencida', async ({ page, google, ingresar }) => {
  await page.goto('/')
  await ingresar()
  google.fallarProxima(401)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ingresá con tu cuenta de Google' })).toBeVisible()
  await expect(page.getByText(/venció/)).toBeHidden()
  await page.getByRole('button', { name: 'Ingresar con Google' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible()
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
