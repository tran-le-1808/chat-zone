/**
 * ĐỌC THUYẾT MINH bằng giọng có sẵn của trình duyệt (Web Speech API). Không có nhà cung cấp TTS phía server.
 * Giới hạn: âm thanh speechSynthesis phát thẳng ra loa, KHÔNG ghép được vào file video bằng MediaRecorder —
 * file xuất ra luôn có phụ đề in sẵn + file phụ đề .vtt / .srt đi kèm.
 */
export function ttsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function loadVoices(lang = "vi"): Promise<SpeechSynthesisVoice[]> {
  if (!ttsAvailable()) return Promise.resolve([]);
  const pick = () => window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
  const now = pick();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      clearTimeout(t);
      resolve(pick());
    };
    const t = setTimeout(done, 1500);
    window.speechSynthesis.addEventListener("voiceschanged", done);
  });
}

export interface SpeakOptions {
  voice?: SpeechSynthesisVoice | null;
  lang?: string;
  rate?: number;
  pitch?: number;
}

/** Đọc một câu; thử lại 1 lần nếu lỗi (trừ khi bị huỷ). Không bao giờ reject — trả về ok/false. */
export function speak(text: string, o: SpeakOptions = {}): Promise<boolean> {
  if (!ttsAvailable()) return Promise.resolve(false);
  const once = () =>
    new Promise<boolean>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = o.voice?.lang ?? o.lang ?? "vi-VN";
      if (o.voice) u.voice = o.voice;
      u.rate = o.rate ?? 1;
      u.pitch = o.pitch ?? 1;
      u.onend = () => resolve(true);
      u.onerror = (e) => resolve(e.error === "interrupted" || e.error === "canceled" ? true : false);
      window.speechSynthesis.speak(u);
    });
  return once().then((ok) => (ok ? true : once()));
}

export function stopSpeaking(): void {
  if (ttsAvailable()) window.speechSynthesis.cancel();
}
