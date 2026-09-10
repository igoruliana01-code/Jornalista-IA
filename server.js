import express from "express";
import dotenv from "dotenv";
import {GoogleGenAI} from "@google/genai";
import path from "path";
import {fileURLToPath} from "url";

dotenv.config();
const app=express();
app.use(express.json({limit:"4mb"}));
const __dirname=path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(__dirname));

const schema={
 type:"object",
 properties:{
  status:{type:"string"},
  confidence:{type:"integer"},
  primary_status:{type:"string"},
  primary_evidence:{type:"string"},
  summary:{type:"string"},
  confirmed:{type:"array",items:{type:"string"}},
  estimates:{type:"array",items:{type:"string"}},
  unconfirmed:{type:"array",items:{type:"string"}},
  conflicts:{type:"array",items:{type:"string"}},
  sources:{type:"array",items:{type:"object",properties:{title:{type:"string"},url:{type:"string"},why:{type:"string"},type:{type:"string"}},required:["title","url","why","type"]}},
  hear:{type:"array",items:{type:"string"}},
  questions:{type:"array",items:{type:"string"}},
  check:{type:"array",items:{type:"string"}},
  angle:{type:"string"},
  structure:{type:"array",items:{type:"string"}},
  headline:{type:"string"},
  dek:{type:"string"},
  lead:{type:"string"},
  risks:{type:"array",items:{type:"string"}},
  note:{type:"string"}
 },
 required:["status","confidence","primary_status","primary_evidence","summary","confirmed","estimates","unconfirmed","conflicts","sources","hear","questions","check","angle","structure","headline","dek","lead","risks","note"]
};

const editorial=`Você é o Jornalista AI, um assistente profissional de apuração jornalística.

REGRA CENTRAL — HIERARQUIA DE EVIDÊNCIAS:
1. Antes de julgar a pauta, identifique a PAUTA PRINCIPAL como uma afirmação atômica e verificável. Ex.: “Corinthians enfrenta Estudiantes fora de casa pela Libertadores” significa verificar se esse confronto atual existe, em qual competição, fase, data e local.
2. Pesquise primeiro o FATO ATUAL da pauta. Para eventos esportivos, priorize a fonte oficial da competição, federação/organização e clubes, e depois fontes jornalísticas independentes atuais.
3. Faça buscas orientadas ao presente: procure o enunciado exato da pauta + ano/data atual e procure também a fonte oficial. Não use um confronto antigo como substituto do evento atual.
4. Separe rigorosamente: (A) EVIDÊNCIA DIRETA DA PAUTA PRINCIPAL; (B) CONTEXTO SECUNDÁRIO; (C) CONFLITOS QUE REALMENTE CONTRADIZEM A PAUTA PRINCIPAL.
5. Um dado histórico diferente, estatística antiga, erro de contexto, confronto anterior ou informação lateral NÃO é conflito da pauta principal. Deve ir para contexto/“a checar” e não reduzir a confiança do fato central.
6. Só marque primary_status como CONFLITO quando uma fonte confiável e pertinente contradisser diretamente o fato central. Só marque NÃO CONFIRMADO quando não houver evidência direta suficiente.
7. Se uma fonte oficial atual confirma diretamente a pauta principal, dê peso máximo a essa evidência. Se houver várias fontes independentes atuais confirmando, aumente ainda mais a confiança.
8. Não transforme ausência de informação em contradição. “Não encontrei” = não confirmado/precisa checar, não = falso.
9. A confiança mede EXCLUSIVAMENTE a PAUTA PRINCIPAL, nunca a média de todos os dados encontrados.
10. Heurística: 95-100 = confirmação oficial direta + corroborada; 90-94 = confirmação direta forte por fonte oficial ou múltiplas fontes confiáveis; 75-89 = boa evidência mas falta confirmação relevante; 50-74 = evidência parcial; 20-49 = forte incerteza ou conflito direto; 0-19 = evidência forte de que a afirmação central está errada.

PRINCÍPIOS: Não invente fatos, fontes, URLs, declarações, números ou especialistas. Diferencie CONFIRMADO, ESTIMATIVA/PROJEÇÃO, NÃO CONFIRMADO e CONFLITO. Prefira fontes primárias e independentes. Se uma fonte for opinião, rumor ou agregador, deixe isso explícito. Não atribua declarações sem evidência. O jornalista deve validar as informações antes da publicação. Gere briefing e rascunho objetivos, sem linguagem promocional.

IMPORTANTE PARA ESPORTES: se a pauta disser que dois times se enfrentam atualmente, verifique o calendário/competição atual antes de consultar o histórico. Um jogo de 2023 não contradiz automaticamente um jogo de 2026. Data, fase, competição e local atuais são parte do fato principal.`;

function promptFor(body){
 const now=new Date().toISOString().slice(0,10);
 return `${editorial}

DATA ATUAL DO SISTEMA: ${now}

PAUTA:
Tema: ${body.topic}
Área: ${body.area||"Geral"}
Formato: ${body.format||"Notícia"}
Tom: ${body.tone||"Jornalístico, claro e objetivo"}
Informações/links fornecidos pelo usuário:
${body.sources||"(nenhum)"}

TAREFA DE APURAÇÃO:
1. Extraia a afirmação central da pauta em sua cabeça e verifique SOMENTE essa afirmação para definir primary_status e confidence.
2. Se pesquisa web estiver disponível, faça buscas atuais e específicas. Para esporte, procure o evento atual, a competição, fase, data e local; consulte primeiro a organização oficial/competição e depois pelo menos uma fonte jornalística independente quando possível.
3. Para cada informação encontrada, decida se ela é evidência direta, contexto secundário ou conflito direto.
4. NÃO deixe uma divergência histórica ou lateral reduzir a confiança da pauta principal.
5. No campo conflicts, inclua somente conflitos que contradigam diretamente a afirmação principal. Se houver apenas uma divergência de contexto, coloque-a em check ou unconfirmed e explique que ela não contradiz a pauta.
6. No campo primary_evidence, explique em 1-3 frases as evidências DIRETAS que confirmam ou enfraquecem a pauta.
7. O campo status pode resumir o conjunto da apuração, mas primary_status e confidence devem representar exclusivamente a pauta principal.
8. As URLs devem ser reais quando fornecidas pela pesquisa. Nunca invente URL.

Depois produza headline, subtítulo e lead APENAS como rascunhos coerentes com o grau de confirmação.`;
}

