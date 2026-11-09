import { describe, expect, it } from 'vitest'
import { encodeTiff } from './encode'
import { cropPixels, extract, flipCrop, FULL_CROP, NO_ORIENTATION, rotate, rotateCrop, type Orientation } from './geometry'
import { analyze, DEFAULT_ADJUSTMENTS, processRaster, srgbToLinear, type InvertSettings } from './invert'
import { createRaster, decodeTiff, sniffFormat, type Raster } from './raster'

/** 3×2 com valores únicos por pixel: R = índice, G = 100 + índice, B = 200 + índice. */
function grid(): Raster {
  const r = createRaster(3, 2, 8)
  for (let i = 0; i < 6; i++) {
    r.data[i * 3] = i
    r.data[i * 3 + 1] = 100 + i
    r.data[i * 3 + 2] = 200 + i
  }
  return r
}
const reds = (r: Raster) => Array.from({ length: r.width * r.height }, (_, i) => r.data[i * 3])

describe('geometria', () => {
  it('copia os pixels exatamente quando não há redução', () => {
    const out = extract(grid(), NO_ORIENTATION, FULL_CROP)
    expect(out.width).toBe(3)
    expect(Array.from(out.data)).toEqual(Array.from(grid().data))
  })

  it('gira 90° no sentido horário', () => {
    // 0 1 2      3 0
    // 3 4 5  →   4 1
    //            5 2
    const out = extract(grid(), { rotation: 90, flipH: false }, FULL_CROP)
    expect([out.width, out.height]).toEqual([2, 3])
    expect(reds(out)).toEqual([3, 0, 4, 1, 5, 2])
  })

  it('gira 270° e 180°', () => {
    expect(reds(extract(grid(), { rotation: 270, flipH: false }, FULL_CROP))).toEqual([2, 5, 1, 4, 0, 3])
    expect(reds(extract(grid(), { rotation: 180, flipH: false }, FULL_CROP))).toEqual([5, 4, 3, 2, 1, 0])
  })

  it('espelha depois de girar', () => {
    expect(reds(extract(grid(), { rotation: 0, flipH: true }, FULL_CROP))).toEqual([2, 1, 0, 5, 4, 3])
    expect(reds(extract(grid(), { rotation: 90, flipH: true }, FULL_CROP))).toEqual([0, 3, 1, 4, 2, 5])
  })

  it('recorta em pixels inteiros', () => {
    const out = extract(grid(), NO_ORIENTATION, { x: 1 / 3, y: 0.5, w: 2 / 3, h: 0.5 })
    expect(reds(out)).toEqual([4, 5])
    expect(cropPixels(3000, 2000, NO_ORIENTATION, { x: 0.1, y: 0.1, w: 0.5, h: 0.5 })).toEqual({ x: 300, y: 200, w: 1500, h: 1000 })
  })

  it('reduz por média para a prévia', () => {
    const r = createRaster(4, 4, 16)
    r.data.fill(1000)
    const out = extract(r, NO_ORIENTATION, FULL_CROP, 2)
    expect([out.width, out.height, out.bitDepth]).toEqual([2, 2, 16])
    expect(out.data[0]).toBe(1000)
  })

  it('girar na tela leva o recorte junto', () => {
    const c = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }
    const back = rotateCrop(rotateCrop(c, 1), -1)
    expect(back.x).toBeCloseTo(c.x)
    expect(back.y).toBeCloseTo(c.y)
    expect(flipCrop(c).x).toBeCloseTo(0.6)
    // Girar 4× no sentido horário volta à orientação inicial, com ou sem espelho.
    let o: Orientation = { rotation: 0, flipH: true }
    for (let i = 0; i < 4; i++) o = rotate(o, 1)
    expect(o).toEqual({ rotation: 0, flipH: true })
  })
})

/** Simula um negativo colorido: cena em gradiente + máscara laranja (mais transmissão no R). */
function fakeNegative(): Raster {
  const w = 64
  const r = createRaster(w, 1, 16)
  const mask = [0.9, 0.55, 0.35] // base laranja em linear
  for (let x = 0; x < w; x++) {
    const scene = x / (w - 1) // 0 = preto, 1 = branco
    for (let c = 0; c < 3; c++) {
      const lin = mask[c] * Math.pow(10, -scene * 1.6) // mais luz na cena → mais densidade
      const e = lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055
      r.data[x * 3 + c] = Math.round(e * 65535)
    }
  }
  return r
}

