import type { Page } from '@playwright/test'
import { expect, test } from './google-falso'

// Simula la Prompt API de Chrome (window.LanguageModel) con una respuesta fija, y guarda lo que recibe.
async function simularIA(page: Page, respuesta: object) {
  await page.addInitScript((r) => {
    const llamadas: unknown[] = []
    Object.assign(window, {
      llamadasIA: llamadas,
      LanguageModel: {
        availability: async () => Promise.resolve('available'),
        create: async (opciones: unknown) => {
          llamadas.push({ create: opciones })
          return Promise.resolve({
            prompt: async (texto: string, o: unknown) => {
              llamadas.push({ prompt: texto, opciones: o })
              return Promise.resolve(JSON.stringify(r))
            },
            destroy: () => undefined,
          })
        },
      },
    })
  }, respuesta)
}

const formPedido = (page: Page) => page.getByRole('form', { name: 'Nuevo pedido' })
const pegar = (page: Page) => page.getByRole('region', { name: 'Pegar pedido' })

test('sin la IA del navegador no se muestra', async ({ page, ingresar }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, 'LanguageModel') })
  await page.goto('/#pedidos')
  await ingresar()
  await expect(formPedido(page)).toBeVisible()
  await expect(pegar(page)).toBeHidden()
})

test('si el modelo no está disponible no se muestra', async ({ page, ingresar }) => {
  await page.addInitScript(() => {
    Object.assign(window, { LanguageModel: { availability: async () => Promise.resolve('unavailable') } })
  })
  await page.goto('/#pedidos')
  await ingresar()
  await expect(formPedido(page)).toBeVisible()
  await expect(pegar(page)).toBeHidden()
})

test('completa el pedido con un mensaje pegado y no guarda nada', async ({ page, ingresar, google }) => {
  await simularIA(page, {
    cliente: 'ana', localidad: 'funes', provincia: 'Santa Fe',
    productos: [
      { producto: 'almendra', cantidad: 25 },
      { producto: 'avenna', cantidad: 10 },
      { producto: 'maní', cantidad: 3 },
    ],
  })
  await page.goto('/#pedidos')
  await ingresar()

  const caja = pegar(page)
  await expect(caja.getByText('Experimental')).toBeVisible()
  await caja.getByLabel('Mensaje del pedido').fill('Hola, soy Ana de Funes, mandame 25 kg de almendras, 10 de avena y 3 de maní')
  await caja.getByRole('button', { name: 'Completar el pedido' }).click()

  const form = formPedido(page)
  await expect(form.getByLabel('Cliente', { exact: true })).toHaveValue('Ana')
  await expect(form.getByLabel('Localidad', { exact: true })).toHaveValue('Funes')
  await expect(form.getByLabel('Provincia', { exact: true })).toHaveValue('Santa Fe')
  const productos = form.getByLabel('Producto', { exact: true })
  const cantidades = form.getByLabel('Cantidad', { exact: true })
  const precios = form.getByLabel('Precio unitario', { exact: true })
  await expect(productos).toHaveCount(3)
  await expect(productos.nth(0)).toHaveValue('Almendras')
  await expect(cantidades.nth(0)).toHaveValue('25')
  await expect(precios.nth(0)).toHaveValue('3000')
  await expect(productos.nth(1)).toHaveValue('Avena')
  await expect(cantidades.nth(1)).toHaveValue('10')
  // Lo que no coincide queda escrito y marcado para corregirlo.
  await expect(productos.nth(2)).toHaveValue('maní')
  await expect(form.getByText('No existe ese producto.')).toBeVisible()

  const revision = caja.getByRole('status', { name: 'Revisión del pedido pegado' })
  await expect(revision).toContainText('Revisá:')
  await expect(revision).toContainText('Producto: «avenna» se cargó como «Avena».')
  await expect(revision).toContainText('Producto: «maní», no existe: elegí uno de la lista.')

  // Al modelo le llegan el mensaje, el esquema de la respuesta y la lista de productos y clientes.
  const [creacion, consulta] = await page.evaluate(() => (window as unknown as { llamadasIA: unknown[] }).llamadasIA)
  expect(creacion).toMatchObject({
    create: {
      expectedInputs: [{ type: 'text', languages: ['es'] }],
      initialPrompts: [{ role: 'system', content: expect.stringContaining('- Almendras') as unknown }],
    },
  })
  expect(consulta).toMatchObject({
    prompt: expect.stringContaining('25 kg de almendras'),
    opciones: { responseConstraint: { type: 'object' } },
  })
  expect(google.escrituras).toEqual([])
})
