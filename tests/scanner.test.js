import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { CityScanner, scanBuilding } from '../src/scanner.js'
import { StreamingLayout } from '../src/streaming.js'

test('scanning selects the nearest building along the view and rejects empty or invalid rays', () => {
  const near = { id: 'near', x: 0, z: -20, width: 10, depth: 10, height: 20 }
  const far = { ...near, id: 'far', z: -45 }
  const position = { x: 0, y: 1.7, z: 0 }
  const direction = { x: 0, y: 0, z: -1 }
  assert.equal(scanBuilding([far, near], position, direction).building.id, 'near')
  assert.equal(scanBuilding([near], position, direction).distance, 15)
  assert.equal(scanBuilding([near], position, { x: 1, y: 0, z: 0 }), null)
  assert.equal(scanBuilding([near], position, { x: 0, y: 1, z: 0 }), null)
  assert.equal(scanBuilding([near], position, direction, 10), null)
  assert.equal(scanBuilding([near], position, { x: 0, y: 0, z: 0 }), null)
  assert.equal(scanBuilding([near], { x: NaN, y: 1, z: 0 }, direction), null)
  assert.equal(scanBuilding([near], { x: 0, y: 1.7, z: -20 }, direction).distance, 0)
})

test('scan geometry follows origin shifts, clears unloaded targets, and is disposed', () => {
  const scene = new THREE.Scene()
  const layout = new StreamingLayout()
  const scanner = new CityScanner(scene, layout)
  const building = layout.buildings[0]
  const position = { x: building.x, y: 1.7, z: building.z + building.depth / 2 + 4 }
  scanner.trigger(position, { x: 0, y: 0, z: -1 })
  assert.equal(scanner.target.building.id, building.id)
  assert.equal(scanner.outline.visible, true)
  scanner.update(0.5, position)
  assert.ok(scanner.sweep.scale.x > 30)
  layout.origin = { x: 1000, z: 2000 }
  scanner.update(0, position)
  assert.equal(scanner.outline.position.x, building.x - 1000)
  scanner.reducedMotion = true
  scanner.trigger(position, { x: 0, y: 0, z: -1 })
  assert.equal(scanner.sweep.visible, false)
  assert.equal(scanner.outline.visible, true)
  layout.update({ x: 10000, y: 1.7, z: 10000 })
  scanner.update(0.1, { x: 10000, y: 1.7, z: 10000 })
  assert.equal(scanner.target, null)
  scanner.dispose()
  assert.equal(scene.children.length, 0)
})

test('stream counters record generation and eviction without retaining an unbounded history', () => {
  const layout = new StreamingLayout()
  assert.equal(layout.metrics.generated, 81)
  assert.equal(layout.metrics.unloaded, 0)
  for (let step = 1; step <= 20; step++) {
    layout.update({ x: step * 1500, y: 1.7, z: 0 })
    assert.equal(layout.metrics.generated - layout.metrics.unloaded, 81)
    assert.ok(layout.lastChange.added.length <= 81)
    assert.ok(layout.lastChange.removed.length <= 81)
  }
  assert.ok(layout.metrics.originShifts >= 10)
})