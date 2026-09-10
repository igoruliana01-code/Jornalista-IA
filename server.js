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
    status:{type:"string"}, confidence:{type:"integer"},
    primary_status:{type:"string"}, primary_evidence:{type:"string"}, summary:{type:"string"},
    confirmed:{type:"array",items:{type:"string"}},
    estimates:{type:"array",items:{type:"string"}},
    unconfirmed:{type:"array",items:{type:"string"}},
    conflicts:{type:"array",items:{type:"string"}},
    direct_evidence:{type:"array",items:{type:"string"}},
    context_evidence:{type:"array",items:{type:"string"}},
    contradiction_evidence:{type:"array",items:{type:"string"}},
    source_quality:{type:"string"},
    source_check:{type:"string"},
    sanity_check:{type:"array",items:{type:"string"}},
    sources:{type:"array",items:{type:"object",properties:{title:{type:"string"},url:{type:"string"},why:{type:"string"},type:{type:"string"},tier:{type:"string"}},required:["title","url","why","type","tier"]}},
    hear:{type:"array",items:{type:"string"}}, questions:{type:"array",items:{type:"string"}}, check:{type:"array",items:{type:"string"}},
    angle:{type:"string"}, structure:{type:"array",items:{type:"string"}},
    headline:{type:"string"}, dek:{type:"string"}, lead:{type:"string"}, risks:{type:"array",items:{type:"string"}}, note:{type:"string"}
  },
  required:["status","confidence","primary_status","primary_evidence","summary","confirmed","estimates","unconfirmed","conflicts","direct_evidence","context_evidence","contradiction_evidence","source_quality","source_check","sanity_check","sources","hear","questions","check","angle","structure","headline","dek","lead","risks","note"]
};

const editorial = `Você é o Jornalista AI, um assistente profissional de apuração jornalística. Seu trabalho é separar evidência de contexto e nunca transformar ausência de resultado em falsidade.

HIERARQUIA EDITORIAL OBRIGATÓRIA:
1. DEFINA A PAUTA PRINCIPAL como uma única afirmação atual, atômica e verificável.
2. VERIFIQUE PRIMEIRO o fato principal. Só depois procure histórico e contexto.
3. Evidência direta responde: “isso aconteceu/está marcado/foi anunciado?”
4. Contexto responde: “o que aconteceu antes, qual o histórico ou qual informação complementar ajuda a entender?”
5. Contradição direta só existe quando uma fonte pertinente e confiável diz que o fato principal é incompatível com a realidade atual.
6. “Não encontrei”, página incompleta, resultado mal indexado ou ausência em uma lista NÃO são contradição.
7. Uma informação de outro ano NÃO contradiz automaticamente um evento atual.
8. Fonte oficial diretamente ligada ao fato recebe prioridade máxima. Depois, veículos jornalísticos confiáveis e independentes.
9. Não invente URLs. Se não puder confirmar uma URL, não a crie.
10. A CONFIANÇA mede SOMENTE a pauta principal, não o histórico.

PESOS DE FONTE:
- TIER 1: órgão oficial, competição/federação, clube, empresa envolvida, documento oficial.
- TIER 2: veículo jornalístico confiável e independente.
- TIER 3: veículo especializado/portal setorial.
- TIER 4: blog, agregador, rede social ou fonte sem autoria clara.
Uma confirmação direta TIER 1 atual é evidência muito forte. Idealmente busque também uma confirmação independente TIER 2.

REGRA DE CLASSIFICAÇÃO:
- CONFIRMADO: evidência direta forte.
- PARCIALMENTE CONFIRMADO: bons indícios, mas falta confirmação relevante.
- NÃO CONFIRMADO: não há evidência suficiente para afirmar.
- CONFLITO: há evidências confiáveis e pertinentes que realmente se contradizem.
- CONFIRMADO / ENCERRADO: o evento foi confirmado e já aconteceu; ajuste temporal deve ser indicado.

CONFIDÊNCIA:
95-100: confirmação direta atual por fonte oficial, preferencialmente com apoio independente.
90-94: múltiplas fontes atuais confiáveis, sem contradição direta.
75-89: evidência boa, mas falta fonte primária ou confirmação independente.
50-74: indícios/parcial.
20-49: conflito direto real.
0-19: evidência forte de falsidade.
Não reduza a confiança por contexto histórico ou ausência de um registro lateral.

PROTOCOLO DE ESPORTES:
- Busque times + competição + ano atual.
- Depois procure fixture/calendário/página oficial do confronto.
- Confirme competição, fase, data, local e status.
- Depois busque fonte jornalística atual independente.
- Se achar outro ano, classifique como CONTEXTO HISTÓRICO.
- Se houver dúvida entre competições, consulte a ficha oficial do jogo antes de declarar conflito.

TESTE DE SANIDADE ANTES DE RESPONDER:
- Estou confundindo histórico com evento atual?
- Tenho evidência diretamente relacionada à pauta?
- Existe fonte primária?
- Alguma fonte realmente contradiz o fato central?
- Estou chamando rumor/projeção de confirmado?
- Minha porcentagem reflete a pauta principal, e não um detalhe secundário?

Nunca invente fatos, fontes, declarações, números ou especialistas.`;

