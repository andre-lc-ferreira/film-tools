import { detectFilmArea } from './detect'
import { encodeTiff, encodeWithCanvas, type ExportFormat } from './encode'
import { extract, FULL_CROP, NO_ORIENTATION, type Crop, type Orientation } from './geometry'
import { analyze, DEFAULT_ADJUSTMENTS, processRaster, type Adjustments, type Analysis, type FilmKind, type InvertSettings } from './invert'
import { decodeFile, type DecodedImage, type Raster } from './raster'

/** Cópia reduzida usada nas prévias. A exportação sempre volta ao arquivo original. */
export const PROXY_SIDE = 3000
export const PREVIEW_SIDE = 1600
export const THUMB_SIDE = 360

/** Tudo o que o usuário define para um quadro do rolo. */
export interface FrameEdit {
  kind: FilmKind
  base: [number, number, number] | null
  adj: Adjustments
  orientation: Orientation
  crop: Crop
  aspectId: string
  portrait: boolean
}

export const DEFAULT_EDIT: FrameEdit = {
  kind: 'color',
  base: null,
  adj: DEFAULT_ADJUSTMENTS,
  orientation: NO_ORIENTATION,
  crop: FULL_CROP,
  aspectId: 'free',
  portrait: false,
}

export interface LoadedFrame {
  image: DecodedImage
  proxy: Raster
  thumb: Raster
  /** Recorte sugerido em volta do filme (fotos de mesa de luz) ou null. */
  detected: Crop | null
}

export async function loadFrame(file: File): Promise<LoadedFrame> {
  const image = await decodeFile(file)
  const proxy = extract(image.raster, NO_ORIENTATION, FULL_CROP, PROXY_SIDE)
  const thumb = extract(proxy, NO_ORIENTATION, FULL_CROP, THUMB_SIDE)
  return { image, proxy, thumb, detected: detectFilmArea(proxy) }
}

export const settingsOf = (e: Pick<FrameEdit, 'kind' | 'base' | 'adj'>): InvertSettings => ({ kind: e.kind, base: e.base, adj: e.adj })

/**
 * Pontos de preto/branco de um quadro, sempre medidos do mesmo jeito (na prévia do recorte),
 * para que a exportação — individual ou em lote — fique igual ao que aparece na tela.
 */
export function frameAnalysis(proxy: Raster, edit: FrameEdit): Analysis {
  return analyze(extract(proxy, edit.orientation, edit.crop, PREVIEW_SIDE), edit)
}

/** Gera o arquivo final em resolução total (recorte do original, sem reamostragem). */
export async function renderExport(image: DecodedImage, edit: FrameEdit, analysis: Analysis, format: ExportFormat): Promise<Blob> {
  const full = extract(image.raster, edit.orientation, edit.crop)
  const s = settingsOf(edit)
  if (format === 'tiff') {
    const data = image.raster.bitDepth === 16 ? processRaster(full, s, analysis, 'rgb16') : processRaster(full, s, analysis, 'rgb8')
    return encodeTiff(data, full.width, full.height)
  }
  return encodeWithCanvas(processRaster(full, s, analysis, 'rgba8'), full.width, full.height, format, 1)
}

export function exportName(image: DecodedImage, ext: string) {
  return `${image.name.replace(/\.[^.]+$/, '') || 'negativo'}-positivo.${ext}`
}
