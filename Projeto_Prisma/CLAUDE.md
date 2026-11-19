# CLAUDE.md — Projeto NEXUS (Inteligência de Dados)

> Arquivo de instruções e contexto para o Claude Code. Ele é lido automaticamente ao abrir esta pasta.
> Versão 11 · 17/11/2026. Itens marcados com ⚠️ estão **pendentes** e precisam de definição.
> A pasta do projeto agora se chama **`Projeto_Prisma`** (antes `projeto_saude`), renomeada pelo autor em 17/11/2026.

## 1. Objetivo
Site chamado **NEXUS (Inteligência de Dados)**, uma **peça de portfólio própria** do autor. **Não tem ligação com nenhuma empresa**: o site não se apresenta como sendo de uma empresa (nada de ASSEFAZ na marca, títulos ou textos sobre o projeto). Mas o código **sempre lê a planilha original como ela vem**: nomes de colunas e valores (ex.: "PROGRAMA DE IMUNIZACAO ASSEFAZ" nas regras de setor) não devem ser trocados. Tem uma tela de login e uma página por setor de uma operadora de saúde fictícia. Cada página tem indicadores já programados, que se preenchem quando o usuário importa uma planilha Excel ou CSV na própria página.

## 2. Arquitetura

### Nova direção (decisão do autor, 17/11/2026)
- **Todo o projeto passa a ser pensado e construído com foco em segurança.** Toda mudança deve ser avaliada por esse lado: quem pode ver, quem pode alterar e o que acontece se alguém abrir o endereço direto ou mexer no navegador.
- **Login de verdade com Supabase Auth**, substituindo a lista `USUARIOS_AUTORIZADOS` no `login.js`. A verificação passa a ser feita no servidor do Supabase, e não mais no navegador.
- **Banco de dados PostgreSQL** para os dados do projeto. Ele substitui o `localStorage` e o IndexedDB (formulário de reunião, assuntos por setor, kanban), que hoje só guardam no navegador de quem usa.
- A ordem de trabalho é começar **do início, pelo login** (visual novo + autenticação). Depois, as outras páginas, uma por vez.
- ⚠️ A definir com o autor antes de implementar: se o Postgres é o do próprio Supabase ou separado; se continua no GitHub Pages; forma de login (e-mail e senha, link mágico etc.); quem cria as contas; se o projeto continua como peça de portfólio ou passa a ter uso real com dados reais (isso muda as exigências da LGPD).

### Regras de segurança (valem para todo código novo)
- **Nenhuma chave secreta no código do site.** No navegador só pode ir a chave pública do Supabase (`anon`/publishable). A chave `service_role` nunca entra no repositório nem no site.
- **Toda tabela com RLS (Row Level Security) ligada** e políticas explícitas. A segurança dos dados fica no banco, nunca só em esconder botões no JavaScript.
- **Páginas internas só abrem com sessão válida.** Sem sessão, voltam para o login.
- Nada de dado pessoal na URL, no `localStorage` nem no console.
- Textos vindos da planilha ou do banco entram na página como texto (`textContent` ou escape), nunca como HTML cru.
- Senhas, chaves e arquivos `.env` nunca vão para o GitHub.

### Regras que continuam
- **HTML, CSS e JavaScript puros**, sem framework e sem build (a biblioteca do Supabase entra como arquivo local, como o SheetJS).
- ⚠️ A regra antiga "sem banco de dados e sem servidor, os dados ficam só no navegador" foi **substituída** pela nova direção acima. Até a migração terminar, as páginas que ainda não usam o banco continuam processando a planilha só no navegador.
- **Bibliotecas offline:** SheetJS (leitura e exportação de Excel) e Chart.js (gráficos) devem ficar dentro do projeto, sem depender de CDN. Hoje ainda carregam do jsDelivr, e isso precisa ser corrigido.
- **Responsivo:** deve funcionar bem no celular.
- **Código, nomes e comentários em português.**
- Como é uma peça de portfólio, nenhum dado real de beneficiários deve ir para o repositório público do GitHub, nem mesmo planilhas de exemplo reais.

## 3. Estrutura do repositório
Repositório: `CaduAnalista/Projeto_dashb` (⚠️ confirmar se o nome mudou junto com a pasta)

```
index.html            → redireciona para o login
HTML/   login.html, visao-geral.html (casca com menu lateral que abre as outras páginas num iframe),
        inteligencia.html, kanban-tratativas.html, geolocalizacao.html (antigo saude-social.html),
        formulario-reuniao.html, assuntos-por-setor.html, cad-cap.html
CSS/    um .css por página; a Geolocalização usa geolocalizacao.css + geolocalizacao-prisma.css
        (saude-social.css, rede-integrada.css e saude-social-nexus.css eram da página antiga e não são mais carregados)
JAVA/   login.js, visao-geral.js, visao-geral-problemas-setoriais.js (submenu "Problemas-Setoriais"),
        inteligencia.js, kanban-tratativas.js, geolocalizacao.js (saude-social.js = página antiga, sem uso),
        formulario-reuniao.js, assuntos-por-setor.js, cad-cap.js
        nexus.js       → personagem animado (camadas, olhar, piscadas, expressões)
        fundo-rede.js  → fundo animado do login (rede de pontos; vira "dobra espacial" no portal)
        portal-fumaca.js → fumaça da transição de portal (canvas em meia resolução)
        portal-chegada.js → fim da transição de portal, incluído no <head> das páginas de destino
        som-portal.js  → som da transição de portal, gerado na hora (Web Audio API, sem arquivo de áudio)
ASSETS/ imagens
        optmus-*.png / .webp   → mascote antiga (a remover)
        nexus-completo.png     → NEXUS com olhos (referência oficial)
        nexus-olhos-vazios.png → NEXUS com olhos vazios (fonte das camadas)
        nexus-corpo.png        → camada do corpo (1105 × 1064: cortada onde o esmaecimento termina; miolo da cabeça encolhido 40 px, fica escondido)
        nexus-cabeca.png       → camada da cabeça (recorte x 316, y 0, 464 × 533)
        nexus-icone-512.png / nexus-icone-64.png → ícone da cabeça (logo e favicon)
LIB/    xlsx-0.20.3.full.min.js + xlsx-LICENSE.txt → SheetJS oficial, versão fixa, dentro do projeto (offline)
EXEMPLOS/ crm-ficticio-inteligencia-de-rede.xlsx → 14.000 linhas FICTÍCIAS no formato do CRM (para testar e para o portfólio;
        só as categorias vêm da planilha real, sem nada com o nome da empresa)
ARQUIVO/inteligencia-v1/ → cópia da página Inteligência de Rede antes da reformulação (03/11/2026); pode ser apagada quando não servir mais
ARQUIVO/inteligencia-v2/ → cópia da Inteligência de Rede antes do novo visual (v3, 18/11/2026); apagar quando a v3 for aprovada
nexus-personagem.js    → protótipo antigo da versão SVG rejeitada (já substituído por JAVA/nexus.js; pode ser apagado)
.claude/launch.json    → servidor local só para testes no painel de navegador do Claude (o site não depende dele)
```

## 4. Login
- ⏭️ **Será refeito (pedido do autor, 17/11/2026):** visual novo e autenticação real pelo Supabase (seção 2). É a primeira etapa da nova fase. O que está descrito abaixo é o login **atual**, que serve de ponto de partida.
- **Login novo PRISMA, decisões do autor (17/11/2026):**
  - **Tudo vira PRISMA**: a marca do sistema e o robô passam a se chamar PRISMA, com o slogan "Múltiplas visões, uma direção." O nome NEXUS sai do site, aos poucos, começando pelo login.
  - Referência visual enviada pelo autor: robô branco com visor escuro, prisma de cristal na cabeça e um prisma triangular no peito; feixes de luz em espectro (violeta, azul, ciano, laranja) atrás dele; cartão de login de vidro à direita com logo PRISMA, selo "ONLINE", "CENTRAL DE INDICADORES" e "Acesse a Visão Geral"; pirâmides de cristal e piso que reflete. O autor aceita mais sofisticação, desde que eu avise o que mudo.
  - **Robô:** o autor gera as imagens em PNG sem fundo, a partir dos prompts que eu passo. Uma versão é a oficial; a outra tem o visor vazio (os olhos são desenhados em código e animados) e o prisma do peito apagado (o brilho acende em código).
  - **Formulário:** e-mail e senha (com "esqueci a senha"), já no formato do login seguro. Até o Supabase entrar, continua o acesso de teste. Sai a frase "os dados ficam só no seu navegador".
  - **Ao acertar o login:** os feixes de luz atrás do robô começam a se mover e entram no prisma do peito por trás. O peito se enche de brilho e sai dele uma **seta de luz** que leva para a próxima página. Tudo fluido.
  - **Efeitos:** som novo para essa animação, no mesmo estilo suave; a fumaça do portal sai.
  - **Ao errar o login (pedido do autor, 17/11/2026):** **só o visor** fica vermelho, com olhos e boca de **triste**. A tela inteira **não** fica vermelha mais. Por isso olhos e boca são desenhados em código sobre o visor vazio.
