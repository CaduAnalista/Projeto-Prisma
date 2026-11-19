/* ==========================================================
   VOLUME E PRODUTIVIDADE — PRISMA (v1, 19/11/2026)
   Indicadores de produção dos colaboradores a partir da
   exportação do CRM. Regras combinadas com o autor:
   - encerrados: coluna "Usuário Encerramento Ocorrência"
     (só ocorrências com status Encerrada);
   - para tratar: coluna "Descrição Operador Responsável"
     (só ocorrências com status Pendente);
   - responsável em branco = "Sem responsável".
   Tudo é calculado no navegador: a planilha não sai daqui.
   ========================================================== */

(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);

    /* ======================================================
       1. COLUNAS
       Aceito o formato novo do CRM ("Usuário Encerramento Ocorrência",
       com acento e espaço) e o antigo ("USUARIO_ENCERRAMENTO_OCORRENCIA"):
       os dois viram a mesma chave sem acento, espaço nem sublinhado.
       Aqui só aceito nome exato, porque a planilha tem colunas parecidas
       (ex.: "Operador Responsável" é o código e "Descrição Operador
       Responsável" é o nome; "Status Atendimento" x "Status Ocorrência").
    ====================================================== */

    const CAMPOS = {
        encerrouPor: ['USUARIO ENCERRAMENTO OCORRENCIA', 'USUARIO ENCERRAMENTO', 'USUARIO DE ENCERRAMENTO'],
        responsavel: ['DESCRICAO OPERADOR RESPONSAVEL', 'DESC OPERADOR RESPONSAVEL', 'NOME OPERADOR RESPONSAVEL'],
        status: ['STATUS OCORRENCIA', 'STATUS DA OCORRENCIA', 'STATUS'],
        abertura: ['DATA ABERTURA OCORRENCIA', 'DATA ABERTURA', 'DATA DE ABERTURA'],
        encerramento: ['DATA ENCERRAMENTO OCORRENCIA', 'DATA ENCERRAMENTO', 'DATA DE ENCERRAMENTO'],
        horaEncerramento: ['HORA ENCERRAMENTO OCORRENCIA', 'HORA ENCERRAMENTO', 'HORA DE ENCERRAMENTO'],
        previsao: ['DATA PREVISAO SLA', 'DATA PREVISAO', 'DATA DA PREVISAO'],
        slaCumprido: ['SLA CUMPRIDO'],
        tipo: ['DESC TIPO OCORRENCIA', 'DESCRICAO TIPO OCORRENCIA', 'TIPO DE OCORRENCIA', 'TIPO OCORRENCIA'],
        /* no formato novo "Canal" tem o nome; "Comunicação" só tem código */
        canal: ['DESC COMUNICACAO', 'DESCRICAO COMUNICACAO', 'CANAL', 'CANAL DE COMUNICACAO'],
        severidade: ['SEVERIDADE ATENDIMENTO', 'SEVERIDADE OCORRENCIA', 'SEVERIDADE']
    };

    const SEM_RESPONSAVEL = 'Sem responsável';
    const SEM_COLABORADOR = 'Sem colaborador';

    function normalizar(valor) {
        return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toUpperCase().replace(/\s+/g, ' ').trim();
    }

    /* "Usu�rio" (acento estragado na exportação) também precisa bater:
       tiro tudo que não for letra/número */
    const chaveCabecalho = (v) => normalizar(v).replace(/[^A-Z0-9]/g, '');

    function resolverColunas(cabecalhos) {
        const chaves = cabecalhos.map((c) => ({ original: c, chave: chaveCabecalho(c) }));
        const mapa = {};
        for (const [campo, nomes] of Object.entries(CAMPOS)) {
            let achado = null;
            for (const n of nomes) {
                const alvo = chaveCabecalho(n);
                achado = chaves.find((c) => c.chave === alvo);
                /* exportação com acento estragado ("USURIO"): comparo sem as vogais acentuadas perdidas */
                if (!achado) {
                    const semVogais = (s) => s.replace(/[AEIOU]/g, '');
                    achado = chaves.find((c) => semVogais(c.chave) === semVogais(alvo));
                }
                if (achado) break;
            }
            mapa[campo] = achado ? achado.original : null;
        }
        return mapa;
    }

    /* ======================================================
       2. AJUDANTES
    ====================================================== */

    const texto = (v) => String(v ?? '').trim();
    const nomeLimpo = (v) => texto(v).replace(/\s+/g, ' ');
    const numeroBR = (n) => Number(n || 0).toLocaleString('pt-BR');
    const decimalBR = (n, casas = 1) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    const pctBR = (x) => (x === null || x === undefined ? '—' : `${decimalBR(x * 100, 0)}%`);

    function escapar(t) {
        return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function nomeBonito(t) {
        const s = texto(t).toLowerCase();
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    }

    function dataDeCelula(valor) {
        if (valor === null || valor === undefined || valor === '') return null;
        if (valor instanceof Date && !isNaN(valor)) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
        if (typeof valor === 'number' && window.XLSX && XLSX.SSF) {
            const p = XLSX.SSF.parse_date_code(valor);
            return p ? new Date(p.y, p.m - 1, p.d) : null;
        }
        const t = String(valor).trim();
        let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
        if (m) {
            let ano = Number(m[3]);
            if (ano < 100) ano += ano < 50 ? 2000 : 1900;
            const d = new Date(ano, Number(m[2]) - 1, Number(m[1]));
            return isNaN(d) ? null : d;
        }
        m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (/^\d+(\.\d+)?$/.test(t)) return dataDeCelula(Number(t));
        return null;
    }

    const DIA_MS = 86400000;
    /* dias úteis (seg a sex) do dia seguinte à abertura até o encerramento; feriados não entram */
    function diasUteisEntre(inicio, fim) {
        if (!inicio || !fim) return null;
        const total = Math.round((Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate()) -
            Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) / DIA_MS);
        if (total < 0) return null;
        let uteis = Math.floor(total / 7) * 5;
        let dia = inicio.getDay();
        for (let i = 0; i < total % 7; i++) {
            dia = (dia + 1) % 7;
            if (dia !== 0 && dia !== 6) uteis++;
        }
        return uteis;
    }

    const chaveDia = (d) => (d ? d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() : 0);
    const doisDigitos = (n) => String(n).padStart(2, '0');
    const paraInput = (d) => (d ? `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}` : '');
    const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mesDaData = (d) => (d ? d.getFullYear() * 100 + d.getMonth() + 1 : 0);
    const proximoMes = (m) => (m % 100 === 12 ? (Math.floor(m / 100) + 1) * 100 + 1 : m + 1);
    const mesAnterior = (m) => (m % 100 === 1 ? (Math.floor(m / 100) - 1) * 100 + 12 : m - 1);
    const rotuloMes = (m) => `${NOMES_MES[(m % 100) - 1]}/${String(Math.floor(m / 100)).slice(2)}`;

    function hoje() {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    /* mesmas faixas do IR na Inteligência: 90%+ verde, 85% a 89,9% amarelo, abaixo vermelho */
    const faixaSla = (x) => (x === null ? '' : x >= 0.9 ? 'bom' : x >= 0.85 ? 'medio' : 'ruim');

    /* ======================================================
       3. ESTADO
    ====================================================== */

    const filtrosVazios = () => ({ de: null, ate: null, colab: '', status: '', tipo: '', canal: '', sev: '', minimo: 0 });

    const estado = {
        encerrados: [],     // ocorrências encerradas
        pendentes: [],      // ocorrências pendentes (demanda em aberto)
        filtros: filtrosVazios(),
        temSla: false,
        nomeArquivo: '',
        linhas: [],         // tabela por colaborador (já filtrada)
        ordem: { campo: 'enc', desc: true },
        graficos: {}
    };

    /* ======================================================
       4. IMPORTAÇÃO
    ====================================================== */

    function prepararRegistros(linhas, colunas) {
        const pegar = (linha, campo) => (colunas[campo] ? linha[colunas[campo]] : '');
        const encerrados = [];
        const pendentes = [];
        const abertos = [];
        for (const linha of linhas) {
            const status = normalizar(pegar(linha, 'status'));
            const abertura = dataDeCelula(pegar(linha, 'abertura'));
            const encerramento = dataDeCelula(pegar(linha, 'encerramento'));
            if (!status && !abertura && !encerramento) continue; /* linha vazia */

            /* sem a coluna de status: encerrado = tem data de encerramento */
            const pendente = colunas.status ? status.includes('PENDENTE') : !encerramento;
            const encerrado = colunas.status ? status.includes('ENCERRAD') : Boolean(encerramento);

            const base = {
                abertura,
                chaveAb: chaveDia(abertura),
                mesAb: mesDaData(abertura),
                /* status da ocorrência para o filtro "Status" (na planilha: Encerrada ou Pendente) */
                statusNorm: pendente ? 'PENDENTE' : encerrado ? 'ENCERRADA' : status,
                tipoNorm: normalizar(pegar(linha, 'tipo')),
                canalNorm: normalizar(pegar(linha, 'canal')),
                sevNorm: normalizar(pegar(linha, 'severidade')),
                /* regra do autor: responsável em branco = "Sem responsável" */
                responsavel: nomeLimpo(pegar(linha, 'responsavel')) || SEM_RESPONSAVEL
            };
            /* todas as ocorrências com data de abertura: é a linha "Abertos" do gráfico mensal */
            if (abertura) abertos.push(base);

            if (pendente) {
                const previsao = dataDeCelula(pegar(linha, 'previsao'));
                pendentes.push({ ...base, previsao });
            } else if (encerrado) {
                const previsao = dataDeCelula(pegar(linha, 'previsao'));
                const sla = normalizar(pegar(linha, 'slaCumprido'));
                /* SLA cumprido: coluna "SLA Cumprido" (S/N); sem ela, encerrou até a previsão */
                const noPrazo = colunas.slaCumprido
                    ? (sla === 'S' || sla === 'SIM' ? true : sla === 'N' || sla === 'NAO' ? false : null)
                    : (previsao && encerramento ? chaveDia(encerramento) <= chaveDia(previsao) : null);
                encerrados.push({
                    ...base,
                    colaborador: nomeLimpo(pegar(linha, 'encerrouPor')) || SEM_COLABORADOR,
                    encerramento,
                    chaveEnc: chaveDia(encerramento),
                    mes: mesDaData(encerramento),
                    dias: diasUteisEntre(abertura, encerramento),
                    noPrazo
                });
            }
        }
        return { encerrados, pendentes, abertos };
    }

    function importarArquivo(arquivo) {
        if (!arquivo) return;
        if (!/\.(xlsx|xls|csv)$/i.test(arquivo.name)) { avisar('Formato não aceito. Use .xlsx, .xls ou .csv.', true); return; }
        if (!window.XLSX) { avisar('A biblioteca de leitura de Excel não carregou (LIB/xlsx-0.20.3.full.min.js).', true); return; }

        avisar('Lendo a planilha…');
        const leitor = new FileReader();
        leitor.onerror = () => avisar('Não foi possível ler o arquivo.', true);
        leitor.onload = () => {
            setTimeout(() => {
                try {
                    const livro = XLSX.read(leitor.result, { type: 'array', cellDates: false });
                    const linhas = XLSX.utils.sheet_to_json(livro.Sheets[livro.SheetNames[0]], { defval: '', raw: true });
                    if (!linhas.length) throw new Error('A planilha está vazia.');

                    const colunas = resolverColunas(Object.keys(linhas[0]));
                    if (!colunas.encerrouPor && !colunas.responsavel) {
                        throw new Error('Não achei as colunas "Usuário Encerramento Ocorrência" nem "Descrição Operador Responsável".');
                    }
                    const { encerrados, pendentes, abertos } = prepararRegistros(linhas, colunas);
                    estado.encerrados = encerrados;
                    estado.pendentes = pendentes;
                    estado.abertos = abertos;
                    estado.temSla = Boolean(colunas.slaCumprido || colunas.previsao);
                    estado.nomeArquivo = arquivo.name;
                    estado.filtros = filtrosVazios();
                    estado.hoje = hoje();

                    montarFiltros();
                    atualizarTudo();

                    const falta = ['encerrouPor', 'responsavel', 'status', 'slaCumprido', 'abertura']
                        .filter((c) => !colunas[c]).map((c) => CAMPOS[c][0]);
                    avisar(`${numeroBR(encerrados.length)} encerrados e ${numeroBR(pendentes.length)} pendentes.` +
                        (falta.length ? ` Sem as colunas: ${falta.join(', ')}.` : ''), falta.length > 0);
                } catch (erro) {
                    avisar(erro.message || 'Não foi possível ler a planilha.', true);
                }
            }, 30);
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    /* ======================================================
       5. FILTROS
       Período: vale para os encerrados (data de encerramento).
       "Para tratar" é sempre a demanda de hoje, sem período.
    ====================================================== */

    function contarPor(lista, chave) {
        const m = new Map();
        for (const r of lista) { const k = chave(r); if (k) m.set(k, (m.get(k) || 0) + 1); }
        return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
    }

    function preencher(id, pares, rotulo = (k) => k, todos = 'Todos') {
        $(id).innerHTML = `<option value="">${todos}</option>` +
            pares.map(([k, n]) => `<option value="${escapar(k)}">${escapar(rotulo(k))} · ${numeroBR(n)}</option>`).join('');
    }

    function montarFiltros() {
        const todos = [...estado.encerrados, ...estado.pendentes];
        /* colaborador: quem encerrou e quem tem pendente */
        const nomes = new Map();
        estado.encerrados.forEach((r) => nomes.set(r.colaborador, (nomes.get(r.colaborador) || 0) + 1));
        estado.pendentes.forEach((r) => { if (!nomes.has(r.responsavel)) nomes.set(r.responsavel, 0); });
        $('fColab').innerHTML = '<option value="">Todos</option>' +
            [...nomes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
                .map(([n, q]) => `<option value="${escapar(n)}">${escapar(n)}${q ? ` · ${numeroBR(q)}` : ''}</option>`).join('');
        /* status: conto todas as ocorrências com abertura (inclui algum status diferente, se aparecer) */
        preencher('fStatus', contarPor(estado.abertos.length ? estado.abertos : todos, (r) => r.statusNorm), nomeBonito);
        preencher('fTipo', contarPor(todos, (r) => r.tipoNorm), nomeBonito);
        preencher('fCanal', contarPor(todos, (r) => r.canalNorm), nomeBonito);
        preencher('fSev', contarPor(todos, (r) => r.sevNorm), nomeBonito, 'Todas');
    }

    function passaCategorias(r) {
        const f = estado.filtros;
        /* status vale para tudo: Encerrada esconde a demanda em aberto; Pendente esconde os encerrados
           e a linha dos abertos passa a mostrar de que mês vêm os pendentes */
        if (f.status && r.statusNorm !== f.status) return false;
        if (f.tipo && r.tipoNorm !== f.tipo) return false;
        if (f.canal && r.canalNorm !== f.canal) return false;
        if (f.sev && r.sevNorm !== f.sev) return false;
        return true;
    }

    function passaPeriodo(r) {
        const { de, ate } = estado.filtros;
        if (de && (!r.chaveEnc || r.chaveEnc < chaveDia(de))) return false;
        if (ate && (!r.chaveEnc || r.chaveEnc > chaveDia(ate))) return false;
        return true;
    }

    function lerFiltrosDaTela() {
        const f = estado.filtros;
        f.de = dataDeCelula($('fDe').value);
        f.ate = dataDeCelula($('fAte').value);
        f.colab = $('fColab').value;
        f.status = $('fStatus').value;
        f.tipo = $('fTipo').value;
        f.canal = $('fCanal').value;
        f.sev = $('fSev').value;
        f.minimo = Number($('fMinimo').value) || 0;
    }

    function sincronizarTela() {
        const f = estado.filtros;
        $('fDe').value = paraInput(f.de);
        $('fAte').value = paraInput(f.ate);
        $('fColab').value = f.colab;
        $('fStatus').value = f.status;
        $('fTipo').value = f.tipo;
        $('fCanal').value = f.canal;
        $('fSev').value = f.sev;
        $('fMinimo').value = String(f.minimo);
        document.querySelectorAll('.er-filtros label').forEach((l) => {
            const campo = l.querySelector('select, input');
            l.classList.toggle('em-uso', Boolean(campo && campo.value && campo.value !== '0'));
        });
    }

    /* ======================================================
       6. CÁLCULO POR COLABORADOR
    ====================================================== */

    function mediana(nums) {
        if (!nums.length) return null;
        const v = [...nums].sort((a, b) => a - b);
        const meio = Math.floor(v.length / 2);
        return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
    }

    function calcular() {
        const f = estado.filtros;
        const enc = estado.encerrados.filter((r) => passaCategorias(r) && passaPeriodo(r));
        const pend = estado.pendentes.filter(passaCategorias);
        const totalEquipe = enc.length;

        const por = new Map();
        const pegar = (n) => {
            if (!por.has(n)) por.set(n, { nome: n, enc: [], pend: [] });
            return por.get(n);
        };
        enc.forEach((r) => pegar(r.colaborador).enc.push(r));
        pend.forEach((r) => pegar(r.responsavel).pend.push(r));

        const ref = estado.hoje;
        const linhas = [];
        for (const p of por.values()) {
            const e = p.enc;
            const dias = new Set(e.map((r) => r.chaveEnc).filter(Boolean));
            const comSla = e.filter((r) => r.noPrazo !== null);
            const noPrazo = comSla.filter((r) => r.noPrazo).length;
            const tempos = e.map((r) => r.dias).filter((d) => d !== null);
            const canais = contarPor(e, (r) => r.canalNorm);
            linhas.push({
                nome: p.nome,
                semResp: p.nome === SEM_RESPONSAVEL,
                enc: e.length,
                part: totalEquipe ? e.length / totalEquipe : 0,
                pend: p.pend.length,
                venc: p.pend.filter((r) => r.previsao && chaveDia(r.previsao) < chaveDia(ref)).length,
                dias: dias.size,
                media: dias.size ? e.length / dias.size : null,
                sla: comSla.length ? noPrazo / comSla.length : null,
                atraso: comSla.length - noPrazo,
                tempo: mediana(tempos),
                mesmo: tempos.length ? tempos.filter((d) => d === 0).length / tempos.length : null,
                recl: e.length ? e.filter((r) => r.tipoNorm.includes('RECLAMA')).length / e.length : null,
                alta: e.length ? e.filter((r) => r.sevNorm === 'ALTA').length / e.length : null,
                canal: canais.length ? nomeBonito(canais[0][0]) : '',
                canais,
                qtdRecl: e.filter((r) => r.tipoNorm.includes('RECLAMA')).length
            });
        }

        /* "Mínimo de encerrados": esconde quem encerrou pouco, mas nunca quem tem pendente */
        const visiveis = linhas.filter((l) => l.enc >= f.minimo || l.pend > 0);
        return { enc, pend, linhas: visiveis, totalEquipe };
    }

    /* ======================================================
       7. TELA
    ====================================================== */

    function atualizarTudo() {
        const temDados = estado.encerrados.length + estado.pendentes.length > 0;
        const c = calcular();
        const f = estado.filtros;
        /* com um colaborador escolhido, a tabela e os gráficos de tempo mostram só ele */
        const encSel = f.colab ? c.enc.filter((r) => r.colaborador === f.colab) : c.enc;
        const pendSel = f.colab ? c.pend.filter((r) => r.responsavel === f.colab) : c.pend;
        estado.linhas = f.colab ? c.linhas.filter((l) => l.nome === f.colab) : c.linhas;
        estado.calculo = c;

        const comSla = encSel.filter((r) => r.noPrazo !== null);
        const sla = comSla.length ? comSla.filter((r) => r.noPrazo).length / comSla.length : null;
        const semResp = c.pend.filter((r) => r.responsavel === SEM_RESPONSAVEL).length;

        $('resEncerrados').textContent = temDados ? numeroBR(encSel.length) : '—';
        $('resPendentes').textContent = temDados ? numeroBR(pendSel.length) : '—';
        $('resSemResp').textContent = temDados ? numeroBR(semResp) : '—';
        $('caixaSemResp').classList.toggle('ativo', semResp > 0);
        $('resSla').textContent = temDados && sla !== null ? pctBR(sla) : '—';
        $('resSla').className = faixaSla(sla) ? `pc-sla-${faixaSla(sla)}` : '';
        $('exportarExcel').disabled = !estado.linhas.length;

        if (temDados) {
            $('criterio').innerHTML = `${escapar(estado.nomeArquivo)} · <b>${numeroBR(estado.encerrados.length)}</b> encerrados e <b>${numeroBR(estado.pendentes.length)}</b> pendentes na planilha. ` +
                'Período e filtros valem para os encerrados; “Para tratar” é sempre a demanda de hoje.';
        }

        sincronizarTela();
        desenharEncerrados(c);
        desenharPendentes(c);
        /* Abertos do mês: mesmos filtros de tipo/canal/severidade; com colaborador escolhido,
           os protocolos que estão com ele (Descrição Operador Responsável). O período
           vale pela data de abertura. */
        const { de, ate } = f;
        const abSel = (estado.abertos || []).filter((r) => passaCategorias(r) &&
            (!f.colab || r.responsavel === f.colab) &&
            (!de || r.chaveAb >= chaveDia(de)) && (!ate || r.chaveAb <= chaveDia(ate)));
        desenharEvolucao(encSel, abSel);
        desenharTabela();
    }

    /* ---- dica ---- */
    function mostrarDica(html, x, y) {
        const dica = $('dica');
        dica.innerHTML = html;
        dica.hidden = false;
        const w = dica.offsetWidth;
        const h = dica.offsetHeight;
        let esq = x + 14;
        let topo = y + 14;
        if (esq + w > window.innerWidth - 8) esq = x - w - 14;
        if (topo + h > window.innerHeight - 8) topo = y - h - 14;
        dica.style.left = `${Math.max(8, esq)}px`;
        dica.style.top = `${Math.max(8, topo)}px`;
    }
    const esconderDica = () => { $('dica').hidden = true; };
    const linhaDica = (r, v) => `<div>${escapar(r)}<b>${v}</b></div>`;
    const vazio = (msg) => `<p class="vazio-pequeno">${msg}</p>`;
    const temPlanilha = () => estado.encerrados.length + estado.pendentes.length > 0;

    /* ---- barras deitadas (mesmo componente do Estudo de reclamações) ---- */
    function desenharBarras(area, itens, { limite, ativo = '', extra = () => '', rotuloOutros = 'colaboradores', classe = () => '' }) {
        if (!itens.length) { area.innerHTML = vazio(temPlanilha() ? 'Nada com esses filtros.' : 'Importe uma planilha para ver o gráfico.'); return []; }
        const mostrados = itens.slice(0, limite);
        const resto = itens.slice(limite);
        const maior = Math.max(1, ...mostrados.map((i) => i.total));
        area.innerHTML = mostrados.map((it, i) => {
            const marca = ativo ? (ativo === it.chave ? ' ativo' : ' apagado') : '';
            return `<div class="er-barra${marca}${classe(it)}" data-i="${i}" role="button" tabindex="0" aria-label="${escapar(it.nome)}: ${it.total}">
                <span class="er-pos">${i + 1}</span>
                <span class="er-nome" title="${escapar(it.nome)}">${escapar(it.nome)}</span>
                <span class="er-trilho"><span class="er-preenche" style="width:${((it.total / maior) * 100).toFixed(1)}%"></span></span>
                <span class="er-num">${numeroBR(it.total)}${extra(it)}</span>
            </div>`;
        }).join('') + (resto.length
            ? `<p class="er-outros">+ ${numeroBR(resto.length)} ${rotuloOutros} · ${numeroBR(resto.reduce((s, i) => s + i.total, 0))}</p>` : '');
        return mostrados;
    }

    function desenharEncerrados(c) {
        const itens = c.linhas.filter((l) => l.enc > 0).sort((a, b) => b.enc - a.enc)
            .map((l) => ({ ...l, chave: l.nome, total: l.enc }));
        if (temPlanilha() && !itens.length && estado.filtros.status && estado.filtros.status !== 'ENCERRADA') {
            estado.graficos.enc = [];
            $('gEncerrados').innerHTML = vazio('O filtro de status está mostrando só os pendentes.');
            return;
        }
        estado.graficos.enc = desenharBarras($('gEncerrados'), itens, {
            limite: 15,
            ativo: estado.filtros.colab,
            extra: (it) => `<small>${decimalBR(it.part * 100)}%</small>`
        });
    }

    function desenharPendentes(c) {
        const itens = c.linhas.filter((l) => l.pend > 0)
            .sort((a, b) => b.semResp - a.semResp || b.pend - a.pend)
            .map((l) => ({ ...l, chave: l.nome, total: l.pend }));
        const area = $('gPendentes');
        if (temPlanilha() && !itens.length) {
            estado.graficos.pend = [];
            area.innerHTML = vazio(estado.filtros.status && estado.filtros.status !== 'PENDENTE'
                ? 'O filtro de status está mostrando só os encerrados.' : 'Nenhum protocolo pendente com esses filtros.');
            return;
        }
        estado.graficos.pend = desenharBarras(area, itens, {
            limite: 15,
            ativo: estado.filtros.colab,
            /* "Sem responsável" sempre em primeiro e destacado (regra do autor) */
            classe: (it) => (it.semResp ? ' pc-sem-resp' : ''),
            extra: (it) => (it.venc ? `<small class="pc-venc">${numeroBR(it.venc)} venc.</small>` : '<small></small>')
        });
    }

    /* ---- colunas em SVG ---- */
    function passoEixo(maximo, divisoes = 4) {
        const bruto = Math.max(1, maximo / divisoes);
        const pot = 10 ** Math.floor(Math.log10(bruto));
        const f = bruto / pot;
        return Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot);
    }

    function eixo(maior) {
        let passo = passoEixo(maior);
        for (const d of [4, 5, 6, 8]) {
            passo = passoEixo(maior, d);
            if (Math.ceil(maior / passo) * passo <= maior * 1.2) break;
        }
        return { passo, topo: Math.max(passo, Math.ceil(maior / passo) * passo) };
    }

    function barraTopo(x, y, w, h, r) {
        r = Math.min(r, h, w / 2);
        return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
    }

    /* Colunas = encerrados do mês; linha = abertos do mês (pedido do autor, 19/11/2026).
       A cor da coluna compara com a linha: encerrou menos que abriu = vermelho,
       igual = amarelo, mais = verde. Assim dá para ver se o mês "venceu" a entrada. */
    function desenharColunas(area, colunas, titulo, media = null) {
        const W = Math.max(260, area.clientWidth);
        const H = Math.max(150, area.clientHeight);
        const m = { t: 24, r: 12, b: 28, l: 44 };
        const util = H - m.t - m.b;
        const temAbertos = colunas.some((c) => c.abertos !== undefined);
        const { passo, topo } = eixo(Math.max(1, ...colunas.map((c) => Math.max(c.total, c.abertos || 0)), media || 0));
        const y = (v) => m.t + util - (v / topo) * util;
        const faixa = (W - m.l - m.r) / colunas.length;
        const largura = Math.max(6, Math.min(58, faixa * 0.6));
        /* só pulo rótulos de mês quando eles não cabem; o último não é forçado (antes encavalava "out/26nov/26") */
        const larguraRotulo = Math.max(...colunas.map((c) => c.rotulo.length)) * 7.2 + 6;
        const cada = Math.max(1, Math.ceil(larguraRotulo / faixa));

        let svg = '';
        for (let v = 0; v <= topo; v += passo) {
            svg += `<line class="${v === 0 ? 'g-eixo' : 'g-grade'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
            svg += `<text class="g-texto" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${numeroBR(v)}</text>`;
        }
        const centro = (i) => m.l + faixa * (i + 0.5);
        colunas.forEach((c, i) => {
            const cx = centro(i);
            const h = c.total ? Math.max(2, y(0) - y(c.total)) : 0;
            const cor = !temAbertos ? 'er-coluna' : c.total > c.abertos ? 'pc-col-ok' : c.total === c.abertos ? 'pc-col-igual' : 'pc-col-menos';
            let g = `<rect class="g-alvo" x="${m.l + faixa * i + 1}" y="${m.t - 18}" width="${Math.max(3, faixa - 2)}" height="${util + m.b + 14}" rx="6"/>`;
            if (h) g += `<path class="${cor}" d="${barraTopo(cx - largura / 2, y(0) - h, largura, h, 4)}"/>`;
            /* número do encerrado dentro da coluna (a linha dos abertos passa por cima do topo) */
            if (c.total && faixa >= 30 && h >= 18) g += `<text class="g-dentro" x="${cx}" y="${y(0) - 7}" text-anchor="middle">${numeroBR(c.total)}</text>`;
            if (i % cada === 0) g += `<text class="g-texto-2" x="${cx}" y="${H - m.b + 18}" text-anchor="middle">${escapar(c.rotulo)}</text>`;
            svg += `<g class="g-coluna g-sem-clique" data-i="${i}" aria-label="${escapar(c.rotulo)}: ${c.total} encerrados${temAbertos ? `, ${c.abertos} abertos` : ''}">${g}</g>`;
        });
        if (media) svg += `<line class="er-media" x1="${m.l}" x2="${W - m.r}" y1="${y(media)}" y2="${y(media)}"/>`;
        if (temAbertos) {
            const pontos = colunas.map((c, i) => `${centro(i)},${y(c.abertos)}`).join(' ');
            svg += `<polyline class="pc-linha-abertos" points="${pontos}"/>`;
            colunas.forEach((c, i) => {
                svg += `<circle class="pc-ponto-abertos" cx="${centro(i)}" cy="${y(c.abertos)}" r="4"/>`;
                if (faixa >= 30) svg += `<text class="pc-valor-abertos" x="${centro(i)}" y="${y(c.abertos) - 9}" text-anchor="middle">${numeroBR(c.abertos)}</text>`;
            });
        }
        area.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapar(titulo)}">${svg}</svg>`;
    }

    /* Meses: sem período, os 12 últimos até o mês mais recente; com período, os meses dele. */
    function mesesParaMostrar(enc, ab) {
        const { de, ate } = estado.filtros;
        const meses = [...enc.map((r) => r.mes), ...ab.map((r) => r.mesAb)].filter(Boolean);
        const ultimoDado = meses.reduce((a, b) => Math.max(a, b), 0);
        if (!ultimoDado && !de) return [];
        const fim = ate ? mesDaData(ate) : ultimoDado;
        const lista = [];
        if (de) {
            for (let m = mesDaData(de); m <= fim; m = proximoMes(m)) lista.push(m);
            return lista;
        }
        for (let m = fim, i = 0; i < 12; i++, m = mesAnterior(m)) lista.unshift(m);
        /* não mostro os meses antes do primeiro dado */
        const primeiro = meses.reduce((a, b) => (!a || b < a ? b : a), 0);
        return lista.filter((m) => m >= primeiro);
    }

    function desenharEvolucao(enc, ab) {
        const area = $('gEvolucao');
        $('tituloEvolucao').textContent = estado.filtros.colab
            ? `Abertos x encerrados por mês · ${estado.filtros.colab}` : 'Abertos x encerrados por mês · equipe';
        $('legMedia').textContent = '';
        $('legMediaAb').textContent = '';
        const meses = mesesParaMostrar(enc, ab);
        if (!meses.length) {
            estado.graficos.evolucao = [];
            area.innerHTML = vazio(temPlanilha() ? 'Nenhum protocolo com esses filtros.' : 'Importe uma planilha para ver a evolução.');
            return;
        }
        const porMes = new Map();
        enc.forEach((r) => { if (r.mes) porMes.set(r.mes, (porMes.get(r.mes) || 0) + 1); });
        const abPorMes = new Map();
        ab.forEach((r) => { if (r.mesAb) abPorMes.set(r.mesAb, (abPorMes.get(r.mesAb) || 0) + 1); });
        /* no celular (cartão estreito) mostro os 6 últimos; a média continua dos meses todos */
        const visiveis = area.clientWidth < 400 ? meses.slice(-6) : meses;
        const colunas = visiveis.map((m) => ({ mes: m, rotulo: rotuloMes(m), total: porMes.get(m) || 0, abertos: abPorMes.get(m) || 0 }));
        /* médias por mês dos meses do gráfico (mês sem nada conta como zero). O autor pediu
           só os valores na legenda, sem a linha tracejada no gráfico (19/11/2026). */
        const media = meses.reduce((s, m) => s + (porMes.get(m) || 0), 0) / meses.length;
        const mediaAb = meses.reduce((s, m) => s + (abPorMes.get(m) || 0), 0) / meses.length;
        estado.graficos.evolucao = colunas;
        estado.mediaMensal = media;
        estado.mediaAbertos = mediaAb;
        $('legMedia').textContent = decimalBR(media);
        $('legMediaAb').textContent = decimalBR(mediaAb);
        desenharColunas(area, colunas, 'Abertos x encerrados por mês');
    }

    /* ---- tabela ---- */
    function desenharTabela() {
        const corpo = $('corpoTabela');
        const { campo, desc } = estado.ordem;
        document.querySelectorAll('.pc-tabela th[data-ordem]').forEach((th) => {
            th.setAttribute('aria-sort', th.dataset.ordem === campo ? (desc ? 'descending' : 'ascending') : 'none');
        });
        if (!estado.linhas.length) {
            corpo.innerHTML = `<tr><td colspan="14" class="pc-vazio">${temPlanilha() ? 'Nenhum colaborador com esses filtros.' : 'Importe a planilha do CRM para ver a produção.'}</td></tr>`;
            return;
        }
        const valor = (l) => (campo === 'nome' ? l.nome : l[campo] ?? -1);
        const linhas = [...estado.linhas].sort((a, b) => {
            const va = valor(a);
            const vb = valor(b);
            const r = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb;
            return (desc ? -r : r) || b.enc - a.enc;
        });
        const num = (v, fmt = numeroBR) => (v === null || v === undefined ? '<span class="fraco">—</span>' : fmt(v));
        corpo.innerHTML = linhas.map((l) => `
            <tr class="${l.semResp ? 'pc-linha-sem-resp' : ''}" data-nome="${escapar(l.nome)}">
                <td data-rotulo="Colaborador" class="pc-c-nome"><span title="${escapar(l.nome)}">${escapar(l.nome)}</span></td>
                <td data-rotulo="Encerrados" class="num"><b>${numeroBR(l.enc)}</b></td>
                <td data-rotulo="% equipe" class="num">${l.enc ? `${decimalBR(l.part * 100)}%` : '<span class="fraco">—</span>'}</td>
                <td data-rotulo="Para tratar" class="num">${l.pend ? `<b>${numeroBR(l.pend)}</b>` : '<span class="fraco">0</span>'}</td>
                <td data-rotulo="Vencidos" class="num">${l.venc ? `<span class="pc-venc">${numeroBR(l.venc)}</span>` : '<span class="fraco">0</span>'}</td>
                <td data-rotulo="Dias ativos" class="num">${l.enc ? numeroBR(l.dias) : '<span class="fraco">—</span>'}</td>
                <td data-rotulo="Média/dia" class="num">${num(l.media, (v) => decimalBR(v))}</td>
                <td data-rotulo="SLA cumprido" class="num">${l.sla === null ? '<span class="fraco">—</span>' : `<span class="pc-sla pc-sla-${faixaSla(l.sla)}">${pctBR(l.sla)}</span>`}</td>
                <td data-rotulo="Fora do prazo" class="num">${l.enc ? numeroBR(l.atraso) : '<span class="fraco">—</span>'}</td>
                <td data-rotulo="Dias úteis p/ encerrar" class="num">${num(l.tempo, (v) => decimalBR(v, v % 1 ? 1 : 0))}</td>
                <td data-rotulo="No mesmo dia" class="num">${num(l.mesmo, pctBR)}</td>
                <td data-rotulo="Reclamações" class="num">${num(l.recl, pctBR)}</td>
                <td data-rotulo="Severidade alta" class="num">${num(l.alta, pctBR)}</td>
                <td data-rotulo="Canal principal" class="pc-c-canal">${escapar(l.canal) || '<span class="fraco">—</span>'}</td>
            </tr>`).join('');
    }

    /* ======================================================
       8. DICAS E CLIQUES
    ====================================================== */

    function dicaDe(tipo, i) {
        const it = (estado.graficos[tipo] || [])[i];
        if (!it) return '';
        if (tipo === 'evolucao') {
            /* saldo = encerrados - abertos do mês: positivo é o mês que "venceu" a entrada */
            const saldo = it.total - it.abertos;
            const situacao = saldo > 0 ? 'Encerrou mais do que abriu' : saldo === 0 ? 'Encerrou o mesmo que abriu' : 'Encerrou menos do que abriu';
            return `<strong>${rotuloMes(it.mes)}</strong>` + linhaDica('Abertos', numeroBR(it.abertos)) +
                linhaDica('Encerrados', numeroBR(it.total)) +
                linhaDica('Saldo', `${saldo > 0 ? '+' : ''}${numeroBR(saldo)}`) +
                linhaDica('Média de abertos', decimalBR(estado.mediaAbertos)) +
                linhaDica('Média de encerrados', decimalBR(estado.mediaMensal)) +
                `<div class="pc-dica-nota">${situacao}.</div>`;
        }
        if (tipo === 'pend') {
            return `<strong>${escapar(it.nome)}</strong>` + linhaDica('Para tratar', numeroBR(it.pend)) +
                linhaDica('Vencidos', numeroBR(it.venc)) +
                (it.semResp ? '<div class="pc-dica-nota">Pendentes com a coluna “Descrição Operador Responsável” em branco.</div>' : '');
        }
        const canais = it.canais.slice(0, 3).map(([c, n]) => `${nomeBonito(c)} ${decimalBR((n / it.enc) * 100, 0)}%`).join(' · ');
        return `<strong>${escapar(it.nome)}</strong>` + linhaDica('Encerrados', numeroBR(it.enc)) +
            linhaDica('% da equipe', `${decimalBR(it.part * 100)}%`) +
            linhaDica('Média por dia ativo', it.media === null ? '—' : decimalBR(it.media)) +
            linhaDica('SLA cumprido', pctBR(it.sla)) +
            linhaDica('Reclamações', numeroBR(it.qtdRecl)) +
            (canais ? `<div class="pc-dica-nota">${escapar(canais)}</div>` : '');
    }

    function clicar(tipo, i) {
        const it = (estado.graficos[tipo] || [])[i];
        if (!it || (tipo !== 'enc' && tipo !== 'pend')) return;
        /* clicar filtra o colaborador; clicar de novo tira o filtro */
        estado.filtros.colab = estado.filtros.colab === it.nome ? '' : it.nome;
        esconderDica();
        atualizarTudo();
    }

    function ligarGraficos() {
        const mapa = { gEncerrados: 'enc', gPendentes: 'pend', gEvolucao: 'evolucao' };
        for (const [id, tipo] of Object.entries(mapa)) {
            const area = $(id);
            area.addEventListener('mousemove', (e) => {
                const alvo = e.target.closest('[data-i]');
                const html = alvo ? dicaDe(tipo, Number(alvo.dataset.i)) : '';
                if (html) mostrarDica(html, e.clientX, e.clientY); else esconderDica();
            });
            area.addEventListener('mouseleave', esconderDica);
            area.addEventListener('click', (e) => {
                const alvo = e.target.closest('[data-i][role="button"]');
                if (alvo) clicar(tipo, Number(alvo.dataset.i));
            });
            area.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const alvo = e.target.closest('[data-i][role="button"]');
                if (alvo) { e.preventDefault(); clicar(tipo, Number(alvo.dataset.i)); }
            });
        }
    }

    /* ======================================================
       9. EXPORTAÇÃO: a tabela de produção (sem dados de beneficiários)
    ====================================================== */

    function exportarExcel() {
        if (!window.XLSX || !estado.linhas.length) return;
        const cab = ['Colaborador', 'Encerrados', '% da equipe', 'Para tratar', 'Vencidos', 'Dias ativos', 'Média por dia ativo',
            'SLA cumprido (%)', 'Fora do prazo', 'Dias úteis para encerrar (mediana)', 'No mesmo dia (%)', 'Reclamações (%)', 'Severidade alta (%)', 'Canal principal'];
        const p = (x) => (x === null ? '' : Math.round(x * 1000) / 10);
        const linhas = [...estado.linhas].sort((a, b) => b.enc - a.enc || b.pend - a.pend).map((l) => [
            l.nome, l.enc, p(l.part), l.pend, l.venc, l.dias, l.media === null ? '' : Math.round(l.media * 10) / 10,
            p(l.sla), l.atraso, l.tempo === null ? '' : l.tempo, p(l.mesmo), p(l.recl), p(l.alta), l.canal
        ]);
        const planilha = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
        planilha['!cols'] = [{ wch: 40 }, ...cab.slice(1, -1).map(() => ({ wch: 14 })), { wch: 18 }];
        planilha['!autofilter'] = { ref: planilha['!ref'] };
        const livro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(livro, planilha, 'Produção');
        const d = new Date();
        XLSX.writeFile(livro, `volume-e-produtividade-${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}.xlsx`, { compression: true });
        avisar(`${numeroBR(linhas.length)} colaboradores exportados.`);
    }

    /* ======================================================
       10. AVISO E LIGAÇÕES
    ====================================================== */

    let fimAviso = null;
    function avisar(mensagem, erro = false) {
        const aviso = $('avisoFlutuante');
        aviso.textContent = mensagem;
        aviso.classList.toggle('erro', erro);
        aviso.hidden = false;
        clearTimeout(fimAviso);
        fimAviso = setTimeout(() => { aviso.hidden = true; }, erro ? 7000 : 3500);
    }

    function iniciar() {
        $('arquivoExcel').addEventListener('change', (e) => { importarArquivo(e.target.files[0]); e.target.value = ''; });
        $('exportarExcel').addEventListener('click', exportarExcel);
        $('limpar').addEventListener('click', () => { estado.filtros = filtrosVazios(); atualizarTudo(); });
        ['fDe', 'fAte', 'fColab', 'fStatus', 'fTipo', 'fCanal', 'fSev', 'fMinimo'].forEach((id) => {
            $(id).addEventListener('change', () => { lerFiltrosDaTela(); atualizarTudo(); });
        });

        /* ordenar a tabela pelo título da coluna (clicar de novo inverte) */
        document.querySelectorAll('.pc-tabela th[data-ordem]').forEach((th) => {
            th.addEventListener('click', () => {
                const campo = th.dataset.ordem;
                estado.ordem = { campo, desc: estado.ordem.campo === campo ? !estado.ordem.desc : campo !== 'nome' };
                desenharTabela();
            });
        });

        /* clicar numa linha da tabela filtra o colaborador */
        $('corpoTabela').addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-nome]');
            if (!tr) return;
            estado.filtros.colab = estado.filtros.colab === tr.dataset.nome ? '' : tr.dataset.nome;
            atualizarTudo();
        });

        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => { e.preventDefault(); importarArquivo(e.dataTransfer.files[0]); });

        ligarGraficos();

        let ultimo = '';
        const observador = new ResizeObserver(() => {
            const medida = `${$('gEvolucao').clientWidth}x${$('gEvolucao').clientHeight}`;
            if (medida === ultimo) return;
            ultimo = medida;
            if (temPlanilha()) atualizarTudo();
        });
        observador.observe($('gEvolucao'));

        estado.hoje = hoje();
        atualizarTudo();
    }

    iniciar();
})();
