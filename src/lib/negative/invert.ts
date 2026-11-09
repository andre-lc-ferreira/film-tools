import { maxValue, type Raster } from './raster'

/**
 * Inversão de negativo para positivo.
 *
 * Modelo: o scan registra a luz que atravessou o filme (transmitância). Para cada canal,
 * convertemos o valor para linear e depois para densidade (D = −log10 T). A densidade é
 * proporcional ao log da exposição na cena, então ela já é a "imagem positiva" em escala
 * logarítmica. Normalizamos cada canal entre a densidade da base do filme (ou a sombra mais
 * clara da cena) e a altas-luzes mais densa — isso remove a máscara laranja do C-41 e
 * equilibra as cores, como o filtro de cor de um ampliador.
 */

export type FilmKind = 'color' | 'bw' | 'positive'

export interface Adjustments {
  /** Em stops (−2 a +2). */
  exposure: number
  /** −1 a +1 */
  contrast: number
  /** −1 (frio) a +1 (quente) */
  temperature: number
  /** −1 (verde) a +1 (magenta) */
  tint: number
  /** −1 a +1: + aprofunda os pretos */
  blacks: number
  /** −1 a +1: + clareia os brancos */
  whites: number
  /** 0 a 2 */
  saturation: number
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  contrast: 0,
  temperature: 0,
  tint: 0,
  blacks: 0,
  whites: 0,
  saturation: 1,
}

export interface InvertSettings {
  kind: FilmKind
  /** Cor da base do filme (valores 0–1 do arquivo), amostrada pelo usuário. null = automático. */
  base: [number, number, number] | null
  adj: Adjustments
}

/** Pontos de normalização por canal, no "sinal" do modo (densidade ou valor). */
export interface Analysis {
  lo: [number, number, number]
  hi: [number, number, number]
}

/** Fração de pixels ignorada em cada ponta do histograma (evita poeira e reflexos). */
const CLIP = 0.001
const BINS = 4096
const MIN_LIN = 1 / 262144
/**
 * Maior densidade acima da base que um negativo real atinge (as altas-luzes mais densas
 * ficam em ~1,2–1,8). Tudo acima disso é fundo preto em volta do filme, ruído ou
 * blocos de JPEG — fica fora da medição para não esticar o contraste da foto inteira.
 */
const MAX_RANGE = 2.0

export const srgbToLinear = (e: number) => (e <= 0.04045 ? e / 12.92 : Math.pow((e + 0.055) / 1.055, 2.4))
const linearToSrgb = (l: number) => (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)
const density = (lin: number) => -Math.log10(Math.max(MIN_LIN, lin))

/** Sinal de um valor do arquivo (0–1) para o modo escolhido. */
function signal(kind: FilmKind, e: number) {
  return kind === 'positive' ? e : density(srgbToLinear(e))
}

/** Luminância linear de um pixel, usada no P&B. */
function lumaLinear(lin: Float32Array, r: number, g: number, b: number) {
  return 0.2126 * lin[r] + 0.7152 * lin[g] + 0.0722 * lin[b]
}

function linearTable(r: Raster) {
  const max = maxValue(r)
  const t = new Float32Array(max + 1)
  for (let v = 0; v <= max; v++) t[v] = srgbToLinear(v / max)
  return t
}

/**
 * Mede o recorte (já sem bordas, de preferência) e devolve os pontos de preto e branco por canal.
 * Roda na prévia reduzida; o mesmo resultado é usado na exportação em resolução total,
 * para que o arquivo final fique idêntico ao que aparece na tela.
 */