- ✅ **Login PRISMA implementado e aprovado pelo autor em 17/11/2026** (luz volumétrica em tons quentes e azul, robô novo, pirâmides na paleta nova). Como ficou:
  - **Arquivos:** `login.html`, `login.css`, `login.js` (reescritos), `prisma-robo.js` (rosto e brilho do peito), `prisma-luz.js` (feixes, seta e clarão), `som-prisma.js` (som), `prisma-chegada.js` (no `<head>` da `visao-geral.html`). Imagens: `ASSETS/prisma-robo.png` (visor vazio, 800 × 1200, fundo tirado por mim a partir do JPEG enviado) e `ASSETS/prisma-icone.svg` (favicon). O logo do cartão é SVG dentro do HTML.
  - O login antigo do NEXUS ficou guardado em `ARQUIVO/login-nexus/`. Não são mais usados pelo login (apagar só com o OK do autor): `nexus.js`, `fundo-rede.js`, `portal-fumaca.js`, `som-portal.js` e as imagens `nexus-*`. O `portal-chegada.js` ainda é usado pelo `cad-cap.html`.
  - As imagens que o autor gerou estão em `ASSETS/` como `prisma-robo-completo.png.jpeg` (referência, com olhos; o "xadrez" de transparência veio desenhado na imagem) e `prisma-robo-visor-vazio.png.jpeg` (origem do `prisma-robo.png`).
  - **Robô:** imagem inteira flutuando devagar (sem cabeça separada). O SVG por cima usa as coordenadas da imagem original (1024 × 1536): visor recortado por `clipPath` (`#clipVisor`), centro do visor (527, 412), olhos em (462, 382) e (664, 396), boca em (562, 478), prisma do peito com vértices (517, 675), (407, 820) e (617, 820). Expressões: `normal` (olhos em pílula que piscam), `feliz` (arcos, como na imagem oficial), `discreto` (olhos fechados enquanto a pessoa digita a senha) e `triste` (pálpebra caída). O rosto segue o cursor ou o campo em foco, e passeia sozinho depois de 3 s parado. `PrismaRobo.expressao()` cancela qualquer reação temporária pendente.
  - **Erro:** `PrismaRobo.erro()`: visor vermelho, rosto triste por 2,4 s, cartão treme. A mensagem é a mesma para e-mail ou senha errados (não revela qual falhou). Depois de 5 erros, espera de 30 s.
  - **Formulário:** e-mail + senha (com mostrar/esconder e `autocomplete` certo para gerenciadores de senha), "Esqueci minha senha" (por enquanto só avisa que chega com o login seguro) e "Usar acesso de teste". Acesso de teste temporário: `teste@corporativo.com` / `prisma2026`, verificado no navegador (⚠️ não é seguro; sai quando o Supabase entrar).
  - **Entrada (2,8 s, `DURACAO` no `login.js`):** 0 → 1,5 s os feixes se endireitam, ficam mais fortes e os pulsos de luz aceleram para dentro do peito, por trás do robô; o peito se enche de luz (halo e reflexo horizontal desenhados por cima do robô no `#luzFrente`, porque branco sobre a armadura branca não aparecia). ~1,45 → 2,15 s: a seta de luz sai do peito, passa pela mão, atravessa o cartão (que ganha um brilho quente) e sai pela direita. ~1,9 → 2,7 s: clarão claro cobre a tela; a página troca em 2,8 s e o `prisma-chegada.js` desfaz a luz em ~1,3 s. Aviso via `sessionStorage` (`prisma-portal`).
  - **Som:** um só, contínuo: ar filtrado vindo da esquerda e acorde abrindo junto com a luz; na saída da seta, um sopro para a direita e um arpejo de cristal; volume no máximo em ~1,45 s e silêncio em ~2,6 s (renderizado e medido: sem pausa, pico 0,40). Mesmos cuidados do som antigo (`try`, liberar no gesto, nada no fim da curva).
  - **Testado** em 1440 × 850, 1366 × 640 (cartão compacto, sem rolar), 800 × 1000 e celular 375 × 812 (robô à esquerda e balão à direita, sem cobrir o rosto). Com `prefers-reduced-motion`, os feixes ficam parados e a entrada só escurece e troca de página.
  - **Ajustes pedidos pelo autor (17/11/2026, rodada 2):**
    - Feixes "pareciam linhas coloridas, não luz". Agora são **faixas largas que afinam até o peito**, como as da logo, desenhadas em camadas (halo, corpo, miolo claro) com soma de luz (`lighter`): onde se cruzam, clareiam até o branco. Um segundo canvas (`#luzBrilho`, 1/3 do tamanho, com `filter: blur(18px)` no CSS) repete o desenho desfocado por cima (*bloom*). Há névoa colorida à esquerda, pulsos de luz correndo por cada faixa e ~70 faíscas indo para o peito, que aceleram na entrada.
    - Pirâmides "sem graça". Agora são cristais coloridos (faces ciano/azul/violeta e âmbar/rosa/violeta), com uma faixa de arco-íris dentro, um núcleo de luz, arestas claras, luz colorida no piso e um reflexo que passa pelas faces a cada 5 s. **Profundidade:** `.piramide-frente` (maior, mais baixa, nítida, à esquerda, na frente do robô) e `.piramide-tras` (menor, mais alta, atrás do robô à direita, desfocada e mais apagada). As duas pairam devagar.
    - **Logo:** o autor mandou uma imagem da logo como **inspiração** (não como arquivo). A marca do cartão foi refeita em SVG/CSS a partir dela: faixas de luz entrando num prisma de vidro azul com contorno ciano → branco → laranja, luz atravessando e seta laranja saindo; divisor vertical; "PRISMA" prateado com a curva laranja no A; slogan; barra em espectro embaixo. O favicon (`prisma-icone.svg`) segue o mesmo desenho.
    - **Textos do cartão:** título "Acesse o Prisma"; subtítulo "Acesse com o seu e-mail corporativo e senha já cadastrada." (ortografia corrigida do pedido).
  - **Ajuste da rodada 3 (17/11/2026):** o autor mandou uma imagem de raios de luz atravessando nuvens, com arco-íris, e pediu "esse tipo de luz", elegante e fluindo para o robô. As faixas viraram **luz volumétrica**: 5 feixes em cunha saem do alto, à esquerda (fora da tela), e afinam até o prisma do peito. Cada feixe tem névoa em volta, arco-íris de 7 cores de um lado ao outro, miolo branco e 4 raios finos que ondulam devagar. Pulsos de luz correm pelos feixes até o peito, e há uma abertura de luz no canto de onde os raios vêm. O volume é desenhado em `#luzBrilho` em meia resolução, com `filter: blur(7px) saturate(1.3)` e `mix-blend-mode: screen` no CSS. Em `#luzFundo` ficam as estrelas e cerca de 120 partículas de poeira brilhando dentro dos feixes, fluindo para o peito. Na entrada, os feixes ficam mais fortes, convergem, e poeira e pulsos aceleram. Seta, clarão e chegada não mudaram. **Testado:** 1440 × 850, celular e transição completa (luz → peito → seta no cartão → clarão), sem erros no console.
  - **Ajuste de cor (17/11/2026):** o autor aprovou a luz e pediu tons mais quentes, sem rosa, "não tão colorido, mas ainda colorido". O arco-íris saiu. Agora cada feixe tem uma família de cor: dois **quentes** (marrom, cobre, laranja, âmbar, creme), dois **azuis** e um **misto** azul + laranja. Se todos tivessem todas as cores, a soma de luz viraria branco. O miolo branco ficou mais fraco, a abertura de luz no canto ficou creme quente, o brilho do peito na transição trocou violeta por âmbar, e o `saturate` do CSS caiu para 1.2.
  - **Robô novo (17/11/2026):** o autor trocou a arte do robô (mesma pose, agora azul-marinho e laranja). Originais em `ASSETS/prisma-robo-completo.png.png` e `ASSETS/prisma-robo-visor-vazio.png.png` (1025 × 1535). São PNG sem transparência, com um xadrez falso desenhado no fundo. O `prisma-robo.png` usado pela página foi gerado do "visor vazio": o fundo foi tirado preenchendo, a partir das bordas, os pixels claros e acinzentados, mais o vão entre o braço e o corpo. A borda foi suavizada e a imagem reduzida para 800 × 1200. O visor, os olhos, a boca e o prisma do peito caem nas mesmas coordenadas do código (diferença de poucos pixels), então o SVG não mudou. **Testado:** rosto normal, erro (visor vermelho e rosto triste) e o peito enchendo na transição.
  - **Pirâmides na paleta nova (17/11/2026):** a pedido do autor, as pirâmides do fundo seguem as cores do robô novo e da luz. Face esquerda azul (gelo → azul → azul-marinho); face direita quente (creme → laranja → cobre → marrom). A faixa interna vai do azul ao laranja passando pelo creme, o núcleo é creme, o brilho do piso é azul e laranja, e as sombras de luz no CSS também são azul e laranja. Não sobrou rosa nem violeta.
- **Como está hoje (login demonstrativo V2, alterado pelo autor):** só nome e e-mail, já preenchidos e somente leitura (`Teste` / `teste@corporativo.com`). Não há mais seletor de painel: todos entram na **Visão geral** (`visao-geral.html`), que abre as outras páginas pelo menu lateral.
- Nível de segurança atual: nenhum. A lista `USUARIOS_AUTORIZADOS` está no `login.js` e todas as páginas abrem com o endereço digitado direto. Isso deixa de ser aceito com a nova direção.
- Layout (reformulado em 03/11/2026): NEXUS à esquerda com balão de fala, aros holográficos e núcleo do peito pulsando; cartão de login à direita; fundo com rede de pontos e piso em grade. No celular, o balão fica ao lado da cabeça ampliada e o formulário vem embaixo.
- Reações: olha para o campo em foco e comenta; "Prazer, {nome}!" ao preencher o nome; "feliz" ao clicar nele.
- **Login recusado:** modo alerta por **2 s** (classe `alerta` no `<html>`). A paleta inteira troca para vermelho com transição (as cores são registradas com `@property`), a rede do fundo acompanha, o NEXUS fica em tons de vermelho (filtro SVG `#filtroAlerta`, no `login.html`), a cabeça balança e o cartão treme. Depois tudo volta ao normal.
- **Login aceito:** expressão "pronto" (olhos abertos, olhando para a tela) e, em seguida, a **transição de portal — "mudança de realidade"** (**2,8 s**, `DURACAO_PORTAL` no `login.js`; refeita a pedido do autor em 05/11/2026 para ficar mais fluida e esfumaçada, e alongada de 2,2 s para 2,8 s para o som caber inteiro):
  - 0 → 2,4 s: a cena se desfaz em desfoque, clareia e cresce um pouco (`@keyframes desfazer`).
  - 0 → 2,8 s: uma nebulosa de fumaça ciano/azul/violeta nasce no centro, gira em espiral e toma a tela (`portal-fumaca.js`, fios de fumaça esticados na direção do giro, pouco branco para não estourar). O fundo entra em dobra espacial, agora acelerando aos poucos e com rastros mais longos (`fundo-rede.js`).
  - 1,8 → 2,7 s: uma **névoa clara** (quase branca no centro, ciano nas bordas) cobre tudo e a página abre.
  - Na página de destino, o `portal-chegada.js` mostra a mesma névoa e a dissolve em ~1,3 s, enquanto o desfoque da página some (a nova realidade "entra em foco"). Aviso via `sessionStorage`. O anel de energia e o clarão antigos foram removidos.
  - Com `prefers-reduced-motion`, só escurece e troca de página.
  - A névoa da chegada começa a sumir no primeiro quadro depois do `DOMContentLoaded`, ou após 120 ms se o navegador atrasar os quadros (assim ela nunca fica presa).
  - ⚠️ A névoa da chegada só começa a sumir no `DOMContentLoaded`. Na Saúde e Social, que carrega bibliotecas de CDN no fim do `<body>`, ela pode durar mais com internet lenta.
