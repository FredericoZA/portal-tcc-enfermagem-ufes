type OperationSnapshot={label:string;pending:number};
const operations=new Map<symbol,string>();
const listeners=new Set<()=>void>();
let snapshot:OperationSnapshot={label:'',pending:0};
function publish(){snapshot={label:operations.values().next().value||'',pending:operations.size};listeners.forEach(listener=>listener());}
export const portalOperations={
 subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
 getSnapshot(){return snapshot;}
};
export async function withPortalOperation<T>(label:string,operation:()=>Promise<T>):Promise<T>{
 const id=Symbol();operations.set(id,label);publish();
 try{return await operation();}finally{operations.delete(id);publish();}
}
export function requestOperationLabel(endpoint:string):string{
 if(endpoint.includes('/location-proof'))return 'Enviando o comprovante da reserva…';
 if(endpoint.includes('/confirm-location'))return 'Confirmando a reserva e encaminhando os convites…';
 if(endpoint.includes('/preview'))return 'Preparando a visualização do documento…';
 if(endpoint.includes('/govbr'))return 'Conferindo o documento assinado…';
 if(endpoint.includes('/evaluation'))return 'Registrando a avaliação e preparando a ata…';
 return 'Processando sua solicitação…';
}
