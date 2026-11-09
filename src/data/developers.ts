import type { Developer, DeveloperId } from './types'

export const DEVELOPERS: Developer[] = [
  { id: 'id11-stock', name: 'Ilford ID-11', dilution: 'Stock', description: 'Equilíbrio entre grão, nitidez e velocidade.', grain: 1, acutance: 0 },
  { id: 'id11-1-1', name: 'Ilford ID-11', dilution: '1+1', description: 'Mais nitidez, grão um pouco maior.', grain: 1.06, acutance: 0.25 },
  { id: 'd76-stock', name: 'Kodak D-76', dilution: 'Stock', description: 'O padrão da indústria desde 1927.', grain: 1, acutance: 0 },
  { id: 'd76-1-1', name: 'Kodak D-76', dilution: '1+1', description: 'Mais acutância, uso único.', grain: 1.06, acutance: 0.25 },
  { id: 'ddx-1-4', name: 'Ilford DD-X', dilution: '1+4', description: 'Grão fino com velocidade total, ótimo para push.', grain: 0.85, acutance: 0.1 },
  { id: 'xtol-stock', name: 'Kodak XTOL', dilution: 'Stock', description: 'Grão fino e boa sombra no push.', grain: 0.85, acutance: 0.1 },
  { id: 'xtol-1-1', name: 'Kodak XTOL', dilution: '1+1', description: 'Mais nitidez mantendo grão fino.', grain: 0.92, acutance: 0.3 },
  { id: 'tmax-1-4', name: 'Kodak T-Max', dilution: '1+4', description: 'Contraste vivo, feito para push.', grain: 0.92, acutance: 0.15 },
  { id: 'hc110-b', name: 'Kodak HC-110', dilution: 'Dil. B (1+31)', description: 'Xarope versátil, tempos curtos.', grain: 1.08, acutance: 0.15 },
  { id: 'rodinal-1-25', name: 'Rodinal', dilution: '1+25', description: 'Acutância altíssima, grão aparente.', grain: 1.35, acutance: 0.6 },
  { id: 'rodinal-1-50', name: 'Rodinal', dilution: '1+50', description: 'Compensador, bordas super nítidas.', grain: 1.28, acutance: 0.75 },
]

export const DEVELOPER_BY_ID = Object.fromEntries(DEVELOPERS.map((d) => [d.id, d])) as Record<DeveloperId, Developer>
