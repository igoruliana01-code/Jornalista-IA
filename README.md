# Jornalista AI — FINAL

Projeto integrado para pesquisa e produção jornalística.

## Módulos
- Pauta
- Pesquisa e apuração com Gemini
- Google Search grounding quando disponível
- Radar de confiabilidade
- Classificação de evidências
- Cruzamento/conflitos
- Fontes e URLs
- Quem ouvir
- Perguntas-chave
- Checklist de checagem
- Melhor ângulo
- Headline, subtítulo e lead
- Riscos editoriais
- Gerador de rascunho
- Fact-check
- Interface mobile-first

## Instalação
1. Instale Node.js 18+.
2. Extraia o ZIP.
3. Renomeie `.env.example` para `.env`.
4. Crie sua chave no Google AI Studio.
5. Coloque a chave em `GEMINI_API_KEY`.
6. Abra o terminal na pasta.
7. Rode `npm install`.
8. Rode `npm start`.
9. Abra `http://localhost:3000`.

## Observação sobre o modo gratuito
O Gemini pode ser usado com uma cota gratuita, mas disponibilidade de modelos, limites e ferramentas de grounding podem variar. Se o Google Search não estiver disponível para sua chave/cota, o Jornalista AI automaticamente tenta continuar sem pesquisa automática e avisa no briefing.

Nunca publique automaticamente o texto gerado. O sistema foi desenhado como assistente de apuração, não como substituto da responsabilidade editorial.


Interface atualizada para o dashboard aprovado: sidebar, cabeçalho Gemini, cards de apuração, radar, fontes, dados, quem ouvir, checagem, ângulo, estrutura, riscos e ações.
