import { expect, test } from './google-falso'

interface Manifiesto {
  name: string; display: string; start_url: string; scope: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
}

test('publica el manifiesto y los íconos para instalar la app', async ({ request }) => {
  const manifiesto = await (await request.get('/manifest.webmanifest')).json() as Manifiesto
  expect(manifiesto).toMatchObject({ name: 'ERPeq', display: 'standalone', start_url: './', scope: './' })
  expect(manifiesto.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(true)
  for (const icono of [...manifiesto.icons.map((i) => i.src), 'apple-touch-icon.png']) {
    const r = await request.get(`/${icono}`)
    expect(r.status(), icono).toBe(200)
  }
})

// Chrome dice por qué no ofrecería instalar la página (manifiesto sin enlazar, sin íconos, etc.): si la lista
// viene vacía, ofrece "Instalar app". Los dos proyectos de Playwright usan Chromium.
test('Chrome la considera instalable', async ({ page }) => {
  await page.goto('/')
  const cdp = await page.context().newCDPSession(page)
  await expect.poll(async () => {
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
    return installabilityErrors.map((e) => e.errorId)
  }).toEqual([])
})
