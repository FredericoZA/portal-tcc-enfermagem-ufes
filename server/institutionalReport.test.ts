import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData, StudioFormSubmission } from '../src/types';
import { buildAdvancedAnalytics } from './advancedAnalytics';
import { buildInstitutionalReport } from './institutionalReport';

const process=(n:number):ProcessData=>({id:`p${n}`,protocolo:`TCC-2026-${n}`,titulo:`Título pessoal secreto ${n}`,etapaAtual:'CONCLUIDO',status:'CONCLUIDO',createdByEmail:`aluno${n}@example.com`,aluno1:{nome:`Nome Pessoal ${n}`,matricula:`20260${n}`,email:`aluno${n}@example.com`},aluno2:null,orientador:{nome:'Orientador',email:'orientador@example.com'},coorientador:null,banca:[{id:'b',nome:'Examinador',email:'examinador@example.com',funcao:'EXAMINER_2'}],defesa:{startAt:'2026-06-01T13:00:00Z',endAt:'2026-06-01T14:30:00Z',local:'Sala',localStatus:'CONFIRMADO',localConfirmedAt:'2026-05-10T12:00:00Z',invitationSentAt:'2026-05-11T12:00:00Z'},avaliacao:{status:'CONCLUIDO',resultadoCode:'APROVADO',resultadoLabel:'Aprovado',submittedAt:'2026-06-01T15:00:00Z'},acervo:{submittedAt:'2026-06-04T12:00:00Z',publishFullWork:true,palavrasChave:['Saúde coletiva']},dataRevision:1,academicCycleId:'2026.1',createdAt:'2026-05-01T12:00:00Z',updatedAt:'2026-06-05T12:00:00Z',completedAt:'2026-06-05T12:00:00Z'});
const form=(n:number):StudioFormSubmission=>({id:`f${n}`,processId:`p${n}`,formId:'dados',formRevision:1,submittedBy:`aluno${n}@example.com`,submittedAt:'2026-06-04T12:00:00Z',answers:{AREA_TEMATICA:'Saúde coletiva',TEMA_PRINCIPAL:'Atenção primária',TIPO_DE_ESTUDO:'Revisão',FINALIDADE_DO_TRABALHO:'Conclusão de curso'},checksum:`hash${n}`,archiveStatus:'ARCHIVED'});

test('relatório institucional produz gráficos vetoriais, metodologia e nenhum dado pessoal',async()=>{
  const processes=[1,2,3].map(process),forms=[1,2,3].map(form);
  const report=buildAdvancedAnalytics({processes,formSubmissions:forms,workflowRuns:[],emailDeliveries:[],signatureJobs:[],correctionRequests:[],courseName:'Enfermagem',institutionName:'UFES',generatedAt:'2026-09-09T12:00:00Z',studio:{operationalConfig:{catalogs:[['AREA_TEMATICA','Saúde coletiva'],['TEMA_PRINCIPAL','Atenção primária'],['TIPO_DE_ESTUDO','Revisão'],['FINALIDADE_DO_TRABALHO','Conclusão de curso']].map(([kind,label],index)=>({id:String(index),kind:kind as any,label,aliases:[],active:true}))} as any}},'2026.1');
  const bytes=await buildInstitutionalReport(report,{courseName:'Enfermagem',institutionName:'UFES'});assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const {getDocument,OPS,Util}=await import('pdfjs-dist/legacy/build/pdf.mjs'),doc=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0}).promise;let text='';
  for(let i=1;i<=doc.numPages;i++){
    const page=await doc.getPage(i),content=await page.getTextContent();
    const items=content.items.filter((item:any)=>typeof item.str==='string') as Array<{str:string;width:number;height:number;fontName:string;transform:number[]}>;
    text+=items.map(item=>item.str).join(' ');
    const labels=['UFES','CENTRO DE CIÊNCIAS DA SAÚDE','ENFERMAGEM'];
    const header=items.filter(item=>labels.includes(item.str));
    assert.deepEqual(header.map(item=>item.str),['UFES','CENTRO DE CIÊNCIAS DA SAÚDE','ENFERMAGEM']);
    const pageCenter=(page.view[0]+page.view[2])/2,headerBottom=717.89,headerTop=813.89;
    const textBounds=(item:typeof items[number])=>({bottom:item.transform[5]+item.height*Math.min(0,content.styles[item.fontName]?.descent||0),top:item.transform[5]+item.height*Math.max(1,content.styles[item.fontName]?.ascent||1)});
    for(const item of header){
      assert.ok(Math.abs(item.transform[4]+item.width/2-pageCenter)<.5,'cada linha institucional fica no centro da página');
      const bounds=textBounds(item);
      assert.ok(item.transform[4]>=52&&item.transform[4]+item.width<=page.view[2]-52,'texto dentro das margens horizontais');
      assert.ok(bounds.bottom>=headerBottom&&bounds.top<=headerTop,'texto dentro da área vertical reservada ao cabeçalho');
    }
    const operators=await page.getOperatorList(),stack:number[][]=[],images:Array<{left:number;right:number;bottom:number;top:number}>=[];
    let matrix=[1,0,0,1,0,0];
    operators.fnArray.forEach((operation,index)=>{
      if(operation===OPS.save)stack.push([...matrix]);
      else if(operation===OPS.restore)matrix=stack.pop()||[1,0,0,1,0,0];
      else if(operation===OPS.transform)matrix=Util.transform(matrix,operators.argsArray[index]);
      else if(operation===OPS.paintImageXObject||operation===OPS.paintInlineImageXObject){
        const points=[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]]);
        images.push({left:Math.min(...points.map(point=>point[0])),right:Math.max(...points.map(point=>point[0])),bottom:Math.min(...points.map(point=>point[1])),top:Math.max(...points.map(point=>point[1]))});
      }
    });
    assert.equal(images.length,1,'cada página mantém um brasão');
    const arms=images[0];
    assert.ok(Math.abs((arms.left+arms.right)/2-pageCenter)<.5,'brasão centralizado na página');
    assert.ok(arms.left>=52&&arms.right<=page.view[2]-52&&arms.bottom>=headerBottom&&arms.top<=headerTop,'brasão inteiro dentro do cabeçalho');
    assert.ok(arms.bottom>Math.max(...header.map(item=>textBounds(item).top)),'brasão acima das linhas institucionais, sem sobreposição');
    const bodyItems=items.filter(item=>item.str.trim()&&!labels.includes(item.str)&&item.transform[5]<headerBottom);
    assert.ok(Math.max(...bodyItems.map(item=>textBounds(item).top))<headerBottom,'capítulo e corpo separados do cabeçalho');
    if(i===1){assert.ok(items.some(item=>item.str==='Panorama institucional dos TCCs'&&Math.abs(item.transform[5]-683.89)<.01),'o corpo mantém a posição original');assert.ok(items.some(item=>item.str==='SÍNTESE EXECUTIVA'&&item.transform[5]>700));}
  }
  assert.ok(doc.numPages>=2);assert.match(text,/Panorama institucional dos TCCs/);assert.match(text,/Metodologia/);assert.match(text,/Áreas temáticas/);assert.doesNotMatch(text,/Nome Pessoal|aluno1@example|Título pessoal secreto/);const destroy=(doc as unknown as {destroy?:()=>Promise<void>}).destroy;if(typeof destroy==='function')await destroy.call(doc);
});
