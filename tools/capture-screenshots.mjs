import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { PNG } from 'pngjs'

const destination = fileURLToPath(new URL('../docs/screenshots/', import.meta.url))
const baseURL = process.env.CITY_URL ?? `http://127.0.0.1:${process.env.CITY_PORT ?? 5176}`
const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined)
const browser = await chromium.launch({ channel, headless: true })
const errors = []
const results = []

async function openPage(options) {
  const page = await browser.newPage(options)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(baseURL)
  await page.waitForFunction(() => window.__city?.ready && window.__city.snapshot().frames > 12)
  return page
}

async function capture(page, name) {
  await page.evaluate(() => document.activeElement?.blur())
  const frame = await page.evaluate(() => window.__city.snapshot().frames)
  await page.waitForFunction(previous => window.__city.snapshot().frames > previous + 3, frame)
  const buffer = await page.screenshot({ path: join(destination, name), animations: 'disabled' })
  const image = PNG.sync.read(buffer)
  let visible = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (Math.max(image.data[offset], image.data[offset + 1], image.data[offset + 2]) > 50) visible++
  }
  if (visible / (image.width * image.height) < 0.035) throw new Error(`${name} has insufficient rendered content`)
  results.push(`${name}: ${image.width} x ${image.height}, ${Math.round(buffer.length / 1024)} KB`)
}

try {
  await mkdir(destination, { recursive: true })
  const page = await openPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 })
  await capture(page, 'night-city.png')
  await page.evaluate(() => {
    const app = window.__city
    const building = app.layout.chunks.get('0:0').building
    const target = { x: building.x, z: building.z + building.depth / 2 }
    const position = { x: building.x - 8, z: target.z + 13 }
    app.teleport(position, Math.atan2(position.x - target.x, position.z - target.z), 0.14)
  })
  await capture(page, 'storefront.png')
  for (const [name, file] of [['NIGHT WIRE', 'noodle-bar.png'], ['GHOST SIGNAL', 'arcade.png'], ['SECOND SKIN', 'cyber-clinic.png']]) {
    await page.getByRole('button', { name: 'Places and interiors', exact: true }).click()
    await page.getByRole('button', { name: `Visit ${name}`, exact: true }).click()
    await page.waitForFunction(venue => window.__city.snapshot().location?.building.venue.name === venue, name)
    await capture(page, file)
  }
  await page.getByRole('button', { name: 'Places and interiors', exact: true }).click()
  await page.getByRole('button', { name: 'Visit an apartment', exact: true }).click()
  await page.waitForFunction(() => window.__city.snapshot().location?.floor > 0)
  await capture(page, 'apartment.png')
  await page.close()
  const mobile = await openPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  await capture(mobile, 'mobile.png')
  await mobile.close()
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(results.join('\n'))
  console.log('All showcase screenshots rendered without browser errors.')
} finally {
  await browser.close()
}