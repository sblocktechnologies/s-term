const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MAX_CLIPBOARD_IMAGE_BYTES, saveClipboardImage } = require('../electron/clipboard-images.cjs');

function fakeImage(bytes, size = { width: 32, height: 32 }) {
  return {
    isEmpty: () => bytes.length === 0,
    getSize: () => size,
    toPNG: () => bytes,
  };
}

test('stores clipboard PNGs in a permission-restricted temporary directory', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sterm-image-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'images');
  const content = Buffer.from('valid-test-png');
  const file = saveClipboardImage(fakeImage(content), directory);

  assert.ok(file?.startsWith(directory));
  assert.deepEqual(fs.readFileSync(file), content);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  }
});

test('rejects oversized or invalid clipboard images', () => {
  const directory = path.join(os.tmpdir(), 'sterm-image-test-invalid');
  assert.equal(saveClipboardImage(fakeImage(Buffer.alloc(0)), directory), null);
  assert.throws(
    () => saveClipboardImage(fakeImage(Buffer.alloc(1), { width: 20_000, height: 20_000 }), directory),
    /too large/,
  );
  assert.throws(
    () => saveClipboardImage(fakeImage(Buffer.alloc(MAX_CLIPBOARD_IMAGE_BYTES + 1)), directory),
    /too large/,
  );
});
