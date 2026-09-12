import { CITY } from './layout.js'

const format = number => Math.round(number).toLocaleString('en-US')

export function createLab(ui, { layout, city, walker, renderer, scanner }) {
  const elements = ui.elements
  const cells = [...elements['stream-grid'].querySelectorAll('button')]
  let selected = null
  let scanVisible = false

  function updateScan(position) {
    if (!scanVisible) return
    const target = scanner.target
    const building = target?.building
    elements['scan-panel'].classList.toggle('scan-empty', !building)
    elements['scan-title'].textContent = building?.venue.name ?? 'NO BUILDING IN RANGE'
    elements['scan-subtitle'].textContent = building ? `${building.shop} / ${building.use}` : '180 M / FORWARD SCAN'
    elements['scan-state'].textContent = building ? 'IDENTIFIED' : 'NO SIGNAL'
    elements['scan-distance'].textContent = building ? `${format(Math.hypot(Math.max(0, Math.abs(position.x - building.x) - building.width / 2), Math.max(0, Math.abs(position.z - building.z) - building.depth / 2)))} M` : '--'
    elements['scan-floors'].textContent = building ? String(building.floors) : '--'
    elements['scan-size'].textContent = building ? `${Math.round(building.width)} x ${Math.round(building.depth)} M` : '--'
    elements['scan-address'].textContent = building ? `BLOCK ${building.id}` : '--'
    elements['scan-seed'].textContent = building ? `#${building.seed.toString(16).toUpperCase()}` : '--'
    elements['scan-entrance'].disabled = !building
    elements['scan-interior'].disabled = !building
    elements['scan-panel'].style.setProperty('--scan-color', building?.venue.secondary ?? '#7d929e')
  }

  function update({ position, fps }) {
    updateScan(position)
    if (elements['lab-panel'].hidden) return
    const blocks = [...layout.blocks].sort((first, second) => first.row - second.row || first.column - second.column)
    const newlyAdded = new Set(layout.lastChange.added)
    const interiorBuildings = new Set([...layout.interiors.values()].map(plan => plan.buildingId))
    blocks.forEach((block, index) => {
      const cell = cells[index]
      if (!cell) return
      const inside = block.column === layout.center.column && block.row === layout.center.row
      const interior = block.buildings.some(building => interiorBuildings.has(building.id))
      const loaded = city.chunks.has(block.key)
      cell.dataset.blockKey = block.key
      cell.classList.toggle('cell-pending', !loaded)
      cell.classList.toggle('cell-new', newlyAdded.has(block.key))
      cell.classList.toggle('cell-park', block.park)
      cell.classList.toggle('cell-interior', interior)
      cell.classList.toggle('cell-current', inside)
      cell.classList.toggle('cell-selected', selected === block.key)
      cell.firstElementChild.textContent = inside ? '+' : block.park ? ':' : block.buildings.length > 1 ? 'II' : 'I'
      const label = `Block ${block.key}, ${block.park ? 'plaza' : `${block.buildings.length} buildings`}, ${Math.round(block.width)} by ${Math.round(block.depth)} meters${interior ? ', interiors loaded' : ''}${loaded ? '' : ', pending render'}`
      cell.setAttribute('aria-label', label)
      cell.title = label
      cell.setAttribute('aria-pressed', String(selected === block.key))
    })
    elements['atlas-center'].textContent = `${layout.center.column} : ${layout.center.row}`
    elements['stat-resident'].textContent = `${city.chunks.size} / ${layout.blocks.length}`
    elements['stat-generated'].textContent = format(layout.metrics.generated)
    elements['stat-unloaded'].textContent = format(layout.metrics.unloaded)
    elements['stat-rebases'].textContent = format(layout.metrics.originShifts)
    elements['stat-calls'].textContent = format(renderer.stats.drawCalls)
    elements['stat-triangles'].textContent = format(renderer.stats.triangles)
    elements['stat-colliders'].textContent = format(walker.world.colliders.len())
    elements['stat-floors'].textContent = format(layout.interiors.size)
    elements['lab-frame-time'].textContent = `${(1000 / Math.max(1, fps)).toFixed(1)} MS`
    elements['render-buffer'].textContent = `${renderer.target.width} x ${renderer.target.height}`
    elements['lab-origin'].textContent = `${Math.round(layout.origin.x)} / ${Math.round(layout.origin.z)}`
  }

  return {
    update,
    showScan(visible) {
      scanVisible = visible
      elements['scan-panel'].hidden = !visible
      document.body.classList.toggle('scan-visible', visible)
      elements['scan-button'].setAttribute('aria-pressed', String(visible && scanner.target !== null))
      elements['scan-hint'].textContent = visible && scanner.target ? 'LOCKED' : 'SCAN'
      if (visible) updateScan(walker.position)
    },
    selectBlock(key) {
      selected = key
      const block = layout.chunks.get(key)
      if (!block?.building) return false
      scanner.select(block.building, walker.position)
      this.showScan(true)
      return true
    },
    setMode(mode) {
      renderer.setMode(mode)
      document.querySelectorAll('[data-render-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.renderMode === mode)))
      elements['reveal-controls'].hidden = mode !== 'split'
      elements['lab-reveal-setting'].hidden = mode !== 'split'
      document.body.dataset.renderMode = mode
    },
    setReveal(percent) {
      const parsed = Number(percent)
      if (!Number.isFinite(parsed)) return
      const value = Math.max(0, Math.min(100, parsed))
      renderer.setReveal(value / 100)
      elements['lab-reveal'].value = String(value)
      elements['reveal-position'].value = String(value)
      elements['lab-reveal-value'].value = `${value}%`
      elements['reveal-divider'].style.left = `${value}%`
    },
    get scanVisible() { return scanVisible },
  }
}