import type { ProcessData } from '../src/types';
import {
  plainPersonName,
  type AcademicDegree,
  type CommitteeTreatment,
} from '../src/utils/personPresentation';

type Person = { nome: string; instituicao?: string; tratamento?: string; titulacao?: string };
type Evidence = {
  name: string;
  protocols: readonly number[];
  displayName?: string;
  institution?: string;
  treatment?: CommitteeTreatment;
  degree?: AcademicDegree;
};

// Apply reviewed fields to the specified defenses and preserve the historical
// affiliation and titles when the record already gives them.
const evidence: readonly Evidence[] = [
  // UFES ProfSaúde and the state health council's 2013 resolution.
  // https://profsaude.ufes.br/docentes
  // https://saude.es.gov.br/Media/CIB/RES%202013/Resolu%C3%A7%C3%A3o%20043-2013.pdf
  {name:'Thiago Dias Sarti', protocols:[93], treatment:'Professor', degree:'Doutor', institution:'UFES'},

  // https://saudecoletiva.ufes.br/pt-br/acoes-de-internacionalizacao
  {name:'Francis Sodré', protocols:[87, 94], treatment:'Professora', degree:'Doutora', institution:'UFES'},

  // https://recien.com.br/index.php/Recien/article/download/176/179/178
  {name:'Wânia Ribeiro Trindade', protocols:[52, 56, 75], treatment:'Professora', degree:'Mestra'},

  // https://unipampa.edu.br/uruguaiana/docente/18765/dados-gerais
  // https://www.escavador.com/sobre/7524257/gracielle-karla-pampolim-abreu
  {name:'Gracielle Karla Pampolim Abreu', protocols:[57, 58, 59], treatment:'Professora', degree:'Doutora'},

  // https://epidemio-ufpel.org.br/dissertacoes/apoio-financeiro-e-de-cuidado-em-idosos-associacao-com-caracteristicasdemograficas-socioeconomicas-e-de-situacao-de-saude-em-2008-e-2016/
  // https://institucional.ufpel.edu.br/cursos/cod/8082
  {name:'Bruna Venturin', protocols:[57, 58, 59], treatment:'Senhora', degree:'Mestra'},

  // The defense of his master's thesis took place after these examinations.
  // https://www.ppgendocrino.medicina.ufrj.br/destaque/defesas/788-efesa-de-dissertacao-de-mestrado-lucas-dalvi-armond-rezende
  // https://www.escavador.com/sobre/560402131/lucas-dalvi-armond-rezende
  {name:'Lucas Dalvi Armond Rezende', protocols:[4, 5, 6, 7], treatment:'Professor', degree:'Especialista'},
  {name:'Lucas Dalvi Armond Rezende', protocols:[28, 43], treatment:'Senhor', institution:'UFRJ'},

  // City teaching plan lists her on the faculty. The service act confirms spelling.
  // https://www.vitoria.es.gov.br/download.php?id=1851&tipo=1
  // https://m.vitoria.es.gov.br/download.php?id=4422&tipo=1
  {name:'Cilia Zucolotti', protocols:[23, 41, 72, 91], displayName:'Cília Zucolotti', treatment:'Professora'},

  // https://teses.usp.br/teses/disponiveis/7/7139/tde-22112024-164736/pt-br.html
  {name:'Aline de Oliveira Ramalho', protocols:[26], treatment:'Senhora', degree:'Mestra'},
  {name:'Aline de Oliveira Ramalho', protocols:[76], treatment:'Senhora'},

  // https://www.escavador.com/sobre/7475860/joao-paulo-cola
  // https://rbmfc.org.br/rbmfc/article/download/3347/1827/20418
  {name:'João Paulo Cola', protocols:[1], treatment:'Professor', degree:'Doutor'},
  {name:'João Paulo Cola', protocols:[72], treatment:'Senhor', degree:'Mestre'},

  // https://saudecoletiva.ufes.br/pt-br/pos-graduacao/PPGSC/teses-defendidas?order=T%C3%ADtulo&page=2&sort=asc
  {name:'Fernanda Garcia Gabira Miguez', protocols:[2, 101], treatment:'Senhora', degree:'Doutora'},

  // https://enfermagem.vitoria.ufes.br/pt-br/pos-graduacao/PPGENF/detalhes-de-pessoal-discente?id=671733
  {name:'Anna Luiza Zandonadi Falchetto Nunes', protocols:[8], treatment:'Senhora', degree:'Mestra'},
  {name:'Anna Luiza Zandonadi Falchetto Nunes', protocols:[33], treatment:'Senhora'},

  // https://sig.unilab.edu.br/sigaa/public/departamento/professores.jsf?id=26
  {name:'Maria Girlane Sousa Albuquerque Brandão', protocols:[5], treatment:'Professora', degree:'Doutora'},

  // https://www.escavador.com/sobre/4802632/daniela-vieira-malta
  {name:'Daniela Vieira Malta', protocols:[92], treatment:'Professora', degree:'Doutora'},

  // https://guiadefontes.ufes.br/fontes?page=141
  // https://cepad.ufes.br/equipe
  {name:'Marcos Vinicius Ferreira dos Santos', protocols:[44], displayName:'Marcos Vinícius Ferreira dos Santos', treatment:'Professor', degree:'Doutor'},

  // https://www.escavador.com/sobre/3160884/dherik-fraga-santos
  {name:'Dherik Fraga Santos', protocols:[79, 81], treatment:'Senhor', degree:'Doutor'},

  // https://sigaa.ufcg.edu.br/sigaa/public/docente/pesquisa.jsf?siape=1069957
  // https://www.escavador.com/sobre/7096618/renan-alves-silva
  {name:'Renan Alves Silva', protocols:[62, 76], treatment:'Professor', degree:'Doutor'},

  // https://repositorio.ufes.br/server/api/core/bitstreams/30e55f3f-e8b2-4cbc-93bd-404e42e57415/content
  // https://progep.ufes.br/sites/progep.ufes.br/files/field/anexo/hucam.pdf
  // https://saudecoletiva.ufes.br/pt-br/pos-graduacao/PPGSC/detalhes-da-tese?id=17209
  {name:'Karina Fardin Fiorotti', protocols:[81], treatment:'Senhora', degree:'Mestra', institution:'HUCAM'},
  {name:'Karina Fardin Fiorotti', protocols:[101], treatment:'Senhora', degree:'Doutora'},

  // https://enfermagem.vitoria.ufes.br/en/pos-graduacao/PPGENF/thesis-details?id=23383
  // https://m.vitoria.es.gov.br/download.php?id=1851&tipo=1
  {name:'Gabriela Montebeller', protocols:[100], treatment:'Professora', degree:'Mestra'},

  // https://www.escavador.com/sobre/7265894/danielle-grillo-pacheco-lyra
  {name:'Danielle Grillo Pacheco Lyra', protocols:[100], treatment:'Senhora', degree:'Especialista'},

  // https://repositorio.ufes.br/server/api/core/bitstreams/48dbd37d-baf5-4aa5-a022-00ad22592aec/content
  {name:'Vitória Andrade Rodrigues Moreira', protocols:[102], treatment:'Senhora', degree:'Mestra', institution:'PPGSC/UFES'},

  // https://enfermagem.vitoria.ufes.br/pt-br/aprovacoes-em-residencias-concursos-e-etc
  // https://periodicoscientificos.ufmt.br/ojs/index.php/rebeh/article/download/19262/15024/94858
  {name:'Rafael Soares Nogueira', protocols:[108], treatment:'Senhor'},

  // https://revistanursing.com.br/index.php/revistanursing/article/view/632
  {name:'Priscila Silva Machado', protocols:[92], displayName:'Priscilla Silva Machado', treatment:'Senhora'},

  // https://www.coren-es.org.br/wp-content/uploads/2025/04/PARECER-CTSM-No-006-2025.pdf
  // The Portal's other record confirms the specialization. The council and
  // conference proceedings place her in municipal mental health around this defense.
  // https://www.congresso2026.abrasme.org.br/trabalho/view?q=eyJwYXJhbXMiOiJ7XCJJRF9UUkFCQUxIT1wiOlwiOTUyXCJ9IiwiaCI6IjliMmFiYWUwNmRjYjIwOTNkOTllNzBiMTJkYjNlZDc1In0%3D
  {name:'Luziani Santana Boostel Sena', protocols:[106], treatment:'Senhora', degree:'Especialista', institution:'CAPS III'},

  // https://repositorio.ufes.br/server/api/core/bitstreams/b596ef11-d983-416d-90b8-456cd0981df9/content
  {name:'Marcos Vinicius da Silva Cordeiro', protocols:[97], treatment:'Senhor', degree:'Mestre'},

  // https://sappg.ufes.br/tese_drupal/tese_14416_Doc%20Resumo%20Jon.pdf
  {name:'Jonathan Grassi Rodigues', protocols:[88], displayName:'Jonathan Grassi Rodrigues', treatment:'Senhor'},

  // https://enfermagem.vitoria.ufes.br/pt-br/pos-graduacao/PPGENF/disserta%C3%A7%C3%B5es-defendidas?page=1
  {name:'Susana Lamara Pedras', protocols:[85], displayName:'Susana Lamara Pedras Almeida', treatment:'Senhora', degree:'Mestra'},

  // https://saudecoletiva.ufes.br/pt-br/pos-graduacao/PPGSC/detalhes-de-pessoal-discente?id=418282
  // https://www.escavador.com/sobre/7764890/maycon-carvalho-dos-santos
  {name:'Maycon Carvalho dos Santos', protocols:[84], treatment:'Professor', degree:'Mestre'},

  // https://www.escavador.com/sobre/492907691/raphael-manhes-pessanha
  {name:'Ms. Enf. Raphael Manhães Pessanha', protocols:[15], displayName:'Raphael Manhães Pessanha', treatment:'Senhor', degree:'Mestre'},

  // https://fonoaudiologia.ufes.br/corpo-docente
  {name:'Larissa Helyne Bassan', protocols:[13], institution:'UFES'},

  // https://www.escavador.com/sobre/3771669/greyce-pollyne-santos-silva
  // https://orcid.org/0000-0003-0935-9098
  {name:'Greyce Pollyne Santos Silva Minarini', protocols:[25], treatment:'Professora', degree:'Mestra'},
  // https://www.escavador.com/sobre/7635481/rayane-cristina-faria-de-souza
  {name:'Rayane Cristina Faria de Souza', protocols:[44, 98], treatment:'Professora', degree:'Doutora'},

  // https://repositorio.ufes.br/server/api/core/bitstreams/7b1dbb90-0d17-4a7f-a4fc-3cd1a4797456/content
  // https://www.escavador.com/sobre/8710096/isabel-de-souza-netto-daroz
  {name:'Isabel de Souza Netto', protocols:[64], treatment:'Professora', degree:'Mestra'},

  // https://saofrancisco.ifes.edu.br/index.php/pit-plano-individual-de-trabalho?showall=1
  {name:'Hiata Anderson Silva do Nascimento', protocols:[40], treatment:'Professor', degree:'Doutor'},

  // https://www.escavador.com/sobre/3624247/fabiola-zanetti-resende
  {name:'Fabíola Zanetti Resende', protocols:[13], treatment:'Senhora', degree:'Mestra'},

  // https://www.souenfermagem.com.br/wp-content/uploads/2023/04/anotacao-de-enfermagem.pdf
  // https://www.researchgate.net/profile/Camila-Lopes-17
  {name:'Camila Takao Lopes', protocols:[62], treatment:'Professora', degree:'Doutora', institution:'UNIFESP'},

  // https://siarq.ufrj.br/wp-content/uploads/2025/01/Compilado-semanal-48-2024.pdf
  {name:'Juliana da Fonseca Bezerra', protocols:[27], treatment:'Professora'},

  // https://repositorio.ufes.br/server/api/core/bitstreams/00fe9510-1721-4aa0-92c8-6b6e670ae5e7/content
  // https://www.escavador.com/sobre/5466370/andressa-tomazini-borghardt
  {name:'Andressa Tomazini Borghardt', protocols:[77], treatment:'Senhora', degree:'Mestra'},

  // At this defense she was enrolled in the UFES master's program.
  // https://saudecoletiva.ufes.br/pt-br/pos-graduacao/PPGSC/detalhes-de-pessoal-discente?id=610873
  {name:"Naira Santos D'Agostini", protocols:[105], treatment:'Senhora', institution:'PPGSC/UFES'},

  // https://inscricoes-cbcenf.cofen.gov.br/anais/18/22183/trabalhoresumo
  {name:'Catrine Storch Moitinho', protocols:[19], treatment:'Senhora'},
  // https://repositorio.ufes.br/server/api/core/bitstreams/a427646d-2abd-4f5b-bf0a-56dbccdd384a/content
  // https://santateresa.ifes.edu.br/ensino/coordenadoria-geral-de-assistencia-a-comunidade?start=1
  {name:'Nathália Miguel Teixeira Santana', protocols:[2, 95], treatment:'Senhora', degree:'Mestra', institution:'IFES'},

  // https://repositorio.ufes.br/server/api/core/bitstreams/1cde20eb-22e4-490d-a35f-5991acbcb517/content
  {name:'Lorena Souza Rittberg Mauricio', protocols:[3], treatment:'Senhora', degree:'Mestra'},

  // https://www.gov.br/hubrasil/pt-br/composicao/hospitais-universitarios/hucam-ufes/superintendencia/setor-de-gestao-da-qualidade/unidade-de-gestao-da-qualidade-e-seguranca-do-paciente/hilmara-aparecida-jesus-maioli/%40%40download
  {name:'Hilmara Aparecida Jesus Maioli', protocols:[47], treatment:'Senhora', degree:'Especialista'},

  // https://sejus.es.gov.br/Media/Sejus/Arquivos%20PDF/Banca%20Julgadora.pdf
  {name:'Tatiane Comerio', protocols:[9], displayName:'Tatiane Comério', treatment:'Senhora', degree:'Mestra'},

  // https://www.escavador.com/sobre/277721995/flavia-fonseca-venancio
  {name:'Flávia Fonseca Venâncio', protocols:[98], treatment:'Senhora'},

  // https://enfermagem.vitoria.ufes.br/en/pos-graduacao/PPGENF/msc-dissertation-(by-research)
  {name:'Heloísa Helena Camponez Bárbara Rédua', protocols:[7], treatment:'Senhora'},

  // https://www.escavador.com/sobre/7962288/mayara-alves-luis
  {name:'Mayara Alves Luis', protocols:[79], treatment:'Senhora'},
  // https://saudecoletiva.ufes.br/pt-br/pos-graduacao/PPGSC/detalhes-da-tese?id=23418
  {name:'Brenda Washington da Cruz', protocols:[103], displayName:'Brenda Washington da Cruz Santos', treatment:'Senhora', degree:'Mestra', institution:'UFES'},

  // https://nutricaoesaude.ufes.br/pt-br/pos-graduacao/PPGNS/lista-de-discentes-de-mestrado?order=Orientador&page=1&sort=asc
  // https://doi.org/10.22289/2446-922x.v10n1a24
  {name:'Tânia Bitti Bortolini', protocols:[105], displayName:'Tânia Mara Lopes Bitti Bortolini', treatment:'Senhora'},
];

