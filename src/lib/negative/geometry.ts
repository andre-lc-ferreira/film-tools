import { createRaster, type Raster } from './raster'

export type Rotation = 0 | 90 | 180 | 270

/** Orientação aplicada à imagem enviada: giro horário e depois espelhamento horizontal. */
export interface Orientation {
  rotation: Rotation
  flipH: boolean
}

/** Retângulo de recorte normalizado (0–1) no espaço já orientado. */
export interface Crop {
  x: number
  y: number
  w: number
  h: number
}

export const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 }
export const NO_ORIENTATION: Orientation = { rotation: 0, flipH: false }

export function orientedSize(width: number, height: number, o: Orientation) {
  return o.rotation === 90 || o.rotation === 270 ? { width: height, height: width } : { width, height }
}

/** Recorte em pixels inteiros do espaço orientado. Sempre ao menos 1×1. */
export function cropPixels(width: number, height: number, o: Orientation, crop: Crop) {
  const size = orientedSize(width, height, o)
  const x = Math.min(size.width - 1, Math.max(0, Math.round(crop.x * size.width)))
  const y = Math.min(size.height - 1, Math.max(0, Math.round(crop.y * size.height)))
  const w = Math.max(1, Math.min(size.width - x, Math.round(crop.w * size.width)))
  const h = Math.max(1, Math.min(size.height - y, Math.round(crop.h * size.height)))
  return { x, y, w, h }
}

/** Converte coordenada (u, v) do espaço orientado para o índice do pixel na imagem original. */
export function sourceMapper(width: number, height: number, o: Orientation) {
  const ow = orientedSize(width, height, o).width
  const { rotation, flipH } = o
  return (u: number, v: number) => {
    if (flipH) u = ow - 1 - u
    let sx: number, sy: number
    switch (rotation) {
      case 90:
        sx = v
        sy = height - 1 - u
        break
      case 180:
        sx = width - 1 - u
        sy = height - 1 - v
        break
      case 270:
        sx = width - 1 - v
        sy = u
        break
      default:
        sx = u
        sy = v
    }
    return sy * width + sx
  }
}

/**
 * Orienta + recorta a imagem. Sem `maxSide` (ou se o recorte já couber), copia os pixels
 * exatamente, sem reamostrar — é o caminho da exportação. Com `maxSide`, reduz por média de
 * blocos (usado nas prévias).
 */
export function extract(src: Raster, o: Orientation, crop: Crop, maxSide?: number): Raster {
  const c = cropPixels(src.width, src.height, o, crop)
  const scale = maxSide ? Math.min(1, maxSide / Math.max(c.w, c.h)) : 1
  const outW = Math.max(1, Math.round(c.w * scale))
  const outH = Math.max(1, Math.round(c.h * scale))
  const out = createRaster(outW, outH, src.bitDepth)
  const s = src.data
  const d = out.data
  const map = sourceMapper(src.width, src.height, o)

  if (outW === c.w && outH === c.h) {
    let k = 0
    for (let v = 0; v < c.h; v++) {
      for (let u = 0; u < c.w; u++) {
        const i = map(c.x + u, c.y + v) * 3
        d[k++] = s[i]
        d[k++] = s[i + 1]
        d[k++] = s[i + 2]
      }
    }
    return out
  }

  const bw = c.w / outW
  const bh = c.h / outH
  // No máximo ~4×4 amostras por pixel de saída: suficiente para a prévia e rápido em fotos grandes.
  const stepU = Math.max(1, Math.floor(bw / 4))
  const stepV = Math.max(1, Math.floor(bh / 4))
  let k = 0
  for (let j = 0; j < outH; j++) {
    const v0 = c.y + Math.floor(j * bh)
    const v1 = Math.max(v0 + 1, c.y + Math.floor((j + 1) * bh))
    for (let i = 0; i < outW; i++) {
      const u0 = c.x + Math.floor(i * bw)
      const u1 = Math.max(u0 + 1, c.x + Math.floor((i + 1) * bw))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let v = v0; v < v1; v += stepV) {
        for (let u = u0; u < u1; u += stepU) {
          const p = map(u, v) * 3
          r += s[p]
          g += s[p + 1]
          b += s[p + 2]
          n++
        }
      }
      d[k++] = Math.round(r / n)
      d[k++] = Math.round(g / n)
      d[k++] = Math.round(b / n)
    }
  }
  return out
}

/** Média de uma pequena área (raio em pixels) em torno de um ponto normalizado. Valores 0–1. */
export function sampleArea(r: Raster, nx: number, ny: number, radius = 3): [number, number, number] {
  const cx = Math.round(nx * (r.width - 1))
  const cy = Math.round(ny * (r.height - 1))
  const max = r.bitDepth === 16 ? 65535 : 255
  const acc = [0, 0, 0]
  let n = 0
  for (let y = Math.max(0, cy - radius); y <= Math.min(r.height - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(r.width - 1, cx + radius); x++) {
      const i = (y * r.width + x) * 3
      acc[0] += r.data[i]
      acc[1] += r.data[i + 1]
      acc[2] += r.data[i + 2]
      n++
    }
  }
  return [acc[0] / n / max, acc[1] / n / max, acc[2] / n / max]
}

/**
 * Gira a imagem como ela aparece na tela (1 = horário). Com espelhamento ativo, girar a tela
 * no sentido horário equivale a girar o original no sentido anti-horário.
 */
export function rotate(o: Orientation, dir: 1 | -1): Orientation {
  const d = o.flipH ? -dir : dir
  return { ...o, rotation: ((((o.rotation + d * 90) % 360) + 360) % 360) as Rotation }
}

/** Leva o recorte junto quando a imagem gira na tela. */
export function rotateCrop(c: Crop, dir: 1 | -1): Crop {
  return dir === 1 ? { x: 1 - (c.y + c.h), y: c.x, w: c.h, h: c.w } : { x: c.y, y: 1 - (c.x + c.w), w: c.h, h: c.w }
}

export function flipCrop(c: Crop): Crop {
  return { ...c, x: 1 - (c.x + c.w) }
}