function modelList(){
  const primary=process.env.GEMINI_MODEL||"gemini-3.8-flash";
  const configured=(process.env.GEMINI_FALLBACK_MODELS||"gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash-lite").split(",").map(x=>x.trim()).filter(Boolean);
  return [...new Set([primary,...configured])];
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function isTransientError(error){
  const status=Number(error?.status||error?.statusCode||error?.code);
  const msg=String(error?.message||error||"").toLowerCase();
  return [408,429,500,502,503,504].includes(status)||/503|unavailable|overloaded|high demand|resource_exhausted|too many requests|rate limit|timed out|timeout/.test(msg);
}
async function generateWithRetry({contents,config={},search=true}){
  if(!process.env.GEMINI_API_KEY) throw new Error("Chave GEMINI_API_KEY não configurada.");
  const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
  let lastError=null;
  for(const model of modelList()){
    for(let attempt=1;attempt<=3;attempt++){
      try{
        const finalConfig={...config};
        if(search) finalConfig.tools=[{googleSearch:{}}];
        const response=await ai.models.generateContent({model,contents,config:finalConfig});
        return {response,model};
      }catch(error){
        lastError=error;
        if(!isTransientError(error)) throw error;
        if(attempt<3) await sleep(Math.min(8000,1000*2**(attempt-1))+Math.floor(Math.random()*500));
      }
    }
  }
  throw lastError||new Error("Gemini indisponível no momento.");
}
function extractGroundingSources(response){
  const out=[];
  const seen=new Set();
  const candidates=response?.candidates||[];
  for(const c of candidates){
    const gm=c?.groundingMetadata;
    for(const chunk of (gm?.groundingChunks||[])){
      const web=chunk?.web;
      if(web?.uri && !seen.has(web.uri)){
        seen.add(web.uri); out.push({title:web.title||web.uri,url:web.uri,why:"Fonte retornada pelo embasamento da Pesquisa Google.",type:"web",tier:"A classificar"});
      }
    }
  }
  return out;
}
function normalizeSources(data,response){
  const generated=Array.isArray(data.sources)?data.sources:[];
  const grounded=extractGroundingSources(response);
  const map=new Map();
  for(const s of [...generated,...grounded]) if(s?.url && !map.has(s.url)) map.set(s.url,{title:s.title||s.url,url:s.url,why:s.why||"Fonte encontrada na apuração.",type:s.type||"web",tier:s.tier||"A classificar"});
  return [...map.values()].slice(0,8);
}
function classifyStatus(data){
  const s=String(data.primary_status||data.status||"").toUpperCase();
  if(/CONFIRMADO/.test(s) && !/NÃO|NAO|PARCIAL|CONFLITO/.test(s)) return "CONFIRMADO";
  if(/ENCERRADO/.test(s)) return "CONFIRMADO / ENCERRADO";
  if(/CONFLITO/.test(s)) return "CONFLITO";
  if(/PARCIAL/.test(s)) return "PARCIALMENTE CONFIRMADO";
  return "NÃO CONFIRMADO";
}
function enforceEditorialSafety(data,groundedSources){
  data.sources=normalizeSources(data,{candidates:[{groundingMetadata:{groundingChunks:groundedSources.map(s=>({web:{uri:s.url,title:s.title}}))}}]});
  data.primary_status=classifyStatus(data);
  data.status=data.primary_status;
  data.confidence=Math.max(0,Math.min(100,Number(data.confidence)||0));
  // Conflicts only remain when explicitly described as direct.
  data.conflicts=(data.conflicts||[]).filter(x=>/diret|contrad|incompat/i.test(String(x)));
  if(data.primary_status==="CONFLITO" && data.contradiction_evidence?.length===0) data.primary_status="NÃO CONFIRMADO";
  if(data.primary_status==="CONFIRMADO" && data.conflicts.length>0){ data.primary_status="CONFLITO"; data.status="CONFLITO"; }
  if(data.primary_status.startsWith("CONFIRMADO")) data.confidence=Math.max(data.confidence,90);
  if(data.primary_status==="CONFLITO") data.confidence=Math.min(data.confidence,49);
  if(data.primary_status==="NÃO CONFIRMADO") data.confidence=Math.min(data.confidence,74);
  data.source_check=data.source_check||"Fontes separadas por relevância e qualidade.";
  data.sanity_check=Array.isArray(data.sanity_check)?data.sanity_check:[];
  return data;
}
function basePrompt(body){
  const today=new Date().toISOString().slice(0,10);
  return `${editorial}\n\nDATA ATUAL: ${today}\n\nPAUTA:\nTema: ${body.topic}\nÁrea: ${body.area||"Geral"}\nFormato: ${body.format||"Notícia"}\nInformações/links fornecidos:\n${body.sources||"(nenhum)"}\n\nTAREFA:\n1. Extraia a afirmação principal em uma frase.\n2. Pesquise e verifique primeiro essa afirmação.\n3. Separe explicitamente direct_evidence, context_evidence e contradiction_evidence.\n4. Só coloque algo em contradiction_evidence se contradizer diretamente a afirmação principal.\n5. Monte sources com título, URL real, motivo e tier.\n6. Faça o teste de sanidade e registre os resultados em sanity_check.\n7. Escolha primary_status e confidence com base apenas na pauta principal.\n8. Headline/dek/lead são rascunhos e devem respeitar o status. Se não confirmado, use linguagem condicional.\n9. Não invente fontes ou URLs.\n10. Se o evento já aconteceu, classifique como CONFIRMADO / ENCERRADO e explique a atualização temporal necessária.`;
}
async function analyze(body){
  const {response,model}=await generateWithRetry({contents:basePrompt(body),config:{responseMimeType:"application/json",responseSchema:schema,temperature:0.1},search:true});
  let data=JSON.parse(response.text);
  data.sources=normalizeSources(data,response);
  data.note=(data.note||"")+` Motor: ${model}.`;
  data=enforceEditorialSafety(data,data.sources);
  return data;
}

app.post("/api/analyze",async(req,res)=>{
  try{
    if(!req.body.topic?.trim()) return res.status(400).json({error:"Informe a pauta."});
    const data=await analyze(req.body);
    res.json(data);
  }catch(e){
    console.error(e);
    res.status(isTransientError(e)?503:500).json({error:isTransientError(e)?"O Gemini está temporariamente congestionado. Tente novamente em alguns segundos.":(e.message||"Erro na apuração.")});
  }
});

app.post("/api/write",async(req,res)=>{
  try{
    const b=req.body.briefing;
    if(!b) return res.status(400).json({error:"Briefing ausente."});
    const prompt=`${editorial}\n\nVocê está na etapa REDAÇÃO. Use SOMENTE os fatos em direct_evidence e confirmed do briefing. Contexto pode ser usado somente quando marcado como contexto. Não transforme estimates, unconfirmed ou conflicts em fatos. Se primary_status não for CONFIRMADO, use linguagem claramente condicional. Preserve links/fontes ao final. Entregue: título, subtítulo, lead, corpo em parágrafos e bloco FONTES.\n\nBRIEFING:\n${JSON.stringify(b)}`;
    const {response}=await generateWithRetry({contents:prompt,config:{temperature:0.2},search:false});
    res.json({text:response.text});
  }catch(e){res.status(isTransientError(e)?503:500).json({error:isTransientError(e)?"O Gemini está temporariamente congestionado. Tente novamente em alguns segundos.":(e.message||"Erro ao redigir.")});}
});

app.post("/api/factcheck",async(req,res)=>{
  try{
    if(!req.body.text?.trim()) return res.status(400).json({error:"Cole um texto para checar."});
    const prompt=`${editorial}\n\nFaça um FACT-CHECK. Liste cada afirmação verificável, classifique como CONFIRMADA, PARCIAL, NÃO CONFIRMADA ou CONTRADITA, indique a fonte que sustenta a classificação e explique o que precisa ser corrigido. Não declare falsidade sem evidência direta.\n\nTEXTO:\n${req.body.text}`;
    const {response}=await generateWithRetry({contents:prompt,config:{temperature:0.1},search:true});
    res.json({text:response.text});
  }catch(e){res.status(isTransientError(e)?503:500).json({error:isTransientError(e)?"O Gemini está temporariamente congestionado. Tente novamente em alguns segundos.":(e.message||"Erro no fact-check.")});}
});

app.get("/health",(req,res)=>res.json({ok:true,service:"Jornalista AI",version:"7.0"}));
app.use((req,res)=>req.method==="GET"?res.sendFile(path.join(__dirname,"index.html")):res.status(404).json({error:"Rota não encontrada."}));
const PORT=process.env.PORT||3000;
app.listen(PORT,"0.0.0.0",()=>console.log(`Jornalista AI V7 online na porta ${PORT}`));
