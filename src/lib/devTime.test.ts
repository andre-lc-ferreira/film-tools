import { describe, expect, it } from 'vitest'
import { availableDevelopers, computeDevTime, displayEI, formatMinutes, temperatureFactor } from './devTime'

describe('computeDevTime', () => {
  it('retorna o tempo tabelado da Ilford para HP5+ em ID-11 a 1600', () => {
    const r = computeDevTime('hp5-plus-400', 'id11-stock', 2, 20)!
    expect(r.kind).toBe('tabulated')
    expect(r.minutes).toBeCloseTo(14)
    expect(r.ei).toBe(1600)
  })

  it('retorna o tempo da Kodak para Tri-X em D-76 na box speed', () => {
    const r = computeDevTime('tri-x-400', 'd76-stock', 0, 20)!
    expect(r.minutes).toBeCloseTo(6.75)
  })

  it('casa EI de mercado (3200 × 4 = 12800 ≈ 12500)', () => {
    const r = computeDevTime('delta-3200', 'ddx-1-4', 2, 20)!
    expect(r.kind).toBe('tabulated')
    expect(r.minutes).toBeCloseTo(17)
  })

  it('interpola entre EIs (Tri-X @800 fica entre 400 e 1600)', () => {
    const r = computeDevTime('tri-x-400', 'd76-stock', 1, 20)!
    expect(r.kind).toBe('interpolated')
    expect(r.minutes).toBeGreaterThan(6.75)
    expect(r.minutes).toBeLessThan(9.5)
  })

  it('extrapola pull com tempo menor e push com tempo maior', () => {
    const pull = computeDevTime('hp5-plus-400', 'd76-stock', -1, 20)!
    expect(pull.kind).toBe('extrapolated')
    expect(pull.minutes).toBeCloseTo(7.5 * 0.8)
    const push = computeDevTime('hp5-plus-400', 'd76-stock', 3, 20)!
    expect(push.kind).toBe('extrapolated')
    expect(push.minutes).toBeGreaterThan(12.5)
  })

  it('reduz o tempo com temperatura maior', () => {
    const at20 = computeDevTime('hp5-plus-400', 'id11-stock', 0, 20)!
    const at24 = computeDevTime('hp5-plus-400', 'id11-stock', 0, 24)!
    expect(at24.minutes).toBeLessThan(at20.minutes)
    // Kodak: Tri-X D-76 6¾ → 4¾ de 20 para 24 °C (≈0,70)
    expect(temperatureFactor(24)).toBeCloseTo(4.75 / 6.75, 1)
  })

  it('retorna null para combinação inexistente', () => {
    expect(computeDevTime('tmax-100', 'rodinal-1-25', 0, 20)).toBeNull()
    expect(availableDevelopers('tmax-100').some((d) => d.id === 'rodinal-1-25')).toBe(false)
  })

  it('avisa quando o tempo é menor que 5 minutos', () => {
    const r = computeDevTime('tri-x-400', 'hc110-b', 0, 20)!
    expect(r.warnings.some((w) => w.includes('5 min'))).toBe(true)
  })
})

describe('utilitários', () => {
  it('formata minutos', () => {
    expect(formatMinutes(6.75)).toBe('6:45')
    expect(formatMinutes(14)).toBe('14:00')
  })
  it('arredonda EI de mercado', () => {
    expect(displayEI(1000)).toBe(1000)
    expect(displayEI(12800)).toBe(12500)
    expect(displayEI(250)).toBe(250)
  })
})
