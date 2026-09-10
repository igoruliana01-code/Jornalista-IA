import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
app.use(express.json({limit:"4mb"}));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(__dirname));

const schema = {
  type:"object",
  properties:{
    status:{type:"string"}, confidence:{type:"integer"}, event_date:{type:"string"}, event_time:{type:"string"}, event_location:{type:"string"},
    primary_status:{type:"string"}, primary_evidence:{type:"string"}, summary:{type:"string"},
    confirmed:{type:"array",items:{type:"string"}}, estimates:{type:"array",items:{type:"string"}},
    unconfirmed:{type:"array",items:{type:"string"}}, conflicts:{type:"array",items:{type:"string"}},
    direct_evidence:{type:"array",items:{type:"string"}}, context_evidence:{type:"array",items:{type:"string"}},
    contradiction_evidence:{type:"array",items:{type:"string"}}, source_quality:{type:"string"}, source_check:{type:"string"},
    sanity_check:{type:"array",items:{type:"string"}},
    sources:{type:"array",items:{type:"object",properties:{title:{type:"string"},url:{type:"string"},why:{type:"string"},type:{type:"string"},tier:{type:"string"}},required:["title","url","why","type","tier"]}},
    hear:{type:"array",items:{type:"string"}}, questions:{type:"array",items:{type:"string"}}, check:{type:"array",items:{type:"string"}},
    angle:{type:"string"}, structure:{type:"array",items:{type:"string"}},
    headline:{type:"string"}, dek:{type:"string"}, lead:{type:"string"}, risks:{type:"array",items:{type:"string"}}, note:{type:"string"}
  },
  required:["status","confidence","event_date","event_time","event_location","primary_status","primary_evidence","summary","confirmed","estimates","unconfirmed","conflicts","direct_evidence","evidence_records","context_evidence","contradiction_evidence","source_quality","source_check","sanity_check","sources","hear","questions","check","angle","structure","headline","dek","lead","risks","note"]
};

