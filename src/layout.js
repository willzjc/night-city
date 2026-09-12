import { venueFor } from './venues.js'

export const CITY = Object.freeze({ cell: 64, road: 16, radius: 4, seed: 7319, floorHeight: 4.2, rebaseDistance: 1024 })
export const INTERIOR = Object.freeze({ base: 0.24, wall: 0.3, doorWidth: 2.8, doorHeight: 3.15, slab: 0.18, steps: 12, tread: 0.55, landing: 1.8 })
export const SPAWN = Object.freeze({ x: 0, y: 0.9, z: 98, yaw: 0.08, pitch: 0.3 })
export const PALETTE = ['#f76859', '#edd56b', '#61bedf', '#58dcc4', '#b8c86c', '#e580a3']

export function randomGenerator(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function blockSeed(seed, column, row) {
  let hash = 2166136261
  for (const character of `${seed}/${column}/${row}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
  return (hash ^ (hash >>> 16)) >>> 0
}

export function streetCoordinate(index, axis = 'x', seed = CITY.seed) {
  if (index === 0) return 0
  const jitter = (blockSeed(seed, index, axis) / 4294967296 - 0.5) * 22
  return index * CITY.cell + jitter
}

export function streetIndex(coordinate, axis = 'x', seed = CITY.seed) {
  let index = Math.floor(coordinate / CITY.cell)
  while (coordinate < streetCoordinate(index, axis, seed)) index--
  while (coordinate >= streetCoordinate(index + 1, axis, seed)) index++
  return index
}

export function createBlock(column, row, seed = CITY.seed) {
  const localSeed = blockSeed(seed, column, row)
  const random = randomGenerator(localSeed)
  const west = streetCoordinate(column, 'x', seed)
  const east = streetCoordinate(column + 1, 'x', seed)
  const north = streetCoordinate(row, 'z', seed)
  const south = streetCoordinate(row + 1, 'z', seed)
  const width = east - west - CITY.road
  const depth = south - north - CITY.road
  const positionX = (west + east) / 2
  const positionZ = (north + south) / 2
  const plaza = row === 1 && (column === -1 || column === 0)
  const park = plaza || (column === 2 && row === -2) || (column === -3 && row === -1)
    || ((Math.abs(column) > 3 || Math.abs(row) > 3) && random() < 0.09)
  const block = { key: `${column}:${row}`, column, row, x: positionX, z: positionZ, width, depth, west, east, north, south, park, plaza, seed: localSeed, buildings: [], fixtures: [] }
  block.colliders = [{ x: positionX, y: 0.12, z: positionZ, width, height: 0.24, depth }]
  if (park) {
    if (plaza) {
      for (const side of [-1, 1]) block.fixtures.push({ kind: 'market-stall', width: 4.8, height: 1, depth: 1.4, x: positionX + side * width * 0.26, y: 0.74, z: positionZ + depth / 2 - 6, color: side < 0 ? '#f47f5e' : '#64dfd1' })
      block.colliders.push(...block.fixtures)
    }
    return block
  }
  const plots = width > 52 && random() < 0.55 ? 2 : 1
  const plotWidth = width / plots
  for (let plot = 0; plot < plots; plot++) {
    let floors = random() < 0.32 ? 2 + Math.floor(random() * 4) : 7 + Math.floor(random() * 18)
    let colorIndex = ((column + row * 2 + plot) % PALETTE.length + PALETTE.length) % PALETTE.length
    if (row === 0 && column === -1) { floors = 14; colorIndex = 0 }
    if (row === 0 && column === 0) { floors = 19; colorIndex = 2 }
    if (row === -1 && column === -1) { floors = 24; colorIndex = 1 }
    if (row === 0 && column === 1) { floors = 12; colorIndex = 3 }
    const buildingWidth = Math.min(plotWidth - 6, Math.max(19, plotWidth * (0.55 + random() * 0.36)))
    const buildingDepth = Math.min(depth - 6, Math.max(19, depth * (0.52 + random() * 0.38)))
    const buildingSeed = blockSeed(localSeed, plot, 7)
    const building = {
      id: `${block.key}/${plot}`,
      x: positionX - width / 2 + plotWidth * (plot + 0.5) + (random() - 0.5) * (plotWidth - buildingWidth - 6),
      z: positionZ + (random() - 0.5) * (depth - buildingDepth - 6),
      width: buildingWidth,
      depth: buildingDepth,
      height: floors * CITY.floorHeight,
      floors,
      color: PALETTE[colorIndex],
      style: Math.floor(random() * 4),
      seed: buildingSeed,
      use: ['APARTMENTS', 'OFFICES', 'HOTEL'][buildingSeed % 3],
      venue: venueFor(column === 0 && row === 0 ? 0 : buildingSeed),
      shop: venueFor(column === 0 && row === 0 ? 0 : buildingSeed).type,
    }
    block.buildings.push(building)
    block.colliders.push(...buildingShell(building))
    block.fixtures.push({ kind: 'vending-machine', width: 1.1, height: 2.25, depth: 0.7, x: building.x + 3.2, y: 1.365, z: building.z + building.depth / 2 + 0.4, color: building.venue.secondary })
  }
  block.colliders.push(...block.fixtures)
  block.building = block.buildings[0]
  return block
}

export function buildingShell(building) {
  const halfWidth = building.width / 2
  const halfDepth = building.depth / 2
  const wall = INTERIOR.wall
  const middleY = INTERIOR.base + building.height / 2
  const wingWidth = (building.width - INTERIOR.doorWidth) / 2
  const solid = (width, height, depth, x, y, z, kind) => ({ width, height, depth, x, y, z, kind, color: building.color })
  return [
    solid(wall, building.height, building.depth, building.x - halfWidth + wall / 2, middleY, building.z, 'side'),
    solid(wall, building.height, building.depth, building.x + halfWidth - wall / 2, middleY, building.z, 'side'),
    solid(building.width - wall * 2, building.height, wall, building.x, middleY, building.z - halfDepth + wall / 2, 'front'),
    solid(wingWidth, building.height, wall, building.x - (halfWidth + INTERIOR.doorWidth / 2) / 2, middleY, building.z + halfDepth - wall / 2, 'front'),
    solid(wingWidth, building.height, wall, building.x + (halfWidth + INTERIOR.doorWidth / 2) / 2, middleY, building.z + halfDepth - wall / 2, 'front'),
    solid(INTERIOR.doorWidth, building.height - INTERIOR.doorHeight, wall, building.x, INTERIOR.base + INTERIOR.doorHeight + (building.height - INTERIOR.doorHeight) / 2, building.z + halfDepth - wall / 2, 'front'),
    solid(building.width, INTERIOR.slab, building.depth, building.x, INTERIOR.base + building.height + INTERIOR.slab / 2, building.z, 'roof'),
  ]
}

export function createLayout(seed = CITY.seed, center = { column: 0, row: 0 }) {
  const blocks = []
  for (let row = center.row - CITY.radius; row < center.row + CITY.radius; row++) {
    for (let column = center.column - CITY.radius; column < center.column + CITY.radius; column++) {
      blocks.push(createBlock(column, row, seed))
    }
  }
  return { seed, blocks, buildings: blocks.flatMap(block => block.buildings), colliders: blocks.flatMap(block => block.colliders) }
}

export function districtAt(position) {
  if (Math.max(Math.abs(position.x), Math.abs(position.z)) > 170) {
    const column = Math.floor(position.x / 320)
    const row = Math.floor(position.z / 320)
    const seed = blockSeed(CITY.seed, column, row)
    return { name: `${['NORTH', 'SOUTH', 'RIVER', 'GRAND', 'GLASS', 'HIGH'][seed % 6]} ${['COMMONS', 'QUARTER', 'GARDENS', 'EXCHANGE', 'HEIGHTS'][Math.floor(seed / 6) % 5]}`, number: String(seed % 90 + 10) }
  }
  if (position.z < -44) return { name: 'NORTH QUARTER', number: '03' }
  if (position.x < -44) return { name: 'WEST COMMONS', number: '02' }
  if (position.x > 44) return { name: 'EAST EXCHANGE', number: '04' }
  return { name: 'LOWER CENTRAL', number: '01' }
}