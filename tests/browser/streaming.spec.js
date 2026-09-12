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

function pixelCoverage(buffer) {
  const image = PNG.sync.read(buffer)
  let lit = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (Math.max(image.data[offset], image.data[offset + 1], image.data[offset + 2]) > 40) lit++
  }
  return lit / (image.width * image.height)
}

test('walks beyond the old boundary and renders newly streamed neighborhoods', async ({ page }, testInfo) => {
  await page.evaluate(() => window.__city.teleport({ x: 180, z: 0 }, -Math.PI / 2, 0.1))
  await page.locator('#city').focus()
  await page.keyboard.down('w')
  await page.keyboard.down('Shift')
  await page.waitForFunction(() => window.__city.snapshot().position.x > 200)
  await page.keyboard.up('w')
  await page.keyboard.up('Shift')
  const crossed = await page.evaluate(() => window.__city.snapshot())
  expect(crossed.blocks).toBe(81)
  expect(crossed.renderedBlocks).toBeGreaterThan(70)
  const original = await page.evaluate(() => JSON.stringify([...window.__city.layout.buildings].sort((first, second) => first.id.localeCompare(second.id))))
  await page.evaluate(() => window.__city.teleport({ x: 6000, z: 0 }, -Math.PI / 2, 0.1))
  await page.waitForFunction(() => window.__city.snapshot().frames > 10 && window.__city.snapshot().origin.x > 4000)
  const far = await page.evaluate(() => ({ state: window.__city.snapshot(), camera: window.__city.camera.position.toArray(), buildings: JSON.stringify(window.__city.layout.buildings) }))
  expect(far.state.blocks).toBe(81)
  expect(far.state.colliders).toBeLessThan(8000)
  expect(far.buildings).not.toBe(original)
  expect(Math.abs(far.camera[0])).toBeLessThan(1024)
  const screenshot = await page.locator('#city').screenshot()
  expect(pixelCoverage(screenshot)).toBeGreaterThan(0.04)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-endless.png` })
  await page.evaluate(position => window.__city.teleport(position, -Math.PI / 2, 0.1), { x: crossed.position.x, z: crossed.position.z })
  const revisited = await page.evaluate(() => ({ buildings: JSON.stringify([...window.__city.layout.buildings].sort((first, second) => first.id.localeCompare(second.id))), geometries: window.__city.renderer.renderer.info.memory.geometries }))
  expect(revisited.buildings).toBe(original)
  expect(revisited.geometries).toBeLessThan(1800)
})

test('pedestrians and shaped traffic animate in the live scene', async ({ page }, testInfo) => {
  const initial = await page.evaluate(() => ({ population: window.__city.city.population.snapshot(), time: window.__city.snapshot().time }))
  expect(initial.population.pedestrians).toBe(100)
  expect(initial.population.cars).toBe(60)
  expect(new Set(initial.population.vehicles.map(car => car.kind)).size).toBe(4)
  await page.waitForFunction(time => window.__city.snapshot().time > time + 0.5, initial.time)
  const moved = await page.evaluate(() => window.__city.city.population.snapshot())
  expect(moved.people[0].stride).not.toBe(initial.population.people[0].stride)
  expect(moved.people[0].position).not.toEqual(initial.population.people[0].position)
  expect(moved.vehicles.some((car, index) => car.position.x !== initial.population.vehicles[index].position.x || car.position.z !== initial.population.vehicles[index].position.z)).toBe(true)
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click()
  await page.evaluate(() => {
    const car = window.__city.city.population.snapshot().vehicles.find(car => car.id.startsWith('z/0/-1/1'))
    const position = { x: car.position.x + 4.8, z: car.position.z - 6.3 }
    const yaw = Math.atan2(position.x - car.position.x, position.z - car.position.z)
    window.__city.teleport(position, yaw, -0.09)
  })
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-traffic.png` })
  expect(pixelCoverage(await page.locator('#city').screenshot())).toBeGreaterThan(0.04)
  await page.evaluate(() => {
    const person = [...window.__city.city.population.pedestrians.values()].find(actor => actor.block.column === 0 && actor.block.row === 1)
    const position = { x: person.position.x + 3.3, z: person.position.z + 4.8 }
    const yaw = Math.atan2(position.x - person.position.x, position.z - person.position.z)
    window.__city.teleport(position, yaw, -0.12)
  })
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-pedestrian.png` })
})

test('enters a generated lobby and renders an upper floor', async ({ page }, testInfo) => {
  const building = await page.evaluate(() => {
    const building = window.__city.layout.chunks.get('0:0').building
    window.__city.teleport({ x: building.x, z: building.z + building.depth / 2 + 2 }, 0, -0.04)
    return building
  })
  await page.locator('#city').focus()
  await page.keyboard.down('w')
  await page.waitForFunction(front => window.__city.snapshot().position.z < front - 4, building.z + building.depth / 2)
  await page.keyboard.up('w')
  const state = await page.evaluate(() => window.__city.snapshot())
  expect(state.location.building.id).toBe(building.id)
  expect(state.location.floor).toBe(0)
  expect(state.floors).toBeGreaterThan(0)
  expect(pixelCoverage(await page.locator('#city').screenshot())).toBeGreaterThan(0.04)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-interior.png` })
  await page.evaluate(building => {
    window.__city.teleport({ x: building.x, z: building.z, y: 0.24 + 4.2 * 2 + 0.9 }, -0.65, -0.1)
  }, building)
  await page.waitForFunction(() => window.__city.snapshot().location?.floor === 2)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-upper-floor.png` })
  expect(pixelCoverage(await page.locator('#city').screenshot())).toBeGreaterThan(0.04)
})

test('walking up and down stairs keeps the required streamed floors loaded', async ({ page }, testInfo) => {
  const result = await page.evaluate(() => {
    const app = window.__city
    const building = app.layout.chunks.get('0:0').building
    app.teleport({ x: building.x, y: 1.14, z: building.z })
    const groundFloor = app.layout.interiors.get(`${building.id}/0`)
    app.teleport({ ...groundFloor.stairs.entry, y: 1.14 }, 0, 0)
    function walkTo(target) {
      for (let frame = 0; frame < 800; frame++) {
        const offsetX = target.x - app.walker.position.x
        const offsetZ = target.z - app.walker.position.z
        app.layout.update(app.walker.position)
        app.walker.syncLayout(app.layout)
        if (Math.hypot(offsetX, offsetZ) < 0.18) {
          for (let rest = 0; rest < 18; rest++) app.walker.update({}, 0)
          return
        }
        app.walker.update({ forward: Math.min(1, Math.hypot(offsetX, offsetZ) * 1.3) }, Math.atan2(-offsetX, -offsetZ))
      }
      throw new Error(`Stair traversal blocked at ${JSON.stringify(app.walker.position)}`)
    }
    const heights = []
    for (let level = 0; level < 3; level++) {
      const plan = app.layout.interiors.get(`${building.id}/${level}`)
      for (const point of [plan.stairs.entry, plan.stairs.turn, plan.stairs.across, plan.stairs.exit]) walkTo(point)
      heights.push(app.walker.position.y)
    }
    for (let level = 2; level >= 0; level--) {
      const plan = app.layout.interiors.get(`${building.id}/${level}`)
      for (const point of [plan.stairs.exit, plan.stairs.across, plan.stairs.turn, plan.stairs.entry]) walkTo(point)
    }
    app.city.sync(app.walker.position, true)
    return { heights, ground: app.walker.position.y, floors: app.layout.interiors.size }
  })
  result.heights.forEach((height, index) => expect(height).toBeCloseTo(0.24 + 1.675 + (index + 1) * 4.2, 1))
  expect(result.ground).toBeCloseTo(0.24 + 1.675, 1)
  expect(result.floors).toBeLessThan(28)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-stairs.png` })
})