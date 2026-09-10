const $=s=>document.querySelector(s);let briefing=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const list=a=>(a||[]).map(x=>`<li>${esc(x)}</li>`).join("")||"<li>—</li>";
function toast(t){const x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),9000)}
function showError(t){toast(t); const box=$("#results"); if(box){box.classList.remove("hidden"); box.innerHTML=`<div class="card error-card"><div class="state-head"><span class="state-icon">⚠️</span><div><h2>Apuração não concluída</h2><p>${esc(t)}</p></div></div><div class="status-strip"><span>🌐 Busca externa</span><b class="ok-text">Disponível</b><span>🧠 Análise IA</span><b class="warn-text">Não concluída</b></div><p class="muted"><b>Importante:</b> isso não significa que a pauta esteja falsa. O problema é técnico/temporário na etapa de análise.</p></div>`;}}
function tab(id){document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));$("#"+id).classList.add("active");document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.tab===id));window.scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>tab(n.dataset.tab));
function mh(icon,title){return `<div class="mini-head"><div class="mini-icon">${icon}</div><h3>${title}</h3></div>`}
function statusClass(s){s=String(s||"").toUpperCase();return /CONFLITO/.test(s)?"danger":/NÃO|NAO/.test(s)?"warn":"ok"}
function cleanSourceWhy(text){
 let t=String(text||"").replace(/https?:\/\/[^\s<]+/gi,"").replace(/www\.[^\s<]+/gi,"");
 t=t.replace(/Encontrada na busca externa\s*\([^)]*\)\.?/gi,"Resultado encontrado na pesquisa externa.");
 t=t.replace(/Resultado encontrado por [^.]+\.?/gi,"Resultado encontrado na pesquisa externa.");
 t=t.replace(/\s{2,}/g," ").replace(/\s+([,.])/g,"$1").trim();
 return t || "Resultado encontrado na pesquisa externa.";
}
function sourceHtml(s){
 const host=esc(s.domain||(()=>{try{return new URL(s.url).hostname.replace(/^www\./,"")}catch{return "fonte"}})());
 const date=esc(s.date||"Data não informada");
 const tier=esc(s.tier||"Fonte");
 const why=esc(cleanSourceWhy(s.why));
 return `<div class="source-line"><div class="source-top"><div class="source-title"><b>${esc(s.title||"Fonte sem título")}</b><div class="source-meta"><span>${host}</span><span>•</span><span>${date}</span></div></div><span class="tier-badge">${tier}</span></div><p>${why}</p><a class="source-link" href="${esc(s.url||"#")}" target="_blank" rel="noopener noreferrer">Abrir matéria ↗</a></div>`;
}
function sourceList(sources){return (sources||[]).slice(0,8).map(sourceHtml).join("")||"<p class=\"muted\">Nenhuma fonte retornada.</p>";}
function render(d){
 briefing=d;
 if(d.partial){
   const sources=sourceList(d.sources);
   $("#dashboard-empty").classList.add("hidden"); $("#results").classList.remove("hidden");
   $("#results").innerHTML=`<div class="card error-card"><div class="state-head"><span class="state-icon">⚠️</span><div><h2>Pesquisa concluída · análise da IA indisponível</h2><p>${esc(d.note||"O Gemini não conseguiu concluir a análise.")}</p></div></div><div class="status-strip"><span>🌐 Busca externa</span><b class="ok-text">✓ Concluída</b><span>🧠 Gemini</span><b class="warn-text">Temporariamente indisponível</b></div><p><b>Boa notícia:</b> encontramos as fontes. Elas continuam disponíveis para revisão humana.</p><div class="mini-head"><h3>Fontes encontradas</h3></div>${sources}<div class="quota-note">💡 Se o motivo for cota da API, não adianta repetir várias vezes seguidas. O sistema aplicará um intervalo curto antes da próxima tentativa.</div></div>`;
   return;
 }
$("#dashboard-empty").classList.add("hidden");$("#results").classList.remove("hidden");const c=Math.max(0,Math.min(100,Number(d.confidence)||0));const st=d.primary_status||d.status||"—";
 const sources=sourceList(d.sources);
 const cards=`<div class="result-title"><div><h2>2. Resultados da Apuração</h2><p>Apuração em camadas: fato principal, evidências, contexto e conflitos reais.</p></div><span class="pill">● Pauta analisada</span></div>
 <div class="cards"><article class="card mini">${mh("♢","Radar de Confiabilidade da Pauta")}<div class="confidence"><div class="donut" style="--p:${c}"><b>${c}%</b></div><div class="legend"><strong class="status-badge ${statusClass(st)}">${esc(st)}</strong><div><i class="dot green-dot"></i>Confirmados ${d.confirmed?.length||0}</div><div><i class="dot yellow-dot"></i>Estimativas ${d.estimates?.length||0}</div><div><i class="dot red-dot"></i>Não confirmados ${d.unconfirmed?.length||0}</div><div><i class="dot red-dot"></i>Conflitos diretos ${d.conflicts?.length||0}</div></div></div><p><b>Evidência principal:</b> ${esc(d.primary_evidence||"—")}</p><p>${esc(d.summary)}</p></article>
 <article class="card mini">${mh("✓","Evidências Diretas")}<ul>${list(d.direct_evidence)}</ul><div class="section-label">Qualidade das fontes</div><p>${esc(d.source_quality||"—")}</p></article>
 <article class="card mini">${mh("▥","Dados Importantes")}<div class="data-line">◉ <div><span>Headline</span><b>${esc(d.headline||"—")}</b></div></div><div class="data-line">◉ <div><span>Status editorial</span><b>${esc(st)}</b></div></div><div class="data-line">◉ <div><span>Confiança</span><b>${c}%</b></div></div></article></div>
 <div class="wide-grid"><article class="card mini purple-card">${mh("↗","Principais Fontes")}${sources}</article><article class="card mini yellow-card">${mh("◇","Contexto — não confundir com conflito")}<ul>${list(d.context_evidence)}</ul></article><article class="card mini green-card">${mh("⚠","Conflitos Reais")}${d.contradiction_evidence?.length?`<ul>${list(d.contradiction_evidence)}</ul>`:`<p>🟢 Nenhuma contradição direta identificada.</p>`}</article></div>
 <div class="bottom-grid"><article class="card">${mh("🧪","Teste de Sanidade")}<ul>${list(d.sanity_check)}</ul><div class="notice">O radar considera a pauta principal, não detalhes históricos isolados.</div></article><article class="card">${mh("◎","Melhor Ângulo Jornalístico")}<p>${esc(d.angle)}</p><button class="linkbtn" id="goWrite">Ver ângulo completo →</button></article></div>
 <div class="bottom-grid"><article class="card">${mh("▤","Estrutura Sugerida da Matéria")}<ol class="number-list">${list(d.structure)}</ol></article><article class="card risk">${mh("⚠","Riscos e Observações")}<ul>${list(d.risks)}</ul><div class="notice">💡 Busca externa + Gemini gratuito. O Jornalista AI é um assistente de apuração; a decisão editorial final é sempre sua.</div></article></div>
 <div class="actions"><div>▣ <b>Apuração pronta para revisão</b><small>O rascunho respeitará o grau de confirmação das informações.</small></div><button id="copy">Copiar briefing →</button><button id="writeNow">Gerar rascunho da matéria →</button></div>`;
 $("#results").innerHTML=cards;$("#apurarContent").innerHTML=cards;$("#write").disabled=false;
 document.querySelectorAll("#copy").forEach(b=>b.onclick=()=>{navigator.clipboard?.writeText(JSON.stringify(d,null,2));toast("Briefing copiado")});
 document.querySelectorAll("#goWrite,#writeNow").forEach(b=>b.onclick=()=>{tab("redacao");setTimeout(()=>$("#write")?.click(),100)});
}
function setRetryCooldown(seconds=60){
 const btn=$("#analyze"); let left=seconds; const original="⌕  Pesquisar e Apurar  →";
 btn.disabled=true;
 const timer=setInterval(()=>{left--; btn.textContent=`↻ Tente novamente em ${left}s`; if(left<=0){clearInterval(timer);btn.disabled=false;btn.textContent=original;}},1000);
}
$("#analyze").onclick=async()=>{const topic=$("#topic").value.trim();if(!topic)return toast("Digite o tema da pauta.");const btn=$("#analyze");btn.disabled=true;btn.textContent="⟳  APURANDO EM CAMADAS…";let cooldown=false;try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);const r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,area:$("#area").value,format:$("#format").value,sources:$("#sources").value}),signal:controller.signal});clearTimeout(timer);const d=await r.json();if(!r.ok)throw Error(d.error||"O servidor não conseguiu concluir a apuração.");render(d);if(d.partial&&/cota|quota|429|limite|resource_exhausted/i.test(d.note||"")){cooldown=true;setRetryCooldown(60)}}catch(e){showError(e.name==="AbortError"?"A apuração demorou mais de 45 segundos. A busca externa pode estar lenta ou a IA pode estar sem cota.":e.message);if(/cota|quota|429|limite|resource_exhausted/i.test(e.message||"")){cooldown=true;setRetryCooldown(60)}}finally{if(!cooldown){btn.disabled=false;btn.textContent="⌕  Pesquisar e Apurar  →"}}};

$("#write").onclick=async()=>{if(!briefing)return;$("#write").disabled=true;$("#draft").textContent="Gerando rascunho com as regras da apuração…";try{const r=await fetch("/api/write",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({briefing})});const d=await r.json();if(!r.ok)throw Error(d.error);$("#draft").textContent=d.text;tab("redacao")}catch(e){toast(e.message)}finally{$("#write").disabled=false}};
$("#factBtn").onclick=async()=>{const text=$("#factText").value.trim();if(!text)return toast("Cole um texto para checar.");$("#factBtn").disabled=true;$("#factOut").textContent="Checando afirmação por afirmação…";try{const r=await fetch("/api/factcheck",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});const d=await r.json();if(!r.ok)throw Error(d.error);$("#factOut").textContent=d.text}catch(e){toast(e.message)}finally{$("#factBtn").disabled=false}};
