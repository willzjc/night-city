import { test, expect } from '@playwright/test'
import { PNG } from 'pngjs'

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

function litPixels(image, minimumX, maximumX) {
  let count = 0
  for (let positionY = 80; positionY < image.height - 180; positionY++) {
    for (let positionX = Math.round(minimumX * image.width); positionX < Math.round(maximumX * image.width); positionX++) {
      const offset = (positionY * image.width + positionX) * 4
      if (Math.max(image.data[offset], image.data[offset + 1], image.data[offset + 2]) > 45) count++
    }
  }
  return count
}

test('solid and split modes reveal the same live city beneath the ASCII', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click()
  const original = await page.evaluate(() => window.__city.snapshot())
  const ascii = PNG.sync.read(await page.locator('#city').screenshot())
  await page.evaluate(() => window.__city.renderer.setMode('solid'))
  const solid = PNG.sync.read(await page.locator('#city').screenshot())
  expect(litPixels(solid, 0.08, 0.92)).toBeGreaterThan(litPixels(ascii, 0.08, 0.92) * 1.7)
  await page.evaluate(() => { window.__city.renderer.setMode('split'); window.__city.renderer.setReveal(0.5) })
  const split = PNG.sync.read(await page.locator('#city').screenshot())
  expect(litPixels(split, 0.55, 0.9)).toBeCloseTo(litPixels(solid, 0.55, 0.9), -1)
  expect(litPixels(split, 0.1, 0.45)).toBeLessThan(litPixels(solid, 0.1, 0.45) * 0.65)
  const state = await page.evaluate(() => ({ simulation: window.__city.snapshot(), stats: window.__city.renderer.stats }))
  expect(state.simulation.position).toEqual(original.position)
  expect(state.simulation.time).toBe(original.time)
  expect(state.stats.drawCalls).toBeGreaterThan(20)
  expect(state.stats.triangles).toBeGreaterThan(10000)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-split.png` })
  await page.evaluate(() => window.__city.renderer.setMode('ascii'))
  expect(await page.evaluate(() => window.__city.renderer.target.width)).toBe(original.columns * 2)
})

test('City Lab switches rendering modes and its comparison slider works through the UI', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'City Lab', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'CITY LAB', exact: true })
  await expect(panel).toBeVisible()
  await page.getByRole('button', { name: 'SPLIT', exact: true }).click()
  await expect(page.locator('#reveal-controls')).toBeVisible()
  await page.locator('#lab-reveal').focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  expect(await page.evaluate(() => window.__city.renderer.uniforms.reveal.value)).toBeCloseTo(0.02, 5)
  await page.locator('#lab-reveal').press('End')
  expect(await page.evaluate(() => window.__city.renderer.uniforms.reveal.value)).toBe(1)
  await page.locator('#lab-reveal').evaluate(element => { element.value = '50'; element.dispatchEvent(new Event('input', { bubbles: true })) })
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-city-lab.png` })
  await page.getByRole('button', { name: 'Close City Lab', exact: true }).click()
  const slider = page.getByRole('slider', { name: 'ASCII and solid split position', exact: true })
  const bounds = await slider.boundingBox()
  await page.mouse.click(bounds.x + bounds.width * 0.7, bounds.y + bounds.height / 2)
  const reveal = await page.evaluate(() => window.__city.renderer.uniforms.reveal.value)
  expect(reveal).toBeGreaterThan(0.64)
  expect(reveal).toBeLessThan(0.76)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-comparison.png` })
  await page.getByRole('button', { name: 'City Lab', exact: true }).click()
  await page.getByRole('button', { name: 'SOLID 3D', exact: true }).click()
  await expect(page.locator('#reveal-controls')).toBeHidden()
  expect(await page.evaluate(() => window.__city.renderer.mode)).toBe('solid')
  await page.getByRole('button', { name: 'ASCII', exact: true }).click()
  expect(await page.evaluate(() => window.__city.renderer.mode)).toBe('ascii')
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(page.getByRole('button', { name: 'City Lab', exact: true })).toBeFocused()
})

test('streaming atlas reports real generation and unloading during a one-kilometer jump and return', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click()
  const original = await page.evaluate(() => ({ position: window.__city.walker.position, generated: window.__city.layout.metrics.generated, unloaded: window.__city.layout.metrics.unloaded, keys: [...window.__city.layout.chunks.keys()].sort() }))
  await page.getByRole('button', { name: 'City Lab', exact: true }).click()
  await expect(page.locator('#stream-grid button')).toHaveCount(81)
  await expect(page.locator('#stat-resident')).toHaveText('81 / 81')
  await page.getByRole('button', { name: '+1 KM', exact: true }).click()
  await page.waitForFunction(start => window.__city.walker.position.x >= start + 999, original.position.x)
  const jumped = await page.evaluate(() => ({ position: window.__city.walker.position, metrics: window.__city.layout.metrics, size: window.__city.layout.chunks.size }))
  expect(jumped.metrics.generated).toBeGreaterThan(original.generated)
  expect(jumped.metrics.unloaded).toBeGreaterThan(original.unloaded)
  expect(jumped.metrics.generated - jumped.metrics.unloaded).toBe(81)
  expect(jumped.size).toBe(81)
  await expect(page.locator('#stat-generated')).toHaveText(jumped.metrics.generated.toLocaleString('en-US'))
  await expect(page.locator('#stat-unloaded')).toHaveText(jumped.metrics.unloaded.toLocaleString('en-US'))
  await page.getByRole('button', { name: 'RETURN', exact: true }).click()
  await page.waitForFunction(position => Math.abs(window.__city.walker.position.x - position.x) < 0.05 && Math.abs(window.__city.walker.position.z - position.z) < 0.05, original.position)
  expect(await page.evaluate(() => [...window.__city.layout.chunks.keys()].sort())).toEqual(original.keys)
  await expect(page.getByRole('button', { name: 'RETURN', exact: true })).toBeDisabled()
  const blockKey = await page.locator('.stream-cell:not(.cell-park)').first().getAttribute('data-block-key')
  await page.locator(`[data-block-key="${blockKey}"]`).click()
  expect(await page.evaluate(() => window.__city.scanner.target.building.id)).toContain(blockKey)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-atlas-target.png` })
})

