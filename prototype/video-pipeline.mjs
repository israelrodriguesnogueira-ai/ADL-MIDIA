/**
 * ADL Mídia — núcleo independente de planejamento de cenas e legendas.
 * Não altera o Worker publicado. Sem dependências externas.
 * Entrada: frases do roteiro + duração por frase em segundos.
 * Os tempos devem ser substituídos por timestamps reais da narração
 * quando o motor de áudio estiver integrado.
 */
export function buildTimeline(segments, { transitionSeconds = 0.35 } = {}) {
  if (!Array.isArray(segments) || segments.length === 0) throw new Error("Roteiro vazio");
  if (!Number.isFinite(transitionSeconds) || transitionSeconds < 0) throw new Error("Transição inválida");
  let cursor = 0;
  return segments.map((segment, index) => {
    const text = String(segment.text ?? "").trim();
    const duration = Number(segment.duration);
    if (!text || !Number.isFinite(duration) || duration <= 0) throw new Error(`Cena ${index + 1} inválida`);
    const start = cursor;
    const end = start + duration;
    const overlap = index < segments.length - 1 ? Math.min(transitionSeconds, duration / 2) : 0;
    cursor = end - overlap;
    return {
      index, text, start, end, duration, overlap,
      imageQuery: String(segment.imageQuery ?? text).trim(),
      imageUrl: segment.imageUrl ?? null,
      transition: index ? "crossfade" : "none"
    };
  });
}
function srtTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor(ms / 60000) % 60;
  const secs = Math.floor(ms / 1000) % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
export function toSrt(timeline) {
  return timeline.map((scene, i) => `${i + 1}\n${srtTime(scene.start)} --> ${srtTime(scene.end)}\n${scene.text.replace(/\r?\n/g, " ")}`).join("\n\n") + "\n";
}
/** Legendas com tempos da fala reais, caso fornecidos pelo sintetizador. */
export function captionsFromSpeech(cues) {
  if (!Array.isArray(cues)) throw new Error("Legendas inválidas");
  const ordered = cues.map((cue, index) => ({
    index, text: String(cue.text ?? "").trim(), start: Number(cue.start), end: Number(cue.end)
  }));
  ordered.forEach((cue, i) => {
    if (!cue.text || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) ||
        cue.start < 0 || cue.end <= cue.start || (i && cue.start < ordered[i-1].start))
      throw new Error(`Legenda ${i+1} inválida`);
  });
  return toSrt(ordered);
}
