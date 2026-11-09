import {
  CURVE_SLOPE,
  DEV_COMPENSATION,
  GAMMA_PER_STOP,
  GRAIN_PER_STOP,
  finalColor,
  grainAmount,
  toneCurve,
  type RenderParams,
} from './filmMath'

/** Fonte já preparada (redimensionada) para o renderer. */
export type FilmSource = HTMLCanvasElement

const MAX_SOURCE = 1600

/** Carrega uma imagem e reduz para no máximo 1600 px no maior lado. */
export async function prepareSource(src: string): Promise<FilmSource> {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  await img.decode()
  const scale = Math.min(1, MAX_SOURCE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

/* ------------------------------------------------------------------ */
/* WebGL2                                                              */
/* ------------------------------------------------------------------ */

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const f = (n: number) => n.toFixed(4)

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_img;
uniform vec2 u_res;
uniform vec3 u_mix;
uniform float u_contrast, u_stops, u_latitude, u_grain, u_grainSize, u_acutance, u_seed;
uniform float u_negative, u_develop, u_paper;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + u_seed);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), q = fract(p);
  q = q * q * (3.0 - 2.0 * q);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), q.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), q.x), q.y);
}
float lum(vec2 uv) {
  vec3 c = pow(texture(u_img, uv).rgb, vec3(2.2));
  return dot(c, u_mix);
}

