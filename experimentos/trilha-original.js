/* Central 6D / ADL Mídia — áudio original para exportação via MediaRecorder.
 * Sem bibliotecas externas, downloads ou conteúdo protegido de terceiros.
 * O navegador exige que AudioContext seja iniciado por interação do usuário.
 * Este módulo NÃO gera fala, nem imagens cinematográficas.
 */
export function createOriginalSoundtrack({ durationSeconds = 15, volume = 0.12 } = {}) {
  if (typeof window === "undefined" || !window.AudioContext) {
    throw new Error("Web Audio API indisponível neste navegador.");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 120) {
    throw new RangeError("Duração inválida (1 a 120 segundos).");
  }
  if (!Number.isFinite(volume) || volume < 0 || volume > 0.3) {
    throw new RangeError("Volume inválido (0 a 0,3).");
  }
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  const master = context.createGain();
  master.gain.value = volume;
  master.connect(destination);
  const oscillators = [];
  let started = false;
  let stopped = false;

  function start() {
    if (started || stopped) throw new Error("Trilha já iniciada ou encerrada.");
    started = true;
    const startAt = context.currentTime + 0.04;
    const endAt = startAt + durationSeconds;
    // Progressão original simples: Lá menor → Fá → Dó → Sol.
    const chords = [[220,261.63,329.63],[174.61,220,261.63],[196,261.63,329.63],[196,246.94,293.66]];
    const chordDuration = 2;
    for (let i = 0; i < Math.ceil(durationSeconds / chordDuration); i++) {
      const from = startAt + i * chordDuration;
      const until = Math.min(endAt, from + chordDuration);
      const notes = chords[i % chords.length];
      for (const frequency of notes) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        envelope.gain.setValueAtTime(0, from);
        envelope.gain.linearRampToValueAtTime(0.17, Math.min(from + 0.18, until));
        envelope.gain.setValueAtTime(0.17, Math.max(from + 0.18, until - 0.2));
        envelope.gain.linearRampToValueAtTime(0, until);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.start(from);
        oscillator.stop(until + 0.02);
        oscillators.push(oscillator);
      }
    }
    return context.resume();
  }
  async function stop() {
    if (stopped) return;
    stopped = true;
    for (const oscillator of oscillators) {
      try { oscillator.stop(); } catch (_) { /* already stopped */ }
    }
    await context.close();
  }
  return { stream: destination.stream, start, stop };
}

/* Uso no gerador (após clique do usuário):
 * const soundtrack = createOriginalSoundtrack({durationSeconds: 15});
 * const videoStream = canvas.captureStream(15);
 * const combined = new MediaStream([...videoStream.getVideoTracks(), ...soundtrack.stream.getAudioTracks()]);
 * await soundtrack.start();
 * const recorder = new MediaRecorder(combined, {mimeType: supportedMime});
 * ... await soundtrack.stop() após recorder.stop() e finalização.
 * Testar sincronização e áudio no MP4/WebM de cada navegador antes de publicar.
 */
