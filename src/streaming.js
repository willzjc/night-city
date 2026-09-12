import { CITY, SPAWN, createBlock, streetCoordinate, streetIndex } from './layout.js'
import { createFloor, floorAt } from './interiors.js'

export class StreamingLayout {
  constructor(seed = CITY.seed, radius = CITY.radius) {
    this.seed = seed
    this.radius = radius
    this.chunks = new Map()
    this.interiors = new Map()
    this.collisionGroups = new Map()
    this.origin = { x: 0, z: 0 }
    this.blocks = []
    this.buildings = []
    this.revision = 0
    this.metrics = { generated: 0, unloaded: 0, originShifts: 0 }
    this.lastChange = { added: [], removed: [] }
    this.center = { column: Infinity, row: Infinity }
    this.update({ ...SPAWN, y: 1.675 })
  }

  update(position) {
    let changed = false
    const column = streetIndex(position.x, 'x', this.seed)
    const row = streetIndex(position.z, 'z', this.seed)
    if (column !== this.center.column || row !== this.center.row) {
      this.lastChange = { added: [], removed: [] }
      const wanted = new Set()
      for (let offsetZ = -this.radius; offsetZ <= this.radius; offsetZ++) {
        for (let offsetX = -this.radius; offsetX <= this.radius; offsetX++) {
          const key = `${column + offsetX}:${row + offsetZ}`
          wanted.add(key)
          if (!this.chunks.has(key)) {
            const block = createBlock(column + offsetX, row + offsetZ, this.seed)
            this.chunks.set(key, block)
            this.collisionGroups.set(`block/${key}`, block.colliders)
            this.metrics.generated++
            this.lastChange.added.push(key)
          }
        }
      }
      for (const key of this.chunks.keys()) {
        if (!wanted.has(key)) {
          this.chunks.delete(key)
          this.collisionGroups.delete(`block/${key}`)
          this.metrics.unloaded++
          this.lastChange.removed.push(key)
        }
      }
      this.blocks = [...this.chunks.values()]
      this.buildings = this.blocks.flatMap(block => block.buildings)
      this.center = { column, row }
      changed = true
    }
    const wantedFloors = new Set()
    for (const building of this.buildings) {
      const distanceX = Math.max(0, Math.abs(position.x - building.x) - building.width / 2)
      const distanceZ = Math.max(0, Math.abs(position.z - building.z) - building.depth / 2)
      if (Math.hypot(distanceX, distanceZ) > 18) continue
      const floor = floorAt(building, position.y)
      for (let index = Math.max(0, floor - 1); index <= Math.min(building.floors - 1, floor + 1); index++) {
        const key = `${building.id}/${index}`
        wantedFloors.add(key)
        if (!this.interiors.has(key)) {
          const plan = createFloor(building, index)
          this.interiors.set(key, plan)
          this.collisionGroups.set(key, plan.solids)
          changed = true
        }
      }
    }
    for (const key of this.interiors.keys()) {
      if (!wantedFloors.has(key)) {
        this.interiors.delete(key)
        this.collisionGroups.delete(key)
        changed = true
      }
    }
    if (Math.max(Math.abs(position.x - this.origin.x), Math.abs(position.z - this.origin.z)) > CITY.rebaseDistance) {
      this.origin = { x: streetCoordinate(column, 'x', this.seed), z: streetCoordinate(row, 'z', this.seed) }
      this.metrics.originShifts++
      changed = true
    }
    if (changed) this.revision++
    return changed
  }

  locationAt(position) {
    const block = this.chunks.get(`${streetIndex(position.x, 'x', this.seed)}:${streetIndex(position.z, 'z', this.seed)}`)
    const building = block?.buildings.find(building => Math.abs(position.x - building.x) < building.width / 2 && Math.abs(position.z - building.z) < building.depth / 2)
    if (!building || Math.abs(position.x - building.x) >= building.width / 2 || Math.abs(position.z - building.z) >= building.depth / 2 || position.y > building.height + 0.8) return null
    const floor = floorAt(building, position.y)
    return { building, floor, label: floor === 0 ? building.shop : building.use }
  }
}