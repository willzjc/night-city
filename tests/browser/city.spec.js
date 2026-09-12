import { test, expect } from '@playwright/test'
import { PNG } from 'pngjs'

const snapshot = page => page.evaluate(() => window.__city.snapshot())

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

test('renders a multicolor ASCII skyline on black without overlapping the HUD', async ({ page }, testInfo) => {
  const image = PNG.sync.read(await page.locator('#city').screenshot())
  let lit = 0
  let black = 0
  let redPixels = 0
  let bluePixels = 0
  let greenPixels = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset]
    const green = image.data[offset + 1]
    const blue = image.data[offset + 2]
    const brightness = Math.max(red, green, blue)
    if (brightness > 40) lit++
    if (brightness < 12) black++
    if (red > 70 && red > green * 1.2 && red > blue * 1.2) redPixels++
    if (blue > 70 && blue > red * 1.3 && blue > green * 1.08) bluePixels++
    if (green > 70 && green > red * 1.15 && green > blue * 1.1) greenPixels++
  }
  const area = image.width * image.height
  expect(lit / area).toBeGreaterThan(0.05)
  expect(lit / area).toBeLessThan(0.4)
  expect(black / area).toBeGreaterThan(0.5)
  expect(Math.min(redPixels, bluePixels, greenPixels)).toBeGreaterThan(250)
  expect(await page.evaluate(() => document.fonts.check('500 25px "IBM Plex Mono"'))).toBe(true)
  const layout = await page.evaluate(() => {
    const brand = document.querySelector('.wordmark').getBoundingClientRect()
    const toolbar = document.querySelector('.toolbar').getBoundingClientRect()
    const title = document.querySelector('.location').getBoundingClientRect()
    return { overflow: document.documentElement.scrollWidth > innerWidth, brandOverlaps: brand.right > toolbar.left, titleFits: title.right <= innerWidth, canvasHeight: document.querySelector('#city').clientHeight }
  })
  expect(layout.overflow).toBe(false)
  expect(layout.brandOverlaps).toBe(false)
  expect(layout.titleFits).toBe(true)
  expect(layout.canvasHeight).toBeGreaterThan(400)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}.png` })
})

test('mouse capture turns the camera and Escape releases it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop pointer capture')
  await page.getByRole('button', { name: 'ENTER CITY', exact: true }).click()
  await page.waitForFunction(() => document.pointerLockElement?.id === 'city')
  await page.mouse.move(800, 420)
  const captured = await snapshot(page)
  await page.mouse.move(860, 440, { steps: 6 })
  await page.waitForFunction(yaw => Math.abs(window.__city.snapshot().yaw - yaw) > 0.05, captured.yaw)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.pointerLockElement === null)
  await expect(page.getByRole('button', { name: 'ENTER CITY', exact: true })).toBeVisible()
})

test('keyboard walking and turning change the first-person camera', async ({ page }) => {
  await page.locator('#city').focus()
  const initial = await snapshot(page)
  await page.keyboard.down('w')
  await page.waitForFunction(startZ => window.__city.snapshot().position.z < startZ - 1.5, initial.position.z)
  await page.keyboard.up('w')
  await page.keyboard.down('ArrowLeft')
  await page.waitForFunction(startYaw => window.__city.snapshot().yaw > startYaw + 0.3, initial.yaw)
  await page.keyboard.up('ArrowLeft')
  const moved = await snapshot(page)
  expect(moved.position.z).toBeLessThan(initial.position.z - 1.5)
  expect(moved.yaw).toBeGreaterThan(initial.yaw + 0.3)
})

test('pause freezes traffic and physics, resume continues the world', async ({ page }) => {
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click()
  const paused = await snapshot(page)
  expect(paused.paused).toBe(true)
  await page.locator('#city').focus()
  await page.keyboard.down('w')
  await page.waitForFunction(frame => window.__city.snapshot().frames > frame + 5, paused.frames)
  await page.keyboard.up('w')
  const held = await snapshot(page)
  expect(held.time).toBe(paused.time)
  expect(held.position).toEqual(paused.position)
  await page.getByRole('button', { name: 'Resume simulation', exact: true }).click()
  await page.waitForFunction(time => window.__city.snapshot().time > time + 0.1, paused.time)
  expect((await snapshot(page)).paused).toBe(false)
})

test('display settings update density, palette, glow, and perspective', async ({ page }, testInfo) => {
  const initial = await snapshot(page)
  await page.getByRole('button', { name: 'Display settings', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.locator('#glyph-size').evaluate(element => {
    element.value = '9'
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.getByRole('radio', { name: 'Green phosphor', exact: true }).check()
  await page.getByRole('switch', { name: 'Phosphor glow', exact: true }).uncheck()
  await page.locator('#field-of-view').evaluate(element => {
    element.value = '90'
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const changed = await snapshot(page)
  expect(changed.columns).toBeLessThan(initial.columns)
  expect(changed.palette).toBe(1)
  expect(changed.glow).toBe(0)
  expect(changed.fov).toBe(90)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-settings.png` })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Display settings', exact: true })).toBeFocused()
})

test('tour moves through the streets, manual input cancels it, and reset works', async ({ page }) => {
  await page.getByRole('button', { name: 'Display settings', exact: true }).click()
  await page.getByRole('button', { name: 'TOUR', exact: true }).click()
  const initial = await snapshot(page)
  expect(initial.touring).toBe(true)
  await page.getByRole('button', { name: 'Close settings', exact: true }).click()
  await page.waitForFunction(startZ => window.__city.snapshot().position.z < startZ - 1.5, initial.position.z)
  await page.locator('#city').focus()
  await page.keyboard.press('s')
  expect((await snapshot(page)).touring).toBe(false)
  await page.getByRole('button', { name: 'Display settings', exact: true }).click()
  await page.getByRole('button', { name: 'Reset position', exact: true }).click()
  const reset = await snapshot(page)
  expect(reset.position.x).toBeCloseTo(0, 1)
  expect(reset.position.z).toBeCloseTo(98, 1)
})

test('map visibility can be toggled', async ({ page }) => {
  const map = page.locator('#map-panel')
  const visible = await map.isVisible()
  await page.getByRole('button', { name: 'Toggle city map', exact: true }).click()
  expect(await map.isVisible()).toBe(!visible)
  await page.getByRole('button', { name: 'Toggle city map', exact: true }).click()
  expect(await map.isVisible()).toBe(visible)
})

test('touch joysticks move and look, and the jump button leaves the ground', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch-specific interaction')
  const session = await page.context().newCDPSession(page)
  const move = await page.locator('#move-pad').boundingBox()
  const initial = await snapshot(page)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: move.x + move.width / 2, y: move.y + move.height / 2, id: 1 }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: move.x + move.width / 2, y: move.y + move.height / 2 - 28, id: 1 }] })
  await page.waitForFunction(startZ => window.__city.snapshot().position.z < startZ - 1, initial.position.z)
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const look = await page.locator('#look-pad').boundingBox()
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: look.x + look.width / 2, y: look.y + look.height / 2, id: 2 }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: look.x + look.width / 2 + 25, y: look.y + look.height / 2, id: 2 }] })
  await page.waitForFunction(startYaw => window.__city.snapshot().yaw < startYaw - 0.25, initial.yaw)
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const ground = (await snapshot(page)).position.y
  const jump = await page.locator('#jump-button').boundingBox()
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jump.x + jump.width / 2, y: jump.y + jump.height / 2, id: 3 }] })
  await page.waitForFunction(height => window.__city.snapshot().position.y > height + 0.4, ground)
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await session.detach()
})