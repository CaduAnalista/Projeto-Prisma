/* ==========================================================
   ESTUDO DE RECLAMAÇÕES — PRISMA (v1, 18/11/2026)
   Uma tela só: filtros, importar/exportar e cinco gráficos
   (por mês com a média, por setor, por plano, ocorrências mais
   recorrentes e beneficiários que mais reclamaram).
   Entram só as reclamações: tipo "Reclamação", canal "Reclame Aqui"
   e Ouvidoria (critério combinado com o autor).
   Tudo é calculado no navegador: a planilha não sai daqui.
   ========================================================== */

(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const { classificarSetor, NAO_CLASSIFICADO, normalizar } = window.PrismaSetores;

    /* ======================================================
       1. COLUNAS DA PLANILHA (mesmos nomes da Inteligência)
    ====================================================== */

    const CAMPOS = {
        protocolo: ['PROTOCOLO ANS', 'PROTOCOLO', 'NUMERO DO PROTOCOLO'],
        cpf: ['CPF BENEFICIARIO', 'CPF', 'CPF DO BENEFICIARIO'],
        nome: ['NOME BENEFICIARIO', 'NOME DO BENEFICIARIO', 'NOME', 'DESC BENEFICIARIO'],
        assunto: ['DESC ASSUNTO', 'DESCRICAO ASSUNTO', 'ASSUNTO', 'DESCRICAO DO ASSUNTO'],
        grupo: ['DESC GRP OCORRENCIA', 'DESCRICAO GRP OCORRENCIA', 'GRUPO DE OCORRENCIA', 'GRUPO OCORRENCIA'],
        ocorrencia: ['DESCRICAO OCORRENCIA', 'DESC OCORRENCIA', 'DESCRICAO DA OCORRENCIA', 'OCORRENCIA'],
        tipo: ['DESC TIPO OCORRENCIA', 'DESCRICAO TIPO OCORRENCIA', 'TIPO DE OCORRENCIA'],
        canal: ['DESC COMUNICACAO', 'DESCRICAO COMUNICACAO', 'DESCRICAO DA COMUNICACAO', 'CANAL DE COMUNICACAO', 'CANAL'],
        abertura: ['DATA ABERTURA OCORRENCIA', 'DATA ABERTURA', 'DATA DE ABERTURA'],
        setor: ['SETOR', 'SETOR RESPONSAVEL'],
        colaborador: ['USUARIO ENCERRAMENTO OCORRENCIA', 'USUARIO ENCERRAMENTO', 'USUARIO DE ENCERRAMENTO'],
        /* plano do beneficiário: o autor indicou a coluna DESCRICAO_PLANO */
        plano: ['DESCRICAO PLANO', 'DESC PLANO', 'DESCRICAO DO PLANO', 'NOME PLANO', 'PLANO', 'PRODUTO']
    };

    /* só aceito "parecido" nos campos de texto livre; nos de descrição
       (assunto, ocorrência, plano...) um nome parecido costuma ser a coluna de código */
    const SO_EXATO = ['assunto', 'grupo', 'ocorrencia', 'tipo', 'plano'];

    const chaveCabecalho = (valor) => normalizar(valor).replace(/[^A-Z0-9]/g, '');

    function resolverColunas(cabecalhos) {
        const chaves = cabecalhos.map((c) => ({ original: c, chave: chaveCabecalho(c) }));
        const mapa = {};
        for (const [campo, nomes] of Object.entries(CAMPOS)) {
            const alvos = nomes.map(chaveCabecalho);
            let achado = null;
            for (const a of alvos) {
                achado = chaves.find((c) => c.chave === a);
                if (achado) break;
            }
            if (!achado && campo === 'plano') {
                /* "DS_PLANO", "DESCR_PLANO"... mas nunca "COD_PLANO" */
                achado = chaves.find((c) => c.chave.includes('PLANO') && /^D(E)?S/.test(c.chave));
            }
            if (!achado && !SO_EXATO.includes(campo)) {
                for (const a of alvos) {
                    achado = chaves.find((c) => c.chave.length > 4 && (c.chave.includes(a) || a.includes(c.chave)));
                    if (achado) break;
                }
            }
            mapa[campo] = achado ? achado.original : null;
        }
        return mapa;
    }

    /* ======================================================
       2. AJUDANTES
    ====================================================== */

    const texto = (v) => String(v ?? '').trim();
    const numeroBR = (n) => Number(n || 0).toLocaleString('pt-BR');
    const decimalBR = (n, casas = 1) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

    function escapar(t) {
        return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    /* "REEMBOLSO DE CONSULTA" → "Reembolso de consulta" */
    function nomeBonito(t) {
        const s = texto(t).toLowerCase();
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    }

    /* nomes de pessoas: cada palavra com maiúscula, menos "de", "da", "dos"... */
    function nomePessoa(t) {
        return texto(t).toLowerCase().split(/\s+/)
            .map((p, i) => (i > 0 && /^(d[aeo]s?|e)$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
            .join(' ');
    }

    function formatarCPF(valor) {
        const d = texto(valor).replace(/\D/g, '');
        if (!d) return '';
        const c = d.padStart(11, '0').slice(-11);
        return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
    }

    const ROTULO_CANAL = {
        'PORTAL': 'Portal', 'VOZ': 'Voz', 'PRESENCIAL': 'Presencial', 'WHATSAPP': 'WhatsApp',
        'E-MAIL INSTITUCIONAL': 'E-mail', 'E-MAIL': 'E-mail', 'CHAT': 'Chat',
        'RECLAME AQUI': 'Reclame Aqui', 'CALLBACK': 'Callback', 'OUVIDORIA': 'Ouvidoria'
    };
    const rotuloCanal = (c) => ROTULO_CANAL[c] || nomeBonito(c);

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

    /* meses no formato AAAAMM */
    const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mesDaData = (d) => (d ? d.getFullYear() * 100 + d.getMonth() + 1 : 0);
    const proximoMes = (m) => (m % 100 === 12 ? (Math.floor(m / 100) + 1) * 100 + 1 : m + 1);
    const rotuloMes = (m) => `${NOMES_MES[(m % 100) - 1]}/${String(Math.floor(m / 100)).slice(2)}`;
    const doisDigitos = (n) => String(n).padStart(2, '0');

    /* ======================================================
       3. ESTADO
    ====================================================== */

    const SEM_VALOR = '__sem__';

    const filtrosVazios = () => ({ plano: '', assunto: '', benef: '', canal: '', setor: '', colab: '', ocorrencia: '' });

    const estado = {
        base: [],          // só as reclamações da planilha
        filtrados: [],
        filtros: filtrosVazios(),
        temPlano: false,
        nomeArquivo: '',
        graficos: {}       // o que cada gráfico desenhou (para a dica e o clique)
    };

    /* ======================================================
       4. IMPORTAÇÃO: separo as reclamações
    ====================================================== */

    /* Critério do autor: tipo Reclamação, canal Reclame Aqui ou Ouvidoria
       (Ouvidoria pode vir no tipo, no canal, no assunto ou no grupo). */
    function ehReclamacao(tipo, canal, assunto, grupo) {
        if (tipo.includes('RECLAMA')) return true;
        if (canal.includes('RECLAME AQUI')) return true;
        return [tipo, canal, assunto, grupo].some((t) => t.includes('OUVIDORIA'));
    }

    function prepararRegistros(linhas, colunas) {
        const pegar = (linha, campo) => (colunas[campo] ? linha[colunas[campo]] : '');
        const lista = [];
        for (const linha of linhas) {
            const tipoNorm = normalizar(pegar(linha, 'tipo'));
            const canalNorm = normalizar(pegar(linha, 'canal'));
            const assuntoNorm = normalizar(pegar(linha, 'assunto'));
            const grupoNorm = normalizar(pegar(linha, 'grupo'));
            if (!ehReclamacao(tipoNorm, canalNorm, assuntoNorm, grupoNorm)) continue;

            const ocorrencia = texto(pegar(linha, 'ocorrencia'));
            const abertura = dataDeCelula(pegar(linha, 'abertura'));
            const cpf = formatarCPF(pegar(linha, 'cpf'));
            const nome = texto(pegar(linha, 'nome'));
            const plano = texto(pegar(linha, 'plano'));

            lista.push({
                protocolo: texto(pegar(linha, 'protocolo')),
                abertura,
                mes: mesDaData(abertura),
                cpf,
                nome,
                /* a pessoa é o CPF; sem CPF, o nome */
                pessoa: cpf || normalizar(nome),
                buscaPessoa: `${normalizar(nome)} ${cpf.replace(/\D/g, '')}`,
                assunto: texto(pegar(linha, 'assunto')),
                assuntoNorm,
                ocorrencia,
                ocorrenciaNorm: normalizar(ocorrencia),
                tipo: texto(pegar(linha, 'tipo')),
                canalNorm,
                planoNorm: normalizar(plano),
                plano,
                setor: classificarSetor(assuntoNorm, grupoNorm, normalizar(ocorrencia), pegar(linha, 'setor')),
                colaborador: texto(pegar(linha, 'colaborador'))
            });
        }
        return lista;
    }

    function importarArquivo(arquivo) {
        if (!arquivo) return;
        if (!/\.(xlsx|xls|csv)$/i.test(arquivo.name)) { avisar('Formato não aceito. Use .xlsx, .xls ou .csv.', true); return; }
        if (!window.XLSX) { avisar('A biblioteca de leitura de Excel não carregou (LIB/xlsx-0.20.3.full.min.js).', true); return; }

        const leitor = new FileReader();
        leitor.onerror = () => avisar('Não foi possível ler o arquivo.', true);
        leitor.onload = () => {
            try {
                const livro = XLSX.read(leitor.result, { type: 'array', cellDates: false });
                const linhas = XLSX.utils.sheet_to_json(livro.Sheets[livro.SheetNames[0]], { defval: '', raw: true });
                if (!linhas.length) throw new Error('A planilha está vazia.');

                const colunas = resolverColunas(Object.keys(linhas[0]));
                if (!colunas.tipo && !colunas.canal) {
                    throw new Error('Não achei as colunas de tipo (DESC_TIPO_OCORRENCIA) nem de canal (DESC_COMUNICACAO).');
                }
                estado.base = prepararRegistros(linhas, colunas);
                estado.temPlano = Boolean(colunas.plano);
                estado.temColaborador = Boolean(colunas.colaborador);
                estado.nomeArquivo = arquivo.name;
                estado.filtros = filtrosVazios();
                $('fBenef').value = '';

                montarFiltros();
                atualizarTudo();

                const falta = ['plano', 'ocorrencia', 'cpf', 'colaborador'].filter((c) => !colunas[c]).map((c) => CAMPOS[c][0].replace(/ /g, '_'));
                avisar(estado.base.length
                    ? `${numeroBR(estado.base.length)} reclamações de ${numeroBR(linhas.length)} linhas.${falta.length ? ` Sem as colunas: ${falta.join(', ')}.` : ''}`
                    : 'Nenhuma reclamação, Reclame Aqui ou ouvidoria nesta planilha.', !estado.base.length || falta.length > 0);
            } catch (erro) {
                avisar(erro.message || 'Não foi possível ler a planilha.', true);
            }
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    /* ======================================================
       5. FILTROS
    ====================================================== */

    function contar(lista, chave, rotulo) {
        const mapa = new Map();
        for (const r of lista) {
            const k = chave(r) || SEM_VALOR;
            const atual = mapa.get(k) || { chave: k, nome: k === SEM_VALOR ? '' : rotulo(r), total: 0 };
            atual.total++;
            mapa.set(k, atual);
        }
        return [...mapa.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    function preencherSelect(id, itens, textoVazio) {
        const sel = $(id);
        sel.innerHTML = '<option value="">Todos</option>' + itens.map((i) =>
            `<option value="${escapar(i.chave)}">${escapar(i.chave === SEM_VALOR ? textoVazio : i.nome)} · ${numeroBR(i.total)}</option>`).join('');
    }

    function montarFiltros() {
        const b = estado.base;
        const selPlano = $('fPlano');
        if (estado.temPlano) {
            selPlano.disabled = false;
            preencherSelect('fPlano', contar(b, (r) => r.planoNorm, (r) => r.plano), 'Sem plano');
        } else {
            selPlano.disabled = true;
            selPlano.innerHTML = '<option value="">Coluna DESCRICAO_PLANO não encontrada</option>';
        }
        preencherSelect('fAssunto', contar(b, (r) => r.assuntoNorm, (r) => nomeBonito(r.assunto)), 'Sem assunto');
        preencherSelect('fCanal', contar(b, (r) => r.canalNorm, (r) => rotuloCanal(r.canalNorm)), 'Sem canal');
        preencherSelect('fSetor', contar(b, (r) => r.setor, (r) => nomeBonito(r.setor)), 'Sem setor');

        const selColab = $('fColab');
        if (estado.temColaborador) {
            selColab.disabled = false;
            preencherSelect('fColab', contar(b, (r) => r.colaborador, (r) => r.colaborador), 'Sem colaborador (pendente)');
        } else {
            selColab.disabled = true;
            selColab.innerHTML = '<option value="">Coluna USUARIO_ENCERRAMENTO_OCORRENCIA não encontrada</option>';
        }

        /* sugestões do campo de beneficiário: quem mais reclamou primeiro */
        $('listaBenef').innerHTML = contar(b.filter((r) => r.nome), (r) => r.pessoa, (r) => nomePessoa(r.nome))
            .slice(0, 300).map((p) => `<option value="${escapar(p.nome)}"></option>`).join('');
    }

    const igual = (valor, filtro) => !filtro || (filtro === SEM_VALOR ? !valor : valor === filtro);

    /* "ignorar" deixa um gráfico mostrar todas as opções do próprio filtro:
       assim dá para clicar em outro setor sem precisar limpar o filtro antes */
    function passa(r, ignorar = '') {
        const f = estado.filtros;
        if (ignorar !== 'plano' && !igual(r.planoNorm, f.plano)) return false;
        if (!igual(r.assuntoNorm, f.assunto)) return false;
        if (!igual(r.canalNorm, f.canal)) return false;
        if (ignorar !== 'setor' && !igual(r.setor, f.setor)) return false;
        if (!igual(r.colaborador, f.colab)) return false;
        if (ignorar !== 'ocorrencia' && !igual(r.ocorrenciaNorm, f.ocorrencia)) return false;
        if (ignorar !== 'benef' && f.benef) {
            const termo = f.benef;
            if (termo.pessoa ? r.pessoa !== termo.pessoa : !r.buscaPessoa.includes(termo.texto)) return false;
        }
        return true;
    }

    function lerFiltrosDaTela() {
        const f = estado.filtros;
        f.plano = $('fPlano').disabled ? '' : $('fPlano').value;
        f.assunto = $('fAssunto').value;
        f.canal = $('fCanal').value;
        f.setor = $('fSetor').value;
        f.colab = $('fColab').disabled ? '' : $('fColab').value;
        const busca = normalizar($('fBenef').value);
        const soDigitos = busca.replace(/\D/g, '');
        /* CPF digitado (só números ou com pontos) também serve */
        f.benef = busca ? { texto: /^[\d.\- ]+$/.test(busca) ? soDigitos : busca } : '';
    }

    function sincronizarTela() {
        const f = estado.filtros;
        if (!$('fPlano').disabled) $('fPlano').value = f.plano;
        $('fAssunto').value = f.assunto;
        $('fCanal').value = f.canal;
        $('fSetor').value = f.setor;
        if (!$('fColab').disabled) $('fColab').value = f.colab;
        document.querySelectorAll('.er-filtros label').forEach((l) => {
            const campo = l.querySelector('select, input');
            l.classList.toggle('em-uso', Boolean(campo && campo.value));
        });
    }

    function limparFiltros() {
        estado.filtros = filtrosVazios();
        $('fBenef').value = '';
        atualizarTudo();
    }

    /* ======================================================
       6. TELA
    ====================================================== */

    function mesesDosDados(lista) {
        let primeiro = 0;
        let ultimo = 0;
        for (const r of lista) {
            if (!r.mes) continue;
            if (!primeiro || r.mes < primeiro) primeiro = r.mes;
            if (r.mes > ultimo) ultimo = r.mes;
        }
        const meses = [];
        for (let m = primeiro; m && m <= ultimo; m = proximoMes(m)) meses.push(m);
        return meses;
    }

    function atualizarTudo() {
        estado.filtrados = estado.base.filter((r) => passa(r));
        const lista = estado.filtrados;
        const temDados = estado.base.length > 0;

        const pessoas = new Set(lista.map((r) => r.pessoa).filter(Boolean));
        const meses = mesesDosDados(lista);
        estado.media = meses.length ? lista.filter((r) => r.mes).length / meses.length : 0;

        $('resTotal').textContent = temDados ? numeroBR(lista.length) : '—';
        $('resBenef').textContent = temDados ? numeroBR(pessoas.size) : '—';
        $('resMedia').textContent = temDados && meses.length ? decimalBR(estado.media) : '—';
        $('exportarExcel').disabled = !lista.length;

        desenharCriterio();
        sincronizarTela();
        desenharEvolucao(meses);
        desenharSetores();
        desenharPlanos();
        desenharOcorrencias();
        desenharBeneficiarios();
    }

    function desenharCriterio() {
        const el = $('criterio');
        if (!estado.base.length) return;
        const extra = [];
        const f = estado.filtros;
        if (f.ocorrencia) {
            const r = estado.base.find((x) => x.ocorrenciaNorm === f.ocorrencia);
            extra.push(`<span class="er-etiqueta">Ocorrência: ${escapar(nomeBonito(r ? r.ocorrencia : ''))}<button type="button" data-tirar="ocorrencia" aria-label="Tirar o filtro de ocorrência">×</button></span>`);
        }
        el.innerHTML = `<span>${escapar(estado.nomeArquivo)} · <b>${numeroBR(estado.base.length)}</b> reclamações (tipo Reclamação, Reclame Aqui e Ouvidoria)</span>${extra.join('')}`;
    }

    /* ---- dica (tooltip) ---- */
    function mostrarDica(html, x, y) {
        const dica = $('dica');
        dica.innerHTML = html;
        dica.hidden = false;
        const w = dica.offsetWidth;
        const h = dica.offsetHeight;
        let esquerda = x + 14;
        let topo = y + 14;
        if (esquerda + w > window.innerWidth - 8) esquerda = x - w - 14;
        if (topo + h > window.innerHeight - 8) topo = y - h - 14;
        dica.style.left = `${Math.max(8, esquerda)}px`;
        dica.style.top = `${Math.max(8, topo)}px`;
    }
    const esconderDica = () => { $('dica').hidden = true; };
    const linhaDica = (rotulo, valor) => `<div>${escapar(rotulo)}<b>${valor}</b></div>`;

    const vazio = (msg) => `<p class="vazio-pequeno">${msg}</p>`;
    const msgVazia = () => (estado.base.length ? 'Nenhuma reclamação com esses filtros.' : 'Importe uma planilha para ver o gráfico.');

    function passoEixo(maximo, divisoes = 4) {
        const bruto = Math.max(1, maximo / divisoes);
        const potencia = 10 ** Math.floor(Math.log10(bruto));
        const f = bruto / potencia;
        return Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * potencia);
    }

    /* topo do eixo colado no maior valor (no máximo 20% acima) */
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

    /* 7,4 px por letra = rótulo de 13 px em negrito */
    function cortarTexto(t, largura, px = 7.4) {
        const cabe = Math.max(3, Math.floor(largura / px));
        return t.length > cabe ? `${t.slice(0, cabe - 1)}…` : t;
    }

    /* Colunas simples em SVG (meses). "media" desenha a linha tracejada. */
    function desenharColunas(area, colunas, { titulo, media = null, clicavel = false }) {
        const W = Math.max(260, area.clientWidth);
        const H = Math.max(150, area.clientHeight);
        const m = { t: 22, r: media !== null ? 8 : 6, b: 28, l: 38 };
        const util = H - m.t - m.b;
        const { passo, topo } = eixo(Math.max(1, ...colunas.map((c) => c.total), media || 0));
        const y = (v) => m.t + util - (v / topo) * util;
        const faixa = (W - m.l - m.r) / colunas.length;
        const largura = Math.max(6, Math.min(58, faixa * 0.64));
        /* com muitas colunas mostro só um rótulo a cada N para não encavalar */
        /* largura do maior rótulo ("dez/25" ≈ 48 px): só pulo rótulos quando eles não cabem mesmo */
        const larguraRotulo = Math.max(...colunas.map((c) => c.rotulo.length)) * 7.2 + 4;
        const cada = Math.max(1, Math.ceil(larguraRotulo / faixa));

        let svg = '';
        for (let v = 0; v <= topo; v += passo) {
            svg += `<line class="${v === 0 ? 'g-eixo' : 'g-grade'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
            svg += `<text class="g-texto" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${numeroBR(v)}</text>`;
        }

        colunas.forEach((c, i) => {
            const cx = m.l + faixa * (i + 0.5);
            const h = c.total ? Math.max(2, y(0) - y(c.total)) : 0;
            let g = `<rect class="g-alvo" x="${m.l + faixa * i + 1}" y="${m.t - 18}" width="${Math.max(3, faixa - 2)}" height="${util + m.b + 14}" rx="6"/>`;
            if (h) g += `<path class="er-coluna" d="${barraTopo(cx - largura / 2, y(0) - h, largura, h, 4)}"/>`;
            if (c.total && (faixa >= 22 || colunas.length <= 14)) {
                g += `<text class="g-valor" x="${cx}" y="${y(0) - h - 6}" text-anchor="middle">${numeroBR(c.total)}</text>`;
            }
            if (i % cada === 0 || i === colunas.length - 1) {
                g += `<text class="g-texto-2" x="${cx}" y="${H - m.b + 18}" text-anchor="middle">${escapar(cortarTexto(c.rotulo, faixa * cada - 4))}</text>`;
            }
            const classes = ['g-coluna', clicavel ? '' : 'g-sem-clique', c.classe || ''].filter(Boolean).join(' ');
            svg += `<g class="${classes}" data-i="${i}"${clicavel ? ' role="button" tabindex="0"' : ''} aria-label="${escapar(c.rotulo)}: ${c.total} reclamações">${g}</g>`;
        });

        if (media !== null && media > 0) {
            /* a linha da média fica por cima das colunas, com o valor na ponta */
            svg += `<line class="er-media" x1="${m.l}" x2="${W - m.r}" y1="${y(media)}" y2="${y(media)}"/>`;
        }

        area.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapar(titulo)}">${svg}</svg>`;
    }

    /* ---- 1. Reclamações por mês + média mensal ---- */
    function desenharEvolucao(meses) {
        const area = $('gEvolucao');
        $('legMedia').textContent = '';
        if (!meses.length) { estado.graficos.evolucao = []; area.innerHTML = vazio(msgVazia()); return; }

        const porMes = new Map();
        for (const r of estado.filtrados) if (r.mes) porMes.set(r.mes, (porMes.get(r.mes) || 0) + 1);

        /* no celular não cabem muitos meses: mostro os 12 últimos (a média continua do período todo) */
        const visiveis = area.clientWidth < 520 ? meses.slice(-12) : meses;
        const colunas = visiveis.map((m) => ({ mes: m, rotulo: rotuloMes(m), total: porMes.get(m) || 0 }));
        estado.graficos.evolucao = colunas;
        $('legMedia').textContent = decimalBR(estado.media);
        desenharColunas(area, colunas, { titulo: 'Reclamações por mês', media: estado.media });
    }

    /* ---- 2. Reclamações por setor (clique filtra) ----
       Barras deitadas (18/11/2026): em colunas os nomes dos setores não cabiam
       ("Credenciam…") e alguns rótulos sumiam. Deitado, o nome aparece inteiro. */
    function desenharSetores() {
        const base = estado.base.filter((r) => passa(r, 'setor'));
        const itens = contar(base, (r) => r.setor, (r) => nomeBonito(r.setor))
            .sort((a, b) => (a.chave === NAO_CLASSIFICADO) - (b.chave === NAO_CLASSIFICADO) || b.total - a.total)
            .map((s) => ({ ...s, nome: s.nome || 'Sem setor' }));
        estado.graficos.setor = desenharBarras($('gSetor'), itens, { limite: 12, total: base.length, ativo: estado.filtros.setor, rotuloOutros: 'setores' });
    }

    /* Barras horizontais em HTML (planos, ocorrências e beneficiários):
       cabem nomes compridos e o cartão se ajusta sozinho. */
    function desenharBarras(area, itens, { limite, total, clicavel = true, ativo = '', rotuloOutros = 'outros' }) {
        if (!itens.length) { area.innerHTML = vazio(msgVazia()); return []; }
        const mostrados = itens.slice(0, limite);
        const resto = itens.slice(limite);
        const maior = Math.max(1, ...mostrados.map((i) => i.total));
        const html = mostrados.map((it, i) => {
            const pct = total ? (it.total / total) * 100 : 0;
            const classe = ativo ? (ativo === it.chave ? ' ativo' : ' apagado') : '';
            return `<div class="er-barra${clicavel ? '' : ' sem-clique'}${classe}" data-i="${i}"${clicavel ? ' role="button" tabindex="0"' : ''}
                         aria-label="${escapar(it.nome)}: ${it.total} reclamações">
                <span class="er-pos">${i + 1}</span>
                <span class="er-nome" title="${escapar(it.nome)}">${escapar(it.nome)}</span>
                <span class="er-trilho"><span class="er-preenche" style="width:${((it.total / maior) * 100).toFixed(1)}%"></span></span>
                <span class="er-num">${numeroBR(it.total)}<small>${decimalBR(pct)}%</small></span>
            </div>`;
        }).join('');
        const somaResto = resto.reduce((s, i) => s + i.total, 0);
        area.innerHTML = html + (resto.length
            ? `<p class="er-outros">+ ${numeroBR(resto.length)} ${rotuloOutros} · ${numeroBR(somaResto)} reclamações</p>` : '');
        return mostrados;
    }

    /* ---- 3. Por plano (DESCRICAO_PLANO) ---- */
    function desenharPlanos() {
        const area = $('gPlano');
        if (estado.base.length && !estado.temPlano) {
            estado.graficos.plano = [];
            area.innerHTML = vazio('A planilha não tem a coluna DESCRICAO_PLANO.');
            return;
        }
        const base = estado.base.filter((r) => passa(r, 'plano'));
        const itens = contar(base, (r) => r.planoNorm, (r) => r.plano).map((i) => ({ ...i, nome: i.nome || 'Sem plano' }));
        estado.graficos.plano = desenharBarras(area, itens, { limite: 10, total: base.length, ativo: estado.filtros.plano, rotuloOutros: 'planos' });
    }

    /* ---- 4. Ocorrências mais recorrentes (DESCRICAO_OCORRENCIA) ---- */
    function desenharOcorrencias() {
        const base = estado.base.filter((r) => passa(r, 'ocorrencia'));
        const itens = contar(base, (r) => r.ocorrenciaNorm, (r) => nomeBonito(r.ocorrencia)).map((i) => ({ ...i, nome: i.nome || 'Sem ocorrência' }));
        estado.graficos.ocorrencia = desenharBarras($('gOcorrencia'), itens, { limite: 10, total: base.length, ativo: estado.filtros.ocorrencia, rotuloOutros: 'ocorrências' });
    }

    /* ---- 5. Beneficiários que mais reclamaram (ranking por pessoa) ---- */
    function desenharBeneficiarios() {
        const base = estado.base.filter((r) => passa(r, 'benef') && r.pessoa);
        const itens = contar(base, (r) => r.pessoa, (r) => nomePessoa(r.nome) || r.cpf)
            .map((p) => {
                const um = base.find((r) => r.pessoa === p.chave);
                return { ...p, cpf: um ? um.cpf : '', planoPessoa: um ? um.plano : '' };
            });
        const ativo = estado.filtros.benef && estado.filtros.benef.pessoa ? estado.filtros.benef.pessoa : '';
        estado.graficos.benef = desenharBarras($('gBenef'), itens, { limite: 12, total: base.length, ativo, rotuloOutros: 'beneficiários' });
    }

    /* ======================================================
       7. DICAS E CLIQUES DOS GRÁFICOS
    ====================================================== */

    function dicaDe(tipo, i) {
        const g = estado.graficos[tipo] || [];
        const it = g[i];
        if (!it) return '';
        if (tipo === 'evolucao') {
            const dif = it.total - estado.media;
            return `<strong>${rotuloMes(it.mes)}</strong>` + linhaDica('Reclamações', numeroBR(it.total)) +
                linhaDica('Média mensal', decimalBR(estado.media)) +
                linhaDica(dif >= 0 ? 'Acima da média' : 'Abaixo da média', decimalBR(Math.abs(dif)));
        }
        const html = `<strong>${escapar(it.nome || 'Sem setor')}</strong>` + linhaDica('Reclamações', numeroBR(it.total));
        if (tipo === 'benef') {
            return html + (it.cpf ? linhaDica('CPF', escapar(it.cpf)) : '') + (it.planoPessoa ? linhaDica('Plano', escapar(nomeBonito(it.planoPessoa))) : '');
        }
        return html;
    }

    function clicar(tipo, i) {
        const it = (estado.graficos[tipo] || [])[i];
        if (!it) return;
        const f = estado.filtros;
        /* cada clique liga; clicar de novo no mesmo desliga */
        if (tipo === 'setor') f.setor = f.setor === it.chave ? '' : it.chave;
        else if (tipo === 'plano') f.plano = f.plano === it.chave ? '' : it.chave;
        else if (tipo === 'ocorrencia') f.ocorrencia = f.ocorrencia === it.chave ? '' : it.chave;
        else if (tipo === 'benef') {
            const mesma = f.benef && f.benef.pessoa === it.chave;
            f.benef = mesma ? '' : { pessoa: it.chave };
            $('fBenef').value = mesma ? '' : (it.nome || it.cpf);
        } else return;
        esconderDica();
        atualizarTudo();
    }

    const GRAFICOS = { gEvolucao: 'evolucao', gSetor: 'setor', gPlano: 'plano', gOcorrencia: 'ocorrencia', gBenef: 'benef' };

    function ligarGraficos() {
        for (const [id, tipo] of Object.entries(GRAFICOS)) {
            const area = $(id);
            area.addEventListener('mousemove', (e) => {
                const alvo = e.target.closest('[data-i]');
                if (!alvo) { esconderDica(); return; }
                const html = dicaDe(tipo, Number(alvo.dataset.i));
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
       8. EXPORTAÇÃO (as reclamações filtradas)
    ====================================================== */

    function exportarExcel() {
        if (!window.XLSX || !estado.filtrados.length) return;
        const cabecalho = ['Protocolo', 'Data de abertura', 'CPF', 'Beneficiário', 'Plano', 'Tipo', 'Canal', 'Assunto', 'Ocorrência', 'Setor', 'Colaborador'];
        const linhas = estado.filtrados.map((r) => [
            r.protocolo, r.abertura || '', r.cpf, r.nome, r.plano, r.tipo, rotuloCanal(r.canalNorm),
            r.assunto, r.ocorrencia, nomeBonito(r.setor), r.colaborador
        ]);
        const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas], { dateNF: 'dd/mm/yyyy' });
        planilha['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 36 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 40 }, { wch: 18 }, { wch: 24 }];
        planilha['!autofilter'] = { ref: planilha['!ref'] };
        const livro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(livro, planilha, 'Reclamações');
        const d = new Date();
        XLSX.writeFile(livro, `estudo-reclamacoes-${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}.xlsx`, { compression: true });
        avisar(`${numeroBR(linhas.length)} reclamações exportadas.`);
    }

    /* ======================================================
       9. AVISO E LIGAÇÕES
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
        $('arquivoExcel').addEventListener('change', (e) => {
            importarArquivo(e.target.files[0]);
            e.target.value = '';
        });
        $('exportarExcel').addEventListener('click', exportarExcel);
        $('limpar').addEventListener('click', limparFiltros);

        ['fPlano', 'fAssunto', 'fCanal', 'fSetor', 'fColab'].forEach((id) => {
            $(id).addEventListener('change', () => { lerFiltrosDaTela(); atualizarTudo(); });
        });

        /* a busca de beneficiário espera a pessoa parar de digitar */
        let espera = null;
        $('fBenef').addEventListener('input', () => {
            clearTimeout(espera);
            espera = setTimeout(() => { lerFiltrosDaTela(); atualizarTudo(); }, 220);
        });

        $('criterio').addEventListener('click', (e) => {
            const b = e.target.closest('[data-tirar]');
            if (b) { estado.filtros[b.dataset.tirar] = ''; atualizarTudo(); }
        });

        /* arrastar a planilha para a página também importa */
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            importarArquivo(e.dataTransfer.files[0]);
        });

        ligarGraficos();

        /* os gráficos em SVG são desenhados na largura do cartão: refaço quando ela muda */
        let ultimo = '';
        const observador = new ResizeObserver(() => {
            const medida = `${$('gEvolucao').clientWidth}x${$('gEvolucao').clientHeight}|${$('gSetor').clientWidth}x${$('gSetor').clientHeight}`;
            if (medida === ultimo) return;
            ultimo = medida;
            if (estado.base.length) atualizarTudo();
        });
        observador.observe($('gEvolucao'));
        observador.observe($('gSetor'));

        atualizarTudo();
    }

    iniciar();
})();
