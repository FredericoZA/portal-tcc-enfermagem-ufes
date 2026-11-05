import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFArray,PDFDict,PDFDocument,PDFName,PDFRawStream} from 'pdf-lib';
import {createProfessionalPdf} from './simplePdf';

test('PDF simples mantém o corpo e repete cabeçalho vertical compacto centralizado em maiúsculas',async()=>{
  const body=Array.from({length:25},(_,index)=>`Registro de teste ${index}: João da Silva.`).join('\n');
  const bytes=createProfessionalPdf({title:'Histórico de teste',protocol:'TCC-TESTE',body});
  const structural=await PDFDocument.load(bytes),{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0}),document=await loading.promise;
  try{
    assert.equal(document.numPages,2);
    let text='';
    for(let index=0;index<document.numPages;index++){
      const page=await document.getPage(index+1),content=await page.getTextContent();
      const items=content.items.filter((item:any)=>typeof item.str==='string') as Array<{str:string;width:number;transform:number[]}>;
      text+=items.map(item=>item.str).join(' ');
      const labels=['UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO','CENTRO DE CIÊNCIAS DA SAÚDE','CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA'];
      const header=items.filter(item=>labels.includes(item.str));
      assert.deepEqual(header.map(item=>item.str),labels);
      const centers=header.map(item=>item.transform[4]+item.width/2);
      assert.ok(Math.max(...centers)-Math.min(...centers)<.5);
      assert.ok(centers.every(center=>Math.abs(center-595/2)<.5));
      assert.ok(header.every(item=>item.transform[0]>=8.5&&item.transform[0]<=9));
      const pdfPage=structural.getPage(index),resources=pdfPage.node.Resources()!,images=resources.lookup(PDFName.of('XObject'),PDFDict);
      const arms=images.lookup(PDFName.of('Arms'));
      assert.ok(arms instanceof PDFRawStream);
      assert.equal(arms.dict.lookup(PDFName.of('Width')).toString(),'130');
      assert.equal(arms.dict.lookup(PDFName.of('Height')).toString(),'135');
      assert.equal(arms.dict.lookup(PDFName.of('Mask'),PDFArray).toString(),'[ 0 0 ]');
      const stream=pdfPage.node.Contents();
      assert.ok(stream instanceof PDFRawStream);
      const commands=Buffer.from(stream.getContents()).toString('latin1');
      const image=commands.match(/q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm \/Arms Do Q/);
      assert.ok(image);
      const [width,height,x,y]=image.slice(1).map(Number);
      assert.ok(Math.abs(width/height-130/135)<.001);
      assert.ok(Math.abs(height-46)<.01);
      assert.ok(Math.abs(x+width/2-595/2)<.01,'brasão centralizado sobre as três linhas');
      assert.ok(Math.abs(y+height-(842-8))<.01,'margem superior de oito pontos');
      assert.ok(header[0].transform[5]+header[0].transform[0]<y,'texto fica abaixo do brasão');
      assert.ok(header[0].transform[5]>header[1].transform[5]&&header[1].transform[5]>header[2].transform[5]);
      const title=items.find(item=>item.str==='HISTÓRICO DE TESTE');
      assert.ok(title);
      assert.ok(header.at(-1)!.transform[5]-title.transform[5]>=21.9,'título separado do bloco institucional');
      assert.ok(items.filter(item=>item.str.startsWith('Registro de teste')).every(item=>item.transform[5]<title.transform[5]-40&&item.transform[5]>=80));
    }
    assert.match(text,/Registro de teste 0: João da Silva/);
    assert.match(text,/Registro de teste 24: João da Silva/);
  }finally{await loading.destroy();}
});

test('cabeçalho extenso se ajusta sem sobrepor título, corpo ou rodapé em nenhuma página',async()=>{
  const body=Array.from({length:90},(_,index)=>`Registro ${index}: informação preservada.`).join('\n');
  const bytes=createProfessionalPdf({title:'Registro de teste',protocol:'TCC-TESTE',institution:'Universidade Federal do Espírito Santo - Centro de Ensino, Pesquisa, Extensão e Desenvolvimento Acadêmico',course:'Curso de Graduação em Enfermagem e Obstetrícia - Formação, Ensino, Pesquisa e Assistência em Saúde',body});
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0}),document=await loading.promise;
  try{
    assert.ok(document.numPages>2);
    let text='';
    for(let index=1;index<=document.numPages;index++){
      const content=await(await document.getPage(index)).getTextContent();
      const items=content.items.filter((item:any)=>typeof item.str==='string'&&item.str.trim()) as Array<{str:string;width:number;transform:number[]}>;
      const title=items.find(item=>item.str==='REGISTRO DE TESTE');assert.ok(title);
      const header=items.filter(item=>item.transform[5]>title.transform[5]);
      assert.ok(header.length>=3);
      assert.ok(header.every(item=>item.str===item.str.toLocaleUpperCase('pt-BR')&&item.transform[4]>=72&&item.transform[4]+item.width<=523.1));
      assert.ok(Math.min(...header.map(item=>item.transform[5]))-title.transform[5]>=21.9);
      const rows=items.filter(item=>/^Registro \d+:/.test(item.str));
      assert.ok(rows.length>0);
      assert.ok(rows.every(item=>item.transform[5]>=80&&item.transform[5]<title.transform[5]-40));
      assert.ok(items.some(item=>item.str===`Portal de TCC - página ${index} de ${document.numPages}`&&item.transform[5]===40));
      text+=items.map(item=>item.str).join('\n')+'\n';
    }
    for(let index=0;index<90;index++)assert.equal(text.split(`Registro ${index}: informação preservada.`).length-1,1);
  }finally{await loading.destroy();}
});