const editorial = `Você é o Jornalista AI, um assistente profissional de apuração jornalística.
IMPORTANTE: você NÃO tem acesso direto à web nesta etapa. A busca externa já foi feita pelo servidor e o material encontrado está abaixo. Use SOMENTE esse material e as informações fornecidas pelo usuário para avaliar a pauta.

REGRAS EDITORIAIS:
1. Defina a pauta principal como uma única afirmação atual, atômica e verificável.
2. Separe evidência direta, contexto e contradição real.
3. Ausência de resultado NÃO é prova de falsidade.
4. Informação de outro ano NÃO contradiz automaticamente um evento atual.
5. Não invente fatos, fontes, URLs, declarações, números ou especialistas.
6. Não trate rumor, projeção, estimativa ou postagem sem confirmação como fato.
7. Fonte oficial diretamente ligada ao fato recebe prioridade máxima; depois veículos jornalísticos confiáveis e independentes.
8. A confiança mede SOMENTE a pauta principal.
9. Só use CONFLITO quando houver duas evidências pertinentes que realmente se contradizem.
10. Se não houver evidência suficiente, use NÃO CONFIRMADO, nunca invente uma confirmação.

TIERS:
- TIER 1: órgão oficial, competição/federação, clube, empresa envolvida, documento oficial.
- TIER 2: veículo jornalístico confiável e independente.
- TIER 3: veículo especializado/portal setorial.
- TIER 4: blog/agregador/rede social/fonte sem autoria clara.

CLASSIFICAÇÃO:
- CONFIRMADO: evidência direta forte e atual.
- PARCIALMENTE CONFIRMADO: indícios bons, mas falta confirmação relevante.
- NÃO CONFIRMADO: evidência insuficiente.
- CONFLITO: evidências confiáveis e pertinentes se contradizem diretamente.
- CONFIRMADO / ENCERRADO: evento confirmado e já ocorrido.

CONFIDÊNCIA:
95-100: fonte primária atual + apoio independente.
90-94: múltiplas fontes atuais confiáveis.
75-89: evidência boa, mas falta fonte primária ou confirmação independente.
50-74: indícios/parcial.
20-49: conflito direto real.
0-19: evidência forte de falsidade.

PROTOCOLO ESPORTIVO:
Confirme competição, fase, data, local e status. Resultados de anos anteriores são contexto histórico. Uma página que não apareceu na busca não deve ser tratada como prova de que o jogo não existe.

FORMATOS EDITORIAIS INTELIGENTES:
- NOTÍCIA: priorize o fato atual, 5W1H, atualização objetiva, título, subtítulo e lide. Evite contexto longo que não seja necessário para entender o fato.
- NOTA: entregue apuração enxuta e rápida, com somente os fatos essenciais e poucas fontes fortes.
- REPORTAGEM: aprofunde contexto, histórico, causas, consequências, dados, documentos, múltiplas vozes e perguntas que ainda precisam ser respondidas.
- ENTREVISTA: identifique quem deve ser ouvido, por quê, o que precisamos descobrir e perguntas objetivas, de aprofundamento e de confronto.
- PERFIL: priorize trajetória, contexto, marcos, declarações e fatos verificáveis sobre a pessoa/organização, sem transformar elogios em fatos.
- COLUNA: separe rigorosamente fato verificado de análise/opinião e não apresente interpretação como informação factual.

REGRAS DE EVIDÊNCIA E TEMPO:
- Nunca escreva uma evidência de forma genérica quando o nome da pessoa estiver disponível. Exemplo: prefira “Miguel Merentiel, ex-Palmeiras, marcou o gol...” em vez de “ex-jogador do Palmeiras marcou...”.
- Preserve nomes próprios, clubes, competições, placares e números exatamente como aparecem nas fontes.
- Diferencie DATA DO FATO/EVENTO da DATA DE PUBLICAÇÃO/ATUALIZAÇÃO da matéria. Para um jogo, use a data em que a partida realmente ocorreu no horário local do evento. Não confunda uma matéria publicada em 09/09 com uma partida disputada em 08/09.
- Se fontes em UTC mostrarem o dia seguinte, priorize a data local informada por fontes esportivas/veículos e explique a diferença somente se necessário.
- event_date deve ser a data do acontecimento, em formato DD/MM/AAAA. event_time deve ser o horário local do acontecimento quando estiver disponível. event_location deve informar o local quando estiver disponível.
- direct_evidence deve ser composto por frases factuais completas, com entidade + ação + detalhe verificável + data quando pertinente.
- evidence_records é o rastreamento da evidência: cada afirmação deve indicar exatamente uma ou mais fontes reais encontradas. Use o URL real de uma fonte do bloco de resultados.
- level em evidence_records deve ser CONFIRMADO, PARCIAL ou NÃO CONFIRMADO. Só use CONFIRMADO quando a fonte sustentar diretamente a afirmação.
- Não transforme sua própria inferência em fato confirmado. A justificativa em reason deve explicar brevemente por que a fonte sustenta a afirmação.

TESTE DE SANIDADE:
- Estou confundindo histórico com evento atual?
- Tenho evidência diretamente relacionada?
- Existe fonte primária?
- Alguma fonte realmente contradiz o fato central?
- Estou transformando rumor/projeção em fato?
- Minha confiança reflete a pauta principal?`;

