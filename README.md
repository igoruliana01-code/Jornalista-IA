# Jornalista AI V8.2.1 — Busca Externa + Gemini Gratuito

Esta versão remove o Google Search Grounding da chamada Gemini. O servidor faz a pesquisa externamente usando Google News RSS e GDELT, reúne os resultados e entrega esse material ao Gemini para análise editorial.

## Por que esta versão
O Google informa que o Grounding com Google Search não está disponível no Free Tier da Gemini API. A V8.2.1 evita esse recurso para que a análise do Gemini possa continuar usando a cota gratuita, respeitando os limites do modelo.

## Arquivos
- index.html
- style.css
- app.js
- server.js
- package.json
- render.yaml
- README.md

## Render
Mantenha o serviço atual `Jornalista-IA`. Faça upload/substituição dos 7 arquivos na raiz do GitHub e aguarde o deploy automático. Não crie outro serviço.

A variável `GEMINI_API_KEY` continua sendo a mesma. `GEMINI_MODEL` passa a usar `gemini-3-flash-preview`, com fallback para `gemini-2.5-flash` e `gemini-2.5-flash-lite`.

## Teste rápido
- `/health` confirma servidor e modo sem grounding.
- `/api/search-test?q=Corinthians%20Estudiantes%20Libertadores%202026` testa apenas a pesquisa externa.

## Limites e método
A pesquisa externa retorna títulos, fontes, datas, URLs e snippets. O Jornalista AI não deve inventar conteúdo que não apareceu na pesquisa. Para publicação profissional, o jornalista deve abrir as fontes e conferir o conteúdo original.


## V8.6.1
- Formatos editoriais com estratégia própria.
- Evidências exigem nomes próprios e fatos específicos quando disponíveis.
- Data do fato separada da data de publicação.
- Fontes Google News não são mais classificadas automaticamente como TIER 1.
- Sanitização reforçada de HTML/URLs nos cards.
- Layout dos cards empilhado em telas estreitas.


### V8.6.1 — Recuperação automática de busca
- Busca em camadas: normal → ampla → dividida por subtemas quando o formato exige aprofundamento.
- Google News RSS + GDELT são consultados em paralelo por camada.
- Ausência de resultados não é tratada como falsidade.
- Se todas as camadas falharem, a interface mostra apuração inconclusiva em vez de erro genérico.
- Timeout do cliente ampliado para 70s para acomodar a recuperação + análise Gemini.


V8.6.3: corrige o vínculo de evidence_records (source_urls vs source_url) e melhora a decomposição de pautas amplas/investigativas em subquestões verificáveis.
