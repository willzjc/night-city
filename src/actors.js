import * as THREE from 'three'
import { MeshBatch, disposeGroup } from './mesh-batch.js'
import { blockSeed, randomGenerator, streetCoordinate, streetIndex } from './layout.js'

function profileGeometry(points, width) {
  const shape = new THREE.Shape()
  points.forEach(([longitudinal, height], index) => index === 0 ? shape.moveTo(longitudinal, height) : shape.lineTo(longitudinal, height))
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1, curveSegments: 10 }).rotateY(-Math.PI / 2).translate(width / 2, 0, 0)
}

export function createVehicle(kind = 'sedan', color = '#b5c4c2') {
  const group = new THREE.Group()
  group.name = kind
  const batch = new MeshBatch(group)
  const wagon = kind === 'wagon'
  const van = kind === 'van'
  const width = van ? 2.02 : 1.86
  const height = van ? 1.98 : 1.5
  const bodyShape = new THREE.Shape()
  bodyShape.moveTo(-2.35, 0.35)
  bodyShape.lineTo(-2.4, 0.67)
  bodyShape.lineTo(-2.22, 0.86)
  bodyShape.lineTo(-1.13, 0.99)
  bodyShape.lineTo(1.6, 0.94)
  bodyShape.lineTo(2.3, 0.83)
  bodyShape.lineTo(2.4, 0.39)
  bodyShape.lineTo(1.84, 0.35)
  bodyShape.absarc(1.42, 0.35, 0.42, 0, Math.PI, false)
  bodyShape.lineTo(-1, 0.35)
  bodyShape.absarc(-1.42, 0.35, 0.42, 0, Math.PI, false)
  bodyShape.closePath()
  const body = new THREE.ExtrudeGeometry(bodyShape, { depth: width, bevelEnabled: false, steps: 1, curveSegments: 10 }).rotateY(-Math.PI / 2).translate(width / 2, 0, 0)
  batch.add(body, color, 0, 0, 0)
  const cabinBack = wagon || van ? 1.82 : 0.65
  batch.add(profileGeometry([[-1.12, 0.94], [-0.48, height], [cabinBack, height], [wagon || van ? 2.03 : 1.4, 0.94]], width - 0.17), '#567b83', 0, 0, 0)
  batch.add(profileGeometry([[-0.53, height - 0.03], [-0.49, height + 0.06], [cabinBack, height + 0.06], [cabinBack + 0.07, height - 0.03]], width - 0.11), color, 0, 0, 0)
  for (const side of [-1, 1]) {
    batch.box(0.075, height - 0.9, 0.08, side * (width / 2 - 0.06), (height + 0.9) / 2, 0.3, color)
    batch.box(0.1, 0.09, 2.6, side * (width / 2 + 0.015), 0.92, 0.26, '#c2c7b8')
    batch.box(0.07, 0.075, 0.28, side * (width / 2 + 0.025), 0.8, 0.1, '#c0c5b3')
    batch.box(0.22, 0.15, 0.24, side * (width / 2 + 0.09), 1.06, -0.75, color)
    batch.box(0.43, 0.18, 0.075, side * 0.63, 0.7, -2.37, '#f0f3d9')
    batch.box(0.42, 0.18, 0.07, side * 0.66, 0.73, 2.34, '#f06e54')
    batch.box(0.18, 0.08, 0.08, side * 0.87, 0.62, -2.27, '#e4b95e')
  }
  batch.box(width * 0.96, 0.14, 0.15, 0, 0.43, -2.34, '#8e9b94')
  batch.box(width * 0.96, 0.14, 0.15, 0, 0.43, 2.35, '#8e9b94')
  batch.box(0.65, 0.19, 0.04, 0, 0.66, -2.4, '#172f31')
  for (let bar = -2; bar <= 2; bar++) batch.box(0.04, 0.16, 0.04, bar * 0.12, 0.66, -2.43, '#849d9b')
  batch.box(0.36, 0.13, 0.035, 0, 0.52, 2.44, '#d9d9b5')
  if (kind === 'taxi') {
    batch.box(0.65, 0.18, 0.3, 0, height + 0.13, 0.1, '#f5e3a6')
    for (let stripe = -2; stripe <= 2; stripe++) batch.box(0.04, 0.18, 0.15, width / 2 + 0.02, 0.71, stripe * 0.3, '#27322d')
  }
  if (van) {
    batch.box(width - 0.12, 0.88, 1.72, 0, 1.45, 1.03, color)
    batch.box(0.025, 0.55, 1.2, width / 2 - 0.04, 1.5, 1.04, '#adbea8')
  }
  batch.commit().name = 'body'
  let wheelIndex = 0
  for (const side of [-1, 1]) {
    for (const longitudinal of [-1.42, 1.42]) {
      const wheel = new THREE.Group()
      wheel.name = `wheel-${wheelIndex++}`
      wheel.position.set(side * width / 2, 0.35, longitudinal)
      const wheelBatch = new MeshBatch(wheel)
      wheelBatch.add(new THREE.CylinderGeometry(0.345, 0.345, 0.22, 16).rotateZ(Math.PI / 2), '#202d2b', 0, 0, 0)
      wheelBatch.add(new THREE.CylinderGeometry(0.21, 0.21, 0.235, 12).rotateZ(Math.PI / 2), '#a6b4b0', 0, 0, 0)
      for (let spoke = 0; spoke < 5; spoke++) {
        const geometry = new THREE.BoxGeometry(0.245, 0.04, 0.34).rotateX(spoke * Math.PI / 5)
        wheelBatch.add(geometry, '#5a7171', 0, 0, 0)
      }
      wheelBatch.commit()
      group.add(wheel)
    }
  }
  return group
}

