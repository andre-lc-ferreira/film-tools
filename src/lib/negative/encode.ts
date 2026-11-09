/**
 * Codificação dos arquivos exportados. A saída tem sempre as mesmas dimensões em pixels do
 * recorte feito no arquivo original (sem reamostragem).
 */

export type ExportFormat = 'tiff' | 'png' | 'jpeg'

export const EXPORT_MIME: Record<ExportFormat, string> = {
  tiff: 'image/tiff',
  png: 'image/png',
  jpeg: 'image/jpeg',
}

export const EXPORT_EXT: Record<ExportFormat, string> = { tiff: 'tif', png: 'png', jpeg: 'jpg' }

/**
 * TIFF baseline sem compressão (little-endian), RGB 8 ou 16 bits por canal.
 * Sem perdas e aberto por qualquer editor (Lightroom, Photoshop, GIMP…).
 */
export function encodeTiff(data: Uint8Array | Uint16Array, width: number, height: number, dpi = 300): Blob {
  const bits = data instanceof Uint16Array ? 16 : 8
  const entries: [tag: number, type: number, count: number, value: number][] = []
  const SHORT = 3
  const LONG = 4
  const RATIONAL = 5

  const tagCount = 13
  const ifdOffset = 8
  const ifdSize = 2 + tagCount * 12 + 4
  const bpsOffset = ifdOffset + ifdSize // 3 SHORTs
  const xresOffset = bpsOffset + 6 + 2 // alinhado
  const yresOffset = xresOffset + 8
  const dataOffset = yresOffset + 8
  const dataBytes = data.byteLength

  entries.push([256, LONG, 1, width])
  entries.push([257, LONG, 1, height])
  entries.push([258, SHORT, 3, bpsOffset])
  entries.push([259, SHORT, 1, 1]) // sem compressão
  entries.push([262, SHORT, 1, 2]) // RGB
  entries.push([273, LONG, 1, dataOffset])
  entries.push([274, SHORT, 1, 1]) // orientação normal
  entries.push([277, SHORT, 1, 3])
  entries.push([278, LONG, 1, height])
  entries.push([279, LONG, 1, dataBytes])
  entries.push([282, RATIONAL, 1, xresOffset])
  entries.push([283, RATIONAL, 1, yresOffset])
  entries.push([296, SHORT, 1, 2]) // polegadas

  const header = new ArrayBuffer(dataOffset)
  const v = new DataView(header)
  v.setUint8(0, 0x49)
  v.setUint8(1, 0x49)
  v.setUint16(2, 42, true)
  v.setUint32(4, ifdOffset, true)
  v.setUint16(ifdOffset, entries.length, true)
  entries.forEach(([tag, type, count, value], i) => {
    const o = ifdOffset + 2 + i * 12
    v.setUint16(o, tag, true)
    v.setUint16(o + 2, type, true)
    v.setUint32(o + 4, count, true)
    if (type === SHORT && count === 1) v.setUint16(o + 8, value, true)
    else v.setUint32(o + 8, value, true)
  })
  v.setUint32(ifdOffset + 2 + entries.length * 12, 0, true) // sem próximo IFD
  for (let i = 0; i < 3; i++) v.setUint16(bpsOffset + i * 2, bits, true)
  v.setUint32(xresOffset, dpi, true)
  v.setUint32(xresOffset + 4, 1, true)
  v.setUint32(yresOffset, dpi, true)
  v.setUint32(yresOffset + 4, 1, true)

  // Uint16Array já está em little-endian em todas as plataformas que rodam navegadores.
  const body = new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as Uint8Array<ArrayBuffer>
  return new Blob([header, body], { type: EXPORT_MIME.tiff })
}

/** PNG (sem perdas) ou JPEG (qualidade máxima) via canvas — 8 bits por canal. */
export async function encodeWithCanvas(rgba: Uint8ClampedArray, width: number, height: number, format: 'png' | 'jpeg', quality = 1): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.width !== width || canvas.height !== height) throw new Error('O navegador não conseguiu criar uma imagem deste tamanho. Tente exportar em TIFF.')
  ctx.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, EXPORT_MIME[format], quality))
  canvas.width = canvas.height = 0
  if (!blob) throw new Error('Falha ao gerar o arquivo.')
  return blob
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
