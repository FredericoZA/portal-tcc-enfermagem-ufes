export class ResponseSizeError extends Error {
  constructor() {
    super('O arquivo recebido não corresponde ao tamanho autorizado ou ultrapassa o limite seguro.');
    this.name = 'ResponseSizeError';
  }
}

export async function readBoundedResponse(response:Response,maxBytes:number,expectedBytes?:number):Promise<Buffer> {
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new RangeError('Limite de download inválido.');
  const reader=response.body?.getReader();
  if(!reader)throw new ResponseSizeError();
  try {
    if(expectedBytes!==undefined&&(!Number.isSafeInteger(expectedBytes)||expectedBytes<1||expectedBytes>maxBytes))throw new ResponseSizeError();
    const announced=response.headers.get('content-length');
    const encoding=String(response.headers.get('content-encoding')||'identity').toLowerCase();
    if(announced!==null&&encoding==='identity'){
      if(!/^\d+$/.test(announced))throw new ResponseSizeError();
      const declared=Number(announced);
      if(!Number.isSafeInteger(declared)||declared>maxBytes||(expectedBytes!==undefined&&declared!==expectedBytes))throw new ResponseSizeError();
    }
    const chunks:Buffer[]=[];
    let size=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxBytes||(expectedBytes!==undefined&&size>expectedBytes))throw new ResponseSizeError();
      chunks.push(Buffer.from(value));
    }
    if(size===0||(expectedBytes!==undefined&&size!==expectedBytes))throw new ResponseSizeError();
    return Buffer.concat(chunks,size);
  }catch(error){
    await reader.cancel().catch(()=>undefined);
    throw error;
  }finally{
    reader.releaseLock();
  }
}
