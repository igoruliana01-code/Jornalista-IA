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
 required:["status","confidence","summary","confirmed","estimates","unconfirmed","conflicts","sources","hear","questions","check","angle","structure","headline","dek","lead","risks","note"]
};

const editorial=`Você é o Jornalista AI, um assistente de apuração para jornalistas.
PRINCÍPIOS:
- Não invente fatos, fontes, URLs, declarações, números ou especialistas.
- Diferencie CONFIRMADO, ESTIMATIVA/PROJEÇÃO, NÃO CONFIRMADO e CONFLITO.
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
As URLs devem ser reais quando fornecidas pela pesquisa. Nunca invente URL.`;
}

async function callGemini(body,useSearch=true){
 const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
 const config={responseMimeType:"application/json",responseSchema:schema,temperature:0.2};
 if(useSearch) config.tools=[{googleSearch:{}}];
 const r=await ai.models.generateContent({model:process.env.GEMINI_MODEL||"gemini-3.8-flash",contents:promptFor(body),config});
 return JSON.parse(r.text);
}

app.post("/api/analyze",async(req,res)=>{
 try{
  if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:"Chave GEMINI_API_KEY não configurada."});
  if(!req.body.topic?.trim()) return res.status(400).json({error:"Informe a pauta."});
  try{return res.json(await callGemini(req.body,true));}
  catch(searchError){
   console.warn("Pesquisa Google indisponível; tentando modo Gemini sem Search:",searchError.message);
   const data=await callGemini(req.body,false);
   data.note=(data.note||"")+" A pesquisa automática na web não ficou disponível nesta consulta; valide as fontes manualmente.";
   return res.json(data);
  }
 }catch(e){console.error(e);res.status(500).json({error:e.message||"Erro no Gemini."});}
});

app.post("/api/write",async(req,res)=>{
 try{
  if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:"Chave GEMINI_API_KEY não configurada."});
  const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
  const text=`${editorial}
Transforme o briefing abaixo em um RASCUNHO jornalístico.
Não acrescente nenhum fato que não esteja no briefing.
Marque incertezas no próprio texto quando necessário.
Entregue: título, subtítulo, lead e corpo em parágrafos.
BRIEFING:
${JSON.stringify(req.body.briefing)}`;
  const r=await ai.models.generateContent({model:process.env.GEMINI_MODEL||"gemini-3.8-flash",contents:text});
  res.json({text:r.text});
 }catch(e){res.status(500).json({error:e.message||"Erro ao redigir."});}
});

app.post("/api/factcheck",async(req,res)=>{
 try{
  if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:"Chave GEMINI_API_KEY não configurada."});
  const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
  const text=`${editorial}
Faça uma checagem editorial do texto abaixo.
Separe afirmações verificáveis, possíveis problemas, dados sem fonte, exageros e sugestões de correção.
Não declare uma afirmação falsa sem evidência.
TEXTO:
${req.body.text}`;
  const r=await ai.models.generateContent({model:process.env.GEMINI_MODEL||"gemini-3.8-flash",contents:text,config:{tools:[{googleSearch:{}}]}});
  res.json({text:r.text});
 }catch(e){res.status(500).json({error:e.message||"Erro no fact-check."});}
});

app.get("/health",(req,res)=>res.json({ok:true,service:"Jornalista AI"}));
app.use((req,res)=>{
  if(req.method === "GET") return res.sendFile(path.join(__dirname,"index.html"));
  return res.status(404).json({error:"Rota não encontrada."});
});
const PORT=process.env.PORT||3000;
app.listen(PORT,"0.0.0.0",()=>console.log(`Jornalista AI online na porta ${PORT}`));
