type OperationSnapshot={label:string;pending:number;blocking?:boolean};
const operations=new Map<symbol,{label:string;blocking:boolean}>();
const listeners=new Set<()=>void>();
let snapshot:OperationSnapshot={label:'',pending:0};
function publish(){const blocking=[...operations.values()].find(operation=>operation.blocking);snapshot={label:(blocking||operations.values().next().value)?.label||'',pending:operations.size,...(blocking?{blocking:true}:{})};listeners.forEach(listener=>listener());}
export const portalOperations={
 subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
 getSnapshot(){return snapshot;}
};
export async function withPortalOperation<T>(label:string,operation:()=>Promise<T>,options:{blocking?:boolean}={}):Promise<T>{
 const id=Symbol();operations.set(id,{label,blocking:Boolean(options.blocking)});publish();
 try{return await operation();}finally{operations.delete(id);publish();}
}
export function withBlockingPortalOperation<T>(label:string,operation:()=>Promise<T>):Promise<T>{
 return withPortalOperation(label,operation,{blocking:true});
}
export function requestOperationLabel(endpoint:string):string{
 if(endpoint.includes('/preview'))return 'Preparando a visualização do documento…';
 if(endpoint.includes('/govbr'))return 'Conferindo o documento assinado…';
 if(endpoint.includes('/evaluation'))return 'Registrando o conceito e preparando a ata…';
 return 'Processando sua solicitação…';
}
