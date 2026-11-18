/* ==========================================================
   INTELIGÊNCIA DE REDE — PRISMA (v3, 18/11/2026)
   Visão operacional: faixa "Hoje", 8 indicadores com a variação
   contra o mês anterior, gráficos (IR, setores, evolução), filtro
   geral e tabela de protocolos com exportação.
   Tudo é calculado no navegador: a planilha não sai daqui.
   A versão anterior desta página está em ARQUIVO/inteligencia-v2/.
   ========================================================== */

(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);

    /* ======================================================
       1. COLUNAS DA PLANILHA
       Reconhecidas pelo nome do cabeçalho, ignorando acentos,
       maiúsculas, espaços e sublinhados. Primeiro procura o nome
       exato; se não achar, aceita um nome que contenha o outro.
    ====================================================== */

    const CAMPOS = {
        protocolo: ['PROTOCOLO ANS', 'PROTOCOLO', 'NUMERO DO PROTOCOLO', 'Nº PROTOCOLO'],
        cpf: ['CPF BENEFICIARIO', 'CPF', 'CPF DO BENEFICIARIO'],
        nome: ['NOME BENEFICIARIO', 'NOME DO BENEFICIARIO', 'NOME', 'Nome Beneficiário', 'DESC BENEFICIARIO'],
        email: ['EMAIL', 'E-MAIL', 'E MAIL', 'EMAIL DO BENEFICIARIO'],
        assunto: ['DESC ASSUNTO', 'DESCRICAO ASSUNTO', 'ASSUNTO', 'DESCRICAO DO ASSUNTO'],
        grupo: ['DESC GRP OCORRENCIA', 'DESCRICAO GRP OCORRENCIA', 'GRUPO DE OCORRENCIA', 'GRUPO OCORRENCIA'],
        ocorrencia: ['DESC OCORRENCIA', 'DESCRICAO OCORRENCIA', 'DESCRICAO DA OCORRENCIA', 'OCORRENCIA'],
        tipo: ['DESC TIPO OCORRENCIA', 'DESCRICAO TIPO OCORRENCIA', 'TIPO DE OCORRENCIA'],

        /* canal de comunicação. Não usar "COMUNICACAO": essa coluna só tem códigos (000005...) */
        canal: ['DESC COMUNICACAO', 'DESCRICAO COMUNICACAO', 'DESCRICAO DA COMUNICACAO', 'CANAL DE COMUNICACAO', 'CANAL'],
        abertura: ['DATA ABERTURA OCORRENCIA', 'DATA ABERTURA', 'DATA DE ABERTURA'],
        encerramento: ['DATA ENCERRAMENTO OCORRENCIA', 'DATA ENCERRAMENTO', 'DATA DE ENCERRAMENTO'],
        previsao: ['DATA PREVISAO SLA', 'DATA PREVISAO', 'DATA DA PREVISAO', 'PRAZO'],
        status: ['STATUS OCORRENCIA', 'STATUS'],
        observacao: ['OBS ABERTURA', 'OBSERVACAO ABERTURA', 'OBSERVACAO DE ABERTURA'],
        setor: ['SETOR', 'SETOR RESPONSAVEL'],

        /* quem encerrou o protocolo: é o "colaborador" do filtro (volume de cada um) */
        colaborador: ['USUARIO ENCERRAMENTO OCORRENCIA', 'USUARIO ENCERRAMENTO', 'USUARIO DE ENCERRAMENTO'],

        /* número da ocorrência: junto com o protocolo é a chave do cartão no Kanban */
        numOcorrencia: ['NUM OCORRENCIA', 'NUMERO OCORRENCIA', 'NUMERO DA OCORRENCIA', 'N OCORRENCIA']
    };

    /* Sem estas a tela não tem como funcionar. */
    const CAMPOS_OBRIGATORIOS = ['abertura', 'ocorrencia'];

    
   function normalizar(valor) {
       return String(valor ?? '')
           .normalize('NFD')
           .replace(/[\u0300-\u036f]/g, '')
           .toUpperCase()
           .replace(/\s+/g, ' ')
           .trim();
   }


    const chaveCabecalho = (valor) => normalizar(valor).replace(/[^A-Z0-9]/g, '');

    /* Resolve, uma vez por planilha, qual cabeçalho corresponde a cada campo.
       Os nomes de CAMPOS são tentados na ordem em que aparecem (o primeiro é o preferido),
       e não na ordem das colunas da planilha. */
    
      function resolverColunas(cabecalhos) {
          const chaves = cabecalhos.map((c) => ({
              original: c,
              chave: chaveCabecalho(c)
          }));
      
          const mapa = {};
      
          for (const [campo, nomes] of Object.entries(CAMPOS)) {
              const alvos = nomes.map(chaveCabecalho);
              let achado = null;
      
              // Primeiro procura correspondência exata.
              for (const a of alvos) {
                  achado = chaves.find((c) => c.chave === a);
      
                  if (achado) break;
              }
      
              // Evita confundir códigos com descrições.
              if (
                  !achado &&
                  !['assunto', 'grupo', 'ocorrencia', 'tipo', 'numOcorrencia'].includes(campo)
              ) {
                  for (const a of alvos) {
                      achado = chaves.find(
                          (c) =>
                              c.chave.length > 4 &&
                              (
                                  c.chave.includes(a) ||
                                  a.includes(c.chave)
                              )
                      );
      
                      if (achado) break;
                  }
              }
      
              mapa[campo] = achado ? achado.original : null;
          }
      
          return mapa;
      }


    /* ======================================================
       2. DATAS
    ====================================================== */

    function dataDeCelula(valor) {
        if (valor === null || valor === undefined || valor === '') return null;

        if (valor instanceof Date && !isNaN(valor)) {
            return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
        }

        /* número de série do Excel */
        if (typeof valor === 'number' && window.XLSX && XLSX.SSF) {
            const p = XLSX.SSF.parse_date_code(valor);
            return p ? new Date(p.y, p.m - 1, p.d) : null;
        }

        const texto = String(valor).trim();
        let m = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
        if (m) {
            let ano = Number(m[3]);
            if (ano < 100) ano += ano < 50 ? 2000 : 1900;
            const d = new Date(ano, Number(m[2]) - 1, Number(m[1]));
            return isNaN(d) ? null : d;
        }
        m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

        if (/^\d+(\.\d+)?$/.test(texto) && window.XLSX && XLSX.SSF) {
            return dataDeCelula(Number(texto));
        }
        return null;
    }

    /* Data como número AAAAMMDD: comparar dias fica simples e rápido. */
    const chaveDia = (d) => (d ? d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() : 0);

    const doisDigitos = (n) => String(n).padStart(2, '0');
    const formatarData = (d) => (d ? `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}` : '—');
    const formatarDataCurta = (d) => (d ? `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}` : '');
    const paraInput = (d) => (d ? `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}` : '');
    const deInput = (texto) => (texto ? dataDeCelula(texto) : null);

    const DIA_MS = 86400000;

    /* Dias úteis entre duas datas: conta de segunda a sexta, a partir do dia
       seguinte à abertura até o fim (inclusive). Feriados não entram (seção 8
       do CLAUDE.md). Mesmo resultado do laço dia a dia, mas sem laço. */
    function diasUteisEntre(inicio, fim) {
        if (!inicio || !fim) return 0;
        const total = Math.round((Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate()) -
            Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) / DIA_MS);
        if (total <= 0) return 0;

        let uteis = Math.floor(total / 7) * 5;
        let diaSemana = inicio.getDay();
        for (let i = 0; i < total % 7; i++) {
            diaSemana = (diaSemana + 1) % 7;
            if (diaSemana !== 0 && diaSemana !== 6) uteis++;
        }
        return uteis;
    }

    /* RN 623: em atraso > 5 dias úteis; atenção 4 a 5; em dia < 4. */
    function prazoRN623(dias) {
        if (dias > 5) return 'atraso';
        if (dias >= 4) return 'atencao';
        return 'ok';
    }

    /* O filtro separa a atenção em 4 e 5 dias úteis. */
    function prazoDetalhado(dias) {
        if (dias > 5) return 'atraso';
        if (dias === 5) return 'atencao5';
        if (dias === 4) return 'atencao4';
        return 'ok';
    }

    const ROTULO_PRAZO = {
        ok: 'Em dia',
        atencao4: 'Atenção 4 dias',
        atencao5: 'Atenção 5 dias',
        atraso: 'Atrasado (RN 623)',
        sem: 'Sem data'
    };
    const PESO_PRAZO = { atraso: 4, atencao5: 3, atencao4: 2, ok: 1, sem: 0 };

    /* ======================================================
       3. CLASSIFICAÇÃO DOS SETORES
       A planilha não traz o setor: ele sai da combinação
       assunto + grupo + ocorrência. Os valores seguem a planilha
       original do CRM exatamente como ela vem (não trocar nomes).
       Vale a primeira regra que bater, na ordem abaixo.
    ====================================================== */

    const REGRAS_SETORES = [
        {
            setor: 'CADASTRO',
            assuntos: [
                'ADESAO A SAUDE', 'DEMAIS INFORMACOES',
                'INFORMACAO SOBRE ADESAO A SAUDE',
                'INFORMACAO SOBRE ADESAO AO SOCIAL',
                'INFORMACOES SOBRE CANCELAMENTO',
                'INFORMACOES CADASTRAIS', 'PORTAL - ADESAO',
                'PORTAL - SOCIAL'
            ],
            grupos: [
                'PORTABILIDADE', 'INCLUSAO DE DEPENDENTES/AGREGADO',
                'MUDANCA DE ORGAO', 'MIGRACAO DE PLANO',
                'SOLICITAR ADESAO', 'REINGRESSO',
                'ACOMPANHAMENTO DE ADESAO',
                'SITE/EXTRATO BENEFICIARIO', 'MOVIMENTACAO CADASTRAL',
                'DOCUMENTOS PARA ADESAO',
                'PORTABILIDADE / CARTA PERMANENCIA',
                'INFORMACOES SOBRE REINGRESSO', 'CARENCIAS - INFORMACOES',
                'ATUALIZACAO CADASTRAL', 'CARTEIRINHA',
                'INFORMACOES MUDANCA DE PATROCINADOR',
                'PRE INSCRICAO', 'OUTROS SERVICOS',
                'DESLIGAMENTO DE BENEFICIARIOS'
            ],
            subgrupos: [
                'PORTABILIDADE', 'INCLUSAO DE DEPENDENTES/AGREGA',
                'MUDANCA DE ORGAO', 'MIGRACAO DE PLANO',
                'SOLICITAR ADESAO', 'REINGRESSO',
                'ACOMPANHAMENTO DE ADESAO',
                'EXTRATO E COPARTICIPACOES', 'ADESAO E INCLUSAO',
                'TRANSFERENCIA DE PLANO',
                'MUDANCA DE CONVENIO/PATROCINADOR',
                'SUSPENSAO DE MENSALIDADE TEMPORARIA',
                'MANUTENCAO ESPECIAL - OBITO',
                'MANUTENCAO ESPECIAL - EXONERACAO',
                'REEINGRESSO', 'PORTABILIDADE DE PLANO',
                'RESSARCIMENTO DE MENSALIDADE',
                'DOCUMENTOS PARA ADESAO',
                'PORTABILIDADE / CARTA PERMANENCIA',
                'INFORMACOES SOBRE REINGRESSO',
                'CARENCIAS - INFORMACOES', 'ATUALIZACAO CADASTRAL',
                '2 VIA DA CARTEIRINHA',
                'INFORMACOES MUDANCA DE PATROCINADOR',
                'INFORMACOES SOBRE MIGRACAO DE PLANO',
                'SUSPENDER TEMPORARIAMENTE O PLANO (VIAGEM AO EXTERIOR)',
                'EXCLUSAO POR OBITO', 'OUTROS',
                'INCLUSAO AO PLANO DE SAUDE',
                'DESMEMBRAMENTO DE MENSALIDADE', 'OUTROS SERVICOS',
                'ADESAO AO SOCIAL', 'ADESAO AO PLANO DE SAUDE',
                'ORIENTACOES GERAIS',
                'EXONERACAO PELO ORGAO PATROCINADOR'
            ]
        },
        {
            setor: 'SOCIAL',
            assuntos: [
                'ATENCAO PRIMARIA A SAUDE', 'ATUALIZACAO CADASTRAL',
                'CENTROS DE LAZER', 'DEMAIS INFORMACOES',
                'DEMAIS INFORMACOES SOCIAL'
            ],
            grupos: [
                'ESPACO VIVA SAUDE', 'SITE', 'RESERVA',
                'OUTRAS INFORMACOES', 'OUTROS SERVICOS SOCIAL',
                'CONCIERGE'
            ],
            subgrupos: [
                'AGENDAMENTO APS', 'ACESSO PORTAL', 'RESERVA',
                'OUTRAS INFORMACOES', 'BENEFIFIOS DO SOCIAL'
            ]
        },
        {
            setor: 'CREDENCIAMENTO',
            assuntos: [
                'ATUALIZACAO CADASTRAL', 'CREDENCIAMENTO',
                'REDE CREDENCIADA'
            ],
            grupos: [
                'CREDENCIAMENTO', 'INFORMACOES SOBRE CREDENCIAMENTO',
                'ANALISE DE GARANTIA', 'RECIPROCIDADE',
                'REDE CREDENCIADA', 'SUSPENSAO DE ATENDIMENTO',
                'LANCAMENTO DE GUIAS'
            ],
            subgrupos: [
                'DESCREDENCIAMENTO', 'INFORMACOES CREDENCIAMENTO',
                'ATUALIZACAO / ALTERACAO CADASTRAL',
                'INCLUSAO DE CORPO CLINICO',
                'SOLICITACAO CREDENCIAMENTO / DESCREDENCIAMENTO',
                'RESET DE SENHA - AUTORIZADOR',
                'PRIMEIRO ACESSO AO PORTAL DO PRESTADOR',
                'EXAME LABORATORIAL', 'CANCELAMENTO DE AGENDAMENTO',
                'REDE INDIRETA - CASSI',
                'RECIPROCIDADE - DEMAIS CONVENIOS', 'UNIMED',
                'REDE CREDENCIADA LOCAL', 'SUSPENSAO DE ATENDIMENTO',
                'REDE CREDENCIADA', 'CONSULTA BASICA',
                'ESPECIALIDADES NAO MEDICAS',
                'AGENDAMENTO CONSULTA EM DEMAIS ESPECIALIDADES',
                'AGENDAMENTO INTERNACAO ELETIVA',
                'ATENDIMENTO URGENCIA/EMERGENCIA',
                'DEMAIS EXAMES / PROCEDIMENTOS',
                'ANALISE CONTRATUAL - (OPCAO EXCLUSIVA - CAS)',
                'CREDENCIAMENTO'
            ]
        },
        {
            setor: 'AUDITORIA',
            assuntos: [
                'AUTORIZACAO MEDICA',
                'INFORMACAO SOBRE AUTORIZACAO MEDICA',
                'PORTAL - SAUDE', 'PROGRAMAS DE SAUDE'
            ],
            grupos: [
                'AUTORIZACAO DE PROCEDIMENTOS', 'CANCELAMENTO DE GUIA',
                'COBERTURA ASSISTENCIAL', 'REMOCAO',
                'SOLICITACAO DE MEDICAMENTOS', 'AUTORIZACAO',
                'PROGRAMA DE IMUNIZACAO ASSEFAZ',
                'PROGRAMA DE ATENCAO DOMICILIAR - PAD'
            ],
            subgrupos: [
                'AUTORIZACAO/ MEDICAMENTOS QUIMIOTERAPICOS',
                'CONSULTA/ ACOMPANHAMENTO', 'ELEGIBILIDADE',
                'FORMULARIO TISS PELO SITE DA ASSEFAZ',
                'GUIAS - ALTERACAO DE FLUXO/CANCELAMENTO',
                'GUIA RETROATIVA/ OBITO DO BENEFICIARIO',
                'OPME - SOLICITACAO DE GUIAS',
                'PRORROGACAO DIARIA/ ORIENTACAO',
                'PEDIDO MEDICO - FISICO/ DIGITAL', 'CANCELAMENTO',
                'ACOMPANHAMENTO DE GUIAS',
                'ATENDIMENTO DE URGENCIA/EMERGENCIA',
                'CANCELAMENTO DE GUIAS',
                'ACOMPANHAMENTO DE GUIAS CNU',
                'QUIMIOTERAPICO - ORAL', 'REGRAS GERAIS',
                'ANALISE DE SOLICITACAO (REGULACAO MEDICA)',
                'SOLICITACAO DE MEDICAMENTO QUIMIOTERAPICO ORAL',
                'IMUNOFAZ', 'ADMISSAO HOSPITAL DE TRANSICAO',
                'ADMISSAO PAD', 'ALTA HOSPITAL DE TRANSICAO',
                'RJ - RIO DE JANEIRO', 'MONITORAMENTO',
                'COBERTURA PARA ACOMPANHANTE',
                'LENTE INTRAOCULAR - LIO (OPME)',
                'PARECER DE COBERTURA (PEDIDO MEDICO)',
                'PLANO ODONTOLOGICO', 'OUTROS SERVICOS'
            ]
        },
        {
            setor: 'FINANCEIRO',
            assuntos: [
                'DEMAIS INFORMACOES', 'FATURAMENTO', 'FINANCEIRO',
                'FINANCEIRO/2 VIA DE BOLETO',
                'PORTAL - SAUDE', 'PORTAL - SOCIAL'
            ],
            grupos: [
                'MOVIMENTACAO CADASTRAL', 'FATURAMENTO',
                'ALTERAR FORMA DE PAGAMENTO',
                'DESMEMBRAMENTO FINANCEIRO', 'VALORES DOS PLANOS',
                'NEGOCIACAO DE DIVIDAS',
                'NOTIFICACAO DE INADIMPLENCIA',
                'SOLICITACOES FINANCEIRAS', 'FATURAMENTO OPME',
                'IMPOSTO DE RENDA'
            ],
            subgrupos: [
                'DESMEMBRAMENTO DE MENSALIDADE',
                'INSTRUCOES SOBRE FATURAMENTO / RECURSO DE GLOSA',
                'BPO - AUSENCIA DE PAGAMENTO POR EXTRAVIO DE FATURAS',
                'BPO - FATURAS GLOSADAS POR FALTA DE FISICO',
                'DEMONSTRATIVO DE PAGAMENTO',
                'DUVIDAS - ENVIO DE FATURAS EM FFP OU XML',
                'ENTREGA DE FATURAMENTO', 'FATURAMENTO OPME',
                'PAGAMENTO - FATURAMENTO / NF - CRONOGRAMA',
                'BPO - PRESTADOR NAO ENCONTRADO NO SISTEMA',
                'CANCELAMENTO DE FATURAS - FFP OU XML',
                'CANCELAMENTO DE NF',
                'ERROS - ENVIO DE FATURAS EM XML/FFP',
                'NEGOCIACAO CONTRATUAL', 'ALTERAR FORMA DE PAGAMENTO',
                'DESMEMBRAMENTO FINANCEIRO', 'NEGOCIACAO DE VALORES / PARCELA',
                'NEGOCIACAO DE DIVIDAS', 'NOTIFICACAO DE INADIMPLENCIA',
                'SOLICITACOES DE SERVICOS FINANCEIROS',
                'EMISSAO DE DECLARACAO - PJ', 'FATURA FORA DO PRAZO'
            ]
        },
        {
            setor: 'REEMBOLSO',
            assuntos: ['INFORMACOES SOBRE REEMBOLSO', 'PORTAL - SAUDE'],
            grupos: [
                'REEMBOLSO DE VACINAS', 'PROCEDIMENTOS MEDICOS',
                'CONSULTAR EXTRATO - REEMBOLSO',
                'REEMBOLSO DE MEDICAMENTOS', 'ODONTOLOGICO',
                'SOLICITACAO DE REEMBOLSO'
            ],
            subgrupos: [
                'REEMBOLSO DE VACINAS', 'PROCEDIMENTOS MEDICOS',
                'CONSULTAR EXTRATO - REEMBOLSO',
                'REEMBOLSO DE MEDICAMENTOS', 'ODONTOLOGICO',
                'SOLICITACAO DE REEMBOLSO',
                'REEMBOLSO DE PROCEDIMENTOS'
            ]
        },
        {
            setor: 'CAPTAÇÃO',
            assuntos: ['INFORMACOES SOBRE CANCELAMENTO'],
            grupos: ['DESLIGAMENTO DE BENEFICIARIOS'],
            subgrupos: [
                'CANCELAMENTO DE DEPENDENTE',
                'CANCELAMENTO DE AGREGADO', 'MOTIVOS FINANCEIROS',
                'PORTABILIDADE/TROCA POR OUTRA OPERADORA',
                'INSUFICIENCIA DE REDE CREDENCIADA',
                'CANCELAMENTO ASSEFAZ SOCIAL',
                'MUDANCA DE CIDADE (UF)'
            ]
        },
        {
            setor: 'OUTROS',
            assuntos: ['DEMAIS INFORMACOES', 'PORTAL - SAUDE'],
            grupos: ['OUTROS SERVICOS'],
            subgrupos: ['OUTROS SERVICOS']
        }
    ].map((r) => ({ setor: r.setor, assuntos: new Set(r.assuntos), grupos: new Set(r.grupos), subgrupos: new Set(r.subgrupos) }));

    /* Complemento aprovado pelo autor em 03/11/2026: combinações exatas
       (assunto | grupo | ocorrência) que as regras acima não cobriam.
       Ocorrência ou grupo vazio na planilha = ''. */
    const COMPLEMENTO_SETORES = {
        FINANCEIRO: [
            ['FINANCEIRO/2 VIA DE BOLETO', 'BOLETO', '2 VIA DE BOLETO'],
            ['FINANCEIRO', 'BOLETO', '2 VIA DE BOLETO'],
            ['FINANCEIRO', 'BOLETO', 'BOLETO/PIX'],
            ['FINANCEIRO/2 VIA DE BOLETO', 'BOLETO', 'BOLETO/PIX'],
            ['FINANCEIRO', 'BOLETO', 'COMPROVANTE DE PAGAMENTO'],
            ['FINANCEIRO', 'DIVERGENCIA DE VALORES', 'DIVERGENCIA DE VALORES'],
            ['FINANCEIRO/2 VIA DE BOLETO', 'DIVERGENCIA DE VALORES', 'DIVERGENCIA DE VALORES'],
            ['FINANCEIRO/2 VIA DE BOLETO', 'DIVERGENCIA DE VALORES', ''],
            ['FINANCEIRO', 'VALORES DOS PLANOS', 'MENSALIDADE'],
            ['FINANCEIRO', 'VALORES DOS PLANOS', 'COPARTICIPACAO'],
            ['FINANCEIRO', 'VALORES DOS PLANOS', 'PER CAPITA / SUBSIDIO'],
            ['FINANCEIRO', 'DEBITO EM CONTA', 'DEBITO/INFORMACOES'],
            ['FINANCEIRO', 'DEBITO EM CONTA', 'INCLUSAO DE DEBITO - CAIXA'],
            ['FINANCEIRO', 'IMPOSTO DE RENDA', 'EMISSAO DE DECLARACAO'],
            ['FINANCEIRO', '', 'ALTERAR DE FORMA DE PAGAMENTO'],
            ['FATURAMENTO', 'FATURAMENTO', 'ORIENTACOES OPERACIONAIS'],
            ['FATURAMENTO', 'FATURAMENTO', 'FATURAMENTO - ERRO FFP OU XML'],
            ['FATURAMENTO', 'FATURAMENTO', 'RECURSO DE GLOSA - ORIENTACOES'],
            ['FATURAMENTO', 'FATURAMENTO', '']
        ],
        AUDITORIA: [
            ['INFORMACAO SOBRE AUTORIZACAO MEDICA', 'COBERTURA ASSISTENCIAL', 'PROGRAMA DE ATENCAO DOMICILIAR'],
            ['AUTORIZACAO MEDICA', 'AUTORIZACAO DE PROCEDIMENTOS', 'NEGATIVA EM GUIAS'],
            ['AUTORIZACAO MEDICA', 'AUTORIZACAO DE PROCEDIMENTOS', 'AUTORIZACAO/ COMPLEMENTO DE TRATAMENTO'],
            ['AUTORIZACAO MEDICA', 'AUTORIZACAO DE PROCEDIMENTOS', 'INSTABILIDADE SISTEMICA FACIL - CONTINGENCIA'],
            ['AUTORIZACAO MEDICA', 'AUTORIZACAO DE PROCEDIMENTOS', 'REVALIDACAO DAS GUIAS AUTORIZADAS'],
            ['AUTORIZACAO MEDICA', 'LANCAMENTO DE GUIAS', ''],
            ['PROGRAMAS DE SAUDE', 'PROGRAMA DE ATENCAO DOMICILIAR - PAD', 'AVALIACAO DE ELEGIBILIDADE'],
            ['PROGRAMAS DE SAUDE', 'PROGRAMA DE ATENCAO DOMICILIAR - PAD', 'READEQUACAO DO PLANO TERAPEUTICO'],
            ['PROGRAMAS DE SAUDE', 'PROGRAMA DE ATENCAO DOMICILIAR - PAD', 'FAVORAVEL'],
            ['PROGRAMAS DE SAUDE', 'PROGRAMA DE ATENCAO DOMICILIAR - PAD', 'READMISSAO PAD']
        ],
        CADASTRO: [
            ['INFORMACAO SOBRE ADESAO A SAUDE', 'ADESAO / ORIENTACOES', 'ADESAO / ORIENTACOES'],
            ['INFORMACAO SOBRE ADESAO A SAUDE', 'PATROCINADORAS', 'CONTATO COM O PATROCINADOR'],
            ['PORTAL - SAUDE', 'ATUALIZACAO CADASTRAL', 'ATUALIZACAO CADASTRAL'],
            ['ADESAO A SAUDE', 'MUDANCA DE ORGAO', ''],
            ['ADESAO A SAUDE', 'INCLUSAO DE DEPENDENTES/AGREGADO', ''],
            ['ADESAO A SAUDE', 'PORTABILIDADE', ''],
            ['ADESAO AO SOCIAL', 'SOLICITAR ADESAO', ''],
            ['INFORMACAO SOBRE ADESAO AO SOCIAL', 'DOCUMENTOS PARA ADESAO', '']
        ],
        CREDENCIAMENTO: [
            ['REDE CREDENCIADA', 'ORIENTACOES DIVERSAS', 'ORIENTACOES DIVERSAS'],
            ['REDE CREDENCIADA', 'TELESAUDE', 'CONEXA']
        ],
        SOCIAL: [
            ['REDE DE VANTAGENS', 'ASSISTENCIA FUNERAL', 'ASSISTENCIA FUNERAL'],
            ['REDE DE VANTAGENS', 'SOCIAL PELO PAIS', 'SOCIAL PELO PAIS'],
            ['DEMAIS INFORMACOES', 'ESPACO VIVA SAUDE', ''],
            ['DEMAIS INFORMACOES SOCIAL', 'OUTROS SERVICOS SOCIAL', '']
        ],
        OUTROS: [
            ['DEMAIS INFORMACOES', 'EXAMES MEDICOS PERIODICOS', 'EXAMES MEDICOS PERIODICOS'],
            ['DEMAIS INFORMACOES', 'APP ASSEFAZ', 'FUNCIONALIDADES'],
            ['INFORMACOES SOBRE REEMBOLSO', '', ''],
            ['DEMAIS INFORMACOES', '', '']
        ]
    };

    const MAPA_COMPLEMENTO = new Map();
    for (const [setor, combinacoes] of Object.entries(COMPLEMENTO_SETORES)) {
        for (const [a, g, o] of combinacoes) MAPA_COMPLEMENTO.set(`${a}|${g}|${o}`, setor);
    }

    const NAO_CLASSIFICADO = 'NÃO CLASSIFICADO';

    function classificarSetor(assunto, grupo, ocorrencia, setorDaPlanilha) {
        for (const regra of REGRAS_SETORES) {
            if (regra.assuntos.has(assunto) && regra.grupos.has(grupo) && regra.subgrupos.has(ocorrencia)) {
                return regra.setor;
            }
        }
        return MAPA_COMPLEMENTO.get(`${assunto}|${grupo}|${ocorrencia}`) ||
            normalizar(setorDaPlanilha) || NAO_CLASSIFICADO;
    }

    /* Nomes para a tela: "REEMBOLSO" → "Reembolso". */
    function nomeBonito(texto) {
        const t = String(texto || '').trim().toLowerCase();
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
    }

    const ROTULO_TIPO = {
        'SOLICITACAO': 'Solicitação',
        'INFORMACAO': 'Informação',
        'RECLAMACAO': 'Reclamação',
        'REANALISE': 'Reanálise',
        'SUGESTAO': 'Sugestão',
        'ELOGIO': 'Elogio',
        'SOLICITACAO DE GRAVACAO': 'Gravação'
    };

    const rotuloTipo = (tipoNorm) => ROTULO_TIPO[tipoNorm] || nomeBonito(tipoNorm);

    /* Canal de comunicação (DESC_COMUNICACAO): nomes curtos para os botões. */
    const ROTULO_CANAL = {
        'PORTAL': 'Portal',
        'VOZ': 'Voz',
        'PRESENCIAL': 'Presencial',
        'WHATSAPP': 'WhatsApp',
        'E-MAIL INSTITUCIONAL': 'E-mail',
        'E-MAIL': 'E-mail',
        'CHAT': 'Chat',
        'RECLAME AQUI': 'Reclame Aqui',
        'CALLBACK': 'Callback',
        'OUVIDORIA': 'Ouvidoria'
    };

    const rotuloCanal = (canalNorm) => ROTULO_CANAL[canalNorm] || nomeBonito(canalNorm);

    /* ======================================================
       4. PREPARAÇÃO DOS REGISTROS (uma vez, na importação)
    ====================================================== */

    const texto = (v) => String(v ?? '').trim();

    function formatarCPF(valor) {
        const digitos = texto(valor).replace(/\D/g, '');
        if (!digitos) return '';
        const d = digitos.padStart(11, '0').slice(-11);
        return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }

    function prepararRegistros(linhas, colunas, hoje) {
        const pegar = (linha, campo) => (colunas[campo] ? linha[colunas[campo]] : '');
        const registros = [];

        for (const linha of linhas) {
            const abertura = dataDeCelula(pegar(linha, 'abertura'));
            const encerramento = dataDeCelula(pegar(linha, 'encerramento'));
            const statusNorm = normalizar(pegar(linha, 'status'));
            const ocorrencia = texto(pegar(linha, 'ocorrencia'));
            const tipoNorm = normalizar(pegar(linha, 'tipo'));
            const canalNorm = normalizar(pegar(linha, 'canal'));

            /* linha totalmente vazia (rodapé de planilha, por exemplo) */
            if (!abertura && !ocorrencia && !texto(pegar(linha, 'protocolo'))) continue;

            /* Pendente = STATUS_OCORRENCIA "Pendente". Sem essa coluna: sem data de encerramento. */
            const pendente = colunas.status ? statusNorm.includes('PENDENTE') : !encerramento;

            /* RN 623: pendente conta até hoje; encerrado, até o encerramento. */
            const fim = pendente ? hoje : (encerramento || hoje);
            const dias = abertura ? diasUteisEntre(abertura, fim) : 0;
            const prazo = abertura ? prazoRN623(dias) : 'sem';
            const prazoDet = abertura ? prazoDetalhado(dias) : 'sem';

            const setor = classificarSetor(
                normalizar(pegar(linha, 'assunto')),
                normalizar(pegar(linha, 'grupo')),
                normalizar(ocorrencia),
                pegar(linha, 'setor')
            );

            const protocolo = texto(pegar(linha, 'protocolo'));
            const cpf = formatarCPF(pegar(linha, 'cpf'));
            const nome = texto(pegar(linha, 'nome'));
            const email = texto(pegar(linha, 'email')).toLowerCase();
            const numOcorrencia = texto(pegar(linha, 'numOcorrencia'));
            /* colaborador só existe para quem já encerrou */
            const colaborador = pendente ? '' : texto(pegar(linha, 'colaborador'));

            registros.push({
                protocolo,
                numOcorrencia,
                /* mesma chave que o Kanban usa: [protocolo, num. ocorrência] */
                chaveKanban: numOcorrencia ? JSON.stringify([protocolo, numOcorrencia]) : '',
                colaborador,
                canal: texto(pegar(linha, 'canal')),
                cpf,
                nome,
                email,
                setor,
                ocorrencia,
                ocorrenciaNorm: normalizar(ocorrencia),
                tipoNorm,
                canalNorm,
                abertura,
                chaveAbertura: chaveDia(abertura),
                mesAbertura: abertura ? abertura.getFullYear() * 100 + abertura.getMonth() + 1 : 0,
                encerramento,
                chaveEncerramento: chaveDia(encerramento),
                mesEncerramento: !pendente && encerramento ? encerramento.getFullYear() * 100 + encerramento.getMonth() + 1 : 0,
                previsao: dataDeCelula(pegar(linha, 'previsao')),
                pendente,
                dias,
                prazo,
                prazoDet,
                ajuda: false, /* preenchido pelo Kanban (lerAjudaKanban) */
                observacao: texto(pegar(linha, 'observacao')),
                busca: `${protocolo} ${cpf.replace(/\D/g, '')} ${email}`.toLowerCase()
            });
        }
        return registros;
    }

    /* ======================================================
       5. ESTADO
    ====================================================== */

    const filtrosVazios = () => ({
        de: null,
        ate: null,
        setor: '',
        colaborador: '',          /* '' todos · '__sem__' sem colaborador · nome */
        ocorrencias: new Set(),
        canais: new Set(),
        situacao: '',             /* '' · 'pendente' · 'encerrado' */
        prazos: new Set(),        /* ok · atencao4 · atencao5 · atraso */
        ajuda: false              /* só os "Precisando de ajuda" do Kanban */
    });

    const estado = {
        base: [],
        nomeArquivo: '',
        temColaborador: false,
        hoje: null,
        mesRef: 0,                /* mês mais recente da planilha (AAAAMM) */
        filtros: filtrosVazios(),
        busca: '',
        ordem: { campo: 'abertura', direcao: -1 },
        pagina: 0,
        linhasPorPagina: 12,
        filtrados: [],
        tabela: [],
        setores: [],
        prazos: [],
        evolucao: null
    };

    const SEM_COLABORADOR = '__sem__';

    const numeroBR = (n) => Number(n || 0).toLocaleString('pt-BR');
    const decimalBR = (n, casas = 1) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

    function dataHoje() {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function escapar(t) {
        return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    /* ---- meses no formato AAAAMM ---- */
    const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mesAnterior = (m) => (m % 100 === 1 ? (Math.floor(m / 100) - 1) * 100 + 12 : m - 1);
    const rotuloMes = (m) => (m ? `${NOMES_MES[(m % 100) - 1]}/${String(Math.floor(m / 100)).slice(2)}` : '—');

    function ultimosMeses(ref, quantos) {
        const meses = [];
        let m = ref;
        for (let i = 0; i < quantos && m; i++) { meses.unshift(m); m = mesAnterior(m); }
        return meses;
    }

    /* ======================================================
       6. FILTROS
       Cada parte da tela usa só os filtros que fazem sentido para ela:
       - "Hoje": setor, canal e ocorrência (nunca a situação nem o prazo);
       - indicadores: tudo menos prazo e ajuda (são os próprios cartões);
       - T.M.E e IR: também ignoram a situação (dependem dos encerrados);
       - tabela, setores e exportação: todos os filtros.
    ====================================================== */

    function passaCategorias(r, ignorarSetor = false) {
        const f = estado.filtros;
        if (!ignorarSetor && f.setor && r.setor !== f.setor) return false;
        if (f.ocorrencias.size && !f.ocorrencias.has(r.ocorrenciaNorm)) return false;
        if (f.canais.size && !f.canais.has(r.canalNorm)) return false;
        return true;
    }

    function passaColaborador(r) {
        const c = estado.filtros.colaborador;
        if (!c) return true;
        return c === SEM_COLABORADOR ? !r.colaborador : r.colaborador === c;
    }

    function passaPeriodo(r) {
        const { de, ate } = estado.filtros;
        if (de && (!r.chaveAbertura || r.chaveAbertura < chaveDia(de))) return false;
        if (ate && (!r.chaveAbertura || r.chaveAbertura > chaveDia(ate))) return false;
        return true;
    }

    function passaSituacao(r) {
        const s = estado.filtros.situacao;
        return !s || (s === 'pendente' ? r.pendente : !r.pendente);
    }

    const passaPrazo = (r) => !estado.filtros.prazos.size || estado.filtros.prazos.has(r.prazoDet);
    const passaAjuda = (r) => !estado.filtros.ajuda || r.ajuda;

    /* setor/canal/ocorrência + colaborador + período */
    const passaBase = (r, ignorarSetor = false) => passaCategorias(r, ignorarSetor) && passaColaborador(r) && passaPeriodo(r);

    function atualizarTudo() {
        let todos = 0;
        let pendentes = 0;
        let ajuda = 0;
        estado.filtrados = [];
        for (const r of estado.base) {
            if (!passaBase(r)) continue;
            if (r.ajuda) ajuda++;
            if (!passaPrazo(r) || !passaAjuda(r)) continue;
            todos++;
            if (r.pendente) pendentes++;
            if (passaSituacao(r)) estado.filtrados.push(r);
        }
        $('qtdTodos').textContent = numeroBR(todos);
        $('qtdPendentes').textContent = numeroBR(pendentes);
        $('qtdEncerrados').textContent = numeroBR(todos - pendentes);
        $('qtdAjuda').textContent = numeroBR(ajuda);

        estado.pagina = 0;
        desenharHoje();
        desenharIndicadores();
        desenharIR();
        desenharSetores();
        desenharEvolucao();
        desenharPrazos();
        sincronizarControles();
        desenharFiltrosAtivos();
        atualizarTabela();
    }

    /* ======================================================
       7. FAIXA "HOJE"
       Saldo do dia: encerrou menos que abriu = vermelho; igual = amarelo;
       encerrou mais = verde. Não depende da situação nem do prazo.
    ====================================================== */

    function desenharHoje() {
        $('infoHoje').textContent = formatarData(estado.hoje);
        const cartao = $('cartaoEncerradosHoje');
        cartao.classList.remove('saldo-ok', 'saldo-atencao', 'saldo-atraso');

        if (!estado.base.length) {
            $('kpiAbertosHoje').textContent = '—';
            $('kpiEncerradosHoje').textContent = '—';
            $('apoioEncerradosHoje').textContent = '';
            return;
        }

        const chaveHoje = chaveDia(estado.hoje);
        let abertos = 0;
        let encerrados = 0;
        for (const r of estado.base) {
            if (!passaCategorias(r)) continue;
            if (r.chaveAbertura === chaveHoje) abertos++;
            if (!r.pendente && r.chaveEncerramento === chaveHoje) encerrados++;
        }

        $('kpiAbertosHoje').textContent = numeroBR(abertos);
        $('kpiEncerradosHoje').textContent = numeroBR(encerrados);

        const saldo = encerrados - abertos;
        const cor = saldo < 0 ? 'atraso' : saldo === 0 ? 'atencao' : 'ok';
        cartao.classList.add(`saldo-${cor}`);
        $('apoioEncerradosHoje').textContent = saldo === 0
            ? '= abertos'
            : `${saldo > 0 ? '+' : '−'}${numeroBR(Math.abs(saldo))}`;
        cartao.title = saldo === 0
            ? 'Encerrou o mesmo número que abriu hoje'
            : `Encerrou ${numeroBR(Math.abs(saldo))} ${saldo > 0 ? 'a mais' : 'a menos'} do que abriu hoje`;
    }

    /* ======================================================
       8. INDICADORES
       Valor: todos os protocolos da tela (filtros aplicados).
       Sem comparação com o mês anterior (o autor pediu para tirar).
    ====================================================== */

    const CONTAGENS = {
        total: { valor: 'indTotal', teste: () => true },
        pendentes: { valor: 'indPendentes', teste: (r) => r.pendente },
        ok: { valor: 'indOk', teste: (r) => r.prazoDet === 'ok' },
        atencao: { valor: 'indAtencao', teste: (r) => r.prazoDet === 'atencao4' || r.prazoDet === 'atencao5' },
        atraso: { valor: 'indAtraso', teste: (r) => r.prazoDet === 'atraso' },
        ajuda: { valor: 'indAjuda', teste: (r) => r.ajuda }
    };

    /* T.M.E (dias úteis) e IR (%) de um grupo de registros */
    function tmeIr(registros) {
        let encerrados = 0;
        let noPrazo = 0;
        let somaDias = 0;
        for (const r of registros) {
            if (r.pendente || r.prazoDet === 'sem') continue;
            encerrados++;
            somaDias += r.dias;
            if (r.prazoDet !== 'atraso') noPrazo++;
        }
        return {
            encerrados,
            noPrazo,
            tme: encerrados ? somaDias / encerrados : null,
            ir: encerrados ? (noPrazo / encerrados) * 100 : null
        };
    }

    /* a comparação "vs. mês anterior" embaixo dos cartões saiu a pedido do autor (18/11/2026) */
    function desenharIndicadores() {
        const temDados = estado.base.length > 0;
        const conjunto = temDados ? estado.base.filter((r) => passaBase(r) && passaSituacao(r)) : [];

        for (const c of Object.values(CONTAGENS)) {
            $(c.valor).textContent = temDados ? numeroBR(conjunto.filter(c.teste).length) : '—';
        }

        /* o IR saiu dos cartões a pedido do autor: ele já aparece no gráfico mês a mês */
        const geral = temDados ? tmeIr(estado.base.filter((r) => passaBase(r))) : { tme: null };
        $('indTme').innerHTML = geral.tme === null ? '—' : `${decimalBR(geral.tme)}<small>dias</small>`;

        /* cartão ativo = filtro que ele aplica está ligado */
        const f = estado.filtros;
        const ativo = {
            total: temDados && !f.situacao && !f.prazos.size && !f.ajuda,
            pendentes: f.situacao === 'pendente',
            ok: f.prazos.has('ok'),
            atencao: f.prazos.has('atencao4') || f.prazos.has('atencao5'),
            atraso: f.prazos.has('atraso'),
            ajuda: f.ajuda
        };
        document.querySelectorAll('.ind[data-ind]').forEach((b) => {
            b.classList.toggle('ativo', Boolean(ativo[b.dataset.ind]));
            b.setAttribute('aria-pressed', String(Boolean(ativo[b.dataset.ind])));
        });
    }

    function clicarIndicador(qual) {
        if (!estado.base.length) return;
        const f = estado.filtros;
        /* Cada cartão liga e desliga sozinho (pedido do autor): se o filtro dele
           já está ligado, mesmo que em parte (ex.: só "atenção 5 dias" pelo painel),
           o clique desliga; senão, liga. Os outros cartões não mudam. */
        const alternarPrazo = (...valores) => {
            const ligado = valores.some((v) => f.prazos.has(v));
            valores.forEach((v) => (ligado ? f.prazos.delete(v) : f.prazos.add(v)));
        };
        if (qual === 'total') { f.situacao = ''; f.prazos = new Set(); f.ajuda = false; }
        else if (qual === 'pendentes') f.situacao = f.situacao === 'pendente' ? '' : 'pendente';
        else if (qual === 'ok') alternarPrazo('ok');
        else if (qual === 'atencao') alternarPrazo('atencao4', 'atencao5');
        else if (qual === 'atraso') alternarPrazo('atraso');
        else if (qual === 'ajuda') f.ajuda = !f.ajuda;
        atualizarTudo();
    }

    /* ======================================================
       9. GRÁFICOS
       Desenhados em SVG na largura do cartão (1 unidade = 1 px)
       e refeitos quando o tamanho muda. As cores vêm das
       variáveis --g-* do CSS, então o modo claro troca sozinho.
    ====================================================== */

    /* ---- dica (tooltip) compartilhada ---- */
    function mostrarDica(html, x, y) {
        const dica = $('dica');
        dica.innerHTML = html;
        dica.hidden = false;
        const largura = dica.offsetWidth;
        const altura = dica.offsetHeight;
        let esquerda = x + 14;
        let topo = y + 14;
        if (esquerda + largura > window.innerWidth - 8) esquerda = x - largura - 14;
        if (topo + altura > window.innerHeight - 8) topo = y - altura - 14;
        dica.style.left = `${Math.max(8, esquerda)}px`;
        dica.style.top = `${Math.max(8, topo)}px`;
    }

    const esconderDica = () => { $('dica').hidden = true; };

    const linhaDica = (marca, rotulo, valor) => `<div>${marca}${escapar(rotulo)}<b>${valor}</b></div>`;

    /* passo "redondo" para o eixo (1, 2, 5, 10, 20, 50...) */
    function passoEixo(maximo, divisoes = 4) {
        const bruto = Math.max(1, maximo / divisoes);
        const potencia = 10 ** Math.floor(Math.log10(bruto));
        const f = bruto / potencia;
        return Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * potencia);
    }

    /* barra com só o topo arredondado (a base fica presa no eixo) */
    function barraTopo(x, y, w, h, r) {
        r = Math.min(r, h, w / 2);
        return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
    }

    function cortarTexto(t, largura, px = 5.8) {
        const cabe = Math.max(3, Math.floor(largura / px));
        return t.length > cabe ? `${t.slice(0, cabe - 1)}…` : t;
    }

    /* Meses que os gráficos mensais (IR e prazos) mostram, pedido do autor (18/11/2026):
       sem filtro de período, os 12 últimos meses (um ano inteiro) até o mês de referência;
       com período, do mês do "De" até o mês do "Até" (ou até o mês de referência).
       Assim dá para olhar qualquer mês antigo só mexendo no filtro. */
    const mesDaData = (d) => d.getFullYear() * 100 + d.getMonth() + 1;

    function mesesDoPeriodo() {
        const { de, ate } = estado.filtros;
        const fim = ate ? Math.min(mesDaData(ate), estado.mesRef || mesDaData(ate)) : estado.mesRef;
        if (!de) return ultimosMeses(fim, 12);
        const meses = [];
        for (let m = mesDaData(de); m && m <= fim; m = m % 100 === 12 ? (Math.floor(m / 100) + 1) * 100 + 1 : m + 1) {
            meses.push(m);
        }
        return meses;
    }

    /* texto de apoio: deixo claro que meses estão no gráfico */
    function rotuloPeriodoMeses(meses) {
        if (!meses.length) return '';
        return meses.length === 1 ? rotuloMes(meses[0]) : `${rotuloMes(meses[0])} a ${rotuloMes(meses[meses.length - 1])}`;
    }

    /* ---- Evolução do IR (meses do período) ---- */
    function desenharIR() {
        const area = $('graficoIR');
        if (!estado.base.length) {
            $('periodoIR').textContent = '';
            area.innerHTML = '<p class="vazio-pequeno">Importe uma planilha para ver o índice.</p>';
            return;
        }
        const registros = estado.base.filter((r) => passaBase(r));
        const meses = mesesDoPeriodo();
        $('periodoIR').textContent = rotuloPeriodoMeses(meses);
        const linhas = meses.map((m) => ({ mes: m, ...tmeIr(registros.filter((r) => r.mesEncerramento === m)) }));
        /* com muitos meses as linhas ficam mais finas para caber no cartão */
        area.classList.toggle('muitos', linhas.length > 7);

        if (!linhas.some((l) => l.encerrados)) {
            area.innerHTML = '<p class="vazio-pequeno">Nenhum protocolo encerrado com esses filtros.</p>';
            return;
        }

        /* faixas da meta do IR: abaixo de 85% vermelho, de 85% até 89,9% amarelo, 90% ou mais verde */
        const faixaIR = (ir) => (ir === null ? '' : ir >= 90 ? ' ir-bom' : ir >= 85 ? ' ir-medio' : ' ir-ruim');
        area.innerHTML = linhas.map((l) => `
            <div class="ir-linha${faixaIR(l.ir)}${l.mes === estado.mesRef ? ' referencia' : ''}" data-mes="${l.mes}"
                 data-encerrados="${l.encerrados}" data-prazo="${l.noPrazo}">
                <span class="ir-mes">${rotuloMes(l.mes)}</span>
                <span class="ir-trilho"><span class="ir-barra" style="width:${l.ir === null ? 0 : l.ir.toFixed(1)}%"></span></span>
                <span class="ir-valor${l.ir === null ? ' vazio-ir' : ''}">${l.ir === null ? '—' : `${decimalBR(l.ir)}%`}</span>
            </div>`).join('');
    }

    /* ---- Protocolos por setor (colunas empilhadas) ---- */
    function desenharSetores() {
        const area = $('setoresLista');
        const situacao = estado.filtros.situacao;
        $('tituloSetores').lastChild.textContent = situacao === 'pendente' ? 'Pendentes por setor'
            : situacao === 'encerrado' ? 'Encerrados por setor' : 'Protocolos por setor';

        if (!estado.base.length) {
            estado.setores = [];
            area.innerHTML = '<p class="vazio-pequeno">Importe uma planilha para ver os setores.</p>';
            return;
        }

        /* todos os filtros, menos o próprio setor: assim dá para trocar de setor clicando */
        const porSetor = new Map();
        for (const r of estado.base) {
            if (!passaBase(r, true) || !passaSituacao(r) || !passaPrazo(r) || !passaAjuda(r)) continue;
            const s = porSetor.get(r.setor) || { ok: 0, atencao: 0, atraso: 0, sem: 0, total: 0 };
            s[r.prazo]++;
            s.total++;
            porSetor.set(r.setor, s);
        }

        estado.setores = [...porSetor.entries()].sort((a, b) =>
            (a[0] === NAO_CLASSIFICADO) - (b[0] === NAO_CLASSIFICADO) || b[1].total - a[1].total);

        if (!estado.setores.length) {
            area.innerHTML = '<p class="vazio-pequeno">Nenhum protocolo com esses filtros.</p>';
            return;
        }
        desenharColunasSetores();
    }

    function desenharColunasSetores() {
        const setorAtivo = estado.filtros.setor;
        desenharColunasEmpilhadas($('setoresLista'), estado.setores.map(([setor, s]) => ({
            rotulo: nomeBonito(setor),
            total: s.total,
            partes: [['ok', s.ok], ['atencao', s.atencao], ['atraso', s.atraso]],
            classe: setorAtivo === setor ? 'ativo' : setorAtivo ? 'apagado' : ''
        })), 'Protocolos por setor');
    }

    /* Colunas empilhadas (setores e encerrados por prazo): eixo com grade,
       2 px entre as partes, número dentro da parte quando cabe, total em cima. */
    function desenharColunasEmpilhadas(area, colunas, titulo) {
        if (!colunas.length) return;

        const W = Math.max(260, area.clientWidth);
        const H = Math.max(160, area.clientHeight);
        const m = { t: 24, r: 6, b: 30, l: 40 };
        const alturaUtil = H - m.t - m.b;
        const maior = Math.max(1, ...colunas.map((c) => c.total));
        /* topo do eixo colado no maior valor: tento divisões mais finas até o topo
           ficar no máximo 20% acima (antes 302 virava um eixo até 400 e sobrava espaço) */
        let passo = passoEixo(maior);
        for (const divisoes of [4, 5, 6, 8]) {
            passo = passoEixo(maior, divisoes);
            if (Math.ceil(maior / passo) * passo <= maior * 1.2) break;
        }
        const topoEixo = Math.ceil(maior / passo) * passo;
        const y = (v) => m.t + alturaUtil - (v / topoEixo) * alturaUtil;
        const faixa = (W - m.l - m.r) / colunas.length;
        const larguraColuna = Math.max(12, Math.min(72, faixa * 0.66));

        let svg = '';
        for (let v = 0; v <= topoEixo; v += passo) {
            svg += `<line class="${v === 0 ? 'g-eixo' : 'g-grade'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
            svg += `<text class="g-texto" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${numeroBR(v)}</text>`;
        }

        colunas.forEach((coluna, i) => {
            const cx = m.l + faixa * (i + 0.5);
            const x = cx - larguraColuna / 2;
            const classes = ['g-coluna'];
            if (coluna.classe) classes.push(coluna.classe);

            let grupo = `<rect class="g-alvo" x="${m.l + faixa * i + 2}" y="${m.t - 20}" width="${Math.max(4, faixa - 4)}" height="${alturaUtil + m.b + 16}" rx="8"/>`;
            const partes = coluna.partes.filter(([, n]) => n > 0);
            let acumulado = 0;
            partes.forEach(([classe, n], j) => {
                const base = y(acumulado) - (j > 0 ? 2 : 0); /* 2 px de respiro entre as partes */
                acumulado += n;
                const topo = y(acumulado);
                const h = base - topo;
                if (h < 0.8) return;
                grupo += j === partes.length - 1
                    ? `<path class="g-${classe}" d="${barraTopo(x, topo, larguraColuna, h, 4)}"/>`
                    : `<rect class="g-${classe}" x="${x}" y="${topo}" width="${larguraColuna}" height="${h}"/>`;
                if (h >= 16 && larguraColuna >= 24) {
                    grupo += `<text class="g-dentro" x="${cx}" y="${topo + h / 2 + 4}" text-anchor="middle">${numeroBR(n)}</text>`;
                }
            });
            if (coluna.total) {
                grupo += `<text class="g-valor" x="${cx}" y="${y(coluna.total) - 7}" text-anchor="middle">${numeroBR(coluna.total)}</text>`;
            }
            grupo += `<text class="g-texto-2" x="${cx}" y="${H - m.b + 18}" text-anchor="middle">${escapar(cortarTexto(coluna.rotulo, faixa - 4))}</text>`;
            const clicavel = !classes.includes('g-sem-clique');
            svg += `<g class="${classes.join(' ')}" data-i="${i}"${clicavel ? ' role="button" tabindex="0"' : ''} aria-label="${escapar(coluna.rotulo)}: ${coluna.total} protocolos">${grupo}</g>`;
        });

        area.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapar(titulo)}">${svg}</svg>`;
    }

    /* ---- Encerrados por prazo (RN 623), meses do período pelo mês de encerramento ----
       Segue todos os filtros, menos a situação (aqui só entram encerrados). */
    function desenharPrazos() {
        const area = $('graficoPrazos');
        estado.prazos = [];
        if (!estado.base.length) {
            area.innerHTML = '<p class="vazio-pequeno">Importe uma planilha para ver os encerrados por prazo.</p>';
            return;
        }
        const porMes = new Map();
        let primeiro = 0;
        for (const r of estado.base) {
            if (r.pendente || !r.mesEncerramento || r.prazoDet === 'sem') continue;
            if (!passaBase(r) || !passaPrazo(r) || !passaAjuda(r)) continue;
            const s = porMes.get(r.mesEncerramento) || { ok: 0, atencao4: 0, atencao5: 0, atraso: 0, total: 0 };
            s[r.prazoDet]++;
            s.total++;
            porMes.set(r.mesEncerramento, s);
            if (!primeiro || r.mesEncerramento < primeiro) primeiro = r.mesEncerramento;
        }
        if (!porMes.size) {
            area.innerHTML = '<p class="vazio-pequeno">Nenhum protocolo encerrado com esses filtros.</p>';
            return;
        }
        const vazio = { ok: 0, atencao4: 0, atencao5: 0, atraso: 0, total: 0 };
        /* sem filtro de período corto os meses antes do primeiro encerramento */
        estado.prazos = mesesDoPeriodo()
            .filter((m) => estado.filtros.de || m >= primeiro)
            .map((m) => [m, porMes.get(m) || vazio]);
        desenharColunasPrazos();
    }

    function desenharColunasPrazos() {
        if (!estado.prazos || !estado.prazos.length) return;
        /* no celular não cabem 12 meses com nome: mostro os 6 últimos */
        const area = $('graficoPrazos');
        const estreito = area.clientWidth < 480;
        estado.prazosVisiveis = estreito ? estado.prazos.slice(-6) : estado.prazos;
        desenharColunasEmpilhadas(area, estado.prazosVisiveis.map(([mes, s]) => ({
            /* no celular só o nome do mês ("jun"); o ano fica na dica */
            rotulo: estreito ? NOMES_MES[(mes % 100) - 1] : rotuloMes(mes),
            total: s.total,
            partes: [['ok', s.ok], ['atencao4', s.atencao4], ['atencao5', s.atencao5], ['atraso', s.atraso]],
            classe: 'g-sem-clique'
        })), 'Encerrados por prazo, mês a mês');
    }

    function dicaPrazo(i, x, yTela) {
        const item = (estado.prazosVisiveis || estado.prazos)[i];
        if (!item) return;
        const [mes, s] = item;
        const ponto = (c) => `<i class="ponto ${c}"></i>`;
        const pct = (n) => (s.total ? ` <small>(${decimalBR((n / s.total) * 100)}%)</small>` : '');
        mostrarDica(`<strong>Encerrados em ${rotuloMes(mes)}</strong>` +
            linhaDica(ponto('ok'), 'Em dia', numeroBR(s.ok) + pct(s.ok)) +
            linhaDica(ponto('atencao4'), 'Atenção 4 dias', numeroBR(s.atencao4) + pct(s.atencao4)) +
            linhaDica(ponto('atencao5'), 'Atenção 5 dias', numeroBR(s.atencao5) + pct(s.atencao5)) +
            linhaDica(ponto('atraso'), 'Atraso (RN 623)', numeroBR(s.atraso) + pct(s.atraso)) +
            linhaDica('', 'Total', numeroBR(s.total)), x, yTela);
    }

    function dicaSetor(i, x, yTela) {
        const item = estado.setores[i];
        if (!item) return;
        const [setor, s] = item;
        const ponto = (c) => `<i class="ponto ${c}"></i>`;
        mostrarDica(`<strong>${escapar(nomeBonito(setor))}</strong>` +
            linhaDica(ponto('ok'), 'Em dia', numeroBR(s.ok)) +
            linhaDica(ponto('atencao'), 'Atenção (4 e 5 dias)', numeroBR(s.atencao)) +
            linhaDica(ponto('atraso'), 'Atraso (RN 623)', numeroBR(s.atraso)) +
            linhaDica('', 'Total', numeroBR(s.total)), x, yTela);
    }

    function alternarSetor(i) {
        const item = estado.setores[i];
        if (!item) return;
        estado.filtros.setor = estado.filtros.setor === item[0] ? '' : item[0];
        esconderDica();
        atualizarTudo();
    }

    /* ---- Abertura × encerramento POR DIA (pedido do autor, 18/11/2026) ----
       Só duas coisas, como o autor pediu: colunas = encerrados no dia e
       linha = abertos no dia. Cor da coluna: encerrou mais que abriu = verde;
       igual = amarelo; menos = vermelho (a mesma regra do "Encerrados hoje").
       No mês corrente o eixo vai só até hoje; amanhã ganha o dia seguinte sozinho.
       Para comparar, troca-se o mês no seletor do cartão.
       Segue setor, canal, ocorrência e colaborador; período e situação não entram. */

    const NOMES_MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
        'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const rotuloMesLongo = (m) => `${NOMES_MES_LONGO[(m % 100) - 1]} de ${Math.floor(m / 100)}`;

    estado.diario = { mes: 0 };

    function mesesComDados() {
        const meses = new Set();
        for (const r of estado.base) {
            if (r.mesAbertura) meses.add(r.mesAbertura);
            if (r.mesEncerramento) meses.add(r.mesEncerramento);
        }
        return [...meses].sort((a, b) => b - a);
    }

    function montarSeletoresDiario() {
        const seletor = $('mesDiario');
        const meses = mesesComDados();
        seletor.disabled = !meses.length;
        if (!meses.length) { seletor.innerHTML = '<option>—</option>'; return; }
        const d = estado.diario;
        if (!meses.includes(d.mes)) d.mes = meses.includes(estado.mesRef) ? estado.mesRef : meses[0];
        seletor.innerHTML = meses.map((m) => `<option value="${m}">${rotuloMesLongo(m)}</option>`).join('');
        seletor.value = String(d.mes);
    }

    const corDoDia = (enc, ab) => (enc > ab ? 'ok' : enc === ab ? 'atencao' : 'atraso');

    function desenharEvolucao() {
        const area = $('graficoEvolucao');
        estado.evolucao = null;
        montarSeletoresDiario();
        if (!estado.base.length) {
            area.innerHTML = '<p class="vazio-pequeno">Importe uma planilha para ver os abertos e encerrados por dia.</p>';
            return;
        }

        const mes = estado.diario.mes;
        const ano = Math.floor(mes / 100);
        const mm = mes % 100;
        const diasNoMes = new Date(ano, mm, 0).getDate();
        /* mês corrente: só até hoje (a data do computador) */
        const mesHoje = estado.hoje.getFullYear() * 100 + estado.hoje.getMonth() + 1;
        const dias = mes === mesHoje ? estado.hoje.getDate() : diasNoMes;

        const abertos = new Array(dias + 1).fill(0);
        const encerrados = new Array(dias + 1).fill(0);
        for (const r of estado.base) {
            if (!passaCategorias(r) || !passaColaborador(r)) continue;
            if (r.mesAbertura === mes && r.abertura.getDate() <= dias) abertos[r.abertura.getDate()]++;
            if (r.mesEncerramento === mes && r.encerramento.getDate() <= dias) encerrados[r.encerramento.getDate()]++;
        }

        estado.evolucao = { mes, ano, mm, dias, abertos, encerrados };
        desenharLinhasEvolucao();
    }

    function desenharLinhasEvolucao() {
        const area = $('graficoEvolucao');
        const ev = estado.evolucao;
        esconderDica(); /* a dica antiga não vale mais para o desenho novo */
        if (!ev) return;

        const W = Math.max(260, area.clientWidth);
        const H = Math.max(150, area.clientHeight);
        const m = { t: 22, r: 10, b: 26, l: 40 };
        const alturaUtil = H - m.t - m.b;
        const larguraUtil = W - m.l - m.r;
        const n = ev.dias;
        const maior = Math.max(1, ...ev.abertos.slice(1), ...ev.encerrados.slice(1));
        const passo = passoEixo(maior);
        const topoEixo = Math.ceil(maior / passo) * passo;
        const y = (v) => m.t + alturaUtil - (v / topoEixo) * alturaUtil;
        const baseY = y(0);
        const faixa = larguraUtil / n;
        const largura = Math.max(3, Math.min(30, faixa * 0.64));
        const cx = (d) => m.l + faixa * (d - 0.5);

        let svg = '';
        for (let v = 0; v <= topoEixo; v += passo) {
            svg += `<line class="${v === 0 ? 'g-eixo' : 'g-grade'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
            svg += `<text class="g-texto" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${numeroBR(v)}</text>`;
        }

        /* colunas dos encerrados, coloridas pelo saldo do dia */
        for (let d = 1; d <= n; d++) {
            const ab = ev.abertos[d];
            const enc = ev.encerrados[d];
            if (!ab && !enc) continue;
            const cor = corDoDia(enc, ab);
            const x = cx(d) - largura / 2;
            if (enc > 0) {
                const topo = y(enc);
                svg += `<path class="g-${cor}" d="${barraTopo(x, topo, largura, baseY - topo, 3)}"/>`;
                if (faixa >= 24) svg += `<text class="g-valor-p" x="${cx(d)}" y="${topo - 5}" text-anchor="middle">${numeroBR(enc)}</text>`;
            } else {
                /* abriu e não encerrou nada: marca vermelha rente ao eixo */
                svg += `<rect class="g-atraso" x="${x}" y="${baseY - 3}" width="${largura}" height="3" rx="1"/>`;
            }
        }

        /* linha dos abertos */
        const pontos = [];
        for (let d = 1; d <= n; d++) pontos.push(`${cx(d).toFixed(1)},${y(ev.abertos[d]).toFixed(1)}`);
        if (pontos.length > 1) svg += `<path class="g-linha abertura" d="M${pontos.join('L')}"/>`;
        if (faixa >= 12 || n === 1) {
            for (let d = 1; d <= n; d++) svg += `<circle class="g-marca abertura" cx="${cx(d)}" cy="${y(ev.abertos[d])}" r="4"/>`;
        }

        /* números dos dias (o último sempre aparece; os vizinhos que encostariam nele somem) */
        const pular = Math.max(1, Math.ceil(22 / faixa));
        for (let d = 1; d <= n; d++) {
            const ultimo = d === n;
            if (!ultimo && ((d - 1) % pular || n - d < pular)) continue;
            svg += `<text class="g-texto" x="${cx(d)}" y="${H - m.b + 16}" text-anchor="middle">${d}</text>`;
        }

        /* áreas de passar o mouse, uma por dia */
        for (let d = 1; d <= n; d++) {
            svg += `<rect class="g-dia" data-d="${d}" x="${m.l + faixa * (d - 1)}" y="${m.t - 6}" width="${faixa}" height="${alturaUtil + 6}"/>`;
        }

        area.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Abertos e encerrados por dia em ${rotuloMesLongo(ev.mes)}">${svg}</svg>`;
    }

    function dicaDia(d, x, yTela) {
        const ev = estado.evolucao;
        if (!ev || !d || d > ev.dias) return;
        const data = new Date(ev.ano, ev.mm - 1, d);
        const ab = ev.abertos[d];
        const enc = ev.encerrados[d];
        const saldo = enc - ab;
        mostrarDica(`<strong>${DIAS_SEMANA[data.getDay()]}, ${doisDigitos(d)}/${doisDigitos(ev.mm)}/${ev.ano}</strong>` +
            linhaDica(`<i class="ponto ${corDoDia(enc, ab)}"></i>`, 'Encerrados', numeroBR(enc)) +
            linhaDica('<i class="traco abertura"></i>', 'Abertos', numeroBR(ab)) +
            linhaDica('', 'Saldo', `${saldo > 0 ? '+' : saldo < 0 ? '−' : ''}${numeroBR(Math.abs(saldo))}`), x, yTela);
    }

    /* ======================================================
       10. TABELA
    ====================================================== */

    const VALOR_ORDEM = {
        protocolo: (r) => r.protocolo,
        canal: (r) => r.canalNorm,
        cpf: (r) => r.cpf,
        nome: (r) => r.nome.toLowerCase(),
        email: (r) => r.email,
        setor: (r) => r.setor,
        ocorrencia: (r) => r.ocorrenciaNorm,
        abertura: (r) => r.chaveAbertura,
        previsao: (r) => chaveDia(r.previsao),
        prazo: (r) => PESO_PRAZO[r.prazoDet] * 100000 + r.dias
    };

    function atualizarTabela() {
        const termo = estado.busca.trim().toLowerCase();
        /* busca só com números (ex.: CPF com pontos): compara apenas os dígitos */
        const soNumeros = /^[\d.\-\s/]+$/.test(termo);
        const termoDigitos = soNumeros ? termo.replace(/\D/g, '') : '';
        let linhas = estado.filtrados;
        if (termo) {
            linhas = linhas.filter((r) => r.busca.includes(termo) || (termoDigitos.length >= 3 && r.busca.includes(termoDigitos)));
        }

        const { campo, direcao } = estado.ordem;
        const valor = VALOR_ORDEM[campo];
        estado.tabela = [...linhas].sort((a, b) => {
            const va = valor(a);
            const vb = valor(b);
            if (va < vb) return -direcao;
            if (va > vb) return direcao;
            return 0;
        });

        $('contadorTabela').textContent = numeroBR(estado.tabela.length);
        $('exportarExcel').disabled = estado.tabela.length === 0;
        desenharPagina();
    }

    /* o conteúdo vai num <span>: no celular a célula vira "rótulo | valor" */
    const celula = (rotulo, conteudo, classe = '') =>
        `<td data-rotulo="${rotulo}"${classe ? ` class="${classe}"` : ''}><span>${conteudo}</span></td>`;
    const traco = '<span class="fraco">—</span>';

    function desenharPagina() {
        const corpo = $('corpoTabela');
        const total = estado.tabela.length;
        const porPagina = estado.linhasPorPagina;
        const paginas = Math.max(1, Math.ceil(total / porPagina));
        estado.pagina = Math.min(estado.pagina, paginas - 1);
        const inicio = estado.pagina * porPagina;
        const pagina = estado.tabela.slice(inicio, inicio + porPagina);

        corpo.innerHTML = pagina.map((r, i) => `
            <tr>
                ${celula('Protocolo', escapar(r.protocolo) || traco, 'mono')}
                ${celula('Canal', r.canalNorm ? `<span title="${escapar(nomeBonito(r.canalNorm))}">${escapar(rotuloCanal(r.canalNorm))}</span>` : traco)}
                ${celula('CPF', escapar(r.cpf) || traco, 'mono')}
                ${celula('Beneficiário', r.nome ? `<span title="${escapar(r.nome)}">${escapar(r.nome)}</span>` : traco)}
                ${celula('E-mail', r.email ? `<span title="${escapar(r.email)}">${escapar(r.email)}</span>` : traco)}
                ${celula('Setor', `<span class="etiqueta-setor" title="${escapar(nomeBonito(r.setor))}">${escapar(nomeBonito(r.setor))}</span>`)}
                ${celula('Ocorrência', r.ocorrencia ? `<span title="${escapar(r.ocorrencia)}">${escapar(nomeBonito(r.ocorrencia))}</span>` : traco)}
                ${celula('Abertura', formatarData(r.abertura))}
                ${celula('Previsão', r.previsao ? formatarData(r.previsao) : traco)}
                ${celula('Status', `<span class="status ${r.prazoDet}" title="${r.dias} dia(s) útil(eis)${r.colaborador ? ` · encerrado por ${escapar(r.colaborador)}` : ''}">${ROTULO_PRAZO[r.prazoDet]}</span>` +
                    `<span class="situacao-texto">${r.pendente ? 'Pendente' : 'Encerrado'}</span>` +
                    (r.ajuda ? '<span class="marca-ajuda" title="O setor marcou no Kanban: precisando de ajuda">Ajuda</span>' : ''))}
                ${celula('Observação', r.observacao
                    ? `<button type="button" class="obs" data-indice="${inicio + i}" title="Ver observação completa">${escapar(r.observacao)}</button>`
                    : traco)}
            </tr>`).join('');

        const vazio = $('vazio');
        if (!estado.base.length) {
            vazio.hidden = false;
            $('vazioTitulo').textContent = 'Nenhuma planilha carregada';
            $('vazioTexto').innerHTML = 'Clique em <b>Importar</b> ou arraste o arquivo (.xlsx, .xls ou .csv) para esta janela.';
        } else if (!total) {
            vazio.hidden = false;
            $('vazioTitulo').textContent = 'Nenhum protocolo encontrado';
            $('vazioTexto').textContent = 'Nenhum protocolo passa nos filtros e na busca atuais.';
        } else {
            vazio.hidden = true;
        }

        $('infoPagina').textContent = total
            ? `${numeroBR(inicio + 1)}–${numeroBR(Math.min(inicio + porPagina, total))} de ${numeroBR(total)}`
            : '—';
        $('numeroPagina').textContent = total ? `${estado.pagina + 1} de ${numeroBR(paginas)}` : '—';
        $('paginaAnterior').disabled = estado.pagina === 0;
        $('proximaPagina').disabled = estado.pagina >= paginas - 1;

        document.querySelectorAll('.tabela th[data-ordem]').forEach((th) => {
            if (th.dataset.ordem === estado.ordem.campo) {
                th.setAttribute('aria-sort', estado.ordem.direcao > 0 ? 'ascending' : 'descending');
            } else {
                th.removeAttribute('aria-sort');
            }
        });
    }

    /* Quantas linhas cabem na área da tabela (no celular: 10 por página).
       ALTURA_LINHA = altura do td no CSS (36) + 1 px da borda. */
    const ALTURA_LINHA = 37;
    const ehCelular = () => window.matchMedia('(max-width: 759px)').matches;

    function calcularLinhasPorPagina() {
        let linhas = 10;
        if (!ehCelular()) {
            const area = $('tabelaArea');
            const cabecalho = area.querySelector('thead');
            /* desconta a barra de rolagem horizontal, se houver */
            const barra = area.offsetHeight - area.clientHeight;
            const disponivel = area.clientHeight - (cabecalho ? cabecalho.offsetHeight : 37) - (barra ? 0 : 0);
            linhas = Math.max(5, Math.floor(disponivel / ALTURA_LINHA));
        }
        if (linhas !== estado.linhasPorPagina) {
            /* mantém o primeiro registro visível ao mudar o tamanho */
            const primeiro = estado.pagina * estado.linhasPorPagina;
            estado.linhasPorPagina = linhas;
            estado.pagina = Math.floor(primeiro / linhas);
            desenharPagina();
        }
    }

    function abrirDetalhe(indice) {
        const r = estado.tabela[indice];
        if (!r) return;
        $('detalheProtocolo').textContent = r.protocolo || '—';
        const dados = [
            ['Setor', nomeBonito(r.setor)],
            ['Ocorrência', r.ocorrencia || '—'],
            ['Tipo', rotuloTipo(r.tipoNorm) || '—'],
            ['Canal', r.canal || '—'],
            ['Situação', r.pendente ? 'Pendente' : 'Encerrado'],
            ['Status (RN 623)', `${ROTULO_PRAZO[r.prazoDet]} · ${r.dias} dia(s) útil(eis)`],
            ['Abertura', formatarData(r.abertura)],
            ['Previsão', formatarData(r.previsao)],
            ['Encerramento', r.pendente ? '—' : formatarData(r.encerramento)],
            ['Colaborador', r.colaborador || '—'],
            ['Kanban', r.ajuda ? 'Precisando de ajuda' : '—'],
            ['CPF', r.cpf || '—'],
            ['E-mail', r.email || '—']
        ];
        $('detalheDados').innerHTML = dados.map(([t, v]) => `<div><dt>${t}</dt><dd>${escapar(v)}</dd></div>`).join('');
        $('detalheObs').textContent = r.observacao || '—';
        $('detalhe').showModal();
    }

    /* ======================================================
       11. EXPORTAÇÃO PARA EXCEL
       Exporta todos os protocolos da tabela (filtros + busca), não só a página,
       com as colunas pedidas pelo autor.
    ====================================================== */

    const textoStatus = (r) => `${r.pendente ? 'Pendente' : 'Encerrado'} · ${ROTULO_PRAZO[r.prazoDet]}` +
        (r.ajuda ? ' · Precisando de ajuda' : '');

    function exportarExcel() {
        if (!window.XLSX || !estado.tabela.length) return;

        const cabecalho = [
            'Protocolo', 'Canal', 'CPF', 'Beneficiário', 'E-mail', 'Setor', 'Ocorrência',
            'Data de abertura', 'Previsão para encerrar', 'Status', 'Observação de abertura'
        ];

        const linhas = estado.tabela.map((r) => [
            r.protocolo,
            r.canal || (r.canalNorm ? nomeBonito(r.canalNorm) : ''),
            r.cpf,
            r.nome || '',
            r.email,
            nomeBonito(r.setor),
            r.ocorrencia,
            r.abertura || '',
            r.previsao || '',
            textoStatus(r),
            r.observacao
        ]);

        const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas], { dateNF: 'dd/mm/yyyy' });
        planilha['!cols'] = [
            { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 38 }, { wch: 30 }, { wch: 18 },
            { wch: 40 }, { wch: 14 }, { wch: 20 }, { wch: 34 }, { wch: 80 }
        ];
        planilha['!autofilter'] = { ref: planilha['!ref'] };

        const livro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(livro, planilha, 'Protocolos');
        XLSX.writeFile(livro, `protocolos-inteligencia-de-rede-${paraInput(estado.hoje)}.xlsx`, { compression: true });

        avisar(`${numeroBR(linhas.length)} protocolos exportados.`);
    }

    /* ======================================================
       12. CONTROLES DO FILTRO
    ====================================================== */

    let ocorrenciasDisponiveis = [];

    function montarFiltros() {
        /* setor */
        const setores = [...new Set(estado.base.map((r) => r.setor))]
            .sort((a, b) => (a === NAO_CLASSIFICADO) - (b === NAO_CLASSIFICADO) || a.localeCompare(b, 'pt-BR'));
        $('filtroSetor').innerHTML = '<option value="">Todos</option>' +
            setores.map((s) => `<option value="${escapar(s)}">${escapar(nomeBonito(s))}</option>`).join('');

        /* colaborador (quem encerrou), do maior volume para o menor */
        const seletor = $('filtroColaborador');
        if (!estado.temColaborador) {
            seletor.innerHTML = '<option value="">Coluna USUARIO_ENCERRAMENTO_OCORRENCIA não encontrada</option>';
            seletor.disabled = true;
        } else {
            const contagem = new Map();
            let semNome = 0;
            for (const r of estado.base) {
                if (r.colaborador) contagem.set(r.colaborador, (contagem.get(r.colaborador) || 0) + 1);
                else semNome++;
            }
            seletor.disabled = false;
            seletor.innerHTML = '<option value="">Todos</option>' +
                [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
                    .map(([c, n]) => `<option value="${escapar(c)}">${escapar(c)} · ${numeroBR(n)}</option>`).join('') +
                (semNome ? `<option value="${SEM_COLABORADOR}">Sem colaborador (pendentes) · ${numeroBR(semNome)}</option>` : '');
        }

        /* canal de comunicação, do maior volume para o menor */
        const contagemCanais = new Map();
        estado.base.forEach((r) => { if (r.canalNorm) contagemCanais.set(r.canalNorm, (contagemCanais.get(r.canalNorm) || 0) + 1); });
        const canais = [...contagemCanais.entries()].sort((a, b) => b[1] - a[1]);
        $('chipsCanal').innerHTML = canais.length
            ? canais.map(([c, n]) =>
                `<button type="button" class="chip" data-canal="${escapar(c)}" aria-pressed="false" title="${escapar(nomeBonito(c))}">${escapar(rotuloCanal(c))} <small>${numeroBR(n)}</small></button>`).join('')
            : '<span class="pf-vazio">A planilha não tem a coluna de canal.</span>';

        /* ocorrências */
        const contagem = new Map();
        for (const r of estado.base) {
            if (!r.ocorrenciaNorm) continue;
            const atual = contagem.get(r.ocorrenciaNorm) || { nome: r.ocorrencia, total: 0 };
            atual.total++;
            contagem.set(r.ocorrenciaNorm, atual);
        }
        ocorrenciasDisponiveis = [...contagem.entries()]
            .map(([chave, v]) => ({ chave, nome: v.nome, total: v.total }))
            .sort((a, b) => b.total - a.total);
        desenharListaOcorrencias();
    }

    function desenharListaOcorrencias() {
        const termo = normalizar($('buscaOcorrencia').value);
        const selecionadas = estado.filtros.ocorrencias;
        const lista = ocorrenciasDisponiveis
            .filter((o) => !termo || o.chave.includes(termo))
            .sort((a, b) => selecionadas.has(b.chave) - selecionadas.has(a.chave) || b.total - a.total);

        $('listaOcorrencia').innerHTML = lista.length
            ? lista.map((o) => `
                <label class="opcao">
                    <input type="checkbox" value="${escapar(o.chave)}" ${selecionadas.has(o.chave) ? 'checked' : ''}>
                    <span title="${escapar(o.nome)}">${escapar(nomeBonito(o.nome))}</span>
                    <small>${numeroBR(o.total)}</small>
                </label>`).join('')
            : `<p class="vazio-pequeno">${estado.base.length ? 'Nenhuma ocorrência encontrada.' : 'Importe uma planilha.'}</p>`;
        $('contaOcorrencia').textContent = `${selecionadas.size} selecionada${selecionadas.size === 1 ? '' : 's'}`;
    }

    /* deixa os botões do painel iguais ao estado */
    function sincronizarControles() {
        const f = estado.filtros;
        document.querySelectorAll('#filtroSituacao button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.situacao === f.situacao)));
        document.querySelectorAll('#filtroPrazo .chip').forEach((b) => b.setAttribute('aria-pressed', String(f.prazos.has(b.dataset.prazo))));
        document.querySelectorAll('#chipsCanal .chip').forEach((b) => b.setAttribute('aria-pressed', String(f.canais.has(b.dataset.canal))));
        $('filtroAjuda').setAttribute('aria-pressed', String(f.ajuda));
        $('filtroSetor').value = f.setor;
        if (!$('filtroColaborador').disabled) $('filtroColaborador').value = f.colaborador;
        $('periodoDe').value = paraInput(f.de);
        $('periodoAte').value = paraInput(f.ate);
        $('contaOcorrencia').textContent = `${f.ocorrencias.size} selecionada${f.ocorrencias.size === 1 ? '' : 's'}`;
    }

    /* Linha "filtros em uso": cada filtro vira uma etiqueta com ×. */
    let etiquetasAtivas = [];

    function desenharFiltrosAtivos() {
        const f = estado.filtros;
        const lista = [];
        if (f.situacao) lista.push(['Situação', f.situacao === 'pendente' ? 'Pendentes' : 'Encerrados', () => { f.situacao = ''; }]);
        for (const p of ['ok', 'atencao4', 'atencao5', 'atraso']) {
            if (f.prazos.has(p)) lista.push(['Prazo', ROTULO_PRAZO[p], () => { f.prazos.delete(p); }]);
        }
        if (f.ajuda) lista.push(['Kanban', 'Precisando de ajuda', () => { f.ajuda = false; }]);
        if (f.setor) lista.push(['Setor', nomeBonito(f.setor), () => { f.setor = ''; }]);
        if (f.colaborador) lista.push(['Colaborador', f.colaborador === SEM_COLABORADOR ? 'Sem colaborador' : f.colaborador, () => { f.colaborador = ''; }]);
        for (const c of f.canais) lista.push(['Canal', rotuloCanal(c), () => { f.canais.delete(c); }]);
        if (f.de || f.ate) {
            lista.push(['Abertura', `${f.de ? formatarDataCurta(f.de) : 'início'} – ${f.ate ? formatarDataCurta(f.ate) : 'hoje'}`, () => { f.de = null; f.ate = null; }]);
        }
        if (f.ocorrencias.size) {
            const unica = f.ocorrencias.size === 1 ? ocorrenciasDisponiveis.find((o) => f.ocorrencias.has(o.chave)) : null;
            lista.push(['Ocorrência', unica ? nomeBonito(unica.nome) : `${f.ocorrencias.size} selecionadas`, () => { f.ocorrencias.clear(); desenharListaOcorrencias(); }]);
        }

        etiquetasAtivas = lista;
        const area = $('filtrosAtivos');
        area.hidden = !lista.length;
        area.innerHTML = lista.map(([rotulo, valor], i) => `
            <span class="filtro-ativo"><b>${escapar(rotulo)}:</b> ${escapar(valor)}
                <button type="button" data-i="${i}" aria-label="Remover filtro ${escapar(rotulo)} ${escapar(valor)}">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
                </button>
            </span>`).join('') +
            (lista.length > 1 ? '<button type="button" class="link" data-limpar>Limpar tudo</button>' : '');

        const selo = $('contaFiltros');
        selo.hidden = !lista.length;
        selo.textContent = lista.length;
    }

    function abrirFiltro(abrir) {
        $('painelFiltro').hidden = !abrir;
        $('botaoFiltro').setAttribute('aria-expanded', String(abrir));
    }

    function aplicarAtalho(atalho) {
        const hoje = estado.hoje;
        const menosDias = (n) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
        const f = estado.filtros;
        if (atalho === 'hoje') { f.de = hoje; f.ate = hoje; }
        else if (atalho === '7') { f.de = menosDias(6); f.ate = hoje; }
        else if (atalho === '30') { f.de = menosDias(29); f.ate = hoje; }
        else if (atalho === 'mes') { f.de = new Date(hoje.getFullYear(), hoje.getMonth(), 1); f.ate = hoje; }
        else { f.de = null; f.ate = null; }
        atualizarTudo();
    }

    function limparFiltros() {
        estado.filtros = filtrosVazios();
        estado.busca = '';
        $('buscaTabela').value = '';
        $('buscaOcorrencia').value = '';
        desenharListaOcorrencias();
        atualizarTudo();
    }

    /* ======================================================
       13. "PRECISANDO DE AJUDA" DO KANBAN
       O Kanban guarda os cartões no IndexedDB deste navegador
       (nexus_v2_kanban, store "cartoes", chave [protocolo, num. ocorrência]).
       Aqui eu só leio. Se o banco ainda não existe, crio as mesmas
       stores que o Kanban criaria, para não atrapalhar ele depois.
    ====================================================== */

    const BANCO_KANBAN = 'nexus_v2_kanban';

    function lerCartoesKanban() {
        return new Promise((resolve) => {
            if (!('indexedDB' in window)) { resolve([]); return; }
            let pedido;
            try { pedido = indexedDB.open(BANCO_KANBAN); } catch (e) { resolve([]); return; }
            pedido.onupgradeneeded = () => {
                const db = pedido.result;
                if (!db.objectStoreNames.contains('cartoes')) db.createObjectStore('cartoes', { keyPath: 'chave' });
                if (!db.objectStoreNames.contains('config')) db.createObjectStore('config', { keyPath: 'id' });
            };
            pedido.onerror = () => resolve([]);
            pedido.onblocked = () => resolve([]);
            pedido.onsuccess = () => {
                const db = pedido.result;
                if (!db.objectStoreNames.contains('cartoes')) { db.close(); resolve([]); return; }
                try {
                    const leitura = db.transaction('cartoes', 'readonly').objectStore('cartoes').getAll();
                    leitura.onsuccess = () => { db.close(); resolve(leitura.result || []); };
                    leitura.onerror = () => { db.close(); resolve([]); };
                } catch (e) { db.close(); resolve([]); }
            };
        });
    }

    let lendoKanban = false;

    async function atualizarAjudaKanban() {
        if (!estado.base.length || lendoKanban) return;
        lendoKanban = true;
        try {
            const cartoes = await lerCartoesKanban();
            const chaves = new Set();
            const protocolos = new Set();
            for (const c of cartoes) {
                if (c?.tratativa?.etapa !== 'ajuda') continue;
                chaves.add(c.chave);
                try { protocolos.add(String(JSON.parse(c.chave)[0])); } catch (e) { if (c.protocolo) protocolos.add(String(c.protocolo)); }
            }
            let mudou = false;
            for (const r of estado.base) {
                /* sem a coluna do número da ocorrência, vale o protocolo */
                const ajuda = r.chaveKanban ? chaves.has(r.chaveKanban) : protocolos.has(r.protocolo);
                if (ajuda !== r.ajuda) { r.ajuda = ajuda; mudou = true; }
            }
            if (mudou) atualizarTudo();
        } finally {
            lendoKanban = false;
        }
    }

    /* ======================================================
       14. IMPORTAÇÃO
    ====================================================== */

    function mostrarCarregando(sim, mensagem) {
        $('carregando').hidden = !sim;
        if (mensagem) $('carregandoTexto').textContent = mensagem;
    }

    let fimAviso = null;
    function avisar(mensagem, erro = false) {
        const aviso = $('avisoFlutuante');
        aviso.textContent = mensagem;
        aviso.classList.toggle('erro', erro);
        aviso.hidden = false;
        clearTimeout(fimAviso);
        fimAviso = setTimeout(() => { aviso.hidden = true; }, erro ? 7000 : 3500);
    }

    function carregarRegistros(linhas, nomeArquivo) {
        const colunas = resolverColunas(Object.keys(linhas[0]));
        const faltando = CAMPOS_OBRIGATORIOS.filter((c) => !colunas[c]);
        if (faltando.length) {
            throw new Error(`Colunas não encontradas: ${faltando.map((c) => CAMPOS[c][0]).join(', ')}.`);
        }

        estado.hoje = dataHoje();
        estado.base = prepararRegistros(linhas, colunas, estado.hoje);
        estado.nomeArquivo = nomeArquivo;
        estado.temColaborador = Boolean(colunas.colaborador);
        estado.filtros = filtrosVazios();
        estado.diario = { mes: 0 };
        estado.busca = '';
        $('buscaTabela').value = '';
        $('buscaOcorrencia').value = '';

        /* mês de referência = o mais recente da planilha (abertura ou encerramento) */
        estado.mesRef = estado.base.reduce((m, r) => Math.max(m, r.mesAbertura, r.mesEncerramento), 0);

        const maisRecente = estado.base.reduce((m, r) => (r.abertura && (!m || r.abertura > m) ? r.abertura : m), null);
        $('infoBase').innerHTML = `${escapar(nomeArquivo)} · <strong>${numeroBR(estado.base.length)}</strong> ocorrências · dados até <strong>${formatarData(maisRecente)}</strong>`;
        $('chipBase').hidden = false;
        $('chipBase').title = `Planilha: ${nomeArquivo}`;

        montarFiltros();
        atualizarTudo();
        calcularLinhasPorPagina();
        atualizarAjudaKanban();
        return colunas;
    }

    function importarArquivo(arquivo) {
        if (!arquivo) return;
        if (!/\.(xlsx|xls|csv)$/i.test(arquivo.name)) {
            avisar('Formato não aceito. Use .xlsx, .xls ou .csv.', true);
            return;
        }
        if (!window.XLSX) {
            avisar('A biblioteca de leitura de Excel não carregou (LIB/xlsx-0.20.3.full.min.js).', true);
            return;
        }

        mostrarCarregando(true, arquivo.name);
        const leitor = new FileReader();
        leitor.onerror = () => { mostrarCarregando(false); avisar('Não foi possível ler o arquivo.', true); };
        leitor.onload = () => {
            /* deixa a tela de "carregando" aparecer antes do trabalho pesado */
            setTimeout(() => {
                try {
                    const livro = XLSX.read(leitor.result, { type: 'array', cellDates: false });
                    const folha = livro.Sheets[livro.SheetNames[0]];
                    const linhas = XLSX.utils.sheet_to_json(folha, { defval: '', raw: true });
                    if (!linhas.length) throw new Error('A planilha está vazia.');

                    const colunas = carregarRegistros(linhas, arquivo.name);
                    const semColuna = ['protocolo', 'cpf', 'email', 'status', 'previsao', 'observacao', 'canal', 'colaborador']
                        .filter((c) => !colunas[c]);
                    avisar(semColuna.length
                        ? `Planilha carregada, mas sem as colunas: ${semColuna.map((c) => CAMPOS[c][0]).join(', ')}.`
                        : `${numeroBR(estado.base.length)} ocorrências carregadas.`, semColuna.length > 0);
                } catch (erro) {
                    console.error(erro);
                    avisar(`Erro ao ler a planilha: ${erro.message}`, true);
                } finally {
                    mostrarCarregando(false);
                    $('arquivoExcel').value = '';
                }
            }, 30);
        };
        leitor.readAsArrayBuffer(arquivo);
    }

    /* ======================================================
       15. EVENTOS
    ====================================================== */

    function ligarEventos() {
        $('arquivoExcel').addEventListener('change', (e) => importarArquivo(e.target.files[0]));

        /* arrastar e soltar a planilha em qualquer lugar da janela */
        let contadorArraste = 0;
        window.addEventListener('dragenter', (e) => {
            if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
            e.preventDefault();
            contadorArraste++;
            $('soltar').hidden = false;
        });
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('dragleave', () => {
            contadorArraste = Math.max(0, contadorArraste - 1);
            if (!contadorArraste) $('soltar').hidden = true;
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            contadorArraste = 0;
            $('soltar').hidden = true;
            importarArquivo(e.dataTransfer.files[0]);
        });

        /* painel do filtro */
        $('botaoFiltro').addEventListener('click', () => abrirFiltro($('painelFiltro').hidden));
        $('fecharFiltro').addEventListener('click', () => abrirFiltro(false));
        document.addEventListener('click', (e) => {
            if ($('painelFiltro').hidden) return;
            if (!e.target.closest('.filtro-geral')) abrirFiltro(false);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !$('painelFiltro').hidden) { abrirFiltro(false); $('botaoFiltro').focus(); }
        });

        $('filtroSituacao').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-situacao]');
            if (!b) return;
            estado.filtros.situacao = b.dataset.situacao;
            atualizarTudo();
        });
        $('filtroPrazo').addEventListener('click', (e) => {
            const b = e.target.closest('[data-prazo]');
            if (!b) return;
            const p = estado.filtros.prazos;
            if (p.has(b.dataset.prazo)) p.delete(b.dataset.prazo); else p.add(b.dataset.prazo);
            atualizarTudo();
        });
        $('filtroAjuda').addEventListener('click', () => { estado.filtros.ajuda = !estado.filtros.ajuda; atualizarTudo(); });
        $('filtroSetor').addEventListener('change', (e) => { estado.filtros.setor = e.target.value; atualizarTudo(); });
        $('filtroColaborador').addEventListener('change', (e) => { estado.filtros.colaborador = e.target.value; atualizarTudo(); });
        $('chipsCanal').addEventListener('click', (e) => {
            const chip = e.target.closest('[data-canal]');
            if (!chip) return;
            const c = estado.filtros.canais;
            if (c.has(chip.dataset.canal)) c.delete(chip.dataset.canal); else c.add(chip.dataset.canal);
            atualizarTudo();
        });
        $('periodoDe').addEventListener('change', (e) => { estado.filtros.de = deInput(e.target.value); atualizarTudo(); });
        $('periodoAte').addEventListener('change', (e) => { estado.filtros.ate = deInput(e.target.value); atualizarTudo(); });
        $('atalhosPeriodo').addEventListener('click', (e) => {
            const b = e.target.closest('[data-atalho]');
            if (b && estado.hoje) aplicarAtalho(b.dataset.atalho);
        });
        $('buscaOcorrencia').addEventListener('input', desenharListaOcorrencias);
        $('listaOcorrencia').addEventListener('change', (e) => {
            const caixa = e.target;
            if (caixa.type !== 'checkbox') return;
            if (caixa.checked) estado.filtros.ocorrencias.add(caixa.value);
            else estado.filtros.ocorrencias.delete(caixa.value);
            atualizarTudo();
        });
        $('limparFiltros').addEventListener('click', limparFiltros);

        /* etiquetas de filtros em uso */
        $('filtrosAtivos').addEventListener('click', (e) => {
            if (e.target.closest('[data-limpar]')) { limparFiltros(); return; }
            const b = e.target.closest('button[data-i]');
            if (!b) return;
            const item = etiquetasAtivas[Number(b.dataset.i)];
            if (item) { item[2](); atualizarTudo(); }
        });

        /* indicadores clicáveis */
        document.querySelector('.indicadores').addEventListener('click', (e) => {
            const b = e.target.closest('button.ind[data-ind]');
            if (b) clicarIndicador(b.dataset.ind);
        });

        /* gráfico do IR: dica */
        $('graficoIR').addEventListener('mousemove', (e) => {
            const linha = e.target.closest('.ir-linha');
            if (!linha) { esconderDica(); return; }
            const enc = Number(linha.dataset.encerrados);
            const prazo = Number(linha.dataset.prazo);
            mostrarDica(`<strong>${rotuloMes(Number(linha.dataset.mes))}</strong>` +
                linhaDica('', 'Encerrados', numeroBR(enc)) +
                linhaDica('', 'No prazo', numeroBR(prazo)) +
                linhaDica('', 'Fora do prazo', numeroBR(enc - prazo)) +
                linhaDica('', 'IR', enc ? `${decimalBR((prazo / enc) * 100)}%` : '—'), e.clientX, e.clientY);
        });
        $('graficoIR').addEventListener('mouseleave', esconderDica);

        /* gráfico dos setores: dica e clique para filtrar */
        const setores = $('setoresLista');
        setores.addEventListener('mousemove', (e) => {
            const g = e.target.closest('.g-coluna');
            if (g) dicaSetor(Number(g.dataset.i), e.clientX, e.clientY); else esconderDica();
        });
        setores.addEventListener('mouseleave', esconderDica);
        setores.addEventListener('click', (e) => {
            const g = e.target.closest('.g-coluna');
            if (g) alternarSetor(Number(g.dataset.i));
        });
        setores.addEventListener('keydown', (e) => {
            const g = e.target.closest('.g-coluna');
            if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); alternarSetor(Number(g.dataset.i)); }
        });

        /* gráfico dos encerrados por prazo: dica */
        const prazos = $('graficoPrazos');
        prazos.addEventListener('mousemove', (e) => {
            const g = e.target.closest('.g-coluna');
            if (g) dicaPrazo(Number(g.dataset.i), e.clientX, e.clientY); else esconderDica();
        });
        prazos.addEventListener('mouseleave', esconderDica);

        /* gráfico por dia: dica de cada dia e seletores de mês */
        const evolucao = $('graficoEvolucao');
        evolucao.addEventListener('mousemove', (e) => {
            const dia = e.target.closest('.g-dia');
            if (dia) dicaDia(Number(dia.dataset.d), e.clientX, e.clientY); else esconderDica();
        });
        evolucao.addEventListener('mouseleave', esconderDica);
        $('mesDiario').addEventListener('change', (e) => {
            estado.diario.mes = Number(e.target.value);
            desenharEvolucao();
        });

        /* tabela */
        let esperaBusca = null;
        $('buscaTabela').addEventListener('input', (e) => {
            clearTimeout(esperaBusca);
            esperaBusca = setTimeout(() => { estado.busca = e.target.value; estado.pagina = 0; atualizarTabela(); }, 150);
        });
        document.querySelector('.tabela thead').addEventListener('click', (e) => {
            const th = e.target.closest('th[data-ordem]');
            if (!th) return;
            const campo = th.dataset.ordem;
            estado.ordem = {
                campo,
                direcao: estado.ordem.campo === campo ? -estado.ordem.direcao : (campo === 'abertura' || campo === 'prazo' ? -1 : 1)
            };
            estado.pagina = 0;
            atualizarTabela();
        });
        $('corpoTabela').addEventListener('click', (e) => {
            const obs = e.target.closest('.obs');
            if (obs) abrirDetalhe(Number(obs.dataset.indice));
        });
        $('paginaAnterior').addEventListener('click', () => { estado.pagina--; desenharPagina(); });
        $('proximaPagina').addEventListener('click', () => { estado.pagina++; desenharPagina(); });
        $('exportarExcel').addEventListener('click', exportarExcel);

        $('fecharDetalhe').addEventListener('click', () => $('detalhe').close());
        $('detalhe').addEventListener('click', (e) => { if (e.target === $('detalhe')) $('detalhe').close(); });

        /* o setor pode ter mexido no Kanban em outra aba: releio ao voltar */
        window.addEventListener('focus', atualizarAjudaKanban);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarAjudaKanban(); });

        /* gráficos e tabela se refazem quando o tamanho muda */
        /* no desktop a altura dos gráficos acompanha a janela, então confiro largura e altura */
        const tamanhos = {};
        const mudou = (id) => {
            const el = $(id);
            const t = `${el.clientWidth}x${el.clientHeight}`;
            if (tamanhos[id] === t) return false;
            tamanhos[id] = t;
            return true;
        };
        const redesenhar = () => {
            if (mudou('setoresLista')) desenharColunasSetores();
            if (mudou('graficoEvolucao')) desenharLinhasEvolucao();
            if (mudou('graficoPrazos')) desenharColunasPrazos();
            calcularLinhasPorPagina();
        };
        if ('ResizeObserver' in window) {
            const observador = new ResizeObserver(() => requestAnimationFrame(redesenhar));
            ['setoresLista', 'graficoEvolucao', 'graficoPrazos', 'tabelaArea'].forEach((id) => observador.observe($(id)));
        }
        /* reforço: o ResizeObserver fica pausado quando a aba está em segundo plano */
        let esperaRedimensionar = null;
        window.addEventListener('resize', () => {
            clearTimeout(esperaRedimensionar);
            esperaRedimensionar = setTimeout(() => { redesenhar(); realinharBloco(); }, 120);
        });
        window.addEventListener('scroll', esconderDica, { passive: true });
    }

    /* ======================================================
       16. INÍCIO
    ====================================================== */

    /* Quando a janela muda de tamanho, a altura dos blocos muda e a rolagem
       pode ficar no meio de um bloco: volto para o início do bloco mais próximo. */
    function realinharBloco() {
        if (getComputedStyle(document.documentElement).scrollSnapType.indexOf('y') === -1) return;
        const atual = window.scrollY;
        let melhor = 0;
        document.querySelectorAll('.bloco').forEach((b) => {
            if (Math.abs(b.offsetTop - atual) < Math.abs(melhor - atual)) melhor = b.offsetTop;
        });
        if (Math.abs(melhor - atual) > 1) window.scrollTo(0, melhor);
    }

    function iniciar() {
        /* sem isso o navegador devolve a rolagem antiga ao recarregar, no meio de um bloco */
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        estado.hoje = dataHoje();
        document.title = 'Visão operacional · Inteligência de Rede | PRISMA';
        ligarEventos();
        montarFiltros();
        atualizarTudo();
        calcularLinhasPorPagina();
    }

    iniciar();
})();
