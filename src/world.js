import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { INTERIOR, buildingShell, randomGenerator } from './layout.js'
import { MeshBatch, disposeGroup } from './mesh-batch.js'
import { createPopulation } from './actors.js'
import { createRain } from './weather.js'

function textureFrom(canvas) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  return texture
}

function facade(width, height, color, seed) {
  const random = randomGenerator(seed)
  const columns = Math.round(width / 1.35)
  const rows = Math.round(height / 1.5)
  const canvas = document.createElement('canvas')
  canvas.width = columns * 8
  canvas.height = rows * 8
  const context = canvas.getContext('2d')
  context.fillStyle = '#070b10'
  context.fillRect(0, 0, canvas.width, canvas.height)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (random() > 0.58 || row % 7 === 0) continue
      context.globalAlpha = 0.3 + random() * 0.6
      context.fillStyle = [color, '#d6b487', '#8dbfc5', '#bccebd'][Math.floor(random() * 4)]
      context.fillRect(column * 8 + 2, row * 8 + 2, 4, 4)
    }
  }
  context.globalAlpha = 0.6
  context.fillStyle = color
  context.fillRect(0, 0, 1, canvas.height)
  context.fillRect(canvas.width - 1, 0, 1, canvas.height)
  for (let row = 0; row < rows; row += 12) context.fillRect(0, row * 8, canvas.width, 1)
  return new THREE.MeshBasicMaterial({ map: textureFrom(canvas) })
}

function signTexture(text, color, options = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = options.vertical ? 128 : 512
  canvas.height = options.vertical ? 512 : options.poster ? 384 : 128
  const context = canvas.getContext('2d')
  context.fillStyle = options.poster ? '#0c1520' : '#05090d'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = color
  context.lineWidth = options.poster ? 7 : 3
  context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
  context.fillStyle = color
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  if (options.vertical) {
    const letters = Array.from(text.replaceAll(' ', ''))
    const size = Math.min(92, (canvas.height - 36) / letters.length)
    context.font = `500 ${size}px "IBM Plex Mono"`
    letters.forEach((letter, index) => context.fillText(letter, canvas.width / 2, 18 + (index + 0.5) * (canvas.height - 36) / letters.length))
  } else {
    const lines = text.split('\n')
    let fontSize = options.poster ? 83 : 83
    do {
      context.font = `500 ${fontSize--}px "IBM Plex Mono"`
    } while (Math.max(...lines.map(line => context.measureText(line).width)) > canvas.width - 34 && fontSize > 12)
    const centerY = options.poster ? canvas.height * 0.63 : canvas.height / 2
    lines.forEach((line, index) => context.fillText(line, canvas.width / 2, centerY + (index - (lines.length - 1) / 2) * (fontSize + 7)))
    if (options.poster) {
      context.save()
      context.translate(canvas.width / 2, 91)
      context.strokeStyle = options.secondary ?? '#79eee2'
      context.lineWidth = 7
      context.beginPath()
      if (options.icon === 'bowl') {
        context.arc(0, -7, 58, 0, Math.PI)
        context.moveTo(-67, -7)
        context.lineTo(67, -7)
        for (const offset of [-25, 0, 25]) {
          context.moveTo(offset, -26)
          context.bezierCurveTo(offset + 18, -42, offset - 18, -48, offset, -66)
        }
      } else if (options.icon === 'cross') {
        context.strokeRect(-22, -55, 44, 108)
        context.strokeRect(-55, -21, 110, 42)
      } else if (options.icon === 'chip') {
        context.strokeRect(-39, -39, 78, 78)
        for (const offset of [-23, 0, 23]) {
          context.moveTo(offset, -58); context.lineTo(offset, -40)
          context.moveTo(offset, 40); context.lineTo(offset, 58)
          context.moveTo(-58, offset); context.lineTo(-40, offset)
          context.moveTo(40, offset); context.lineTo(58, offset)
        }
      } else {
        for (let offset = -80; offset <= 80; offset += 16) {
          const size = 10 + Math.abs(Math.sin(offset * 0.03)) * 36
          context.moveTo(offset, -size); context.lineTo(offset, size)
        }
      }
      context.stroke()
      context.restore()
      context.font = '400 15px "IBM Plex Mono"'
      context.fillStyle = options.secondary ?? '#79eee2'
      context.fillText(options.subtitle ?? 'CONNECTED / 24 H', canvas.width / 2, canvas.height - 27)
      for (let stripe = 15; stripe < canvas.height; stripe += 5) {
        context.fillStyle = '#00000020'
        context.fillRect(11, stripe, canvas.width - 22, 1)
      }
    }
  }
  return textureFrom(canvas)
}

