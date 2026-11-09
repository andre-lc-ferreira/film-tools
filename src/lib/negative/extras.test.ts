import { describe, expect, it } from 'vitest'
import { detectFilmArea } from './detect'
import { createRaster } from './raster'
import { crc32, ZipWriter } from './zip'

describe('detecção do filme', () => {
  it('acha o filme claro sobre fundo escuro (foto de mesa de luz)', () => {
    const r = createRaster(400, 300, 8)
    for (let y = 0; y < 300; y++)
      for (let x = 0; x < 400; x++) {
        const film = x >= 100 && x < 300 && y >= 90 && y < 210
        const v = film ? 200 : 6 + ((x * 7 + y * 3) % 5) // fundo com ruído
        r.data.fill(v, (y * 400 + x) * 3, (y * 400 + x) * 3 + 3)
      }
    const c = detectFilmArea(r)!
    expect(c.x).toBeCloseTo(0.25, 1)
    expect(c.y).toBeCloseTo(0.3, 1)
    expect(c.w).toBeCloseTo(0.5, 1)
    expect(c.h).toBeCloseTo(0.4, 1)
  })

  it('não mexe em scans que já são só o filme', () => {
    const r = createRaster(200, 100, 16)
    for (let i = 0; i < r.data.length; i++) r.data[i] = 20000 + ((i * 37) % 30000)
    expect(detectFilmArea(r)).toBeNull()
  })
})

describe('zip', () => {
  it('calcula o CRC-32 padrão', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('gera um zip válido, com nomes repetidos renomeados', async () => {
    const z = new ZipWriter()
    await z.add('a-positivo.tif', new Blob([new Uint8Array([1, 2, 3])]))
    await z.add('a-positivo.tif', new Blob(['olá']))
    await z.add('ç.png', new Blob([new Uint8Array(100_000).fill(7)]))
    const buf = new Uint8Array(await z.finish().arrayBuffer())
    expect(readZip(buf)).toEqual(['a-positivo.tif:3', 'a-positivo-2.tif:4', 'ç.png:100000'])
  })
})

/** Lê o diretório central e confere o CRC de cada arquivo, como um descompactador faria. */
function readZip(buf: Uint8Array): string[] {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const end = buf.length - 22
  expect(v.getUint32(end, true)).toBe(0x06054b50)
  const count = v.getUint16(end + 10, true)
  let p = v.getUint32(end + 16, true)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50)
    const crc = v.getUint32(p + 16, true)
    const size = v.getUint32(p + 24, true)
    const nameLen = v.getUint16(p + 28, true)
    const extra = v.getUint16(p + 30, true)
    const local = v.getUint32(p + 42, true)
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen))
    expect(v.getUint32(local, true)).toBe(0x04034b50)
    const dataStart = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    expect(crc32(buf.subarray(dataStart, dataStart + size))).toBe(crc)
    out.push(`${name}:${size}`)
    p += 46 + nameLen + extra
  }
  return out
}
