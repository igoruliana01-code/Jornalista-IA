# Jornalista AI V7

Versão com apuração em camadas:
- fato principal separado de contexto;
- conflitos somente quando houver contradição direta;
- hierarquia de fontes;
- evidências e citações da Pesquisa Google quando retornadas pela API;
- teste de sanidade editorial;
- confiança baseada na pauta principal;
- retry/backoff para erros transitórios;
- Redação protegida contra transformar informação não confirmada em fato;
- Fact-check com pesquisa web.

## Variáveis no Render
- GEMINI_API_KEY
- GEMINI_MODEL (opcional; padrão gemini-3.8-flash)
- GEMINI_FALLBACK_MODELS (opcional)

O projeto usa Node + Express + @google/genai.
