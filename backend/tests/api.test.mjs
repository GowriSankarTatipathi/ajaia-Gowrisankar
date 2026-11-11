import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {digest} from '../worker/auth.js';
async function fixture(t) {
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'ajaia-test',modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-11-10',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com'}}]}));
 t.after(()=>mf.dispose()); const db=await mf.getD1Database('DB');
 for(const file of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort()) {
  for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').filter(sql=>sql.trim())) await db.prepare(sql).run();
 }
 const cookies={};
 for(const user of ['alex','sam','jordan']) {
  await db.prepare('INSERT INTO users VALUES (?,?,?)').bind('google:'+user,user+'@example.com',user).run();
  const token=crypto.randomUUID();cookies[user]='session='+token;
  await db.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(await digest(token),'google:'+user,Date.now()+60000).run();
 }
 async function request(path,{method='GET',body,cookie='',headers={}}={}) {
  const response=await mf.dispatchFetch('https://ajaia.example/api'+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 return {request,cookies};
}
test('Google-user document access, email sharing, persistence, and conflicts',async t=>{
 const {request,cookies:{alex,sam,jordan}}=await fixture(t);
 assert.equal((await request('/documents')).status,401);
 const created=await request('/documents',{method:'POST',cookie:alex,body:{title:'Plan',content:'<h2>Plan</h2><p><b>Ready</b> <i>now</i> <u>today</u></p>'}});
 assert.equal(created.status,201);const path='/documents/'+created.data.id;
 assert.equal((await request(path,{cookie:sam})).status,404);
 assert.equal((await request(path+'/shares',{method:'POST',cookie:alex,body:{email:'sam@example.com'}})).status,200);
 assert.equal((await request(path+'/shares',{method:'POST',cookie:sam,body:{email:'jordan@example.com'}})).status,403);
 assert.ok((await request('/documents',{cookie:sam})).data.some(doc=>doc.id===created.data.id));
 const original=await request(path,{cookie:sam});assert.match(original.data.content,/<u>today<\/u>/);
 const edit={title:'Team draft',content:'<ol><li>Ship</li></ol>',version:1};
 assert.equal((await request(path,{method:'PUT',cookie:sam,body:edit})).status,200);
 assert.equal((await request(path,{method:'PUT',cookie:alex,body:edit})).status,409);
 assert.equal((await request(path,{cookie:jordan})).status,404);
 assert.equal((await request(path,{cookie:alex})).data.content,edit.content);
});
test('removed demo login, rejected credentials, logout, sanitization, and origin checks',async t=>{
 const {request,cookies:{alex}}=await fixture(t);
 assert.equal((await request('/login',{method:'POST',body:{user:'alex'}})).status,410);
 assert.equal((await request('/auth/google',{method:'POST',body:{credential:'forged'}})).status,401);
 const challenge=await request('/auth/challenge',{method:'POST',body:{}});
 assert.equal(challenge.status,200);
 assert.equal((await request('/auth/google',{method:'POST',cookie:challenge.cookie,body:{credential:'forged'}})).status,401);
 assert.equal((await request('/auth/google',{method:'POST',cookie:challenge.cookie,body:{credential:'forged'}})).status,401);
 assert.equal((await request('/documents',{method:'POST',cookie:alex,body:{title:' '}})).status,400);
 assert.equal((await request('/documents',{method:'POST',cookie:alex,body:{title:'No'},headers:{Origin:'https://untrusted.example'}})).status,403);
 const doc=await request('/documents',{method:'POST',cookie:alex,body:{title:'Safe',content:'<script>alert(1)</script><b onclick="x()">Safe</b>'}});
 assert.equal((await request('/documents/'+doc.data.id,{cookie:alex})).data.content,'<b>Safe</b>');
 assert.equal((await request('/logout',{method:'POST',cookie:alex,body:{}})).status,200);
 assert.equal((await request('/me',{cookie:alex})).status,401);
});
