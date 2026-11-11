import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/proxy.js';
function response() { return {headers:{},setHeader(key,value){this.headers[key]=value;},end(value){this.body=value;}}; }
test('blocks foreign-origin mutations and invalid upstream paths',async()=>{
 for (const [route,origin,status] of [['documents','https://attacker.example',403],['../private','https://app.example',404]]) {
  const res=response();await handler({query:{route},method:'POST',headers:{host:'app.example',origin},body:{}},res);assert.equal(res.statusCode,status);
 }
});
test('forwards only app cookies and retains the backend session response',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://margin-team-docs-surya.spunky-calf-4916.chatgpt.site/api/auth/google');
  assert.equal(options.headers.Cookie,'session=app-token; login_nonce=challenge');
  return new Response('{"user":"google:123"}',{headers:{'Set-Cookie':'session=new-token; HttpOnly; Secure; Path=/; SameSite=Strict'}});
 };
 const res=response();await handler({query:{route:'auth/google'},method:'POST',headers:{host:'app.example',origin:'https://app.example',cookie:'session=app-token; login_nonce=challenge; unrelated=do-not-forward'},body:{credential:'test'}},res);
 assert.equal(res.statusCode,200);assert.match(res.headers['Set-Cookie'][0],/session=new-token/);
});