function modelList(){
  const primary=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
  const configured=(process.env.GEMINI_FALLBACK_MODELS||"gemini-2.5-flash-lite").split(",").map(x=>x.trim()).filter(Boolean);
  return [...new Set([primary,...configured])];
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function decodeHtml(s=""){
  return String(s||"")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x27;/gi,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)))
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]*>/g," ")
    .replace(/https?:\/\/[^\s<]+/gi," ")
    .replace(/www\.[^\s<]+/gi," ")
    .replace(/\s+/g," ").trim();
}
function tag(block,name){
  const re=new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,`i`);
  const m=block.match(re); return m?decodeHtml(m[1]):"";
}
function rssItems(xml){
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>{
    const b=m[1];
    return {title:tag(b,"title"),url:tag(b,"link"),description:tag(b,"description"),date:tag(b,"pubDate"),source:tag(b,"source")};
  }).filter(x=>x.title&&x.url);
}
async function fetchText(url, ms=5000){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),ms);
  try{
    const r=await fetch(url,{signal:controller.signal,headers:{"user-agent":"JornalistaAI/8.0 (news research)"}});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  }finally{clearTimeout(timer);}
}
async function searchGoogleNews(query){
  const url=`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  const xml=await fetchText(url);
  return rssItems(xml).slice(0,8).map(x=>({...x,provider:"Google News RSS",query}));
}
async function searchGdelt(query){
  const url=`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=8&format=json&sort=datedesc`;
  const text=await fetchText(url);
  const data=JSON.parse(text);
  return (data.articles||[]).slice(0,10).map(x=>({title:x.title||x.domain,url:x.url,description:x.snippet||"",date:x.seendate||"",source:x.domain||"",provider:"GDELT",query})).filter(x=>x.url);
}
function cleanQuery(q){return String(q||"").replace(/["'`]/g," ").replace(/\s+/g," ").trim().slice(0,180);}
function buildQueries(body){
  const topic=cleanQuery(body.topic); const year=new Date().getFullYear();
  const area=cleanQuery(body.area||""); const format=String(body.format||"Notícia");
  const qs=[`${topic} ${year}`,`${topic} ${area} ${year}`.trim()];
  if(/Reportagem/i.test(format)) qs.push(`${topic} contexto histórico causas consequências ${year}`);
  else if(/Entrevista/i.test(format)) qs.push(`${topic} entrevista declaração fala ${year}`);
  else if(/Perfil/i.test(format)) qs.push(`${topic} trajetória histórico ${year}`);
  else if(/Coluna/i.test(format)) qs.push(`${topic} análise repercussão ${year}`);
  if(/esport/i.test(area)||/futebol|basquete|nba|libertadores|champions|f1|futebol/i.test(topic)) qs.push(`${topic} calendário oficial ${year}`);
  return [...new Set(qs.filter(Boolean))].slice(0,3);
}
function dedupeResults(items){
  const map=new Map();
  for(const x of items){
    const key=(x.url||x.title).replace(/\/$/,"").toLowerCase();
    if(!map.has(key)) map.set(key,x);
  }
  return [...map.values()].slice(0,14);
}
async function externalSearch(body){
  const queries=buildQueries(body).slice(0,2);
  const jobs=[];
  for(const q of queries){
    jobs.push(searchGoogleNews(q).catch(err=>{console.error(`SEARCH_GOOGLE_NEWS_ERROR ${err.message}`);return [];}));
    jobs.push(searchGdelt(q).catch(err=>{console.error(`SEARCH_GDELT_ERROR ${err.message}`);return [];}));
  }
  const results=dedupeResults((await Promise.all(jobs)).flat());
  console.log(`EXTERNAL_SEARCH results=${results.length} queries=${queries.length}`);
  return {queries,results};
}
function formatResearch(research){
  if(!research.results.length) return `BUSCA EXTERNA: nenhum resultado retornado. Isso NÃO é prova de que a pauta seja falsa.`;
  return `BUSCA EXTERNA REALIZADA PELO SERVIDOR\nConsultas: ${research.queries.join(" | ")}\n\nRESULTADOS (título, fonte, data, URL e resumo/snippet):\n`+
    research.results.map((r,i)=>`[${i+1}] ${r.title}\nFonte: ${r.source||r.provider}\nData: ${r.date||"não informada"}\nURL: ${r.url}\nResumo: ${r.description||"sem resumo"}`).join("\n\n");
}
function errorStatus(error){
  return Number(error?.status||error?.statusCode||error?.code||error?.response?.status||0);
}
function errorKind(error){
  const status=errorStatus(error);
  const msg=String(error?.message||error||"").toLowerCase();
  if(status===429 || /resource_exhausted|quota_exceeded|rate_limit_exceeded|too many requests|rate limit/.test(msg)) return "quota";
  if([408,500,502,503,504].includes(status) || /unavailable|overloaded|high demand|timed out|timeout|service unavailable/.test(msg)) return "temporary";
  return "fatal";
}
function isTransientError(error){ return errorKind(error)!=="fatal"; }
async function generateOnce(ai,model,input,config={},timeoutMs=38000){
  // V8.4: usa a API Interactions, que é a interface padrão atual do Gemini.
  const {responseMimeType,responseSchema,...generationConfig}=config||{};
  const requestConfig={model,input};
  if(Object.keys(generationConfig).length) requestConfig.generation_config=generationConfig;
  if(responseMimeType || responseSchema){
    requestConfig.response_format={
      type:"text",
      mime_type:responseMimeType||"application/json",
      ...(responseSchema?{schema:responseSchema}:{})
    };
  }
  const request=ai.interactions.create(requestConfig);
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(`Tempo limite excedido ao consultar o Gemini (${timeoutMs/1000}s).`),{status:504})),timeoutMs);});
  try{
    const interaction=await Promise.race([request,timeout]);
    const text=interaction?.output_text||interaction?.outputs?.filter(x=>x?.type==="text").map(x=>x.text||"").join("\n")||"";
    if(!text.trim()) throw Object.assign(new Error("O Gemini concluiu a interação, mas não retornou texto."),{status:502});
    return {text,interaction};
  }finally{clearTimeout(timer);}
}
async function generateWithRetry({contents,config={}}){
  if(!process.env.GEMINI_API_KEY) throw new Error("Chave GEMINI_API_KEY não configurada.");
  const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
  const models=modelList();
  let lastError=null;
  for(let i=0;i<models.length;i++){
    const model=models[i];
    try{
      console.log(`GEMINI_REQUEST model=${model} attempt=${i+1}/${models.length}`);
      const result=await generateOnce(ai,model,contents,config);
      console.log(`GEMINI_OK model=${model}`);
      return {response:{text:result.text},model};
    }catch(error){
      lastError=error;
      const kind=errorKind(error);
      console.error(`GEMINI_ERROR model=${model} kind=${kind} status=${errorStatus(error)} message=${error?.message||error}`);
      if(kind==="fatal") throw error;
      // Quota 429: não repetir o mesmo pedido. Tentar apenas um modelo alternativo.
      if(kind==="quota") continue;
      // Erros transitórios: uma espera curta antes de tentar o próximo modelo.
      if(i<models.length-1) await sleep(1800);
    }
  }
  throw lastError||new Error("Gemini indisponível no momento.");
}

