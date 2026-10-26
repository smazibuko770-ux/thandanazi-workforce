import { api } from './client';
type Category='meter-start'|'meter-end'|'breakdown'|'fuel-distribution';
function timeoutSignal(ms:number){const c=new AbortController();const id=window.setTimeout(()=>c.abort(),ms);return {signal:c.signal,clear:()=>window.clearTimeout(id)};}
export async function uploadBlob(file:Blob,fileName:string,contentType:string,category:Category){
  if(!['image/jpeg','image/png'].includes(contentType))throw new Error('Only JPEG and PNG images are allowed');
  if(file.size>5*1024*1024)throw new Error('Photo must be 5 MB or smaller');
  const p=await api<{uploadUrl:string;key:string}>('/uploads/presign',{method:'POST',body:JSON.stringify({fileName,contentType,size:file.size,category})});
  const timer=timeoutSignal(30000);
  try{
    const r=await fetch(p.uploadUrl,{method:'PUT',headers:{'Content-Type':contentType},body:file,signal:timer.signal});
    if(!r.ok)throw new Error(`Photo upload failed (${r.status}). Check connection and try again.`);
    return p.key;
  }catch(error:any){
    if(error?.name==='AbortError')throw new Error('Photo upload timed out. Move closer to signal and try again.');
    const message = String(error?.message || '').toLowerCase();
    if (error?.name === 'TypeError' || message.includes('load failed') || message.includes('failed to fetch')) {
      throw new Error('Photo upload could not reach S3. The app will save the shift/report for sync instead of blocking the worker.');
    }
    throw error;
  }finally{timer.clear();}
}
export async function uploadImage(file:File,category:Category){return uploadBlob(file,file.name,file.type,category)}
