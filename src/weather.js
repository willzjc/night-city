import * as THREE from 'three'
import { randomGenerator } from './layout.js'

export function createRain(scene, seed) {
  const random = randomGenerator(seed)
  const positions = new Float32Array(1000 * 6)
  const tails = new Float32Array(1000 * 2)
  for (let drop = 0; drop < 1000; drop++) {
    const positionX = (random() - 0.5) * 64
    const positionY = random() * 27
    const positionZ = (random() - 0.5) * 64
    positions.set([positionX, positionY, positionZ, positionX, positionY, positionZ], drop * 6)
    tails[drop * 2 + 1] = 1
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('tail', new THREE.BufferAttribute(tails, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float tail;
      uniform float time;
      varying float fade;
      void main() {
        vec3 point = position;
        point.y = mod(position.y - time * 11.0, 27.0) + 0.3 - tail * 0.6;
        point.x += tail * 0.06;
        fade = (1.0 - smoothstep(12.0, 33.0, length(point.xz))) * (1.0 - tail * 0.4);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
      }
    `,
    fragmentShader: `
      varying float fade;
      void main() { gl_FragColor = vec4(0.17, 0.31, 0.38, fade * 0.55); }
    `,
  })
  const rain = new THREE.LineSegments(geometry, material)
  rain.frustumCulled = false
  rain.name = 'rain'
  scene.add(rain)
  return {
    rain,
    enabled: true,
    update(elapsed, position, origin, indoors) {
      rain.visible = this.enabled && !indoors
      rain.position.set(position.x - origin.x, 0, position.z - origin.z)
      material.uniforms.time.value = elapsed
    },
  }
}