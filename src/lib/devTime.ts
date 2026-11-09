import { DEV_TIMES } from '../data/devTimes'
import { DEVELOPERS } from '../data/developers'
import { FILM_BY_ID } from '../data/films'
import type { Developer, DeveloperId, FilmId } from '../data/types'

export type TimeKind = 'tabulated' | 'interpolated' | 'extrapolated'

export interface DevTimeResult {
  /** EI efetivo em que o filme foi exposto. */
  ei: number
  /** Tempo a 20 °C (minutos). */
  minutesAt20: number
  /** Tempo corrigido pela temperatura (minutos). */
  minutes: number
  kind: TimeKind
  source: string
  warnings: string[]
}

export const MIN_STOPS = -2
export const MAX_STOPS = 3
export const MIN_TEMP = 18
export const MAX_TEMP = 24

/** Fator aproximado por stop quando não há dado tabelado. */
const PUSH_FACTOR = 1.4
const PULL_FACTOR = 0.8
/** Coeficiente da curva tempo × temperatura (~8 % por °C, compatível com Ilford/Kodak). */
const TEMP_COEFF = 0.081

export function effectiveEI(iso: number, stops: number): number {
  return iso * 2 ** stops
}

/** EI "de mercado" para exibição (ex.: 125 × 8 = 1000, 3200 × 4 = 12500). */
export function displayEI(ei: number): number {
  const nice = [6, 12, 25, 32, 50, 64, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12500, 25000, 51200]
  return nice.reduce((best, n) => (Math.abs(Math.log(n / ei)) < Math.abs(Math.log(best / ei)) ? n : best), nice[0])
}

export function temperatureFactor(tempC: number): number {
  return Math.exp(-TEMP_COEFF * (tempC - 20))
}

export function availableDevelopers(filmId: FilmId): Developer[] {
  const table = DEV_TIMES[filmId]
  return DEVELOPERS.filter((d) => table[d.id] !== undefined)
}

function sameEI(a: number, b: number) {
  return Math.abs(Math.log2(a / b)) < 0.06
}

export function computeDevTime(filmId: FilmId, developerId: DeveloperId, stops: number, tempC: number): DevTimeResult | null {
  const film = FILM_BY_ID[filmId]
  const entry = DEV_TIMES[filmId][developerId]
  if (!film || !entry) return null

  const ei = effectiveEI(film.iso, stops)
  const points = Object.entries(entry.times)
    .map(([e, t]) => ({ ei: Number(e), t }))
    .sort((a, b) => a.ei - b.ei)

  const warnings: string[] = []
  let minutesAt20: number
  let kind: TimeKind

  const exact = points.find((p) => sameEI(p.ei, ei))
  const first = points[0]
  const last = points[points.length - 1]

  if (exact) {
    minutesAt20 = exact.t
    kind = 'tabulated'
  } else if (ei > first.ei && ei < last.ei) {
    const i = points.findIndex((p) => p.ei > ei)
    const a = points[i - 1]
    const b = points[i]
    const f = Math.log2(ei / a.ei) / Math.log2(b.ei / a.ei)
    minutesAt20 = Math.exp(Math.log(a.t) + f * (Math.log(b.t) - Math.log(a.t)))
    kind = 'interpolated'
  } else if (ei <= first.ei) {
    const stopsBelow = Math.log2(first.ei / ei)
    minutesAt20 = first.t * PULL_FACTOR ** stopsBelow
    kind = 'extrapolated'
  } else {
    const stopsAbove = Math.log2(ei / last.ei)
    let factor = PUSH_FACTOR
    if (points.length >= 2) {
      const prev = points[points.length - 2]
      const slope = (last.t / prev.t) ** (1 / Math.log2(last.ei / prev.ei))
      factor = Math.min(1.6, Math.max(1.2, slope))
    }
    minutesAt20 = last.t * factor ** stopsAbove
    kind = 'extrapolated'
    if (stopsAbove > 1) warnings.push('Muito além dos dados do fabricante: faça um teste antes.')
  }

  const minutes = minutesAt20 * temperatureFactor(tempC)

  if (kind === 'extrapolated') warnings.push('Tempo estimado: sem dado oficial para este EI.')
  if (minutes < 5) warnings.push('Menos de 5 min pode gerar revelação desigual. Prefira uma diluição maior ou temperatura menor.')
  if (minutes > 25) warnings.push('Tempo muito longo: considere um revelador mais ativo ou temperatura maior.')
  if (tempC < MIN_TEMP || tempC > MAX_TEMP) warnings.push('Temperatura fora da faixa recomendada (18–24 °C).')

  return { ei, minutesAt20, minutes, kind, source: entry.source, warnings }
}

export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes * 60)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function stopsLabel(stops: number): string {
  if (stops === 0) return 'Box speed'
  return stops > 0 ? `Push +${stops}` : `Pull ${stops}`
}
