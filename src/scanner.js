import * as THREE from 'three'
import { INTERIOR } from './layout.js'

export function scanBuilding(buildings, position, direction, range = 180) {
  const origin = new THREE.Vector3(position.x, position.y, position.z)
  const heading = new THREE.Vector3(direction.x, direction.y, direction.z)
  if (heading.lengthSq() < 0.000001 || ![...origin, ...heading, range].every(Number.isFinite) || range <= 0) return null
  const ray = new THREE.Ray(origin, heading.normalize())
  const bounds = new THREE.Box3()
  const intersection = new THREE.Vector3()
  let nearest = null
  for (const building of buildings) {
    bounds.min.set(building.x - building.width / 2, INTERIOR.base, building.z - building.depth / 2)
    bounds.max.set(building.x + building.width / 2, INTERIOR.base + building.height, building.z + building.depth / 2)
    if (bounds.containsPoint(origin)) return { building, distance: 0, point: { ...position } }
    if (!ray.intersectBox(bounds, intersection)) continue
    const distance = origin.distanceTo(intersection)
    if (distance <= range && (!nearest || distance < nearest.distance)) nearest = { building, distance, point: { x: intersection.x, y: intersection.y, z: intersection.z } }
  }
  return nearest
}

export class CityScanner {
  constructor(scene, layout) {
    this.layout = layout
    this.target = null
    this.sweepAge = 3
    this.sweepOrigin = { x: 0, z: 0 }
    this.range = 180
    this.reducedMotion = false
    this.group = new THREE.Group()
    this.group.name = 'city-scanner'
    const box = new THREE.BoxGeometry(1, 1, 1)
    this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: '#85fff2', transparent: true, opacity: 0.85, depthWrite: false }))
    box.dispose()
    this.outline.visible = false
    this.sweep = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 128), new THREE.MeshBasicMaterial({ color: '#75f7db', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }))
    this.sweep.rotation.x = -Math.PI / 2
    this.sweep.visible = false
    this.group.add(this.outline, this.sweep)
    scene.add(this.group)
  }

  trigger(position, direction) {
    this.target = scanBuilding(this.layout.buildings, position, direction, this.range)
    this.sweepOrigin = { x: position.x, z: position.z }
    this.sweepAge = 0
    this.update(0, position)
    return this.target
  }

  select(building, position) {
    this.target = { building, distance: Math.hypot(building.x - position.x, building.z - position.z), point: { x: building.x, y: 1.7, z: building.z + building.depth / 2 } }
    this.sweepOrigin = { x: position.x, z: position.z }
    this.sweepAge = 0
    this.update(0, position)
  }

  update(delta, position) {
    this.sweepAge = Math.min(3, this.sweepAge + delta)
    const radius = Math.max(0.01, this.sweepAge / 2.4 * this.range)
    this.sweep.visible = !this.reducedMotion && this.sweepAge < 2.4
    this.sweep.scale.setScalar(radius)
    this.sweep.material.opacity = 0.8 * (1 - Math.min(1, this.sweepAge / 2.4))
    this.sweep.position.set(this.sweepOrigin.x - this.layout.origin.x, 0.31, this.sweepOrigin.z - this.layout.origin.z)
    if (this.target && !this.layout.buildings.some(building => building.id === this.target.building.id)) this.clear()
    this.outline.visible = Boolean(this.target)
    if (!this.target) return
    const building = this.target.building
    this.target.distance = Math.hypot(Math.max(0, Math.abs(position.x - building.x) - building.width / 2), Math.max(0, Math.abs(position.z - building.z) - building.depth / 2))
    this.outline.scale.set(building.width + 0.2, building.height + 0.2, building.depth + 0.2)
    this.outline.position.set(building.x - this.layout.origin.x, INTERIOR.base + building.height / 2, building.z - this.layout.origin.z)
  }

  clear() {
    this.target = null
    this.outline.visible = false
    this.sweep.visible = false
    this.sweepAge = 3
  }

  dispose() {
    for (const mesh of [this.outline, this.sweep]) { mesh.geometry.dispose(); mesh.material.dispose() }
    this.group.removeFromParent()
  }
}