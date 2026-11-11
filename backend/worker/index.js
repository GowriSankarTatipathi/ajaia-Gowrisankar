import sanitizeHtml from 'sanitize-html';
import assets from './assets.js';
import {verifyGoogleToken,digest} from './auth.js';
const json = (status, value, extra = {}) => new Response(JSON.stringify(value), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}});
const error = (status, message) => json(status,{error:message});
export const clean = content => sanitizeHtml(content, {allowedTags:['p','br','div','strong','b','em','i','u','h1','h2','h3','ul','ol','li','blockquote'],allowedAttributes:{}});
function validate(title,content) {
  return typeof title === 'string' && title.trim().length > 0 && title.trim().length <= 120 && typeof content === 'string' && content.length <= 200000;
}
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) return {};
  let size = 0; const chunks = [];
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 600000) { await reader.cancel(); throw new RangeError('Request too large'); }
    chunks.push(chunk.value);
  }
  const value = JSON.parse(await new Blob(chunks).text());
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyntaxError('Expected JSON object');
  return value;
}
export default {
  async fetch(request,env) {
    try {
      const url = new URL(request.url), path = url.pathname, method = request.method;
      if (!path.startsWith('/api/')) {
        const asset = assets[path];
        if (!asset || !['GET','HEAD'].includes(method)) return error(404,'Not found');
        return new Response(method === 'HEAD' ? null : asset.body,{headers:{'Content-Type':asset.type+'; charset=utf-8','X-Content-Type-Options':'nosniff','Cross-Origin-Opener-Policy':'same-origin-allow-popups','Content-Security-Policy':"default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"}});
      }
      if (!['GET','POST','PUT'].includes(method)) return error(405,'Method not allowed');
      if (method !== 'GET' && request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return error(403,'Cross-origin requests are not allowed');
      let data;
      try { data = method === 'GET' ? {} : await body(request); }
      catch (e) { return error(e instanceof RangeError ? 413 : 400,e instanceof RangeError ? 'Request is too large' : 'Send a valid JSON object'); }
      const db = env.DB;
      const secure = url.protocol === 'https:' ? '; Secure' : '';
      const cookie = key => request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(key+'='))?.slice(key.length+1) || '';
      if (path === '/api/auth/config' && method === 'GET') return json(200,{clientId:env.GOOGLE_CLIENT_ID || null});
      if (path === '/api/auth/challenge' && method === 'POST') {
        if (!env.GOOGLE_CLIENT_ID) return error(503,'Google sign-in setup is not complete yet.');
        const nonce=crypto.randomUUID();
        await db.batch([db.prepare('DELETE FROM login_challenges WHERE expires<?').bind(Date.now()),db.prepare('INSERT INTO login_challenges VALUES (?,?)').bind(await digest(nonce),Date.now()+600000)]);
        return json(200,{nonce},{'Set-Cookie':`login_nonce=${nonce}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600${secure}`});
      }
      if (path === '/api/auth/google' && method === 'POST') {
        if (!env.GOOGLE_CLIENT_ID) return error(503,'Google sign-in setup is not complete yet.');
        const nonce=cookie('login_nonce');
        if (!nonce || typeof data.credential !== 'string') return error(401,'Please restart Google sign-in.');
        const challenge=await db.prepare('DELETE FROM login_challenges WHERE nonce=? AND expires>? RETURNING nonce').bind(await digest(nonce),Date.now()).first();
        if (!challenge) return error(401,'Sign-in expired. Please try again.');
        let identity;
        try { identity=await verifyGoogleToken(data.credential,env.GOOGLE_CLIENT_ID,nonce); }
        catch { return error(401,'Google sign-in could not be verified. Please try again.'); }
        const token=crypto.randomUUID()+crypto.randomUUID();
        await db.batch([
          db.prepare('INSERT INTO users (id,email,name) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name').bind(identity.id,identity.email,identity.name),
          db.prepare('DELETE FROM sessions WHERE expires<? OR token=?').bind(Date.now(),await digest(cookie('session'))),
          db.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(await digest(token),identity.id,Date.now()+86400000)
        ]);
        return json(200,{user:identity.id},{'Set-Cookie':`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secure}`});
      }
      if (path === '/api/login') return error(410,'Demo login has been removed. Please sign in with Google.');
      const token=cookie('session');
      if (path === '/api/logout' && method === 'POST') {
        await db.prepare('DELETE FROM sessions WHERE token=?').bind(await digest(token)).run();
        return json(200,{ok:true},{'Set-Cookie':`session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`});
      }
      const session=await db.prepare('SELECT sessions.user,users.email,users.name FROM sessions JOIN users ON users.id=sessions.user WHERE token=? AND expires>?').bind(await digest(token),Date.now()).first();
      if (!session) return error(401,'Sign in with Google to continue');
      const user=session.user;
      if (path === '/api/me' && method === 'GET') return json(200,{user,users:[{id:user,name:session.name,email:session.email}]});
      if (path === '/api/documents') {
        if (method === 'GET') {
          const rows = await db.prepare('SELECT id,title,owner,updated FROM documents WHERE owner=? OR id IN (SELECT document FROM shares WHERE user=?) ORDER BY updated DESC').bind(user,user).all();
          return json(200,rows.results);
        }
        if (method === 'POST') {
          const {title='Untitled document',content=''}=data;
          if (!validate(title,content)) return error(400,'Use a title of 1–120 characters and content under 200,000 characters.');
          const id=crypto.randomUUID();
          await db.prepare('INSERT INTO documents (id,owner,title,content,updated) VALUES (?,?,?,?,?)').bind(id,user,title.trim(),clean(content),Date.now()).run();
          return json(201,{id});
        }
      }
      const match=path.match(/^\/api\/documents\/([a-zA-Z0-9-]+)(\/shares)?$/);
      if (!match) return error(404,'Not found');
      const doc=await db.prepare('SELECT * FROM documents WHERE id=? AND (owner=? OR EXISTS (SELECT 1 FROM shares WHERE document=documents.id AND user=?))').bind(match[1],user,user).first();
      if (!doc) return error(404,'Document not found or access unavailable');
      if (match[2]) {
        if (method !== 'POST') return error(405,'Method not allowed');
        if (doc.owner !== user) return error(403,'Only the owner can share this document');
        if (typeof data.email !== 'string' || data.email.length>254) return error(400,'Enter a teammate’s Google email address');
        const target=await db.prepare('SELECT id,email,name FROM users WHERE email=?').bind(data.email.trim().toLowerCase()).first();
        if (!target) return error(400,'Your teammate needs to sign in to ajaia-Gowrisankar once before you can share with them.');
        if (target.id === user) return error(400,'You already own this document');
        await db.prepare('INSERT OR IGNORE INTO shares VALUES (?,?)').bind(doc.id,target.id).run();
        return json(200,{ok:true,recipient:target});
      }
      if (method === 'GET') {
        const shares=await db.prepare('SELECT user FROM shares WHERE document=?').bind(doc.id).all();
        const people=await db.prepare('SELECT id,name,email FROM users WHERE id=? OR id IN (SELECT user FROM shares WHERE document=?)').bind(doc.owner,doc.id).all();
        return json(200,{...doc,shares:shares.results.map(row=>row.user),people:people.results});
      }
      if (method === 'PUT') {
        if (!validate(data.title,data.content) || !Number.isInteger(data.version)) return error(400,'Use a title of 1–120 characters, valid version, and content under 200,000 characters.');
        const result=await db.prepare('UPDATE documents SET title=?,content=?,version=version+1,updated=? WHERE id=? AND version=?').bind(data.title.trim(),clean(data.content),Date.now(),doc.id,data.version).run();
        if (!result.meta.changes) return error(409,'Someone saved a newer version. Copy your changes before reopening this document.');
        return json(200,{version:data.version+1});
      }
      return error(405,'Method not allowed');
    } catch (e) {
      console.error(JSON.stringify({event:'request_failed',name:e.name}));
      return error(503,'Storage is temporarily unavailable. Please retry.');
    }
  }
};
