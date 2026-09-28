import JSZip from 'jszip';

export interface StudentImportRow { nome: string; email: string; matricula?: string; row: number; }

const normalizeHeader=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_');
const decodeXml=(value:string)=>value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const encodeXml=(value:string)=>String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

function parseDelimited(text:string):string[][]{
  const clean=text.replace(/^\uFEFF/,'');
  const firstLine=clean.split(/\r?\n/,1)[0]||'';
  const separatorCounts={tab:(firstLine.match(/\t/g)||[]).length,semicolon:(firstLine.match(/;/g)||[]).length,comma:(firstLine.match(/,/g)||[]).length};
  const delimiter=separatorCounts.tab>=separatorCounts.semicolon&&separatorCounts.tab>=separatorCounts.comma&&separatorCounts.tab>0?'\t':separatorCounts.semicolon>separatorCounts.comma?';':',';
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let index=0;index<clean.length;index++){const char=clean[index];if(char==='"'){if(quoted&&clean[index+1]==='"'){cell+='"';index++;}else quoted=!quoted;}else if(char===delimiter&&!quoted){row.push(cell);cell='';}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&clean[index+1]==='\n')index++;row.push(cell);if(row.some(value=>value.trim()))rows.push(row);row=[];cell='';}else cell+=char;}row.push(cell);if(row.some(value=>value.trim()))rows.push(row);return rows;
}

async function parseXlsx(buffer:ArrayBuffer):Promise<string[][]>{
  const zip=await JSZip.loadAsync(buffer);const sharedXml=await zip.file('xl/sharedStrings.xml')?.async('string');const shared=sharedXml?Array.from(sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)).map(match=>decodeXml(Array.from(match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map(item=>item[1]).join(''))):[];
  const workbook=await zip.file('xl/workbook.xml')?.async('string');const rels=await zip.file('xl/_rels/workbook.xml.rels')?.async('string');let sheetPath='xl/worksheets/sheet1.xml';if(workbook&&rels){const relId=workbook.match(/<sheet[^>]*r:id="([^"]+)"/)?.[1];const target=relId?Array.from(rels.matchAll(/<Relationship[^>]+>/g)).find(match=>match[0].includes(`Id="${relId}"`))?.[0].match(/Target="([^"]+)"/)?.[1]:'';if(target){const normalized=target.replace(/^\.\//,'').replace(/^\.\.\//,'');sheetPath=target.startsWith('/')?target.slice(1):normalized.startsWith('xl/')?normalized:`xl/${normalized}`;}}
  const xml=await zip.file(sheetPath)?.async('string');if(!xml)throw new Error('A primeira planilha do arquivo XLSX não foi encontrada.');const rows:string[][]=[];
  for(const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){const cells:string[]=[];for(const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)){const attrs=cellMatch[1],body=cellMatch[2],reference=attrs.match(/r="([A-Z]+)\d+"/)?.[1]||'A';let column=0;for(const letter of reference)column=column*26+letter.charCodeAt(0)-64;const type=attrs.match(/t="([^"]+)"/)?.[1];const inline=body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];const raw=body.match(/<v>([\s\S]*?)<\/v>/)?.[1]||inline||'';cells[column-1]=type==='s'?shared[Number(raw)]||'':decodeXml(raw);}rows.push(cells.map(value=>value||''));}return rows;
}

function tableToStudents(table:string[][]):StudentImportRow[]{
  if(table.length<2)throw new Error('Os dados precisam ter cabeçalho e ao menos uma pessoa.');
  const headers=table[0].map(normalizeHeader);const column=(aliases:string[])=>headers.findIndex(header=>aliases.includes(header));const nameIndex=column(['nome','nome_completo','aluno']),emailIndex=column(['email','e_mail','email_institucional']),registrationIndex=column(['matricula','numero_de_matricula','registro']);if(nameIndex<0||emailIndex<0)throw new Error('O cabeçalho precisa conter as colunas nome e email.');
  return table.slice(1).map((row,index)=>({row:index+2,nome:String(row[nameIndex]||'').trim(),email:String(row[emailIndex]||'').trim().toLowerCase(),matricula:registrationIndex>=0?String(row[registrationIndex]||'').trim()||undefined:undefined})).filter(row=>row.nome||row.email||row.matricula);
}

export function parseStudentImportText(text:string):StudentImportRow[]{
  if(!String(text||'').trim())return[];
  return tableToStudents(parseDelimited(text));
}

export async function parseStudentImportFile(file:File):Promise<StudentImportRow[]>{
  if(file.size>5*1024*1024)throw new Error('A planilha não pode ultrapassar 5 MB.');
  const extension=file.name.split('.').pop()?.toLowerCase();let table:string[][];
  if(extension==='csv'||extension==='txt')table=parseDelimited(await file.text());
  else if(extension==='xlsx')table=await parseXlsx(await file.arrayBuffer());
  else throw new Error('Use uma planilha Excel no formato XLSX. Arquivos CSV e TXT também são aceitos.');
  return tableToStudents(table);
}

export function studentImportTemplateCsv():string{return '\uFEFFnome;email;matricula\nNome completo;usuario@gmail.com;0000000000\n';}

export function studentImportTemplateGoogleSheetsTsv():string{
  return 'nome\temail\tmatricula\nNome completo\tusuario@gmail.com\t0000000000\n';
}

export async function studentImportTemplateXlsx():Promise<Blob>{
  const zip=new JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
  zip.folder('_rels')?.file('.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.folder('xl')?.file('workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Acessos" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.folder('xl/_rels')?.file('workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.folder('xl')?.file('styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF005830"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>');
  const rows=[['nome','email','matricula'],['Nome completo','usuario@gmail.com','0000000000']];
  const refs=['A','B','C'];
  const sheetRows=rows.map((row,rowIndex)=>`<row r="${rowIndex+1}">${row.map((cell,columnIndex)=>`<c r="${refs[columnIndex]}${rowIndex+1}" t="inlineStr" s="${rowIndex===0?1:0}"><is><t>${encodeXml(cell)}</t></is></c>`).join('')}</row>`).join('');
  zip.folder('xl/worksheets')?.file('sheet1.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:C2"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:C2"/></worksheet>`);
  return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