function addSign(group, origin, text, positionX, positionY, positionZ, width, height, color, rotation = 0, options = {}) {
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: signTexture(text, color, options), side: THREE.DoubleSide }))
  sign.position.set(positionX - origin.x, positionY, positionZ - origin.z)
  sign.rotation.y = rotation
  sign.name = `sign/${text}`
  group.add(sign)
  return sign
}

function facadeDetail(batch, building) {
  const front = building.z + building.depth / 2
  const accent = building.venue.accent
  const secondary = building.venue.secondary
  for (let floor = 2; floor < building.floors; floor += 3) {
    const height = floor * 4.2
    const slabWidth = building.width * (floor % 2 ? 0.65 : 0.85)
    batch.box(slabWidth, 0.2, 0.75, building.x, height, front + 0.32, '#3d515b')
    batch.box(slabWidth, 0.07, 0.07, building.x, height + 0.16, front + 0.73, floor % 2 ? accent : '#819da6')
    for (const side of [-1, 1]) {
      batch.box(1.45, 1.1, 0.8, building.x + side * (building.width / 2 - 2), height + 0.9, front + 0.4, '#35454d')
      for (let slot = 0; slot < 4; slot++) batch.box(1.27, 0.055, 0.04, building.x + side * (building.width / 2 - 2), height + 0.56 + slot * 0.22, front + 0.83, '#748d95')
    }
  }
  for (const side of [-1, 1]) {
    batch.box(0.24, Math.min(building.height, 30), 0.24, building.x + side * (building.width / 2 - 0.55), Math.min(building.height, 30) / 2, front + 0.28, '#718087')
    batch.box(0.11, Math.min(building.height, 18), 0.15, building.x + side * (building.width / 2 - 1.1), Math.min(building.height, 18) / 2, front + 0.2, secondary)
  }
}