test('building scan identifies the aimed building, visits its interior, and handles an empty view', async ({ page }, testInfo) => {
  const building = await page.evaluate(() => {
    const building = window.__city.layout.chunks.get('0:0').building
    window.__city.teleport({ x: building.x, z: building.z + building.depth / 2 + 8 }, 0, 0.1)
    return building
  })
  await page.getByRole('button', { name: 'Scan building (Q)', exact: true }).click()
  await expect(page.getByRole('region', { name: building.venue.name, exact: true })).toBeVisible()
  await expect(page.locator('#scan-floors')).toHaveText(String(building.floors))
  expect(await page.evaluate(() => window.__city.scanner.outline.visible)).toBe(true)
  const sweep = await page.evaluate(() => window.__city.scanner.sweep.scale.x)
  await page.waitForFunction(radius => window.__city.scanner.sweep.scale.x > radius + 4, sweep)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-scan.png` })
  await page.getByRole('button', { name: 'ENTRANCE', exact: true }).click()
  expect((await page.evaluate(() => window.__city.walker.position)).z).toBeCloseTo(building.z + building.depth / 2 + 4, 1)
  await page.getByRole('button', { name: 'INTERIOR', exact: true }).click()
  await page.waitForFunction(id => window.__city.layout.locationAt(window.__city.walker.position)?.building.id === id, building.id)
  await page.getByRole('button', { name: 'Clear scan', exact: true }).click()
  await expect(page.locator('#scan-panel')).toBeHidden()
  expect(await page.evaluate(() => window.__city.scanner.target)).toBeNull()
  await page.evaluate(() => window.__city.teleport({ x: 0, z: 98 }, 0, Math.PI / 2))
  await page.locator('#city').focus()
  await page.keyboard.press('q')
  await expect(page.locator('#scan-title')).toHaveText('NO BUILDING IN RANGE')
  expect(await page.evaluate(() => window.__city.scanner.outline.visible)).toBe(false)
  await expect(page.getByRole('button', { name: 'INTERIOR', exact: true })).toBeHidden()
})

test('City Lab and scan panels fit a narrow viewport without blocking the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.getByRole('button', { name: 'City Lab', exact: true }).click()
  const panel = await page.locator('#lab-panel').boundingBox()
  expect(panel.x).toBeGreaterThanOrEqual(0)
  expect(panel.x + panel.width).toBeLessThanOrEqual(360)
  expect(panel.y + panel.height).toBeLessThanOrEqual(751)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  await expect(page.locator('#city')).toBeVisible()
  await page.getByRole('button', { name: 'Close City Lab', exact: true }).click()
  await expect(page.locator('#lab-panel')).toBeHidden()
})