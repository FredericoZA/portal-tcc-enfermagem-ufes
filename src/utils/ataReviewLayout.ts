import type {AtaReviewParagraph} from '../services/apiClient';
type Run=AtaReviewParagraph['runs'][number];

/** Mirror the native centered tab stops without flattening emphasis or editing tabs. */
export function ataReviewColumns(paragraph:AtaReviewParagraph):[Run[],Run[]]|null{
  if(paragraph.tabStops?.length!==2||paragraph.tabStops.some(stop=>stop.alignment!=='CENTER'))return null;
  const columns:Run[][]=[[],[],[]];let column=0;
  for(let index=0;index<paragraph.runs.length;index++){
    const run=paragraph.runs[index];
    const parts=(index===paragraph.runs.length-1?run.text.replace(/\n$/,''):run.text).split('\t');
    for(let part=0;part<parts.length;part++){
      if(part)column++;
      if(column>2)return null;
      if(parts[part])columns[column].push({...run,text:parts[part]});
    }
  }
  return column===2&&!columns[0].some(run=>run.text.trim())?[columns[1],columns[2]]:null;
}
export function joinAtaReviewColumns(values:string[]):string{
  return '\t'+values.map(value=>value.replace(/[\r\n\t]+/g,' ')).join('\t');
}
