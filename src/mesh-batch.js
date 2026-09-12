import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export class MeshBatch {
  constructor(group, origin = { x: 0, z: 0 }) {
    this.group = group
    this.origin = origin
    this.geometries = []
  }

  add(geometry, color, positionX, positionY, positionZ, rotation = 0) {
    if (geometry.index) {
      const indexed = geometry
      geometry = geometry.toNonIndexed()
      indexed.dispose()
    }
    geometry.rotateY(rotation)
    const tint = new THREE.Color(color)
    const normals = geometry.getAttribute('normal')
    const colors = new Float32Array(normals.count * 3)
    for (let index = 0; index < normals.count; index++) {
      const shade = 0.76 + Math.max(0, normals.getY(index)) * 0.24 + Math.max(0, normals.getZ(index)) * 0.16
      colors[index * 3] = tint.r * shade
      colors[index * 3 + 1] = tint.g * shade
      colors[index * 3 + 2] = tint.b * shade
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.translate(positionX - this.origin.x, positionY, positionZ - this.origin.z)
    this.geometries.push(geometry)
  }

  box(width, height, depth, positionX, positionY, positionZ, color, rotation = 0) {
    this.add(new THREE.BoxGeometry(width, height, depth), color, positionX, positionY, positionZ, rotation)
  }

  commit() {
    if (!this.geometries.length) return
    const mesh = new THREE.Mesh(mergeGeometries(this.geometries), new THREE.MeshBasicMaterial({ vertexColors: true }))
    this.geometries.forEach(geometry => geometry.dispose())
    this.geometries.length = 0
    this.group.add(mesh)
    return mesh
  }
}

export function disposeGroup(group) {
  const geometries = new Set()
  const materials = new Set()
  group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry)
    if (object.material && !object.userData.sharedMaterial) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material))
  })
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => { material.map?.dispose(); material.dispose() })
  group.removeFromParent()
}