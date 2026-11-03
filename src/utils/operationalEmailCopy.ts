/** Review only known stock sentences; retain custom text and participant data. */
export function reviewOperationalEmailCopy(text:string,templateId=''):string{
 let result=text.replace(/do TCC (TCC-\d{4}-\d+)/g,'do trabalho $1');
 if(templateId==='email-convite')result=result.replace(/Convidamos (?:Vossas Senhorias|V\.\s*Sa\.) para compor a Comissão Examinadora/gi,'Convidamos você para participar da banca');
 if(templateId==='email-entrega-repositorio')result=result.replace('Após concluir os ajustes ou melhorias eventualmente solicitados pela orientação e pela banca, faça a entrega da versão final no Portal. Caso não tenham sido solicitadas alterações, utilize a versão final apresentada.','Concluam os ajustes solicitados pelo orientador e pela banca, se houver, e enviem o trabalho revisado pelo Portal.');
 if(templateId==='email-entrega-repositorio')result=result.replace(/\s*Se não houver alterações, enviem a versão apresentada na defesa\./g,'');
 return result.replace(/Prezada orientação,/g,'Prezado orientador,').replace(/autores e orientação/gi,match=>match.startsWith('A')?'Autores e orientador':'autores e orientador').replace(/pela orientação e pela banca/g,'pelo orientador e pela banca').replace(/Orientação:/g,'Orientador:').replace(/Coorientação:/g,'Coorientador:');
}
