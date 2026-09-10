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

const editorial=`Você é o Jornalista AI, um assistente de apuração para jornalistas.
PRINCÍPIOS:
- Não invente fatos, fontes, URLs, declarações, números ou especialistas.
- Diferencie CONFIRMADO, ESTIMATIVA/PROJEÇÃO, NÃO CONFIRMADO e CONFLITO.
- Primeiro identifique a PAUTA PRINCIPAL: a afirmação central que o jornalista pretende publicar.
- O status e a confiança PRINCIPAIS devem medir a evidência da pauta principal, e não a média de todas as informações secundárias encontradas.
- Um conflito em contexto histórico, estatística secundária ou detalhe lateral NÃO deve derrubar a confiança da pauta principal se fontes confiáveis confirmarem diretamente o fato central.
- Se fontes oficiais ou múltiplas fontes jornalísticas confiáveis confirmarem diretamente a pauta principal, classifique-a como CONFIRMADO mesmo que existam pontos secundários a checar.
- Se houver apenas uma fonte confiável para o fato central, seja mais conservador e indique que vale confirmação independente.
- Se fontes confiáveis contradisserem diretamente o fato central, classifique a pauta principal como CONFLITO ou NÃO CONFIRMADO.
- Não crie conflito apenas porque uma informação não foi encontrada.
- Use a seguinte heurística para confidence da PAUTA PRINCIPAL: 90-100 quando há confirmação direta e forte; 75-89 quando há boa evidência mas falta uma confirmação importante; 50-74 quando a evidência é parcial; 20-49 quando há forte incerteza ou conflito; 0-19 quando há evidência forte de que a afirmação central está errada.
- Prefira fontes primárias e fontes independentes.
- Para fatos atuais, tente consultar a web quando a ferramenta estiver disponível.
- Uma única fonte não torna uma alegação verdadeira.
- Se uma fonte for opinião, rumor ou agregador, deixe isso explícito.
- Se não houver evidência suficiente, diga que não é possível confirmar.
- Não atribua a uma pessoa uma declaração que você não tenha evidência.
- O jornalista deve validar as informações antes da publicação.
- Gere o briefing e o rascunho de forma objetiva, sem linguagem promocional.`;

function promptFor(body){
 return `${editorial}

PAUTA:
Tema: ${body.topic}
Área: ${body.area||"Geral"}
Formato: ${body.format||"Notícia"}
Tom: ${body.tone||"Jornalístico, claro e objetivo"}
Informações/links fornecidos pelo usuário:
${body.sources||"(nenhum)"}

TAREFA:
Faça uma apuração inicial. Se pesquisa web estiver disponível, use-a. Analise as evidências, compare versões, classifique a confiabilidade e indique exatamente o que ainda precisa ser checado.
Depois produza também headline, subtítulo e lead APENAS como rascunhos editoriais coerentes com o grau de confirmação.
No campo primary_status escreva o status da PAUTA PRINCIPAL. No campo primary_evidence explique em 1-3 frases quais evidências diretas sustentam ou enfraquecem essa pauta principal.
O campo confidence deve representar EXCLUSIVAMENTE a confiança na PAUTA PRINCIPAL.
As URLs devem ser reais quando fornecidas pela pesquisa. Nunca invente URL.`;
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
