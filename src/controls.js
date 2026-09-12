import { SPAWN } from './layout.js'

const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

export class Controls {
  constructor(canvas, actions) {
    this.canvas = canvas
    this.actions = actions
    this.yaw = SPAWN.yaw
    this.pitch = SPAWN.pitch
    this.enabled = true
    this.keys = new Set()
    this.move = { x: 0, y: 0 }
    this.look = { x: 0, y: 0 }
    this.jumpRequested = false
    this.touchJump = false
    this.events = new AbortController()
    const options = { signal: this.events.signal }

    window.addEventListener('keydown', event => {
      if (event.code === 'Escape') this.release()
      if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, select, textarea, button')) return
      if (!event.repeat && event.code === 'KeyP') actions.pause()
      if (!event.repeat && event.code === 'KeyM') actions.map()
      if (!event.repeat && event.code === 'KeyR') actions.reset()
      if (!event.repeat && event.code === 'KeyQ') actions.scan?.()
      if (!event.repeat && event.code === 'KeyL') actions.lab?.()
      if (!this.enabled || !movementKeys.has(event.code)) return
      event.preventDefault()
      actions.manual()
      this.keys.add(event.code)
      if (event.code === 'Space' && !event.repeat) this.jumpRequested = true
    }, options)
    window.addEventListener('keyup', event => this.keys.delete(event.code), options)
    window.addEventListener('blur', () => this.clear(), options)
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear() }, options)
    document.addEventListener('pointerlockchange', () => {
      this.clear()
      actions.capture(document.pointerLockElement === canvas)
    }, options)
    document.addEventListener('mousemove', event => {
      if (this.enabled && document.pointerLockElement === canvas) this.turn(event.movementX * 0.002, event.movementY * 0.002)
    }, options)

    canvas.addEventListener('pointerdown', event => {
      if (!this.enabled || event.button !== 0) return
      actions.manual()
      canvas.focus({ preventScroll: true })
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
      if (event.pointerType === 'mouse') this.engage()
    }, options)
    canvas.addEventListener('pointermove', event => {
      if (!this.enabled || document.pointerLockElement === canvas || this.drag?.id !== event.pointerId) return
      this.turn((event.clientX - this.drag.x) * 0.003, (event.clientY - this.drag.y) * 0.003)
      this.drag.x = event.clientX
      this.drag.y = event.clientY
    }, options)
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(eventName, () => { this.drag = null }, options)
    }

    this.bindStick(document.querySelector('#move-pad'), this.move)
    this.bindStick(document.querySelector('#look-pad'), this.look)
    const jump = document.querySelector('#jump-button')
    jump.addEventListener('pointerdown', event => {
      if (!this.enabled) return
      event.preventDefault()
      jump.setPointerCapture(event.pointerId)
      actions.manual()
      this.touchJump = true
      this.jumpRequested = true
    }, options)
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      jump.addEventListener(eventName, () => { this.touchJump = false }, options)
    }
  }

  bindStick(element, axis) {
    let pointer = null
    let center
    const knob = element.querySelector('.stick-knob')
    const options = { signal: this.events.signal }
    const update = event => {
      const offsetX = event.clientX - center.x
      const offsetY = event.clientY - center.y
      const magnitude = Math.max(32, Math.hypot(offsetX, offsetY))
      axis.x = offsetX / magnitude
      axis.y = offsetY / magnitude
      knob.style.transform = `translate(${axis.x * 25}px, ${axis.y * 25}px)`
    }
    element.addEventListener('pointerdown', event => {
      if (!this.enabled || pointer !== null) return
      event.preventDefault()
      this.actions.manual()
      const bounds = element.getBoundingClientRect()
      center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      pointer = event.pointerId
      element.setPointerCapture(pointer)
      update(event)
    }, options)
    element.addEventListener('pointermove', event => { if (event.pointerId === pointer) update(event) }, options)
    const release = event => {
      if (event.pointerId !== pointer) return
      pointer = null
      axis.x = 0
      axis.y = 0
      knob.style.transform = ''
    }
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(eventName, release, options)
  }

  turn(horizontal, vertical) {
    this.yaw -= horizontal
    this.pitch = clamp(this.pitch - vertical, -1.25, 1.25)
  }

  update(delta) {
    if (!this.enabled) return
    this.turn((this.look.x * 1.7 + Number(this.keys.has('ArrowRight')) * 1.3 - Number(this.keys.has('ArrowLeft')) * 1.3) * delta, this.look.y * delta * 1.25)
  }

  get input() {
    if (!this.enabled) return {}
    return {
      forward: Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - this.move.y,
      strafe: Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) + this.move.x,
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      jump: this.keys.has('Space') || this.touchJump || this.jumpRequested,
    }
  }

  engage() {
    if (!this.enabled) return
    this.actions.manual()
    this.canvas.focus({ preventScroll: true })
    try {
      this.canvas.requestPointerLock?.()?.catch(() => { this.actions.capture(false) })
    } catch {
      this.actions.capture(false)
    }
  }

  release() {
    this.clear()
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
  }

  clear() {
    this.keys.clear()
    this.move.x = this.move.y = this.look.x = this.look.y = 0
    this.jumpRequested = false
    this.touchJump = false
    this.drag = null
    document.querySelectorAll('.stick-knob').forEach(knob => { knob.style.transform = '' })
  }

  reset() {
    this.clear()
    this.yaw = SPAWN.yaw
    this.pitch = SPAWN.pitch
  }

  dispose() {
    this.release()
    this.events.abort()
  }
}