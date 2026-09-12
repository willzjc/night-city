import test from 'node:test'
import assert from 'node:assert/strict'
import { CITY, createBlock, createLayout, streetCoordinate, streetIndex } from '../src/layout.js'
import { createFloor } from '../src/interiors.js'
import { StreamingLayout } from '../src/streaming.js'

test('blocks are stable regardless of generation order and distance from the origin', () => {
  for (const [column, row] of [[0, 0], [-200, 390], [5000000, -3000000]]) {
    const first = createBlock(column, row)
    createBlock(row, column, 191)
    assert.deepEqual(createBlock(column, row), first)
    assert.notDeepEqual(createBlock(column, row, 12), first)
    assert.equal(first.x, (streetCoordinate(column) + streetCoordinate(column + 1)) / 2)
    assert.equal(first.z, (streetCoordinate(row, 'z') + streetCoordinate(row + 1, 'z')) / 2)
    assert.equal(streetIndex(first.x), column)
    assert.equal(streetIndex(first.z, 'z'), row)
  }
})

test('overlapping neighborhoods reproduce identical blocks', () => {
  const initial = createLayout()
  const adjacent = createLayout(CITY.seed, { column: 1, row: -1 })
  let matched = 0
  for (const block of initial.blocks) {
    const other = adjacent.blocks.find(candidate => candidate.key === block.key)
    if (other) {
      assert.deepEqual(block, other)
      matched++
    }
  }
  assert.equal(matched, 49)
})

test('streaming bounds memory, unloads old blocks, and reconstructs revisited interiors', () => {
  const stream = new StreamingLayout()
  const building = createBlock(0, 0).building
  const entrance = { x: building.x, y: 1.92, z: building.z + building.depth / 2 - 1 }
  stream.update(entrance)
  const interior = stream.interiors.get(`${building.id}/0`)
  assert.ok(interior)
  for (let index = 1; index <= 30; index++) {
    stream.update({ x: index * 4400, y: 1.675, z: -index * 1980 })
    assert.equal(stream.blocks.length, 81)
    assert.ok(stream.interiors.size <= 27)
    assert.equal(stream.collisionGroups.size, stream.blocks.length + stream.interiors.size)
    assert.ok(Math.abs(index * 4400 - stream.origin.x) < CITY.cell + 22)
  }
  assert.equal(stream.chunks.has('0:0'), false)
  stream.update(entrance)
  assert.deepEqual(stream.interiors.get(interior.key), interior)
  assert.equal(stream.locationAt(entrance).floor, 0)
})

test('every floor has valid bounded geometry, clear entrance, and connected stair openings', () => {
  for (const [column, row] of [[0, 0], [-1, 0], [17, -25]]) {
    const building = createBlock(column, row).building
    if (!building) continue
    for (let floor = 0; floor < building.floors; floor++) {
      const plan = createFloor(building, floor)
      assert.deepEqual(plan, createFloor(building, floor))
      for (const solid of plan.solids) {
        assert.ok(solid.width > 0 && solid.height > 0 && solid.depth > 0)
        assert.ok(Math.abs(solid.x - building.x) + solid.width / 2 <= building.width / 2 + 0.01)
        assert.ok(Math.abs(solid.z - building.z) + solid.depth / 2 <= building.depth / 2 + 0.01)
      }
      if (floor > 0) {
        assert.equal(plan.solids.filter(solid => solid.kind === 'floor').length, 2)
      }
      assert.equal(plan.solids.filter(solid => solid.kind === 'step').length, floor === building.floors - 1 ? 0 : 24)
    }
  }
})

test('blocks and building footprints vary while keeping every street connected', () => {
  const layout = createLayout()
  assert.ok(new Set(layout.blocks.map(block => Math.round(block.width))).size >= 5)
  assert.ok(new Set(layout.blocks.map(block => Math.round(block.depth))).size >= 5)
  assert.ok(Math.max(...layout.blocks.map(block => block.width)) - Math.min(...layout.blocks.map(block => block.width)) > 12)
  assert.ok(Math.max(...layout.blocks.map(block => block.depth)) - Math.min(...layout.blocks.map(block => block.depth)) > 12)
  assert.ok(Math.max(...layout.buildings.map(building => building.width)) > Math.min(...layout.buildings.map(building => building.width)) * 1.5)
  assert.ok(Math.max(...layout.buildings.map(building => building.height)) > Math.min(...layout.buildings.map(building => building.height)) * 4)
  for (const block of layout.blocks) {
    const neighbor = createBlock(block.column + 1, block.row)
    assert.equal(block.east, neighbor.west)
    for (const building of block.buildings) {
      assert.ok(Math.abs(building.x - block.x) + building.width / 2 < block.width / 2 - 2)
      assert.ok(Math.abs(building.z - block.z) + building.depth / 2 < block.depth / 2 - 2)
    }
  }
})