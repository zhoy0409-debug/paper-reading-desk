// Start the bundled English dictionary while the OCR runtime is loading and compiling.
// The upstream worker requests this same file after it has initialized the runtime.
const ocrDirectory = new URL('./vendor/ocr/', self.location.href);
const dictionaryURL = new URL('eng.traineddata.gz', ocrDirectory).href;
const fetchResource = self.fetch.bind(self);
let dictionary = fetchResource(dictionaryURL, {priority:'high'})
  .then(response => response.ok ? response.arrayBuffer() : null).catch(() => null);

self.fetch = function(input, options) {
  const url = typeof input === 'string' ? input : input.url || input.href;
  if (url !== dictionaryURL) return fetchResource(input, options);
  self.fetch = fetchResource;
  const loading = dictionary;
  dictionary = null;
  return loading.then(bytes => bytes ? new Response(bytes) : fetchResource(input, options));
};
importScripts(new URL('worker.min.js', ocrDirectory).href);