function hostOf(url=""){
  try{return new URL(url).hostname.replace(/^www\./,"").toLowerCase();}catch{return "";}
}
function classifyTier(url="", source=""){
  const h=hostOf(url); const text=(h+" "+String(source||"")).toLowerCase();
  const aggregator=/^(news\.google\.com|www\.google\.com|google\.com)$/i.test(h);
  const official=["conmebol.com","cbf.com.br","fifa.com","uefa.com","nba.com","nfl.com","mlb.com","olympics.com","gov.br","planalto.gov.br","stf.jus.br","camara.leg.br","senado.leg.br","ibge.gov.br","anatel.gov.br","apple.com","microsoft.com"];
  const tier2=["ge.globo.com","uol.com.br","espn.com.br","terra.com.br","g1.globo.com","folha.uol.com.br","estadao.com.br","cnnbrasil.com.br","gazetaesportiva.com","placar.com.br","lance.com.br","oglobo.globo.com","reuters.com","apnews.com","bbc.com"];
  if(!aggregator && official.some(x=>text.includes(x))) return "TIER 1 · OFICIAL";
  if(tier2.some(x=>text.includes(x))) return "TIER 2 · IMPRENSA";
  return "TIER 3 · ESPECIALIZADA";
}
function shortDate(value=""){
  if(!value) return "Data não informada";
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return String(value).slice(0,60);
  return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
}
function cleanSourceText(value=""){
  let t=decodeHtml(String(value||""));
  t=t.replace(/target\s*=\s*["'][^"']*["']/gi," ")
    .replace(/href\s*=\s*["'][^"']*["']/gi," ")
    .replace(/Encontrada na busca externa\s*\([^)]*\)\.?/gi,"Resultado encontrado na pesquisa externa.")
    .replace(/Resultado encontrado por [^.]+\.?/gi,"Resultado encontrado na pesquisa externa.")
    .replace(/\s+/g," ").trim();
  return t;
}
function sourceCardData(r, why=""){
  const url=r.url||""; const host=hostOf(url); const publisher=cleanSourceText(r.source||"");
  const display=publisher||host||r.provider||"Fonte";
  const cleanWhy=cleanSourceText(why||r.description||"");
  return {title:r.title||"Fonte sem título",url,why:cleanWhy.slice(0,220),type:"web",tier:classifyTier(url,`${r.source||""} ${r.title||""}`),provider:r.provider||"Busca externa",domain:display,date:shortDate(r.date)};
}
function normalizeSources(data,research){
  const external=research.results.map(r=>sourceCardData(r,`Resultado encontrado na pesquisa externa. ${r.description||""}`.trim()));
  const generated=Array.isArray(data.sources)?data.sources:[];
  const allowed=new Map(external.map(x=>[x.url,x]));
  const final=[];
  for(const s of generated){
    if(s?.url && allowed.has(s.url)){
      const base=allowed.get(s.url);
      final.push({...base,why:cleanSourceText(s.why||base.why).slice(0,320),tier:classifyTier(base.url,`${s.tier||""} ${base.domain||""}`)});
    }
  }
  for(const s of external) if(!final.some(x=>x.url===s.url)) final.push(s);
  return final.slice(0,8);
}
function classifyStatus(data){
  const s=String(data.primary_status||data.status||"").toUpperCase();
  if(/CONFLITO/.test(s)) return "CONFLITO";
  if(/NÃO|NAO/.test(s)) return "NÃO CONFIRMADO";
  if(/PARCIAL/.test(s)) return "PARCIALMENTE CONFIRMADO";
  if(/ENCERRADO/.test(s)) return "CONFIRMADO / ENCERRADO";
  if(/CONFIRMADO/.test(s)) return "CONFIRMADO";
  return "NÃO CONFIRMADO";
}
function normalizeEvidenceRecords(data,research){
  const allowed=new Map(research.results.map(r=>[r.url,{title:r.title,url:r.url}]));
  const records=Array.isArray(data.evidence_records)?data.evidence_records:[];
  const clean=[];
  for(const e of records){
    const url=String(e?.source_url||"").trim();
    if(!e?.claim || !allowed.has(url)) continue;
    const base=allowed.get(url);
    const level=/^CONFIRMADO$/i.test(String(e.level||""))?"CONFIRMADO":/^PARCIAL/i.test(String(e.level||""))?"PARCIAL":"NÃO CONFIRMADO";
    clean.push({claim:cleanSourceText(e.claim).slice(0,320),level,source_title:base.title||cleanSourceText(e.source_title||"Fonte"),source_url:url,reason:cleanSourceText(e.reason||"A fonte foi encontrada na busca externa e sustenta a afirmação.").slice(0,260)});
  }
  return clean.slice(0,20);
}
function enforceSafety(data,research){
  data.sources=normalizeSources(data,research);
  data.evidence_records=normalizeEvidenceRecords(data,research);
  if(!data.evidence_records.length && (data.direct_evidence||[]).length){
    data.source_check=(data.source_check||"")+" Nenhum vínculo automático entre evidência e fonte foi retornado; revise manualmente antes de publicar.";
  }
  data.primary_status=classifyStatus(data); data.status=data.primary_status;
  data.confidence=Math.max(0,Math.min(100,Number(data.confidence)||0));
  data.conflicts=(data.conflicts||[]).filter(x=>/diret|contrad|incompat/i.test(String(x)));
  if(data.primary_status==="CONFLITO" && !(data.contradiction_evidence||[]).length){data.primary_status="NÃO CONFIRMADO";data.status=data.primary_status;}
  if(data.primary_status.startsWith("CONFIRMADO")) data.confidence=Math.max(data.confidence,90);
  if(data.primary_status==="CONFLITO") data.confidence=Math.min(data.confidence,49);
  if(data.primary_status==="NÃO CONFIRMADO") data.confidence=Math.min(data.confidence,74);
  data.source_check=data.source_check||"As fontes foram limitadas aos resultados realmente encontrados pela busca externa.";
  data.note=(data.note||"")+` Busca externa: ${research.results.length} resultados encontrados.`;
  return data;
}
function formatProfile(format="Notícia"){
  const profiles={
    "Notícia":"Foco no fato principal e na atualização. Priorize 5W1H, evidência direta, título, subtítulo e lide objetivos.",
    "Nota":"Foco em velocidade e concisão. Use apenas os fatos essenciais, evitando contexto ou análise desnecessários.",
    "Reportagem":"Foco em aprofundamento. Procure contexto, histórico, causas, consequências, dados, documentos, múltiplas fontes e pessoas que ainda precisam ser ouvidas.",
    "Entrevista":"Foco em preparação de entrevista. Identifique entrevistados relevantes, motivo de ouvi-los, informações a obter e perguntas básicas, de aprofundamento e de confronto.",
    "Perfil":"Foco em trajetória e contexto. Destaque fatos verificáveis, cronologia, marcos e declarações relevantes sem transformar elogios em fatos.",
    "Coluna":"Foco analítico. Separe claramente fatos confirmados de interpretação/opinião e não invente fatos para sustentar uma tese."
  };
  return profiles[format]||profiles["Notícia"];
}
function basePrompt(body,research){
  const today=new Date().toISOString().slice(0,10); const format=body.format||"Notícia";
  return `${editorial}\n\nDATA ATUAL: ${today}\n\nPAUTA:\nTema: ${body.topic}\nÁrea: ${body.area||"Geral"}\nFormato: ${format}\nESTRATÉGIA DO FORMATO: ${formatProfile(format)}\nInformações/links fornecidos pelo usuário:\n${body.sources||"(nenhum)"}\n\n${formatResearch(research)}\n\nTAREFA:\n1. Extraia a afirmação principal em uma frase.\n2. Verifique primeiro essa afirmação usando os resultados externos acima.\n3. Separe direct_evidence, context_evidence e contradiction_evidence.\n4. Em direct_evidence, escreva frases completas e específicas: inclua nome próprio, equipe/entidade, ação, placar/número e data do fato quando pertinente. NUNCA substitua o nome por uma descrição genérica se o nome estiver nas fontes.\n5. Determine event_date, event_time e event_location a partir do acontecimento, não da data de publicação da matéria. Para jogos, use a data local em que a partida começou.\n6. Só use URLs que aparecem nos resultados externos ou nos links fornecidos pelo usuário.\n7. Não invente uma fonte porque ela parece provável.\n8. Monte sources com título, URL real, motivo e tier.\n9. Faça o teste de sanidade, especialmente para separar data do evento de data de publicação.\n10. Escolha primary_status e confidence com base apenas na pauta principal.\n11. Headline/dek/lead devem respeitar o status. Se não confirmado, use linguagem condicional.\n12. Se o evento já aconteceu, classifique como CONFIRMADO / ENCERRADO.
13. Para cada item factual importante, crie evidence_records com a fonte exata. Se não houver fonte suficiente, marque como PARCIAL ou NÃO CONFIRMADO.
14. Não use a palavra “confirmado” apenas porque várias matérias repetem a mesma informação; avalie a qualidade e independência das fontes.
15. Se duas fontes divergirem sobre uma data, placar, nome ou número, registre a divergência em contradiction_evidence e conflicts.\n16. Se houver divergência de fuso horário, não chame isso de conflito factual: use a data local do evento e, se necessário, explique a diferença de UTC no campo note.`;
}
async function analyze(body){
  const research=await externalSearch(body);
  if(!research.results.length){
    throw new Error("A busca externa não retornou fontes. Tente novamente com termos mais específicos.");
  }
  try{
    const {response,model}=await generateWithRetry({contents:basePrompt(body,research),config:{responseMimeType:"application/json",responseSchema:schema,temperature:0.1}});
    let raw=response?.text||""; let data;
    try{data=JSON.parse(raw);}catch{data=JSON.parse(raw.replace(/^```json\s*/i,"").replace(/\s*```$/i,"").trim());}
    data=enforceSafety(data,research); data.note=(data.note||"")+` Motor Gemini: ${model}.`;
    return data;
  }catch(error){
    // A busca já foi concluída. Não escondemos as fontes só porque a IA falhou.
    const e=new Error(error?.message||"Gemini indisponível no momento.");
    e.code="AI_UNAVAILABLE";
    e.status=errorStatus(error)||503;
    e.research=research;
    throw e;
  }
}

