/* PRISMA — Kanban setorial (CRM). Dados locais via IndexedDB; para colaboração real é necessário backend.
   A chave imutável é Protocolo + Num. Ocorrência. Importações NÃO sobrescrevem tratativas.

   v2 (pedido do autor, 18/11/2026):
   - visual mais limpo: filtros e sincronização numa linha, cartão com o prazo em destaque,
     mais urgentes primeiro, atrasos no cabeçalho da coluna, "Concluído" recolhível;
   - andamento: cartão parado, borda de atraso em qualquer coluna, observação obrigatória
     para "Precisando de ajuda" e "Concluído", filtro por responsável, transferência recolhida;
   - coluna nova "Muito importante": só a Triagem coloca cartões nela;
   - Triagem: enxerga todos os setores e cria protocolo próprio (PRISMA-AAAA-NNNN).
   Por enquanto a Triagem fica aberta a todos; a trava por perfil entra com o login do Supabase.

   v3 (pedido do autor, 20/11/2026): os cartões ficam no banco (Supabase) e todos veem os mesmos.
   - o relatório é importado só pelo gestor/admin, na visão Triagem (ou na Inteligência de Rede);
     cada importação troca o relatório: protocolos que saíram da planilha somem, os que continuam
     mantêm a tratativa, e os protocolos PRISMA nunca são mexidos;
   - o colaborador só vê os setores dele; a Triagem (todos os setores) é do gestor/admin;
   - entrou o CPF do beneficiário (coluna "CPF Beneficiário"), também na busca;
   - sem o banco configurado, continua tudo no IndexedDB deste navegador, como antes. */
