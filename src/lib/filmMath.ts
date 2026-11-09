import type { Developer, Film } from '../data/types'

/** Parâmetros consumidos pelo shader (e pelo fallback em CPU). */
export interface RenderParams {
  mix: [number, number, number]
  contrast: number
  /** Push (+) / pull (−) em stops. */
  stops: number
  latitude: number
  grain: number
  grainSize: number
  acutance: number
  seed: number
  /** 0 = positivo (cópia), 1 = negativo. */
  negative: number
  /** 0..1 – densidade formada (usado na animação de revelação). */
  develop: number
  /** 0..1 – revelação do papel na ampliação (1 = imagem completa). */
  paper: number
}

export function paramsFor(film: Film, developer: Developer | undefined, stops: number, extra: Partial<RenderParams> = {}): RenderParams {
  return {
    mix: film.look.mix,
    contrast: film.look.contrast,
    stops,
    latitude: film.look.latitude,
    grain: film.look.grain * (developer?.grain ?? 1),
    grainSize: film.look.grainSize * (developer && developer.grain > 1.2 ? 1.1 : 1),
    acutance: developer?.acutance ?? 0,
    seed: 0.37,
    negative: 0,
    develop: 1,
    paper: 1,
    ...extra,
  }
}

/* ---------- Constantes do modelo (iguais no GLSL) ---------- */
/** Contraste cresce ~13 % por stop de push (e cai no pull). */
export const GAMMA_PER_STOP = 1.13
/** Fração da subexposição recuperada nos tons médios pela revelação mais longa. */
export const DEV_COMPENSATION = 0.7
/** Grão cresce ~30 % por stop de push. */
export const GRAIN_PER_STOP = 1.3
export const CURVE_SLOPE = 0.42

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/**
 * Converte luminância linear (já com o mix espectral) em tom da cópia (0..1, perceptual).
 * Modelo: exposição real → curva característica (toe/shoulder via tanh) → perda de sombra
 * abaixo da latitude do filme.
 */
export function toneCurve(linearLum: number, p: RenderParams): number {
  const x = Math.log2(Math.max(linearLum, 1e-5) / 0.18) - p.stops
  const g = p.contrast * GAMMA_PER_STOP ** p.stops
  const y = (x + p.stops * DEV_COMPENSATION) * g
  let tone = 0.5 + 0.5 * Math.tanh(y * CURVE_SLOPE)
  tone *= smoothstep(-p.latitude - 1.5, -p.latitude + 1.0, x)
  return tone
}

export function grainAmount(p: RenderParams): number {
  return p.grain * GRAIN_PER_STOP ** p.stops
}

/** Cor final a partir do tom positivo (aplica negativo / revelação / papel). */
export function finalColor(tone: number, p: RenderParams): [number, number, number] {
  // Cópia em papel: surge do branco conforme o papel revela.
  const print = 1 - (1 - tone) * p.paper
  // Negativo: base levemente acinzentada/quente; densidade cresce com o revelador.
  const density = tone * p.develop * 0.86
  const neg: [number, number, number] = [0.93 - density, 0.9 - density, 0.85 - density * 0.95]
  const n = p.negative
  return [
    clamp01(print * (1 - n) + neg[0] * n),
    clamp01(print * (1 - n) + neg[1] * n),
    clamp01(print * (1 - n) + neg[2] * n),
  ]
}