export function analyze(r: Raster, s: Pick<InvertSettings, 'kind' | 'base'>): Analysis {
  const n = r.width * r.height
  const d = r.data
  const shift = r.bitDepth === 16 ? 4 : -4 // 16 bits → >>4 ; 8 bits → <<4  (4096 bins)
  const bin = (v: number) => (shift > 0 ? v >> shift : v << -shift)
  const toE = (b: number) => (b + 0.5) / BINS

  /** Primeiro bin (escuro) ainda dentro da faixa útil do filme, dada a densidade da base. */
  const minBinFor = (loD: number) => Math.max(0, Math.floor(linearToSrgb(Math.pow(10, -(loD + MAX_RANGE))) * BINS))

  if (s.kind === 'bw') {
    const lin = linearTable(r)
    const hist = new Uint32Array(BINS)
    for (let i = 0; i < n; i++) {
      const y = lumaLinear(lin, d[i * 3], d[i * 3 + 1], d[i * 3 + 2])
      hist[Math.min(BINS - 1, Math.floor(linearToSrgb(y) * BINS))]++
    }
    const loD = s.base
      ? density(0.2126 * srgbToLinear(s.base[0]) + 0.7152 * srgbToLinear(s.base[1]) + 0.0722 * srgbToLinear(s.base[2]))
      : density(srgbToLinear(toE(highPercentile(hist, n))))
    const hiD = density(srgbToLinear(toE(lowPercentile(hist, minBinFor(loD)))))
    return finish({ lo: [loD, loD, loD], hi: [hiD, hiD, hiD] })
  }

  const hists = [new Uint32Array(BINS), new Uint32Array(BINS), new Uint32Array(BINS)]
  for (let i = 0; i < n; i++) {
    hists[0][bin(d[i * 3])]++
    hists[1][bin(d[i * 3 + 1])]++
    hists[2][bin(d[i * 3 + 2])]++
  }

  if (s.kind === 'positive') {
    // Cromo/positivo: níveis em conjunto para não mudar o equilíbrio de cor do filme.
    const lo = Math.min(...hists.map((h) => toE(lowPercentile(h, 0))))
    const hi = Math.max(...hists.map((h) => toE(highPercentile(h, n))))
    return finish({ lo: [lo, lo, lo], hi: [hi, hi, hi] })
  }

  const lo = [0, 1, 2].map((c) => (s.base ? signal('color', s.base[c]) : signal('color', toE(highPercentile(hists[c], n))))) as [number, number, number]
  const hi = [0, 1, 2].map((c) => signal('color', toE(lowPercentile(hists[c], minBinFor(lo[c]))))) as [number, number, number]
  return finish({ lo, hi })
}

function finish(a: Analysis): Analysis {
  for (let c = 0; c < 3; c++) if (a.hi[c] - a.lo[c] < 0.02) a.hi[c] = a.lo[c] + 0.02
  return a
}

/** Bin no percentil CLIP a partir do lado escuro, contando só os bins a partir de `minBin`. */
function lowPercentile(hist: Uint32Array, minBin: number): number {
  let total = 0
  for (let b = minBin; b < hist.length; b++) total += hist[b]
  const target = Math.max(1, Math.floor(total * CLIP))
  let acc = 0
  for (let b = minBin; b < hist.length; b++) {
    acc += hist[b]
    if (acc >= target) return b
  }
  return minBin
}

/** Bin no percentil 1−CLIP (lado claro). */
function highPercentile(hist: Uint32Array, total: number): number {
  const target = Math.max(1, Math.floor(total * CLIP))
  let acc = 0
  for (let b = hist.length - 1; b >= 0; b--) {
    acc += hist[b]
    if (acc >= target) return b
  }
  return hist.length - 1
}

/** Curva de tom aplicada ao sinal normalizado de um canal (0–1 → 0–1, já em sRGB). */
export function toneCurve(n: number, channel: 0 | 1 | 2, adj: Adjustments): number {
  let x = n + adj.exposure * 0.12
  // Equilíbrio de cor como filtragem de ampliador: desloca cada canal.
  if (channel === 0) x += adj.temperature * 0.06 + adj.tint * 0.03
  if (channel === 1) x -= adj.tint * 0.06
  if (channel === 2) x += -adj.temperature * 0.06 + adj.tint * 0.03
  x = 0.5 + (x - 0.5) * (1 + adj.contrast * (adj.contrast > 0 ? 1 : 0.6))
  const black = adj.blacks * 0.2
  const white = 1 - adj.whites * 0.2
  x = (x - black) / Math.max(0.05, white - black)
  return x <= 0 ? 0 : x >= 1 ? 1 : x
}