function createChunk(block, signals) {
  const group = new THREE.Group()
  group.userData.anchor = { x: block.x, z: block.z }
  const batch = new MeshBatch(group, block)
  batch.box(block.east - block.west, 0.02, block.south - block.north, block.x, -0.02, block.z, '#070c13')
  batch.box(block.width, 0.24, block.depth, block.x, 0.12, block.z, block.park ? '#10211e' : '#20292d')
  const random = randomGenerator(block.seed + 514)
  for (let streak = 0; streak < 70; streak++) {
    const along = block.north + random() * (block.south - block.north)
    const stripeWidth = 0.16 + random() * 1.6
    batch.box(stripeWidth, 0.018, 0.15 + random() * 1.6, block.west + (random() - 0.5) * 13, 0.026, along, ['#235062', '#502e36', '#4a4130', '#183433'][streak % 4])
  }
  if ((block.column + block.row) % 3 === 0) {
    batch.box(25, 0.75, 2.4, block.west, 12.6, block.z, '#364652')
    batch.box(25, 0.09, 0.1, block.west, 12.2, block.z + 1.2, '#e5c867')
    for (let brace = -11; brace < 12; brace += 2.5) batch.box(0.12, 1.2, 0.12, block.west + brace, 13.5, block.z + 1.1, '#73848f')
    const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(-14, 7.2, 0), new THREE.Vector3(0, 5.6, 0), new THREE.Vector3(14, 7.2, 0)])
    batch.add(new THREE.TubeGeometry(cable, 12, 0.065, 5, false), '#7a8685', block.west, 0, block.z + 2.6)
    addSign(group, block, 'SECTOR / ' + Math.abs(block.row % 100).toString().padStart(2, '0'), block.west, 11.4, block.z + 1.3, 7, 1.3, '#edce62')
  }
  for (const side of [-1, 1]) {
    batch.box(0.12, 0.07, block.depth, block.x + side * block.width / 2, 0.27, block.z, '#658775')
    batch.box(block.width, 0.07, 0.12, block.x, 0.27, block.z + side * block.depth / 2, '#658775')
  }
  for (let marker = block.north + 13; marker < block.south - 12; marker += 7) batch.box(0.14, 0.03, 2.3, block.west, 0.02, marker, '#748363')
  for (let marker = block.west + 13; marker < block.east - 12; marker += 7) batch.box(2.3, 0.03, 0.14, marker, 0.02, block.north, '#748363')
  for (let stripe = -5; stripe <= 5; stripe += 1.6) {
    for (const side of [-1, 1]) {
      batch.box(0.65, 0.03, 2.4, block.west + stripe, 0.03, block.north + side * 11.4, '#8da799')
      batch.box(2.4, 0.03, 0.65, block.west + side * 11.4, 0.03, block.north + stripe, '#8da799')
    }
  }
  for (const side of [-1, 1]) {
    const positionX = block.x + side * (block.width / 2 - 0.5)
    const positionZ = block.z - side * (block.depth / 2 - 2)
    batch.box(0.16, 5.8, 0.16, positionX, 3.1, positionZ, '#557567')
    batch.box(1.8, 0.14, 0.14, positionX + side * 0.7, 5.95, positionZ, '#7d906b')
    batch.box(1.15, 0.18, 0.35, positionX + side, 5.87, positionZ, '#e9e7c1')
    batch.box(0.14, 3.7, 0.14, block.west + side * 7.4, 1.85, block.north + side * 7.4, '#4d6a5a')
    const signal = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), signals[side === 1 ? 0 : 1])
    signal.position.set(block.west + side * 7.4 - block.x, 3.8, block.north + side * 7.4 - block.z)
    signal.userData.sharedMaterial = true
    group.add(signal)
  }
  if (block.park) {
    batch.box(3.6, 0.02, block.depth, block.x, 0.26, block.z, '#395445')
    batch.box(block.width, 0.02, 3.6, block.x, 0.27, block.z, '#395445')
    for (const side of [-1, 1]) {
      for (const offset of [-1, 1]) {
        const treeX = block.x + side * block.width * 0.29
        const treeZ = block.z + offset * block.depth * 0.28
        batch.box(0.35, 3, 0.35, treeX, 1.7, treeZ, '#617158')
        batch.add(new THREE.IcosahedronGeometry(2.7, 1), side === 1 ? '#5d995e' : '#7fa567', treeX, 4.7, treeZ)
        batch.box(2.7, 0.16, 0.7, treeX, 0.75, treeZ + 3.4, '#8b9874')
        batch.box(2.7, 0.6, 0.13, treeX, 1.05, treeZ + 3.7, '#637c67')
      }
    }
    if (block.plaza && block.x > 0) {
      addSign(group, block, 'METRO', block.x, 3.5, block.z + 3, 7, 1.8, '#9be6be')
      for (const side of [-1, 1]) batch.box(0.14, 4.5, 0.14, block.x + side * 3.5, 2.5, block.z + 3, '#718c7b')
    }
  }
  for (const fixture of block.fixtures) {
    batch.box(fixture.width, fixture.height, fixture.depth, fixture.x, fixture.y, fixture.z, '#36515a')
    if (fixture.kind === 'vending-machine') {
      batch.box(0.84, 1.16, 0.04, fixture.x, 1.72, fixture.z + fixture.depth / 2 + 0.02, fixture.color)
      batch.box(0.62, 0.15, 0.08, fixture.x, 0.57, fixture.z + fixture.depth / 2, '#a8bcc0')
      addSign(group, block, 'ION', fixture.x, 2.15, fixture.z + fixture.depth / 2 + 0.045, 0.74, 0.34, '#101d27')
    } else {
      batch.box(5.6, 0.16, 3, fixture.x, 3.6, fixture.z, '#665050')
      for (const side of [-1, 1]) batch.box(0.12, 3.3, 0.12, fixture.x + side * 2.6, 1.9, fixture.z - 0.8, '#8a9294')
      batch.box(5.4, 0.1, 0.1, fixture.x, 3.47, fixture.z + 1.51, fixture.color)
      addSign(group, block, fixture.x < block.x ? 'STREET FOOD' : 'SPARE PARTS', fixture.x, 2.9, fixture.z + 0.75, 4.8, 0.7, fixture.color)
    }
  }
  for (const building of block.buildings) {
    const geometries = []
    const material = facade(building.width, building.height, building.color, building.seed)
    material.vertexColors = true
    for (const solid of buildingShell(building)) {
      if (solid.kind === 'roof') {
        batch.box(solid.width, solid.height, solid.depth, solid.x, solid.y, solid.z, '#354a40')
        continue
      }
      const geometry = new THREE.BoxGeometry(solid.width, solid.height, solid.depth)
      const positions = geometry.getAttribute('position')
      const normals = geometry.getAttribute('normal')
      const uv = geometry.getAttribute('uv')
      const colors = new Float32Array(positions.count * 3)
      for (let index = 0; index < positions.count; index++) {
        const sideways = Math.abs(normals.getX(index)) > 0.5
        const across = sideways ? (positions.getZ(index) + solid.z - building.z) / building.depth : (positions.getX(index) + solid.x - building.x) / building.width
        uv.setXY(index, across + 0.5, (positions.getY(index) + solid.y - INTERIOR.base) / building.height)
        const shade = sideways ? 0.7 : 1
        colors.fill(shade, index * 3, index * 3 + 3)
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geometry.translate(solid.x - block.x, solid.y, solid.z - block.z)
      geometries.push(geometry)
    }
    group.add(new THREE.Mesh(mergeGeometries(geometries), material))
    geometries.forEach(geometry => geometry.dispose())
    for (const side of [-1, 1]) {
      batch.box(0.1, building.height, 0.1, building.x + side * building.width / 2, building.height / 2 + 0.24, building.z + building.depth / 2, building.color)
      batch.box(building.width, 0.09, 0.12, building.x, building.height + 0.4, building.z + side * building.depth / 2, building.color)
    }
    if (building.style < 2) {
      const crownHeight = building.style === 0 ? 5 : 2.5
      batch.box(building.width * 0.65, crownHeight, building.depth * 0.65, building.x, building.height + crownHeight / 2 + 0.4, building.z, '#34504a')
      batch.box(building.width * 0.66, 0.09, building.depth * 0.66, building.x, building.height + crownHeight + 0.4, building.z, building.color)
    }
    if (building.style !== 3) {
      batch.box(0.15, 5, 0.15, building.x, building.height + 6, building.z, building.color)
      batch.box(0.3, 0.2, 0.3, building.x, building.height + 8.5, building.z, '#e98765')
    }
    const front = building.z + building.depth / 2
    const venue = building.venue
    facadeDetail(batch, building)
    addSign(group, block, venue.name, building.x, 4.9, front + 0.13, Math.min(building.width * 0.83, 15), 1.8, venue.accent)
    addSign(group, block, 'OPEN / 24 H', building.x, 3.15, front + 0.14, 2.5, 0.48, venue.secondary)
    const billboard = { 'NOODLE BAR': 'HOT\nRAMEN', 'CYBER CLINIC': 'SECOND\nSKIN', ARCADE: 'GHOST\nSIGNAL', LOUNGE: 'TUNE\nIN' }[building.shop]
    addSign(group, block, billboard, building.x - building.width / 2 - 0.15, 10.1, building.z, Math.min(building.depth * 0.55, 12), 8.4, venue.accent, -Math.PI / 2, { poster: true, secondary: venue.secondary, icon: venue.icon, subtitle: venue.advert })
    addSign(group, block, { 'NOODLE BAR': 'RAMEN', 'CYBER CLINIC': 'CLINIC', ARCADE: 'ARCADE', LOUNGE: 'LOUNGE' }[building.shop], building.x - building.width / 2 + 1.6, 10, front + 0.6, 1.6, 7.4, venue.secondary, 0, { vertical: true })
    batch.box(7, 0.18, 2.4, building.x, 3.6, front + 0.9, '#3a4951')
    batch.box(7, 0.08, 0.08, building.x, 3.45, front + 2.05, venue.accent)
    for (const side of [-1, 1]) batch.box(0.15, 3.15, 0.15, building.x + side * (INTERIOR.doorWidth / 2 + 0.03), 1.82, front + 0.04, venue.secondary)
    batch.box(INTERIOR.doorWidth, 0.03, 2, building.x, 0.27, front + 0.6, '#42595d')
    for (let stripe = 0; stripe < 9; stripe++) {
      batch.box(1.5 + random() * 4, 0.015, 0.06 + random() * 0.2, building.x + (random() - 0.5) * 2, 0.275, front + 0.9 + stripe * 0.3, stripe % 2 ? '#854d3e' : '#306c6b')
    }
  }
  batch.commit()
  return group
}

