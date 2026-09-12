import RAPIER from '@dimforge/rapier3d-compat'
import { SPAWN } from './layout.js'

let initialization

export async function createWalker(layout) {
  initialization ??= RAPIER.init()
  await initialization
  return new Walker(layout)
}

class Walker {
  constructor(layout) {
    this.world = new RAPIER.World({ x: 0, y: -20, z: 0 })
    this.origin = { x: 0, z: 0 }
    this.groups = new Map()
    this.revision = -1
    this.world.createCollider(new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })))
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(SPAWN.x, SPAWN.y, SPAWN.z))
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3), this.body)
    this.controller = this.world.createCharacterController(0.025)
    this.controller.enableAutostep(0.34, 0.2, false)
    this.controller.enableSnapToGround(0.4)
    this.velocity = { x: 0, y: 0, z: 0 }
    this.grounded = false
    this.jumpHeld = false
    this.syncLayout(layout)
    this.world.step()
  }

  get position() {
    const position = this.body.translation()
    return { x: position.x + this.origin.x, y: position.y + 0.8, z: position.z + this.origin.z }
  }

  syncLayout(layout) {
    if (layout.revision !== undefined && layout.revision === this.revision) return
    const origin = layout.origin ?? { x: 0, z: 0 }
    const shifted = origin.x !== this.origin.x || origin.z !== this.origin.z
    if (shifted) {
      const current = this.body.translation()
      this.body.setTranslation({ x: current.x + this.origin.x - origin.x, y: current.y, z: current.z + this.origin.z - origin.z }, true)
      this.body.setNextKinematicTranslation(this.body.translation())
      this.origin = { ...origin }
    }
    const wanted = layout.collisionGroups ?? new Map([['static', layout.colliders]])
    for (const [key, group] of this.groups) {
      if (wanted.get(key) !== group.solids) {
        group.colliders.forEach(collider => this.world.removeCollider(collider, true))
        this.groups.delete(key)
      }
    }
    for (const [key, solids] of wanted) {
      if (!this.groups.has(key)) {
        const colliders = solids.map(solid => this.world.createCollider(RAPIER.ColliderDesc.cuboid(solid.width / 2, solid.height / 2, solid.depth / 2)
          .setTranslation(solid.x - origin.x, solid.y, solid.z - origin.z)))
        this.groups.set(key, { solids, colliders })
      } else if (shifted) {
        const group = this.groups.get(key)
        group.colliders.forEach((collider, index) => {
          const solid = group.solids[index]
          collider.setTranslation({ x: solid.x - origin.x, y: solid.y, z: solid.z - origin.z })
        })
      }
    }
    this.revision = layout.revision
    this.world.step()
  }

  update(input, yaw, delta = 1 / 60) {
    const forward = input.forward ?? 0
    const strafe = input.strafe ?? 0
    const magnitude = Math.max(1, Math.hypot(forward, strafe))
    const speed = input.sprint ? 8.5 : 4.8
    const targetX = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed / magnitude
    const targetZ = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * speed / magnitude
    const blend = 1 - Math.exp(-14 * delta)
    this.velocity.x += (targetX - this.velocity.x) * blend
    this.velocity.z += (targetZ - this.velocity.z) * blend
    if (this.grounded && this.velocity.y < 0) this.velocity.y = -1.5
    if (input.jump && !this.jumpHeld && this.grounded) this.velocity.y = 7.5
    this.jumpHeld = Boolean(input.jump)
    this.velocity.y -= 20 * delta
    this.controller.computeColliderMovement(this.collider, {
      x: this.velocity.x * delta,
      y: this.velocity.y * delta,
      z: this.velocity.z * delta,
    })
    const movement = this.controller.computedMovement()
    const current = this.body.translation()
    this.body.setNextKinematicTranslation({ x: current.x + movement.x, y: current.y + movement.y, z: current.z + movement.z })
    this.grounded = this.controller.computedGrounded()
    if (movement.y < this.velocity.y * delta - 0.001 && this.velocity.y > 0) this.velocity.y = 0
    this.world.timestep = delta
    this.world.step()
    return this.position
  }

  reset(position = SPAWN) {
    this.body.setTranslation({ x: position.x - this.origin.x, y: position.y ?? SPAWN.y, z: position.z - this.origin.z }, true)
    this.body.setNextKinematicTranslation(this.body.translation())
    this.velocity = { x: 0, y: 0, z: 0 }
    this.grounded = false
    this.jumpHeld = false
    this.world.step()
  }

  dispose() {
    this.world.free()
  }
}