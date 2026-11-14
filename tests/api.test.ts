import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
let server: ChildProcess, origin: string, folder: string, cookie: string, output = '';
let assetId: string;
before(async () => {
  folder = await mkdtemp(join(tmpdir(),'signage-api-'));
  const port = await new Promise<number>(resolve => { const socket=createServer(); socket.listen(0,'127.0.0.1',()=>{ const address=socket.address(); const port=typeof address==='object' && address ? address.port : 0; socket.close(()=>resolve(port)); }); });
  origin = `http://127.0.0.1:${port}`;
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{ env:{...process.env,MANAGE_PIN:'4321',SESSION_SECRET:randomBytes(32).toString('hex'),STORAGE_DRIVER:'local',SIGNAGE_DATA_DIR:folder},stdio:['ignore','pipe','pipe'] });
  server.stdout?.on('data',d=>output+=d.toString()); server.stderr?.on('data',d=>output+=d.toString());
  for(let i=0;i<100;i++){ try { if((await fetch(origin+'/api/player/XLC/1')).ok) return; }catch{} await new Promise(r=>setTimeout(r,100)); }
  throw new Error('Server did not become ready: '+output);
}, { timeout: 20000 });
after(async()=>{ if(server?.exitCode === null) { server.kill('SIGTERM'); await new Promise<void>(resolve=>server.once('exit',()=>resolve())); } if(folder) await rm(folder,{recursive:true,force:true}); });
function req(path: string, method='GET', body?: unknown, auth=true, source=origin) {
  return fetch(origin+path,{method,headers:{Origin:source,...(auth&&cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
test('PIN gates APIs, rejects CSRF and issues an HttpOnly session', async()=>{
  assert.equal((await req('/api/manage','GET',undefined,false)).status,401);
  assert.equal((await req('/api/screens','POST',undefined,false)).status,401);
  assert.equal((await req('/api/session','POST',{pin:'4321'},false,'https://evil.example')).status,403);
  assert.equal((await req('/api/session','POST',{pin:'0000'},false)).status,401);
  const login=await req('/api/session','POST',{pin:'4321'},false); assert.equal(login.status,200);
  const setCookie=login.headers.get('set-cookie')!; assert.match(setCookie,/httponly/i); cookie=setCookie.split(';')[0];
  const manage=await req('/api/manage'); assert.equal(manage.status,200); assert.match(manage.headers.get('cache-control')!,/no-store/);
});
test('upload validates bytes, preserves large files and serves immutable images', async()=>{
  const fake=new FormData(); fake.set('file',new File(['<script>bad</script>'],'fake.png',{type:'image/png'}));
  const invalid=await fetch(origin+'/api/media',{method:'POST',headers:{Origin:origin,Cookie:cookie},body:fake}); assert.equal(invalid.status,422);
  const bytes=await sharp(randomBytes(1400*1400*3),{raw:{width:1400,height:1400,channels:3}}).png().toBuffer(); assert.ok(bytes.length>4.5*1024*1024);
  const form=new FormData(); form.set('file',new File([new Uint8Array(bytes)],'test-large.png',{type:'image/png'}));
  const uploaded=await fetch(origin+'/api/media',{method:'POST',headers:{Origin:origin,Cookie:cookie},body:form}); assert.equal(uploaded.status,201,await uploaded.clone().text());
  const asset=await uploaded.json(); assetId=asset.id; assert.equal(asset.bytes,bytes.length);
  const image=await fetch(origin+asset.url); assert.equal(image.status,200); assert.match(image.headers.get('cache-control')!,/immutable/); assert.equal((await image.arrayBuffer()).byteLength,bytes.length);
});
test('publish is atomic, concurrent edits conflict, URL survives rename and reload gets newest snapshot', async()=>{
  const state=await (await req('/api/manage')).json(); const screen=state.screens[0];
  const before=await (await req('/api/player/XLC/1','GET',undefined,false)).json();
  const body={...screen,name:'Menu mới',items:[{assetId,duration:5}],rotation:90,orientation:'portrait',baseRevision:screen.revision};
  const responses=await Promise.all([req(`/api/screens/${screen.id}`,'PATCH',body),req(`/api/screens/${screen.id}`,'PATCH',body)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const response=await req('/api/player/XLC/1','GET',undefined,false); assert.match(response.headers.get('cache-control')!,/no-store/);
  const latest=await response.json(); assert.equal(latest.name,'Menu mới'); assert.equal(latest.number,1); assert.equal(latest.revision,1); assert.equal(latest.items[0].id,assetId);
  const page = await req('/XLC/1', 'GET', undefined, false);
  assert.equal(page.status, 200); assert.match(page.headers.get('content-type')!, /text\/html/);
  assert.match(page.headers.get('cache-control')!, /no-store/);
  const html = await page.text();
  assert.doesNotMatch(html, /\/_next\/|WebSocket|location\.reload/);
  assert.match(html, new RegExp(`/media/${assetId}\\.png`));
  const snapshot = JSON.parse(html.match(/<script id="tv-snapshot" type="application\/json">([\s\S]*?)<\/script>/)![1]);
  assert.equal(snapshot.revision, 1); assert.equal(snapshot.rotation, 90);
  assert.equal(before.items.length,0); assert.equal(before.revision,0);
  assert.equal((await req(`/api/screens/${screen.id}`,'PATCH',{...body,baseRevision:1,items:[{assetId:'other-restaurant',duration:15}]})).status,422);
  const onDisk=JSON.parse(await readFile(join(folder,'settings.json'),'utf8')); assert.equal(onDisk.screens[0].revision,1);
});
test('concurrent TV creation allocates unique numbers and archive takes effect on next request', async()=>{
  const created=await Promise.all([req('/api/screens','POST'),req('/api/screens','POST')]); const screens=await Promise.all(created.map(r=>r.json()));
  assert.equal(new Set(screens.map(s=>s.number)).size,2);
  assert.equal((await req(`/api/screens/${screens[0].id}`,'DELETE')).status,200);
  assert.equal((await req(`/api/player/XLC/${screens[0].number}`,'GET',undefined,false)).status,404);
  assert.equal((await req(`/XLC/${screens[0].number}`, 'GET', undefined, false)).status, 404);
  const next=await (await req('/api/screens','POST')).json(); assert.ok(next.number>Math.max(...screens.map(s=>s.number)));
});
test('wrong PIN attempts are persisted and throttled', async()=>{
  for(let i=0;i<5;i++) assert.equal((await req('/api/session','POST',{pin:'0000'},false)).status,401);
  assert.equal((await req('/api/session','POST',{pin:'4321'},false)).status,429);
  const logout=await req('/api/session','DELETE'); assert.equal(logout.status,200); assert.match(logout.headers.get('set-cookie')!,/expires=Thu, 01 Jan 1970/i);
});
