import { extract, FULL_CROP, NO_ORIENTATION, type Crop } from './geometry'
import { maxValue, type Raster } from './raster'

const SIDE = 400

/**
 * Acha o filme numa foto feita sobre mesa de luz (filme claro, fundo escuro em volta).
 * Devolve o recorte normalizado ao redor dele, ou null se a imagem já é só o filme
 * (scanner) ou se não há um contraste claro entre filme e fundo.
 */
export function detectFilmArea(src: Raster): Crop | null {
  const r = extract(src, NO_ORIENTATION, FULL_CROP, SIDE)
  const { width: w, height: h, data: d } = r
  const max = maxValue(r)
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) lum[i] = (d[i * 3] + d[i * 3 + 1] + d[i * 3 + 2]) / (3 * max)

  const sorted = Float32Array.from(lum).sort()
  const bright = sorted[Math.floor(sorted.length * 0.99)]
  const dark = sorted[Math.floor(sorted.length * 0.05)]
  // Precisa de um fundo bem mais escuro que o filme.
  if (bright < 0.15 || dark > bright * 0.35) return null
  const t = dark + (bright - dark) * 0.45

  const cols = new Float32Array(w)
  const rows = new Float32Array(h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (lum[y * w + x] > t) {
        cols[x]++
        rows[y]++
      }
    }
  }
  const span = (arr: Float32Array, total: number) => {
    let a = -1
    let b = -1
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] / total > 0.2) {
        if (a < 0) a = i
        b = i
      }
    }
    return [a, b] as const
  }
  const [x0, x1] = span(cols, h)
  const [y0, y1] = span(rows, w)
  if (x0 < 0 || y0 < 0) return null

  const crop: Crop = { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h }
  // Ocupa quase tudo (scan) ou é pequeno demais para ser o filme: deixa como está.
  if (crop.w * crop.h > 0.9 || crop.w < 0.15 || crop.h < 0.15) return null
  return crop
}
