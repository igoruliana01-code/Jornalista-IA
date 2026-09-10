# Jornalista AI V8.6.10 — Auditoria de Evidências

Correções desta revisão:
- Render agora usa `gemini-3.5-flash-lite` por padrão, evitando o modelo 3.7 que causou o erro de acesso na versão anterior.
- Interactions API configurada com `store:false`, deixando as chamadas estateless e evitando armazenamento desnecessário das pautas.
- Confiança agora recebe teto baseado nas evidências realmente vinculadas, em vez de confiar apenas no número produzido pelo Gemini.
- Pautas amplas só consideram `FATO DOCUMENTADO + DIRETA + CONFIRMADO` como evidência direta da tese.
- Fatos contextuais deixam de aparecer como evidência direta.
- Status `CONFIRMADO / ENCERRADO` é reconhecido corretamente antes de `CONFIRMADO`.
- `/health` atualizado para a versão 8.6.10.

A pesquisa continua usando Google News RSS + GDELT, com Gemini via Interactions API.
