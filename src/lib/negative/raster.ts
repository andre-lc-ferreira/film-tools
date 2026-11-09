/**
 * Imagem em memória: RGB intercalado, 8 ou 16 bits por canal.
 * É o formato único usado por todo o pipeline (decodificação → recorte → inversão → exportação),
 * para que a exportação use exatamente os pixels que foram enviados.
 */
export interface Raster {
  width: number
  height: number
  bitDepth: 8 | 16
  data: Uint8Array | Uint16Array
}

export type SourceFormat = 'jpeg' | 'png' | 'tiff' | 'webp' | 'other'

export interface DecodedImage {
  raster: Raster
  format: SourceFormat
  name: string
  /** Bytes do arquivo original (para exibir na tela). */
  fileSize: number
}

export const maxValue = (r: Pick<Raster, 'bitDepth'>) => (r.bitDepth === 16 ? 65535 : 255)

export function createRaster(width: number, height: number, bitDepth: 8 | 16): Raster {
  const len = width * height * 3
  return { width, height, bitDepth, data: bitDepth === 16 ? new Uint16Array(len) : new Uint8Array(len) }
}

/** Identifica o formato pelos primeiros bytes (a extensão do arquivo nem sempre é confiável). */
export function sniffFormat(bytes: Uint8Array): SourceFormat {
  const b = bytes
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a)) return 'tiff'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  return 'other'
}

export async function decodeFile(file: File): Promise<DecodedImage> {
  const buffer = await file.arrayBuffer()
  const format = sniffFormat(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)))
  const raster = format === 'tiff' ? await decodeTiff(buffer) : await decodeWithBrowser(file)
  return { raster, format, name: file.name, fileSize: file.size }
}

/** JPEG/PNG/WebP: o navegador decodifica, sem conversão de perfil de cor (mantém os valores do arquivo). */
async function decodeWithBrowser(file: File): Promise<Raster> {
  const bitmap = await createImageBitmap(file, { colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: 'from-image' })
  const { width, height } = bitmap
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || canvas.width !== width || canvas.height !== height) {
    bitmap.close()
    throw new Error('A imagem é grande demais para este navegador.')
  }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const rgba = ctx.getImageData(0, 0, width, height).data
  canvas.width = canvas.height = 0
  return rgbaToRaster(rgba, width, height)
}

export function rgbaToRaster(rgba: ArrayLike<number>, width: number, height: number): Raster {
  const out = createRaster(width, height, 8)
  const d = out.data
  for (let i = 0, j = 0, n = width * height; i < n; i++, j += 4) {
    d[i * 3] = rgba[j]
    d[i * 3 + 1] = rgba[j + 1]
    d[i * 3 + 2] = rgba[j + 2]
  }
  return out
}

/** TIFF de 8 ou 16 bits (RGB ou tons de cinza). Outros casos caem para 8 bits via UTIF. */
export async function decodeTiff(buffer: ArrayBuffer): Promise<Raster> {
  const UTIF = (await import('utif2')).default
  const ifds = UTIF.decode(buffer).filter((ifd) => ifd['t256'] != null)
  if (!ifds.length) throw new Error('TIFF sem imagem.')
  // O maior IFD é a imagem principal (os outros costumam ser miniaturas).
  const ifd = ifds.reduce((a, b) => (tag(b, 256) * tag(b, 257) > tag(a, 256) * tag(a, 257) ? b : a))
  UTIF.decodeImage(buffer, ifd)
  const width = ifd.width
  const height = ifd.height
  const bps = tag(ifd, 258, 1)
  const spp = tag(ifd, 277, 1)
  const photometric = tag(ifd, 262, 2)
  const planar = tag(ifd, 284, 1)
  const raw = ifd.data

  const simple = (bps === 8 || bps === 16) && planar === 1 && ((photometric === 2 && spp >= 3) || ((photometric === 0 || photometric === 1) && spp >= 1))
  if (!simple) return rgbaToRaster(UTIF.toRGBA8(ifd), width, height)

  const bitDepth = bps as 8 | 16
  const max = bitDepth === 16 ? 65535 : 255
  let src: Uint8Array | Uint16Array = raw
  if (bitDepth === 16) {
    // O UTIF já entrega 16 bits em little-endian.
    const aligned = raw.byteOffset % 2 === 0 ? raw : raw.slice()
    src = new Uint16Array(aligned.buffer, aligned.byteOffset, Math.floor(aligned.byteLength / 2))
  }

  const out = createRaster(width, height, bitDepth)
  const d = out.data
  const n = width * height
  if (photometric === 2) {
    for (let i = 0; i < n; i++) {
      const s = i * spp
      d[i * 3] = src[s]
      d[i * 3 + 1] = src[s + 1]
      d[i * 3 + 2] = src[s + 2]
    }
  } else {
    const invert = photometric === 0
    for (let i = 0; i < n; i++) {
      const v = invert ? max - src[i * spp] : src[i * spp]
      d[i * 3] = d[i * 3 + 1] = d[i * 3 + 2] = v
    }
  }
  return out
}

function tag(ifd: Record<string, unknown>, id: number, fallback = 0): number {
  const v = ifd[`t${id}`] as number[] | undefined
  return v && v.length ? Number(v[0]) : fallback
}
