# Câmara Escura — simulador de revelação P&B

Site mobile-first (Vite + React + TypeScript) para simular a revelação de filmes preto e branco:

- **Filmes:** Ilford Pan F+ 50, FP4+ 125, HP5+ 400, Delta 100/400/3200, Kodak Tri-X 400, T-Max 100/400.
- **Reveladores:** ID-11, D-76, DD-X, XTOL, T-Max, HC-110 (B) e Rodinal (1+25 / 1+50), com temperatura de 18–24 °C.
- **Push / pull** de −2 a +3 stops, com o tempo vindo da tabela, interpolado ou estimado (a origem aparece na tela).
- **Pré-visualização** com comparador arrastável (box speed × push/pull, ou × original), tira de contato e animação do processo inteiro (tanque → fixador → ampliação).
- Fotos de exemplo (Unsplash) ou foto do próprio usuário (upload/câmera).

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # testes da lógica de tempos
npm run build
```

Adicione `?cpu` à URL para forçar o renderizador em Canvas 2D (fallback sem WebGL2).

## Onde ficam as coisas

| Arquivo | O quê |
| --- | --- |
| `src/data/devTimes.ts` | Tempos a 20 °C por filme × revelador × EI, com a fonte |
| `src/lib/devTime.ts` | Busca, interpolação, extrapolação push/pull e compensação de temperatura |
| `src/lib/filmMath.ts` | Modelo visual (curva característica, grão, negativo) |
| `src/lib/filmRenderer.ts` | Shader WebGL2 + fallback Canvas 2D |

## Fontes dos tempos

- Ilford — *Film processing chart* (20 °C). A própria ficha inclui alguns valores do Massive Dev Chart.
- Kodak — fichas técnicas F-4017 (Tri-X), F-4016 (T-Max 100) e F-4043 (T-Max 400), tanque pequeno.
- Massive Dev Chart (digitaltruth.com) — Tri-X em Rodinal.

Os tempos são pontos de partida. Teste sempre com o seu equipamento.
