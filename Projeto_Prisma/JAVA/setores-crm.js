/* ==========================================================
   PRISMA — CLASSIFICAÇÃO DE SETORES DO CRM (compartilhada)
   Eu tirei estas regras de dentro do inteligencia.js (18/11/2026) para a
   Inteligência de Rede e o Estudo de reclamações usarem exatamente a mesma
   classificação. Qualquer ajuste de setor é feito só aqui.
   Uso: window.PrismaSetores.classificarSetor(assunto, grupo, ocorrencia, setorDaPlanilha)
   (os três primeiros já normalizados: maiúsculas, sem acento).
   ========================================================== */

(() => {
    'use strict';

    function normalizar(valor) {
        return String(valor ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
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

    window.PrismaSetores = Object.freeze({ classificarSetor, NAO_CLASSIFICADO, normalizar });
})();