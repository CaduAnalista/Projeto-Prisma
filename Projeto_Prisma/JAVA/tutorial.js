/*
=====================================================
 PRISMA — TUTORIAIS (pedido do autor, 19/11/2026)
 O usuário clica em "Tutoriais" no rodapé do menu (perto do Sair),
 escolhe o tutorial e eu mostro o passo a passo: escureço a tela,
 ilumino o que estou explicando e abro um balão com o texto.
 Todo passo tem "Pular tutorial" para quem já sabe usar.
 Nada abre sozinho ao entrar no site.

 Os alvos podem estar no menu/topo (esta página) ou dentro do
 painel aberto no iframe (mesma origem, então consigo ler o DOM dele).
=====================================================
*/

(() => {
  "use strict";

  const iframe = document.getElementById("iframeDashboard");
  const painelDinamico = document.getElementById("painelDinamico");
  const menuLateral = document.getElementById("menuLateral");
  const botaoTutorial = document.getElementById("botaoTutorial");
  if (!iframe || !menuLateral || !botaoTutorial) return;

  const CHAVE_FEITOS = "prisma-tutoriais-feitos";
  const CHAVE_VISTO = "prisma-tutoriais-visto";
  const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ehCelular = () => window.matchMedia("(max-width: 700px)").matches;
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

  /* localStorage pode falhar (aba anônima, bloqueio): sigo sem lembrar */
  function lerFeitos() {
    try { return new Set(JSON.parse(localStorage.getItem(CHAVE_FEITOS) || "[]")); } catch (_) { return new Set(); }
  }
  function marcarFeito(id) {
    const feitos = lerFeitos();
    feitos.add(id);
    try { localStorage.setItem(CHAVE_FEITOS, JSON.stringify([...feitos])); } catch (_) { /* sem memória */ }
  }

  /* ================================================
     AJUDANTES PARA PREPARAR A TELA ANTES DE UM PASSO
  ================================================= */

  const clicarSe = (el, condicao) => { if (el && condicao) el.click(); };

  /* menu: lista de painéis aberta */
  function abrirSubmenu() {
    const sub = document.getElementById("submenuDashboards");
    clicarSe(document.getElementById("botaoExpandirMenu"), sub && !sub.classList.contains("aberto"));
  }
  function abrirInteligencia() {
    abrirSubmenu();
    const sub = document.getElementById("submenuInteligencia");
    clicarSe(document.getElementById("botaoExpandirInteligencia"), sub && sub.hidden);
  }
  function abrirFormulario() {
    abrirSubmenu();
    const sub = document.getElementById("submenuFormularioReuniao");
    clicarSe(document.getElementById("botaoFormularioReuniao"), sub && sub.hidden);
  }

  /* Inteligência de Rede: painel de filtros aberto ou fechado.
     Dentro dos painéis eu não mexo direto: mando a ação para a ponte (tutorial-pagina.js)
     no formato "clique em X se Y existir". */
  const ABRIR_FILTRO_IR = [{ clicar: "#botaoFiltro", se: "#painelFiltro[hidden]" }];
  const FECHAR_FILTRO_IR = [{ clicar: "#fecharFiltro", se: "#painelFiltro:not([hidden])" }];
  /* na Geolocalização o mesmo botão "Filtros" abre e fecha o painel suspenso */
  const ABRIR_FILTRO_GEO = [{ clicar: "#btnFiltros", se: "#painelFiltros[hidden]" }];
  const FECHAR_FILTRO_GEO = [{ clicar: "#btnFiltros", se: "#painelFiltros:not([hidden])" }];

  /* jeitos curtos de escrever os passos:
     menu = menu lateral (no celular abro a gaveta), topo = cabeçalho,
     pag = dentro do painel aberto, centro = sem alvo (balão no meio) */
  const menu = (alvo, titulo, texto, extra = {}) => ({ onde: "menu", alvo, titulo, texto, ...extra });
  const topo = (alvo, titulo, texto, extra = {}) => ({ onde: "topo", alvo, titulo, texto, ...extra });
  const pag = (alvo, titulo, texto, extra = {}) => ({ onde: "pagina", alvo, titulo, texto, ...extra });
  const centro = (titulo, texto, extra = {}) => ({ onde: null, titulo, texto, ...extra });

  const DICA_IMPORTAR = "A planilha é a exportação do CRM. Sempre que importar de novo, a tela é recalculada com os dados novos.";

  /* ================================================
     CONTEÚDO DOS TUTORIAIS
  ================================================= */

  const TUTORIAIS = [
    {
      id: "primeiros-passos",
      nome: "Primeiros passos no PRISMA",
      resumo: "O menu, como abrir cada painel, modo claro/escuro e onde ficam os tutoriais.",
      icone: "◈",
      cor: "#4CC9FF",
      recomendado: true,
      passos: [
        centro("Bem-vindo ao PRISMA! 👋",
          "Neste tour eu mostro como navegar pelo sistema. Use <b>Próximo</b> para avançar e <b>Voltar</b> para rever. Se já conhece, é só clicar em <b>Pular tutorial</b>.",
          { dica: "Leva uns 2 minutos e você pode sair a qualquer momento." }),
        menu(".marca", "Este é o PRISMA",
          "<i>Múltiplas visões, uma direção.</i> Todos os painéis de acompanhamento da operação ficam reunidos aqui, num lugar só."),
        menu("#botaoVisaoGeral", "Visão Geral",
          "É a página inicial. Clique aqui a qualquer momento para voltar ao começo."),
        menu("#botaoExpandirMenu", "Mostrar ou esconder os painéis",
          "Esta setinha abre e fecha a lista de painéis que fica logo abaixo.", { antes: abrirSubmenu }),
        menu("#grupoInteligencia .linha-inteligencia", "Inteligência de Rede",
          "Clicando no <b>nome</b>, abre o painel operacional dos protocolos. A <b>setinha</b> ao lado mostra as páginas que ficam dentro dele.",
          { antes: abrirSubmenu }),
        menu("#submenuInteligencia", "Páginas da Inteligência de Rede",
          "<ul><li><b>Estudo de reclamações</b>: reclamações, Reclame Aqui e Ouvidoria.</li><li><b>Volume e produtividade</b>: encerrados e demanda em aberto por colaborador.</li><li><b>CRM</b>: o Kanban de tratativas de cada setor.</li></ul>",
          { antes: abrirInteligencia }),
        menu('[data-pagina="geolocalizacao"]', "Geolocalização de vidas e rede",
          "Mapas com a distribuição dos beneficiários e da rede credenciada no estado do Rio de Janeiro.", { antes: abrirSubmenu }),
        menu("#grupoFormularioReuniao", "Formulário de reunião",
          "Aqui cada setor registra os assuntos da reunião de segunda-feira e depois acompanha o que foi resolvido.",
          { antes: abrirFormulario }),
        menu('[data-pagina="financeiro-credenciamento"]', "Painéis “Em breve”",
          "Itens com a etiqueta <b>Em breve</b> ainda estão sendo construídos. Eles aparecem apagados e ainda não abrem.",
          { antes: abrirSubmenu }),
        menu("#botaoRecolherMenu", "Recolher o menu",
          "Precisa de mais espaço para os gráficos? Recolha o menu por aqui. Clique de novo para abrir.", { soComputador: true }),
        topo("#botaoAbrirMenu", "Botão MENU",
          "No celular o menu fica escondido para sobrar espaço. Toque em <b>MENU</b> para abrir e no <b>×</b> para fechar.",
          { soCelular: true }),
        topo(".topo-informacoes", "Onde você está",
          "O título mostra a página aberta agora e, embaixo, um resumo do que ela mostra."),
        topo(".botao-tema", "Modo claro ou escuro",
          "Alterna entre o modo escuro e o claro. O PRISMA lembra a sua escolha na próxima vez."),
        topo(".topo-status", "Ambiente demonstrativo",
          "Indica que este é o ambiente de demonstração do sistema.", { opcional: true }),
        menu("#botaoTutorial", "Tutoriais",
          "Sempre que quiser rever um passo a passo, clique aqui e escolha o tutorial da página que você quer aprender."),
        menu("#botaoSair", "Sair do PRISMA",
          "Terminou? Saia por aqui. Em computador compartilhado, sempre saia antes de levantar.")
      ]
    },

    {
      id: "inteligencia",
      nome: "Inteligência de Rede",
      resumo: "Protocolos do CRM, prazo da RN 623, filtros, gráficos e a tabela de protocolos.",
      icone: "◎",
      cor: "#2F6BFF",
      pagina: "inteligencia",
      arquivo: "inteligencia.html",
      pronto: "#botaoFiltro",
      depois: FECHAR_FILTRO_IR,
      passos: [
        centro("Inteligência de Rede",
          "É a visão operacional dos protocolos do CRM: quantos estão abertos, quantos estão no prazo da <b>RN 623</b>, quais atrasaram e em qual setor estão."),
        pag('.acoes label[for="arquivoExcel"]', "1º passo: importar a planilha",
          "Clique em <b>Importar</b> e escolha a exportação do CRM (.xlsx, .xls ou .csv). Também dá para <b>arrastar o arquivo</b> para dentro da janela.",
          { dica: DICA_IMPORTAR }),
        pag(".hoje", "Movimento de hoje",
          "Quantos protocolos foram <b>abertos</b> e <b>encerrados hoje</b>. Esses números continuam aparecendo mesmo com filtros de situação ou prazo."),
        pag("#botaoFiltro", "Botão Filtro",
          "Abre o painel com todos os filtros. Eles aplicam na hora, e o número que aparece no botão mostra quantos estão em uso.",
          { antes: FECHAR_FILTRO_IR }),
        pag("#filtroSituacao", "Situação",
          "Escolha entre <b>Todos</b>, só os <b>Pendentes</b> ou só os <b>Encerrados</b>. O número ao lado mostra quantos tem em cada um.",
          { antes: ABRIR_FILTRO_IR }),
        pag("#filtroPrazo", "Prazo (RN 623)",
          "Filtra pelo tempo em dias úteis:<ul><li><b>Em dia</b>: menos de 4 dias.</li><li><b>Atenção</b>: 4 ou 5 dias.</li><li><b>Atrasados</b>: passaram do prazo.</li></ul>Dá para marcar mais de um.",
          { antes: ABRIR_FILTRO_IR }),
        pag("#filtroAjuda", "Precisando de ajuda",
          "Mostra os protocolos que algum setor marcou como <b>Precisando de ajuda</b> no Kanban do CRM.",
          { antes: ABRIR_FILTRO_IR }),
        pag(".pf-dupla", "Setor e colaborador",
          "Escolha um setor ou o colaborador que encerrou o protocolo.", { antes: ABRIR_FILTRO_IR }),
        pag("#chipsCanal", "Canal",
          "Os canais aparecem depois de importar a planilha. Clique em cada um para ligar ou desligar.", { antes: ABRIR_FILTRO_IR }),
        pag(".pf-bloco:has(#periodoDe)", "Período de abertura",
          "Escolha as datas <b>de</b> e <b>até</b>, ou use os atalhos: Hoje, 7 dias, 30 dias, Mês atual e Tudo.", { antes: ABRIR_FILTRO_IR }),
        pag(".pf-ocorrencia", "Ocorrência",
          "Busque pelo nome e marque uma ou várias ocorrências.", { antes: ABRIR_FILTRO_IR }),
        pag(".pf-rodape", "Limpar ou ver o resultado",
          "<b>Limpar filtros</b> volta tudo ao início. <b>Ver resultado</b> fecha o painel e mostra a tela filtrada.",
          { antes: ABRIR_FILTRO_IR }),
        pag("#filtrosAtivos", "Filtros em uso",
          "Cada filtro ligado vira uma etiqueta aqui. Clique no <b>×</b> para tirar só aquele filtro.",
          { antes: FECHAR_FILTRO_IR, opcional: true }),
        pag(".indicadores", "Indicadores",
          "Os cartões resumem a tela. <b>Clique em um cartão</b> para filtrar: em <b>Atrasado</b>, por exemplo, ficam só os atrasados.",
          { antes: FECHAR_FILTRO_IR }),
        pag(".ind-atraso", "Atrasado (RN 623)",
          "Protocolos que já passaram do prazo da RN 623. É o número que pede atenção primeiro."),
        pag(".ind-ajuda", "Precisando de ajuda",
          "Quantos pedidos de ajuda os setores fizeram no Kanban. Clique para ver quais são."),
        pag(".ind-fixo", "T.M.E",
          "Tempo médio de encerramento: a média de dias úteis entre a abertura e o encerramento dos protocolos encerrados."),
        pag(".cartao-ir", "Evolução do IR",
          "Índice de resolução por mês: encerrados no prazo ÷ encerrados. Passe o mouse nas colunas para ver os números.",
          { bloco: "start" }),
        pag(".cartao-setores", "Protocolos por setor",
          "Barras por setor, com as cores do prazo. <b>Clique num setor</b> para filtrar a tela inteira por ele."),
        pag(".cartao-evolucao", "Abertura × encerramento por dia",
          "O dia a dia do mês: a <b>linha</b> são os abertos e as <b>colunas</b> os encerrados. A coluna fica verde quando encerrou mais do que abriu, amarela quando igual e vermelha quando menos.",
          { bloco: "start" }),
        pag("#mesDiario", "Trocar o mês",
          "Escolha outro mês para comparar períodos."),
        pag(".cartao-prazos", "Encerrados por prazo",
          "Quantos protocolos encerrados em cada mês ficaram em dia, em atenção ou atrasados."),
        pag(".tabela-cartao .busca", "Buscar um protocolo",
          "Procure por número de protocolo, CPF ou e-mail.", { bloco: "start" }),
        pag("#tabela thead", "Ordenar a tabela",
          "Clique no título de uma coluna para ordenar por ela. Clicando de novo, a ordem inverte."),
        pag("#tabelaArea", "Ver o protocolo completo",
          "Clique numa linha para abrir todos os dados do protocolo e a observação de abertura completa."),
        pag("#paginacao", "Páginas da tabela",
          "Use as setas para passar as páginas."),
        pag("#exportarExcel", "Exportar para o Excel",
          "Gera um Excel com os protocolos filtrados (e com a busca da tabela). O botão é liberado depois de importar.",
          { bloco: "start" })
      ]
    },

    {
      id: "estudo-reclamacoes",
      nome: "Estudo de reclamações",
      resumo: "Reclamações, Reclame Aqui e Ouvidoria por mês, setor, plano, assunto e beneficiário.",
      icone: "◔",
      cor: "#FF8A2B",
      pagina: "estudo-reclamacoes",
      arquivo: "estudo-reclamacoes.html",
      pronto: "#fPlano",
      passos: [
        centro("Estudo de reclamações",
          "Esta página olha só para as <b>reclamações</b>, o <b>Reclame Aqui</b> e a <b>Ouvidoria</b>: quando acontecem, em qual setor, plano e assunto, e quem mais reclama."),
        pag('.acoes label[for="arquivoExcel"]', "Importar a planilha",
          "Importe a mesma exportação do CRM. O PRISMA separa as reclamações sozinho.", { dica: DICA_IMPORTAR }),
        pag(".er-resumo", "Resumo",
          "Total de reclamações, quantos beneficiários diferentes reclamaram e a média por mês."),
        pag(".er-filtros", "Filtros",
          "Plano, assunto, beneficiário, canal, setor e colaborador. Os filtros aplicam na hora e valem para todos os gráficos."),
        pag(".er-f-benef", "Buscar um beneficiário",
          "Digite o nome ou o CPF para ver o histórico de reclamações de uma pessoa."),
        pag("#limpar", "Limpar",
          "Tira todos os filtros de uma vez."),
        pag("#criterio", "O que entra na conta",
          "Esta linha explica o critério usado e, depois de importar, mostra o nome do arquivo e as quantidades."),
        pag(".er-evolucao", "Reclamações por mês",
          "Uma coluna por mês e a <b>média mensal</b> tracejada. Mês acima da linha teve mais reclamações que o normal."),
        pag(".er-setor", "Reclamações por setor",
          "Ranking dos setores. <b>Clique num setor</b> para filtrar a página por ele."),
        pag(".er-plano", "Reclamações por plano",
          "Mostra quais planos concentram mais reclamações."),
        pag(".er-ocorrencia", "Ocorrências mais recorrentes",
          "Os motivos que mais se repetem. É um bom ponto de partida para um plano de ação."),
        pag(".er-benef", "Beneficiários que mais reclamaram",
          "Pessoas com várias reclamações. Vale um contato proativo antes da próxima."),
        pag("#exportarExcel", "Exportar",
          "Baixa as reclamações filtradas em Excel.", { bloco: "start" })
      ]
    },

    {
      id: "volume-produtividade",
      nome: "Volume e produtividade",
      resumo: "Encerrados e demanda em aberto por colaborador, abertos × encerrados e a tabela de indicadores.",
      icone: "▤",
      cor: "#2EE6C8",
      pagina: "volume-produtividade",
      arquivo: "producao-colaboradores.html",
      pronto: "#fStatus",
      passos: [
        centro("Volume e produtividade",
          "Aqui você acompanha <b>quanto cada colaborador encerrou</b>, <b>quanto ainda tem para tratar</b> e se a equipe está dando conta do que entra todo mês."),
        pag('.acoes label[for="arquivoExcel"]', "Importar a planilha",
          "Importe a exportação do CRM. Os encerrados vêm da coluna <b>Usuário Encerramento Ocorrência</b> e o que está para tratar vem de <b>Descrição Operador Responsável</b>.",
          { dica: DICA_IMPORTAR }),
        pag(".er-resumo", "Resumo da equipe",
          "<ul><li><b>Encerrados</b> no período.</li><li><b>Para tratar</b>: pendentes hoje.</li><li><b>Sem responsável</b>: fica laranja quando há protocolo sem dono.</li><li><b>SLA cumprido</b>: verde de 90% para cima, amarelo de 85% a 89,9% e vermelho abaixo.</li></ul>"),
        pag(".pc-filtros", "Filtros",
          "Período de encerramento, colaborador, status, tipo, canal, severidade e mínimo de encerrados. Tudo aplica na hora."),
        pag("#fStatus", "Status da ocorrência",
          "<b>Encerrada</b> mostra só a produção. <b>Pendente</b> mostra só a demanda em aberto e de que mês ela vem."),
        pag("#fMinimo", "Mínimo de encerrados",
          "Esconde quem encerrou poucos protocolos, como pessoas de outros setores. Quem tem pendente nunca some."),
        pag(".pc-encerrados", "Encerrados por colaborador",
          "Ranking com a quantidade e o % da equipe. <b>Clique num nome</b> para ver a página só daquela pessoa e clique de novo para voltar."),
        pag(".pc-pendentes", "Para tratar por responsável",
          "A fila de cada um hoje. <b>Sem responsável</b> fica sempre em primeiro, e os <b>vencidos</b> aparecem em vermelho."),
        pag(".pc-evolucao", "Abertos × encerrados por mês",
          "A <b>linha</b> são os protocolos abertos e as <b>colunas</b> os encerrados:<ul><li><b>Verde</b>: encerrou mais do que abriu.</li><li><b>Amarelo</b>: igual.</li><li><b>Vermelho</b>: encerrou menos.</li></ul>Passe o mouse num mês para ver o saldo.",
          { bloco: "start" }),
        pag(".pc-evolucao .legenda", "Médias do período",
          "A média de abertos e de encerrados por mês fica aqui na legenda."),
        pag(".pc-tabela-cartao", "Indicadores por colaborador",
          "Todos os números por pessoa: encerrados, % da equipe, para tratar, vencidos, média por dia, SLA, tempo para encerrar e mais.",
          { bloco: "start" }),
        pag(".pc-tabela thead", "Ordenar e filtrar pela tabela",
          "Clique no título de uma coluna para ordenar. Clique numa linha para filtrar a página por aquela pessoa."),
        pag("#exportarExcel", "Exportar",
          "Baixa a tabela de produção por colaborador em Excel. Ela não leva dados de beneficiários.", { bloco: "start" })
      ]
    },

    {
      id: "kanban-crm",
      nome: "CRM · Kanban de tratativas",
      resumo: "Escolher o setor, importar, mover cartões, registrar a tratativa e transferir protocolos.",
      icone: "▥",
      cor: "#FFC24A",
      pagina: "kanban-crm",
      arquivo: "kanban-tratativas.html",
      pronto: "#setor",
      passos: [
        centro("CRM · Kanban de tratativas",
          "Cada setor acompanha os seus protocolos em colunas, desde quando entram até a conclusão, registrando tudo o que foi feito."),
        pag(".sector-label", "1º passo: escolha o seu setor",
          "Selecione o seu setor para ver só os seus protocolos. A <b>Triagem</b> enxerga todos os setores e pode priorizar protocolos."),
        pag(".import-btn", "Importar planilha",
          "Importe a exportação do CRM. Protocolos novos entram, os que já existem são atualizados e as tratativas registradas são mantidas.",
          { dica: "Importe sempre a planilha mais recente para o quadro ficar em dia." }),
        pag(".sync", "Resultado da importação",
          "Mostra a última importação: quantos protocolos <b>novos</b>, <b>atualizados</b> e o <b>total</b>. Em <b>Ver detalhes</b> abre o relatório."),
        pag(".filters", "Filtros",
          "Busque por protocolo, ocorrência ou beneficiário e filtre por período de abertura, assunto, origem e responsável."),
        pag("#board", "As colunas do quadro",
          "<b>Todos que entraram</b> → <b>Em atenção</b> → <b>Atraso</b> → <b>Muito importante</b> → <b>Em andamento interno / externo</b> → <b>Precisando de ajuda</b> → <b>Concluído</b>.",
          { bloco: "start" }),
        pag(".column.atencao", "O prazo pelas cores",
          "Cartões <b>amarelos</b> estão em atenção e <b>vermelhos</b> em atraso, pela contagem de dias úteis. Os mais urgentes ficam no topo da coluna."),
        pag(".column.importante", "Muito importante",
          "Protocolos que a Triagem marcou como prioridade, com o motivo. Trate estes primeiro."),
        pag(".column.ajuda", "Precisando de ajuda",
          "Travou? Mova o protocolo para cá. Ele aparece para a gestão na Inteligência de Rede."),
        pag(".column.concluido", "Concluído",
          "Fica recolhida para sobrar espaço. Clique nela para abrir e em <b>recolher</b> para fechar."),
        pag(".case", "O cartão do protocolo",
          "Mostra os dias úteis, o canal, o assunto, o beneficiário e etiquetas como <b>parado há X dias</b>. <b>Arraste</b> o cartão para outra coluna ou <b>clique</b> nele para abrir a ficha.",
          { opcional: true }),
        centro("Registrar a tratativa",
          "Ao clicar num cartão, abre a ficha do protocolo. Escolha a <b>coluna</b>, o <b>responsável</b>, escreva a <b>observação</b> do que foi feito e clique em <b>Salvar tratativa</b>. Tudo fica no histórico.",
          { dica: "Algumas colunas exigem observação obrigatória. O aviso aparece na própria ficha." }),
        centro("Transferir para outro setor",
          "Na ficha, abra <b>Transferir protocolo para outro setor</b>, escolha o destino, informe o motivo e confirme. O histórico vai junto e o cartão não é duplicado."),
        pag("#novoProtocolo", "Novo protocolo PRISMA",
          "Só na Triagem: cria um protocolo próprio e já envia para o setor de destino.", { opcional: true })
      ]
    },

    {
      id: "geolocalizacao",
      nome: "Geolocalização de vidas e rede",
      resumo: "Os dois mapas, a comparação rede × beneficiários, os filtros e o ranking “Onde expandir”.",
      icone: "♡",
      cor: "#9B6BFF",
      pagina: "geolocalizacao",
      arquivo: "geolocalizacao.html",
      pronto: "#mapaRede",
      depois: FECHAR_FILTRO_GEO,
      passos: [
        centro("Geolocalização de vidas e rede",
          "Mapas que mostram onde estão os beneficiários e a rede credenciada (hospitais, clínicas, laboratórios e outros) no estado do Rio de Janeiro, e onde vale expandir a rede."),
        pag('label[for="arquivoRede"]', "Importar rede",
          "Carregue a planilha da rede credenciada. Ela preenche o <b>mapa 01</b>."),
        pag('label[for="arquivoExcel"]', "Importar beneficiários",
          "Carregue a planilha de beneficiários (colunas BAIRRO, CIDADE e ESTADO). Ela preenche o <b>mapa 02</b> e entra também no mapa 01 para comparar com a rede."),
        pag(".status-base", "Situação da importação",
          "A bolinha fica <b>verde</b> quando a planilha foi lida e <b>vermelha</b> se der erro. O texto ao lado explica o que aconteceu.", { opcional: true }),
        pag(".summary-strip", "Resumo",
          "Unidades da rede, hospitais, total de vidas, vidas no RJ e na Região Metropolitana, municípios com beneficiários, o nome do arquivo e a hora da importação."),
        pag(".map-panel-rede", "Mapa 01 · Rede × beneficiários",
          "Com as duas planilhas, as vidas aparecem em <b>laranja</b> e a rede em <b>azul</b>. Mancha laranja sem azul por perto = vidas longe da rede. As <b>linhas coloridas</b> marcam as 9 regiões de saúde do RJ. Use a rodinha do mouse para aproximar e arraste para mover.",
          { bloco: "start", antes: FECHAR_FILTRO_GEO }),
        pag(".rede-barra .map-view-options:not(.camadas-mapa1)", "Calor, Marcadores ou Ambos",
          "<b>Calor</b> mostra a concentração da rede, <b>Marcadores</b> mostra as gotas H, C, L e O (hospital, clínica, laboratório e outros) e <b>Ambos</b> junta os dois.",
          { antes: FECHAR_FILTRO_GEO }),
        pag(".camadas-mapa1", "Camadas",
          "Ligue ou desligue a <b>Rede</b>, os <b>Beneficiários</b> e as <b>Regiões</b> de saúde. Cada região tem a sua cor de linha; a legenda fica no canto de baixo do mapa, e passar o mouse num município mostra a região dele.",
          { antes: FECHAR_FILTRO_GEO }),
        pag("#painelFiltros", "Filtros da rede",
          "Urgência, tipo, especialidade e município. O município também aproxima o mapa. O botão <b>Filtros</b> mostra quantos estão ativos e <b>Limpar</b> tira todos.",
          { antes: ABRIR_FILTRO_GEO }),
        pag(".rede-meta", "Números do mapa",
          "Quantas unidades e municípios aparecem com os filtros atuais e quantas vidas há no RJ.",
          { antes: FECHAR_FILTRO_GEO }),
        pag(".v9-expandir", "Onde expandir a rede",
          "Os municípios com mais vidas por unidade da rede. Clique em um para aproximar o mapa. Só aparece com as duas planilhas importadas.",
          { opcional: true }),
        pag("#btnResetRede", "Restaurar o mapa",
          "Se perdeu no mapa? Este botão volta para a visão do estado inteiro."),
        centro("A janela do Rio até Niterói",
          "Clicando no <b>Rio de Janeiro</b> ou em <b>Niterói</b>, abre uma janela com o mapa de ruas já mostrando as duas cidades juntas: a rede delas posicionada pelo bairro e, se houver, o calor dos bairros dos beneficiários. A busca é feita bairro por bairro, por isso pode levar alguns minutos."),
        pag("#mapaEstado", "Mapa 02 · Beneficiários",
          "Vidas por município no estado inteiro. Passe o mouse para ver o total de cada um.", { bloco: "center" }),
        pag(".map-controls-clean .map-view-options", "Calor, Bolhas ou Ambos",
          "<b>Calor</b> mostra as manchas de concentração, <b>Bolhas</b> mostra círculos do tamanho da quantidade e <b>Ambos</b> junta os dois."),
        pag("#btnResetEstado", "Restaurar o mapa do estado",
          "Volta o mapa 02 para a visão inicial.")
      ]
    },

    {
      id: "formulario-reuniao",
      nome: "Formulário para a reunião",
      resumo: "Como registrar até 3 assuntos do seu setor para a reunião de segunda-feira.",
      icone: "♧",
      cor: "#22D3FF",
      pagina: "formulario-reuniao",
      arquivo: "formulario-reuniao.html",
      pronto: "#formularioReuniao",
      passos: [
        centro("Formulário para a reunião",
          "Use este formulário para registrar o que o seu setor quer discutir na próxima reunião de segunda-feira."),
        pag(".aviso-informativo", "A regra",
          "Cada setor pode registrar até <b>3 assuntos por reunião</b>. Depois do envio, eles aparecem na página <b>Assuntos por setor</b>."),
        pag("#nomeResponsavel", "Seu nome",
          "Escreva o nome de quem está registrando. É obrigatório."),
        pag("#dataRegistro", "Data do registro",
          "É preenchida sozinha com a data de hoje."),
        pag("#setor", "Setor",
          "Escolha o seu setor na lista."),
        pag("#dataReuniao", "Data da reunião",
          "Escolha a <b>segunda-feira</b> em que o assunto vai ser discutido."),
        pag(".secao-assuntos", "Os assuntos",
          "O <b>Assunto 1</b> é obrigatório; o 2 e o 3 são opcionais. Cada um aceita até 500 caracteres, e o contador embaixo mostra quanto falta.",
          { dica: "Seja direto: o que aconteceu e o que o setor precisa decidir." }),
        pag(".acoes-formulario", "Enviar",
          "<b>Registrar assuntos</b> envia. <b>Limpar formulário</b> apaga o que foi digitado.")
      ]
    },

    {
      id: "assuntos-por-setor",
      nome: "Assuntos por setor",
      resumo: "Consultar a pauta, concluir ou resolver antes, editar e montar o plano de ação 5W2H.",
      icone: "▦",
      cor: "#2EE6A6",
      pagina: "assuntos-por-setor",
      arquivo: "assuntos-por-setor.html",
      pronto: "#gradeSetores",
      passos: [
        centro("Assuntos por setor",
          "Aqui fica a pauta da reunião: os assuntos que cada setor registrou, o que já foi resolvido e os planos de ação."),
        pag("#filtroDataReuniao", "Data da reunião",
          "Escolha a segunda-feira para ver a pauta daquele dia."),
        pag(".campo-busca", "Buscar",
          "Procure por setor, assunto ou responsável."),
        pag("#atualizarAssuntos", "Atualizar",
          "Recarrega a lista para ver os assuntos registrados há pouco."),
        pag("#gradeSetores", "Um cartão por setor",
          "Cada setor tem o seu cartão com os assuntos da reunião escolhida. Setor sem assunto aparece como “Nenhum assunto cadastrado”.",
          { bloco: "start" }),
        pag(".assunto-item", "Um assunto",
          "Mostra o texto, o status (<b>Pendente</b>, <b>Resolvido antecipadamente</b> ou <b>Concluído na reunião</b>) e quem registrou. Clique no texto para abrir o plano de ação.",
          { opcional: true }),
        pag(".assunto-controles", "Ações do assunto",
          "<ul><li><b>Criar / Ver 5W2H</b>: plano de ação.</li><li><b>Editar</b>: corrigir texto, setor ou data.</li><li><b>Resolver antes</b>: resolvido antes da reunião.</li><li><b>Concluir na reunião</b>: tratado na reunião.</li><li><b>Reabrir</b> e <b>Excluir</b>.</li></ul>",
          { opcional: true }),
        pag(".cartao-acoes button", "Concluir o setor inteiro",
          "Este botão conclui de uma vez todos os assuntos pendentes do setor. Clique de novo para reabrir.",
          { opcional: true }),
        centro("Plano de ação 5W2H",
          "O plano responde a 7 perguntas: <b>o que</b>, <b>por que</b>, <b>onde</b>, <b>quando</b>, <b>quem</b>, <b>como</b> e <b>quanto custa</b>. Cada alteração fica guardada em <b>Ver histórico</b>.",
          { dica: "Os resolvidos antes da reunião continuam no histórico, mas não contam como pendentes." })
      ]
    }
  ];

  /* ================================================
     ESTADO
  ================================================= */

  let ativo = null;          // { tutorial, passos, indice }
  let camada = null;
  let foco = null;
  let balao = null;
  let central = null;
  let quadro = 0;            // requestAnimationFrame do acompanhamento
  let ultimoRet = "";
  let geracao = 0;           // evita que um passo antigo atrapalhe o novo

  /* ================================================
     CENTRAL DE TUTORIAIS
  ================================================= */

  function escapar(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function passosDoAparelho(t) {
    const cel = ehCelular();
    return t.passos.filter((p) => !(p.soCelular && !cel) && !(p.soComputador && cel));
  }

  function abrirCentral() {
    fecharCentral();
    try { localStorage.setItem(CHAVE_VISTO, "1"); } catch (_) { /* sem memória */ }
    botaoTutorial.classList.remove("novo");
    /* no celular, fecho a gaveta do menu para a central ficar inteira na tela */
    fecharGaveta();

    const feitos = lerFeitos();
    const total = TUTORIAIS.length;
    const concluidos = TUTORIAIS.filter((t) => feitos.has(t.id)).length;

    criarCamada(true);
    camada.addEventListener("click", fecharCentral);
    central = document.createElement("section");
    central.className = "tut-central";
    central.setAttribute("role", "dialog");
    central.setAttribute("aria-modal", "true");
    central.setAttribute("aria-labelledby", "tutCentralTitulo");
    central.innerHTML = `
      <header class="tut-central-topo">
        <span class="tut-central-selo" aria-hidden="true">?</span>
        <div>
          <h2 id="tutCentralTitulo">Central de tutoriais</h2>
          <p>Escolha o que você quer aprender. Cada tutorial abre a página certa e mostra, passo a passo, para que serve cada parte. Dá para pular quando quiser.</p>
        </div>
        <button type="button" class="tut-fechar" data-acao="fechar" aria-label="Fechar a central de tutoriais">×</button>
      </header>
      <div class="tut-placar">
        <span><b>${concluidos}</b> de ${total} concluídos</span>
        <div class="tut-progresso" aria-hidden="true"><span style="width:${(concluidos / total) * 100}%"></span></div>
      </div>
      <div class="tut-lista">
        ${TUTORIAIS.map((t) => {
          const qtd = passosDoAparelho(t).length;
          const minutos = Math.max(1, Math.round(qtd * 0.15));
          const feito = feitos.has(t.id);
          return `<button type="button" class="tut-cartao${t.recomendado ? " destaque" : ""}" data-tutorial="${t.id}" style="--cor:${t.cor}">
            <span class="tut-cartao-icone" aria-hidden="true">${t.icone}</span>
            <span class="tut-cartao-corpo">
              <strong>${escapar(t.nome)}</strong>
              <span>${escapar(t.resumo)}</span>
              <span class="tut-cartao-meta">
                ${t.recomendado && !feito ? '<i class="recomendado">Comece por aqui</i>' : ""}
                <i>${qtd} passos</i><i>~${minutos} min</i>
                ${feito ? '<i class="feito">✓ Concluído</i>' : ""}
              </span>
            </span>
            <span class="tut-cartao-ir" aria-hidden="true">›</span>
          </button>`;
        }).join("")}
      </div>`;
    document.body.appendChild(central);

    central.addEventListener("click", (e) => {
      if (e.target.closest('[data-acao="fechar"]')) { fecharCentral(); return; }
      const cartao = e.target.closest("[data-tutorial]");
      if (cartao) iniciar(cartao.dataset.tutorial);
    });
    const primeiro = central.querySelector(".tut-cartao");
    if (primeiro) primeiro.focus();
  }

  function fecharCentral() {
    if (central) { central.remove(); central = null; }
    if (!ativo) removerCamada();
  }

  /* ================================================
     CAMADA, DESTAQUE E BALÃO
  ================================================= */

  function criarCamada(semAlvo) {
    if (!camada) {
      camada = document.createElement("div");
      camada.className = "tut-camada";
      document.body.appendChild(camada);
    }
    camada.classList.toggle("sem-alvo", Boolean(semAlvo));
  }

  function removerCamada() {
    if (camada) { camada.remove(); camada = null; }
  }

  function fecharGaveta() {
    if (menuLateral.classList.contains("aberto-celular")) {
      const fechar = document.getElementById("botaoFecharMenu");
      if (fechar) fechar.click();
    }
  }
  function abrirGaveta() {
    if (ehCelular() && !menuLateral.classList.contains("aberto-celular")) {
      const abrir = document.getElementById("botaoAbrirMenu");
      if (abrir) abrir.click();
    }
  }

  /* ================================================
     CONVERSA COM O PAINEL (ponte tutorial-pagina.js)
     Uso mensagens em vez de mexer no iframe direto: assim funciona
     também com o site aberto do computador (file://), onde o
     navegador bloqueia o acesso ao conteúdo do iframe.
  ================================================= */

  let contador = 0;
  const esperando = new Map();
  let idRet = -1;            // passo cujo retângulo estou acompanhando
  let retPagina = null;      // posição do alvo dentro do iframe (vem da ponte)

  window.addEventListener("message", (e) => {
    if (e.source !== iframe.contentWindow) return;
    const m = e.data;
    if (!m || m.tut !== true) return;
    if (m.tipo === "ret") {
      if (m.id === idRet) { retPagina = m.r; ultimoRet = ""; }
      return;
    }
    const resolver = esperando.get(m.id);
    if (resolver) { esperando.delete(m.id); resolver(m); }
  });

  function falarComPainel(mensagem) {
    try { iframe.contentWindow.postMessage({ tut: true, ...mensagem }, "*"); } catch (_) { /* painel fechado */ }
  }

  /* manda a mensagem e espera a resposta com o mesmo id (ou null se demorar) */
  function perguntar(mensagem, limite = 1500, id = ++contador) {
    return new Promise((ok) => {
      esperando.set(id, ok);
      falarComPainel({ id, ...mensagem });
      setTimeout(() => { if (esperando.has(id)) { esperando.delete(id); ok(null); } }, limite);
    });
  }

  /* ================================================
     NAVEGAÇÃO ATÉ A PÁGINA DO TUTORIAL
  ================================================= */

  function paginaAbertaE(arquivo) {
    if (!painelDinamico || painelDinamico.hidden) return false;
    const src = (iframe.getAttribute("src") || "").split(/[?#]/)[0];
    return src.endsWith(arquivo);
  }

  async function irParaPagina(t, minhaGeracao) {
    if (!t.pagina) return true;
    if (!paginaAbertaE(t.arquivo)) {
      const botao = document.querySelector(`.submenu-item[data-pagina="${t.pagina}"]`);
      if (!botao) return false;
      botao.click();
    }
    /* espero o painel carregar e a ponte dele responder que o elemento principal já existe (até 12 s) */
    const limite = Date.now() + 12000;
    while (Date.now() < limite) {
      if (minhaGeracao !== geracao) return false;
      if (paginaAbertaE(t.arquivo)) {
        const r = await perguntar({ tipo: "pronto?", seletor: t.pronto }, 600);
        if (minhaGeracao !== geracao) return false;
        if (r && r.tem && String(r.arquivo || "").endsWith("/" + t.arquivo)) {
          await esperar(250); // deixo os scripts da página desenharem
          return true;
        }
      }
      await esperar(200);
    }
    return false;
  }

  /* ================================================
     ACHAR O ALVO (menu e topo ficam nesta página)
  ================================================= */

  function elementoDoPasso(p) {
    if (!p.alvo || (p.onde !== "menu" && p.onde !== "topo")) return null;
    try { return document.querySelector(p.alvo); } catch (_) { return null; }
  }

  function visivel(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /* retângulo do alvo na tela; no painel somo a posição do iframe ao que a ponte mandou */
  function retanguloAtual(p) {
    if (p.onde === "pagina") {
      if (!ativo.temAlvo || !retPagina) return null;
      const f = iframe.getBoundingClientRect();
      return {
        left: Math.max(f.left, f.left + retPagina.left),
        top: Math.max(f.top, f.top + retPagina.top),
        right: Math.min(f.right, f.left + retPagina.right),
        bottom: Math.min(f.bottom, f.top + retPagina.bottom)
      };
    }
    const el = ativo.elemento;
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }

  /* ================================================
     MOSTRAR UM PASSO
  ================================================= */

  async function iniciar(id) {
    const t = TUTORIAIS.find((x) => x.id === id);
    if (!t) return;
    fecharCentral();
    encerrar(false);
    const minhaGeracao = ++geracao;
    ativo = { tutorial: t, passos: passosDoAparelho(t), indice: 0, elemento: null, temAlvo: false };

    /* menu recolhido no computador: abro para os passos do menu aparecerem */
    if (menuLateral.classList.contains("recolhido") && !ehCelular()) {
      const recolher = document.getElementById("botaoRecolherMenu");
      if (recolher) recolher.click();
    }

    criarCamada(true);
    montarBalao();
    if (t.pagina) {
      fecharGaveta();
      balao.innerHTML = `<div class="tut-carregando">Abrindo ${escapar(t.nome)}…</div>`;
      centralizarBalao();
      const ok = await irParaPagina(t, minhaGeracao);
      if (minhaGeracao !== geracao) return;
      if (!ok) {
        encerrar(false);
        avisar("Não consegui preparar o tutorial desta página. Atualize o site (Ctrl + F5) e tente de novo.");
        return;
      }
    }
    document.addEventListener("keydown", teclado, true);
    window.addEventListener("resize", aoRedimensionar);
    mostrarPasso(0, 1);
  }

  function montarBalao() {
    if (balao) return;
    foco = document.createElement("div");
    foco.className = "tut-foco";
    foco.hidden = true;
    balao = document.createElement("section");
    balao.className = "tut-balao";
    balao.setAttribute("role", "dialog");
    balao.setAttribute("aria-live", "polite");
    document.body.append(foco, balao);
    balao.addEventListener("click", (e) => {
      const acao = e.target.closest("[data-acao]");
      if (!acao) return;
      const a = acao.dataset.acao;
      if (a === "proximo") avancar(1);
      else if (a === "voltar") avancar(-1);
      else if (a === "pular") pular();
      else if (a === "central") { encerrar(false); abrirCentral(); }
      else if (a === "fim") encerrar(false);
    });
  }

  function avancar(direcao) {
    if (!ativo) return;
    const novo = ativo.indice + direcao;
    if (novo < 0) return;
    if (novo >= ativo.passos.length) { concluir(); return; }
    mostrarPasso(novo, direcao);
  }

  async function mostrarPasso(indice, direcao) {
    if (!ativo) return;
    const minhaGeracao = ++geracao;
    const p = ativo.passos[indice];
    ativo.indice = indice;

    /* gaveta do celular: aberta só para os passos do menu */
    if (p.onde === "menu") abrirGaveta(); else fecharGaveta();

    let existe = false;
    if (p.onde === "pagina") {
      /* peço para a ponte preparar, achar e rolar até o alvo; a posição chega depois por mensagem */
      const id = ++contador;
      idRet = id;
      retPagina = null;
      const r = await perguntar({ tipo: "passo", alvo: p.alvo, bloco: p.bloco, antes: p.antes, suave: !movimentoReduzido }, 2000, id);
      if (minhaGeracao !== geracao) return;
      existe = Boolean(r && r.existe);
      ativo.elemento = null;
    } else {
      /* passo do menu/topo ou sem alvo: o painel para de mandar posição */
      idRet = -1;
      if (ativo.tutorial.pagina) falarComPainel({ tipo: "pausa" });
      if (p.antes) {
        try { p.antes(document); } catch (_) { /* sigo mesmo assim */ }
        await esperar(80);
        if (minhaGeracao !== geracao) return;
      }
      if (p.onde === "menu" && ehCelular()) await esperar(260); // a gaveta desliza
      const el = elementoDoPasso(p);
      existe = visivel(el);
      ativo.elemento = existe ? el : null;
      if (existe) {
        try { el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: movimentoReduzido ? "auto" : "smooth" }); } catch (_) { el.scrollIntoView(); }
      }
    }

    /* passo opcional cujo alvo não existe agora (ex.: sem dados): pulo para o próximo na mesma direção */
    if (p.onde && !existe && p.opcional) {
      const seguinte = indice + (direcao < 0 ? -1 : 1);
      if (seguinte < 0) { mostrarPasso(0, 1); return; }
      if (seguinte >= ativo.passos.length) { concluir(); return; }
      mostrarPasso(seguinte, direcao);
      return;
    }
    ativo.temAlvo = existe;

    desenharBalao(p, indice);
    ultimoRet = "";
    cancelAnimationFrame(quadro);
    acompanhar();
    const botao = balao.querySelector('[data-acao="proximo"]');
    if (botao) botao.focus({ preventScroll: true });
  }

  function desenharBalao(p, indice) {
    const total = ativo.passos.length;
    const t = ativo.tutorial;
    const ultimo = indice === total - 1;
    balao.className = "tut-balao trocando";
    balao.setAttribute("aria-label", `${t.nome}: passo ${indice + 1} de ${total}`);
    balao.innerHTML = `
      <span class="tut-seta" hidden></span>
      <div class="tut-cabeca">
        <span class="tut-etapa">${indice + 1} de ${total}</span>
        <span class="tut-nome">${escapar(t.nome)}</span>
        <button type="button" class="tut-fechar" data-acao="pular" aria-label="Fechar tutorial" title="Fechar tutorial">×</button>
      </div>
      <h3 class="tut-titulo">${p.titulo}</h3>
      <div class="tut-texto">${p.texto}</div>
      ${p.dica ? `<div class="tut-dica">${p.dica}</div>` : ""}
      <div class="tut-progresso" aria-hidden="true"><span style="width:${((indice + 1) / total) * 100}%"></span></div>
      <div class="tut-rodape">
        <button type="button" class="tut-pular" data-acao="pular">Pular tutorial</button>
        <button type="button" class="tut-botao" data-acao="voltar" ${indice === 0 ? "disabled" : ""}>Voltar</button>
        <button type="button" class="tut-botao primario" data-acao="proximo">${ultimo ? "Concluir ✓" : "Próximo"}</button>
      </div>
      ${indice === 0 ? '<button type="button" class="tut-pular tut-ja-sei" data-acao="pular">Já sei usar esta página, pular</button>' : ""}
      <div class="tut-teclas"><kbd>←</kbd> <kbd>→</kbd> navegar · <kbd>Esc</kbd> sair</div>`;
    /* reinicio a animação de troca */
    void balao.offsetWidth;
  }

  /* acompanho o alvo a cada quadro: rolagem suave, gráficos redesenhando, gaveta abrindo */
  function acompanhar() {
    if (!ativo || !balao) return;
    posicionar();
    quadro = requestAnimationFrame(acompanhar);
  }

  function centralizarBalao() {
    const bw = balao.offsetWidth;
    const bh = balao.offsetHeight;
    balao.style.left = `${Math.max(12, (window.innerWidth - bw) / 2)}px`;
    balao.style.top = `${Math.max(12, (window.innerHeight - bh) / 2)}px`;
    const seta = balao.querySelector(".tut-seta");
    if (seta) seta.hidden = true;
  }

  function posicionar() {
    const p = ativo.passos[ativo.indice];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = retanguloAtual(p);

    if (!r) {
      foco.hidden = true;
      camada.classList.add("sem-alvo");
      centralizarBalao();
      return;
    }

    const chave = [r.left, r.top, r.right, r.bottom, vw, vh, balao.offsetHeight].map((n) => Math.round(n)).join(",");
    if (chave === ultimoRet) return;
    ultimoRet = chave;

    /* alvo rolado para fora da área visível: mostro o balão no meio até ele voltar */
    if (r.right - r.left < 2 || r.bottom - r.top < 2) {
      foco.hidden = true;
      camada.classList.add("sem-alvo");
      centralizarBalao();
      return;
    }

    camada.classList.remove("sem-alvo");
    foco.hidden = false;
    const folga = 6;
    const fx = Math.max(4, r.left - folga);
    const fy = Math.max(4, r.top - folga);
    const fw = Math.min(vw - 4, r.right + folga) - fx;
    const fh = Math.min(vh - 4, r.bottom + folga) - fy;
    Object.assign(foco.style, { left: `${fx}px`, top: `${fy}px`, width: `${fw}px`, height: `${fh}px` });

    const bw = balao.offsetWidth;
    const bh = balao.offsetHeight;
    const seta = balao.querySelector(".tut-seta");
    const espaco = 16;
    const borda = 12;
    const meioX = fx + fw / 2;
    const meioY = fy + fh / 2;
    let left;
    let top;
    let lado = null;

    if (ehCelular()) {
      /* celular: balão embaixo quando o alvo está em cima, e vice-versa */
      left = borda;
      top = meioY < vh / 2 ? Math.max(fy + fh + espaco, vh - bh - borda) : borda;
      if (meioY < vh / 2 && top + bh > vh - borda) top = vh - bh - borda;
      if (meioY >= vh / 2 && top + bh > fy - 4) top = Math.max(borda, Math.min(top, fy - bh - espaco));
    } else {
      /* tento os lados na ordem; no menu lateral prefiro à direita para não cobrir os itens de baixo */
      const lados = {
        embaixo: () => fy + fh + espaco + bh <= vh - borda && { top: fy + fh + espaco, left: meioX - bw / 2 },
        emcima: () => fy - espaco - bh >= borda && { top: fy - espaco - bh, left: meioX - bw / 2 },
        direita: () => fx + fw + espaco + bw <= vw - borda && { left: fx + fw + espaco, top: meioY - bh / 2 },
        esquerda: () => fx - espaco - bw >= borda && { left: fx - espaco - bw, top: meioY - bh / 2 }
      };
      const ordem = p.onde === "menu" ? ["direita", "embaixo", "emcima"] : ["embaixo", "emcima", "direita", "esquerda"];
      for (const nome of ordem) {
        const pos = lados[nome]();
        if (pos) { lado = nome; ({ left, top } = pos); break; }
      }
      if (!lado) {
        /* alvo enorme (ocupa a tela): balão no canto de baixo, por cima */
        left = vw - bw - 24;
        top = vh - bh - 24;
      }
    }

    left = Math.min(Math.max(borda, left), vw - bw - borda);
    top = Math.min(Math.max(borda, top), vh - bh - borda);
    balao.style.left = `${left}px`;
    balao.style.top = `${top}px`;

    if (!seta) return;
    seta.hidden = !lado;
    seta.className = "tut-seta";
    seta.style.left = seta.style.top = "";
    if (lado === "embaixo" || lado === "emcima") {
      seta.classList.add(lado === "embaixo" ? "em-cima" : "em-baixo");
      seta.style.left = `${Math.min(Math.max(16, meioX - left - 7), bw - 30)}px`;
    } else if (lado === "direita" || lado === "esquerda") {
      seta.classList.add(lado === "direita" ? "na-esquerda" : "na-direita");
      seta.style.top = `${Math.min(Math.max(16, meioY - top - 7), bh - 30)}px`;
    }
    seta.hidden = !lado;
  }

  function aoRedimensionar() { ultimoRet = ""; }

  function teclado(e) {
    if (!ativo) return;
    if (e.key === "Escape") { e.preventDefault(); pular(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); avancar(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); avancar(-1); }
  }

  /* ================================================
     FIM, PULAR E AVISOS
  ================================================= */

  function limparPagina() {
    /* devolvo o painel como estava: a ponte religa o encaixe da rolagem e
       roda o "depois" do tutorial (ex.: fechar o painel de filtro da Inteligência) */
    idRet = -1;
    retPagina = null;
    if (ativo && ativo.tutorial.pagina) falarComPainel({ tipo: "fim", depois: ativo.tutorial.depois || [] });
    if (ehCelular()) fecharGaveta();
  }

  function encerrar(mostrarAviso) {
    geracao++;
    cancelAnimationFrame(quadro);
    document.removeEventListener("keydown", teclado, true);
    document.removeEventListener("keydown", tecladoFinal, true);
    window.removeEventListener("resize", aoRedimensionar);
    if (ativo) limparPagina();
    ativo = null;
    if (foco) { foco.remove(); foco = null; }
    if (balao) { balao.remove(); balao = null; }
    removerCamada();
    if (mostrarAviso) avisar("Tutorial fechado. Para rever, é só clicar em Tutoriais no menu.");
  }

  function pular() { encerrar(true); }

  function concluir() {
    if (!ativo) return;
    const t = ativo.tutorial;
    marcarFeito(t.id);
    limparPagina();
    geracao++;
    cancelAnimationFrame(quadro);
    ativo.elemento = null;
    foco.hidden = true;
    criarCamada(true);
    const feitos = lerFeitos();
    const faltam = TUTORIAIS.filter((x) => !feitos.has(x.id)).length;
    balao.className = "tut-balao final";
    balao.innerHTML = `
      <span class="tut-final-icone" aria-hidden="true">🎉</span>
      <h3 class="tut-titulo">Tutorial concluído!</h3>
      <div class="tut-texto">Você terminou <b>${escapar(t.nome)}</b>. ${faltam ? `Ainda ${faltam === 1 ? "falta 1 tutorial" : `faltam ${faltam} tutoriais`} na central.` : "Você já fez todos os tutoriais do PRISMA. 👏"}</div>
      <div class="tut-progresso" aria-hidden="true"><span style="width:100%"></span></div>
      <div class="tut-rodape">
        <button type="button" class="tut-botao" data-acao="central" style="margin-right:auto">Ver outros tutoriais</button>
        <button type="button" class="tut-botao primario" data-acao="fim">Fechar</button>
      </div>`;
    centralizarBalao();
    const fim = balao.querySelector('[data-acao="fim"]');
    if (fim) fim.focus();
    soltarConfete();
    ativo = { tutorial: t, passos: [], indice: 0, elemento: null, terminado: true };
    document.removeEventListener("keydown", teclado, true);
    document.addEventListener("keydown", tecladoFinal, true);
  }

  function tecladoFinal(e) {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      document.removeEventListener("keydown", tecladoFinal, true);
      encerrar(false);
    }
  }

  function soltarConfete() {
    if (movimentoReduzido) return;
    const cores = ["#2F6BFF", "#22D3FF", "#2EE6C8", "#FFC24A", "#FF8A2B", "#9B6BFF"];
    const caixa = document.createElement("div");
    caixa.className = "tut-confete";
    for (let i = 0; i < 70; i++) {
      const peca = document.createElement("i");
      peca.style.left = `${Math.random() * 100}%`;
      peca.style.background = cores[i % cores.length];
      peca.style.animationDelay = `${Math.random() * 0.6}s`;
      peca.style.setProperty("--dx", `${(Math.random() - 0.5) * 220}px`);
      peca.style.setProperty("--giro", `${360 + Math.random() * 720}deg`);
      caixa.appendChild(peca);
    }
    document.body.appendChild(caixa);
    setTimeout(() => caixa.remove(), 3400);
  }

  let fimAviso = null;
  function avisar(texto) {
    let aviso = document.querySelector(".tut-aviso");
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.className = "tut-aviso";
      aviso.setAttribute("role", "status");
      document.body.appendChild(aviso);
    }
    aviso.textContent = texto;
    clearTimeout(fimAviso);
    fimAviso = setTimeout(() => aviso.remove(), 4200);
  }

  /* ================================================
     LIGAÇÕES
  ================================================= */

  botaoTutorial.addEventListener("click", abrirCentral);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && central) { e.preventDefault(); fecharCentral(); botaoTutorial.focus(); }
  });

  /* pontinho de "novo" até a primeira vez que a pessoa abrir a central */
  try { if (!localStorage.getItem(CHAVE_VISTO)) botaoTutorial.classList.add("novo"); } catch (_) { /* sem memória */ }
})();
