import { test, expect } from '@playwright/test'
import { PNG } from 'pngjs'
import { VENUES } from '../../src/venues.js'

test.beforeEach(async ({ page }) => {
  page.runtimeErrors = []
  page.on('pageerror', error => page.runtimeErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') page.runtimeErrors.push(message.text()) })
  await page.goto('/')
  await page.waitForFunction(() => window.__city?.ready && window.__city.snapshot().frames > 4)
})

test.afterEach(async ({ page }) => {
  expect(page.runtimeErrors).toEqual([])
})

function coverage(buffer) {
  const image = PNG.sync.read(buffer)
  let lit = 0
  let saturated = 0
  let black = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const maximum = Math.max(image.data[offset], image.data[offset + 1], image.data[offset + 2])
    const minimum = Math.min(image.data[offset], image.data[offset + 1], image.data[offset + 2])
    if (maximum > 50) lit++
    if (maximum > 100 && maximum - minimum > 45) saturated++
    if (maximum < 12) black++
  }
  const area = image.width * image.height
  return { lit: lit / area, saturated: saturated / area, black: black / area }
}

for (const venue of VENUES) {
  test(`visits ${venue.type.toLowerCase()} through Places and exits into the city`, async ({ page }, testInfo) => {
    await page.getByRole('button', { name: 'Places and interiors', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'PLACES / INTERIORS', exact: true })).toBeVisible()
    await page.getByRole('button', { name: `Visit ${venue.name}`, exact: true }).click()
    await page.waitForFunction(type => window.__city.snapshot().location?.building.shop === type, venue.type)
    await expect(page.locator('#district-name')).toHaveText(venue.name)
    await expect(page.locator('#city')).toBeFocused()
    const state = await page.evaluate(() => {
      const app = window.__city
      const location = app.layout.locationAt(app.walker.position)
      const floor = app.layout.interiors.get(`${location.building.id}/0`)
      return { location, props: floor.solids.map(solid => solid.kind), rain: app.city.weather.rain.visible, eye: app.walker.position.y }
    })
    expect(state.location.floor).toBe(0)
    expect(state.rain).toBe(false)
    const feature = { 'NOODLE BAR': 'service-counter', 'CYBER CLINIC': 'treatment-chair', ARCADE: 'arcade-cabinet', LOUNGE: 'bar' }[venue.type]
    expect(state.props).toContain(feature)
    if (!(await page.locator('#map-panel').isVisible())) await page.getByRole('button', { name: 'Toggle city map', exact: true }).click()
    await expect(page.locator('#map-title')).toHaveText('FLOOR PLAN')
    const pixels = coverage(await page.locator('#city').screenshot())
    expect(pixels.lit).toBeGreaterThan(0.035)
    expect(pixels.saturated).toBeGreaterThan(0.002)
    expect(pixels.black).toBeGreaterThan(0.45)
    await page.screenshot({ path: `artifacts/${testInfo.project.name}-${venue.type.toLowerCase().replaceAll(' ', '-')}.png` })
    await page.getByRole('button', { name: 'Places and interiors', exact: true }).click()
    await page.getByRole('button', { name: 'Return to street', exact: true }).click()
    await page.waitForFunction(() => window.__city.snapshot().location === null)
    await expect(page.locator('#map-title')).toHaveText('NEIGHBORHOOD')
    expect(await page.evaluate(() => window.__city.city.weather.rain.visible)).toBe(true)
  })
}

test('apartment access and Places keyboard dismissal work', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Places and interiors', exact: true }).click()
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-places.png` })
  await page.keyboard.press('Escape')
  await expect(page.locator('#places-panel')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Places and interiors', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Places and interiors', exact: true }).click()
  await page.getByRole('button', { name: 'Visit an apartment', exact: true }).click()
  await page.waitForFunction(() => window.__city.snapshot().location?.floor > 0)
  await expect(page.locator('#district-name')).toHaveText('APARTMENTS')
  const before = await page.evaluate(() => window.__city.snapshot())
  await page.keyboard.down('s')
  await page.waitForFunction(position => Math.hypot(window.__city.snapshot().position.x - position.x, window.__city.snapshot().position.z - position.z) > 0.6, before.position)
  await page.keyboard.up('s')
  expect(coverage(await page.locator('#city').screenshot()).lit).toBeGreaterThan(0.035)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-apartment.png` })
})

test('rain animates outdoors, pauses with the simulation, and can be disabled', async ({ page }) => {
  const initial = await page.evaluate(() => ({ time: window.__city.city.weather.rain.material.uniforms.time.value, visible: window.__city.city.weather.rain.visible }))
  expect(initial.visible).toBe(true)
  await page.waitForFunction(time => window.__city.city.weather.rain.material.uniforms.time.value > time + 0.3, initial.time)
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click()
  const paused = await page.evaluate(() => ({ time: window.__city.city.weather.rain.material.uniforms.time.value, frame: window.__city.snapshot().frames }))
  await page.waitForFunction(frame => window.__city.snapshot().frames > frame + 4, paused.frame)
  expect(await page.evaluate(() => window.__city.city.weather.rain.material.uniforms.time.value)).toBe(paused.time)
  await page.getByRole('button', { name: 'Display settings', exact: true }).click()
  await page.getByRole('switch', { name: 'Rain', exact: true }).uncheck()
  expect(await page.evaluate(() => window.__city.city.weather.rain.visible)).toBe(false)
})