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

## Negativo → Positivo (`/negativos`)

- Upload de scans em **TIFF 8/16 bits** (sem compressão, LZW ou Deflate), JPEG, PNG ou WebP.
- **Vários arquivos de uma vez** (o rolo inteiro): tira de miniaturas, cada quadro com o próprio recorte e ajustes, "aplicar a todos" e "baixar todos" (um único `.zip`, sem recompressão, com ZIP64 para rolos acima de 4 GB). Só o quadro aberto fica em resolução total na memória.
- Em fotos de mesa de luz (filme claro sobre fundo escuro), o filme é detectado ao importar e o recorte já começa em volta dele.
- Recorte com proporções de filme (35mm, 6×4,5, 6×6, 6×7, panorâmico), giro de 90° e espelhamento.
- Inversão de **colorido (C-41)**, **P&B** ou **cromo** (sem inversão). A base do filme pode ser amostrada com o conta-gotas.
- Ajustes: exposição, contraste, pretos, brancos, temperatura, matiz e saturação.
- Exportação na **mesma resolução do recorte no arquivo original** (sem reamostragem): TIFF 16 bits (quando o original é 16 bits), TIFF 8 bits, PNG ou JPEG qualidade 100.

As prévias usam uma cópia reduzida; os pontos de preto/branco medidos nela são reaplicados ao arquivo inteiro na exportação, para o resultado bater com a tela.

## SEO e capas de compartilhamento

Defina a URL pública do site no build — as capas (Open Graph) precisam de endereço absoluto para aparecer no WhatsApp, Instagram, Facebook, X e LinkedIn:

```bash
VITE_SITE_URL=https://seu-dominio.com.br npm run build
```

O build gera um HTML por página (`dist/index.html`, `dist/camara-escura/index.html`, `dist/negativos/index.html`) com título, descrição, canonical, Open Graph, Twitter Card e JSON-LD próprios, além de `sitemap.xml` e `robots.txt`. Sirva `dist/` como site estático; para outras rotas, o fallback de SPA continua devolvendo `index.html`.

- Textos de SEO: `src/data/seo.ts`
- Capas (1200×630): `public/og/*.jpg`, geradas a partir de `scripts/og/covers.html` com `npm i --no-save playwright-core && node scripts/og/render.mjs`
- Depois de publicar, teste a capa em developers.facebook.com/tools/debug (também atualiza o cache do WhatsApp/Instagram).

Adicione `?cpu` à URL para forçar o renderizador em Canvas 2D (fallback sem WebGL2).

## Onde ficam as coisas

| Arquivo | O quê |
| --- | --- |
| `src/data/tools.ts` | Ferramentas listadas na tela inicial (`/`) |
| `src/data/seo.ts` | Título, descrição e capa de compartilhamento de cada página |
| `src/pages/Darkroom.tsx` | A Câmara Escura (`/camara-escura`) |
| `src/data/devTimes.ts` | Tempos a 20 °C por filme × revelador × EI, com a fonte |
| `src/lib/devTime.ts` | Busca, interpolação, extrapolação push/pull e compensação de temperatura |
| `src/lib/filmMath.ts` | Modelo visual (curva característica, grão, negativo) |
| `src/lib/filmRenderer.ts` | Shader WebGL2 + fallback Canvas 2D |
| `src/pages/Negatives.tsx` | Negativo → Positivo (`/negativos`) |
| `src/lib/negative/` | Decodificação (TIFF via `utif2`), recorte/orientação, inversão e codificação TIFF/PNG/JPEG |

## Fontes dos tempos

- Ilford — *Film processing chart* (20 °C). A própria ficha inclui alguns valores do Massive Dev Chart.
- Kodak — fichas técnicas F-4017 (Tri-X), F-4016 (T-Max 100) e F-4043 (T-Max 400), tanque pequeno.
- Massive Dev Chart (digitaltruth.com) — Tri-X em Rodinal.

Os tempos são pontos de partida. Teste sempre com o seu equipamento.
