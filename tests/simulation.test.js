import test from 'node:test'
import assert from 'node:assert/strict'
import { CITY, SPAWN, createLayout, districtAt } from '../src/layout.js'
import { createWalker } from '../src/physics.js'
import { StreamingLayout } from '../src/streaming.js'

test('city generation is deterministic and preserves walkable streets', () => {
  const layout = createLayout()
  assert.deepEqual(layout, createLayout())
  assert.notDeepEqual(layout.buildings, createLayout(41).buildings)
  assert.equal(layout.blocks.length, 64)
  assert.ok(layout.buildings.length >= 50)
  for (const building of layout.buildings) {
    const block = layout.blocks.find(block => block.buildings.includes(building))
    assert.ok(Math.abs(building.x - block.x) + building.width / 2 < block.width / 2)
    assert.ok(Math.abs(building.z - block.z) + building.depth / 2 < block.depth / 2)
    assert.ok(Math.abs(SPAWN.x - building.x) > building.width / 2 || Math.abs(SPAWN.z - building.z) > building.depth / 2)
  }
})

test('walking settles at human eye level and stays out of buildings', async () => {
  const layout = createLayout()
  const walker = await createWalker(layout)
  try {
    for (let frame = 0; frame < 60; frame++) walker.update({}, 0)
    assert.ok(Math.abs(walker.position.y - 1.675) < 0.04)
    assert.equal(walker.grounded, true)
    const building = layout.blocks.find(block => block.key === '0:0').building
    walker.reset({ x: 0, z: building.z })
    for (let frame = 0; frame < 240; frame++) walker.update({ strafe: 1 }, 0)
    assert.ok(walker.position.x > 7, 'the character can step onto the sidewalk')
    assert.ok(walker.position.x < building.x - building.width / 2 - 0.25, 'the building blocks the character')
  } finally {
    walker.dispose()
  }
})

test('diagonal input is normalized and jumps return to the pavement', async () => {
  const walker = await createWalker(createLayout())
  try {
    walker.reset({ x: 0, z: 0 })
    for (let frame = 0; frame < 30; frame++) walker.update({ forward: 1 }, 0)
    const straight = Math.hypot(walker.position.x, walker.position.z)
    walker.reset({ x: 0, z: 0 })
    for (let frame = 0; frame < 30; frame++) walker.update({ forward: 1, strafe: 1 }, 0)
    assert.ok(Math.abs(Math.hypot(walker.position.x, walker.position.z) - straight) < 0.01)
    for (let frame = 0; frame < 30; frame++) walker.update({}, 0)
    const ground = walker.position.y
    walker.update({ jump: true }, 0)
    for (let frame = 0; frame < 15; frame++) walker.update({}, 0)
    assert.ok(walker.position.y > ground + 0.7)
    for (let frame = 0; frame < 120; frame++) walker.update({}, 0)
    assert.ok(Math.abs(walker.position.y - ground) < 0.02)
  } finally {
    walker.dispose()
  }
})

test('walking crosses the old boundary and streaming stays bounded through origin shifts', async () => {
  const layout = new StreamingLayout()
  const walker = await createWalker(layout)
  try {
    walker.reset({ x: 175, z: 0 })
    for (let frame = 0; frame < 180; frame++) {
      layout.update(walker.position)
      walker.syncLayout(layout)
      walker.update({ strafe: 1, sprint: true }, 0)
    }
    assert.ok(walker.position.x > 198)
    for (const coordinate of [1040, -4600, 23000000]) {
      layout.update({ x: coordinate, y: 1.675, z: 0 })
      walker.syncLayout(layout)
      walker.reset({ x: coordinate, z: 0 })
      for (let frame = 0; frame < 90; frame++) walker.update({ strafe: 1 }, 0)
      assert.ok(walker.position.x > coordinate + 6)
      assert.ok(Math.abs(walker.body.translation().x) < CITY.rebaseDistance)
      assert.equal(walker.groups.size, layout.collisionGroups.size)
      assert.ok(walker.world.colliders.len() < 8000)
    }
    layout.update({ ...SPAWN, y: 1.675 })
    walker.syncLayout(layout)
    walker.reset()
    assert.ok(Math.abs(walker.position.x - SPAWN.x) < 0.01)
    assert.ok(Math.abs(walker.position.z - SPAWN.z) < 0.01)
    assert.equal(districtAt(walker.position).name, 'LOWER CENTRAL')
  } finally {
    walker.dispose()
  }
})