app.post("/api/analyze",async(req,res)=>{
  try{if(!req.body.topic?.trim())return res.status(400).json({error:"Informe a pauta."});res.json(await analyze(req.body));}
  catch(e){
    console.error("ANALYZE_ERROR",e);
    if(e.code==="AI_UNAVAILABLE" && e.research){
      return res.status(200).json({
        partial:true,
        status:"IA INDISPONÍVEL",
        primary_status:"IA INDISPONÍVEL",
        confidence:0,
        event_date:"",event_time:"",event_location:"",
        primary_evidence:"A pesquisa externa foi concluída, mas o Gemini não conseguiu analisar os resultados dentro do limite de tempo/cota.",
        summary:"As fontes abaixo foram encontradas, porém a análise automática não foi concluída. Revise as fontes antes de publicar.",
        confirmed:[],estimates:[],unconfirmed:[],conflicts:[],direct_evidence:[],evidence_records:[],context_evidence:[],contradiction_evidence:[],source_quality:"Pesquisa externa disponível; análise da IA pendente.",source_check:"As fontes foram obtidas externamente e não devem ser tratadas como confirmação automática.",sanity_check:["A busca externa funcionou.","A análise do Gemini não foi concluída.","A decisão editorial continua pendente de revisão humana."],
        sources:e.research.results.slice(0,8).map(r=>sourceCardData(r,`Resultado encontrado na pesquisa externa. ${r.description||""}`.trim())),
        hear:[],questions:[],check:["Revisar as fontes encontradas."],angle:"Aguardando análise do Gemini.",structure:[],headline:"Análise automática indisponível",dek:"As fontes foram encontradas, mas precisam de revisão.",lead:"A pesquisa externa encontrou fontes relacionadas à pauta.",risks:["Não publicar como confirmado sem revisar as fontes."],note:`Busca externa: ${e.research.results.length} resultados. Motivo da falha da IA: ${e.message}`
      });
    }
    const transient=isTransientError(e);
    res.status(transient?503:500).json({error:transient?"A pesquisa encontrou fontes, mas o Gemini atingiu um limite temporário. Tente novamente em instantes.":(e.message||"Erro na apuração.")});
  }
});

