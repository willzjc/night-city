import { createIcons, SquareTerminal, Crosshair, Map, Pause, Play, SlidersHorizontal, Maximize, Minimize, X, Footprints, Route, RotateCcw, ArrowUp, Move, Eye, DoorOpen, ArrowUpRight, BedDouble } from 'lucide'
import { CITY, districtAt, streetIndex } from './layout.js'
import { VENUES } from './venues.js'

const icons = { SquareTerminal, Crosshair, Map, Pause, Play, SlidersHorizontal, Maximize, Minimize, X, Footprints, Route, RotateCcw, ArrowUp, Move, Eye, DoorOpen, ArrowUpRight, BedDouble }
const paintIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.5, 'aria-hidden': 'true' } })
const icon = name => `<i data-lucide="${name}"></i>`
const button = (id, name, label, extra = '') => `<button id="${id}" class="icon-button ${extra}" type="button" title="${label}" aria-label="${label}">${icon(name)}</button>`

export function createInterface() {
  document.querySelector('#app').innerHTML = `
    <header class="topbar">
      <a class="wordmark" href="./" aria-label="ASCII City home">${icon('square-terminal')}<h1>ASCII<span class="brand-slash">/</span>CITY<span class="cursor">_</span></h1></a>
      <div class="session-label"><span class="live-dot"></span><span>AFTERHOURS</span><span class="divider">/</span><time id="clock">23:08:00</time></div>
      <nav class="toolbar" aria-label="Simulation controls">
        <button id="enter-button" class="enter-button" type="button" title="Capture mouse. WASD to walk; mouse to look; Esc to release.">${icon('crosshair')}<span>ENTER CITY</span></button>
        <span class="toolbar-divider"></span>
        ${button('places-button', 'door-open', 'Places and interiors')}
        ${button('map-button', 'map', 'Toggle city map')}
        ${button('pause-button', 'pause', 'Pause simulation')}
        ${button('settings-button', 'sliders-horizontal', 'Display settings')}
        ${button('fullscreen-button', 'maximize', 'Enter fullscreen', 'fullscreen-button')}
      </nav>
    </header>
    <main id="viewport" aria-label="City simulation">
      <canvas id="city" tabindex="0" aria-label="First-person ASCII city. WASD to move, mouse or arrow keys to look, Space to jump, Shift to run."></canvas>
      <div class="scene-top scene-id"><span class="tiny-cross">+</span> WORLD_${CITY.seed}<span class="scene-divider">/</span><span id="view-state">STREET LEVEL</span></div>
      <div class="compass" aria-label="Heading"><div class="compass-track"><span id="heading-left">NW</span><span class="compass-ticks">: . .</span><strong id="heading">N</strong><span class="compass-ticks">. . :</span><span id="heading-right">NE</span></div><span class="compass-needle">|</span><span id="bearing">355</span></div>
      <div class="scene-top scene-signal"><span class="signal-bars"><i></i><i></i><i></i><i></i></span> LOCAL CONNECTION</div>
      <span id="crosshair" aria-hidden="true">+</span>
      <section class="location" aria-label="Current district"><div class="location-eyebrow"><span class="location-mark"></span>DISTRICT <span id="district-number">01</span></div><h2 id="district-name">LOWER CENTRAL</h2><div class="location-detail"><span id="street-name">CENTRAL AVENUE</span><span class="divider">/</span><span id="coordinates">X +000.0 Z +098.0</span></div></section>
      <aside id="map-panel" class="map-panel" aria-label="Local city map"><div class="map-caption"><span id="map-title">NEIGHBORHOOD</span><span>N ^</span></div><canvas id="minimap" width="186" height="138" role="img" aria-label="ASCII map showing your position and heading"></canvas><div class="map-footer"><span id="map-sector">GRID 04 : 06</span><span id="map-scale">220 M</span></div></aside>
      <div class="touch-controls">
        <div id="move-pad" class="stick" role="group" aria-label="Movement joystick"><span class="stick-axis horizontal"></span><span class="stick-axis vertical"></span><span class="stick-knob">${icon('move')}</span></div>
        <div class="touch-right">${button('jump-button', 'arrow-up', 'Jump', 'jump-button')}<div id="look-pad" class="stick" role="group" aria-label="Look joystick"><span class="stick-axis horizontal"></span><span class="stick-axis vertical"></span><span class="stick-knob">${icon('eye')}</span></div></div>
      </div>
      <section id="places-panel" class="settings-panel places-panel" role="dialog" aria-modal="false" aria-labelledby="places-title" hidden>
        <div class="panel-heading"><h2 id="places-title">PLACES / INTERIORS</h2>${button('close-places', 'x', 'Close places')}</div>
        <div class="places-list">${VENUES.map(venue => `<button type="button" class="place-button" data-venue="${venue.type}" aria-label="Visit ${venue.name}"><span class="place-marker" style="--venue-color: ${venue.accent}"></span><span><strong>${venue.name}</strong><small>${venue.type}</small></span>${icon('arrow-up-right')}</button>`).join('')}</div>
        <button id="apartment-button" class="place-button" type="button" aria-label="Visit an apartment">${icon('bed-double')}<span><strong>RESIDENCE</strong><small>APARTMENT / UPPER FLOOR</small></span>${icon('arrow-up-right')}</button>
        <button id="street-button" class="reset-button" type="button">${icon('route')}Return to street</button>
        <div class="panel-build">CITY DIRECTORY<span>LOCAL GRID</span></div>
      </section>
      <section id="settings-panel" class="settings-panel" role="dialog" aria-modal="false" aria-labelledby="settings-title" hidden>
        <div class="panel-heading"><h2 id="settings-title">DISPLAY CONFIG</h2>${button('close-settings', 'x', 'Close settings')}</div>
        <div class="setting-block"><label for="glyph-size">Glyph size <output id="glyph-value" for="glyph-size">5.0</output></label><input id="glyph-size" type="range" min="4" max="10" step="0.5" value="5" /></div>
        <div class="setting-row"><span id="palette-label">Palette</span><div class="swatches" role="radiogroup" aria-labelledby="palette-label"><label class="swatch" title="Full color"><input type="radio" name="palette" value="0" checked aria-label="Full color" /><span class="spectrum"></span></label><label class="swatch" title="Green phosphor"><input type="radio" name="palette" value="1" aria-label="Green phosphor" /><span class="phosphor"></span></label><label class="swatch" title="Amber"><input type="radio" name="palette" value="2" aria-label="Amber" /><span class="amber"></span></label></div></div>
        <label class="setting-row" for="glow-toggle"><span>Phosphor glow</span><input id="glow-toggle" class="toggle" type="checkbox" role="switch" checked /></label>
        <label class="setting-row" for="rain-toggle"><span>Rain</span><input id="rain-toggle" class="toggle" type="checkbox" role="switch" checked /></label>
        <div class="setting-block"><label for="field-of-view">Field of view <output id="fov-value" for="field-of-view">75</output></label><input id="field-of-view" type="range" min="55" max="100" step="5" value="75" /></div>
        <div class="camera-modes" role="group" aria-label="Camera mode"><button id="walk-mode" type="button" aria-pressed="true">${icon('footprints')} WALK</button><button id="tour-mode" type="button" aria-pressed="false">${icon('route')} TOUR</button></div>
        <button id="reset-button" class="reset-button" type="button">${icon('rotate-ccw')}Reset position</button>
        <div class="panel-build">TERMINAL 001<span>SEED ${CITY.seed}</span></div>
      </section>
      <div id="boot-state" class="boot-state" role="status"><span class="boot-mark">[ _ ]</span><span>ESTABLISHING CONNECTION</span></div>
      <div id="notice" class="notice" role="status" hidden></div>
    </main>
    <footer class="statusbar"><div class="status-left"><span id="run-dot" class="live-dot"></span><span id="run-state">LIVE</span><span class="status-extra muted">SIMULATION / 001</span></div><span id="resolution">INITIALIZING</span><div class="status-right"><span class="status-extra muted">ASCII / RGB</span><span><span id="fps">--</span> FPS</span></div></footer>
  `
  paintIcons()
  const elements = Object.fromEntries(Array.from(document.querySelectorAll('#app [id]')).map(element => [element.id, element]))
  const mapContext = elements.minimap.getContext('2d')
  elements['settings-button'].setAttribute('aria-haspopup', 'dialog')
  elements['settings-button'].setAttribute('aria-expanded', 'false')
  elements['settings-button'].setAttribute('aria-controls', 'settings-panel')
  elements['map-button'].setAttribute('aria-controls', 'map-panel')
  elements['places-button'].setAttribute('aria-haspopup', 'dialog')
  elements['places-button'].setAttribute('aria-expanded', 'false')
  elements['places-button'].setAttribute('aria-controls', 'places-panel')

  function setButton(id, name, label) {
    elements[id].innerHTML = icon(name)
    elements[id].title = label
    elements[id].setAttribute('aria-label', label)
    paintIcons()
  }

  function drawMap(layout, position, yaw) {
    const columns = 31
    const rows = 23
    const interior = layout.locationAt(position)
    const plan = interior ? layout.interiors.get(`${interior.building.id}/${interior.floor}`) : null
    const span = interior ? Math.max(interior.building.width, interior.building.depth * columns / rows) * 1.14 : 220
    const spacing = span / columns
    const center = interior?.building ?? position
    elements['map-title'].textContent = interior ? 'FLOOR PLAN' : 'NEIGHBORHOOD'
    elements['map-scale'].textContent = `${Math.round(span)} M`
    mapContext.clearRect(0, 0, 186, 138)
    mapContext.font = '400 7px "IBM Plex Mono"'
    mapContext.textBaseline = 'middle'
    mapContext.textAlign = 'center'
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const worldX = center.x + (column - 15) * spacing
        const worldZ = center.z + (row - 11) * spacing
        let character = '.'
        let color = '#314853'
        if (plan) {
          const inside = Math.abs(worldX - center.x) < center.width / 2 && Math.abs(worldZ - center.z) < center.depth / 2
          if (!inside) continue
          const piece = plan.solids.find(solid => solid.kind !== 'floor' && solid.kind !== 'landing' && Math.abs(worldX - solid.x) <= solid.width / 2 + spacing * 0.25 && Math.abs(worldZ - solid.z) <= solid.depth / 2 + spacing * 0.25)
          character = piece ? (piece.kind === 'step' ? '/' : piece.kind === 'wall' ? '#' : '=') : '.'
          color = piece ? (piece.kind === 'step' ? '#e9c971' : '#7cc9ce') : '#314853'
          if (Math.abs(worldX - center.x) < 1.5 && Math.abs(worldZ - center.z - center.depth / 2) < spacing) { character = 'E'; color = '#edba78' }
        } else {
          const block = layout.blocks.find(block => Math.abs(block.x - worldX) < block.width / 2 && Math.abs(block.z - worldZ) < block.depth / 2)
          character = block ? (block.park ? '+' : '#') : '.'
          color = block ? (block.park ? '#72946a' : '#4b737d') : '#293840'
          const entrance = block?.buildings.find(building => Math.abs(worldX - building.x) < spacing && Math.abs(worldZ - building.z - building.depth / 2) < spacing)
          if (entrance) { character = 'o'; color = entrance.venue.accent }
        }
        mapContext.fillStyle = color
        mapContext.fillText(character, column * 6 + 3, row * 6 + 3)
      }
    }
    const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360
    mapContext.font = '500 12px "IBM Plex Mono"'
    mapContext.fillStyle = '#f7dc75'
    mapContext.fillText(['^', '>', 'v', '<'][Math.round(heading / 90) % 4], 93 + (position.x - center.x) / spacing * 6, 69 + (position.z - center.z) / spacing * 6)
  }

  function update({ position, yaw, time, fps, layout, renderer }) {
    const district = districtAt(position)
    const interior = layout.locationAt(position)
    const bearing = ((-yaw * 180 / Math.PI) % 360 + 360) % 360
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const directionIndex = Math.round(bearing / 45) % 8
    const signed = value => `${value < 0 ? '-' : '+'}${Math.abs(value).toFixed(1).padStart(5, '0')}`
    elements['district-name'].textContent = interior ? (interior.floor === 0 ? interior.building.venue.name : interior.label) : district.name
    elements['district-number'].textContent = district.number
    elements.coordinates.textContent = `X ${signed(position.x)} Z ${signed(position.z)}`
    elements['street-name'].textContent = interior ? `${interior.label} / FLOOR ${String(interior.floor + 1).padStart(2, '0')}` : Math.abs(position.x) < 8 ? 'CENTRAL AVENUE' : `${streetIndex(position.z, 'z')} / CROSS STREET`
    if (interior) elements['view-state'].textContent = 'INTERIOR / CONNECTED'
    else if (elements['view-state'].textContent.startsWith('INTERIOR')) elements['view-state'].textContent = 'STREET LEVEL'
    document.querySelector('.status-left .status-extra').textContent = `STREAM / ${layout.blocks.length} BLOCKS`
    elements.heading.textContent = directions[directionIndex]
    elements['heading-left'].textContent = directions[(directionIndex + 7) % 8]
    elements['heading-right'].textContent = directions[(directionIndex + 1) % 8]
    elements.bearing.textContent = `${Math.round(bearing).toString().padStart(3, '0')}`
    elements.clock.textContent = new Date(Date.UTC(2026, 0, 1, 23, 8) + time * 1000).toISOString().slice(11, 19)
    elements.fps.textContent = Math.round(fps)
    elements.resolution.textContent = `${renderer.columns} x ${renderer.rows} CHARS`
    elements['map-sector'].textContent = `GRID ${streetIndex(position.x)} : ${streetIndex(position.z, 'z')}`
    if (!elements['map-panel'].hidden) drawMap(layout, position, yaw)
  }

  return { elements, update, setButton }
}