const comparisonKey = (name: string) => name
  .normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const personKey = (name: string) => comparisonKey(plainPersonName({nome:name}));
const byDefense = new Map<string, Evidence>(evidence.flatMap(person => person.protocols.map(protocol => [
  `${String(protocol).padStart(3,'0')} - Legado|${personKey(person.name)}`, person,
] as const)));
const hasValue = (value?: string) => Boolean(value?.trim()) && comparisonKey(value || '') !== 'nao informado' && /\p{L}/u.test(value || '');

function confirmedCommittee(process: ProcessData): ProcessData['banca'] {
  // The advisor's Lattes records N. M. T. Santana on the exact TCC committee.
  // The publication with the same title and author confirms the full name.
  // https://www.escavador.com/sobre/5593687/mariana-rabello-laignier
  // https://educapes.capes.gov.br/bitstream/capes/721077/1/As%20ci%C3%AAncias%20humanas%20e%20as%20an%C3%A1lises%20sobre%20fen%C3%B4menos%20sociais%20e%20culturais%202.pdf
  const {banca} = process;
  if (
    process.protocolo !== '095 - Legado' ||
    !process.defesa.startAt.startsWith('2022-12-09') ||
    comparisonKey(process.titulo) !== 'violencia autoprovocada contra pessoa com deficiencia no espirito santo frequencia e fatores associados' ||
    personKey(process.aluno1.nome) !== 'guilherme germano da silva' ||
    banca.length !== 1 || banca[0].funcao !== 'EXAMINER_2' ||
    personKey(banca[0].nome) !== 'luciana de cassia nunes nascimento'
  ) return banca;

  return [...banca, {
    id: `${process.id}-examinador-1`,
    nome: 'Nathália Miguel Teixeira Santana',
    email: '',
    instituicao: '',
    funcao: 'EXAMINER_3',
  }];
}

export function legacyRepositoryPeople(process: ProcessData) {
  const present = <T extends Person>(person: T) => {
    const reviewed = byDefense.get(`${process.protocolo}|${personKey(person.nome)}`);
    if (!reviewed) return person;
    return {
      ...person,
      nome: reviewed.displayName || person.nome,
      instituicao: (hasValue(person.instituicao) ? person.instituicao : reviewed.institution) ?? person.instituicao,
      tratamento: person.tratamento || reviewed.treatment,
      titulacao: person.titulacao || reviewed.degree,
    };
  };
  return {
    ...process,
    orientador: present(process.orientador),
    coorientador: process.coorientador && present(process.coorientador),
    banca: confirmedCommittee(process).map(present),
  };
}