(()=>{'use strict';
const SETORES=['ADM/PAT','Reembolso','Credenciamento','Auditoria','Cadastro','Captação','Financeiro','Triagem'];
/* ordem pedida pelo autor (18/11/2026): os três automáticos do prazo, depois "Muito importante" */
const ETAPAS=[['entrada','Todos que entraram'],['atencao','Em atenção'],['atraso','Atraso'],['importante','Muito importante'],['interno','Em andamento interno'],['externo','Em andamento externo'],['ajuda','Precisando de ajuda'],['concluido','Concluído']];
/* colunas que pedem uma observação para o cartão entrar (assim o histórico explica o porquê) */
const EXIGE_NOTA=['ajuda','concluido'];
/* nome do banco local trocado para "prisma_kanban" em 20/11/2026 (o antigo, com os testes, é apagado pela Visão geral) */
const DB='prisma_kanban', VERSION=1;const $=id=>document.getElementById(id);
/* banco compartilhado (base-relatorio.js); "gestao" = gestor ou admin, os únicos que veem a Triagem e importam */
const R=window.PrismaRelatorio, banco=!!(R&&R.configurado);
let gestao=!banco, linhasPorChave=new Map(), importando=false;
/* com o banco, o botão de importar só aparece depois de conferir o papel da pessoa */
if(banco){const b=document.querySelector('label[for="arquivo"]');if(b)b.style.display='none';}
const SETORES_SLUG={'adm-pat':'ADM/PAT','reembolso':'Reembolso','credenciamento':'Credenciamento','auditoria':'Auditoria','cadastro':'Cadastro','captacao':'Captação','financeiro':'Financeiro','triagem':'Triagem'};
const setorParametro=new URLSearchParams(location.search).get('setor');
if (setorParametro && SETORES_SLUG[setorParametro]) $('setor').value=SETORES_SLUG[setorParametro];
$('setor').closest('.sector-label').hidden=!!(setorParametro && SETORES_SLUG[setorParametro]);
/* CRM (pedido do autor, 18/11/2026): aberto pelo menu sem setor, o quadro começa vazio
   e o colaborador escolhe o setor dele no filtro "Setor" para ver os cartões */
if (!setorParametro || !SETORES_SLUG[setorParametro]) { const escolha=new Option('Escolha o setor',''); escolha.disabled=true; $('setor').prepend(escolha); $('setor').value=''; }
let db, itens=[], ultimaImportacao=null, setor=$('setor').value, ativo=null, paginaPorColuna={};

/* "Concluído" começa recolhido para as outras colunas caberem; lembro a escolha só neste navegador */
let concluidoAberto=false;
try{concluidoAberto=localStorage.getItem('prisma-kanban-concluido')==='1';}catch(_){/* sem armazenamento, segue recolhido */}

function setorAtual(item){return item.setor||'Triagem';}
const ehTriagem=()=>setor==='Triagem';
const nomeEtapa=id=>ETAPAS.find(x=>x[0]===id)?.[1]||id;
function norm(v){return String(v??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function texto(v){return v===null||v===undefined?'':String(v).trim();}
function pick(obj,...nomes){for(const n of nomes){const k=Object.keys(obj).find(x=>norm(x)===norm(n));if(k&&obj[k]!==null&&obj[k]!==undefined&&obj[k]!=='')return obj[k];}return '';}
function dataISO(v){if(v instanceof Date&&!Number.isNaN(v.valueOf()))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;if(typeof v==='number'&&window.XLSX){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}const s=texto(v);if(/^\d{4}-\d\d-\d\d/.test(s))return s.slice(0,10);const m=s.match(/^(\d\d?)\/(\d\d?)\/(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';}
function diaBR(s){if(!s)return 'Não informado';const [a,m,d]=s.split('-');return `${d}/${m}/${a}`;}
function diasUteis(iso){if(!iso)return 0;const d=new Date(`${iso}T12:00:00`),fim=new Date();fim.setHours(12,0,0,0);if(Number.isNaN(d.valueOf())||d>fim)return 0;let n=0;for(let i=0;d<fim&&i<12000;i++){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6)n++;}return n;}
function setorOrigem(r){const d=norm([pick(r,'Desc Departamento','DESCRICAO_DEPARTAMENTO'),pick(r,'Desc Sub Departamento'),pick(r,'Desc Assunto','DESCRICAO_ASSUNTO'),pick(r,'Desc GRP Ocorrência','DESCRICAO_GRP_OCORRENCIA'),pick(r,'Desc Ocorrência','DESCRICAO_OCORRENCIA')].join(' '));if(/reembolso/.test(d))return 'Reembolso';if(/credenc|redecredenciada|prestador|hospital/.test(d))return 'Credenciamento';if(/auditoria|autorizacao|procedimentomedico|quimioterap|regulacao|coberturaassistencial/.test(d))return 'Auditoria';if(/captacao|adesao|prospect|novobeneficiario/.test(d))return 'Captação';if(/cadastro|inclusao|exclusao|alteracaodedados|migracao/.test(d))return 'Cadastro';if(/financeiro|inadimpl|pagamento|cobranca|negociacaodedivida|boleto|mensalidade/.test(d))return 'Financeiro';if(/patrimonio|administrativ|almoxarifado/.test(d))return 'ADM/PAT';return '';}
function extrair(r){const protocolo=texto(pick(r,'Protocolo','PROTOCOLO_ANS'));const ocorrencia=texto(pick(r,'Num. Ocorrência','NUMERO_OCORRENCIA'));if(!protocolo||!ocorrencia)return null;const chave=JSON.stringify([protocolo,ocorrencia]);const canal=texto(pick(r,'Canal','DESC_COMUNICACAO','Comunicação'));const status=texto(pick(r,'Status Ocorrência','STATUS_OCORRENCIA'));return {chave,protocolo,ocorrencia,setor:setorOrigem(r),assunto:texto(pick(r,'Desc Assunto','DESCRICAO_ASSUNTO')),grupo:texto(pick(r,'Desc GRP Ocorrência','DESCRICAO_GRP_OCORRENCIA')),descricao:texto(pick(r,'Desc Ocorrência','DESCRICAO_OCORRENCIA')),abertura:dataISO(pick(r,'Data Abertura Ocorrência','DATA_ABERTURA_OCORRENCIA')),encerramento:dataISO(pick(r,'Data Encerramento Ocorrência','DATA_ENCERRAMENTO_OCORRENCIA')),status,canal,reclameAqui:/reclameaqui/.test(norm(canal)),beneficiario:texto(pick(r,'Nome Beneficiário','NOME_BENEFICIARIO')),cpf:texto(pick(r,'CPF Beneficiário','CPF_BENEFICIARIO','CPF')),email:texto(pick(r,'E-mail','Email','EMAIL')),observacaoAbertura:texto(pick(r,'Observação de Abertura','OBS_ABERTURA','Observação Abertura')),observacaoEncerramento:texto(pick(r,'Observação de Encerramento','OBS_ENCERRAMENTO','Observação Encerramento')),origemSLA:texto(pick(r,'Status SLA','STATUS_SLA')),dataPrevisao:dataISO(pick(r,'Data Previsão SLA','DATA_PREVISAO_SLA'))};}
function abrirDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('cartoes'))d.createObjectStore('cartoes',{keyPath:'chave'});if(!d.objectStoreNames.contains('config'))d.createObjectStore('config',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function trans(store,modo,fn){return new Promise((resolve,reject)=>{const t=db.transaction(store,modo),s=t.objectStore(store);let result;t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);fn(s,v=>{result=v;});});}
function todos(){return trans('cartoes','readonly',(s,set)=>{const q=s.getAll();q.onsuccess=()=>set(q.result);});}
function lerConfig(id){return trans('config','readonly',(s,set)=>{const q=s.get(id);q.onsuccess=()=>set(q.result?.valor||null);});}
function gravarConfig(id,valor){return trans('config','readwrite',s=>s.put({id,valor}));}
const config=()=>lerConfig('ultima');
const guardarConfig=valor=>gravarConfig('ultima',valor);
/* no banco só vai o trabalho da equipe; os dados do protocolo vêm do relatório salvo */
async function guardarCartao(item){
 if(!banco)return trans('cartoes','readwrite',s=>s.put(item));
 const {error}=await R.cliente().rpc('crm_salvar',{p_chave:item.chave,p_setor:setorAtual(item),p_trabalho:{tratativa:item.tratativa||null,prioridade:item.prioridade||null,transferidoDe:item.transferidoDe||null}});
 if(error)throw new Error(error.message||'O banco recusou a alteração.');
}
function mensagem(s){$('mensagem').textContent=s;}
/* erro do banco (ex.: protocolo saiu na última importação) aparece junto da mensagem */
function falha(txt,e){console.error(e);mensagem(banco&&e&&e.message?`${txt} ${e.message}`:txt);}

/* ---- banco: junta o cartão (setor + trabalho) com a linha da planilha ---- */
function montarItem(c){
 const t=c.trabalho||{};let base;
 if(c.origem==='prisma')base={...(c.dados||{}),origem:'prisma'};
 else{const linha=linhasPorChave.get(c.chave);base=(linha&&extrair(linha))||(()=>{let p=[c.protocolo,''];try{p=JSON.parse(c.chave);}catch(_){/* chave fora do padrão */}return {protocolo:p[0]||c.protocolo,ocorrencia:p[1]||'',assunto:'',grupo:'',descricao:'',abertura:'',encerramento:'',status:'',canal:'',reclameAqui:false,beneficiario:'',cpf:'',email:'',observacaoAbertura:'',observacaoEncerramento:'',origemSLA:'',dataPrevisao:''};})();}
 return {...base,chave:c.chave,protocolo:base.protocolo||c.protocolo,setor:c.setor,transferidoDe:t.transferidoDe||undefined,prioridade:t.prioridade||null,tratativa:t.tratativa||undefined};
}
function importacaoDoBanco(u){return u?{em:u.em,arquivo:u.arquivo,por:u.por_nome,linhas:u.linhas,novos:u.novos,atualizados:u.atualizados,removidos:u.removidos,total:u.cartoes}:null;}
async function carregarDoBanco(){
 const [cartoes,linhas,ult]=await Promise.all([R.carregarCartoes(),R.carregarLinhasComChave(),R.ultimaImportacao()]);
 linhasPorChave=new Map();
 for(const l of linhas)if(l.chave&&!linhasPorChave.has(l.chave))linhasPorChave.set(l.chave,l.linha);
 itens=cartoes.map(montarItem);ultimaImportacao=importacaoDoBanco(ult);
}
/* antes de mexer num cartão eu pego a versão mais nova (outra pessoa pode ter mexido) */
async function recarregarCartao(chave){
 if(!banco)return itens.find(x=>x.chave===chave);
 const sb=R.cliente();
 const {data,error}=await sb.from('crm_cartoes').select('chave, protocolo, origem, setor, dados, trabalho').eq('chave',chave).maybeSingle();
 if(error)throw error;
 if(!data){itens=itens.filter(x=>x.chave!==chave);return null;}
 if(data.origem==='planilha'&&!linhasPorChave.has(chave)){const {data:l}=await sb.from('relatorio_linhas').select('linha').eq('chave',chave).order('ordem').limit(1);if(l&&l[0])linhasPorChave.set(chave,l[0].linha);}
 const novo=montarItem(data);const i=itens.findIndex(x=>x.chave===chave);
 if(i>=0)itens[i]=novo;else itens.push(novo);
 return novo;
}
async function cartaoAtual(chave){const item=await recarregarCartao(chave);if(!item)mensagem('Este protocolo não está mais no quadro (pode ter saído na última importação).');return item;}
function estaFechado(item){return /encerrad|concluid|finalizad/.test(norm(item.status));}
function prazo(item){const dias=diasUteis(item.abertura);const excecao7=/quimioterapicooral/.test(norm(item.descricao))&&/medicament/.test(norm(item.grupo));const excecao3=/coberturaparaacompanhante/.test(norm(item.descricao));const limite=excecao7?7:excecao3?3:5;return {dias,limite,atraso:dias>limite,atencao:!excecao7&&!excecao3&&dias>=4&&dias<=5};}
function etapa(item){if(item.tratativa?.etapa)return item.tratativa.etapa;if(estaFechado(item))return 'concluido';const p=prazo(item);return p.atraso?'atraso':p.atencao?'atencao':'entrada';}
function esc(v){return texto(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const responsavelDe=x=>x.tratativa?.responsavel||'';

/* dias úteis desde a última tratativa; só conto quando alguém já mexeu no cartão
   (sem histórico, o selo de prazo já mostra há quanto tempo ele está aberto) */
function diasParado(item){const h=item.tratativa?.historico;if(!h||!h.length)return 0;return diasUteis(dataISO(new Date(h[h.length-1].em)));}

/* ---- filtros ---- */
/* a Triagem enxerga todos os setores (com o filtro "Setor do protocolo"); os outros, só o próprio */
function noQuadro(x){if(!setor)return false;if(ehTriagem()){const fs=$('filtroSetor').value;return !fs||setorAtual(x)===fs;}return setorAtual(x)===setor;}
function filtrados(){const termo=norm($('busca').value),inicio=$('inicio').value,fim=$('fim').value,a=$('assunto').value,o=$('origem').value,r=$('filtroResponsavel').value;return itens.filter(x=>noQuadro(x)&&(!inicio||x.abertura>=inicio)&&(!fim||x.abertura<=fim)&&(!a||x.assunto===a)&&(!o||x.canal===o)&&(!r||(r==='__sem'?!responsavelDe(x):responsavelDe(x)===r))&&(!termo||norm([x.protocolo,x.ocorrencia,x.beneficiario,x.cpf,x.assunto,x.descricao,x.email].join(' ')).includes(termo)));}
function preencher(select,opcoes,primeira){const valor=select.value;select.replaceChildren(new Option(primeira,''),...opcoes.map(([v,t])=>new Option(t,v)));select.value=[...select.options].some(op=>op.value===valor)?valor:'';}
const ordenarTexto=lista=>[...new Set(lista.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
function atualizarFiltros(){
 const base=ehTriagem()?itens:itens.filter(x=>setorAtual(x)===setor);
 preencher($('assunto'),ordenarTexto(base.map(x=>x.assunto)).map(v=>[v,v]),'Todos');
 preencher($('origem'),ordenarTexto(base.map(x=>x.canal)).map(v=>[v,v]),'Todas');
 const nomes=ordenarTexto(base.map(responsavelDe));
 preencher($('filtroResponsavel'),[...nomes.map(v=>[v,v]),['__sem','Sem responsável']],'Todos');
 preencher($('filtroSetor'),SETORES.map(s=>[s,s]),'Todos os setores');
 $('listaResponsaveis').replaceChildren(...ordenarTexto(itens.map(responsavelDe)).map(v=>new Option(v)));
 /* coisas que só existem na Triagem */
 $('rotuloFiltroSetor').hidden=!ehTriagem();
 $('novoProtocolo').hidden=!ehTriagem();
 /* importar o relatório: só na visão Triagem e só para o gestor/admin (os setores não importam mais) */
 const botaoImportar=document.querySelector('label[for="arquivo"]');
 if(botaoImportar)botaoImportar.style.display=ehTriagem()&&gestao?'':'none';
 $('tituloKanban').textContent=ehTriagem()?'Triagem · todos os setores':setor?`Kanban · ${setor}`:'Kanban de tratativas';
}

/* ---- quadro ---- */
function montarCartao(item,{p,e}){
 const card=document.createElement('button');card.type='button';
 const concluido=e==='concluido';
 const estado=concluido?'':p.atraso?'late':p.atencao?'warn':'';
 card.className='case'+(estado?` ${estado}`:'')+(item.prioridade&&!concluido?' prioritario':'');
 card.draggable=true;card.dataset.chave=item.chave;
 const dias=`${p.dias} ${p.dias===1?'dia útil':'dias úteis'}`;
 const sla=concluido?'<span class="sla done">Concluído</span>':`<span class="sla ${estado}">${dias}</span>`;
 const parado=concluido?0:diasParado(item);
 const etiquetas=[
  ehTriagem()?`<span class="tag-setor">${esc(setorAtual(item))}</span>`:'',
  item.transferidoDe?`<span class="transfer-tag">↗ de ${esc(item.transferidoDe)}</span>`:'',
  parado>=3?`<span class="parado" title="Sem movimentação desde a última tratativa">⏸ parado há ${parado} dias</span>`:'',
  responsavelDe(item)?`<span class="resp" title="Responsável">● ${esc(responsavelDe(item))}</span>`:''
 ].join('');
 card.innerHTML=`<div class="case-top">${sla}<span class="tag">${esc(item.canal||'CRM')}</span></div>`+
  (item.prioridade&&!concluido?'<div class="selo-importante">★ Muito importante</div>':'')+
  `<div class="case-subject">${esc(item.assunto||item.descricao||'Sem assunto')}</div>`+
  `<div class="case-benef">♙ ${esc(item.beneficiario||'Beneficiário não informado')}</div>`+
  `<div class="case-meta"><span>${esc(item.protocolo)}</span><span>${esc(diaBR(item.abertura))}</span></div>`+
  (etiquetas?`<div class="case-tags">${etiquetas}</div>`:'');
 card.addEventListener('click',()=>abrirModal(item.chave));
 card.addEventListener('dragstart',ev=>{ev.dataTransfer.setData('text/plain',item.chave);ev.dataTransfer.effectAllowed='move';});
 return card;
}

function alternarConcluido(){concluidoAberto=!concluidoAberto;try{localStorage.setItem('prisma-kanban-concluido',concluidoAberto?'1':'0');}catch(_){/* segue sem lembrar */}render();}

function render(){
 const base=filtrados();
 const info=new Map(base.map(x=>[x.chave,{p:prazo(x),e:etapa(x)}]));
 const board=$('board');board.replaceChildren();
 board.style.setProperty('--fim',concluidoAberto?'minmax(150px,1fr)':'54px');
 ETAPAS.forEach(([id,nome])=>{
  const grupo=base.filter(x=>info.get(x.chave).e===id);
  /* mais urgentes primeiro; nos concluídos, os mais recentes primeiro */
  if(id==='concluido')grupo.sort((a,b)=>(b.abertura||'').localeCompare(a.abertura||''));
  else grupo.sort((a,b)=>info.get(b.chave).p.dias-info.get(a.chave).p.dias);
  const col=document.createElement('section');col.className=`column ${id}`;col.dataset.etapa=id;
  const recolhida=id==='concluido'&&!concluidoAberto;
  const total=grupo.length.toLocaleString('pt-BR');
  if(recolhida){
   col.classList.add('recolhida');
   const botao=document.createElement('button');botao.type='button';botao.className='column-head abrir-concluido';
   botao.title='Mostrar os concluídos';botao.setAttribute('aria-label',`Mostrar Concluído (${total})`);
   botao.innerHTML=`<span class="conta">${total}</span><strong>Concluído</strong>`;
   botao.onclick=alternarConcluido;col.append(botao);
  }else{
   const atrasos=id!=='atraso'&&id!=='concluido'?grupo.filter(x=>info.get(x.chave).p.atraso).length:0;
   const head=document.createElement('div');head.className='column-head';
   /* nome em cima (até 2 linhas) e o total com os atrasos numa linha só embaixo: todos os cabeçalhos ficam da mesma altura */
   head.innerHTML=`<strong>${id==='importante'?'★ ':''}${esc(nome)}</strong><div class="linha-conta"><span class="conta">${total}</span>${atrasos?`<small class="conta-atraso">${atrasos} em atraso</small>`:''}</div>`;
   if(id==='concluido'){const fechar=document.createElement('button');fechar.type='button';fechar.className='recolher';fechar.title='Recolher os concluídos';fechar.textContent='‹ recolher';fechar.onclick=alternarConcluido;head.append(fechar);}
   col.append(head);
   const cards=document.createElement('div');cards.className='cards';
   const limite=(paginaPorColuna[id]||1)*15;
   grupo.slice(0,limite).forEach(item=>cards.append(montarCartao(item,info.get(item.chave))));
   if(!grupo.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=!setor?'Escolha o setor no filtro acima':id==='importante'?'Nada priorizado pela Triagem':'Nenhum protocolo nesta coluna';cards.append(empty);}
   col.append(cards);
   if(grupo.length>limite){const more=document.createElement('button');more.className='more';more.textContent=`Ver mais (${grupo.length-limite} restantes)`;more.onclick=()=>{paginaPorColuna[id]=(paginaPorColuna[id]||1)+1;render();};col.append(more);}
  }
  col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drop-target');});
  col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('drop-target');});
  col.addEventListener('drop',async e=>{e.preventDefault();col.classList.remove('drop-target');const chave=e.dataTransfer.getData('text/plain');if(chave)await mudarEtapa(chave,id);});
  board.append(col);
 });
}

/* ---- janela de detalhes ---- */
function detalhe(nome,valor){const el=document.createElement('div');el.className='detail';el.innerHTML=`<span class="key">${esc(nome)}</span><span class="value">${esc(valor||'Não informado')}</span>`;return el;}
function mostrarHistorico(item){const h=$('historico');h.replaceChildren();const historico=item.tratativa?.historico||[];if(!historico.length){h.textContent='Nenhuma tratativa registrada.';return;}historico.slice().reverse().forEach(entry=>{const row=document.createElement('div');row.className='history-row';row.textContent=`${new Date(entry.em).toLocaleString('pt-BR')} · ${entry.acao}${entry.responsavel?' · '+entry.responsavel:''}${entry.nota?'\n'+entry.nota:''}`;h.append(row);});}
function marcarNotaObrigatoria(){const item=itens.find(x=>x.chave===ativo);const alvo=$('etapa').value;$('notaObrigatoria').hidden=!(item&&EXIGE_NOTA.includes(alvo)&&etapa(item)!==alvo);}
function abrirModal(chave,opcoes={}){
 const item=itens.find(x=>x.chave===chave);if(!item)return;ativo=chave;
 const prisma=item.origem==='prisma';
 $('modalOrigem').textContent=prisma?'PROTOCOLO PRISMA · CRIADO PELA TRIAGEM':'DETALHES DA OCORRÊNCIA';
 $('modalTitulo').textContent=prisma?item.protocolo:`${item.protocolo} · Ocorrência ${item.ocorrencia}`;
 const detalhes=$('detalhes');detalhes.replaceChildren();
 const linhas=prisma
  ?[['Protocolo PRISMA',item.protocolo],['Protocolo ANS relacionado',item.protocoloAns],['Beneficiário',item.beneficiario],['Setor',setorAtual(item)],['Criado em',diaBR(item.abertura)],['Situação',item.status]]
  :[['Protocolo',item.protocolo],['Reclame Aqui',item.reclameAqui?'Sim':'Não'],['Beneficiário',item.beneficiario],['CPF Beneficiário',item.cpf],['E-mail',item.email],['Setor',setorAtual(item)],['Ocorrência',item.ocorrencia],['Data da abertura',diaBR(item.abertura)],['Status da ocorrência',item.status]];
 linhas.forEach(([a,b])=>detalhes.append(detalhe(a,b)));
 const obs=$('observacoes');obs.replaceChildren();
 if(prisma)obs.append(detalhe('Descrição',item.descricao));
 else obs.append(detalhe('Observação de abertura',item.observacaoAbertura),detalhe('Observação de encerramento',item.observacaoEncerramento));
 if(item.prioridade)obs.prepend(detalhe('★ Prioridade da Triagem',`${new Date(item.prioridade.em).toLocaleString('pt-BR')}${item.prioridade.por?' · '+item.prioridade.por:''} — ${item.prioridade.motivo||''}`));
 /* "Muito importante" só aparece como opção para a Triagem (ou se o cartão já está lá) */
 const atual=etapa(item);
 $('etapa').replaceChildren(...ETAPAS.filter(([v])=>v!=='importante'||ehTriagem()||atual==='importante').map(([v,n])=>new Option(n,v)));
 $('etapa').value=opcoes.etapa||atual;
 $('responsavel').value=responsavelDe(item);$('nota').value='';$('salvoEm').textContent='';
 marcarNotaObrigatoria();
 $('destinoSetor').replaceChildren(new Option('Selecione o setor de destino',''),...SETORES.filter(s=>s!==setorAtual(item)).map(s=>new Option(s,s)));
 $('responsavelTransferencia').value=responsavelDe(item);
 $('motivoTransferencia').value='';
 document.querySelector('.transfer-panel').open=false;
 /* painel da Triagem */
 $('painelTriagem').hidden=!ehTriagem();
 if(ehTriagem()){
  $('triagemSetor').replaceChildren(new Option('Selecione o setor',''),...SETORES.filter(s=>s!=='Triagem').map(s=>new Option(s,s)));
  $('triagemSetor').value=setorAtual(item)==='Triagem'?'':setorAtual(item);
  $('triagemMotivo').value='';
  $('triagemSituacao').textContent=item.prioridade?`Já é prioridade desde ${new Date(item.prioridade.em).toLocaleString('pt-BR')}. Dá para trocar o setor ou retirar a prioridade.`:'O cartão vai para a coluna "Muito importante" do setor escolhido.';
  $('retirarImportante').hidden=!item.prioridade;
 }
 mostrarHistorico(item);$('modal').showModal();
 if(opcoes.foco==='triagem')$('triagemMotivo').focus();
 else if(opcoes.etapa)$('nota').focus();
}
async function salvarTratativa(chave,novaEtapa,responsavel,nota){const item=banco?await cartaoAtual(chave):itens.find(x=>x.chave===chave);if(!item){render();return;}const t=item.tratativa||{etapa:null,responsavel:'',historico:[]};const anterior=etapa(item);const acao=anterior!==novaEtapa?`Movido: ${nomeEtapa(anterior)} → ${nomeEtapa(novaEtapa)}`:'Tratativa atualizada';if(anterior===novaEtapa&&t.responsavel===responsavel&&!nota){mensagem('Nenhuma alteração para salvar.');return;}const novo={...item,tratativa:{etapa:novaEtapa,responsavel,historico:[...(t.historico||[]),{em:new Date().toISOString(),acao,responsavel,nota}]}};await guardarCartao(novo);itens=itens.map(x=>x.chave===chave?novo:x);atualizarFiltros();render();return novo;}
async function mudarEtapa(chave,id){try{
 const item=itens.find(x=>x.chave===chave);if(!item)return;
 if(!ehTriagem()&&setorAtual(item)!==setor)return;
 if(etapa(item)===id)return;
 if(id==='importante'){
  if(!ehTriagem()){mensagem('Só a Triagem coloca protocolos em "Muito importante".');return;}
  abrirModal(chave,{foco:'triagem'});mensagem('Escolha o setor e o motivo para priorizar o protocolo.');return;
 }
 if(EXIGE_NOTA.includes(id)){abrirModal(chave,{etapa:id});mensagem(`Para mover para "${nomeEtapa(id)}", escreva uma observação e salve.`);return;}
 if(await salvarTratativa(chave,id,responsavelDe(item),''))mensagem('Cartão movido. A movimentação será preservada nas próximas importações.');
}catch(e){falha('Não foi possível salvar a movimentação.',e);}}
async function transferirProtocolo(){
 let item=itens.find(x=>x.chave===ativo);if(!item)return;
 if(banco){try{item=await cartaoAtual(ativo);}catch(e){falha('Erro ao transferir o protocolo.',e);return;}if(!item){$('modal').close();render();return;}}
 const destino=$('destinoSetor').value, responsavel=$('responsavelTransferencia').value.trim(), motivo=$('motivoTransferencia').value.trim();
 if(!destino||!SETORES.includes(destino)||destino===setorAtual(item)){mensagem('Selecione outro setor de destino.');return;}
 if(!responsavel||!motivo){mensagem('Informe o responsável e o motivo da transferência.');return;}
 const origem=setorAtual(item),t=item.tratativa||{etapa:null,responsavel:'',historico:[]};
 const novo={...item,setor:destino,transferidoDe:origem,tratativa:{...t,responsavel:t.responsavel||responsavel,historico:[...(t.historico||[]),{em:new Date().toISOString(),acao:`Transferência: ${origem} → ${destino}`,responsavel,nota:motivo}]}};
 try{await guardarCartao(novo);itens=itens.map(x=>x.chave===item.chave?novo:x);$('modal').close();atualizarFiltros();render();mensagem(`Protocolo transferido de ${origem} para ${destino}. Histórico preservado.`);}catch(e){falha('Erro ao transferir o protocolo.',e);}
}
$('transferir').addEventListener('click',transferirProtocolo);

/* ---- Triagem: prioridade ---- */
async function marcarImportante(){
 let item=itens.find(x=>x.chave===ativo);if(!item||!ehTriagem())return;
 if(banco){try{item=await cartaoAtual(ativo);}catch(e){falha('Não foi possível priorizar o protocolo.',e);return;}if(!item){$('modal').close();render();return;}}
 const destino=$('triagemSetor').value,por=$('triagemResponsavel').value.trim(),motivo=$('triagemMotivo').value.trim();
 if(!destino){mensagem('Escolha o setor que vai tratar o protocolo.');$('triagemSetor').focus();return;}
 if(!motivo){mensagem('Escreva o motivo da prioridade.');$('triagemMotivo').focus();return;}
 const origem=setorAtual(item),t=item.tratativa||{etapa:null,responsavel:'',historico:[]},em=new Date().toISOString();
 const novo={...item,setor:destino,transferidoDe:destino!==origem?origem:item.transferidoDe,prioridade:{em,por,motivo},
  tratativa:{...t,etapa:'importante',historico:[...(t.historico||[]),{em,acao:`Triagem: marcado como muito importante → ${destino}`,responsavel:por,nota:motivo}]}};
 try{await guardarCartao(novo);itens=itens.map(x=>x.chave===item.chave?novo:x);$('modal').close();atualizarFiltros();render();mensagem(`Protocolo ${item.protocolo} enviado para "Muito importante" em ${destino}.`);}catch(e){falha('Não foi possível priorizar o protocolo.',e);}
}
async function retirarImportante(){
 let item=itens.find(x=>x.chave===ativo);if(!item||!ehTriagem()||!item.prioridade)return;
 if(banco){try{item=await cartaoAtual(ativo);}catch(e){falha('Não foi possível retirar a prioridade.',e);return;}if(!item){$('modal').close();render();return;}if(!item.prioridade){$('modal').close();render();return;}}
 const por=$('triagemResponsavel').value.trim(),t=item.tratativa||{etapa:null,responsavel:'',historico:[]};
 /* se ainda estava na coluna, o cartão volta para a coluna do prazo dele */
 const novo={...item,prioridade:null,tratativa:{...t,etapa:t.etapa==='importante'?null:t.etapa,historico:[...(t.historico||[]),{em:new Date().toISOString(),acao:'Triagem: prioridade retirada',responsavel:por,nota:$('triagemMotivo').value.trim()}]}};
 try{await guardarCartao(novo);itens=itens.map(x=>x.chave===item.chave?novo:x);$('modal').close();render();mensagem(`Prioridade retirada do protocolo ${item.protocolo}.`);}catch(e){falha('Não foi possível retirar a prioridade.',e);}
}
$('marcarImportante').addEventListener('click',marcarImportante);
$('retirarImportante').addEventListener('click',retirarImportante);

/* ---- Triagem: protocolo próprio (PRISMA-AAAA-NNNN) ----
   A numeração é por ano e fica guardada junto com o Kanban, no mesmo navegador. */
async function proximoNumero(reservar){
 /* no banco a numeração é uma só para todos; aqui é só a prévia (quem reserva é o crm_criar_prisma) */
 if(banco){const {data,error}=await R.cliente().rpc('crm_proximo_numero');if(error||!data)throw error||new Error('sem número');return data;}
 const ano=new Date().getFullYear(),seq=await lerConfig('seqPrisma');
 let n=(seq&&seq.ano===ano?seq.n:0)+1;
 const numero=k=>`PRISMA-${ano}-${String(k).padStart(4,'0')}`;
 while(itens.some(x=>x.protocolo===numero(n)))n++;
 if(reservar)await gravarConfig('seqPrisma',{ano,n});
 return numero(n);
}
async function abrirNovo(){
 if(!ehTriagem())return;
 $('formNovo').reset();$('novoImportante').checked=true;$('novoAviso').textContent='';
 $('novoSetor').replaceChildren(new Option('Selecione o setor',''),...SETORES.filter(s=>s!=='Triagem').map(s=>new Option(s,s)));
 try{$('novoNumero').textContent=await proximoNumero(false);}catch(_){$('novoNumero').textContent='—';}
 $('modalNovo').showModal();$('novoAssunto').focus();
}
async function criarProtocolo(e){
 e.preventDefault();if(!ehTriagem())return;
 const assunto=$('novoAssunto').value.trim(),descricao=$('novoDescricao').value.trim(),destino=$('novoSetor').value;
 if(!assunto||!descricao||!destino){$('novoAviso').textContent='Preencha assunto, descrição e setor de destino.';return;}
 try{
  const em=new Date().toISOString(),por=$('novoResponsavel').value.trim(),importante=$('novoImportante').checked;
  const dados={ocorrencia:'PRISMA',assunto,grupo:'',descricao,abertura:dataISO(new Date()),encerramento:'',status:'Aberto',canal:'PRISMA',reclameAqui:false,
   beneficiario:$('novoBeneficiario').value.trim(),email:'',protocoloAns:$('novoProtocoloAns').value.trim(),
   observacaoAbertura:descricao,observacaoEncerramento:''};
  const trabalho={prioridade:importante?{em,por,motivo:'Protocolo criado pela Triagem'}:null,
   tratativa:{etapa:importante?'importante':null,responsavel:'',historico:[{em,acao:`Criado pela Triagem → ${destino}${importante?' (muito importante)':''}`,responsavel:por,nota:descricao}]}};
  let numero;
  if(banco){const {data,error}=await R.cliente().rpc('crm_criar_prisma',{p_setor:destino,p_dados:dados,p_trabalho:trabalho});if(error||!data)throw error||new Error('sem número');numero=data;}
  else numero=await proximoNumero(true);
  const item={chave:JSON.stringify([numero,'PRISMA']),protocolo:numero,origem:'prisma',setor:destino,...dados,...trabalho};
  if(!banco)await guardarCartao(item);
  itens.push(item);$('modalNovo').close();atualizarFiltros();render();
  mensagem(`Protocolo ${numero} criado e enviado para ${destino}${importante?' em "Muito importante"':''}.`);
 }catch(err){console.error(err);$('novoAviso').textContent=banco&&err&&err.message?`Não foi possível criar o protocolo. ${err.message}`:'Não foi possível criar o protocolo.';}
}
$('novoProtocolo').addEventListener('click',abrirNovo);
$('formNovo').addEventListener('submit',criarProtocolo);
$('fecharNovo').addEventListener('click',()=>$('modalNovo').close());

/* ---- importação (igual à de antes: nunca sobrescreve tratativa, prioridade nem protocolo PRISMA) ---- */
/* com o banco: o relatório vai para todos (CRMs dos setores, Inteligência, Estudo e Volume) */
async function importarNoBanco(file){
 if(!gestao||!ehTriagem()){mensagem('Só o gestor e o admin importam o relatório, na visão Triagem.');$('arquivo').value='';return;}
 importando=true;
 try{
  mensagem('Lendo planilha...');
  const linhas=await R.lerArquivo(file);
  const r=await R.importar(linhas,file.name,(feito,total)=>mensagem(`Enviando o relatório para o banco: ${feito.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} linhas...`));
  mensagem('Atualizando o quadro...');
  await carregarDoBanco();atualizarResumo();atualizarFiltros();render();
  mensagem(`Importação concluída: ${r.novos} novo(s), ${r.atualizados} atualizado(s), ${r.removidos} removido(s). As tratativas e os protocolos PRISMA foram mantidos. Todos os setores já veem o relatório novo.`);
 }catch(e){falha('Falha na importação:',e);}
 finally{importando=false;$('arquivo').value='';}
}
async function importar(file){if(!file)return;if(banco)return importarNoBanco(file);if(!window.XLSX){mensagem('A biblioteca de leitura de planilhas não carregou.');return;}mensagem('Lendo planilha...');try{const data=await file.arrayBuffer(),book=XLSX.read(data,{type:'array',cellDates:true}),sheet=book.Sheets[book.SheetNames[0]],linhas=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true});if(!linhas.length)throw Error('Planilha sem registros.');const headers=Object.keys(linhas[0]);if(!headers.some(h=>['protocolo','protocoloans'].includes(norm(h)))||!headers.some(h=>['numocorrencia','numeroocorrencia'].includes(norm(h))))throw Error('A planilha precisa das colunas Protocolo e Num. Ocorrência.');const atuais=await todos(),map=new Map(atuais.map(x=>[x.chave,x]));let novos=0,atualizados=0,iguais=0,invalidos=0,semSetor=0;const vistos=new Set();const alterados=[];for(const linha of linhas){const fonte=extrair(linha);if(!fonte){invalidos++;continue;}if(vistos.has(fonte.chave)){iguais++;continue;}vistos.add(fonte.chave);const existente=map.get(fonte.chave);if(existente){const novo={...existente,...Object.fromEntries(Object.entries(fonte).filter(([k,v])=>v!==''||k==='chave'||k==='reclameAqui')),setor:existente.setor||fonte.setor,transferidoDe:existente.transferidoDe,tratativa:existente.tratativa};if(JSON.stringify({...existente,tratativa:null})!==JSON.stringify({...novo,tratativa:null})){atualizados++;alterados.push(novo);map.set(novo.chave,novo);}else iguais++;}else{novos++;if(!fonte.setor)semSetor++;alterados.push(fonte);map.set(fonte.chave,fonte);}}
// Transação única: se houver falha, nenhuma atualização parcial dos cartões é confirmada.
await trans('cartoes','readwrite',s=>{for(const item of alterados)s.put(item);});const relatorio={em:new Date().toISOString(),arquivo:file.name,linhas:linhas.length,novos,atualizados,iguais,invalidos,semSetor,total:map.size};await guardarConfig(relatorio);ultimaImportacao=relatorio;itens=[...map.values()];atualizarResumo();atualizarFiltros();render();mensagem(`Importação concluída: ${novos} novo(s), ${atualizados} atualizado(s). Nenhuma tratativa manual foi substituída.`);}catch(e){console.error(e);mensagem(`Falha na importação: ${e.message}`);}finally{$('arquivo').value='';}}
function atualizarResumo(){if(!ultimaImportacao){$('novos').textContent='—';$('atualizados').textContent='—';$('sincronizados').textContent=banco?itens.length:'—';$('ultima').textContent='Nenhuma importação realizada';return;}$('novos').textContent=`+${ultimaImportacao.novos}`;$('atualizados').textContent=ultimaImportacao.atualizados;$('sincronizados').textContent=ultimaImportacao.total;$('ultima').textContent=`Última importação: ${new Date(ultimaImportacao.em).toLocaleString('pt-BR')}`;}
function verRelatorio(){const r=ultimaImportacao;$('relatorioSync').replaceChildren();if(!r){$('relatorioSync').textContent='Nenhuma planilha foi importada.';}else if(banco){const p=document.createElement('p');p.textContent=`Arquivo: ${r.arquivo} · ${new Date(r.em).toLocaleString('pt-BR')}${r.por?' · importado por '+r.por:''}`;$('relatorioSync').append(p);[['Linhas do relatório',r.linhas],['Novos cartões',r.novos],['Registros atualizados',r.atualizados],['Removidos (saíram da planilha)',r.removidos],['Cartões no CRM (todos os setores)',r.total]].forEach(([a,b])=>$('relatorioSync').append(detalhe(a,String(b))));const nota=document.createElement('p');nota.textContent='O relatório fica salvo para todos até a próxima importação. As tratativas dos protocolos que continuam na planilha são mantidas, e os protocolos PRISMA nunca são alterados pela importação.';$('relatorioSync').append(nota);}else{const p=document.createElement('p');p.textContent=`Arquivo: ${r.arquivo} · ${new Date(r.em).toLocaleString('pt-BR')}`;$('relatorioSync').append(p);[['Linhas processadas',r.linhas],['Novos cartões',r.novos],['Registros atualizados',r.atualizados],['Sem alterações ou repetidos',r.iguais],['Linhas sem chave válida',r.invalidos],['Novos sem setor identificado',r.semSetor],['Total armazenado',r.total]].forEach(([a,b])=>$('relatorioSync').append(detalhe(a,String(b))));const nota=document.createElement('p');nota.textContent='As tratativas manuais são mantidas. Os registros sem setor identificado ficam na Triagem até serem classificados.';$('relatorioSync').append(nota);}$('modalSync').showModal();}
/* setores que a pessoa enxerga: o colaborador só os dele; a Triagem só o gestor/admin */
async function restringirSetores(){
 gestao=await R.souGestao();
 const meus=await R.meusSetores();
 const permitidos=SETORES.filter(s=>s==='Triagem'?gestao:(gestao||meus.includes(s)));
 [...$('setor').options].forEach(op=>{if(op.value&&!permitidos.includes(op.value))op.remove();});
 if(setor&&!permitidos.includes(setor)){setor='';$('setor').value='';}
 /* quem tem um setor só já começa nele */
 if(!setor&&permitidos.length===1){setor=permitidos[0];$('setor').value=setor;}
 if(!permitidos.length)mensagem('Seu login ainda não tem setor liberado no CRM. Fale com o gestor do PRISMA.');
}
/* ao vivo: alguém mexeu num cartão ou o gestor importou um relatório novo */
let aguardandoRender=null;
function redesenharDepois(){clearTimeout(aguardandoRender);aguardandoRender=setTimeout(()=>{atualizarFiltros();render();},300);}
function acompanharBanco(){
 R.acompanhar('crm',async chave=>{if(!chave||importando)return;try{await recarregarCartao(chave);redesenharDepois();}catch(e){console.error(e);}},
  async()=>{if(importando)return;try{
   /* o aviso da minha própria importação chega depois dela: se já estou com essa, não recarrego */
   const u=await R.ultimaImportacao();if(u&&ultimaImportacao&&u.em===ultimaImportacao.em)return;
   mensagem('Um relatório novo foi importado. Atualizando o quadro...');await carregarDoBanco();atualizarResumo();atualizarFiltros();render();mensagem('Quadro atualizado com o relatório novo.');}catch(e){falha('Não foi possível atualizar o quadro.',e);}});
}
async function iniciarBanco(){
 try{
  mensagem('Carregando o CRM...');
  await restringirSetores();
  await carregarDoBanco();
  atualizarResumo();atualizarFiltros();render();
  if($('mensagem').textContent==='Carregando o CRM...')mensagem('');
  acompanharBanco();
 }catch(e){falha('Não foi possível carregar o CRM do banco.',e);}
}
async function iniciar(){if(banco)return iniciarBanco();try{db=await abrirDB();[itens,ultimaImportacao]=await Promise.all([todos(),config()]);atualizarResumo();atualizarFiltros();render();}catch(e){console.error(e);mensagem('Não foi possível abrir o armazenamento local. Verifique as permissões do navegador.');}}

const FILTROS=['inicio','fim','assunto','origem','busca','filtroResponsavel','filtroSetor'];
$('setor').onchange=e=>{setor=e.target.value;paginaPorColuna={};$('filtroSetor').value='';$('filtroResponsavel').value='';atualizarFiltros();render();};
FILTROS.forEach(id=>$(id).addEventListener(id==='busca'?'input':'change',()=>{paginaPorColuna={};render();}));
$('limpar').onclick=()=>{FILTROS.forEach(id=>$(id).value='');paginaPorColuna={};render();};
$('arquivo').onchange=e=>importar(e.target.files?.[0]);$('detalhesSync').onclick=verRelatorio;$('fecharSync').onclick=()=>$('modalSync').close();$('fechar').onclick=()=>$('modal').close();
$('etapa').addEventListener('change',marcarNotaObrigatoria);
$('salvar').onclick=async()=>{if(!ativo)return;const item=itens.find(x=>x.chave===ativo);const alvo=$('etapa').value,nota=$('nota').value.trim();
 if(item&&EXIGE_NOTA.includes(alvo)&&etapa(item)!==alvo&&!nota){$('salvoEm').textContent=`Escreva uma observação para mover para "${nomeEtapa(alvo)}".`;$('nota').focus();return;}
 if(item&&alvo==='importante'&&!ehTriagem()&&etapa(item)!=='importante'){$('salvoEm').textContent='Só a Triagem coloca protocolos em "Muito importante".';return;}
 try{const novo=await salvarTratativa(ativo,alvo,$('responsavel').value.trim(),nota);if(novo){$('nota').value='';$('salvoEm').textContent='Salvo com sucesso';marcarNotaObrigatoria();mostrarHistorico(novo);mensagem('Tratativa salva.');}}catch(e){console.error(e);$('salvoEm').textContent='Falha ao salvar';}};
iniciar();
})();
