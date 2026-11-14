import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { playerDocument } from '../src/lib/player-document';
import { PLAYER_SCRIPT } from '../src/lib/player-script';
import { initialState, type Manifest } from '../src/lib/model';

function manifest(urls = ['/a.png', '/b.png']): Manifest {
  return { ...initialState().screens[0], items: urls.map((url, i) => ({ id: String(i), name: url, url, width: 640, height: 360, bytes: 10, createdAt: '', duration: 5 })) };
}

test('TV snapshot escapes markup and renders rotation without needing Next hydration', () => {
  const data = manifest(); data.name = '</title><script>alert(1)</script>';
  data.items[0].name = '</script><script>alert(2)</script>';
  data.items[0].url = '/image.png?x=" onerror="alert(3)'; data.rotation = 90;
  const html = playerDocument(data);
  const snapshot = html.match(/<script id="tv-snapshot" type="application\/json">([\s\S]*?)<\/script>/)![1];
  assert.deepEqual(JSON.parse(snapshot), data);
  assert.equal((html.match(/<script[ >]/g) || []).length, 2);
  assert.match(html, /width:100vh;height:100vw/);
  assert.match(html, /&quot; onerror=&quot;/);
  assert.doesNotMatch(html, /\/_next\/|WebSocket|location\.reload|http-equiv="refresh"/);
});

function playerHarness(data: Manifest, missing: string[] = []) {
  const timers = new Map<number, { fn: () => void; delay: number }>();
  let timerId = 0;
  const requests: string[] = [];
  const retained = new Set<string>();
  const events: Record<string, (event: { persisted: boolean }) => void> = {};
  const image = { src: data.items[0].url };
  const status = { textContent: '', hidden: false };
  const elements: Record<string, unknown> = { 'tv-snapshot': { textContent: JSON.stringify(data) }, 'tv-frame': { style: {} }, 'tv-image': image, 'tv-status': status };
  runInNewContext(PLAYER_SCRIPT, {
    document: { getElementById: (id: string) => elements[id], documentElement: { clientWidth: 1920, clientHeight: 1080 } },
    window: { addEventListener: (name: string, fn: typeof events[string]) => { events[name] = fn; } },
    setTimeout: (fn: () => void, delay: number) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout: (id: number) => timers.delete(id),
    AbortController,
    Image: class { onload?: () => void; onerror?: () => void; set src(_: string) { queueMicrotask(() => this.onload?.()); } },
    URL: { createObjectURL: (url: string) => { const blob = 'blob:' + url; retained.add(blob); return blob; }, revokeObjectURL: (url: string) => retained.delete(url) },
    fetch: async (url: string) => { requests.push(url); return { ok: !missing.includes(url), blob: async () => url }; },
  });
  return { requests, retained, image, status, events, advanceSlide() {
    // The status hide timer precedes the slideshow timer; keep it separate.
    const entry = [...timers.entries()].reverse().find(([, task]) => task.delay === 5000);
    assert.ok(entry); timers.delete(entry[0]); entry[1].fn();
  } };
}

test('TV downloads once and switches retained images without contacting an offline server', async () => {
  const player = playerHarness(manifest());
  await new Promise(resolve => setImmediate(resolve));
  assert.match(player.status.textContent, /Đã tải đủ ảnh/);
  assert.deepEqual(player.requests.sort(), ['/a.png', '/b.png']);
  assert.equal(player.image.src, 'blob:/a.png');
  player.advanceSlide(); assert.equal(player.image.src, 'blob:/b.png');
  player.advanceSlide(); assert.equal(player.image.src, 'blob:/a.png');
  for (let i = 0; i < 30; i++) player.advanceSlide();
  assert.equal(player.requests.length, 2);
  assert.equal('online' in player.events, false);
  player.events.pagehide({ persisted: false }); assert.equal(player.retained.size, 0);
});

test('a later failed image never revokes or clears the successfully retained image', async () => {
  const player = playerHarness(manifest(['/a.png', '/b.png', '/missing.png']), ['/missing.png']);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(player.status.textContent, /Đã giữ 2\/3/);
  assert.equal(player.retained.size, 2);
  for (let i = 0; i < 20; i++) { player.advanceSlide(); assert.ok(player.retained.has(player.image.src)); }
  assert.equal(player.requests.length, 3);
});
