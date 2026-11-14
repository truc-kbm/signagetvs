import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canvasSize, initialState, manifestFor, screenInput } from '../src/lib/model';
import { inspectImage } from '../src/lib/media';
import { sign, verify } from '../src/lib/auth';
import sharp from 'sharp';
process.env.SESSION_SECRET = 'test-secret-with-at-least-32-characters';

test('rotation swaps the content canvas only for quarter turns', () => {
  for (const [w, h] of [[1920,1080], [1080,1920], [1366,768]]) {
    for (const angle of [0,90,180,270]) assert.deepEqual(canvasSize(w,h,angle), angle % 180 ? { width:h,height:w } : { width:w,height:h });
  }
});
test('manifest exposes selected content only; settings validate playback limits', () => {
  const state = initialState(); state.loginAttempts.private = { count:3,until:Date.now()+1000 };
  const manifest = manifestFor(state,state.screens[0]);
  assert.equal('loginAttempts' in manifest,false); assert.equal('assets' in manifest,false);
  assert.equal(screenInput.safeParse({ ...state.screens[0], rotation:45 }).success,false);
  assert.equal(screenInput.safeParse({ ...state.screens[0], items:[{ assetId:'a',duration:0 }] }).success,false);
  assert.equal(screenInput.safeParse({ ...state.screens[0], items:Array.from({length:21},()=>({assetId:'a',duration:15})) }).success,false);
});
test('signed credentials reject tampering, expiry and the wrong scope', () => {
  const token = sign({ scope:'test',exp:Date.now()+60000 });
  assert.ok(verify(token,'test')); assert.equal(verify(token+'x','test'),null);
  assert.equal(verify(token,'other'),null); assert.equal(verify(sign({scope:'test',exp:0}),'test'),null);
});
test('image validation decodes PNG/JPEG and rejects disguised non-images', async () => {
  const png = await sharp({create:{width:1920,height:1080,channels:3,background:'#245b3d'}}).png().toBuffer();
  const info = await inspectImage(png); assert.equal(info.width,1920); assert.equal(info.height,1080);
  await assert.rejects(inspectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')));
  await assert.rejects(inspectImage(Buffer.from('not-an-image')));
});