export function createHuman(index = 0) {
  const group = new THREE.Group()
  group.name = 'pedestrian'
  const shirt = ['#d3b66d', '#8fbccc', '#d399a1', '#acc68a'][index % 4]
  const skin = ['#d5ad8e', '#a87957', '#885744', '#c79a77'][index % 4]
  const trousers = ['#5d747d', '#657476', '#647268', '#8e8373'][index % 4]
  const body = new MeshBatch(group)
  body.add(new THREE.CylinderGeometry(0.21, 0.17, 0.56, 8), shirt, 0, 1.2, 0)
  body.box(0.36, 0.15, 0.24, 0, 0.9, 0, trousers)
  body.add(new THREE.CylinderGeometry(0.065, 0.07, 0.12, 8), skin, 0, 1.52, 0)
  body.add(new THREE.SphereGeometry(0.145, 10, 8).scale(0.85, 1.2, 0.92), skin, 0, 1.7, -0.015)
  body.add(new THREE.SphereGeometry(0.143, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.87, 1.05, 0.94), '#4c4032', 0, 1.76, 0)
  body.box(0.045, 0.055, 0.07, 0, 1.7, -0.145, skin)
  if (index % 2 === 0) body.box(0.31, 0.4, 0.15, 0, 1.24, 0.19, '#88795d')
  body.commit().name = 'torso'
  for (const side of [-1, 1]) {
    const arm = new THREE.Group()
    arm.name = side < 0 ? 'left-arm' : 'right-arm'
    arm.position.set(side * 0.26, 1.43, 0)
    const armBatch = new MeshBatch(arm)
    armBatch.add(new THREE.CylinderGeometry(0.065, 0.055, 0.48, 6), shirt, 0, -0.2, 0)
    armBatch.add(new THREE.SphereGeometry(0.065, 8, 6), skin, 0, -0.49, 0)
    armBatch.commit()
    group.add(arm)
    const leg = new THREE.Group()
    leg.name = side < 0 ? 'left-leg' : 'right-leg'
    leg.position.set(side * 0.105, 0.89, 0)
    const thigh = new MeshBatch(leg)
    thigh.add(new THREE.CylinderGeometry(0.085, 0.064, 0.41, 6), trousers, 0, -0.2, 0)
    thigh.commit()
    const shin = new THREE.Group()
    shin.name = side < 0 ? 'left-knee' : 'right-knee'
    shin.position.y = -0.39
    const calf = new MeshBatch(shin)
    calf.add(new THREE.CylinderGeometry(0.065, 0.045, 0.4, 6), trousers, 0, -0.2, 0)
    calf.box(0.14, 0.09, 0.29, 0, -0.43, -0.065, '#a8b1a5')
    calf.commit()
    leg.add(shin)
    group.add(leg)
  }
  return group
}

