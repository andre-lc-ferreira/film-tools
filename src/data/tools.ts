export interface Tool {
  id: string
  path: string
  name: string
  tagline: string
  description: string
  tags: string[]
  /** Cor de destaque do card. */
  accent: string
}

/** Registro das ferramentas exibidas na tela inicial. Adicione novas aqui. */
export const TOOLS: Tool[] = [
  {
    id: 'camara-escura',
    path: '/camara-escura',
    name: 'Câmara Escura',
    tagline: 'Simulador de revelação P&B',
    description: 'Escolha filme, revelador e temperatura, veja o tempo tabelado e o efeito de push e pull na foto.',
    tags: ['9 filmes', '11 reveladores', 'Push / Pull'],
    accent: '#e5383b',
  },
  {
    id: 'negativos',
    path: '/negativos',
    name: 'Negativo → Positivo',
    tagline: 'Inversão de negativos escaneados',
    description: 'Envie o scan, recorte, ajuste exposição e cor, inverta e exporte na mesma resolução do original.',
    tags: ['C-41 / P&B / Cromo', 'TIFF 16 bits', 'Sem reamostragem'],
    accent: '#f2a541',
  },
]