app.post("/api/write",async(req,res)=>{
  try{
    const b=req.body.briefing;if(!b)return res.status(400).json({error:"Briefing ausente."});
    const prompt=`${editorial}\n\nETAPA REDAÇÃO. Use somente os fatos em direct_evidence e confirmed do briefing. Contexto apenas como contexto. Não transforme estimates, unconfirmed ou conflicts em fatos. Se primary_status não for CONFIRMADO, use linguagem claramente condicional. Entregue título, subtítulo, lead, corpo em parágrafos e bloco FONTES.\n\nBRIEFING:\n${JSON.stringify(b)}`;
    const {response}=await generateWithRetry({contents:prompt,config:{temperature:0.2}});
    res.json({text:response.text});
  }catch(e){res.status(isTransientError(e)?503:500).json({error:isTransientError(e)?"O Gemini gratuito está temporariamente no limite.":(e.message||"Erro ao redigir.")});}
});

app.post("/api/factcheck",async(req,res)=>{
  try{
    if(!req.body.text?.trim())return res.status(400).json({error:"Cole um texto para checar."});
    const research=await externalSearch({topic:req.body.text.slice(0,900),area:"Fact-check",format:"Checagem",sources:""});
    const prompt=`${editorial}\n\nFAÇA UM FACT-CHECK. O texto abaixo contém afirmações verificáveis. Use a BUSCA EXTERNA fornecida. Para cada afirmação, classifique como CONFIRMADA, PARCIAL, NÃO CONFIRMADA ou CONTRADITA, cite a URL disponível que sustenta a classificação e explique a correção necessária. Não declare falsidade sem evidência direta.\n\n${formatResearch(research)}\n\nTEXTO:\n${req.body.text}`;
    const {response}=await generateWithRetry({contents:prompt,config:{temperature:0.1}});
    res.json({text:response.text});
  }catch(e){res.status(isTransientError(e)?503:500).json({error:isTransientError(e)?"O Gemini gratuito está temporariamente no limite.":(e.message||"Erro no fact-check.")});}
});

app.get("/health",(req,res)=>res.json({ok:true,service:"Jornalista AI",version:"8.6-verifiable-research",search:"external-rss-gdelt",gemini:"interactions-api"}));
app.get("/api/search-test",async(req,res)=>{try{const r=await externalSearch({topic:req.query.q||"notícias Brasil",area:"Geral",format:"Pesquisa"});res.json({ok:true,queries:r.queries,count:r.results.length,results:r.results.slice(0,8)});}catch(e){res.status(502).json({ok:false,error:e.message});}});
app.use((req,res)=>req.method==="GET"?res.sendFile(path.join(__dirname,"index.html")):res.status(404).json({error:"Rota não encontrada."}));
const PORT=process.env.PORT||3000;
app.listen(PORT,"0.0.0.0",()=>console.log(`Jornalista AI V8.6 Apuração Verificável online na porta ${PORT}`));
