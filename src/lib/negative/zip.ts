/**
 * Gerador de .zip sem compressão (STORE), com suporte a ZIP64 para rolos acima de 4 GB.
 * Os arquivos entram como Blob e não são copiados para o zip final: o navegador só lê os
 * bytes uma vez para calcular o CRC.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

const U32 = 0xffffffff

interface Entry {
  name: Uint8Array
  crc: number
  size: number
  offset: number
}

export class ZipWriter {
  private parts: BlobPart[] = []
  private entries: Entry[] = []
  private offset = 0
  private names = new Set<string>()
  private readonly date = new Date()

  async add(name: string, blob: Blob) {
    name = this.unique(name)
    const size = blob.size
    // CRC em blocos para não precisar do arquivo inteiro na memória de uma vez.
    let crc = 0
    const CHUNK = 16 * 1024 * 1024
    for (let pos = 0; pos < size; pos += CHUNK) crc = crc32(new Uint8Array(await blob.slice(pos, pos + CHUNK).arrayBuffer()), crc)

    const nameBytes = new TextEncoder().encode(name)
    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034b50, true)
    h.setUint16(4, 20, true)
    h.setUint16(6, 0x0800, true) // nomes em UTF-8
    h.setUint16(8, 0, true) // STORE
    h.setUint16(10, this.dosTime(), true)
    h.setUint16(12, this.dosDate(), true)
    h.setUint32(14, crc, true)
    h.setUint32(18, size, true)
    h.setUint32(22, size, true)
    h.setUint16(26, nameBytes.length, true)
    h.setUint16(28, 0, true)

    this.entries.push({ name: nameBytes, crc, size, offset: this.offset })
    this.parts.push(h.buffer, nameBytes as Uint8Array<ArrayBuffer>, blob)
    this.offset += 30 + nameBytes.length + size
  }

  finish(): Blob {
    const cdStart = this.offset
    let cdSize = 0
    for (const e of this.entries) {
      const big = e.offset >= U32
      const extra = big ? 12 : 0
      const c = new DataView(new ArrayBuffer(46 + extra))
      c.setUint32(0, 0x02014b50, true)
      c.setUint16(4, 45, true)
      c.setUint16(6, big ? 45 : 20, true)
      c.setUint16(8, 0x0800, true)
      c.setUint16(10, 0, true)
      c.setUint16(12, this.dosTime(), true)
      c.setUint16(14, this.dosDate(), true)
      c.setUint32(16, e.crc, true)
      c.setUint32(20, e.size, true)
      c.setUint32(24, e.size, true)
      c.setUint16(28, e.name.length, true)
      c.setUint16(30, extra, true)
      c.setUint32(42, big ? U32 : e.offset, true)
      const parts: BlobPart[] = [c.buffer.slice(0, 46), e.name as Uint8Array<ArrayBuffer>]
      if (big) {
        const x = new DataView(new ArrayBuffer(12))
        x.setUint16(0, 0x0001, true)
        x.setUint16(2, 8, true)
        x.setBigUint64(4, BigInt(e.offset), true)
        parts.push(x.buffer)
      }
      this.parts.push(...parts)
      cdSize += 46 + e.name.length + extra
    }

    const n = this.entries.length
    const zip64 = cdStart + cdSize >= U32 || n >= 0xffff || this.entries.some((e) => e.offset >= U32)
    if (zip64) {
      const z = new DataView(new ArrayBuffer(56 + 20))
      z.setUint32(0, 0x06064b50, true)
      z.setBigUint64(4, 44n, true)
      z.setUint16(12, 45, true)
      z.setUint16(14, 45, true)
      z.setBigUint64(24, BigInt(n), true)
      z.setBigUint64(32, BigInt(n), true)
      z.setBigUint64(40, BigInt(cdSize), true)
      z.setBigUint64(48, BigInt(cdStart), true)
      // Localizador
      z.setUint32(56, 0x07064b50, true)
      z.setBigUint64(64, BigInt(cdStart + cdSize), true)
      z.setUint32(72, 1, true)
      this.parts.push(z.buffer)
    }

    const end = new DataView(new ArrayBuffer(22))
    end.setUint32(0, 0x06054b50, true)
    end.setUint16(8, zip64 ? 0xffff : n, true)
    end.setUint16(10, zip64 ? 0xffff : n, true)
    end.setUint32(12, zip64 ? U32 : cdSize, true)
    end.setUint32(16, zip64 ? U32 : cdStart, true)
    this.parts.push(end.buffer)
    return new Blob(this.parts, { type: 'application/zip' })
  }

  private unique(name: string) {
    let candidate = name
    for (let i = 2; this.names.has(candidate); i++) candidate = name.replace(/(\.[^.]+)?$/, `-${i}$1`)
    this.names.add(candidate)
    return candidate
  }

  private dosTime() {
    const d = this.date
    return (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  }

  private dosDate() {
    const d = this.date
    return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  }
}