void main() {
  vec2 px = 1.0 / u_res;
  float L = lum(v_uv);
  if (u_acutance > 0.0) {
    float r = 1.6;
    float blur = (lum(v_uv + vec2(px.x * r, 0.0)) + lum(v_uv - vec2(px.x * r, 0.0)) +
                  lum(v_uv + vec2(0.0, px.y * r)) + lum(v_uv - vec2(0.0, px.y * r))) * 0.25;
    L = max(0.0, L + u_acutance * (L - blur));
  }

  // Curva característica (espelha filmMath.toneCurve)
  float x = log2(max(L, 1e-5) / 0.18) - u_stops;
  float g = u_contrast * pow(${f(GAMMA_PER_STOP)}, u_stops);
  float y = (x + u_stops * ${f(DEV_COMPENSATION)}) * g;
  float tone = 0.5 + 0.5 * tanh(y * ${f(CURVE_SLOPE)});
  tone *= smoothstep(-u_latitude - 1.5, -u_latitude + 1.0, x);

  // Grão: ruído em espaço da imagem (independe da resolução de saída)
  float cells = 760.0 / u_grainSize;
  vec2 gp = v_uv * vec2(u_res.x / u_res.y, 1.0) * cells;
  float cellPx = u_res.y / cells;
  float n = (vnoise(gp) - 0.5) + (vnoise(gp * 2.07 + 13.1) - 0.5) * 0.55 + (hash(gp * 3.3) - 0.5) * 0.45;
  float amp = u_grain * pow(${f(GRAIN_PER_STOP)}, u_stops) * 2.0 * min(1.0, sqrt(cellPx));
  tone += n * amp * (0.35 + 2.6 * tone * (1.0 - tone));

  // Saída (espelha filmMath.finalColor)
  float print = 1.0 - (1.0 - tone) * u_paper;
  float density = tone * u_develop * 0.86;
  vec3 neg = vec3(0.93 - density, 0.9 - density, 0.85 - density * 0.95);
  outColor = vec4(clamp(mix(vec3(print), neg, u_negative), 0.0, 1.0), 1.0);
}`

interface Renderer {
  readonly kind: 'webgl2' | 'canvas2d'
  render(source: FilmSource, target: HTMLCanvasElement, params: RenderParams, width: number): void
}

class GLRenderer implements Renderer {
  readonly kind = 'webgl2' as const
  private canvas = document.createElement('canvas')
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private textures = new WeakMap<FilmSource, WebGLTexture>()
  private uniforms: Record<string, WebGLUniformLocation | null> = {}

  constructor() {
    const gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false })
    if (!gl) throw new Error('WebGL2 indisponível')
    this.gl = gl
    this.program = this.link(VERT, FRAG)
    gl.useProgram(this.program)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(this.program, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    for (const name of ['u_img', 'u_res', 'u_mix', 'u_contrast', 'u_stops', 'u_latitude', 'u_grain', 'u_grainSize', 'u_acutance', 'u_seed', 'u_negative', 'u_develop', 'u_paper']) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name)
    }
  }

  private link(vs: string, fs: string) {
    const gl = this.gl
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const p = gl.createProgram()!
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
    return p
  }

  private texture(source: FilmSource) {
    let tex = this.textures.get(source)
    if (tex) return tex
    const gl = this.gl
    tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.textures.set(source, tex)
    return tex
  }

  render(source: FilmSource, target: HTMLCanvasElement, p: RenderParams, width: number) {
    const gl = this.gl
    const w = Math.max(1, Math.round(Math.min(width, source.width)))
    const h = Math.max(1, Math.round((w * source.height) / source.width))
    this.canvas.width = w
    this.canvas.height = h
    gl.viewport(0, 0, w, h)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture(source))
    const u = this.uniforms
    gl.uniform1i(u.u_img, 0)
    gl.uniform2f(u.u_res, w, h)
    gl.uniform3f(u.u_mix, ...p.mix)
    gl.uniform1f(u.u_contrast, p.contrast)
    gl.uniform1f(u.u_stops, p.stops)
    gl.uniform1f(u.u_latitude, p.latitude)
    gl.uniform1f(u.u_grain, p.grain)
    gl.uniform1f(u.u_grainSize, p.grainSize)
    gl.uniform1f(u.u_acutance, p.acutance)
    gl.uniform1f(u.u_seed, p.seed)
    gl.uniform1f(u.u_negative, p.negative)
    gl.uniform1f(u.u_develop, p.develop)
    gl.uniform1f(u.u_paper, p.paper)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    if (target.width !== w || target.height !== h) {
      target.width = w
      target.height = h
    }
    target.getContext('2d')!.drawImage(this.canvas, 0, 0)
  }
}

/* ------------------------------------------------------------------ */
/* Fallback Canvas 2D (mesma matemática, em CPU, resolução reduzida)   */
/* ------------------------------------------------------------------ */

const LIN = new Float32Array(256).map((_, i) => (i / 255) ** 2.2)

class CPURenderer implements Renderer {
  readonly kind = 'canvas2d' as const
  private scratch = document.createElement('canvas')

  render(source: FilmSource, target: HTMLCanvasElement, p: RenderParams, width: number) {
    const w = Math.max(1, Math.round(Math.min(width, source.width, 900)))
    const h = Math.max(1, Math.round((w * source.height) / source.width))
    this.scratch.width = w
    this.scratch.height = h
    const sctx = this.scratch.getContext('2d', { willReadFrequently: true })!
    sctx.drawImage(source, 0, 0, w, h)
    const img = sctx.getImageData(0, 0, w, h)
    const d = img.data
    const amp = grainAmount(p) * 2
    let seed = Math.floor(p.seed * 1e6) || 1
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < d.length; i += 4) {
      const L = LIN[d[i]] * p.mix[0] + LIN[d[i + 1]] * p.mix[1] + LIN[d[i + 2]] * p.mix[2]
      let t = toneCurve(L, p)
      t += (rand() - 0.5) * 1.2 * amp * (0.35 + 2.6 * t * (1 - t))
      const [r, g, b] = finalColor(t, p)
      d[i] = r * 255
      d[i + 1] = g * 255
      d[i + 2] = b * 255
    }
    if (target.width !== w || target.height !== h) {
      target.width = w
      target.height = h
    }
    target.getContext('2d')!.putImageData(img, 0, 0)
  }
}

let shared: Renderer | null = null

export function getRenderer(): Renderer {
  if (shared) return shared
  const forceCpu = new URLSearchParams(location.search).has('cpu')
  try {
    shared = forceCpu ? new CPURenderer() : new GLRenderer()
  } catch (err) {
    console.warn('WebGL2 indisponível, usando Canvas 2D.', err)
    shared = new CPURenderer()
  }
  return shared
}
