/**
 * GHI VIDEO từ canvas (MediaRecorder + captureStream). Kiểm tra định dạng trình duyệt hỗ trợ TRƯỚC khi ghi;
 * không giả định mp4 / webm. Có start / stop / cancel, kiểm tra file rỗng, dọn track khi xong.
 */
export const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function recordingSupport(): { supported: boolean; mimeType: string | null; reason?: string } {
  if (typeof window === "undefined") return { supported: false, mimeType: null, reason: "Không chạy trong trình duyệt" };
  if (typeof MediaRecorder === "undefined") return { supported: false, mimeType: null, reason: "Trình duyệt không hỗ trợ MediaRecorder" };
  if (typeof HTMLCanvasElement === "undefined" || !("captureStream" in HTMLCanvasElement.prototype)) return { supported: false, mimeType: null, reason: "Trình duyệt không ghi được canvas (captureStream)" };
  const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
  return mimeType ? { supported: true, mimeType } : { supported: false, mimeType: null, reason: "Không có định dạng video nào được hỗ trợ" };
}

export const extensionOf = (mime: string) => (mime.startsWith("video/mp4") ? "mp4" : "webm");

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  bytes: number;
  hasAudio: boolean;
}

export class VideoRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private done: Promise<RecordingResult> | null = null;
  private cancelled = false;
  private videoTrack: (MediaStreamTrack & { requestFrame?: () => void }) | null = null;
  /** true: khung hình được đẩy thủ công sau mỗi lần vẽ (nhịp đều); false: trình duyệt tự lấy mẫu theo fps */
  manual = false;
  mimeType: string | null = null;
  hasAudio = false;

  /** Đẩy khung hình canvas hiện tại vào video (chỉ có tác dụng ở chế độ thủ công) */
  requestFrame(): void {
    if (this.manual) this.videoTrack?.requestFrame?.();
  }

  start(canvas: HTMLCanvasElement, opts: { fps: number; videoBitsPerSecond: number; audio?: MediaStream | null; manualFrames?: boolean }): void {
    const sup = recordingSupport();
    if (!sup.supported || !sup.mimeType) throw new Error(sup.reason ?? "Không ghi được video");
    // captureStream(0) + requestFrame(): mỗi lần vẽ xong là một khung hình, không phụ thuộc nhịp lấy mẫu của trình duyệt
    let video = opts.manualFrames ? canvas.captureStream(0) : canvas.captureStream(opts.fps);
    this.videoTrack = video.getVideoTracks()[0] as typeof this.videoTrack;
    this.manual = !!opts.manualFrames && typeof this.videoTrack?.requestFrame === "function";
    if (opts.manualFrames && !this.manual) {
      // trình duyệt không hỗ trợ requestFrame: quay lại chế độ lấy mẫu tự động
      video.getVideoTracks().forEach((t) => t.stop());
      video = canvas.captureStream(opts.fps);
      this.videoTrack = video.getVideoTracks()[0] as typeof this.videoTrack;
    }
    const tracks = [...video.getVideoTracks()];
    const audioTracks = opts.audio?.getAudioTracks() ?? [];
    this.hasAudio = audioTracks.length > 0;
    this.stream = new MediaStream([...tracks, ...audioTracks]);
    this.mimeType = sup.mimeType;
    this.chunks = [];
    this.cancelled = false;
    this.attach(new MediaRecorder(this.stream, { mimeType: sup.mimeType, videoBitsPerSecond: opts.videoBitsPerSecond, ...(this.hasAudio ? { audioBitsPerSecond: 128000 } : {}) }));
  }

  /** Ghi thẳng một luồng có sẵn (ghi màn hình tab qua getDisplayMedia), không tiếng, không đẩy khung thủ công */
  startStream(stream: MediaStream, opts: { videoBitsPerSecond: number }): void {
    const sup = recordingSupport();
    if (!sup.supported || !sup.mimeType) throw new Error(sup.reason ?? "Không ghi được video");
    this.stream = stream;
    this.videoTrack = stream.getVideoTracks()[0] as typeof this.videoTrack;
    this.manual = false;
    this.hasAudio = false;
    this.mimeType = sup.mimeType;
    this.chunks = [];
    this.cancelled = false;
    this.attach(new MediaRecorder(stream, { mimeType: sup.mimeType, videoBitsPerSecond: opts.videoBitsPerSecond }));
  }

  private attach(rec: MediaRecorder): void {
    this.rec = rec;
    this.done = new Promise<RecordingResult>((resolve, reject) => {
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };
      rec.onerror = (e) => {
        this.cleanup();
        reject(new Error(`Lỗi ghi video: ${(e as unknown as { error?: Error }).error?.message ?? "không rõ"}`));
      };
      rec.onstop = () => {
        const chunks = this.chunks;
        const mime = this.mimeType ?? "video/webm";
        const hasAudio = this.hasAudio;
        this.cleanup();
        if (this.cancelled) return reject(new Error("Đã huỷ ghi video"));
        const blob = new Blob(chunks, { type: mime.split(";")[0] });
        if (blob.size === 0) return reject(new Error("Video rỗng (trình duyệt không ghi được khung hình nào)"));
        resolve({ blob, mimeType: mime, bytes: blob.size, hasAudio });
      };
    });
    rec.start(250);
  }

  stop(): Promise<RecordingResult> {
    if (!this.rec || !this.done) return Promise.reject(new Error("Chưa bắt đầu ghi"));
    if (this.rec.state !== "inactive") this.rec.stop();
    return this.done;
  }

  cancel(): void {
    this.cancelled = true;
    if (this.rec && this.rec.state !== "inactive") this.rec.stop();
    else this.cleanup();
  }

  private cleanup(): void {
    this.stream?.getVideoTracks().forEach((t) => t.stop());
    this.stream = null;
    this.videoTrack = null;
    this.manual = false;
    this.rec = null;
    this.chunks = [];
  }
}

/** Mở thử file đã xuất: phải đọc được metadata và có khung hình (không đen / không hỏng) */
export function verifyPlayable(blob: Blob, timeoutMs = 8000): Promise<{ ok: boolean; width: number; height: number; reason?: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "metadata";
    const finish = (r: { ok: boolean; width: number; height: number; reason?: string }) => {
      clearTimeout(timer);
      v.removeAttribute("src");
      v.load();
      URL.revokeObjectURL(url);
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, width: 0, height: 0, reason: "Hết thời gian chờ đọc video" }), timeoutMs);
    v.onloadeddata = () => finish({ ok: v.videoWidth > 0, width: v.videoWidth, height: v.videoHeight, ...(v.videoWidth > 0 ? {} : { reason: "Không có khung hình" }) });
    v.onerror = () => finish({ ok: false, width: 0, height: 0, reason: "Trình duyệt không phát được file vừa xuất" });
    v.src = url;
  });
}
