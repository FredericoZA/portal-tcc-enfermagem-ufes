import JSZip from 'jszip';

export interface StudentImportRow { nome: string; email: string; matricula?: string; row: number; }

const normalizeHeader=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_');
const decodeXml=(value:string)=>value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");

function parseDelimited(text:string):string[][]{
  const clean=text.replace(/^\uFEFF/,'');const firstLine=clean.split(/\r?\n/,1)[0]||'';const delimiter=(firstLine.match(/;/g)||[]).length>(firstLine.match(/,/g)||[]).length?';':',';const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let index=0;index<clean.length;index++){const char=clean[index];if(char==='"'){if(quoted&&clean[index+1]==='"'){cell+='"';index++;}else quoted=!quoted;}else if(char===delimiter&&!quoted){row.push(cell);cell='';}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&clean[index+1]==='\n')index++;row.push(cell);if(row.some(value=>value.trim()))rows.push(row);row=[];cell='';}else cell+=char;}row.push(cell);if(row.some(value=>value.trim()))rows.push(row);return rows;
}

async function parseXlsx(buffer:ArrayBuffer):Promise<string[][]>{
  const zip=await JSZip.loadAsync(buffer);const sharedXml=await zip.file('xl/sharedStrings.xml')?.async('string');const shared=sharedXml?Array.from(sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)).map(match=>decodeXml(Array.from(match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map(item=>item[1]).join(''))):[];
  const workbook=await zip.file('xl/workbook.xml')?.async('string');const rels=await zip.file('xl/_rels/workbook.xml.rels')?.async('string');let sheetPath='xl/worksheets/sheet1.xml';if(workbook&&rels){const relId=workbook.match(/<sheet[^>]*r:id="([^"]+)"/)?.[1];const target=relId?Array.from(rels.matchAll(/<Relationship[^>]+>/g)).find(match=>match[0].includes(`Id="${relId}"`))?.[0].match(/Target="([^"]+)"/)?.[1]:'';if(target){const normalized=target.replace(/^\.\//,'').replace(/^\.\.\//,'');sheetPath=target.startsWith('/')?target.slice(1):normalized.startsWith('xl/')?normalized:`xl/${normalized}`;}}
  const xml=await zip.file(sheetPath)?.async('string');if(!xml)throw new Error('A primeira planilha do arquivo XLSX não foi encontrada.');const rows:string[][]=[];
  for(const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){const cells:string[]=[];for(const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)){const attrs=cellMatch[1],body=cellMatch[2],reference=attrs.match(/r="([A-Z]+)\d+"/)?.[1]||'A';let column=0;for(const letter of reference)column=column*26+letter.charCodeAt(0)-64;const type=attrs.match(/t="([^"]+)"/)?.[1];const inline=body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];const raw=body.match(/<v>([\s\S]*?)<\/v>/)?.[1]||inline||'';cells[column-1]=type==='s'?shared[Number(raw)]||'':decodeXml(raw);}rows.push(cells.map(value=>value||''));}return rows;
}

export async function parseStudentImportFile(file:File):Promise<StudentImportRow[]>{
  if(file.size>5*1024*1024)throw new Error('A planilha não pode ultrapassar 5 MB.');const extension=file.name.split('.').pop()?.toLowerCase();let table:string[][];if(extension==='csv'||extension==='txt')table=parseDelimited(await file.text());else if(extension==='xlsx')table=await parseXlsx(await file.arrayBuffer());else throw new Error('Use um arquivo CSV ou XLSX.');if(table.length<2)throw new Error('A planilha precisa ter cabeçalho e ao menos um aluno.');const headers=table[0].map(normalizeHeader);const column=(aliases:string[])=>headers.findIndex(header=>aliases.includes(header));const nameIndex=column(['nome','nome_completo','aluno']),emailIndex=column(['email','e_mail','email_institucional']),registrationIndex=column(['matricula','numero_de_matricula','registro']);if(nameIndex<0||emailIndex<0)throw new Error('O cabeçalho precisa conter as colunas nome e email.');return table.slice(1).map((row,index)=>({row:index+2,nome:String(row[nameIndex]||'').trim(),email:String(row[emailIndex]||'').trim().toLowerCase(),matricula:registrationIndex>=0?String(row[registrationIndex]||'').trim()||undefined:undefined})).filter(row=>row.nome||row.email||row.matricula);
}

export function studentImportTemplateCsv():string{return '\uFEFFnome;email;matricula\nNome completo;aluno@instituicao.br;0000000000\n';}