- **Som do portal** (`som-portal.js`, refeito em 05/11/2026 para soar espacial e suave, sem estalos): tudo passa por um **reverb gerado no código** e é espalhado no estéreo. É **um só som, fluido, que sobe e desce sem pausa e termina todo no login** (decisão do autor, 05/11/2026). Um acorde de fundo (lá, mi, si, mi) cresce até 1,4 s com o filtro abrindo e depois fechando; o "ar" (ruído filtrado) passa da esquerda para a direita e volta ao centro; um grave macio cresce por baixo entre 0,8 e 1,4 s; cinco brilhos agudos entram entre 1,0 e 2,1 s. **O volume chega ao máximo em 1,4 s e desce numa curva só até o silêncio em 2,75 s** (`setValueCurveAtTime` no ganho geral), junto com a névoa cobrindo a tela; a página troca em 2,8 s.
  - ⚠️ **Não tentar continuar o som na página de destino.** O navegador corta todo áudio ao trocar de página e a página nova só abre depois de uma pausa; uma versão que continuava o som lá foi testada e rejeitada pelo autor ("dá uma parada e depois volta"). A página de destino revela em silêncio.
  - ⚠️ Em `AudioParam`, não marcar um valor no mesmo instante em que uma `setValueCurveAtTime` termina: o navegador dá erro. Um erro desses travou o login uma vez; por isso o `tocar()` fica dentro de `try` no `login.js` (o som nunca pode impedir a entrada). O áudio é liberado (`SomPortal.preparar()`) dentro do clique/Enter, porque o navegador só toca som depois de um gesto do usuário. Não toca com `prefers-reduced-motion`.
- **Login PRISMA no celular sem rolagem** (pedido do autor, 18/11/2026): abaixo de 900 px a cena tem a altura da tela (`100dvh`), o cartão ficou mais compacto e o robô ocupa só o espaço que sobra em cima (encolhe nos celulares menores). Ajuste de 19/11: robô centralizado com o balão centralizado em cima dele; `html, body` com `overflow: hidden` só no celular em pé (o `min-height: 100vh` do body passava da área visível por causa da barra do navegador). Celular deitado (altura até 520 px) volta a rolar. Ajuste de 19/11 (2): no celular saíram "Central de indicadores" e a frase "Acesse com o seu e-mail corporativo..."; campos de e-mail e senha maiores (58 px, borda mais visível) e o robô um pouco menor. O desktop está aprovado e não deve mudar. Em celulares com menos de 700 px de altura somem o sobretítulo, o subtítulo e o rodapé do cartão. Testado em 375×667, 375×812 e 430×932; o desktop não mudou.
- Histórico: login aprovado em 03/11/2026 e melhoria do portal aprovada em 05/11/2026. Em 17/11/2026 o autor pediu um **visual novo**; o que sai e o que fica (NEXUS, portal, som, modo alerta) será decidido com ele.

### Desempenho no celular (revisado em 03/11/2026, sem mudar o visual)
- `nexus.js`: guarda as posições na tela (só remede ao rolar, redimensionar, trocar o alvo ou a cada 0,5 s), só escreve no SVG quando o valor muda, para de desenhar quando o personagem sai da tela (IntersectionObserver) e põe a variável `--pulso` só no núcleo.
- `fundo-rede.js`: lê as cores CSS só por ~0,7 s depois que a classe do `<html>` muda, compara distâncias ao quadrado, desenha todos os pontos de uma vez e não recria a rede quando a barra do navegador do celular aparece/some.
- `login.css`: o piso em grade anda com `transform` (na placa de vídeo) em vez de `background-position`. No celular, sem `backdrop-filter` (o balão ficou 94% opaco para manter o visual).
- Imagens recomprimidas sem perda (pixels idênticos): corpo 1,9 MB → 0,84 MB (também cortado na altura visível), cabeça 470 KB → 335 KB.

## 5. Identidade visual

### PRISMA (atual, a partir de 17/11/2026)
- Nome **PRISMA**, slogan **"Múltiplas visões, uma direção."** A logo é o SVG do prisma com a seta laranja, igual no login e no menu; favicon `ASSETS/prisma-icone.svg`.
- **Decisão do autor (17/11/2026):** as páginas internas seguem **a mesma identidade do login**, uma de cada vez, com aprovação a cada página. O layout de cada página continua o mesmo.
  - Fundo azul-marinho profundo (`#050916` → `#0B1638`), com brilho azul no alto à esquerda e laranja suave à direita.
  - Cartões de vidro (degradê escuro translúcido + `backdrop-filter`) com contorno fino em espectro **azul → laranja**.
  - Destaques em **azul** (`#3D8BFF`, `#7FC4FF`) e **laranja** (`#FF9A3C`, `#FFC37A`). **Sem rosa e sem violeta** (pedido do autor na luz do login).
  - Rótulos pequenos em fonte monoespaçada com letras espaçadas.
- **Espectro do PRISMA (17/11/2026, pedido do autor: "marcante, cores vibrantes, com identidade").** A ideia da logo vira o sistema visual: a luz entra no prisma, abre em cores (múltiplas visões) e sai como seta laranja (uma direção).
  - Cores do espectro (variáveis `--esp-*` no `visao-geral.css`): azul `#2F6BFF`, ciano `#22D3FF`, turquesa `#2EE6C8`, âmbar `#FFC24A`, laranja `#FF8A2B`. Faixa completa em `--espectro`. Sem rosa nem violeta.
  - **Cada área tem a sua cor** (ícone, item ativo e fio de luz no menu): Visão geral = laranja; Inteligência de Rede = ciano; Kanbans = azul; Geolocalização (antigo Saúde e Social) = turquesa; Formulário de reunião / Assuntos por setor = âmbar. Áreas novas devem ganhar uma cor do espectro.
  - Assinaturas: faixa do espectro correndo devagar embaixo do topo; fio do espectro no alto do painel dos dashboards; barra do espectro embaixo de "PRISMA"; o botão MENU do celular tem as três linhas em ciano, âmbar e laranja.
  - Boas-vindas: o nome do usuário aparece no espectro; abaixo vem o slogan, com "uma direção." em laranja; à direita, um **prisma grande em SVG** (luz branca entrando, leque de 5 cores, seta laranja tracejada correndo). As animações são leves e se desligam com `prefers-reduced-motion`. No celular, o prisma fica acima do texto.
- No lugar do robô NEXUS, o topo do menu usa a **logo do prisma** (escolha do autor). O robô PRISMA aparece só no login.
- **No celular, com o menu fechado, não aparece robô nem barra lateral: só o botão MENU.** O menu abre como gaveta por cima do conteúdo.
- A seção abaixo (NEXUS, "Ciano elétrico") é o histórico e vale só para as páginas que ainda não passaram para o PRISMA.

### NEXUS (histórico)
- Nome: **NEXUS**, com o subtítulo **Inteligência de Dados**. Substitui "Optmus" e "ANALISTA" em todo o site.
- **Estilo futurista**, com tema escuro. Hoje o site usa preto com dourado (`#C9A568`), e o dourado sai.

### Paleta oficial "Ciano elétrico" (escolhida em 03/11/2026)
| Papel | Cor | Variável CSS | Uso |
|-------|-----|--------------|-----|
| Fundo da página | `#0A0E1A` | `--nexus-fundo` | Fundo geral |
| Superfície / cartões | `#121A2E` | `--nexus-superficie` | Cartões, painéis e tabelas |
| Borda | `#1F2C4A` | `--nexus-borda` | Linhas finas e contornos |
| Primária | `#00E5FF` | `--nexus-primaria` | Botões principais, destaques e item ativo |
| Secundária | `#3D7BFF` | `--nexus-secundaria` | Links, séries de gráfico e apoio |
| Acento | `#8F6BFF` | `--nexus-acento` | Detalhes e terceira série de gráfico |
| Texto principal | `#E6F1FF` | `--nexus-texto` | Títulos e texto |
| Texto secundário | `#8FA3C0` | `--nexus-texto-2` | Legendas e apoio |

```css
:root {
  --nexus-fundo: #0A0E1A;
  --nexus-superficie: #121A2E;
  --nexus-borda: #1F2C4A;
  --nexus-primaria: #00E5FF;
  --nexus-secundaria: #3D7BFF;
  --nexus-acento: #8F6BFF;
  --nexus-texto: #E6F1FF;
  --nexus-texto-2: #8FA3C0;
}
```

Regras de uso:
- O texto sobre a cor primária (`#00E5FF`) usa o fundo escuro `#0A0E1A`.
- As cores ficam sempre em **variáveis CSS**, para que a paleta possa ser trocada em um só lugar.
- ⚠️ As cores de status (em dia / atenção / atraso) ainda estão a definir. Elas devem manter o sentido verde/amarelo/vermelho e ser legíveis sobre o fundo escuro. O login usa por ora `--nexus-erro: #FF5C7A` e `--nexus-sucesso: #2EE6A6`, marcadas como provisórias no `login.css`. A Inteligência de Rede usa, também provisórias, `--nexus-ok: #2EE6A6` (em dia), `--nexus-atencao: #FFC857` (atenção) e `--nexus-atraso: #FF5C7A` (atraso), no `inteligencia.css`.

## 6. Mascote NEXUS
### Conceito (aprovado em 03/11/2026)
- Andróide/robô humanoide **masculino** chamado **NEXUS**. É a cara do projeto.
- Personalidade: **inteligente e curioso**, com um sorriso amigável.
- Estilo: render 3D cartoon brilhante, no mesmo nível de acabamento da antiga Optmus.
- Visual: armadura branco-pérola brilhante; partes internas azul-marinho (`#0A0E1A` a `#1F2C4A`); detalhes luminosos em ciano (`#00E5FF`) com toques de azul (`#3D7BFF`) e violeta (`#8F6BFF`); **cabelo curto, penteado para trás, azul-marinho com uma mecha luminosa ciano**; sobrancelhas marcadas; placa ciano na testa; módulos tipo fone de ouvido nas orelhas, com anel ciano; núcleo circular luminoso no peito; olhos grandes com íris ciano.
- Uma primeira versão desenhada em SVG plano foi **rejeitada** por ficar feia. Não voltar para esse caminho. O personagem deve usar as imagens 3D abaixo.

### Imagens (em `ASSETS/`)
| Arquivo | Tamanho | Conteúdo |
|---------|---------|----------|
| `nexus-completo.png` | 1105 × 1424, PNG com transparência | NEXUS da cabeça até a cintura, com olhos ciano. Referência oficial. |
| `nexus-olhos-vazios.png` | 1105 × 1424, PNG com transparência | Mesma pose, com os olhos totalmente brancos, sem íris. Base para desenhar íris animadas por cima. |

Observações sobre as imagens:
- As duas já estão **sem fundo** (transparentes) e com o **mesmo tamanho** (1105 × 1424). O fundo foi removido pelo autor em 03/11/2026.
- As duas foram geradas por IA de imagem, a partir de prompts. Elas têm o mesmo enquadramento, mas **não são idênticas pixel a pixel**: há pequenas diferenças espalhadas, porque a IA redesenhou a imagem inteira. Para animar, use a versão de olhos vazios como base inteira, e não para recortar só os olhos e colar sobre a outra.

### Uso no site
- **Tela de login:** o NEXUS no lugar da Optmus. A **cabeça e os olhos seguem o cursor de forma natural e realista**: os olhos se movem rápido e a cabeça devagar, com suavização.
- **Logo / ícone pequeno:** recorte da cabeça, quadrado, com fundo transparente (512 × 512), para favicon e cabeçalho.
- **Expressões diferentes:** pelo menos curioso (padrão), feliz, pensando e erro (por exemplo, para login recusado).

