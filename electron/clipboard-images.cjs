const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAX_CLIPBOARD_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_CLIPBOARD_IMAGE_PIXELS = 100_000_000;

function saveClipboardImage(image, directory) {
  if (!image || image.isEmpty()) return null;
  const size = image.getSize();
  if (size.width < 1 || size.height < 1 || size.width * size.height > MAX_CLIPBOARD_IMAGE_PIXELS) {
    throw new Error('Clipboard image is too large');
  }
  const png = image.toPNG();
  if (!Buffer.isBuffer(png) || png.length < 1 || png.length > MAX_CLIPBOARD_IMAGE_BYTES) {
    throw new Error('Clipboard image is too large');
  }

  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(directory, 0o700);
  } catch {
    // Windows does not use POSIX directory modes.
  }
  const file = path.join(directory, `s-term-${crypto.randomUUID()}.png`);
  fs.writeFileSync(file, png, { flag: 'wx', mode: 0o600 });
  return file;
}

module.exports = {
  MAX_CLIPBOARD_IMAGE_BYTES,
  MAX_CLIPBOARD_IMAGE_PIXELS,
  saveClipboardImage,
};
