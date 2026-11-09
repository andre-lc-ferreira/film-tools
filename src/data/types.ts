export type FilmId =
  | 'panf-plus-50'
  | 'fp4-plus-125'
  | 'hp5-plus-400'
  | 'delta-100'
  | 'delta-400'
  | 'delta-3200'
  | 'tri-x-400'
  | 'tmax-100'
  | 'tmax-400'

export type DeveloperId =
  | 'id11-stock'
  | 'id11-1-1'
  | 'd76-stock'
  | 'd76-1-1'
  | 'ddx-1-4'
  | 'hc110-b'
  | 'rodinal-1-25'
  | 'rodinal-1-50'
  | 'xtol-stock'
  | 'xtol-1-1'
  | 'tmax-1-4'

/** Perfil visual usado pelo shader. */
export interface FilmLook {
  /** Pesos RGB (sensibilidade espectral) – somam ~1. */
  mix: [number, number, number]
  /** Contraste base da curva característica. */
  contrast: number
  /** Intensidade do grão a 0 stops. */
  grain: number
  /** Tamanho relativo do grão. */
  grainSize: number
  /** Latitude: quantos stops abaixo do cinza médio o filme ainda registra. */
  latitude: number
}

export interface Film {
  id: FilmId
  brand: 'Ilford' | 'Kodak'
  name: string
  iso: number
  description: string
  /** Cores da lata (decorativas, genéricas). */
  colors: [string, string]
  look: FilmLook
}

export interface Developer {
  id: DeveloperId
  name: string
  dilution: string
  description: string
  /** Multiplicador do grão. */
  grain: number
  /** Acutância (nitidez de borda), 0 = neutro. */
  acutance: number
}

export interface DevTimeEntry {
  source: string
  /** EI → minutos a 20 °C */
  times: Record<number, number>
}

export type DevTimeTable = Record<FilmId, Partial<Record<DeveloperId, DevTimeEntry>>>