describe('inversão', () => {
  const settings: InvertSettings = { kind: 'color', base: null, adj: DEFAULT_ADJUSTMENTS }

  it('transforma o negativo em positivo e neutraliza a máscara laranja', () => {
    const neg = fakeNegative()
    const a = analyze(neg, settings)
    const out = processRaster(neg, settings, a, 'rgb16')
    const px = (x: number) => [out[x * 3], out[x * 3 + 1], out[x * 3 + 2]]
    // Lado esquerdo (pouca densidade) vira escuro; direito vira claro.
    expect(px(0).every((v) => v < 2000)).toBe(true)
    expect(px(63).every((v) => v > 63000)).toBe(true)
    // Tons médios neutros: canais próximos entre si.
    const mid = px(32)
    expect(Math.max(...mid) - Math.min(...mid)).toBeLessThan(1500)
    // Monotônico.
    for (let x = 1; x < 64; x++) expect(out[x * 3 + 1]).toBeGreaterThanOrEqual(out[(x - 1) * 3 + 1])
  })

  it('usa a base do filme amostrada como ponto preto', () => {
    const neg = fakeNegative()
    const base: [number, number, number] = [0, 1, 2].map((c) => neg.data[c] / 65535) as [number, number, number]
    const a = analyze(neg, { kind: 'color', base })
    expect(a.lo[0]).toBeCloseTo(-Math.log10(srgbToLinear(base[0])), 5)
  })

  it('P&B gera cinza e respeita a exposição', () => {
    const neg = fakeNegative()
    const s: InvertSettings = { kind: 'bw', base: null, adj: DEFAULT_ADJUSTMENTS }
    const a = analyze(neg, s)
    const base = processRaster(neg, s, a, 'rgba8')
    const brighter = processRaster(neg, { ...s, adj: { ...DEFAULT_ADJUSTMENTS, exposure: 1 } }, a, 'rgba8')
    expect(base[32 * 4]).toBe(base[32 * 4 + 1])
    expect(base[32 * 4 + 3]).toBe(255)
    expect(brighter[32 * 4]).toBeGreaterThan(base[32 * 4])
  })

  it('positivo não inverte', () => {
    const neg = fakeNegative()
    const s: InvertSettings = { kind: 'positive', base: null, adj: DEFAULT_ADJUSTMENTS }
    const out = processRaster(neg, s, analyze(neg, s), 'rgb8')
    expect(out[0]).toBeGreaterThan(out[63 * 3])
  })
})

describe('TIFF', () => {
  it('exporta e lê de volta 16 bits sem perdas', async () => {
    const data = new Uint16Array([0, 1, 65535, 1234, 40000, 7, 300, 301, 302, 65534, 2, 3])
    const blob = encodeTiff(data, 2, 2)
    const buf = await blob.arrayBuffer()
    expect(sniffFormat(new Uint8Array(buf))).toBe('tiff')
    const r = await decodeTiff(buf)
    expect([r.width, r.height, r.bitDepth]).toEqual([2, 2, 16])
    expect(Array.from(r.data)).toEqual(Array.from(data))
  })

  it('exporta e lê de volta 8 bits', async () => {
    const data = new Uint8Array([10, 20, 30, 40, 50, 60])
    const r = await decodeTiff(await encodeTiff(data, 2, 1).arrayBuffer())
    expect(r.bitDepth).toBe(8)
    expect(Array.from(r.data)).toEqual(Array.from(data))
  })
})

describe('fundo preto em volta do filme', () => {
  it('não deixa o fundo esticar o contraste do negativo', () => {
    // Metade da imagem é fundo quase preto com ruído; a outra metade, o negativo.
    const neg = fakeNegative()
    const r = createRaster(128, 1, 16)
    r.data.set(neg.data, 0)
    for (let x = 64; x < 128; x++) for (let c = 0; c < 3; c++) r.data[x * 3 + c] = 200 + ((x * 13 + c * 7) % 400)
    const s: InvertSettings = { kind: 'color', base: null, adj: DEFAULT_ADJUSTMENTS }
    const alone = analyze(neg, s)
    const withBg = analyze(r, s)
    for (let c = 0; c < 3; c++) expect(withBg.hi[c]).toBeCloseTo(alone.hi[c], 1)
    // O fundo vira branco liso.
    const out = processRaster(r, s, withBg, 'rgb16')
    for (let x = 64; x < 128; x++) expect(out[x * 3 + 1]).toBe(65535)
  })
})
