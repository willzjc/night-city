import test from 'node:test'
import assert from 'node:assert/strict'
import { CITY, createBlock } from '../src/layout.js'
import { INTERIOR, buildingShell, createFloor, floorAt } from '../src/interiors.js'
import { createWalker } from '../src/physics.js'
import { VENUES } from '../src/venues.js'

test('floor plans are deterministic, varied, and bounded by their shells', () => {
  for (const [column, row] of [[0, 0], [-1, 0], [-14, 22]]) {
    const building = createBlock(column, row).building
    if (!building) continue
    const ground = createFloor(building, 0)
    assert.deepEqual(ground, createFloor(building, 0))
    assert.notDeepEqual(ground.rooms, createFloor(building, 1).rooms)
    assert.ok(ground.rooms.length >= 3)
    for (const piece of ground.solids) {
      assert.ok(Math.abs(piece.x - building.x) + piece.width / 2 <= building.width / 2 + 0.01)
      assert.ok(Math.abs(piece.z - building.z) + piece.depth / 2 <= building.depth / 2 + 0.01)
      assert.ok(piece.height > 0 && piece.width > 0 && piece.depth > 0)
    }
    assert.equal(floorAt(building, INTERIOR.base + CITY.floorHeight + 1.675), 1)
    assert.equal(createFloor(building, building.floors - 1).solids.some(piece => piece.kind === 'step'), false)
  }
})

async function interiorWalker() {
  const block = createBlock(0, 0)
  const building = block.building
  const floors = [0, 1, 2].map(level => createFloor(building, level))
  const walker = await createWalker({ extent: CITY.extent, colliders: [block.colliders[0], ...buildingShell(building), ...floors.flatMap(floor => floor.solids)] })
  return { walker, building, floors }
}

function walkTo(walker, target, tolerance = 0.18) {
  for (let frame = 0; frame < 900; frame++) {
    const offsetX = target.x - walker.position.x
    const offsetZ = target.z - walker.position.z
    if (Math.hypot(offsetX, offsetZ) < tolerance) {
      for (let rest = 0; rest < 18; rest++) walker.update({}, 0)
      return
    }
    walker.update({ forward: Math.min(1, Math.hypot(offsetX, offsetZ) * 1.3) }, Math.atan2(-offsetX, -offsetZ))
  }
  assert.fail(`Could not walk to ${JSON.stringify(target)} from ${JSON.stringify(walker.position)}`)
}

test('a character can enter through the door, visit a room, and return to the street', async () => {
  const { walker, building, floors } = await interiorWalker()
  try {
    const street = { x: building.x, z: building.z + building.depth / 2 + 3 }
    walker.reset(street)
    const room = floors[0].rooms[0]
    walkTo(walker, { x: building.x, z: room.z })
    walkTo(walker, { x: room.door.x - 0.9, z: room.door.z })
    assert.ok(walker.position.x < room.door.x - 0.5)
    walkTo(walker, { x: building.x, z: room.z })
    walkTo(walker, street)
    assert.ok(walker.position.z > building.z + building.depth / 2)
  } finally {
    walker.dispose()
  }
})

test('switchback stairs connect two upper floors and can be descended', async () => {
  const { walker, floors } = await interiorWalker()
  try {
    walker.reset({ ...floors[0].stairs.entry, y: INTERIOR.base + 0.9 })
    for (let level = 0; level < 2; level++) {
      const stairs = floors[level].stairs
      if (level > 0) walkTo(walker, stairs.entry)
      walkTo(walker, stairs.turn)
      walkTo(walker, stairs.across)
      walkTo(walker, stairs.exit)
      assert.ok(Math.abs(walker.position.y - (INTERIOR.base + CITY.floorHeight * (level + 1) + 1.675)) < 0.12)
    }
    for (let level = 1; level >= 0; level--) {
      const stairs = floors[level].stairs
      walkTo(walker, stairs.exit)
      walkTo(walker, stairs.across)
      walkTo(walker, stairs.turn)
      walkTo(walker, stairs.entry)
    }
    assert.ok(Math.abs(walker.position.y - (INTERIOR.base + 1.675)) < 0.12)
  } finally {
    walker.dispose()
  }
})

test('cyberpunk venues have distinct furnishings and readable entrances without blocking the corridor', () => {
  const original = createBlock(0, 0).building
  for (const venue of VENUES) {
    const building = { ...original, venue, shop: venue.type }
    const floor = createFloor(building, 0)
    const feature = { 'NOODLE BAR': 'service-counter', 'CYBER CLINIC': 'treatment-chair', ARCADE: 'arcade-cabinet', LOUNGE: 'bar' }[venue.type]
    assert.ok(floor.solids.some(solid => solid.kind === feature))
    assert.ok(floor.decorations.some(detail => detail.kind === 'neon' || detail.kind === 'ceiling-light'))
    assert.ok(floor.labels.some(label => label.text === 'EXIT / STREET'))
    const frontRoom = floor.rooms.find(room => room.type === venue.type)
    assert.ok(frontRoom)
    for (const solid of floor.solids) {
      if (solid.kind === 'floor' || solid.y - solid.height / 2 > 2.8) continue
      assert.ok(Math.abs(solid.x - building.x) >= 1.4 + solid.width / 2, `Corridor blocked by ${solid.kind}`)
    }
  }
})