### Plano técnico da animação
- Montar o personagem em camadas, como a Optmus fazia: corpo + cabeça (recortada da imagem) + íris desenhadas em SVG ou CSS sobre os olhos vazios, limitadas pelo formato do olho (clip-path).
- Laço com `requestAnimationFrame` e interpolação suave (lerp): olhos rápidos (fator ~0,26) e cabeça lenta (fator ~0,065). A cabeça gira poucos graus e se desloca alguns pixels, sem exagero.
- Após cerca de 3 s sem mexer o mouse, o olhar passeia sozinho ("idle"). Piscadas aleatórias de tempos em tempos.
- Respeitar `prefers-reduced-motion` (desligar o movimento).
- No celular (sem cursor), o olhar pode seguir o toque ou ficar no modo "idle".
- API em JavaScript: `Nexus.expressao('feliz')`, `Nexus.reagir('erro')`, `Nexus.atual`.
- ✅ Implementado em `JAVA/nexus.js` (03/11/2026), a partir do protótipo `nexus-personagem.js`.

### Como as camadas foram montadas (03/11/2026)
- As duas camadas saem de `nexus-olhos-vazios.png`. A cabeça é cortada por uma linha logo abaixo do queixo, sobre o pescoço escuro, com borda suave de 8 px.
- No corpo, o miolo da cabeça foi mantido, mas encolhido 40 px (erosão do alfa), e logo acima da linha de corte o pescoço foi "esticado" 45 px para cima (assim não aparece um segundo queixo quando a cabeça sobe). Quando a cabeça se mexe, nunca aparece o contorno antigo por trás. **Por isso o movimento da cabeça não pode passar de ~35 px da imagem** (os limites estão comentados no `nexus.js`).
- Movimento da cabeça (03/11/2026): segue o olhar com uma **mola** (acelera, desacelera e passa um pouco do ponto), com giro 3D (`rotateY` até ~9°, `rotateX` até ~6°), leve tombo e deslocamento, e um balanço contínuo bem leve.
- ⚠️ Não colocar `mask-image` (nem `filter`, fora do modo alerta) no `.nexus-palco` ou em outro ancestral da cabeça: com o giro 3D, o Chrome deixa de desenhar o SVG das íris. O esmaecimento de baixo fica só no `.nexus-corpo`.
- Ponto de giro da cabeça: (575, 520). Íris neutras: olho esquerdo (511, 306), direito (655, 317), raio 31. O formato de cada olho está em `clipPath` no `login.html`, em coordenadas da imagem.
- Expressões só mexem em olhos, pálpebras, pose da cabeça e cor do núcleo do peito (boca e sobrancelhas fazem parte da imagem).

