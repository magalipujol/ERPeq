import { expect, test } from './google-falso'

// El modelo (~2 GB) no se descarga en las pruebas: solo se verifica que el asistente se abre y avisa qué va a hacer.
test('el asistente se abre desde el header y pide activar el modelo', async ({ page, ingresar }) => {
  await page.goto('/')
  await ingresar()
  await page.getByRole('button', { name: 'Asistente' }).click()
  const panel = page.getByRole('dialog', { name: 'Asistente' })
  await expect(panel.getByText('Solo consulta')).toBeVisible()
  await expect(panel.getByRole('button', { name: /activar/ }).or(panel.getByText('no tiene WebGPU'))).toBeVisible()
})
