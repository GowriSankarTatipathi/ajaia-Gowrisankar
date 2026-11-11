const $ = id => document.getElementById(id);
let me, users, current, dirty = false, busy = false;
async function api(path, method = 'GET', body) {
  const response = await fetch('/api' + path, {method, headers: {'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) { const error=new Error(result.error || 'Request failed'); error.status=response.status; throw error; }
  return result;
}
function report(error) { $('message').textContent = error.message; $('login-status').textContent = error.message; }
function lock(value) {
  busy = value;
  for (const el of document.querySelectorAll('button, input, select')) el.disabled = value;
  $('editor').contentEditable = String(!value);
}
async function run(action) {
  if (busy) return;
  lock(true);
  try { await action(); } catch (error) { report(error); } finally { lock(false); }
}
function changed() { dirty = true; $('status').textContent = 'Unsaved changes'; }
function leave() { return !dirty || confirm('You have unsaved changes. Discard them?'); }
function name(id) { return users.find(user => user.id === id)?.email || id; }
async function refresh() {
  const docs = await api('/documents');
  for (const group of ['owned', 'shared']) $(group).replaceChildren();
  for (const doc of docs) {
    const button = document.createElement('button');
    button.className = 'document'; button.textContent = doc.title;
    button.onclick = () => { if (!busy && leave()) run(() => openDocument(doc.id)); };
    $(doc.owner === me ? 'owned' : 'shared').append(button);
  }
  for (const group of ['owned', 'shared']) if (!$(group).children.length) $(group).textContent = 'No documents yet';
}
async function openDocument(id) {
  current = await api('/documents/' + id); dirty = false;
  users = [...users.filter(person => !current.people.some(other => other.id===person.id)), ...current.people];
  $('empty').hidden = true; $('workspace').hidden = false;
  $('title').value = current.title; $('editor').innerHTML = current.content;
  $('owner').textContent = 'Owned by ' + name(current.owner);
  $('status').textContent = 'All changes saved'; $('message').textContent = '';
  $('sharing').hidden = current.owner !== me;
  $('recipient').value = '';
  $('access').textContent = current.shares.length ? 'Can edit: ' + current.shares.map(name).join(', ') : 'Only the owner has access';
}
async function loadAccount() {
  const session = await api('/me'); me = session.user; users = session.users;
  $('account-name').textContent = users[0].name;
  $('logout').hidden = false; $('login-panel').hidden = true; document.querySelector('main').hidden = false;
  current = null; dirty = false; $('workspace').hidden = true; $('empty').hidden = false; await refresh();
}
async function showLogin() {
  $('login-panel').hidden=false; document.querySelector('main').hidden=true; $('logout').hidden=true; $('account-name').textContent='';
  const config=await api('/auth/config');
  if (!config.clientId) { $('login-status').textContent='Google sign-in is awaiting setup by the app owner.'; return; }
  const {nonce}=await api('/auth/challenge','POST',{});
  if (!window.google?.accounts?.id) await new Promise((resolve,reject)=>{
    const script=document.createElement('script'); script.src='https://accounts.google.com/gsi/client'; script.onload=resolve; script.onerror=()=>reject(new Error('Google sign-in could not load. Please retry.')); document.head.append(script);
  });
  google.accounts.id.initialize({client_id:config.clientId,nonce,callback:async response=>{
    $('login-status').textContent='Signing in…';
    try { await api('/auth/google','POST',{credential:response.credential}); await run(loadAccount); }
    catch(error) { $('login-status').textContent=error.message; $('retry-login').hidden=false; }
  }});
  $('google-signin').replaceChildren();
  google.accounts.id.renderButton($('google-signin'),{theme:'outline',size:'large',text:'signin_with',shape:'pill'});
  $('login-status').textContent='Your documents stay private until you share them.';
}
$('retry-login').onclick=()=>{ $('retry-login').hidden=true; showLogin().catch(report); };
$('logout').onclick=()=>{ if(!busy&&leave()) run(async()=>{ await api('/logout','POST',{}); current=null; dirty=false; window.google?.accounts?.id.disableAutoSelect(); await showLogin(); }); };
$('new').onclick = async () => {
  if (busy || !leave()) return;
  await run(async () => { const doc = await api('/documents', 'POST', {title: 'Untitled document'}); await refresh(); await openDocument(doc.id); });
};
$('title').oninput = changed; $('editor').oninput = changed;
$('toolbar').onmousedown = event => { if (event.target.closest('button')) event.preventDefault(); };
$('toolbar').onclick = event => {
  const button = event.target.closest('button'); if (!button) return;
  $('editor').focus(); document.execCommand(button.dataset.command, false, button.dataset.value || null); changed();
};
$('editor').onpaste = event => {
  event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); changed();
};
$('editor').ondrop = event => event.preventDefault();
$('save').onclick = async () => {
  if (!current || busy) return;
  lock(true);
  try {
    const result = await api('/documents/' + current.id, 'PUT', {title: $('title').value, content: $('editor').innerHTML, version: current.version});
    current.version = result.version; dirty = false; $('status').textContent = 'All changes saved'; $('message').textContent = ''; await refresh();
  } catch (error) { report(error); $('status').textContent = 'Not saved'; }
  finally { lock(false); }
};
$('share').onclick = async () => {
  if (!current || busy) return;
  await run(async () => {
    const result=await api('/documents/'+current.id+'/shares','POST',{email:$('recipient').value});
    const target=result.recipient; if(!users.some(person=>person.id===target.id)) users.push(target);
    if(!current.shares.includes(target.id)) current.shares.push(target.id);
    $('access').textContent='Can edit: '+current.shares.map(name).join(', ');
    $('message').textContent='Access granted. Your teammate can find this under Shared with you.';
  });
};
$('upload').onchange = async () => {
  const file = $('upload').files[0]; if (!file) return;
  if (busy || !leave()) { $('upload').value = ''; return; }
  lock(true);
  try {
    if (!file.name.toLowerCase().endsWith('.txt') || file.size > 100000) throw new Error('Choose a UTF-8 .txt file smaller than 100 KB.');
    const text = new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer());
    const div = document.createElement('div'); div.textContent = text;
    const doc = await api('/documents', 'POST', {title: file.name.replace(/\.txt$/i, '').slice(0, 120) || 'Imported document', content: '<p>' + div.innerHTML.replace(/\r?\n/g, '<br>') + '</p>'});
    await refresh(); await openDocument(doc.id);
  } catch (error) { report(error); } finally { $('upload').value = ''; lock(false); }
};
window.onbeforeunload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); $('save').click(); } });
run(async () => { try { await loadAccount(); } catch(error) { if(error.status===401) await showLogin(); else throw error; } });
