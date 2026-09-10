# Jornalista AI V8.6.7 — Radar corrigido

Correções sobre a V8.6.6:
- O Radar agora conta fatos documentados, declarações e itens não comprovados a partir de `evidence_records`, evitando que uma declaração seja contada como fato confirmado.
- “Evidência principal” foi renomeada visualmente para “Síntese da apuração”, deixando claro que é uma leitura editorial e não uma prova.
- Prompt reforça a separação entre síntese e evidência factual.
- Mantém Interactions API, `gemini-3.5-flash-lite`, `store:false`, guardrails de confiança e classificação das evidências.