export function sidewalkPose(block, distance) {
  const width = block.width - 2.8
  const depth = block.depth - 2.8
  const perimeter = 2 * (width + depth)
  const progress = ((distance % perimeter) + perimeter) % perimeter
  const left = block.x - width / 2
  const north = block.z - depth / 2
  if (progress < width) return { x: left + progress, z: north, yaw: -Math.PI / 2 }
  if (progress < width + depth) return { x: left + width, z: north + progress - width, yaw: Math.PI }
  if (progress < width * 2 + depth) return { x: left + width - (progress - width - depth), z: north + depth, yaw: Math.PI / 2 }
  return { x: left, z: north + depth - (progress - width * 2 - depth), yaw: 0 }
}

function instancedModel(template, capacity, root) {
  const sources = []
  template.traverse(object => { if (object.isMesh) sources.push(object) })
  const parts = sources.map(source => {
    const mesh = new THREE.InstancedMesh(source.geometry, source.material, capacity)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.count = 0
    root.add(mesh)
    return mesh
  })
  return { template, parts, count: 0 }
}

function actorModel(model) {
  const pose = model.template.clone(true)
  const meshes = []
  pose.traverse(object => { if (object.isMesh) meshes.push(object) })
  return { pose, meshes, model }
}

function drawActor(actor) {
  actor.pose.updateMatrixWorld(true)
  actor.meshes.forEach((mesh, index) => actor.model.parts[index].setMatrixAt(actor.model.count, mesh.matrixWorld))
  actor.model.count++
}

