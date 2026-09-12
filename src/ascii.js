import * as THREE from 'three'

const characters = ' .,:;-+=xX2Z0#8@'

function makeAtlas() {
  const atlas = document.createElement('canvas')
  atlas.width = characters.length * 24
  atlas.height = 32
  const context = atlas.getContext('2d')
  context.fillStyle = '#000000'
  context.fillRect(0, 0, atlas.width, atlas.height)
  context.fillStyle = '#ffffff'
  context.font = '500 25px "IBM Plex Mono"'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  Array.from(characters).forEach((character, index) => context.fillText(character, index * 24 + 12, 16))
  const texture = new THREE.CanvasTexture(atlas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

export class AsciiRenderer {
  constructor(canvas) {
    this.cellSize = 5
    this.mode = 'ascii'
    this.stats = { drawCalls: 0, triangles: 0, textures: 0, geometries: 0 }
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    })
    this.uniforms = {
      sceneTexture: { value: this.target.texture },
      atlas: { value: makeAtlas() },
      grid: { value: new THREE.Vector2(1, 1) },
      glyphCount: { value: characters.length },
      glow: { value: 1 },
      palette: { value: 0 },
      renderMode: { value: 0 },
      reveal: { value: 0.5 },
    }
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: `
        varying vec2 screenUv;
        void main() {
          screenUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D sceneTexture;
        uniform sampler2D atlas;
        uniform vec2 grid;
        uniform float glyphCount;
        uniform float glow;
        uniform int palette;
        uniform int renderMode;
        uniform float reveal;
        varying vec2 screenUv;

        float noise(vec2 cell) {
          return fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          if (renderMode == 1 || (renderMode == 2 && screenUv.x > reveal)) {
            vec3 source = texture2D(sceneTexture, screenUv).rgb;
            gl_FragColor = vec4(min(pow(max(source, vec3(0.0)), vec3(0.4545)) * 1.38, vec3(1.0)), 1.0);
            return;
          }
          vec2 cell = floor(screenUv * grid);
          vec2 center = (cell + 0.5) / grid;
          vec2 offset = 0.26 / grid;
          vec3 sampled = texture2D(sceneTexture, center).rgb;
          sampled = max(sampled, texture2D(sceneTexture, center + offset).rgb * 0.85);
          sampled = max(sampled, texture2D(sceneTexture, center - offset).rgb * 0.85);
          vec3 color = min(pow(max(sampled, vec3(0.0)), vec3(0.4545)) * 1.38, vec3(1.0));
          float brightness = max(color.r, max(color.g, color.b));
          if (brightness < 0.055) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }
          float density = brightness < 0.18 ? brightness : pow(brightness, 0.65);
          float character = clamp(floor(density * 12.0 + noise(cell) * 3.0), 1.0, glyphCount - 1.0);
          vec2 localUv = fract(screenUv * grid);
          vec2 glyphUv = vec2((character + localUv.x) / glyphCount, localUv.y);
          float ink = texture2D(atlas, glyphUv).r;
          vec2 haloOffset = vec2(1.0 / (24.0 * glyphCount), 1.0 / 32.0);
          float halo = texture2D(atlas, glyphUv + vec2(haloOffset.x, 0.0)).r;
          halo += texture2D(atlas, glyphUv - vec2(haloOffset.x, 0.0)).r;
          halo += texture2D(atlas, glyphUv + vec2(0.0, haloOffset.y)).r;
          halo += texture2D(atlas, glyphUv - vec2(0.0, haloOffset.y)).r;
          if (palette == 1) color = vec3(0.4, 1.0, 0.68) * brightness;
          if (palette == 2) color = vec3(1.0, 0.69, 0.28) * brightness;
          gl_FragColor = vec4(color * (ink + halo * 0.08 * glow), 1.0);
        }
      `,
    })
    this.outputScene = new THREE.Scene()
    this.outputScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material))
    this.outputCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  resize(width, height) {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.columns = Math.max(32, Math.min(360, Math.floor(this.width / this.cellSize)))
    this.rows = Math.max(24, Math.floor(this.height / (this.cellSize * 1.65)))
    this.uniforms.grid.value.set(this.columns, this.rows)
    const scale = Math.min(1.5, this.renderer.getPixelRatio(), 1920 / this.width)
    this.target.setSize(this.mode === 'ascii' ? this.columns * 2 : Math.round(this.width * scale), this.mode === 'ascii' ? this.rows * 2 : Math.round(this.height * scale))
    this.renderer.setSize(this.width, this.height, false)
  }

  setMode(mode) {
    const index = ['ascii', 'solid', 'split'].indexOf(mode)
    if (index < 0) throw new RangeError(`Unknown render mode: ${mode}`)
    this.mode = mode
    this.uniforms.renderMode.value = index
    if (this.width && this.height) this.resize(this.width, this.height)
  }

  setReveal(value) {
    if (!Number.isFinite(value)) throw new TypeError('Reveal must be a finite number')
    this.uniforms.reveal.value = THREE.MathUtils.clamp(value, 0, 1)
  }

  setDensity(cellSize) {
    this.cellSize = cellSize
    this.resize(this.width, this.height)
  }

  render(scene, camera) {
    this.renderer.setRenderTarget(this.target)
    this.renderer.render(scene, camera)
    this.stats.drawCalls = this.renderer.info.render.calls
    this.stats.triangles = this.renderer.info.render.triangles
    this.stats.textures = this.renderer.info.memory.textures
    this.stats.geometries = this.renderer.info.memory.geometries
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.outputScene, this.outputCamera)
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.target.dispose()
    this.uniforms.atlas.value.dispose()
    this.material.dispose()
    this.outputScene.children[0].geometry.dispose()
    this.renderer.dispose()
  }
}