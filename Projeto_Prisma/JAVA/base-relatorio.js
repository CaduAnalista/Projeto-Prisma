/* PRISMA — relatório do CRM guardado no banco (Supabase)
   Pedido do autor (20/11/2026): uma planilha geral só, importada pelo gestor ou pelo admin
   (na Inteligência de Rede ou no CRM, visão Triagem), fica salva até a próxima importação
   e todo mundo vê a mesma coisa: CRM de todos os setores, Inteligência, Estudo e Volume.

   Como eu fiz:
   - a planilha é lida no navegador e só as colunas que as páginas usam vão para o banco
     (telefone, endereço, nascimento etc. ficam de fora);
   - as linhas vão para "relatorio_envio" em lotes e a função relatorio_aplicar troca o
     relatório inteiro de uma vez (o anterior é apagado; a tratativa dos protocolos que
     continuam na planilha fica; os protocolos PRISMA nunca são mexidos);
   - quem não é gestor/admin só recebe as linhas dos protocolos do próprio setor (RLS).
   Nada de CPF ou nome vai para o console, URL ou localStorage. */
(() => {
  "use strict";

  /* ---- sessão: primeiro a da Visão geral (casca); se não der, a da própria página ---- */
  let sessao = null;
  try { if (window.parent !== window && window.parent.PrismaSessao) sessao = window.parent.PrismaSessao; } catch (_) { sessao = null; }
  if (!sessao) sessao = window.PrismaSessao || null;
  const configurado = !!(sessao && sessao.configurado);
  const cliente = () => (configurado ? sessao.cliente() : null);

  /* ---- mesmas regras do CRM para a chave (Protocolo + Num. Ocorrência) e o setor ---- */
  function norm(v) { return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function texto(v) { return v === null || v === undefined ? "" : String(v).trim(); }
  function pick(obj, ...nomes) {
    for (const n of nomes) {
      const k = Object.keys(obj).find((x) => norm(x) === norm(n));
      if (k && obj[k] !== null && obj[k] !== undefined && obj[k] !== "") return obj[k];
    }
    return "";
  }
  function setorOrigem(r) {
    const d = norm([pick(r, "Desc Departamento", "DESCRICAO_DEPARTAMENTO"), pick(r, "Desc Sub Departamento"), pick(r, "Desc Assunto", "DESCRICAO_ASSUNTO"), pick(r, "Desc GRP Ocorrência", "DESCRICAO_GRP_OCORRENCIA"), pick(r, "Desc Ocorrência", "DESCRICAO_OCORRENCIA")].join(" "));
    if (/reembolso/.test(d)) return "Reembolso";
    if (/credenc|redecredenciada|prestador|hospital/.test(d)) return "Credenciamento";
    if (/auditoria|autorizacao|procedimentomedico|quimioterap|regulacao|coberturaassistencial/.test(d)) return "Auditoria";
    if (/captacao|adesao|prospect|novobeneficiario/.test(d)) return "Captação";
    if (/cadastro|inclusao|exclusao|alteracaodedados|migracao/.test(d)) return "Cadastro";
    if (/financeiro|inadimpl|pagamento|cobranca|negociacaodedivida|boleto|mensalidade/.test(d)) return "Financeiro";
    if (/patrimonio|administrativ|almoxarifado/.test(d)) return "ADM/PAT";
    return "Triagem";
  }
  function chaveDe(r) {
    const protocolo = texto(pick(r, "Protocolo", "PROTOCOLO_ANS"));
    const ocorrencia = texto(pick(r, "Num. Ocorrência", "NUMERO_OCORRENCIA"));
    return protocolo && ocorrencia ? JSON.stringify([protocolo, ocorrencia]) : null;
  }

  /* ---- só sobem as colunas que alguma página usa ---- */
  const MANTER = ["PROTOCOLO", "CPF", "BENEFICIARIO", "NOME", "EMAIL", "ASSUNTO", "OCORRENCIA", "GRP", "COMUNICACAO", "CANAL",
    "ABERTURA", "ENCERRAMENTO", "PREVISAO", "PRAZO", "STATUS", "OBS", "SETOR", "USUARIO", "USURIO", "OPERADOR", "SLA",
    "SEVERIDADE", "PLANO", "PRODUTO", "DEPARTAMENTO", "TIPO", "DATA", "HORA"];
  const TIRAR = ["TELEFONE", "CELULAR", "FONE", "ENDERECO", "LOGRADOURO", "BAIRRO", "NASCIMENTO", "SENHA", "CIDADE", "COMPLEMENTO"];
  /* estes só pelo nome exato: "CEP" está dentro de "RECEPCAO" e "UF" aparece no meio de outras palavras */
  const TIRAR_EXATO = ["RG", "MAE", "PAI", "NOMEMAE", "NOMEDAMAE", "NOMEPAI", "CEP", "UF"];
  const chaveColuna = (c) => String(c ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  function colunasPermitidas(cabecalhos) {
    return cabecalhos.filter((c) => {
      const k = chaveColuna(c);
      if (!k || TIRAR_EXATO.includes(k) || TIRAR.some((t) => k.includes(t))) return false;
      return MANTER.some((m) => k.includes(m));
    });
  }
  function limparValor(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : "";
    if (typeof v === "boolean") return v;
    if (v instanceof Date) return Number.isNaN(v.valueOf()) ? "" : v.toISOString();
    return v === null || v === undefined ? "" : String(v);
  }

  /* lê a planilha do jeito da Inteligência/Estudo/Volume (datas como número do Excel) */
  async function lerArquivo(arquivo) {
    if (!window.XLSX) throw new Error("A biblioteca de leitura de planilhas não carregou.");
    const dados = await arquivo.arrayBuffer();
    const livro = XLSX.read(dados, { type: "array", cellDates: false });
    const folha = livro.Sheets[livro.SheetNames[0]];
    return XLSX.utils.sheet_to_json(folha, { defval: "", raw: true });
  }

  async function perfil() { return configurado ? await sessao.carregarPerfil().catch(() => null) : null; }
  async function souGestao() { const p = await perfil(); return !!(p && (p.papel === "gestor" || p.papel === "admin")); }

  async function meusSetores() {
    const sb = cliente(); if (!sb) return null;
    const { data, error } = await sb.rpc("meus_setores_crm");
    if (error) throw error;
    return Array.from(data || []);
  }

  /* envia a planilha e troca o relatório no banco; devolve { linhas, cartoes, novos, atualizados, removidos } */
  async function importar(linhas, nomeArquivo, aoAndar) {
    const sb = cliente(); if (!sb) throw new Error("O banco não está configurado.");
    if (!(await souGestao())) throw new Error("Só o gestor e o admin importam o relatório.");
    if (!linhas.length) throw new Error("Planilha sem registros.");
    const cabecalhos = Object.keys(linhas[0]);
    if (!chaveDe(linhas.find((l) => chaveDe(l)) || {})) throw new Error("A planilha precisa das colunas Protocolo e Num. Ocorrência.");
    const colunas = colunasPermitidas(cabecalhos);
    const lote = crypto.randomUUID();
    const registros = linhas.map((r, i) => {
      const linha = {};
      for (const c of colunas) linha[c] = limparValor(r[c]);
      const chave = chaveDe(r);
      return { lote, ordem: i, chave, setor: chave ? setorOrigem(r) : "Triagem", linha };
    });
    const TAM = 500;
    for (let i = 0; i < registros.length; i += TAM) {
      const { error } = await sb.from("relatorio_envio").insert(registros.slice(i, i + TAM));
      if (error) throw new Error("Falha ao enviar a planilha para o banco.");
      if (aoAndar) aoAndar(Math.min(i + TAM, registros.length), registros.length);
    }
    const { data, error } = await sb.rpc("relatorio_aplicar", { p_lote: lote, p_arquivo: String(nomeArquivo || "planilha").slice(0, 200) });
    if (error) throw new Error(error.message || "O banco não aceitou a importação.");
    return data;
  }

  /* busca uma tabela inteira em páginas de 1000 (limite do Supabase), várias ao mesmo tempo */
  async function buscarTudo(tabela, colunas, ordem) {
    const sb = cliente(); if (!sb) return [];
    const { count, error } = await sb.from(tabela).select("*", { count: "exact", head: true });
    if (error) throw error;
    const total = count || 0, PAG = 1000, paginas = [];
    for (let de = 0; de < total; de += PAG) paginas.push(de);
    const resultado = new Array(paginas.length);
    let proxima = 0;
    async function trabalhador() {
      while (proxima < paginas.length) {
        const k = proxima++, de = paginas[k];
        const { data, error: e } = await sb.from(tabela).select(colunas).order(ordem, { ascending: true }).range(de, de + PAG - 1);
        if (e) throw e;
        resultado[k] = data || [];
      }
    }
    await Promise.all([1, 2, 3, 4].map(trabalhador));
    return resultado.flat();
  }

  /* linhas do relatório salvo (cada uma é o objeto da planilha, só com as colunas guardadas) */
  async function carregarLinhas() {
    const dados = await carregarLinhasComChave();
    return dados.map((d) => d.linha);
  }
  /* o CRM precisa da chave de cada linha para juntar com o cartão */
  function carregarLinhasComChave() { return buscarTudo("relatorio_linhas", "ordem, chave, linha", "ordem"); }
  async function carregarCartoes() { return buscarTudo("crm_cartoes", "chave, protocolo, origem, setor, dados, trabalho, atualizado_em", "chave"); }

  async function ultimaImportacao() {
    const sb = cliente(); if (!sb) return null;
    const { data, error } = await sb.from("relatorio_importacoes").select("em, por_nome, arquivo, linhas, cartoes, novos, atualizados, removidos").order("id", { ascending: false }).limit(1).maybeSingle();
    if (error) return null;
    return data || null;
  }

  /* avisos ao vivo: outra pessoa mexeu num cartão ou importou um relatório novo */
  const canais = [];
  function acompanhar(nome, aoMudarCartao, aoImportar) {
    const sb = cliente(); if (!sb) return;
    let canal = sb.channel(`prisma-${nome}-${Math.random().toString(36).slice(2)}`);
    if (aoMudarCartao) canal = canal.on("postgres_changes", { event: "INSERT", schema: "public", table: "crm_mudancas" }, (m) => aoMudarCartao(m.new && m.new.chave));
    if (aoImportar) canal = canal.on("postgres_changes", { event: "INSERT", schema: "public", table: "relatorio_importacoes" }, () => aoImportar());
    canal.subscribe();
    canais.push(canal);
  }
  /* a página sai do iframe: o canal (que pode morar na Visão geral) precisa fechar junto */
  window.addEventListener("pagehide", () => { const sb = cliente(); canais.splice(0).forEach((c) => { try { sb.removeChannel(c); } catch (_) { /* já fechado */ } }); });

  window.PrismaRelatorio = {
    configurado, cliente, perfil, souGestao, meusSetores, lerArquivo, importar,
    carregarLinhas, carregarLinhasComChave, carregarCartoes, ultimaImportacao, acompanhar, colunasPermitidas
  };
})();
