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
  const xmlHeader='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const sheetMime='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
  const relation='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  zip.file('[Content_Types].xml',`${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${sheetMime}"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="${sheetMime}"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file('_rels/.rels',`${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relation}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml',`${xmlHeader}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${relation}"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Acessos" sheetId="1" r:id="rId1"/><sheet name="Orientações" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels',`${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relation}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${relation}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${relation}/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml',`${xmlHeader}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF005830"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF005830"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9EDEF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFC4CED4"/></left><right style="thin"><color rgb="FFC4CED4"/></right><top style="thin"><color rgb="FFC4CED4"/></top><bottom style="thin"><color rgb="FFC4CED4"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="49" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  const cell=(ref:string,text:string,style:number)=>`<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${encodeXml(text)}</t></is></c>`;
  const rows=[`<row r="1" ht="30" customHeight="1">${['Nome completo','E-mail','Matrícula'].map((text,index)=>cell(`${'ABC'[index]}1`,text,1)).join('')}</row>`];
  for(let row=2;row<=101;row++)rows.push(`<row r="${row}" ht="24" customHeight="1">${['A','B','C'].map(col=>cell(`${col}${row}`,'',row%2===0?0:2)).join('')}</row>`);
  zip.file('xl/worksheets/sheet1.xml',`${xmlHeader}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:C101"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><cols><col min="1" max="1" width="42" customWidth="1" style="0"/><col min="2" max="2" width="44" customWidth="1" style="0"/><col min="3" max="3" width="22" customWidth="1" style="0"/></cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:C101"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.3" footer="0.3"/></worksheet>`);
  const guidance=[['LISTA DE ACESSO AO PORTAL TCC',''],['Preenchimento','Na aba Acessos, preencha uma pessoa por linha, a partir da linha 2.'],['Nome completo','Obrigatório. Informe o nome da pessoa.'],['E-mail','Obrigatório. Informe um e-mail válido, sem espaços.'],['Matrícula','Opcional. A coluna está formatada como texto para preservar zeros à esquerda.'],['Envio','Salve como XLSX e arraste o arquivo para Dados da lista de acesso.'],['Google Planilhas','Arquivo > Importar > Fazer upload. Selecione este modelo; ao concluir, baixe como Microsoft Excel (.xlsx).'],['Conferência','Clique em Interpretar dados e confira a prévia antes de importar.'],['EXEMPLO FICTÍCIO (não é importado)',''],['Nome completo','Maria Silva'],['E-mail','maria@example.invalid'],['Matrícula','000012345']];
  zip.file('xl/worksheets/sheet2.xml',`${xmlHeader}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B12"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="42" customWidth="1"/><col min="2" max="2" width="92" customWidth="1"/></cols><sheetData>${guidance.map((row,index)=>`<row r="${index+1}" ht="38" customHeight="1">${row.map((value,col)=>cell(`${'AB'[col]}${index+1}`,value,index===0?1:index===8?4:3)).join('')}</row>`).join('')}</sheetData></worksheet>`);
  return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
