import { CITY, INTERIOR, randomGenerator, blockSeed } from './layout.js'
export { INTERIOR, buildingShell } from './layout.js'

function solid(width, height, depth, x, y, z, color, kind = 'wall') {
  return { width, height, depth, x, y, z, color, kind }
}

export function stairLayout(building) {
  const left = building.width / 2 - 5.8
  const right = building.width / 2 - INTERIOR.wall
  const back = -building.depth / 2 + INTERIOR.wall
  const flightBack = back + INTERIOR.landing
  const flightFront = flightBack + INTERIOR.steps * INTERIOR.tread
  const front = flightFront + INTERIOR.landing
  const laneWidth = (right - left - 0.3) / 2
  return { left, right, back, front, flightBack, flightFront, laneWidth, firstX: left + laneWidth / 2, secondX: right - laneWidth / 2 }
}

export function createFloor(building, level) {
  if (level < 0 || level >= building.floors) throw new RangeError('Floor is outside the building')
  const random = randomGenerator(blockSeed(building.seed, level, 19))
  const base = INTERIOR.base + level * CITY.floorHeight
  const ceiling = CITY.floorHeight - INTERIOR.slab
  const halfWidth = building.width / 2 - INTERIOR.wall
  const halfDepth = building.depth / 2 - INTERIOR.wall
  const stairs = stairLayout(building)
  const solids = []
  const decorations = []
  const rooms = []
  const labels = []
  const accent = building.venue.accent
  const secondary = building.venue.secondary
  const floorColor = level === 0 ? '#172127' : '#1b2028'
  const wallColor = ['#3a4b50', '#4b4444', '#454853'][building.seed % 3]
  const add = (width, height, depth, x, y, z, color = wallColor, kind = 'wall') => {
    const item = solid(width, height, depth, building.x + x, base + y, building.z + z, color, kind)
    solids.push(item)
    return item
  }
  const detail = (width, height, depth, x, y, z, color, kind = 'detail') => {
    const item = solid(width, height, depth, building.x + x, base + y, building.z + z, color, kind)
    decorations.push(item)
    return item
  }
  const label = (text, x, y, z, width, color = accent, rotation = 0) => labels.push({ text, x: building.x + x, y: base + y, z: building.z + z, width, height: 0.55, color, rotation })

  function stool(x, z, color = secondary) {
    add(0.55, 0.13, 0.55, x, 0.71, z, color, 'stool')
    add(0.12, 0.63, 0.12, x, 0.315, z, '#728d95', 'stool-leg')
    detail(0.5, 0.04, 0.5, x, 0.04, z, '#4f6770')
  }

  function booth(x, z, width = 2.8) {
    add(width, 0.44, 0.85, x, 0.22, z, '#615061', 'booth')
    add(width, 0.68, 0.17, x, 0.78, z + 0.36, '#a25866', 'booth-back')
    detail(width, 0.045, 0.05, x, 1.12, z + 0.25, accent)
    add(width * 0.65, 0.12, 0.7, x, 0.78, z - 1.05, '#667a80', 'table')
    add(0.22, 0.72, 0.22, x, 0.36, z - 1.05, '#384b51', 'table-leg')
  }

  function venueFurniture(centerX, back, front, door) {
    const span = Math.max(3, Math.min(front - back - 2.8, 7))
    const counterX = Math.max(-halfWidth + 1.2, -9.5)
    if (building.shop === 'NOODLE BAR') {
      add(1.5, 1.05, span, counterX, 0.525, door, '#4a5a5c', 'service-counter')
      detail(1.65, 0.11, span + 0.1, counterX, 1.105, door, '#b39d75')
      detail(0.05, 0.1, span, counterX + 0.77, 0.6, door, accent, 'neon')
      for (let offset = -span / 2 + 0.8; offset < span / 2; offset += 1.45) {
        stool(counterX + 1.65, door + offset)
        const bowl = detail(0.38, 0.17, 0.38, counterX, 1.22, door + offset, '#e1d9ad', 'bowl')
        bowl.shape = 'bowl'
        detail(0.36, 0.025, 0.025, counterX + 0.04, 1.34, door + offset, '#de895d')
      }
      add(1.2, 0.48, span, counterX, ceiling - 0.6, door, '#43575e', 'extractor')
      for (let vent = -span / 2; vent < span / 2; vent += 0.3) detail(1.22, 0.04, 0.035, counterX, ceiling - 0.65, door + vent, '#899d97')
      label('BROTH / 12   NOODLES / 18', counterX + 0.85, 2.65, door, Math.min(span, 5), secondary, Math.PI / 2)
      if (halfWidth > 13) booth(centerX + 1.1, front - 1.6)
    } else if (building.shop === 'CYBER CLINIC') {
      add(1.1, 0.28, 2.1, counterX + 1, 0.9, door, '#b7c5c0', 'treatment-chair')
      add(0.65, 0.85, 1, counterX + 1, 0.425, door, '#465e68', 'chair-base')
      add(1.1, 0.75, 0.16, counterX + 1, 1.35, door - 0.95, '#789c9e', 'chair-back')
      add(0.6, 0.9, 0.65, counterX + 2.55, 0.45, door - 1, '#58717c', 'diagnostics')
      detail(0.68, 0.45, 0.06, counterX + 2.55, 1.18, door - 0.95, secondary, 'display')
      add(0.7, 2.35, 2.4, -halfWidth + 0.55, 1.175, back + 1.8, '#3e6269', 'medical-cabinet')
      for (let shelf = 0; shelf < 4; shelf++) detail(0.04, 0.08, 2.2, -halfWidth + 0.93, 0.45 + shelf * 0.48, back + 1.8, accent, 'neon')
      label('OPTICS / NEURAL / REPAIR', centerX, 2.9, back + 0.18, Math.min(halfWidth - 3, 6), accent)
    } else if (building.shop === 'ARCADE') {
      for (let offset = back + 1.35; offset < front - 0.8; offset += 1.4) {
        add(0.9, 1.7, 0.8, counterX, 0.85, offset, '#3a3d58', 'arcade-cabinet')
        detail(0.04, 0.64, 0.64, counterX + 0.47, 1.34, offset, (Math.round(offset * 10) % 2) ? accent : secondary, 'arcade-screen')
        detail(0.25, 0.07, 0.72, counterX + 0.6, 0.9, offset, '#899bb7')
        detail(0.035, 1.7, 0.05, counterX + 0.48, 0.85, offset + 0.4, accent, 'neon')
        stool(counterX + 1.4, offset, '#8c6f8e')
      }
      label('INSERT A DIFFERENT LIFE', centerX, 2.95, back + 0.12, Math.min(halfWidth - 3, 6), secondary)
    } else {
      add(1.4, 1.1, span, counterX, 0.55, door, '#45495a', 'bar')
      detail(0.04, 0.11, span, counterX + 0.72, 0.5, door, accent, 'neon')
      for (let offset = -span / 2 + 0.7; offset < span / 2; offset += 1.25) {
        stool(counterX + 1.6, door + offset, '#bc748c')
        const glass = detail(0.13, 0.28, 0.13, counterX, 1.29, door + offset, secondary, 'glass')
        glass.shape = 'cylinder'
      }
      label('LOW FREQUENCY / LIVE', counterX + 0.8, 2.7, door, Math.min(span, 5), secondary, Math.PI / 2)
      if (halfWidth > 12) booth(centerX + 1.3, front - 1.6)
    }
  }

  for (const side of [-1, 1]) {
    detail(0.06, ceiling, halfDepth * 2, side * (halfWidth - 0.03), ceiling / 2, 0, '#273941', 'wall-panel')
    detail(0.075, 0.08, halfDepth * 2, side * (halfWidth - 0.075), 0.17, 0, secondary, 'neon')
    for (let panel = -halfDepth + 0.4; panel < halfDepth; panel += 2.4) {
      detail(0.085, ceiling - 0.25, 0.045, side * (halfWidth - 0.08), ceiling / 2, panel, '#5e6f76')
    }
  }
  detail(halfWidth * 2, ceiling, 0.06, 0, ceiling / 2, -halfDepth + 0.03, '#25363e', 'wall-panel')
  detail(halfWidth * 2 - 0.2, 0.08, 0.08, 0, 0.18, -halfDepth + 0.08, accent, 'neon')

  if (level === 0) {
    add(halfWidth * 2, INTERIOR.slab, halfDepth * 2, 0, -INTERIOR.slab / 2, 0, floorColor, 'floor')
  } else {
    add(stairs.left + halfWidth, INTERIOR.slab, halfDepth * 2, (stairs.left - halfWidth) / 2, -INTERIOR.slab / 2, 0, floorColor, 'floor')
    add(halfWidth - stairs.left, INTERIOR.slab, halfDepth - stairs.flightFront, (halfWidth + stairs.left) / 2, -INTERIOR.slab / 2, (halfDepth + stairs.flightFront) / 2, floorColor, 'floor')
    add(0.13, 1.05, stairs.flightFront - stairs.back, stairs.left, 0.525, (stairs.flightFront + stairs.back) / 2, '#87958d', 'rail')
  }

  if (level < building.floors - 1) {
    const rise = CITY.floorHeight / (INTERIOR.steps * 2)
    for (let step = 0; step < INTERIOR.steps; step++) {
      const top = (step + 1) * rise
      const firstZ = stairs.flightFront - (step + 0.5) * INTERIOR.tread
      const secondZ = stairs.flightBack + (step + 0.5) * INTERIOR.tread
      add(stairs.laneWidth, top, INTERIOR.tread, stairs.firstX, top / 2, firstZ, '#687c7b', 'step')
      add(stairs.laneWidth, top, INTERIOR.tread, stairs.secondX, CITY.floorHeight / 2 + top / 2, secondZ, '#687c7b', 'step')
      detail(stairs.laneWidth, 0.025, 0.065, stairs.firstX, top + 0.013, firstZ + INTERIOR.tread / 2 - 0.04, '#bed3b0')
      detail(stairs.laneWidth, 0.025, 0.065, stairs.secondX, CITY.floorHeight / 2 + top + 0.013, secondZ - INTERIOR.tread / 2 + 0.04, '#bed3b0')
      add(0.12, 1, INTERIOR.tread, stairs.firstX + stairs.laneWidth / 2, top + 0.5, firstZ, '#7b9481', 'rail')
      add(0.12, 1, INTERIOR.tread, stairs.secondX - stairs.laneWidth / 2, CITY.floorHeight / 2 + top + 0.5, secondZ, '#7b9481', 'rail')
    }
    add(stairs.right - stairs.left, INTERIOR.slab, INTERIOR.landing, (stairs.left + stairs.right) / 2, CITY.floorHeight / 2 - INTERIOR.slab / 2, stairs.back + INTERIOR.landing / 2, '#526d67', 'landing')
  }

  function roomWall(x, start, end, door) {
    const gap = 1.8
    const before = door - gap / 2 - start
    const after = end - door - gap / 2
    if (before > 0.01) add(0.18, ceiling, before, x, ceiling / 2, start + before / 2)
    if (after > 0.01) add(0.18, ceiling, after, x, ceiling / 2, end - after / 2)
    add(0.18, ceiling - 2.8, gap, x, 2.8 + (ceiling - 2.8) / 2, door)
    detail(0.22, 0.04, gap, x, 2.8, door, '#b7d297')
  }

  const roomCount = level === 0 ? 2 : 2 + Math.floor(random() * 2)
  const roomDepth = halfDepth * 2 / roomCount
  for (let room = 0; room < roomCount; room++) {
    const back = -halfDepth + room * roomDepth
    const front = back + roomDepth
    const door = (back + front) / 2
    const centerX = (-halfWidth - 2) / 2
    if (level > 0 || room === 0) roomWall(-2, back, front, door)
    if (room > 0) add(halfWidth - 2, ceiling, 0.18, centerX, ceiling / 2, back)
    const type = level === 0 ? (room === roomCount - 1 ? building.shop : 'STOCKROOM') : building.use
    rooms.push({ type, x: building.x + centerX, z: building.z + door, width: halfWidth - 2, depth: roomDepth, door: { x: building.x - 2, z: building.z + door } })
    detail(halfWidth - 3, 0.015, roomDepth - 1, centerX, 0.009, door, level === 0 ? '#23333b' : '#35313d')
    if (level === 0 && room === roomCount - 1) {
      venueFurniture(centerX, back, front, door)
    } else if (type === 'APARTMENTS' || type === 'HOTEL') {
      add(2.4, 0.55, 3.1, -halfWidth + 1.6, 0.275, door, '#839496', 'furniture')
      detail(1.8, 0.12, 0.65, -halfWidth + 1.6, 0.61, door - 1.1, '#cec5ad')
      detail(2.45, 0.06, 0.08, -halfWidth + 1.6, 0.25, door + 1.55, accent, 'neon')
      add(0.45, 2.6, 1.5, -halfWidth + 0.55, 1.3, front - 1.1, '#344856', 'locker')
      detail(0.08, 0.9, 1.4, -halfWidth + 0.5, 1.6, door, secondary, 'display')
      add(1.6, 1.4, 0.55, -3.2, 0.7, back + 0.6, '#7b7d62', 'furniture')
    } else if (type === 'OFFICES') {
      add(2.7, 0.8, 1.2, centerX, 0.4, back + 1.1, '#778b89', 'furniture')
      detail(1, 0.6, 0.12, centerX, 1.15, back + 0.9, '#75dfed', 'display')
      detail(0.75, 0.48, 0.1, centerX + 1.1, 1.09, back + 0.9, accent, 'display')
      add(0.9, 2.3, 0.8, -halfWidth + 0.8, 1.15, front - 1, '#344651', 'server')
      for (let port = 0; port < 7; port++) detail(0.72, 0.055, 0.04, -halfWidth + 0.8, 0.3 + port * 0.27, front - 0.57, secondary, 'neon')
      add(0.8, 0.5, 0.8, centerX, 0.25, back + 2.1, '#5c737c', 'furniture')
    } else {
      add(0.65, 2.1, Math.max(2, roomDepth - 1.4), -halfWidth + 0.5, 1.05, door, '#81785e', 'furniture')
      for (let shelf = 0; shelf < 4; shelf++) detail(0.8, 0.07, roomDepth - 1.3, -halfWidth + 0.6, 0.35 + shelf * 0.5, door, '#beaf86')
      add(2.8, 1, 0.9, centerX + 0.5, 0.5, front - 1, '#779c93', 'furniture')
    }
    detail(2.2, 0.06, 0.55, centerX, ceiling - 0.03, door, secondary, 'ceiling-light')
    label(level === 0 ? type : `${type} / ${level}${room + 1}`, -1.87, 2.95, door, 1.6, secondary, Math.PI / 2)
  }

  const frontRoomBack = stairs.front + 0.25
  const frontRoomDoor = (frontRoomBack + halfDepth) / 2
  if (level > 0) roomWall(2, frontRoomBack, halfDepth, frontRoomDoor)
  add(halfWidth - 2, ceiling, 0.18, (halfWidth + 2) / 2, ceiling / 2, frontRoomBack)
  add(2.6, 0.8, 1.1, (halfWidth + 2) / 2, 0.4, halfDepth - 1.1, '#92a198', 'furniture')
  detail(1.1, 0.6, 0.08, (halfWidth + 2) / 2, 1.15, halfDepth - 1.2, '#d5b76e')
  if (halfDepth - frontRoomBack > 4.6) booth(halfWidth - 2, frontRoomBack + 1.1, 2.8)
  rooms.push({ type: level === 0 ? 'LOBBY' : 'LOUNGE', x: building.x + (halfWidth + 2) / 2, z: building.z + frontRoomDoor, width: halfWidth - 2, depth: halfDepth - frontRoomBack, door: { x: building.x + 2, z: building.z + frontRoomDoor } })
  for (let marker = -halfDepth + 1; marker < halfDepth; marker += 2) {
    detail(0.07, 0.025, 0.8, -1.4, 0.015, marker, accent, 'neon')
    detail(0.07, 0.025, 0.8, 1.4, 0.015, marker, secondary, 'neon')
    detail(0.8, 0.06, 0.3, 0, ceiling - 0.04, marker, '#b4c3c1', 'ceiling-light')
    detail(3.8, 0.025, 0.035, 0, 0.023, marker, '#46545a')
  }
  label(level === 0 ? building.venue.name : `RESIDENTIAL / ${String(level + 1).padStart(2, '0')}`, (halfWidth + 2) / 2, 2.75, halfDepth - 0.08, Math.min(halfWidth - 2.5, 6), accent, Math.PI)
  label('EXIT / STREET', 0, 2.9, halfDepth - 0.08, 2.5, '#86e9cc', Math.PI)
  detail(0.3, 0.3, halfDepth * 2 - 0.4, -1.75, ceiling - 0.35, 0, '#4b666d', 'conduit')
  detail(0.15, 0.15, halfDepth * 2 - 0.4, 1.75, ceiling - 0.24, 0, '#9e724b', 'conduit')
  labels.push({ text: level === 0 ? building.shop : `${building.use} / ${String(level).padStart(2, '0')}`, x: building.x, y: base + 2.9, z: building.z - halfDepth + 0.04, width: 3.4, height: 0.7, color: '#b9d8c4' })
  labels.push({ text: level < building.floors - 1 ? `STAIRS / ${level + 1}` : 'TOP FLOOR', x: building.x + (stairs.left + stairs.right) / 2, y: base + 2.9, z: building.z + stairs.flightFront - 0.1, width: 3.6, height: 0.7, color: '#e4d69b' })

  return { key: `${building.id}/${level}`, buildingId: building.id, level, base, solids, decorations, rooms, labels, stairs: {
    entry: { x: building.x + stairs.firstX, z: building.z + stairs.flightFront + 0.9 },
    turn: { x: building.x + stairs.firstX, z: building.z + stairs.back + 0.8 },
    across: { x: building.x + stairs.secondX, z: building.z + stairs.back + 0.8 },
    exit: { x: building.x + stairs.secondX, z: building.z + stairs.flightFront + 0.9 },
  } }
}

export function floorAt(building, eyeHeight) {
  return Math.max(0, Math.min(building.floors - 1, Math.floor((eyeHeight - 1.675 - INTERIOR.base + 0.06) / CITY.floorHeight)))
}