### Prompts usados para gerar as imagens
Prompt base (em inglês; anexar a imagem da Optmus como referência de estilo):
> Use the attached image only as a style reference: 3D glossy cartoon robot mascot, pearl-white armor panels, thin glowing trim, big expressive eyes, friendly smile, headphone-style ear modules. Create a NEW, original MALE humanoid android named NEXUS. Young adult, confident, intelligent and curious expression, slight friendly smile, big cyan irises with white catchlights, defined eyebrows. Squarer jaw and broader shoulders. Pearl-white glossy armor with deep navy (#0A0E1A to #1F2C4A) inner parts and electric cyan (#00E5FF) glowing trim, small #3D7BFF and #8F6BFF accents. Headphone-style ear modules with a cyan glow ring. Small circular glowing core emblem on the chest, no text. Front-facing bust (head to waist), transparent or flat white background, no text, no logos, no watermark.

Complemento (versão escolhida, cabelo curto):
> Short, neat, swept-back glossy navy hair with a thin cyan highlight line.

Prompt de edição para os olhos vazios:
> Edit this image: remove the irises, pupils and catchlights from both eyes, leaving clean, smooth, solid white eyeballs. Keep everything else exactly the same.

## 7. Setores (páginas)
| # | Setor | Situação |
|---|-------|----------|
| 1 | **Visão geral** | Reúne os indicadores de **todos os outros setores**. **Não é prioridade agora**, será feito mais tarde. |
| 2 | **Inteligência de Rede** | Existe (`inteligencia.html`). Regras na seção 8. |
| 3 | **Relacionamento** (antes "Captação/Cadastro") | Existe (`cad-cap.html`). Precisa ser renomeado. |
| 4 | **Faturamento** | **Não é prioridade agora**, será feito mais tarde. Indicadores e colunas serão definidos na hora. |
| 5 | **Geolocalização de vidas e rede** (antigo "Vidas do Saúde e Social") | `geolocalizacao.html` desde 19/11/2026 (menu `data-pagina="geolocalizacao"`). Mapas da rede credenciada × beneficiários. Regras na seção 8. |
| 6 | **Kanban de tratativas** | Existe (`kanban-tratativas.html?setor=...`), criada pelo autor. Um quadro por setor (ADM/PAT, Reembolso, Credenciamento, Auditoria, Cadastro, Captação, Financeiro, Triagem). Guarda as tratativas no **IndexedDB** do navegador; a chave é Protocolo + Num. Ocorrência. **Menu (18/11/2026):** "Inteligência de Rede" abre o painel (`inteligencia.html`); a setinha mostra **Estudo de reclamações** (em breve, visual a definir pelo autor) e **CRM**. O CRM é um Kanban só (`kanban-tratativas.html` sem `?setor`): o quadro começa vazio com "Escolha o setor" e o colaborador filtra o setor dele. Os 8 itens de setor saíram do menu (o `?setor=` continua funcionando). Travar cada pessoa no próprio setor depende do login do Supabase (perfil com setor + RLS); só esconder na tela não protege. **v2 (18/11/2026; backup em `ARQUIVO/kanban-v1/`):** topo, sincronização e filtros compactos (filtro novo por responsável); 7 colunas cabendo na tela e "Concluído" recolhido numa faixa (lembrado em `localStorage["prisma-kanban-concluido"]`); cartão com dias úteis em cima, borda amarela/vermelha de prazo em qualquer coluna, mais urgentes primeiro, "N em atraso" no cabeçalho, "parado há N dias" (dias úteis desde a última tratativa, a partir de 3); observação obrigatória para entrar em "Precisando de ajuda" e "Concluído"; transferência recolhida. **Ordem das colunas:** Todos que entraram → Em atenção → Atraso → Muito importante → Em andamento interno → Em andamento externo → Precisando de ajuda → Concluído; cabeçalhos todos com 76 px. **Coluna "Muito importante"** (laranja): só a Triagem põe cartões nela, e o selo "★ Muito importante" acompanha o cartão até ser concluído. **Triagem** = visão de todos os setores (filtro "Setor do protocolo"), painel "Prioridade da Triagem" no cartão (setor + motivo) e botão **Novo protocolo PRISMA** (`PRISMA-AAAA-NNNN`, sequência em `config.seqPrisma`; chave `[numero,'PRISMA']`, `origem:'prisma'`; prazo de 5 dias úteis desde a criação). ⚠️ Por enquanto a Triagem é aberta a todos e tudo continua só no navegador de quem usa: os setores só veem a prioridade "na hora" quando o Kanban for para o Supabase. |
| 7 | **Problemas-Setoriais** | Criada pelo autor: `formulario-reuniao.html` (até 3 assuntos por setor para a reunião) e `assuntos-por-setor.html` (acompanhamento e conclusão). As duas dividem o `localStorage` `nexus_v2_assuntos_reuniao`; não há sincronização entre computadores. |

A **Visão geral** (`visao-geral.html`) virou a casca do site: menu lateral retrátil que abre cada página num `iframe`. Itens do menu ainda sem página: Financeiro/Credenciamento, CRM e NIP.

**Passagem para o visual PRISMA (uma página por vez):**
- ✅ **Visão geral** (menu + boas-vindas), feita e **aprovada pelo autor em 17/11/2026**, com o Espectro do PRISMA. É a referência visual para os dashboards.
  - `visao-geral.css` reescrito com a identidade do login, mantendo todas as classes usadas pelo JS.
  - Marca: logo do prisma + "PRISMA" prateado + slogan. Com o menu recolhido, aparece só a logo. Item ativo com fio de luz azul → laranja.
  - Textos NEXUS → PRISMA no HTML e no JS (título da aba `PRISMA | …`).
  - **Celular (≤ 700 px):** o menu sai da tela. Fechado, só aparece o botão **MENU** no topo. Aberto, vira uma gaveta por cima com fundo escurecido. Fecha no X, tocando fora, com Esc ou ao escolher uma página, e o foco volta ao botão MENU. A página de trás não rola com a gaveta aberta. O botão de recolher fica só no computador.
  - Depois veio o **Espectro do PRISMA** (seção 5): cores por área, prisma grande na boas-vindas e faixas do espectro. Também foi corrigido um defeito antigo: com todos os submenus abertos, os itens passavam por cima do rodapé (Teste / e-mail). Agora `.navegacao` não encolhe e o menu inteiro rola.
  - Testado em 1440 × 850 (aberto e recolhido), 800 × 1000 e 375 × 812, sem erros novos no console. Os 404 do Saúde e Social são as planilhas que, de propósito, não ficam no projeto.
- ✅ **Inteligência de Rede**, feita e **aprovada pelo autor em 17/11/2026** ("vamos deixar esse visual como padrão"). A cor da área é o ciano.
  - Em `inteligencia.css`, as variáveis `--nexus-*` mantêm os nomes, mas agora têm os valores do PRISMA: fundo `#050916`, ciano primário, azul secundário e laranja de acento. Também ganharam `--esp-*` e `--espectro`. As cores de status continuam as provisórias.
  - Um bloco "CAMADA PRISMA" no fim do CSS só mexe em cor, vidro e brilho:
    - cartões de vidro com fio do espectro no topo;
    - KPI em destaque em ciano;
    - botão principal ciano → azul;
    - filtros, popovers, diálogo e aviso em vidro.
  - O layout não mudou, porque a tabela depende das alturas calculadas no JS.
  - O título da aba virou `… | PRISMA` e o favicon é a logo do prisma. Os arquivos levam `?v=prisma1`.
  - Testado em 1440 × 850 com a página vazia e com números de mentira, injetados só no navegador. No 375 × 812 não há rolagem lateral, e não apareceu nenhum erro novo no console.
- ✅ **Passagem geral**, feita e **aprovada pelo autor em 17/11/2026** ("vamos deixar esse visual como padrão"), de uma vez só, nas páginas restantes. Em todas, uma "CAMADA PRISMA" no fim do CSS troca só cor, vidro e brilho, sem mexer no layout. Todas usam o fundo PRISMA, cartões de vidro com o fio do espectro, rótulos mono, título `… | PRISMA`, o favicon do prisma e `?v=prisma1`.
  - **Kanban** (azul): colunas e cartões de protocolo escuros, mantendo as cores de atenção, atraso e concluído. As janelas também ficaram escuras e o painel de transferência é laranja.
  - **Saúde e Social** (turquesa): a camada fica em `saude-social-nexus.css`, que carrega por último. As cores dos pinos, do calor e da legenda dos mapas não mudaram, porque têm significado.
    - "ASSEFAZ" saiu do título e do rodapé. Ficou só em "Direta (ASSEFAZ)", que é o tipo de contratação.
    - O aviso de status agora quebra a linha em vez de passar por baixo dos botões.
  - **Formulário de reunião** e **Assuntos por setor** (âmbar): botões âmbar → laranja e números dos assuntos em âmbar. O verde de "concluído" continua. O plano 5W2H e a janela de edição ficaram escuros.
  - **Relacionamento** (`cad-cap`, laranja): o tema claro antigo virou o PRISMA escuro.
    - "ANALISTA" virou PRISMA, com a logo e o slogan, e "Captação e Cadastro" virou "Relacionamento".
    - A página ainda não está no menu e ainda usa o SheetJS de CDN e o `portal-chegada.js`.
  - Testado em 1440 × 850 e 375 × 812, sem rolagem lateral e sem erros novos no console.
- ✅ **Modo claro**, feito a pedido do autor e **aprovado em 17/11/2026**. O **escuro continua sendo o padrão**.
  - **Botão:** "Modo claro / Modo escuro", com ícone de sol ou lua, no topo da Visão Geral, ao lado de "Ambiente demonstrativo". No celular aparece só o ícone, ao lado do MENU.
  - **`JAVA/tema.js`:** fica no `<head>` de todas as páginas, logo depois do `theme-color`, para a tela não piscar.
    - Guarda só "claro" ou "escuro" em `localStorage["prisma-tema"]` e põe `data-tema="claro"` no `<html>`.
    - Também troca a cor da barra do navegador.
    - Passa o tema para o dashboard aberto no iframe (direto pelo menu e pelo evento `storage`) e liga qualquer botão com `data-alternar-tema`.
  - **CSS:** cada arquivo ganhou um bloco "MODO CLARO" com regras `html[data-tema="claro"]`. O fundo é `#EEF3FB`, os cartões são brancos de vidro e o texto é `#0E1A3A`. As cores das áreas ficam um tom mais escuro para ler no branco:
    - laranja `#E06A10`, ciano `#0A9CC4`, azul `#2F6BFF`, turquesa `#0FA88F` e âmbar `#C27C00`;
    - status `#12A877`, `#C27C00` e `#E0345A`, ainda provisórios.
  - O layout não muda. No Saúde e Social, os mapas e o detalhamento dos bairros (montado pelo JS) continuam escuros.
  - O login continua sempre escuro, porque a cena de luz depende do escuro. O Relacionamento não tem botão (não está no menu), mas segue a escolha salva.
  - Testado nos dois modos em 1440 × 850 e no celular. A troca vale na hora também para o dashboard aberto, e o console não mostra erros de script.

Novos setores seguem o mesmo padrão: botão de importar planilha, filtros e indicadores calculados no navegador.

### Tutoriais (19/11/2026) ✅ funcionando no computador do autor (também com file://)
- Pedido do autor: passo a passo de cada página, com opção de pular, que **não abre sozinho ao entrar**. Fica no botão **Tutoriais**, no rodapé do menu, logo acima de "Sair do PRISMA".
- **Arquivos:**
  - `JAVA/tutorial.js` e `CSS/tutorial.css`, carregados no `visao-geral.html`;
  - `JAVA/tutorial-pagina.js` (a "ponte"), carregado em cada painel: inteligência, estudo, produção, kanban, saúde e social, formulário e assuntos.
- **Por que a ponte (correção de 19/11/2026):** com o site aberto direto do computador (`file://`), o navegador bloqueia o acesso da Visão Geral ao conteúdo do iframe. Só o tutorial do menu funcionava, e os outros davam "Não consegui abrir a página do tutorial".
- **Como funciona agora:** o tutorial só conversa com o painel por `postMessage`. A ponte:
  - responde se a página carregou;
  - executa as ações "clique em X se Y existir" (ex.: abrir o filtro da Inteligência);
  - acha e rola até o alvo, mandando a posição dele a cada mudança;
  - religa o scroll-snap no fim.
  Só passam seletores e posições, nenhum dado da planilha. **Página nova precisa da linha `<script src="../JAVA/tutorial-pagina.js?v=1" defer></script>`.**
- **Central de tutoriais:** um cartão por tutorial, com número de passos, tempo e "✓ Concluído". O primeiro, "Primeiros passos", aparece como "Comece por aqui".
- **Conteúdo:** 8 tutoriais, todos com o texto dentro de `TUTORIAIS` no JS:
  - Primeiros passos (menu, topo, tema, tutoriais, sair);
  - Inteligência de Rede (inclusive o painel de filtros, que ele abre e fecha sozinho);
  - Estudo de reclamações;
  - Volume e produtividade;
  - CRM (Kanban);
  - Geolocalização de vidas e rede (antigo Saúde e Social; desde 19/11/2026 abre o painel suspenso de filtros sozinho e fecha ao sair);
  - Formulário para a reunião;
  - Assuntos por setor.
- **Como funciona um passo:**
  - escurece a tela e ilumina o alvo, com um anel pulsando;
  - o balão traz número do passo, título, texto, dica (💡), barra de progresso, **Pular tutorial**, Voltar e Próximo;
  - no 1º passo também aparece "Já sei usar esta página, pular";
  - teclas: ← → para navegar e Esc para sair.
- **No fim:** confete (sai se o sistema pede menos movimento) e opção de ver outros tutoriais.
- **Ao começar:** abre sozinho a página certa e espera ela carregar.
- **No celular:** abre e fecha a gaveta do menu conforme o passo, e o balão fica em cima ou embaixo do alvo.
- **Passos opcionais:** um passo marcado `opcional` é pulado quando o alvo não existe. Exemplos: cartões do Kanban sem planilha, assuntos sem registro, ranking "Onde expandir" da Geolocalização (só com as duas planilhas) e a situação da importação (escondida no celular).
- **Scroll-snap:** durante o tutorial a ponte desliga o encaixe da rolagem da página (scroll-snap), senão a página puxava o alvo do topo para fora da tela.
- **localStorage** (com try/catch):
  - `prisma-tutoriais-feitos`: tutoriais concluídos;
  - `prisma-tutoriais-visto`: tira o pontinho laranja de "novo" do botão.
- **Para editar um texto:** é só mudar o passo em `TUTORIAIS`. Para uma página nova, crie um tutorial com `pagina` (data-pagina do menu), `arquivo` e `pronto` (seletor que indica que a página carregou).
- Testado com dados fictícios: todos os tutoriais do começo ao fim, em 1440 × 900 e no celular, nos modos escuro e claro. Nenhum erro de script novo; os 404 do Saúde e Social já existiam (são as bases `../dados/`).

## 8. Regras de negócio dos indicadores

### Inteligência de Rede — Visão operacional v3 (18/11/2026, feita a partir da imagem do autor) ⏳ aguardando aprovação
- **Três blocos, cada um do tamanho da tela** (pedido do autor, 18/11/2026: nenhum gráfico cortado no meio). No desktop (a partir de 760 × 540 px de área útil) cada bloco tem a altura da janela, os gráficos esticam para preencher e a rolagem encaixa no início de cada bloco (`scroll-snap`). Ao recarregar ou mudar o tamanho da janela, a página volta para o início do bloco mais próximo. No celular (até 759 px) a página rola normalmente.
  - **Bloco 1:** cabeçalho → filtros em uso → 7 indicadores (cartões mais baixos, numa linha só a partir de 980 px) → Evolução do IR + Protocolos por setor.
  - **Bloco 2:** **Abertura × encerramento por dia** + **Encerrados por prazo (RN 623)**.
  - **Bloco 3:** tabela de protocolos (a altura da tabela define quantas linhas por página).
  - ⚠️ Num notebook 1366 × 768 a área do painel tem só ~1000 px de largura, por isso o layout de celular começa abaixo de 760 px e não de 1024.
- **Títulos do filtro** com cor por grupo (pedido do autor): situação e canal em ciano, prazo e abertura em âmbar, Kanban e ocorrência em laranja, setor em azul, colaborador em turquesa.
- **Cabeçalho:** título "Visão operacional", faixa **Hoje** (abertos e encerrados hoje) e os botões **Filtro**, **Importar** e **Exportar**.
- **Faixa Hoje:** segue setor, canal e ocorrência; **ignora situação, prazo, ajuda, colaborador e período**, para o "Encerrados hoje" aparecer mesmo filtrando só pendentes (pedido do autor). Cor do encerrados: menor que os abertos = vermelho, igual = amarelo, maior = verde.
- **Filtro** (um painel só, aplica na hora): situação (Todos/Pendentes/Encerrados), prazo RN 623 (**em dia, atenção 4 dias, atenção 5 dias, atrasados**), **Precisando de ajuda** (Kanban), setor, **colaborador** (`USUARIO_ENCERRAMENTO_OCORRENCIA` = quem encerrou; pendentes ficam como "Sem colaborador"), canal (`DESC_COMUNICACAO`), período de abertura e ocorrência. Os filtros em uso aparecem como etiquetas com × abaixo do cabeçalho.
- **Indicadores:** Total de chamados, Protocolos pendentes, Em dia (< 4), Atenção (4 e 5), Atrasado (RN 623), Precisando de ajuda e T.M.E. O cartão do **Índice de resolutividade saiu** (pedido do autor, 18/11/2026): o IR fica só no gráfico mês a mês. Os 6 primeiros são clicáveis e viram filtro: **cada cartão liga e desliga sozinho** (clicou filtra, clicou de novo tira; pedido do autor, 18/11/2026), e dá para combinar cartões. Se o filtro do cartão está ligado mesmo em parte (ex.: só "atenção 5 dias" pelo painel), o clique desliga. Total limpa situação/prazo/ajuda. Eles seguem todos os filtros, menos prazo e ajuda. O T.M.E também ignora a situação.
  - **Sem comparação "vs. mês anterior" nos cartões** (o autor pediu para tirar em 18/11/2026): cada cartão mostra só o número. A comparação entre meses fica nos gráficos (IR, prazos e o seletor de mês do gráfico diário).
  - **IR** (fórmula do autor) = encerrados no prazo ÷ (total − pendentes) × 100. "No prazo" = encerrado sem passar de 5 dias úteis (RN 623).
  - **T.M.E** = média de **dias úteis** entre abertura e encerramento dos encerrados.
- **Gráficos** (SVG desenhado no JS, com dica ao passar o mouse; as cores das marcas são as `--g-*` do CSS, validadas para o escuro e para o claro):
  - **Evolução do IR:** barras horizontais por mês de encerramento. **Segue o filtro de período** (pedido do autor, 18/11/2026; `mesesDoPeriodo()`): sem período, os 12 últimos meses até o mês de referência; com período, do mês do "De" ao mês do "Até". O texto de apoio mostra o intervalo; com mais de 7 meses as linhas afinam e, se não couberem, o cartão rola. Encerrados por prazo usa os mesmos meses. **Cor da barra pela meta:** abaixo de 85% vermelho, de 85% até 89,9% amarelo, 90% ou mais verde.
  - Eixo das colunas empilhadas (setores e prazos): o topo fica no máximo 20% acima do maior valor, para a coluna ocupar o cartão.
  - **Protocolos por setor:** colunas empilhadas (em dia, atenção, atraso) com eixo e grade. Seguem todos os filtros menos o próprio setor; clicar num setor filtra e apaga os outros.
  - **Abertura × encerramento por dia** (pedido do autor, 18/11/2026; substituiu a evolução mensal em linhas): um mês por vez, **só por dia**. **Colunas = encerrados no dia; linha azul = abertos no dia.**
    - **Cor da coluna** (mesma regra do "Encerrados hoje"): encerrou **mais** que abriu = verde, **igual** = amarelo, **menos** = vermelho. Dia em que abriu e não encerrou nada ganha uma marca vermelha rente ao eixo.
    - **Só duas coisas no gráfico** (pedido do autor): as colunas dos encerrados com a regra de cores e a linha dos abertos. Sem linha de comparação, sem resumo, sem sombreado de fim de semana.
    - **Seletor "Mês"** no cartão (padrão: o mês de referência da planilha); para comparar meses, troca-se o mês ali.
    - **Dica do dia:** dia da semana com a data, encerrados, abertos e saldo.
    - No mês corrente o eixo vai **só até hoje** (data do computador) e ganha o dia seguinte sozinho a cada dia. Segue setor, canal, ocorrência e colaborador; período e situação não entram.
  - **Encerrados por prazo (RN 623)** (pedido do autor, 18/11/2026): colunas empilhadas por mês de encerramento, nos meses do período como a Evolução do IR (12 últimos sem filtro; os 6 últimos no celular), com em dia, atenção 4 dias, atenção 5 dias e atraso. Só entram encerrados; segue todos os filtros, menos a situação. A dica mostra quantidade e % de cada parte. Atenção 4 e 5 usam dois tons do âmbar (`--g-atencao4` mais claro e `--g-atencao5` mais escuro), validados junto com o verde e o vermelho.
- **Precisando de ajuda:** lido do IndexedDB do Kanban (`nexus_v2_kanban`, store `cartoes`, `tratativa.etapa === 'ajuda'`), pela chave [protocolo, num. ocorrência] (coluna `NUM_OCORRENCIA`; sem ela, só pelo protocolo). Relido ao voltar para a aba. ⚠️ Funciona só no mesmo navegador até existir o banco (Supabase).
- **Tabela:** Protocolo, Canal, CPF, Beneficiário, E-mail, Setor, Ocorrência, Abertura, Previsão, Status (prazo + situação + marca "Ajuda") e Observação de abertura. No desktop ocupa o bloco 3 inteiro, com paginação; no celular vira cartões.
- **Exportar:** exatamente os protocolos da tabela (filtros + busca), com as colunas pedidas pelo autor: Protocolo, Canal, CPF, Beneficiário, E-mail, Setor, Ocorrência, Data de abertura, Previsão para encerrar, Status (ex.: "Pendente · Atrasado (RN 623) · Precisando de ajuda") e Observação de abertura.
- O texto abaixo (estrutura de 03/11/2026) descreve a versão anterior, guardada em `ARQUIVO/inteligencia-v2/`; vale só a parte de setores e da RN 623.
- **Setores compartilhados (18/11/2026):** as regras de setor saíram do `inteligencia.js` para `JAVA/setores-crm.js` (`window.PrismaSetores.classificarSetor`). Inteligência e Estudo de reclamações usam o mesmo arquivo; ajuste de setor é feito só lá.

### Volume e produtividade (19/11/2026) ✅ aprovado
- Página `HTML/producao-colaboradores.html` + `CSS/producao-colaboradores.css` (por cima de `inteligencia.css` e `estudo-reclamacoes.css`) + `JAVA/producao-colaboradores.js`. No menu: Inteligência de Rede → Volume e produtividade (o autor pediu "volume de protocolos" e liberou um nome mais profissional).
- Tela: resumo (encerrados, para tratar, sem responsável em laranja, SLA cumprido), filtros (período de encerramento, colaborador, status da ocorrência, tipo, canal, severidade, mínimo de encerrados), rankings "Encerrados por colaborador" e "Para tratar por responsável" (Sem responsável sempre em 1º, com vencidos), gráfico "Abertos x encerrados por mês" na largura toda (colunas = encerrados, linha = abertos pela `Data Abertura Ocorrência`; coluna verde se encerrou mais que abriu, amarela se igual, vermelha se menos; sem linha de média: a média por mês de abertos e de encerrados aparece só como número na legenda, a pedido do autor; a dica mostra o saldo) e tabela com todos os indicadores (ordenável, clique filtra). Exporta a tabela por colaborador (sem dados de beneficiário).
- Período e filtros valem para os encerrados; "Para tratar" é sempre a demanda de hoje. Vencido = pendente com `Data Previsão SLA` antes de hoje. Cores do SLA = faixas do IR (90/85).
- "Mínimo de encerrados" esconde quem encerrou pouco, mas nunca quem tem pendente.
- Filtro "Status" (`Status Ocorrência`; na planilha real só existem Encerrada e Pendente) vale para tudo: Encerrada esconde a demanda em aberto; Pendente esconde os encerrados e a linha dos abertos mostra de que mês vêm os pendentes.

#### Regras combinadas com o autor
- Fonte: exportação do CRM no formato novo (aba "Export", 55 colunas, nomes com acento e espaço, ex.: `Usuário Encerramento Ocorrência`, `Plano`, `Canal`). O sistema precisa aceitar este formato além do antigo (`USUARIO_ENCERRAMENTO_OCORRENCIA`...).
- **Encerrados por colaborador:** `Usuário Encerramento Ocorrência`, só ocorrências com `Status Ocorrência` = Encerrada.
- **Para tratar (demanda em aberto) por colaborador:** `Descrição Operador Responsável`, só ocorrências com `Status Ocorrência` = Pendente. **Responsável em branco = "Sem responsável"** (regra do autor). Na planilha de 19/11/2026, 31 dos 32 pendentes estavam sem responsável.
- O autor quer o **nome do colaborador** na tela.
- Indicadores levantados: encerrados, % da equipe, para tratar (e vencidos), média por dia trabalhado, dias ativos, SLA cumprido (`SLA Cumprido` = S), dias úteis para encerrar (mediana), % resolvido no mesmo dia, mix por tipo/canal/severidade (reclamação pesa no prazo), evolução mensal (abertos x encerrados). O gráfico de horário de encerramento saiu a pedido do autor (19/11/2026).
- Achados de qualidade: 97 ocorrências com encerramento em jan/2025, antes da abertura mais antiga (set/2025).

### Estudo de reclamações (18/11/2026) ✅ aprovado pelo autor
- Arquivos: `HTML/estudo-reclamacoes.html`, `CSS/estudo-reclamacoes.css` (por cima do `inteligencia.css`), `JAVA/estudo-reclamacoes.js`. No menu fica dentro da Inteligência de Rede, acima do CRM.
- **O que entra:** só reclamações — tipo com "RECLAMA" (`DESC_TIPO_OCORRENCIA`), canal "RECLAME AQUI" ou "OUVIDORIA" no tipo, canal, assunto ou grupo (critério do autor).
- **Uma tela só no desktop:** cabeçalho com resumo (reclamações, beneficiários distintos, média por mês), Importar/Exportar, filtros numa linha (plano, assunto, beneficiário por nome ou CPF, canal, setor, colaborador = `USUARIO_ENCERRAMENTO_OCORRENCIA`) e 5 gráficos: por mês com a linha tracejada da média mensal, por setor (barras deitadas desde o ajuste de 18/11: em colunas os nomes não cabiam), por plano (`DESCRICAO_PLANO`), ocorrências mais recorrentes (`DESCRICAO_OCORRENCIA`, top 10) e beneficiários que mais reclamaram (ranking por pessoa = CPF, top 12).
- Ajuste do autor (18/11): no desktop o cabeçalho e os filtros ficam em cima e, ao rolar, a grade dos 5 gráficos ocupa a janela inteira (linha de cima mais baixa). Letras maiores; nos 3 rankings de baixo o nome e o número ficam em cima da barra para o nome aparecer inteiro.
- Clicar numa barra de setor, plano, ocorrência ou beneficiário filtra; clicar de novo desliga. Cada ranking ignora o próprio filtro para dar para trocar direto.
- Média mensal = reclamações ÷ meses entre o primeiro e o último mês com reclamação (meses sem nenhuma contam como zero).
- Exportar: as reclamações filtradas (Protocolo, Data de abertura, CPF, Beneficiário, Plano, Tipo, Canal, Assunto, Ocorrência, Setor, Colaborador).
- A planilha é importada de novo nesta página (ainda não é compartilhada com a Inteligência; isso vem com o Supabase).

### Inteligência de Rede — estrutura anterior (03/11/2026)
- Menu lateral responsivo: logo NEXUS, nome do painel, **seletor suspenso "Ir para a tela"** e a lista de telas. No desktop alterna entre aberto (248 px) e trilho de ícones (76 px); começa recolhido abaixo de 1600 px e guarda a escolha. Abaixo de 1024 px vira gaveta (☰).
- **Cada tela cabe inteira na janela, sem rolar a página**, com altura útil a partir de 560 px. ⚠️ Atenção: num notebook 1366 × 768, com o navegador aberto, a altura útil real é de ~640 px; por isso há uma versão compacta abaixo de 720 px de altura. Testado em 1366 × 640, 1366 × 600, 1280 × 720, 1920 × 950 e 1920 × 1080. A tabela calcula quantas linhas cabem (34 px por linha) e pagina o resto. No celular a página rola e a tabela vira cartões.
- ⚠️ A faixa de indicadores tem **sempre altura fixa** no desktop (168 / 206 / 250 px conforme a altura da janela). As colunas dos setores calculam a altura a partir dela; sem altura fixa, coluna e área cresciam uma empurrando a outra (bug corrigido em 03/11/2026).
- Novas telas: basta criar outra `<section class="tela" data-tela="..." data-titulo="..." data-icone="...">` no HTML; menu e seletor são montados sozinhos. ⚠️ As outras telas serão definidas pelo autor.
- **Tela 1 — Visão operacional** (decisões do autor, 03/11/2026):
  - Conta-se por **ocorrência** (cada linha da planilha).
  - **Pendente** = `STATUS_OCORRENCIA` "Pendente".
  - **Abertos hoje / Encerrados hoje** = `DATA_ABERTURA_OCORRENCIA` / `DATA_ENCERRAMENTO_OCORRENCIA` iguais à **data do computador**. Esses dois cartões ignoram o filtro de período, mas seguem os demais.
  - **Cor do "Encerrados hoje"** (pedido do autor): encerrados **menor** que abertos do dia = vermelho; **igual** = amarelo; **maior** = verde. O texto de apoio diz quantos a mais/a menos.
  - **Situação** (Todos · Pendentes · Encerrados, pela `STATUS_OCORRENCIA`): fica no topo da página e é um **filtro global**, como os outros (pedido do autor, 03/11/2026). Vale para cartões, gráfico, tabela e exportação. Cada botão mostra a quantidade considerando os demais filtros. Padrão: Todos.
  - **Protocolos por setor**: **colunas empilhadas** (em dia embaixo, atenção no meio, atraso em cima) pela **RN 623**. Seguem todos os filtros, inclusive a Situação; o título muda para "Pendentes por setor" / "Encerrados por setor". Pendentes contam os dias úteis até hoje; encerrados, até o encerramento. Cada parte tem rótulo de dados, o total fica em cima e o nome embaixo. Para o rótulo sempre caber, cada parte com valor tem no mínimo 17 px; o resto da altura segue a proporção. Clicar num setor filtra por ele. A legenda no topo do cartão foi aprovada como está.
  - **Filtros**: período pela `DATA_ABERTURA_OCORRENCIA` (de/até e atalhos), setor, Descrição_ocorrência (lista com busca e várias seleções) e **Canal** (botões, coluna `DESC_COMUNICACAO`; substituiu o filtro de Descrição_tipo_ocorrencia a pedido do autor em 03/11/2026 — o tipo continua aparecendo no detalhe do protocolo).
    - Canais em ordem de volume, com nomes curtos ("E-MAIL INSTITUCIONAL" → "E-mail"). No desktop ficam numa linha; os que não cabem vão para o botão **"+N"**, que abre uma lista (ex.: 1366 px mostra 7 e "+2"; a partir de 1440 px cabem os 9). No celular rolam para o lado.
    - ⚠️ A planilha tem também a coluna `COMUNICACAO` (só códigos). O reconhecimento de colunas tenta os nomes de `CAMPOS` **na ordem de preferência**, então `DESC_COMUNICACAO` é a escolhida.
  - **Tabela** (na própria tela 1, todos os protocolos filtrados): Protocolo (`PROTOCOLO_ANS`), CPF, E-mail, Setor, Descrição da ocorrência, Data de abertura, Data de previsão (`DATA_PREVISAO_SLA`), Status RN 623 (encerrados contam até o encerramento) e Observação de abertura (clique abre o texto inteiro). Busca por protocolo, CPF ou e-mail. A exportação **não tem filtro próprio**: **Exportar Excel** leva exatamente os protocolos da tabela (filtros da tela + busca), com dados pessoais (decisão do autor). O nome da planilha e a data mais recente aparecem ao lado do título "Protocolos".
  - O rótulo do grupo de botões dos filtros (hoje **"Canal"**) fica sempre visível (pedido do autor).
  - ⚠️ Antes de entregar mudanças nesta tela, rodar a avaliação em vários tamanhos (1354 × 636, 1366 × 768, 1280 × 720, 1440 × 800, 1920 × 950/1080 e celular), com números de 4 dígitos nos cartões: nada pode rolar, transbordar, se sobrepor nem ficar cortado.
- Setores: além de `REGRAS_SETORES`, há `COMPLEMENTO_SETORES` (combinações exatas aprovadas pelo autor em 03/11/2026). Na planilha real de 13.683 linhas sobram 19 sem setor; elas aparecem como "Não classificado" até o autor dizer onde entram.

### Inteligência de Rede (chamados do CRM)
- **RN 566:** já vem pronta na planilha (coluna de status). Tudo que é "em dia" ou "atraso" nessa regra segue a planilha. O site só lê.
- **RN 623:** calculada pelo site, em **dias úteis** entre a abertura e o encerramento. Se o chamado está aberto, conta até hoje.
  - **Em atraso:** mais de 5 dias úteis.
  - **Em atenção:** 4 a 5 dias úteis.
  - **Em dia:** menos de 4 dias úteis.
  - **Dia útil = segunda a sexta.** Descontam-se **apenas os finais de semana** (sábado e domingo).
  - **Feriados não entram na regra:** um feriado que cai de segunda a sexta conta como dia útil normal. Não há lista de feriados (`prazoRN623` e `diasUteisEntre` em `inteligencia.js`).
- ⚠️ Os indicadores abaixo (IR mensal, RN 566, tempo médio, reclamações, evolução etc.) **existiam na versão antiga** e hoje estão só em `ARQUIVO/inteligencia-v1/`. Eles voltam quando o autor definir as próximas telas.
- **IR mensal (índice de resolução no prazo):** entre os chamados **abertos no mês atual e já encerrados**, é o percentual resolvido no prazo **segundo a RN 566** (a da planilha). Regra confirmada pelo autor. Fórmula: resolvidos no prazo ÷ encerrados do mês × 100.
  - No código (`prepararRegistro`, campo `resolvidoNoPrazo`), o valor é verdadeiro quando o chamado está encerrado **e** o texto de status da RN 566 contém "em dia", "no prazo", "cumprido" ou "resolvido no prazo". Se a planilha usar outra redação, o chamado não será contado como no prazo.
- **Tempo médio de encerramento:** média em dias úteis, com a mesma regra (segunda a sexta).
- Outros indicadores atuais: total, abertos hoje, encerrados hoje, em aberto, atrasos RN 566 e RN 623, SLA por setor, evolução mensal, abertura × encerramento, por assunto/setor e reclamações (total, média mensal, por plano/assunto/setor, evolução). Também há uma tabela de consulta com exportação para Excel.

### Relacionamento (captação e cadastro)
- Indicadores atuais: total de leads, sem plano, 1º/2º/3º contato, interessados e quem aceitou preencher a adesão.
- **Temperatura do lead** (frio/morno/quente) vem da própria planilha.
- Quebras por órgão e por colaborador, filtros e base de leads.

### Geolocalização de vidas e rede (antigo "Saúde e Social") — 19/11/2026 ✅ aprovada pelo autor (não mudar sem pedido)
- **Origem (pedido do autor, 19/11/2026):** a página foi refeita **igual à versão do projeto de testes** (zip `Projeto_dashb-main`), pegando só os arquivos dela, e ganhou um nome mais específico. Arquivos: `HTML/geolocalizacao.html`, `CSS/geolocalizacao.css` (base igual à do teste), `CSS/geolocalizacao-prisma.css` (cores do PRISMA e modo claro, vinda do antigo `saude-social-nexus.css`) e `JAVA/geolocalizacao.js` (lógica igual à do teste; só acrescentei o desenho dos ícones Lucide).
- Adaptações ao PRISMA: marca PRISMA no lugar de ASSEFAZ, `tema.js`, favicon, volta para a Visão Geral se aberta sozinha e ponte do tutorial. **Não usa** `portal-chegada.js`.
- Saiu em relação à página antiga do PRISMA: botão "Atualizar arquivos do site" (lia `../dados/`), status das bases, filtro de contratação e o menu de camadas por tipo. Agora tudo vem do que o usuário importa.
- Os arquivos antigos (`saude-social.html`, `saude-social.css`, `rede-integrada.css`, `saude-social-nexus.css`, `saude-social.js`) continuam na pasta, mas não são mais usados; apagar só com o OK do autor.
- Página com cabeçalho, faixa de indicadores e **dois mapas** (Leaflet + leaflet.heat), cada um com botão de restaurar o enquadramento.
- **Planilha de beneficiários:** procura, nas 30 primeiras linhas de cada aba, um cabeçalho com `BAIRRO`, `CIDADE` (ou `MUNICIPIO`) e `ESTADO` (ou `UF`). Cada linha é **uma vida**. Aceita `.xlsx`, `.xls` e `.xlsb` (não aceita `.csv`).
- **Indicadores:** Unidades da rede, Hospitais, Total de vidas (todas as linhas), Vidas no RJ (UF `RJ` ou `RIO DE JANEIRO`), Região Metropolitana, Municípios com beneficiários, nome do arquivo e data/hora da importação.
- **Região Metropolitana** = lista fixa `METRO` no `geolocalizacao.js` (22 municípios, incluindo Petrópolis).
- **Cada mapa tem a sua planilha:** "Importar rede" preenche o mapa 01; "Importar beneficiários" preenche o mapa 02 **e** entra no mapa 01 para comparar com a rede.
- **Mapa 01 — Rede credenciada × beneficiários:** todos os municípios do RJ, na largura toda e quase a altura da janela. Barra compacta de uma linha: modos **Calor / Marcadores / Ambos** (padrão Ambos; marcadores = gotas H/C/L/O agrupadas por proximidade e categoria), camadas **Rede** e **Beneficiários** (liga/desliga), botão **Filtros** (painel suspenso com Urgência, Tipo, Especialidade e Município; fecha ao clicar fora ou com Esc; mostra quantos filtros estão ativos), números (unidades, municípios, vidas) e restaurar. Posição = centro do município (a planilha não tem coordenadas).
  - Lê a planilha de hospitais (`CNPJ/ CPF`, `PRESTADOR`, `MUNICÍPIO`, `BAIRRO`, `TIPO DE PRESTADOR`, `ESPECIALIDADE/SERVIÇO`, `ATENDIMENTO DE URGENCIA E EMERGENCI…`; sem UF = RJ) e o formato antigo do sistema (`NmeMunicipio`, `NmeFantasia`, `ClasseCadastro`, `Urgencia`…). Especialidades combinadas viram itens separados; "HOSPITAIS" = "HOSPITAL"; `#N/A` = vazio. Uma unidade = CNPJ (ou nome) + município + endereço/bairro.
  - **Comparação:** com as duas camadas, beneficiários = calor quente (amarelo → vermelho, por baixo) e rede = calor frio (azul → ciano, por cima); legenda "Vidas / Rede" no canto. O balão do município mostra unidades, vidas e vidas por unidade.
  - **Regiões de saúde (pedido do autor, 19/11/2026, ⏳ aguardando aprovação):** as **9 regiões de saúde da SES-RJ** (lista `REGIOES` no `geolocalizacao.js`, 92 municípios) aparecem no mapa 01 **só como linhas coloridas em volta de cada região**, sem pintar o fundo (Centro-Sul = marrom; cada região uma cor). Na divisa entre duas regiões a linha alterna as duas cores (uma tracejada sobre a outra); um contorno escuro por baixo deixa a linha visível sobre o calor. As linhas saem da própria malha dos municípios (trechos de divisa compartilhados), sem baixar nada a mais. Botão de camada **Regiões** (liga/desliga), legenda recolhível no canto inferior direito e o nome da região no balão de cada município.
  - ❌ **Tentativas rejeitadas pelo autor (19/11/2026), desfeitas:** (1) modo "Áreas" com 5 faixas de laranja + círculos azuis; (2) modo "Municípios" com o calor pintando cada município + estados vizinhos (MG, ES, SP) e contorno do Brasil vindos da API do IBGE. O autor quer o calor original ("apenas com o valor") e **só o RJ** no mapa; o `geolocalizacao.js` voltou à versão do zip, mais as regiões.
  - **Ranking "Onde expandir"** (canto superior direito, recolhível): 8 municípios com mais vidas por unidade, pontuação = vidas ÷ (unidades + 1); valem os filtros da rede, menos o de município. Só aparece com as duas planilhas. Clicar aproxima o mapa.
  - **Janela do Rio até Niterói (pedido do autor, 19/11/2026, ⏳ aguardando aprovação):** no mapa 01, clicar no **Rio de Janeiro ou em Niterói** abre **uma janela só**, já enquadrada nas duas cidades juntas (`FOCO_RIO`, `limitesFoco`), com as unidades dos filtros atuais **só do Rio e de Niterói** posicionadas pelo bairro (Nominatim, um por vez) e, com beneficiários, o calor dos bairros dessas duas cidades. O enquadramento não pula para os pontos. Sem rede importada, abre a janela de bairros (`janelaBairros`) só com os bairros do Rio e de Niterói (`openBairrosRio`). A janela de bairros do **mapa 02** não mudou (estado todo).
    - **Rede e beneficiários aparecem juntos (pedido do autor, 19/11/2026):** a busca alterna um bairro da rede e um bairro de beneficiários (do mais cheio para o mais vazio), em vez de localizar a rede inteira antes; quando a rede acaba, segue só com os beneficiários que faltam. As duas linhas de progresso andam ao mesmo tempo.
- **Janela de bairros — fica como o autor fez (decisão do autor, 05/11/2026).** Cada bairro é buscado no **Nominatim**, um por vez, com 1,15 s de espera (com a planilha real: ~4 min no Rio, 175 bairros; ~1 min em Niterói, 37). O autor aceita a lentidão.
  - ⚠️ **Não mexer nesta janela sem pedido.** Em 05/11/2026 foi testada uma versão instantânea (posições locais da malha de bairros do IBGE 2022 + correção de nomes abreviados), e também um fundo escuro no lugar do mapa de ruas; o autor **rejeitou as duas** e pediu a versão original de volta (`saude-social.js` restaurado como estava). Os arquivos `bairros-rj.js` e `bairros-localizar.js` foram apagados.
  - Fundo: mapa de ruas do **OpenStreetMap**, igual ao zip (decisão do autor, 19/11/2026: a troca pela Esri foi **rejeitada**). O OSM mostrava "Access blocked" porque a página usa `<meta name="referrer" content="no-referrer">`; a correção é a opção `referrerPolicy:'strict-origin-when-cross-origin'` no `L.tileLayer`, que manda o endereço do site só para as imagens do mapa. Aberto direto do arquivo (`file://`) continua sem referrer e pode bloquear; publicado ou por servidor local, funciona.
- **Mapa 02 — Estado do Rio de Janeiro:** beneficiários por município em todo o RJ, modos **Calor**, **Bolhas** e **Ambos**. Não mostra prestadores.
  - **Janela de bairros do estado (pedido do autor, 05/11/2026):** no mapa 02, **só o município do Rio de Janeiro** abre a janela (dica "Clique para explorar os bairros do estado"; os outros municípios continuam com o balão do total). A janela usa a função `janelaBairros`, com o título "ESTADO DO RIO DE JANEIRO — CONCENTRAÇÃO POR BAIRRO" e os bairros de **todas as cidades da planilha**, cada um como "BAIRRO — CIDADE" (há nomes repetidos, como CENTRO).
  - Usa a mesma busca no Nominatim, um por vez: com a planilha real são 508 bairros em 54 cidades, **~10 min** (aceito pelo autor). Para cidades fora de Rio/Niterói, a busca vai com o nome da cidade e só aceita pontos dentro do estado do RJ.
- O rodapé de cada mapa (maior concentração e percentual) existe no HTML, mas o JS o remove ao iniciar.
- ⚠️ **Depende de internet**, ao contrário do resto do site: os contornos dos municípios vêm do GitHub (`tbrugz/geodata-br`), o mapa de bairros usa os mapas do OpenStreetMap, as bibliotecas vêm de CDN e a localização de cada bairro é buscada no **Nominatim**. Nessa busca, **os nomes dos bairros saem do navegador** (sem nome, CPF nem contagem), o que contraria a regra "nada é enviado" da seção 2; o autor preferiu manter assim.

## 9. Importação de planilhas
- Formatos aceitos: `.xlsx`, `.xls` e `.csv`.
- As colunas são reconhecidas pelo **nome do cabeçalho**, ignorando acentos, maiúsculas e variações. Cada setor tem uma lista de nomes aceitos para cada campo.
- Novos setores devem seguir esse padrão, para que a planilha possa ter pequenas variações de nome sem quebrar.

## 10. Pendências (em ordem sugerida)

### ⏭️ Nova fase (17/11/2026): segurança + Supabase + PostgreSQL
Mesmo ritmo de sempre: o autor descreve, perguntamos o que tiver dúvida, fazemos, testamos e ele aprova.
1. **Login:** ✅ visual novo PRISMA aprovado (seção 4). Próximo passo: Supabase Auth + proteção das páginas internas (sem sessão, volta para o login).
2. Banco: modelar as tabelas (formulário de reunião, assuntos por setor, kanban) com RLS e migrar do `localStorage`/IndexedDB.
3. Revisar cada página pelo lado da segurança (dados pessoais, HTML vindo da planilha, bibliotecas de CDN).
- ⚠️ **Atenção:** o antigo `saude-social.js` tentava baixar `../dados/familia-saude.xlsx` do próprio site (a Geolocalização, desde 19/11/2026, só lê o que o usuário importa). Essa planilha tem dados pessoais (CPF, nomes, telefones): **ela nunca pode ser publicada** no GitHub Pages. Hoje não existe pasta `dados/` no projeto. Com o banco, esses dados devem vir do Supabase com acesso restrito.

### Fase anterior
1. ✅ **Mascote NEXUS** (03/11/2026): camadas, olhos e cabeça seguindo o cursor, piscadas, expressões e ícone 512 × 512 prontos, e já usados no login.
2. ✅ **Login reformulado** (03/11/2026) com a paleta Ciano elétrico, marca NEXUS, usuário de demonstração, modo alerta vermelho no erro e transição de portal no acesso.
   ✅ **Inteligência de Rede — tela 1** reformulada e **aprovada pelo autor** (03/11/2026). Ajustes nela, se houver, ficam para depois.
   ⏭️ **Inteligência de Rede — tela 2**, logo abaixo da tela 1 no menu; o autor vai passar os indicadores. Também pendentes: as 19 combinações sem setor.
   Falta reformular **Relacionamento**.
   ⏭️ **Agora (05/11/2026), antes de criar novas páginas:** melhorias no **login** e na página **Saúde e Social**, que o autor vai descrever. Seguir o mesmo ritmo das outras telas: ele descreve, perguntamos o que tiver dúvida, fazemos, testamos e ele aprova.
   - ✅ Login, melhoria 1: transição de portal esfumaçada (2,8 s) e som espacial contínuo, que termina no login (seção 4). **Aprovada pelo autor em 05/11/2026.** Não mudar sem pedir.
   Pendências já vistas no código da Saúde e Social (confirmar com o autor antes de mexer):
   - Marca **ASSEFAZ** no título, no cabeçalho e no rodapé (contraria a seção 1); trocar pela marca NEXUS. O sobretítulo diz "Inteligência de Rede", mas o painel é Saúde e Social.
   - Paleta própria (`--bg`, `--cyan` etc.) em vez das variáveis `--nexus-*`; sem logo/favicon do NEXUS.
   - Bibliotecas por CDN: Leaflet 1.9.4, leaflet.heat 0.2.0, Lucide 0.468.0 e SheetJS **0.18.5** (o projeto usa o 0.20.3 de `LIB/`). O JS também tenta carregá-las de novo sozinho.
   - ✅ O `<script>` apontava para `../java/saude-social.js` (minúsculo), o que quebraria no GitHub Pages. Corrigido para `../JAVA/` em 05/11/2026. Sempre usar as pastas em maiúsculas (`HTML/`, `CSS/`, `JAVA/`, `ASSETS/`, `LIB/`).
   - ❌ Saúde e Social, tentativa 1 (janela de bairros mais rápida): **rejeitada pelo autor** em 05/11/2026 e desfeita. A janela voltou à versão original (seção 8).
   - ✅ Saúde e Social, melhoria 2: janela de bairros de todo o estado ao clicar no Rio no mapa 02 (seção 8). **Aprovada pelo autor em 17/11/2026.** Não mudar sem pedir.
   - Ainda depende de internet: contornos dos municípios (GitHub), mapa de ruas e Nominatim na janela de bairros, e bibliotecas (CDN).
   - Não aceita `.csv` (a seção 9 pede `.xlsx`, `.xls` e `.csv`).
   - Falta planilha de exemplo **fictícia** em `EXEMPLOS/`.
3. Definir as cores de status (em dia / atenção / atraso). Hoje estão provisórias (seção 5).
4. Trocar as bibliotecas de CDN por arquivos locais: ✅ Inteligência de Rede já usa o SheetJS 0.20.3 de `LIB/` (e não usa mais Chart.js). Falta o `cad-cap.html`.
5. Renomear "Captação/Cadastro" para "Relacionamento" nas páginas `cad-cap.*` (o login já usa o nome novo) e trocar Optmus/ANALISTA por NEXUS nelas. Depois, remover as imagens `optmus-*` de `ASSETS/` e o `nexus-personagem.js` da raiz.
6. Criar planilhas de exemplo **fictícias** para demonstrar o portfólio. ✅ Inteligência de Rede (`EXEMPLOS/`). Falta a do Relacionamento.
7. Mais tarde: indicadores da **Visão geral** e do **Faturamento**.

## 11. Como trabalhar neste projeto
- Antes de mudar uma regra de negócio, confira a seção 8. Em caso de dúvida, pergunte ao autor em vez de supor.
- Não adicione frameworks nem build. O banco é só o Supabase/PostgreSQL definido na seção 2.
- Pense primeiro na segurança (seção 2). Na dúvida entre o jeito mais rápido e o mais seguro, pergunte ao autor.
- Teste por um servidor local (`.claude/launch.json`), porque o login do Supabase e o mapa de ruas não funcionam bem em `file://`.
- Ao terminar uma pendência, atualize a seção 10 deste arquivo.
