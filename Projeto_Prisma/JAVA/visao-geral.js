
/*
=====================================================
 PRISMA — VISÃO GERAL
 Navegação dinâmica e menu lateral retrátil
 (no celular, o menu vira uma gaveta aberta pelo botão MENU)

 Compatível com:
 HTML/visao-geral.html
 CSS/visao-geral.css

 Ambiente demonstrativo — GitHub Pages
=====================================================
*/

(() => {
  "use strict";

  /* ================================================
     ELEMENTOS DA INTERFACE
  ================================================= */

  const menuLateral = document.getElementById(
    "menuLateral"
  );

  const botaoRecolherMenu = document.getElementById(
    "botaoRecolherMenu"
  );

  const botaoVisaoGeral = document.getElementById(
    "botaoVisaoGeral"
  );

  const botaoExpandirMenu = document.getElementById(
    "botaoExpandirMenu"
  );

  const submenu = document.getElementById(
    "submenuDashboards"
  );

  const botaoAbrirMenu = document.getElementById("botaoAbrirMenu");
  const botaoFecharMenu = document.getElementById("botaoFecharMenu");
  const menuFundo = document.getElementById("menuFundo");

  const botaoExpandirInteligencia = document.getElementById("botaoExpandirInteligencia");
  const submenuInteligencia = document.getElementById("submenuInteligencia");
  const botaoFormularioReuniao = document.getElementById("botaoFormularioReuniao");
  const submenuFormularioReuniao = document.getElementById("submenuFormularioReuniao");

  const paginaInicial = document.getElementById(
    "paginaInicial"
  );

  const painelDinamico = document.getElementById(
    "painelDinamico"
  );

  const iframe = document.getElementById(
    "iframeDashboard"
  );

  const carregando = document.getElementById(
    "painelCarregando"
  );

  const tituloPagina = document.getElementById(
    "tituloPagina"
  );

  const subtituloPagina = document.getElementById(
    "subtituloPagina"
  );

  const botoesDashboards = Array.from(
    document.querySelectorAll(
      ".submenu-item[data-pagina]"
    )
  );

  /* ================================================
     VALIDAÇÃO INICIAL
  ================================================= */

  const elementosObrigatorios = [
    menuLateral,
    botaoRecolherMenu,
    botaoVisaoGeral,
    botaoExpandirMenu,
    submenu,
    paginaInicial,
    painelDinamico,
    iframe,
    carregando,
    tituloPagina,
    subtituloPagina
  ];

  if (elementosObrigatorios.some(el => !el)) {
    console.error(
      "PRISMA: elementos obrigatórios não encontrados."
    );
    return;
  }

  /* ================================================
     CONFIGURAÇÕES
  ================================================= */

  const movimentoReduzido = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const DURACAO_TRANSICAO = movimentoReduzido
    ? 0
    : 180;

  const PAGINAS = {
    "visao-geral": {
      titulo: "Visão Geral",
      subtitulo:
        "Central de Inteligência e Gestão Integrada"
    },

    "inteligencia": {
      titulo: "Inteligência de Rede",
      subtitulo:
        "Análise territorial e rede assistencial"
    },

    /* CRM: um Kanban só, com o filtro de setor (antes eram 8 itens no menu) */
    "estudo-reclamacoes": { titulo: "Estudo de reclamações", subtitulo: "Reclamações, Reclame Aqui e Ouvidoria" },
    "volume-produtividade": { titulo: "Volume e produtividade", subtitulo: "Encerrados e demanda em aberto por colaborador" },
    "kanban-crm": { titulo: "CRM", subtitulo: "Kanban de tratativas · escolha o seu setor no filtro" },
    "geolocalizacao": {
      titulo: "Geolocalização de vidas e rede",
      subtitulo: "Rede credenciada × beneficiários no Estado do Rio de Janeiro"
    },

    "formulario-reuniao": {
      titulo: "Formulário para a reunião",
      subtitulo: "Registro de assuntos para as reuniões setoriais"
    },

    "assuntos-por-setor": {
      titulo: "Assuntos por setor",
      subtitulo: "Acompanhamento dos assuntos e suas conclusões"
    },

    "captacao-cadastro": {
      titulo: "Captação / Cadastro",
      subtitulo:
        "Indicadores de captação e cadastro"
    },

    "financeiro-credenciamento": {
      titulo: "Financeiro / Credenciamento",
      subtitulo:
        "Indicadores financeiros e rede credenciada"
    },

    "crm": {
      titulo: "CRM / Atendimento",
      subtitulo:
        "Monitoramento de protocolos e atendimento"
    },

    "nip": {
      titulo: "NIP",
      subtitulo:
        "Monitoramento de demandas e notificações"
    },

    "usuarios": { titulo: "Usuários", subtitulo: "Contas, papéis e setores (só o gestor)" }
  };

  /* ================================================
     ESTADO DA APLICAÇÃO
  ================================================= */

  let paginaAtual = "visao-geral";

  let urlAtual = "";

  let identificadorNavegacao = 0;

  let temporizadorTransicao = null;

  let temporizadorCarregamento = null;

  let menuRecolhido = false;

  /* ================================================
     CONTROLE DO MENU LATERAL
  ================================================= */

  function definirMenuLateral(recolhido) {
    menuRecolhido = recolhido;

    menuLateral.classList.toggle(
      "recolhido",
      recolhido
    );

    botaoRecolherMenu.setAttribute(
      "aria-expanded",
      String(!recolhido)
    );

    const descricao = recolhido
      ? "Expandir menu lateral"
      : "Recolher menu lateral";

    botaoRecolherMenu.setAttribute(
      "aria-label",
      descricao
    );

    botaoRecolherMenu.title = descricao;

    /*
      Quando recolhido, o submenu fica oculto
      pelo CSS. Ao expandir, o estado anterior
      do submenu é preservado.
    */

    if (recolhido) {
      botaoVisaoGeral.title =
        "Expandir menu e abrir Visão Geral";
    } else {
      botaoVisaoGeral.title = "Visão Geral";
    }
  }

  botaoRecolherMenu.addEventListener(
    "click",
    () => {
      definirMenuLateral(!menuRecolhido);
    }
  );

  /* ================================================
     GAVETA DO MENU (CELULAR)
     Fechada: só o botão MENU aparece no topo.
     Aberta: o menu desliza por cima do conteúdo.
  ================================================= */

  const telaCelular = window.matchMedia("(max-width: 700px)");

  let gavetaAberta = false;

  function definirGaveta(aberta, devolverFoco = true) {
    if (!botaoAbrirMenu || !menuFundo) return;

    gavetaAberta = aberta && telaCelular.matches;

    menuLateral.classList.toggle("aberto-celular", gavetaAberta);
    menuFundo.hidden = !gavetaAberta;
    document.body.classList.toggle("menu-aberto", gavetaAberta);

    botaoAbrirMenu.setAttribute("aria-expanded", String(gavetaAberta));

    if (gavetaAberta) {
      // no celular a gaveta mostra tudo: nada de menu recolhido
      if (menuRecolhido) definirMenuLateral(false);
      if (botaoFecharMenu) botaoFecharMenu.focus();
    } else if (devolverFoco && telaCelular.matches) {
      botaoAbrirMenu.focus();
    }
  }

  // fecha a gaveta depois de escolher uma página
  function fecharGavetaAoNavegar() {
    if (gavetaAberta) definirGaveta(false, false);
  }

  if (botaoAbrirMenu && menuFundo) {
    botaoAbrirMenu.addEventListener("click", () => definirGaveta(true));

    if (botaoFecharMenu) {
      botaoFecharMenu.addEventListener("click", () => definirGaveta(false));
    }

    menuFundo.addEventListener("click", () => definirGaveta(false));

    document.addEventListener("keydown", evento => {
      if (evento.key === "Escape" && gavetaAberta) {
        definirGaveta(false);
      }
    });

    // se a tela crescer (girar o celular, por exemplo), a gaveta fecha sozinha
    const aoMudarTela = () => {
      if (!telaCelular.matches && gavetaAberta) {
        definirGaveta(false, false);
      }
    };

    if (telaCelular.addEventListener) {
      telaCelular.addEventListener("change", aoMudarTela);
    } else {
      telaCelular.addListener(aoMudarTela);
    }
  }

  /* ================================================
     CONTROLE DO SUBMENU
  ================================================= */

  function definirSubmenu(aberto) {
    submenu.classList.toggle(
      "aberto",
      aberto
    );

    botaoExpandirMenu.setAttribute(
      "aria-expanded",
      String(aberto)
    );

    const descricao = aberto
      ? "Recolher dashboards"
      : "Expandir dashboards";

    botaoExpandirMenu.setAttribute(
      "aria-label",
      descricao
    );

    botaoExpandirMenu.title = descricao;
  }

  botaoExpandirMenu.addEventListener(
    "click",
    () => {
      /*
        Se o menu lateral estiver recolhido,
        primeiro ele será expandido.
      */

      if (menuRecolhido) {
        definirMenuLateral(false);
        definirSubmenu(true);
        return;
      }

      const aberto = submenu.classList.contains(
        "aberto"
      );

      definirSubmenu(!aberto);
    }
  );

  /* SUBMENU INTELIGÊNCIA DE REDE (pedido do autor, 18/11/2026):
     o nome abre o painel; a setinha mostra Estudo de reclamações e CRM */
  function definirSubmenuInteligencia(aberto) {
    if (!submenuInteligencia || !botaoExpandirInteligencia) return;
    submenuInteligencia.hidden = !aberto;
    submenuInteligencia.classList.toggle("aberto", aberto);
    botaoExpandirInteligencia.setAttribute("aria-expanded", String(aberto));
    botaoExpandirInteligencia.setAttribute("aria-label", aberto ? "Recolher Inteligência de Rede" : "Expandir Inteligência de Rede");
  }
  if (botaoExpandirInteligencia && submenuInteligencia) {
    botaoExpandirInteligencia.addEventListener("click", () => {
      if (menuRecolhido) definirMenuLateral(false);
      definirSubmenu(true);
      definirSubmenuInteligencia(submenuInteligencia.hidden);
    });
    definirSubmenuInteligencia(false);
  }

  /* páginas que ficam dentro do grupo da Inteligência de Rede (CRM e Estudo de reclamações) */
  const ehDaInteligencia = (idPagina) =>
    idPagina.startsWith("kanban-") || ["estudo-reclamacoes", "volume-produtividade"].includes(idPagina);

  /* nessas páginas o grupo fica aberto para a página aberta aparecer no menu */
  function abrirGrupoDaPagina(idPagina) {
    if (ehDaInteligencia(idPagina)) definirSubmenuInteligencia(true);
  }

  /* ================================================
     SUBMENU FORMULÁRIO DE REUNIÃO
  ================================================= */

  function definirSubmenuFormularioReuniao(aberto) {
    if (!botaoFormularioReuniao || !submenuFormularioReuniao) return;
    submenuFormularioReuniao.hidden = !aberto;
    submenuFormularioReuniao.classList.toggle("aberto", aberto);
    botaoFormularioReuniao.setAttribute("aria-expanded", String(aberto));
    botaoFormularioReuniao.setAttribute(
      "aria-label",
      aberto ? "Recolher Formulário de reunião" : "Expandir Formulário de reunião"
    );
  }

  if (botaoFormularioReuniao && submenuFormularioReuniao) {
    botaoFormularioReuniao.addEventListener("click", () => {
      if (menuRecolhido) definirMenuLateral(false);
      definirSubmenu(true);
      definirSubmenuFormularioReuniao(submenuFormularioReuniao.hidden);
    });
    definirSubmenuFormularioReuniao(false);
  }

  /* ================================================
     CABEÇALHO DINÂMICO
  ================================================= */

  function atualizarCabecalho(idPagina) {
    const pagina = PAGINAS[idPagina];

    if (!pagina) return;

    tituloPagina.textContent = pagina.titulo;

    subtituloPagina.textContent = pagina.subtitulo;

    document.title = `PRISMA | ${pagina.titulo}`;
  }

  /* ================================================
     MENU ATIVO
  ================================================= */

  function atualizarMenuAtivo(idPagina) {
    const visaoGeralAtiva =
      idPagina === "visao-geral";

    botaoVisaoGeral.classList.toggle(
      "ativo",
      visaoGeralAtiva
    );

    if (visaoGeralAtiva) {
      botaoVisaoGeral.setAttribute(
        "aria-current",
        "page"
      );
    } else {
      botaoVisaoGeral.removeAttribute(
        "aria-current"
      );
    }

    if (botaoFormularioReuniao) {
      const ativoFormularioReuniao = ["formulario-reuniao", "assuntos-por-setor"].includes(idPagina);
      botaoFormularioReuniao.classList.toggle("ativo", ativoFormularioReuniao);
      if (ativoFormularioReuniao) definirSubmenuFormularioReuniao(true);
    }

    abrirGrupoDaPagina(idPagina);

    botoesDashboards.forEach(botao => {
      const ativo =
        botao.dataset.pagina === idPagina;

      botao.classList.toggle(
        "ativo",
        ativo
      );

      if (ativo) {
        botao.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        botao.removeAttribute(
          "aria-current"
        );
      }
    });
  }

  /* ================================================
     INDICADOR DE CARREGAMENTO
  ================================================= */

  function mostrarCarregamento() {
    carregando.hidden = false;

    iframe.classList.add("trocando");

    iframe.setAttribute(
      "aria-busy",
      "true"
    );
  }

  function ocultarCarregamento() {
    carregando.hidden = true;

    iframe.classList.remove("trocando");

    iframe.removeAttribute("aria-busy");
  }

  /* ================================================
     TEMPORIZADORES
  ================================================= */

  function limparTemporizadores() {
    if (temporizadorTransicao !== null) {
      clearTimeout(temporizadorTransicao);
      temporizadorTransicao = null;
    }

    if (temporizadorCarregamento !== null) {
      clearTimeout(temporizadorCarregamento);
      temporizadorCarregamento = null;
    }
  }

  /* ================================================
     VOLTAR À VISÃO GERAL
  ================================================= */

  function abrirVisaoGeral() {
    /*
      Se o menu estiver recolhido, clicar no
      ícone Visão Geral expande o menu.
    */

    if (menuRecolhido) {
      definirMenuLateral(false);
    }

    if (paginaAtual === "visao-geral") {
      return;
    }

    identificadorNavegacao++;

    limparTemporizadores();

    paginaAtual = "visao-geral";
    urlAtual = "";

    atualizarCabecalho("visao-geral");
    atualizarMenuAtivo("visao-geral");

    painelDinamico.hidden = true;
    paginaInicial.hidden = false;

    ocultarCarregamento();

    /*
      Libera o dashboard anterior.
      A estrutura principal não recarrega.
    */

    iframe.removeAttribute("src");
  }

  /* ================================================
     ABRIR DASHBOARD
  ================================================= */

  function abrirDashboard(idPagina, url) {
    // página que o papel da pessoa não abre: não carrega (o banco também recusa os dados)
    if (window.PrismaSessao && !window.PrismaSessao.podePagina(idPagina)) {
      console.warn("PRISMA: sem permissão para", idPagina);
      return;
    }

    if (!url || !PAGINAS[idPagina]) {
      console.warn(
        "PRISMA: dashboard indisponível:",
        idPagina
      );
      return;
    }

    /*
      Evita recarregar o mesmo dashboard.
    */

    if (
      paginaAtual === idPagina &&
      urlAtual === url
    ) {
      return;
    }

    identificadorNavegacao++;

    const navegacaoAtual = identificadorNavegacao;

    limparTemporizadores();

    paginaAtual = idPagina;
    urlAtual = url;

    atualizarCabecalho(idPagina);
    atualizarMenuAtivo(idPagina);

    paginaInicial.hidden = true;
    painelDinamico.hidden = false;

    /*
      Mantém o menu aberto ou recolhido
      conforme a escolha do usuário.
    */

    mostrarCarregamento();

    temporizadorTransicao = window.setTimeout(
      () => {
        if (
          navegacaoAtual !== identificadorNavegacao
        ) {
          return;
        }

        iframe.title =
          `Dashboard ${PAGINAS[idPagina].titulo}`;

        iframe.src = url;
      },
      DURACAO_TRANSICAO
    );
  }

  /* ================================================
     CARREGAMENTO DO IFRAME
  ================================================= */

  iframe.addEventListener("load", () => {
    if (paginaAtual === "visao-geral") {
      return;
    }

    /*
      Pequeno intervalo para evitar
      transições visuais bruscas.
    */

    const navegacaoAtual = identificadorNavegacao;

    if (temporizadorCarregamento !== null) {
      clearTimeout(temporizadorCarregamento);
    }

    temporizadorCarregamento = window.setTimeout(
      () => {
        if (
          navegacaoAtual !== identificadorNavegacao
        ) {
          return;
        }

        ocultarCarregamento();
      },
      movimentoReduzido ? 0 : 100
    );
  });

  /* ================================================
     EVENTOS DE NAVEGAÇÃO
  ================================================= */

  botaoVisaoGeral.addEventListener(
    "click",
    () => {
      abrirVisaoGeral();
      fecharGavetaAoNavegar();
    }
  );

  botoesDashboards.forEach(botao => {
    botao.addEventListener("click", () => {
      if (botao.disabled) return;

      fecharGavetaAoNavegar();

      const idPagina = botao.dataset.pagina;
      const url = botao.dataset.url;

      if (["formulario-reuniao", "assuntos-por-setor"].includes(idPagina)) {
        if (menuRecolhido) definirMenuLateral(false);
        definirSubmenu(true);
        definirSubmenuFormularioReuniao(true);
      }

      if (ehDaInteligencia(idPagina)) {
        if (menuRecolhido) definirMenuLateral(false);
        definirSubmenu(true);
        abrirGrupoDaPagina(idPagina);
      }

      abrirDashboard(idPagina, url);
    });
  });

  /* ================================================
     INICIALIZAÇÃO
  ================================================= */

  definirMenuLateral(false);

  definirSubmenu(true);

  atualizarMenuAtivo("visao-geral");

  atualizarCabecalho("visao-geral");

  paginaInicial.hidden = false;
  painelDinamico.hidden = true;

  /* ================================================
     LOGIN DE VERDADE (Supabase)
     Sem sessão, o sessao.js manda de volta para o login.
     Com sessão: nome e e-mail no rodapé do menu, só as
     páginas do papel da pessoa e "Sair" encerrando a sessão.
     Sem o Supabase configurado, nada muda (demonstração).
  ================================================= */

  const sessao = window.PrismaSessao;

  if (sessao && sessao.configurado) {
    sessao.protegerCasca().then(perfil => {
      if (!perfil) return;

      const nome = document.querySelector(".usuario-nome");
      const email = document.querySelector(".usuario-email");
      if (nome) nome.textContent = perfil.nome || perfil.email;
      // "Olá, Fulano!" das boas-vindas: só o primeiro nome
      const ola = document.querySelector(".pagina-inicial h2 .texto-espectro, #paginaInicial h2 .texto-espectro");
      if (ola) ola.textContent = (perfil.nome || "").trim().split(/\s+/)[0] || "bem-vindo";
      if (email) email.textContent = perfil.email;

      // esconde o que o papel não abre (só organiza a tela; quem protege é o RLS)
      document.querySelectorAll("[data-pagina]").forEach(el => {
        const codigo = el.dataset.pagina;
        if (codigo !== "visao-geral" && !sessao.podePagina(codigo)) el.hidden = true;
      });

      // grupo do menu que ficou sem nenhuma página visível some junto com o botão que o abre
      document.querySelectorAll(".submenu").forEach(grupo => {
        const visiveis = grupo.querySelectorAll(".submenu-item[data-pagina]:not([hidden])").length;
        if (visiveis) return;
        grupo.hidden = true;
        if (grupo.id) {
          document.querySelectorAll(`[aria-controls="${grupo.id}"]`).forEach(b => { b.hidden = true; });
        }
      });

      // colaborador: não abre o painel da Inteligência, mas abre o CRM que fica dentro dela.
      // Nesse caso o grupo fica sempre aberto e a setinha some (senão sobraria só a seta solta).
      const itemInteligencia = document.querySelector('.submenu-item[data-pagina="inteligencia"]');
      if (itemInteligencia && itemInteligencia.hidden && submenuInteligencia) {
        const filhos = submenuInteligencia.querySelectorAll(".submenu-item[data-pagina]:not([hidden])").length;
        if (filhos) {
          definirSubmenuInteligencia(true);
          if (botaoExpandirInteligencia) botaoExpandirInteligencia.hidden = true;
        }
      }

      const sair = document.getElementById("botaoSair");
      if (sair) {
        sair.addEventListener("click", e => {
          e.preventDefault();
          sessao.sair();
        });
      }

      // conta com senha provisória: só passa daqui depois de trocar a senha
      if (perfil.trocarSenha) mostrarTrocaSenha(sessao);
    });
  }

  /* ================================================
     TROCA OBRIGATÓRIA DA SENHA PROVISÓRIA
     A janela não fecha com Esc nem clicando fora: ou troca a senha, ou sai.
  ================================================= */

  function mostrarTrocaSenha(sessao) {
    const janela = document.createElement("dialog");
    janela.className = "troca-senha";
    janela.setAttribute("aria-labelledby", "trocaTitulo");

    const form = document.createElement("form");
    form.noValidate = true;

    const titulo = document.createElement("h2");
    titulo.id = "trocaTitulo";
    titulo.textContent = "Crie a sua senha";

    const texto = document.createElement("p");
    texto.textContent = "Você entrou com uma senha provisória. Antes de continuar, escolha uma senha só sua (8 caracteres ou mais, com letras e números).";

    const campo = (rotulo, id) => {
      const label = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = rotulo;
      const input = document.createElement("input");
      input.type = "password";
      input.id = id;
      input.autocomplete = "new-password";
      input.maxLength = 72;
      input.required = true;
      label.append(span, input);
      return { label, input };
    };
    const nova = campo("Nova senha", "trocaNova");
    const confirma = campo("Repita a nova senha", "trocaConfirma");

    const msg = document.createElement("p");
    msg.className = "troca-msg";
    msg.setAttribute("role", "status");
    msg.setAttribute("aria-live", "polite");

    const acoes = document.createElement("div");
    acoes.className = "troca-acoes";
    const botaoSair = document.createElement("button");
    botaoSair.type = "button";
    botaoSair.className = "troca-sair";
    botaoSair.textContent = "Sair";
    botaoSair.addEventListener("click", () => sessao.sair());
    const botaoSalvar = document.createElement("button");
    botaoSalvar.type = "submit";
    botaoSalvar.className = "troca-salvar";
    botaoSalvar.textContent = "Salvar senha";
    acoes.append(botaoSair, botaoSalvar);

    form.append(titulo, texto, nova.label, confirma.label, msg, acoes);
    janela.appendChild(form);
    document.body.appendChild(janela);

    janela.addEventListener("cancel", e => e.preventDefault());   // Esc não fecha

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const s = nova.input.value;
      if (s.length < 8 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) {
        msg.textContent = "A senha precisa de 8 caracteres ou mais, com letras e números.";
        return;
      }
      if (s !== confirma.input.value) {
        msg.textContent = "As duas senhas não são iguais.";
        return;
      }
      botaoSalvar.disabled = true;
      botaoSalvar.textContent = "Salvando...";
      const r = await sessao.trocarSenha(s);
      if (!r.ok) {
        msg.textContent = r.erro;
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar senha";
        return;
      }
      // recarrego para o menu aparecer já com as páginas liberadas
      window.location.reload();
    });

    janela.showModal();
    nova.input.focus();
  }

  /* ================================================
     LIMPEZA DOS DADOS DE TESTE (20/11/2026)
     O autor pediu para zerar o que foi importado só para testar. O CRM e o
     Formulário agora guardam em "prisma_kanban" e "prisma_assuntos_reuniao";
     aqui eu apago os dois lugares antigos, onde ficaram as planilhas de teste.
     (Os nomes antigos precisam aparecer aqui só para o navegador achar o que apagar.)
     Tema e tutoriais (prisma-tema, prisma-tutoriais-...) não são tocados.
  ================================================= */

  try { indexedDB.deleteDatabase("nexus_v2_kanban"); } catch (_) { /* navegador sem IndexedDB */ }
  try { localStorage.removeItem("nexus_v2_assuntos_reuniao"); } catch (_) { /* sem armazenamento */ }

  console.info(
    "PRISMA: navegação dinâmica inicializada."
  );

})();