export function createPopulation(scene, layout) {
  const root = new THREE.Group()
  scene.add(root)
  const humanModels = [0, 1, 2, 3].map(index => instancedModel(createHuman(index), 120, root))
  const carModels = [
    instancedModel(createVehicle('sedan', '#8facbb'), 80, root),
    instancedModel(createVehicle('taxi', '#e2b95f'), 80, root),
    instancedModel(createVehicle('wagon', '#b86d5e'), 80, root),
    instancedModel(createVehicle('van', '#c8d0b7'), 80, root),
  ]
  const models = [...humanModels, ...carModels]
  const pedestrians = new Map()
  const cars = new Map()
  let currentCenter = ''

  function sync(position) {
    const center = `${layout.center.column}:${layout.center.row}`
    if (center === currentCenter) return
    currentCenter = center
    const blocks = layout.blocks.filter(block => Math.abs(block.column - layout.center.column) <= 2 && Math.abs(block.row - layout.center.row) <= 2)
    const wantedPeople = new Set()
    for (const block of blocks) {
      for (let index = 0; index < 4; index++) {
        const id = `${block.key}/${index}`
        wantedPeople.add(id)
        if (pedestrians.has(id)) continue
        const random = randomGenerator(blockSeed(block.seed, index, 82))
        const actor = actorModel(humanModels[Math.floor(random() * humanModels.length)])
        actor.pose.scale.setScalar(0.92 + random() * 0.16)
        pedestrians.set(id, { ...actor, id, block, speed: 0.9 + random() * 0.6, phase: random() * 1000, direction: random() < 0.5 ? -1 : 1, limbs: ['left-arm', 'right-arm', 'left-leg', 'right-leg', 'left-knee', 'right-knee'].map(name => actor.pose.getObjectByName(name)) })
      }
    }
    for (const [id] of pedestrians) if (!wantedPeople.has(id)) pedestrians.delete(id)
    const wantedCars = new Set()
    for (const axis of ['x', 'z']) {
      const centerIndex = axis === 'z' ? layout.center.column : layout.center.row
      for (let lane = centerIndex - 2; lane <= centerIndex + 2; lane++) {
        for (const direction of [-1, 1]) {
          for (let slot = 0; slot < 3; slot++) {
            const id = `${axis}/${lane}/${direction}/${slot}`
            wantedCars.add(id)
            if (cars.has(id)) continue
            const random = randomGenerator(blockSeed(layout.seed, id, 22))
            const actor = actorModel(carModels[Math.floor(random() * carModels.length)])
            cars.set(id, { ...actor, id, axis, lane, direction, coordinate: position[axis] + (slot - 1) * 118 + random() * 16, wheels: [0, 1, 2, 3].map(index => actor.pose.getObjectByName(`wheel-${index}`)), speed: 7.5 })
          }
        }
      }
    }
    for (const [id] of cars) if (!wantedCars.has(id)) cars.delete(id)
  }

  function update(delta, elapsed, position) {
    sync(position)
    models.forEach(model => { model.count = 0 })
    for (const actor of pedestrians.values()) {
      const pose = sidewalkPose(actor.block, actor.phase + elapsed * actor.speed * actor.direction)
      actor.position = { x: pose.x, y: 0.24, z: pose.z }
      actor.pose.position.set(pose.x - layout.origin.x, 0.24 + Math.abs(Math.sin(elapsed * actor.speed * 7 + actor.phase)) * 0.018, pose.z - layout.origin.z)
      actor.pose.rotation.y = pose.yaw + (actor.direction < 0 ? Math.PI : 0)
      const stride = Math.sin(elapsed * actor.speed * 7 + actor.phase)
      actor.limbs[0].rotation.x = stride * 0.42
      actor.limbs[1].rotation.x = -stride * 0.42
      actor.limbs[2].rotation.x = -stride * 0.45
      actor.limbs[3].rotation.x = stride * 0.45
      actor.limbs[4].rotation.x = Math.max(0, stride) * 0.55
      actor.limbs[5].rotation.x = Math.max(0, -stride) * 0.55
      drawActor(actor)
    }
    const northGreen = Math.floor(elapsed / 12) % 2 === 0
    for (const actor of cars.values()) {
      if (Math.abs(actor.coordinate - position[actor.axis]) > 205) actor.coordinate = position[actor.axis] - actor.direction * 196
      const crossingIndex = streetIndex(actor.coordinate, actor.axis, layout.seed)
      const crossing = streetCoordinate(crossingIndex + (actor.direction > 0 ? 1 : 0), actor.axis, layout.seed)
      const distance = (crossing - actor.coordinate) * actor.direction
      const green = actor.axis === 'z' ? northGreen : !northGreen
      let travel = actor.speed * delta
      if (!green && distance > 9) travel = Math.min(travel, Math.max(0, distance - 12))
      for (const other of cars.values()) {
        if (other === actor || other.axis !== actor.axis || other.lane !== actor.lane || other.direction !== actor.direction) continue
        const gap = (other.coordinate - actor.coordinate) * actor.direction
        if (gap > 0) travel = Math.min(travel, Math.max(0, gap - 7))
      }
      actor.coordinate += actor.direction * travel
      const laneCenter = streetCoordinate(actor.lane, actor.axis === 'z' ? 'x' : 'z', layout.seed)
      const positionX = actor.axis === 'z' ? laneCenter - actor.direction * 3.3 : actor.coordinate
      const positionZ = actor.axis === 'z' ? actor.coordinate : laneCenter + actor.direction * 3.3
      actor.position = { x: positionX, y: 0, z: positionZ }
      actor.pose.position.set(positionX - layout.origin.x, 0, positionZ - layout.origin.z)
      actor.pose.rotation.y = actor.axis === 'z' ? (actor.direction > 0 ? Math.PI : 0) : -actor.direction * Math.PI / 2
      actor.wheels.forEach(wheel => { wheel.rotation.x -= travel / 0.345 })
      drawActor(actor)
    }
    for (const model of models) {
      for (const part of model.parts) {
        part.count = model.count
        part.instanceMatrix.needsUpdate = true
      }
    }
  }

  return {
    update, pedestrians, cars,
    snapshot: () => ({ pedestrians: pedestrians.size, cars: cars.size, people: [...pedestrians.values()].map(actor => ({ id: actor.id, position: actor.position, stride: actor.limbs[0].rotation.x })), vehicles: [...cars.values()].map(actor => ({ id: actor.id, kind: actor.pose.name, position: actor.position, yaw: actor.pose.rotation.y })) }),
    dispose() {
      root.removeFromParent()
      models.forEach(model => { model.parts.forEach(part => part.dispose()); disposeGroup(model.template) })
      pedestrians.clear()
      cars.clear()
    },
  }
}