function createFloorGroup(plan) {
  const group = new THREE.Group()
  const anchor = { x: plan.solids[0].x, z: plan.solids[0].z }
  group.userData.anchor = anchor
  const batch = new MeshBatch(group, anchor)
  for (const solid of [...plan.solids, ...plan.decorations]) {
    if (solid.shape === 'bowl' || solid.shape === 'cylinder') {
      const geometry = new THREE.CylinderGeometry(solid.width / 2, solid.width * (solid.shape === 'bowl' ? 0.25 : 0.5), solid.height, 12)
      batch.add(geometry, solid.color, solid.x, solid.y, solid.z)
    } else batch.box(solid.width, solid.height, solid.depth, solid.x, solid.y, solid.z, solid.color)
  }
  for (const label of plan.labels) addSign(group, anchor, label.text, label.x, label.y, label.z, label.width, label.height, label.color, label.rotation ?? 0)
  batch.commit()
  return group
}

export function createCity(layout) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#000000')
  scene.fog = new THREE.Fog('#000000', 130, 235)
  const chunks = new Map()
  const interiors = new Map()
  const pending = new Map()
  const signals = [new THREE.MeshBasicMaterial({ color: '#86dea4' }), new THREE.MeshBasicMaterial({ color: '#ec7355' })]
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ color: '#070c13' }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.045
  scene.add(ground)
  const random = randomGenerator(layout.seed + 6)
  const stars = new Float32Array(180 * 3)
  for (let index = 0; index < stars.length; index += 3) {
    const azimuth = random() * Math.PI * 2
    const elevation = 0.04 + random() * 1.45
    stars[index] = Math.sin(azimuth) * Math.cos(elevation) * 380
    stars[index + 1] = Math.sin(elevation) * 380
    stars[index + 2] = Math.cos(azimuth) * Math.cos(elevation) * 380
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3))
  const sky = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#6a8a80', size: 1.15, sizeAttenuation: false, fog: false }))
  scene.add(sky)
  const population = createPopulation(scene, layout)
  const weather = createRain(scene, layout.seed)
  let elapsed = 0
  let revision = -1

  function positionGroup(group) {
    group.position.set(group.userData.anchor.x - layout.origin.x, 0, group.userData.anchor.z - layout.origin.z)
  }

  function sync(position, immediate = false) {
    if (revision !== layout.revision) {
      for (const [key, group] of chunks) {
        if (!layout.chunks.has(key)) { disposeGroup(group); chunks.delete(key) }
      }
      for (const key of pending.keys()) if (!layout.chunks.has(key)) pending.delete(key)
      for (const block of layout.blocks) if (!chunks.has(block.key)) pending.set(block.key, block)
      for (const [key, group] of interiors) {
        if (!layout.interiors.has(key)) { disposeGroup(group); interiors.delete(key) }
      }
      for (const [key, plan] of layout.interiors) {
        if (!interiors.has(key)) {
          const group = createFloorGroup(plan)
          interiors.set(key, group)
          scene.add(group)
        }
      }
      for (const group of [...chunks.values(), ...interiors.values()]) positionGroup(group)
      revision = layout.revision
    }
    const queue = [...pending.values()].sort((first, second) => Math.hypot(first.x - position.x, first.z - position.z) - Math.hypot(second.x - position.x, second.z - position.z))
    for (const block of queue.slice(0, immediate ? queue.length : 2)) {
      const group = createChunk(block, signals)
      chunks.set(block.key, group)
      pending.delete(block.key)
      positionGroup(group)
      scene.add(group)
    }
  }

  function update(delta, position) {
    elapsed += delta
    sync(position)
    population.update(delta, elapsed, position)
    weather.update(elapsed, position, layout.origin, layout.locationAt(position))
    const northGreen = Math.floor(elapsed / 12) % 2 === 0
    signals[0].color.set(northGreen ? '#86dea4' : '#ec7355')
    signals[1].color.set(northGreen ? '#ec7355' : '#86dea4')
    ground.position.x = sky.position.x = position.x - layout.origin.x
    ground.position.z = sky.position.z = position.z - layout.origin.z
  }

  sync({ x: 0, z: 98 }, true)
  population.update(0, 0, { x: 0, z: 98 })
  return {
    scene, update, sync, chunks, interiors, population, weather,
    get elapsed() { return elapsed },
    dispose() { population.dispose(); disposeGroup(scene); signals.forEach(material => material.dispose()) },
  }
}