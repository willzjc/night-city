import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './terminal.css'
import * as THREE from 'three'
import { AsciiRenderer } from './ascii.js'
import { CITY, INTERIOR, SPAWN, streetCoordinate, streetIndex } from './layout.js'
import { createFloor } from './interiors.js'
import { StreamingLayout } from './streaming.js'
import { createCity } from './world.js'
import { createWalker } from './physics.js'
import { Controls } from './controls.js'
import { createInterface } from './ui.js'

const ui = createInterface()
const elements = ui.elements
const events = new AbortController()
const options = { signal: events.signal }
let disposed = false
let dispose = () => events.abort()

async function initialize() {
  await Promise.all([document.fonts.load('400 20px "IBM Plex Mono"'), document.fonts.load('500 25px "IBM Plex Mono"')])
  if (disposed) return
  const canvas = elements.city
  const renderer = new AsciiRenderer(canvas)
  const layout = new StreamingLayout()
  const city = createCity(layout)
  const walker = await createWalker(layout)
  if (disposed) {
    renderer.dispose()
    city.dispose()
    walker.dispose()
    return
  }
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 600)
  camera.rotation.order = 'YXZ'
  const state = {
    paused: false,
    touring: false,
    showMap: window.matchMedia('(min-width: 760px) and (pointer: fine)').matches,
    tourIndex: 0,
    noticeUntil: 0,
  }
  let accumulator = 0
  let previous = performance.now()
  let frames = 0
  let fps = 60
  let fpsFrames = 0
  let fpsElapsed = 0
  let hudElapsed = 1
  let bob = 0
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  city.weather.enabled = !reducedMotion.matches
  elements['rain-toggle'].checked = city.weather.enabled
  const tour = { column: 0, row: streetIndex(SPAWN.z, 'z') - 3 }
  const controls = new Controls(canvas, {
    manual: () => setTour(false),
    capture: captured => {
      document.body.classList.toggle('captured', captured)
      elements['enter-button'].querySelector('span').textContent = captured ? 'CONNECTED' : 'ENTER CITY'
      updateViewState()
    },
    pause: () => setPaused(!state.paused),
    map: () => setMap(!state.showMap),
    reset: resetPosition,
  })

  function updateViewState() {
    elements['view-state'].textContent = state.touring ? 'GUIDED WALK' : document.pointerLockElement === canvas ? 'CONNECTED' : 'STREET LEVEL'
  }

  function setPaused(paused) {
    state.paused = paused
    controls.enabled = !paused
    if (paused) controls.release()
    accumulator = 0
    elements['run-state'].textContent = paused ? 'PAUSED' : 'LIVE'
    elements['run-dot'].classList.toggle('paused', paused)
    elements['enter-button'].disabled = paused
    ui.setButton('pause-button', paused ? 'play' : 'pause', paused ? 'Resume simulation' : 'Pause simulation')
  }

  function setTour(touring) {
    if (state.touring === touring) return
    state.touring = touring
    if (touring) {
      setPaused(false)
      controls.release()
      controls.reset()
      layout.update({ ...SPAWN, y: 1.675 })
      walker.syncLayout(layout)
      walker.reset()
      state.tourIndex = 0
      tour.column = 0
      tour.row = streetIndex(SPAWN.z, 'z') - 3
      accumulator = 0
    }
    elements['walk-mode'].setAttribute('aria-pressed', String(!touring))
    elements['tour-mode'].setAttribute('aria-pressed', String(touring))
    updateViewState()
  }

  function resetPosition() {
    setTour(false)
    controls.reset()
    layout.update({ ...SPAWN, y: 1.675 })
    walker.syncLayout(layout)
    walker.reset()
    accumulator = 0
    hudElapsed = 1
  }

  function setMap(visible) {
    state.showMap = visible
    elements['map-panel'].hidden = !visible
    elements['map-button'].setAttribute('aria-pressed', String(visible))
    hudElapsed = 1
  }

  function settings(open, restoreFocus = true) {
    if (open) { controls.release(); places(false, false) }
    elements['settings-panel'].hidden = !open
    elements['settings-button'].setAttribute('aria-expanded', String(open))
    if (open) elements['glyph-size'].focus()
    else if (restoreFocus) elements['settings-button'].focus()
  }

  function places(open, restoreFocus = true) {
    if (open) {
      controls.release()
      settings(false, false)
      for (const button of document.querySelectorAll('[data-venue]')) {
        button.disabled = !layout.buildings.some(building => building.shop === button.dataset.venue)
      }
      elements['apartment-button'].disabled = !layout.buildings.some(building => building.use === 'APARTMENTS')
    }
    elements['places-panel'].hidden = !open
    elements['places-button'].setAttribute('aria-expanded', String(open))
    if (open) elements['places-panel'].querySelector('.place-button:not(:disabled)')?.focus()
    else if (restoreFocus) elements['places-button'].focus()
  }

  function moveTo(position, yaw = 0, pitch = 0) {
    setTour(false)
    controls.clear()
    const eye = { ...position, y: (position.y ?? SPAWN.y) + 0.8 }
    layout.update(eye)
    walker.syncLayout(layout)
    walker.reset(position)
    controls.yaw = yaw
    controls.pitch = pitch
    city.sync(eye, true)
    city.update(0, eye)
    accumulator = 0
    hudElapsed = 1
  }

  function visit(type, apartment = false) {
    const position = walker.position
    const candidates = layout.buildings.filter(building => apartment ? building.use === 'APARTMENTS' : building.shop === type)
    candidates.sort((first, second) => Math.hypot(first.x - position.x, first.z - position.z) - Math.hypot(second.x - position.x, second.z - position.z))
    const building = candidates[0]
    if (!building) { notice('No matching address in this neighborhood.'); return }
    const level = apartment ? Math.min(2, building.floors - 1) : 0
    const floor = createFloor(building, level)
    const room = floor.rooms.find(room => room.type === (apartment ? 'APARTMENTS' : type))
    const feature = { 'NOODLE BAR': 'service-counter', 'CYBER CLINIC': 'treatment-chair', ARCADE: 'arcade-cabinet', LOUNGE: 'bar' }[type]
    const targets = apartment ? [] : floor.solids.filter(solid => solid.kind === feature)
    const target = targets[Math.floor(targets.length / 2)]
    const arrival = target ? { x: Math.min(building.x - 2.9, target.x + 4.6), z: target.z + (type === 'ARCADE' ? 1.8 : 1) } : { x: room.door.x - 0.95, z: room.door.z }
    const yaw = target ? Math.atan2(arrival.x - target.x, arrival.z - target.z) : Math.PI / 2
    setPaused(false)
    moveTo({ ...arrival, y: INTERIOR.base + level * CITY.floorHeight + 0.9 }, yaw, -0.065)
    places(false, false)
    canvas.focus({ preventScroll: true })
  }

  function notice(message) {
    elements.notice.textContent = message
    elements.notice.hidden = false
    state.noticeUntil = performance.now() + 4000
  }

  function resize() {
    const { width, height } = canvas.getBoundingClientRect()
    renderer.resize(width, height)
    camera.aspect = width / Math.max(1, height)
    camera.updateProjectionMatrix()
    hudElapsed = 1
  }

  elements['enter-button'].addEventListener('click', () => { settings(false, false); places(false, false); controls.engage() }, options)
  elements['pause-button'].addEventListener('click', () => setPaused(!state.paused), options)
  elements['map-button'].addEventListener('click', () => setMap(!state.showMap), options)
  elements['settings-button'].addEventListener('click', () => settings(elements['settings-panel'].hidden), options)
  elements['close-settings'].addEventListener('click', () => settings(false), options)
  elements['places-button'].addEventListener('click', () => places(elements['places-panel'].hidden), options)
  elements['close-places'].addEventListener('click', () => places(false), options)
  document.querySelectorAll('[data-venue]').forEach(button => button.addEventListener('click', () => visit(button.dataset.venue), options))
  elements['apartment-button'].addEventListener('click', () => visit('APARTMENTS', true), options)
  elements['street-button'].addEventListener('click', () => {
    const building = layout.locationAt(walker.position)?.building
    setPaused(false)
    if (building) moveTo({ x: building.x, z: building.z + building.depth / 2 + 4 }, Math.PI, 0.06)
    else resetPosition()
    places(false, false)
    canvas.focus({ preventScroll: true })
  }, options)
  elements['reset-button'].addEventListener('click', resetPosition, options)
  elements['walk-mode'].addEventListener('click', () => setTour(false), options)
  elements['tour-mode'].addEventListener('click', () => setTour(true), options)
  elements['glyph-size'].addEventListener('input', event => {
    renderer.setDensity(Number(event.target.value))
    elements['glyph-value'].value = Number(event.target.value).toFixed(1)
    hudElapsed = 1
  }, options)
  elements['field-of-view'].addEventListener('input', event => {
    camera.fov = Number(event.target.value)
    camera.updateProjectionMatrix()
    elements['fov-value'].value = event.target.value
  }, options)
  document.querySelectorAll('input[name="palette"]').forEach(radio => radio.addEventListener('change', event => {
    renderer.uniforms.palette.value = Number(event.target.value)
    document.querySelector('.status-right .status-extra').textContent = ['ASCII / RGB', 'ASCII / GRN', 'ASCII / AMB'][Number(event.target.value)]
  }, options))
  elements['glow-toggle'].addEventListener('change', event => { renderer.uniforms.glow.value = Number(event.target.checked) }, options)
  elements['rain-toggle'].addEventListener('change', event => {
    city.weather.enabled = event.target.checked
    city.weather.update(city.elapsed, walker.position, layout.origin, layout.locationAt(walker.position))
  }, options)
  elements['fullscreen-button'].disabled = !document.fullscreenEnabled
  elements['fullscreen-button'].addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      notice('Fullscreen is unavailable in this browser.')
    }
  }, options)
  document.addEventListener('fullscreenchange', () => {
    ui.setButton('fullscreen-button', document.fullscreenElement ? 'minimize' : 'maximize', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen')
    resize()
  }, options)
  document.addEventListener('pointerdown', event => {
    if (!elements['settings-panel'].hidden && !elements['settings-panel'].contains(event.target) && !elements['settings-button'].contains(event.target)) settings(false, false)
    if (!elements['places-panel'].hidden && !elements['places-panel'].contains(event.target) && !elements['places-button'].contains(event.target)) places(false, false)
  }, options)
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && !elements['settings-panel'].hidden) settings(false)
    if (event.code === 'Escape' && !elements['places-panel'].hidden) places(false)
  }, options)
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true) }, options)
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault()
    setPaused(true)
    notice('Graphics connection lost. Reload to reconnect.')
  }, options)
  window.addEventListener('resize', resize, options)
  setMap(state.showMap)
  resize()

  renderer.renderer.setAnimationLoop(now => {
    const delta = Math.min(Math.max(0, (now - previous) / 1000), 0.08)
    previous = now
    if (!state.paused) {
      controls.update(delta)
      let input = controls.input
      if (state.touring) {
        const target = { x: streetCoordinate(tour.column), z: streetCoordinate(tour.row, 'z') }
        const offsetX = target.x - walker.position.x
        const offsetZ = target.z - walker.position.z
        if (Math.hypot(offsetX, offsetZ) < 1) {
          const step = [{ column: 2, row: 0 }, { column: 0, row: -3 }, { column: -2, row: 0 }, { column: 0, row: -3 }][state.tourIndex++ % 4]
          tour.column += step.column
          tour.row += step.row
        }
        const targetYaw = Math.atan2(-offsetX, -offsetZ)
        const difference = Math.atan2(Math.sin(targetYaw - controls.yaw), Math.cos(targetYaw - controls.yaw))
        controls.yaw += THREE.MathUtils.clamp(difference, -delta * 1.2, delta * 1.2)
        input = { forward: Math.abs(difference) < 0.35 ? 0.64 : 0 }
      }
      accumulator += delta
      let stepped = false
      while (accumulator >= 1 / 60) {
        layout.update(walker.position)
        walker.syncLayout(layout)
        walker.update(input, controls.yaw)
        accumulator -= 1 / 60
        stepped = true
      }
      if (stepped) controls.jumpRequested = false
      city.update(delta, walker.position)
      bob += Math.hypot(walker.velocity.x, walker.velocity.z) * delta
    }
    camera.position.copy(walker.position)
    camera.position.x -= layout.origin.x
    camera.position.z -= layout.origin.z
    if (!reducedMotion.matches && walker.grounded) camera.position.y += Math.sin(bob * 2.4) * 0.024 * Math.min(1, Math.hypot(walker.velocity.x, walker.velocity.z) / 4.8)
    camera.rotation.set(controls.pitch, controls.yaw, 0)
    renderer.render(city.scene, camera)
    frames++
    fpsFrames++
    fpsElapsed += delta
    hudElapsed += delta
    if (fpsElapsed >= 0.5) {
      fps = fpsFrames / fpsElapsed
      fpsElapsed = 0
      fpsFrames = 0
    }
    if (hudElapsed > 0.12) {
      ui.update({ position: walker.position, yaw: controls.yaw, time: city.elapsed, fps, layout, renderer })
      hudElapsed = 0
    }
    if (state.noticeUntil && now > state.noticeUntil) elements.notice.hidden = true
  })
  elements['boot-state'].hidden = true
  window.__city = {
    ready: true,
    renderer,
    camera,
    walker,
    city,
    layout,
    teleport: moveTo,
    snapshot: () => ({ position: walker.position, origin: layout.origin, location: layout.locationAt(walker.position), blocks: layout.blocks.length, buildings: layout.buildings.length, floors: layout.interiors.size, colliders: walker.world.colliders.len(), renderedBlocks: city.chunks.size, yaw: controls.yaw, pitch: controls.pitch, paused: state.paused, touring: state.touring, time: city.elapsed, frames, columns: renderer.columns, rows: renderer.rows, palette: renderer.uniforms.palette.value, glow: renderer.uniforms.glow.value, fov: camera.fov }),
  }
  dispose = () => {
    events.abort()
    controls.dispose()
    renderer.dispose()
    walker.dispose()
    city.dispose()
    delete window.__city
  }
}

initialize().catch(error => {
  console.error(error)
  elements['boot-state'].replaceChildren()
  const message = document.createElement('span')
  message.textContent = 'Unable to initialize the city. A WebGL2-capable browser is required.'
  const retry = document.createElement('button')
  retry.textContent = 'Reconnect'
  retry.addEventListener('click', () => window.location.reload(), options)
  elements['boot-state'].append(message, retry)
  elements['boot-state'].hidden = false
})

import.meta.hot?.dispose(() => {
  disposed = true
  dispose()
})