/** Tabelas por canal: valor do arquivo → saída 0–1. */
function buildLuts(r: Raster, s: InvertSettings, a: Analysis): Float32Array[] {
  const max = maxValue(r)
  if (s.kind === 'bw') {
    // Índice = luminância linear quantizada em 16 bits.
    const lut = new Float32Array(65536)
    for (let i = 0; i < 65536; i++) {
      const n = (density(i / 65535) - a.lo[0]) / (a.hi[0] - a.lo[0])
      lut[i] = toneCurve(n, 1, { ...s.adj, temperature: 0, tint: 0 })
    }
    return [lut]
  }
  return [0, 1, 2].map((c) => {
    const lut = new Float32Array(max + 1)
    for (let v = 0; v <= max; v++) {
      const n = (signal(s.kind, v / max) - a.lo[c]) / (a.hi[c] - a.lo[c])
      lut[v] = toneCurve(n, c as 0 | 1 | 2, s.adj)
    }
    return lut
  })
}

export type OutputMode = 'rgba8' | 'rgb8' | 'rgb16'

/**
 * Aplica a inversão a cada pixel.
 * - rgba8: para canvas (prévia, PNG, JPEG)
 * - rgb8 / rgb16: para TIFF
 */
export function processRaster(r: Raster, s: InvertSettings, a: Analysis, mode: 'rgba8'): Uint8ClampedArray
export function processRaster(r: Raster, s: InvertSettings, a: Analysis, mode: 'rgb8'): Uint8Array
export function processRaster(r: Raster, s: InvertSettings, a: Analysis, mode: 'rgb16'): Uint16Array
export function processRaster(r: Raster, s: InvertSettings, a: Analysis, mode: OutputMode): Uint8ClampedArray | Uint8Array | Uint16Array {
  const n = r.width * r.height
  const d = r.data
  const luts = buildLuts(r, s, a)
  const stride = mode === 'rgba8' ? 4 : 3
  const scale = mode === 'rgb16' ? 65535 : 255
  const out = mode === 'rgba8' ? new Uint8ClampedArray(n * 4) : mode === 'rgb8' ? new Uint8Array(n * 3) : new Uint16Array(n * 3)
  const sat = s.kind === 'bw' ? 1 : s.adj.saturation
  const q = (x: number) => Math.round((x <= 0 ? 0 : x >= 1 ? 1 : x) * scale)

  if (s.kind === 'bw') {
    const lin = linearTable(r)
    const lut = luts[0]
    for (let i = 0, o = 0; i < n; i++, o += stride) {
      const y = lumaLinear(lin, d[i * 3], d[i * 3 + 1], d[i * 3 + 2])
      const v = q(lut[Math.min(65535, Math.round(y * 65535))])
      out[o] = out[o + 1] = out[o + 2] = v
      if (stride === 4) out[o + 3] = 255
    }
    return out
  }

  const [lr, lg, lb] = luts
  for (let i = 0, o = 0; i < n; i++, o += stride) {
    let R = lr[d[i * 3]]
    let G = lg[d[i * 3 + 1]]
    let B = lb[d[i * 3 + 2]]
    if (sat !== 1) {
      const L = 0.2126 * R + 0.7152 * G + 0.0722 * B
      R = L + (R - L) * sat
      G = L + (G - L) * sat
      B = L + (B - L) * sat
    }
    out[o] = q(R)
    out[o + 1] = q(G)
    out[o + 2] = q(B)
    if (stride === 4) out[o + 3] = 255
  }
  return out
}

/** RGBA 8 bits do arquivo como está (para mostrar o negativo original). */
export function rasterToRgba(r: Raster): Uint8ClampedArray {
  const n = r.width * r.height
  const out = new Uint8ClampedArray(n * 4)
  const shift = r.bitDepth === 16 ? 8 : 0
  for (let i = 0; i < n; i++) {
    out[i * 4] = r.data[i * 3] >> shift
    out[i * 4 + 1] = r.data[i * 3 + 1] >> shift
    out[i * 4 + 2] = r.data[i * 3 + 2] >> shift
    out[i * 4 + 3] = 255
  }
  return out
}
