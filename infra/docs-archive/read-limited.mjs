// Bound streamed bodies before concatenation; Content-Length is optional.
export async function readLimited(request, maximum) {
  if (!request.body) return new Uint8Array();
  const reader=request.body.getReader(), chunks=[]; let size=0;
  for (;;) {
    const {done,value}=await reader.read(); if(done) break;
    size+=value.byteLength;
    if(size>maximum){await reader.cancel();return null;}
    chunks.push(value);
  }
  const result=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}
  return result;
}
