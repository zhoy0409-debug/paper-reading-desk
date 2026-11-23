/* Local first-page preview for a bounded subset of classic TIFF. No network or dependencies. */
(() => {
  'use strict';

  const MiB = 1024 * 1024;
  const MAX_FILE = 32 * MiB;
  const MAX_PIXELS = 8000000;
  const MAX_AXIS = 8192;
  const MAX_STRIP = 32 * MiB;
  const MAX_TAGS = 512;
  const unsignedSize = {3: 2, 4: 4};
  const tags = new Set([256, 257, 258, 259, 262, 266, 273, 274, 277, 278, 279,
    284, 317, 320, 322, 323, 324, 325, 338, 339, 34675]);
  const compressionNames = {1: '无压缩', 5: 'LZW', 8: 'Deflate', 32773: 'PackBits', 32946: 'Deflate'};

  const invalid = () => new Error('无法读取 TIFF：文件不完整，或图像数据与 TIFF 标签不一致。请尝试重新导出。');
  const unsupported = detail => new Error('暂不支持此 TIFF（' + detail + '）。请先从原软件导出为 PNG。');
  const large = () => new Error('此 TIFF 超出本地预览上限（文件 32 MiB、每边 8192 像素、总计 800 万像素，单条解压数据 32 MiB）。请先导出较小的 PNG。');

  function inspect(buffer) {
    const view = new DataView(buffer);
    const size = view.byteLength;
    const fits = (pos, length) => Number.isSafeInteger(pos) && Number.isSafeInteger(length) &&
      pos >= 0 && length >= 0 && pos <= size - length;
    if (!fits(0, 8)) throw invalid();
    const marker = view.getUint16(0, false);
    if (marker !== 0x4949 && marker !== 0x4d4d) throw invalid();
    const little = marker === 0x4949;
    const u16 = pos => view.getUint16(pos, little);
    const u32 = pos => view.getUint32(pos, little);
    const magic = u16(2);
    if (magic === 43) throw unsupported('BigTIFF');
    if (magic !== 42) throw invalid();
    const ifd = u32(4);
    if (ifd < 8 || !fits(ifd, 2)) throw invalid();
    const entries = u16(ifd);
    if (entries > MAX_TAGS) throw unsupported('图像目录包含过多标签');
    if (!fits(ifd, 2 + entries * 12 + 4)) throw invalid();

    const fields = new Map();
    for (let i = 0; i < entries; ++i) {
      const at = ifd + 2 + i * 12;
      const tag = u16(at);
      if (!tags.has(tag)) continue;
      if (fields.has(tag)) throw invalid();
      fields.set(tag, {type: u16(at + 2), count: u32(at + 4), at: at + 8});
    }
    function values(tag, max) {
      const f = fields.get(tag);
      if (!f) return null;
      const bytes = unsignedSize[f.type];
      if (!bytes || !f.count || f.count > max) throw invalid();
      const length = bytes * f.count;
      const at = length <= 4 ? f.at : u32(f.at);
      if (!fits(at, length)) throw invalid();
      const get = bytes === 2 ? u16 : u32;
      return Array.from({length: f.count}, (_, i) => get(at + i * bytes));
    }
    function field(tag, otherwise) {
      return values(tag, 1)?.[0] ?? otherwise;
    }
    if ([322, 323, 324, 325].some(tag => fields.has(tag))) throw unsupported('分块存储');
    const width = field(256, 0), height = field(257, 0);
    if (!width || !height) throw invalid();
    if (width > MAX_AXIS || height > MAX_AXIS || width * height > MAX_PIXELS) throw large();

    const photometric = field(262, -1);
    if (![0, 1, 2, 3].includes(photometric)) throw unsupported('颜色模式 ' + photometric);
    const samples = field(277, 1);
    const bitsList = values(258, 4) || [1];
    const bits = bitsList[0];
    if (bitsList.some(bit => bit !== bits) || (bitsList.length !== 1 && bitsList.length !== samples)) {
      throw unsupported('通道位深不同');
    }
    if (field(284, 1) !== 1) throw unsupported('分离色彩平面');
    const sampleFormat = values(339, 4);
    if (sampleFormat && ((sampleFormat.length !== 1 && sampleFormat.length !== samples) ||
      sampleFormat.some(type => type !== 1))) throw unsupported('浮点或有符号像素');
    if (photometric === 2) {
      if (![3, 4].includes(samples) || ![8, 16].includes(bits)) throw unsupported('RGB 通道数或位深');
    } else if (samples !== 1 ||
      !(photometric === 3 ? [1, 2, 4, 8] : [1, 2, 4, 8, 16]).includes(bits)) {
      throw unsupported('灰度或索引色通道数或位深');
    }
    const extra = values(338, 1)?.[0] ?? 0;
    if ((samples !== 4 && fields.has(338)) || ![0, 1, 2].includes(extra)) {
      throw unsupported('额外图像通道');
    }
    const compression = field(259, 1);
    if (!Object.hasOwn(compressionNames, compression)) throw unsupported('压缩类型 ' + compression);
    const predictor = field(317, 1);
    if (predictor !== 1 && !(predictor === 2 && (bits === 8 || bits === 16))) {
      throw unsupported('预测器或位深组合');
    }
    const orientation = field(274, 1);
    if (orientation < 1 || orientation > 8) throw unsupported('图像方向 ' + orientation);
    const fill = field(266, 1);
    if (fill !== 1 && !(fill === 2 && bits < 8 && compression === 1)) throw unsupported('位填充顺序');

    const rows = field(278, 0xffffffff);
    if (!rows) throw invalid();
    const stripCount = Math.ceil(height / rows);
    const offsets = values(273, stripCount), counts = values(279, stripCount);
    if (!offsets || !counts || offsets.length !== stripCount || counts.length !== stripCount ||
      offsets.some((offset, i) => offset < 8 || !counts[i] || !fits(offset, counts[i]))) throw invalid();
    // Overlapping/repeated offsets must not turn a small file into unbounded decoder work.
    if (counts.reduce((total, count) => total + count, 0) > MAX_FILE) throw large();
    const rowBytes = Math.ceil(width * samples * bits / 8);
    if (rowBytes * Math.min(rows, height) > MAX_STRIP) throw large();

    let palette;
    if (photometric === 3) {
      const n = 2 ** bits * 3;
      palette = values(320, n);
      if (!palette || palette.length !== n || fields.get(320).type !== 3) throw invalid();
    }

    return {little, width, height, photometric, samples, bits, extra, compression, predictor,
      orientation, fill, rows, offsets, counts, rowBytes, palette, profile: fields.has(34675),
      more: u32(ifd + 2 + entries * 12) !== 0};
  }

  function unpackBits(src, length) {
    const out = new Uint8Array(length);
    let s = 0, d = 0;
    while (s < src.length && d < length) {
      const code = src[s++];
      if (code === 128) continue;
      const count = code <= 127 ? code + 1 : 257 - code;
      if (count > length - d) throw invalid();
      if (code <= 127) {
        if (count > src.length - s) throw invalid();
        out.set(src.subarray(s, s + count), d);
        s += count;
      } else {
        if (s >= src.length) throw invalid();
        out.fill(src[s++], d, d + count);
      }
      d += count;
    }
    if (d !== length) throw invalid();
    return out;
  }

  function unpackLzw(src, length) {
    const out = new Uint8Array(length);
    const prefix = new Uint16Array(4096);
    const suffix = new Uint8Array(4096), stack = new Uint8Array(4096);
    let offset = 0, carry = 0, buffered = 0, written = 0;
    let bits = 9, next = 258, last = -1, first = 0;

    while (true) {
      while (buffered < bits) {
        if (offset >= src.length) throw invalid();
        carry = (carry << 8) | src[offset++];
        buffered += 8;
      }
      buffered -= bits;
      const item = (carry >>> buffered) & ((1 << bits) - 1);
      if (item === 256) {
        bits = 9; next = 258; last = -1;
        continue;
      }
      if (item === 257) {
        if (written !== length) throw invalid();
        return out;
      }

      let node = item, used = 0;
      if (node === next && last >= 0 && next < 4096) {
        stack[used++] = first;
        node = last;
      } else if (node >= next) throw invalid();
      while (node >= 258) {
        if (used >= stack.length - 1 || prefix[node] >= node) throw invalid();
        stack[used++] = suffix[node];
        node = prefix[node];
      }
      if (node > 255) throw invalid();
      first = node;
      stack[used++] = node;
      if (used > length - written) throw invalid();
      while (used) out[written++] = stack[--used];

      if (last >= 0 && next < 4096) {
        prefix[next] = last;
        suffix[next++] = first;
        // Classic TIFF LZW uses "early change" when advancing the code width.
        if (bits < 12 && next === (1 << bits) - 1) ++bits;
      }
      last = item;
    }
  }

  async function inflate(src, length) {
    if (typeof DecompressionStream !== 'function') throw unsupported('当前浏览器无法解压 Deflate');
    let at = 0, used = 0;
    const input = new ReadableStream({
      pull(controller) {
        if (at >= src.length) return controller.close();
        // A small compressed chunk limits amplification inside the native stream itself.
        const end = Math.min(at + 2048, src.length);
        controller.enqueue(src.subarray(at, end));
        at = end;
      }
    });
    const reader = input.pipeThrough(new DecompressionStream('deflate')).getReader();
    const out = new Uint8Array(length);
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        if (value.length > length - used) throw invalid();
        out.set(value, used);
        used += value.length;
      }
      if (used !== length) throw invalid();
      return out;
    } catch {
      try { await reader.cancel(); } catch { /* Stream already released its buffers. */ }
      throw invalid();
    } finally {
      reader.releaseLock();
    }
  }

  async function stripBytes(input, spec, strip, length) {
    const offset = spec.offsets[strip];
    const src = input.subarray(offset, offset + spec.counts[strip]);
    switch (spec.compression) {
      case 1:
        if (src.length < length) throw invalid();
        return src.subarray(0, length);
      case 32773: return unpackBits(src, length);
      case 5: return unpackLzw(src, length);
      default: return inflate(src, length);
    }
  }

  function axis(spec, y) {
    const w = spec.width, h = spec.height;
    switch (spec.orientation) {
      case 1: return [y * w, 1];
      case 2: return [y * w + w - 1, -1];
      case 3: return [(h - y) * w - 1, -1];
      case 4: return [(h - 1 - y) * w, 1];
      case 5: return [y, h];
      case 6: return [h - 1 - y, h];
      case 7: return [(w - 1) * h + h - 1 - y, -h];
      case 8: return [(w - 1) * h + y, -h];
      default: throw invalid();
    }
  }

  function writeStrip(dest, pixels, spec, y0, rows) {
    const {width, photometric, samples, bits, extra, predictor, little, rowBytes, palette, fill} = spec;
    const max = (1 << bits) - 1;
    const behind = new Uint16Array(samples);
    const values = new Uint16Array(samples);
    const palSize = 2 ** bits;
    const to8 = bits === 8 ? x => x : x => Math.round(x * 255 / max);
    function flip(byte) {
      byte = ((byte & 0x55) << 1) | ((byte >>> 1) & 0x55);
      byte = ((byte & 0x33) << 2) | ((byte >>> 2) & 0x33);
      return ((byte & 0x0f) << 4) | (byte >>> 4);
    }
    for (let j = 0; j < rows; ++j) {
      const [start, step] = axis(spec, y0 + j);
      const rowOffset = j * rowBytes;
      let dx = start * 4, p = rowOffset;
      behind.fill(0);
      for (let x = 0; x < width; ++x, dx += step * 4) {
        for (let k = 0; k < samples; ++k) {
          let n;
          if (bits === 8) n = pixels[p++];
          else if (bits === 16) {
            n = little ? pixels[p] + pixels[p + 1] * 256 : pixels[p] * 256 + pixels[p + 1];
            p += 2;
          } else {
            const bit = x * bits;
            const byte = pixels[rowOffset + (bit >>> 3)];
            n = ((fill === 2 ? flip(byte) : byte) >>> (8 - bits - (bit & 7))) & max;
          }
          if (predictor === 2) behind[k] = n = (n + behind[k]) & max;
          values[k] = n;
        }

        let a = 255;
        if (photometric === 2) {
          const premultiplied = extra === 1;
          if (samples === 4 && extra) a = to8(values[3]);
          for (let k = 0; k < 3; ++k) {
            dest[dx + k] = premultiplied
              ? (values[3] ? Math.min(255, Math.round(values[k] * 255 / values[3])) : 0)
              : to8(values[k]);
          }
        } else if (photometric === 3) {
          const index = values[0];
          dest[dx] = palette[index] >>> 8;
          dest[dx + 1] = palette[index + palSize] >>> 8;
          dest[dx + 2] = palette[index + palSize * 2] >>> 8;
        } else {
          dest[dx] = dest[dx + 1] = dest[dx + 2] = to8(photometric === 0 ? max - values[0] : values[0]);
        }
        dest[dx + 3] = a;
      }
    }
  }

  async function convert(file) {
    if (!file || !Number.isSafeInteger(file.size) || file.size < 8 || typeof file.arrayBuffer !== 'function') {
      throw invalid();
    }
    if (file.size > MAX_FILE) throw large();
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength !== file.size) throw invalid();
    const input = new Uint8Array(buffer), spec = inspect(buffer);
    const width = spec.orientation >= 5 ? spec.height : spec.width;
    const height = spec.orientation >= 5 ? spec.width : spec.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('当前浏览器无法创建 TIFF 预览。请将 TIFF 导出为 PNG 后再导入。');
      const img = ctx.createImageData(width, height);
      const rowBatch = Math.max(1, Math.floor(500000 / spec.width));
      let worked = 0;
      for (let y = 0, strip = 0; y < spec.height; ++strip) {
        const rows = Math.min(spec.rows, spec.height - y);
        const bytes = await stripBytes(input, spec, strip, spec.rowBytes * rows);
        for (let j = 0; j < rows; j += rowBatch) {
          const count = Math.min(rowBatch, rows - j);
          const slice = bytes.subarray(j * spec.rowBytes, (j + count) * spec.rowBytes);
          writeStrip(img.data, slice, spec, y + j, count);
          worked += count * spec.width;
          if (worked >= 490000 && y + j + count < spec.height) {
            worked = 0;
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        y += rows;
      }
      ctx.putImageData(img, 0, 0);
      const previewBlob = await new Promise((resolve, reject) => canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('此 TIFF 未能生成 PNG 预览。请先从原软件导出为 PNG。')),
        'image/png'));
      const colors = spec.photometric === 2 ? (spec.extra ? 'RGB（带透明度）' : 'RGB') :
        spec.photometric === 3 ? '索引色' : '灰度';
      const facts = ['TIFF 第 1 页：' + width + ' × ' + height + ' 像素，' + colors + '，' +
        spec.bits + ' 位/通道，' + compressionNames[spec.compression] + '。'];
      const warnings = [];
      if (spec.more) warnings.push('此 TIFF 包含其他页面，仅预览第 1 页。');
      if (spec.bits > 8) warnings.push('PNG 预览已降为 8 位/通道，不用于像素强度定量。');
      if (spec.profile) warnings.push('此预览未应用原 TIFF 的 ICC 色彩配置。');
      if (spec.samples === 4 && !spec.extra) warnings.push('第 4 个通道未标为透明度，预览仅显示 RGB。');
      return {previewBlob, facts, warnings};
    } finally {
      canvas.width = canvas.height = 0;
    }
  }

  // Serial conversion bounds the working memory even when callers queue a group of images.
  let queue = Promise.resolve();
  window.PaperStoryTiff = Object.freeze({
    read(file) {
      const next = queue.then(() => convert(file));
      queue = next.then(() => {}, () => {});
      return next;
    }
  });
})();
