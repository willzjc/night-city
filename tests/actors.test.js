import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createBlock } from '../src/layout.js'
import { createVehicle, createHuman, createPopulation, sidewalkPose } from '../src/actors.js'
import { StreamingLayout } from '../src/streaming.js'
import { disposeGroup } from '../src/mesh-batch.js'

test('vehicles have human-scale body proportions, sloped cabins, and four separate wheels', () => {
  for (const kind of ['sedan', 'taxi', 'wagon', 'van']) {
    const model = createVehicle(kind)
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
    assert.ok(size.z > 4.7 && size.z < 5)
    assert.ok(size.x > 1.9 && size.x < 2.5)
    assert.ok(size.y > 1.4 && size.y < 2.2)
    for (let index = 0; index < 4; index++) assert.ok(model.getObjectByName(`wheel-${index}`))
    assert.ok(model.getObjectByName('body').geometry.getAttribute('position').count > 1000)
    disposeGroup(model)
  }
})

test('humans have articulated limbs and remain on the variable-size sidewalks', () => {
  const model = createHuman()
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
  assert.ok(size.y > 1.7 && size.y < 1.95)
  for (const name of ['left-arm', 'right-arm', 'left-leg', 'right-leg', 'left-knee', 'right-knee']) assert.ok(model.getObjectByName(name))
  for (const [column, row] of [[0, 0], [-12, 32], [180, -200]]) {
    const block = createBlock(column, row)
    for (let distance = 0; distance < 400; distance += 2) {
      const pose = sidewalkPose(block, distance)
      assert.ok(Math.abs(pose.x - block.x) <= block.width / 2)
      assert.ok(Math.abs(pose.z - block.z) <= block.depth / 2)
      for (const building of block.buildings) assert.ok(Math.abs(pose.x - building.x) > building.width / 2 || Math.abs(pose.z - building.z) > building.depth / 2)
    }
  }
  disposeGroup(model)
})

test('the population animates and stays bounded when streaming to new neighborhoods', () => {
  const scene = new THREE.Scene()
  const layout = new StreamingLayout()
  const population = createPopulation(scene, layout)
  try {
    population.update(0, 0, { x: 0, z: 98 })
    const initial = population.snapshot()
    assert.equal(initial.pedestrians, 100)
    assert.equal(initial.cars, 60)
    population.update(0.08, 0.5, { x: 0, z: 98 })
    const moved = population.snapshot()
    assert.notDeepEqual(initial.people[0], moved.people[0])
    assert.ok(initial.vehicles.some((car, index) => car.position.z !== moved.vehicles[index].position.z || car.position.x !== moved.vehicles[index].position.x))
    for (const coordinate of [3000, -9000, 18000]) {
      const position = { x: coordinate, z: coordinate, y: 1.675 }
      layout.update(position)
      population.update(0.016, 2, position)
      assert.equal(population.pedestrians.size, 100)
      assert.equal(population.cars.size, 60)
      assert.ok([...population.pedestrians.values()].every(actor => Math.abs(actor.pose.position.x) < 1200))
    }
  } finally {
    population.dispose()
  }
})