// Runs the on-device models (background removal and item recognition) off the main thread,
// so the app keeps scrolling and drawing smoothly while photos are processed.
let T = null, RB = null, CLIP = null, queue = Promise.resolve();
async function loadT() {
  if (!T) { T = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js'); T.env.allowLocalModels = false; }
  return T;
}
// CPU version only: the graphics-chip (WebGPU) version used too much memory on iPhone and crashed the app.
async function loadRmbg() {
  if (RB) return RB;
  const T = await loadT();
  const [model, processor] = await Promise.all([
    T.AutoModel.from_pretrained('briaai/RMBG-1.4', { config: { model_type: 'custom' } }),
    T.AutoProcessor.from_pretrained('briaai/RMBG-1.4', { config: { do_normalize: true, do_pad: false, do_rescale: true, do_resize: true, image_mean: [0.5, 0.5, 0.5], feature_extractor_type: 'ImageFeatureExtractor', image_std: [1, 1, 1], resample: 2, rescale_factor: 0.00392156862745098, size: { width: 1024, height: 1024 } } })]);
  return RB = { model, processor };
}
async function loadClip() {
  if (CLIP) return CLIP;
  const T = await loadT(), M = 'Xenova/clip-vit-base-patch32';
  const [tok, textModel, proc, vision] = await Promise.all([T.AutoTokenizer.from_pretrained(M), T.CLIPTextModelWithProjection.from_pretrained(M), T.AutoProcessor.from_pretrained(M), T.CLIPVisionModelWithProjection.from_pretrained(M)]);
  return CLIP = { tok, textModel, proc, vision };
}
const ops = {
  async warm({ rmbg, clip }) { if (rmbg) await loadRmbg(); if (clip) await loadClip(); return true; },
  // returns a one-byte-per-pixel mask at the photo's own size
  async rmbg({ blob }, say) {
    if (!RB) say('rmbg-download');
    const { model, processor } = await loadRmbg();
    say('rmbg-run');
    const image = await T.RawImage.fromBlob(blob);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });
    const mask = await T.RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);
    const data = Uint8Array.from(mask.data);
    return { result: { mask: data, w: image.width, h: image.height }, transfer: [data.buffer] };
  },
  async image({ blob }, say) {
    if (!CLIP) say('clip-download');
    const C = await loadClip();
    say('clip-run');
    const { pixel_values } = await C.proc(await T.RawImage.fromBlob(blob));
    const { image_embeds } = await C.vision({ pixel_values });
    const ie = Float32Array.from(image_embeds.data);
    return { result: ie, transfer: [ie.buffer] };
  },
  async text({ prompts }, say) {
    if (!CLIP) say('clip-download');
    const C = await loadClip();
    const { text_embeds } = await C.textModel(C.tok(prompts, { padding: true, truncation: true }));
    const te = Float32Array.from(text_embeds.data);
    return { result: { te, dim: text_embeds.dims[1] }, transfer: [te.buffer] };
  },
};
self.onmessage = e => {
  const { id, op, args } = e.data;
  const say = s => self.postMessage({ id, status: s });
  // one job at a time: the models share a single CPU thread
  queue = queue.then(async () => {
    try { const out = await ops[op](args || {}, say); self.postMessage({ id, ok: true, result: out?.result ?? out }, out?.transfer || []); }
    catch (err) { self.postMessage({ id, ok: false, error: String(err?.message || err) }); }
  });
};