function isTransientError(error){
 const status=Number(error?.status||error?.statusCode||error?.code);
 const message=String(error?.message||error||"").toLowerCase();
 return [408,429,500,502,503,504].includes(status) ||
        /503|unavailable|overloaded|high demand|resource_exhausted|too many requests|rate limit|timed out|timeout/.test(message);
}

function modelList(){
 const primary=process.env.GEMINI_MODEL||"gemini-3.8-flash";
 const configured=(process.env.GEMINI_FALLBACK_MODELS||"gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash-lite")
  .split(",").map(x=>x.trim()).filter(Boolean);
 return [...new Set([primary,...configured])];
}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

async function generateWithRetry({contents,config={},search=true}){
 const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
 const models=modelList();
 let lastError=null;

 for(const model of models){
  for(let attempt=1;attempt<=3;attempt++){
   try{
    const finalConfig={...config};
    if(search) finalConfig.tools=[{googleSearch:{}}];
    const r=await ai.models.generateContent({model,contents,config:finalConfig});
    return {response:r,model};
   }catch(error){
    lastError=error;
    if(!isTransientError(error)) throw error;
    const wait=Math.min(8000,1000*Math.pow(2,attempt-1))+Math.floor(Math.random()*500);
    console.warn(`Gemini indisponível (${model}, tentativa ${attempt}/3). Nova tentativa em ${wait}ms.`);
    if(attempt<3) await sleep(wait);
   }
  }
  console.warn(`Modelo ${model} esgotou as tentativas; tentando modelo reserva.`);
 }
 throw lastError||new Error("Gemini indisponível no momento.");
}

async function callGemini(body,useSearch=true){
 const {response,model}=await generateWithRetry({
  contents:promptFor(body),
  config:{responseMimeType:"application/json",responseSchema:schema,temperature:0.2},
  search:useSearch
 });
 const data=JSON.parse(response.text);
 data.note=(data.note||"")+` Motor utilizado: ${model}.`;
 return data;
}

app.post("/api/analyze",async(req,res)=>{
 try{
  if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:"Chave GEMINI_API_KEY não configurada."});
  if(!req.body.topic?.trim()) return res.status(400).json({error:"Informe a pauta."});
  try{return res.json(await callGemini(req.body,true));}
  catch(searchError){
   console.warn("Pesquisa Google indisponível; tentando modo Gemini sem Search:",searchError.message);
   try{
    const data=await callGemini(req.body,false);
    data.note=(data.note||"")+" A pesquisa automática na web não ficou disponível nesta consulta; valide as fontes manualmente.";
    return res.json(data);
   }catch(finalError){
    throw finalError;
   }
  }
 }catch(e){
  console.error(e);
  const message=isTransientError(e)
   ? "O Gemini está temporariamente congestionado. Tente novamente em alguns segundos."
   : (e.message||"Erro no Gemini.");
  res.status(503).json({error:message});
 }
});

app.post("/api/write",async(req,res)=>{
 try{
  if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:"Chave GEMINI_API_KEY não configurada."});
  const text=`${editorial}
Transforme o briefing abaixo em um RASCUNHO jornalístico.
Não acrescente nenhum fato que não esteja no briefing.
Marque incertezas no próprio texto quando necessário.
Entregue: título, subtítulo, lead e corpo em parágrafos.
BRIEFING:
${JSON.stringify(req.body.briefing)}`;
  const {response}=await generateWithRetry({contents:text,config:{},search:false});
  res.json({text:response.text});
 }catch(e){
  console.error(e);
  const message=isTransientError(e)
   ? "O Gemini está temporariamente congestionado. Tente novamente em alguns segundos."
   : (e.message||"Erro ao redigir.");
  res.status(503).json({error:message});
 }
});

app.post("/api/factcheck",async(req,res)=>{
 try{
  if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:"Chave GEMINI_API_KEY não configurada."});
  const text=`${editorial}
Faça uma checagem editorial do texto abaixo.
Separe afirmações verificáveis, possíveis problemas, dados sem fonte, exageros e sugestões de correção.
Não declare uma afirmação falsa sem evidência.
TEXTO:
${req.body.text}`;
  const {response}=await generateWithRetry({contents:text,config:{},search:true});
  res.json({text:response.text});
 }catch(e){
  console.error(e);
  const message=isTransientError(e)
   ? "O Gemini está temporariamente congestionado. Tente novamente em alguns segundos."
   : (e.message||"Erro no fact-check.");
  res.status(503).json({error:message});
 }
});

app.get("/health",(req,res)=>res.json({ok:true,service:"Jornalista AI"}));
app.use((req,res)=>{
 if(req.method === "GET") return res.sendFile(path.join(__dirname,"index.html"));
 return res.status(404).json({error:"Rota não encontrada."});
});
const PORT=process.env.PORT||3000;
app.listen(PORT,"0.0.0.0",()=>console.log(`Jornalista AI online na porta ${PORT}`));
