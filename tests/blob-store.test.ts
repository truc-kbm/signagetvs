import { test } from "node:test";
import assert from "node:assert/strict";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { initialState } from "../src/lib/model";
import { mutateState, readState } from "../src/lib/store";

test("Blob saves request an uncompressed snapshot and retain conditional writes", async t => {
  const dispatcher = getGlobalDispatcher();
  const env = { ...process.env };
  const mock = new MockAgent();
  mock.disableNetConnect();
  setGlobalDispatcher(mock);
  process.env.STORAGE_DRIVER = "blob";
  process.env.VERCEL_BLOB_RETRIES = "0";
  process.env.CONFIG_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teststore_testtoken";
  process.env.MEDIA_BLOB_READ_WRITE_TOKEN = "unused-test-token";
  t.after(async () => {
    setGlobalDispatcher(dispatcher);
    process.env = env;
    await mock.close();
  });
  let etag = '"v1"';
  let reads = 0;
  mock.get("https://teststore.private.blob.vercel-storage.com")
    .intercept({ path: "/xlc/settings.json?cache=0", method: "GET", headers: { "accept-encoding": "identity" } })
    .reply(() => {
    reads++;
    return { statusCode: 200, data: JSON.stringify(initialState()), responseOptions: { headers: { etag } } };
  }).persist();
  const pool = mock.get("https://vercel.com");
  pool.intercept({ path: /./, method: "PUT", headers: { "x-if-match": '"v1"' } })
    .reply(412, { error: { code: "precondition_failed", message: "ETag mismatch" } });
  pool.intercept({ path: /./, method: "PUT", headers: { "x-if-match": '"v1"' } })
    .reply(200, { url: "https://teststore.private.blob.vercel-storage.com/xlc/settings.json",
      pathname: "xlc/settings.json", contentType: "application/json", contentDisposition: "inline", etag: '"v2"' });
  assert.equal(await mutateState(state => { state.screens[0].name = "Menu"; return state.screens[0].name; }), "Menu");
  assert.equal(reads, 2);
  mock.assertNoPendingInterceptors();

  for (etag of ['W/"v2"', ""]) {
    await assert.rejects(mutateState(() => assert.fail("Must not mutate an unsafe snapshot")), { status: 503 });
    // Playback remains readable even if storage cannot supply a write validator.
    assert.equal((await readState()).restaurant.slug, "XLC");
  }
});
