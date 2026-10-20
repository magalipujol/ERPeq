import type { Page } from '@playwright/test'
import {
  esCelular, esperarDatosStock, expect, grupoStock, HOY_SERIE, ordenarStock, productosEn, productosTotal, stockEn, stockTotal, test,
} from './google-falso'

test.beforeEach(async ({ page, ingresar }) => {
  await page.goto('/#stock')
  await ingresar()
})

// El nombre del depósito y su localidad: la primera fila del grupo o el título de la sección de tarjetas.
const encabezado = (page: Page, deposito: string) => (esCelular(page)
  ? grupoStock(page, deposito).getByRole('heading')
  : grupoStock(page, deposito).getByRole('row').first())

test('agrupa el stock por depósito, con lo que viene en camino y lo comprometido', async ({ page }) => {
  // General (Bahía Blanca): Almendras 20 compradas − 4 vendidas − 6 en un flete en camino a Rosario.
  await expect(encabezado(page, 'General')).toHaveText('General · Bahía Blanca')
  await esperarDatosStock(page, stockEn(page, 'General', 'Almendras'), { 'En depósito': '10', 'En camino': '–', 'Comprometido': '–' })
  // Rosario: los 6 kg de almendras en camino; Avena: 30 − 5 de rotura, con 10 pedidos sin entregar.
  await expect(encabezado(page, 'Rosario')).toHaveText('Rosario')
  await esperarDatosStock(page, stockEn(page, 'Rosario', 'Almendras'), { 'En depósito': '0', 'En camino': '6', 'Comprometido': '–' })
  await esperarDatosStock(page, stockEn(page, 'Rosario', 'Avena'), { 'En depósito': '25', 'En camino': '–', 'Comprometido': '10' })
  // Lo que no tiene nada en un depósito no aparece en su grupo.
  await expect(stockEn(page, 'General', 'Avena')).toHaveCount(0)
  await expect(stockEn(page, 'General', 'Miel')).toHaveCount(0)
})

test('muestra un solo depósito', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Mostrar depósito' }).selectOption({ label: 'Rosario' })
  await expect(grupoStock(page, 'General')).toHaveCount(0)
  await expect(productosEn(page, 'Rosario')).toHaveCount(2)
})

test('compara el stock total con el mínimo', async ({ page }) => {
  await esperarDatosStock(page, stockTotal(page, 'Almendras'), { 'En depósitos': '10', 'En camino': '6', 'Total': '16', 'Mínimo': '–' })
  await expect(stockTotal(page, 'Almendras')).toContainText('OK')
  await esperarDatosStock(page, stockTotal(page, 'Avena'), { 'En depósitos': '25', 'En camino': '–', 'Total': '25', 'Mínimo': '50' })
  await expect(stockTotal(page, 'Avena')).toContainText('Reponer')
  await esperarDatosStock(page, stockTotal(page, 'Miel'), { 'En depósitos': '0', 'En camino': '–', 'Total': '0', 'Mínimo': '–' })
  await expect(stockTotal(page, 'Miel')).toContainText('Sin stock')

  await page.getByRole('combobox', { name: 'Filtrar stock total' }).selectOption({ label: 'Bajo el mínimo' })
  await expect(productosTotal(page)).toHaveCount(1)
  await expect(productosTotal(page).first()).toContainText('Avena')
})

test('ordena el stock total con lo más urgente primero', async ({ page }) => {
  // Avena (Reponer), Miel y Mix europeo (Sin stock), Almendras (OK).
  await ordenarStock(page, 'Stock total', 'Estado', 1, 'Más urgente primero')
  await expect(productosTotal(page).first()).toContainText('Avena')
  await expect(productosTotal(page).last()).toContainText('Almendras')
})

test('KPIs de stock', async ({ page }) => {
  const kpi = (label: string) => page.getByRole('group', { name: label })
  await expect(kpi('Productos con stock')).toContainText('2')
  await expect(kpi('Bajo el mínimo')).toContainText('1')
  await expect(kpi('Stock negativo')).toContainText('0')
  await expect(kpi('Faltan para pedidos')).toContainText('0')
  // 10 kg de almendras en General y 6 en camino a $ 1.000 (la última compra) + 25 kg de avena a $ 500.
  await expect(kpi('Valor del stock (a costo)')).toContainText('28.500')
})

test('busca, filtra y ordena el stock por depósito', async ({ page }) => {
  // General con Almendras; Rosario con Almendras y Avena.
  await expect(productosEn(page, 'General')).toHaveCount(1)
  await expect(productosEn(page, 'Rosario')).toHaveCount(2)

  await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('alm')
  await expect(productosEn(page, 'Rosario')).toHaveCount(1)
  await expect(stockEn(page, 'Rosario', 'Avena')).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('')

  await page.getByRole('combobox', { name: 'Filtrar', exact: true }).selectOption({ label: 'Con stock' })
  await expect(stockEn(page, 'Rosario', 'Almendras')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Filtrar', exact: true }).selectOption({ label: 'Todos' })

  // Se ordena dentro de cada depósito: Avena (25) antes que Almendras (0).
  await expect(productosEn(page, 'Rosario').first()).toContainText('Almendras')
  await ordenarStock(page, 'Stock por depósito', 'En depósito', 2, 'Más stock primero')
  await expect(productosEn(page, 'Rosario').first()).toContainText('Avena')
})

test('registra un ajuste de stock', async ({ page, google }) => {
  const form = page.getByRole('form', { name: 'Ajuste de stock' })
  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByLabel('Cantidad', { exact: true }).fill('-2')
  await expect(form.getByText(/Stock en General: 10 → 8 kg/)).toBeVisible()
  await form.getByLabel('Motivo', { exact: true }).fill('conteo')
  await form.getByRole('button', { name: 'Registrar ajuste' }).click()

  await expect(form.getByText('✓ Ajuste registrado: -2 kg de Almendras.')).toBeVisible()
  expect(google.escrituras).toEqual([{ 'Ajustes': [[HOY_SERIE, 'BB', 'P001', -2, 'conteo']] }])
  await esperarDatosStock(page, stockEn(page, 'General', 'Almendras'), { 'En depósito': '8' })
})

test('el ajuste valida los datos antes de guardar', async ({ page, google }) => {
  const form = page.getByRole('form', { name: 'Ajuste de stock' })
  await form.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(form.getByText('Elegí un producto de la lista.')).toBeVisible()

  await form.getByLabel('Producto', { exact: true }).fill('Almendras')
  await form.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(form.getByText('Ingresá una cantidad distinta de 0.')).toBeVisible()

  await form.getByLabel('Cantidad', { exact: true }).fill('3')
  await form.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(form.getByText('Indicá el motivo.')).toBeVisible()
  expect(google.escrituras).toEqual([])
})
