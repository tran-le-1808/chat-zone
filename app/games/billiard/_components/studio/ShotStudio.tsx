"use client";

/**
 * AI SHOT STUDIO (AI Billiard Coach / Shot Showcase) — chế độ riêng, tách khỏi trận đấu thật.
 * Quy trình: phân tích bàn → tìm & mô phỏng ứng viên (physics thật) → chọn cú → đặt bi → AI tự đánh
 * (lệnh đánh chuẩn hoá & kiểm tra như server, chạy simulateShot) → đối chiếu kết quả → quay video có
 * chú thích + thuyết minh → xuất file và mở thử file vừa xuất.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Clapperboard, Download, Loader2, Pause, Play, RefreshCw, Search, Square, Video, XCircle } from "lucide-react";
import { validateShotInput, type BallPositions } from "../../_lib/physics";
import { billiardSound } from "../../_lib/sound";
import {
  analyzeShot,
  buildNarration,
  buildSequence,
  CATEGORY_INFO,
  compareOutcome,
  randomLayout,
  SCENARIO_BY_ID,
  scenariosFor,
  shiftScenes,
  searchShots,
  techniqueLabels,
  toSRT,
  toWebVTT,
  totalDuration,
  validateSetup,
  type SearchResult,
  type SearchStage,
  type NarrationSegment,
  type ShotCandidate,
  type ShotDifficulty,
  type ShotScenario,
  type ShotScenarioCategory,
  type StylePreset,
  type VideoMode,
  type VoiceStyle,
} from "../../_lib/studio";
import { extensionOf, recordingSupport, verifyPlayable, VideoRecorder } from "../../_lib/studio/recorder";
import { loadVoices, stopSpeaking, ttsAvailable } from "../../_lib/studio/tts";
import StudioStage, { type Aspect, type StageHandle } from "./StudioStage";
import { StudioRuntime, type CameraMode, type StudioJob, type StudioPart } from "./StudioRuntime";

const CATEGORIES = Object.keys(CATEGORY_INFO) as ShotScenarioCategory[];
const DIFFS: { id: ShotDifficulty; name: string }[] = [
  { id: "BEGINNER", name: "Cơ bản" },
  { id: "INTERMEDIATE", name: "Trung bình" },
  { id: "ADVANCED", name: "Nâng cao" },
  { id: "EXPERT", name: "Chuyên gia" },
];
const PRESETS: { id: StylePreset; name: string }[] = [
  { id: "EASY_AND_CLEAR", name: "Dễ hiểu (hướng dẫn)" },
  { id: "TECHNICAL", name: "Kỹ thuật" },
  { id: "ARTISTIC", name: "Đường bi đẹp" },
  { id: "POSITION_PLAY", name: "Giữ thế bi" },
  { id: "CHALLENGE", name: "Thử thách" },
  { id: "RANDOM_DISCOVERY", name: "Khám phá ngẫu nhiên" },
];
const VOICE_STYLES: { id: VoiceStyle; name: string }[] = [
  { id: "COACH", name: "Huấn luyện viên" },
  { id: "SPORTS_COMMENTATOR", name: "Bình luận thể thao" },
  { id: "CALM_ANALYST", name: "Phân tích điềm tĩnh" },
  { id: "SHORTS", name: "Video ngắn" },
  { id: "CINEMATIC", name: "Điện ảnh" },
];
const STAGE_VI: Record<SearchStage, string> = {
  analyzing: "Phân tích bàn",
  searching: "Tìm & mô phỏng ứng viên",
  refining: "Tinh chỉnh quanh cú tốt",
  repeatability: "Kiểm tra độ ổn định",
  selecting: "Chọn cú đánh",
  done: "Xong",
};
const SCENE_VI: Record<string, string> = { intro: "Mở đầu", setup: "Thế bi", aim: "Đường dự kiến", shot: "Cú đánh thật", replay: "Quay chậm", result: "Kết quả" };
const DIFF_VI: Record<ShotDifficulty, string> = { BEGINNER: "Cơ bản", INTERMEDIATE: "Trung bình", ADVANCED: "Nâng cao", EXPERT: "Chuyên gia" };

interface Settings {
  scenarioId: string;
  category: ShotScenarioCategory;
  difficulty: ShotDifficulty;
  preset: StylePreset;
  count: number;
  seed: number;
  mode: VideoMode;
  aspect: Aspect;
  resolution: 720 | 1080;
  fps: 30 | 60;
  quality: "standard" | "high";
  camera: CameraMode;
  annotate: boolean;
  captions: boolean;
  replay: boolean;
  /** canvas: ghi khung hình studio (không tiếng); screen: ghi màn hình tab qua getDisplayMedia */
  source: "canvas" | "screen";
  gameAudio: boolean;
  voiceOn: boolean;
  voiceStyle: VoiceStyle;
  voiceRate: number;
  voiceName: string;
  duck: boolean;
  detail: "brief" | "full";
}

const DEFAULTS: Settings = {
  scenarioId: "follow-through",
  category: "FOLLOW",
  difficulty: "BEGINNER",
  preset: "EASY_AND_CLEAR",
  count: 6,
  seed: 7,
  mode: "CINEMATIC",
  aspect: "9:16",
  resolution: 720,
  fps: 30,
  quality: "standard",
  camera: "cinematic",
  annotate: true,
  captions: true,
  replay: true,
  source: "canvas",
  gameAudio: false,
  voiceOn: true,
  voiceStyle: "COACH",
  voiceRate: 1,
  voiceName: "",
  duck: true,
  detail: "full",
};

interface ExportInfo {
  /** Thuyết minh của toàn bộ video đã quay (để xuất phụ đề đúng cho cả video) */
  segments: NarrationSegment[];
  url: string;
  ext: string;
  mime: string;
  bytes: number;
  hasAudio: boolean;
  /** fps thực tế = số khung đã vẽ / thời lượng; targetFps = fps đã chọn */
  actualFps: number;
  targetFps: number;
  verified: { ok: boolean; width: number; height: number; reason?: string } | null;
}

const noopSubscribe = () => () => {};
const SERVER_SUPPORT: ReturnType<typeof recordingSupport> = { supported: false, mimeType: null };
let cachedSupport: ReturnType<typeof recordingSupport> | null = null;
const clientSupport = () => (cachedSupport ??= recordingSupport());
const serverSupport = () => SERVER_SUPPORT;

function outputWidth(aspect: Aspect, res: 720 | 1080): number {
  if (aspect === "16:9") return res === 1080 ? 1920 : 1280;
  if (aspect === "9:16") return res === 1080 ? 1080 : 720;
  return res;
}

function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ShotStudio() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  const [runtime] = useState(() => new StudioRuntime());
  const stage = useRef<StageHandle | null>(null);
  const abort = useRef<AbortController | null>(null);
  const recorder = useRef<VideoRecorder | null>(null);
  const [progress, setProgress] = useState<{ stage: SearchStage; done: number; total: number; valid: number } | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  /** Kho ứng viên đã xác minh, gom từ nhiều lần tìm (mỗi loại cú một lần) */
  const [pool, setPool] = useState<ShotCandidate[]>([]);
  /** Các cú được chọn để ghép vào một video (theo thứ tự trong kho) */
  const [picks, setPicks] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [run, setRun] = useState<{ kind: "preview" | "record"; t: number; total: number; scene: string; paused: boolean } | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [exp, setExp] = useState<ExportInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [lastAction, setLastAction] = useState<"search" | "preview" | "record" | null>(null);
  // khả năng của trình duyệt: đọc sau khi hydrate (server luôn trả "chưa biết") để không lệch HTML
  const support = useSyncExternalStore(noopSubscribe, clientSupport, serverSupport);
  const tts = useSyncExternalStore(noopSubscribe, ttsAvailable, () => false);

  const template = s.scenarioId === "random" ? null : SCENARIO_BY_ID[s.scenarioId];
  const positions: BallPositions = useMemo(() => (template ? template.positions : randomLayout(s.seed)), [template, s.seed]);
  const category = s.category;
  const title = template ? template.title : `Khám phá: ${CATEGORY_INFO[category].name}`;
  const candidate = pool.find((c) => c.id === selected) ?? null;
  const recordList = picks.length ? pool.filter((c) => picks.includes(c.id)) : candidate ? [candidate] : [];
  const voice = voices.find((v) => v.name === s.voiceName) ?? voices[0] ?? null;

  useEffect(() => {
    runtime.setIdle(positions);
  }, [runtime, positions]);

  useEffect(() => {
    let alive = true;
    void loadVoices("vi").then((v) => alive && setVoices(v));
    return () => {
      alive = false;
    };
  }, []);

  // dọn tài nguyên khi rời trang
  useEffect(
    () => () => {
      abort.current?.abort();
      recorder.current?.cancel();
      runtime.stop();
      stopSpeaking();
      billiardSound.releaseCapture();
    },
    [runtime],
  );
  useEffect(() => () => (exp ? URL.revokeObjectURL(exp.url) : undefined), [exp]);

  // ---------------------------------------------------------------- tìm cú đánh
  const generate = useCallback(async () => {
    setLastAction("search");
    setError(null);
    setResult(null);
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    const setupErr = validateSetup(positions);
    if (setupErr) {
      setError(`Thế bi không hợp lệ: ${setupErr}`);
      return;
    }
    setProgress({ stage: "analyzing", done: 0, total: 1, valid: 0 });
    const r = await searchShots(positions, 0, {
      category,
      difficulty: template?.difficulty ?? s.difficulty,
      preset: s.preset,
      seed: s.seed,
      count: s.count,
      maxSimulations: s.preset === "ARTISTIC" || category === "ARTISTIC" || category === "CUSHION" ? 1400 : 1000,
      timeBudgetMs: 25000,
      signal: ctl.signal,
      onProgress: (p) => setProgress(p),
    });
    setProgress(null);
    if (abort.current === ctl) abort.current = null;
    if (r.cancelled) {
      setError("Đã huỷ tìm kiếm.");
      return;
    }
    if (r.error) {
      setError(r.error);
      return;
    }
    setResult(r);
    setPool((prev) => [...prev, ...r.candidates]);
    if (!r.candidates.length) {
      setError(`Không tìm được cú đánh đạt mục tiêu «${CATEGORY_INFO[category].goal}» sau ${r.evaluated} lần mô phỏng${r.timedOut ? " (hết thời gian)" : ""}. Hãy đổi seed, độ khó hoặc loại cú khác.`);
      return;
    }
    setSelected(r.candidates[0].id);
  }, [positions, category, template, s.difficulty, s.preset, s.seed, s.count]);

  const cancelAll = useCallback(() => {
    abort.current?.abort();
    recorder.current?.cancel();
    recorder.current = null;
    runtime.stop();
    billiardSound.releaseCapture();
    setRun(null);
    setStep(null);
    setProgress(null);
  }, [runtime]);

  // ---------------------------------------------------------------- AI tự đánh + quay
  const execute = useCallback(
    async (list: ShotCandidate[], kind: "preview" | "record") => {
      if (!list.length) return setError("Chưa chọn cú đánh nào");
      setLastAction(kind);
      setError(null);
      if (runtime.playing) runtime.stop();
      // 1. đặt bi
      setStep("Đặt bi theo kịch bản");
      const setupErr = validateSetup(positions);
      if (setupErr) return setError(`Không đặt được bi: ${setupErr}`);
      // 2–4. từng cú: kiểm tra lệnh đánh như server, chạy physics, đối chiếu với lúc tìm, dựng cảnh & thuyết minh
      const parts: StudioPart[] = [];
      let offset = 0;
      for (const [i, c] of list.entries()) {
        setStep(`Thực hiện cú ${i + 1}/${list.length} (physics)`);
        const bad = validateShotInput(c.shot);
        if (bad) return setError(`Lệnh đánh không hợp lệ: ${bad}`);
        const actual = analyzeShot(positions, c.shot);
        const cmp = compareOutcome(c.analysis, actual);
        const cat = c.category ?? category;
        // cú đầu có cảnh mở đầu; các cú sau nối tiếp, bỏ tiêu đề
        const local = buildSequence({ mode: s.mode, shotDuration: actual.duration, replay: s.replay, introOutro: i === 0 });
        setStep("Sinh thuyết minh từ kết quả thật");
        const narr = buildNarration({ title, category: cat, shot: c.shot, analysis: actual, scenes: local, style: s.voiceStyle, rate: s.voiceRate, detail: s.detail });
        const end = offset + totalDuration(local);
        const info = `${CATEGORY_INFO[cat].name} · ${DIFF_VI[c.difficulty]}`;
        parts.push({
          scenes: shiftScenes(local, offset),
          predicted: c.analysis,
          actual,
          shot: c.shot,
          segments: s.mode === "CLEAN" ? [] : narr.segments.map((g) => ({ ...g, start: g.start + offset, end: g.end + offset })),
          subtitle: list.length > 1 ? `Cách ${i + 1}/${list.length}: ${info}` : info,
          difficulty: c.difficulty,
          tags: c.tags,
          techniqueLabels: techniqueLabels(c.shot, actual),
          mismatch: cmp.match ? null : cmp.reason ?? "Kết quả lệch dự kiến",
          start: offset,
          end,
        });
        offset = end;
      }
      const total = offset;
      const job: StudioJob = {
        parts,
        title,
        mode: s.mode,
        annotate: s.annotate,
        captions: s.captions && s.mode !== "CLEAN",
        camera: s.camera,
        gameAudio: s.gameAudio,
        // giọng đọc chỉ phát khi xem trước; lúc ghi hình thì im lặng (video không tiếng)
        voice: { enabled: kind === "preview" && s.voiceOn && tts && s.mode !== "CLEAN", voice, rate: s.voiceRate, duck: s.duck },
      };
      if (kind === "record" && s.source === "screen") {
        if (!navigator.mediaDevices?.getDisplayMedia) return setError("Trình duyệt không hỗ trợ ghi màn hình");
        if (exp) {
          URL.revokeObjectURL(exp.url);
          setExp(null);
        }
        let stream: MediaStream;
        try {
          // hộp chọn của trình duyệt: chọn đúng tab này để quay khu vực studio
          stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: s.fps }, audio: false, preferCurrentTab: true } as DisplayMediaStreamOptions);
        } catch (e) {
          return setError(`Không ghi được màn hình: ${(e as Error).message || "bị huỷ"}`);
        }
        const rec = new VideoRecorder();
        try {
          rec.startStream(stream, { videoBitsPerSecond: (s.resolution === 1080 ? 8e6 : 4.5e6) * (s.quality === "high" ? 1.6 : 1) });
        } catch (e) {
          stream.getTracks().forEach((t) => t.stop());
          return setError((e as Error).message);
        }
        // người dùng bấm "Dừng chia sẻ" của trình duyệt: kết thúc và giữ phần đã ghi
        stream.getVideoTracks()[0].onended = () => {
          if (recorder.current === rec) runtime.stop();
        };
        recorder.current = rec;
        setStep("Đang ghi màn hình tab");
      } else if (kind === "record") {
        const canvas = stage.current?.canvas();
        if (!canvas) return setError("Chưa sẵn sàng khung hình để ghi");
        if (!support.supported) return setError("Trình duyệt không hỗ trợ ghi video");
        if (exp) {
          URL.revokeObjectURL(exp.url);
          setExp(null);
        }
        const rec = new VideoRecorder();
        try {
          billiardSound.unlock();
          // không tiếng trừ khi người dùng bật "Âm va chạm" (khi đó chỉ có tiếng va chạm, không có giọng đọc)
          const audio = s.gameAudio ? billiardSound.captureStream() : null;
          // bitrate tỉ lệ theo fps: 60 khung/giây cần gấp ~1,7 lần để bộ mã hoá không bỏ khung
          rec.start(canvas, { fps: s.fps, videoBitsPerSecond: (s.resolution === 1080 ? 8e6 : 4.5e6) * (s.quality === "high" ? 1.6 : 1) * (s.fps === 60 ? 1.7 : 1), audio, manualFrames: true });
        } catch (e) {
          return setError((e as Error).message);
        }
        recorder.current = rec;
        setStep("Đang ghi hình");
      } else setStep("Đang xem trước");
      const onDone = () => {
        setRun(null);
        const rec = recorder.current;
        recorder.current = null;
        if (!rec) {
          setStep(null);
          return;
        }
        setStep("Đang xuất video");
        void rec
          .stop()
          .then(async (out) => {
            billiardSound.releaseCapture();
            const url = URL.createObjectURL(out.blob);
            setStep("Mở thử file vừa xuất");
            const verified = await verifyPlayable(out.blob);
            setExp({ segments: job.parts.flatMap((p) => p.segments), url, ext: extensionOf(out.mimeType), mime: out.mimeType, bytes: out.bytes, hasAudio: out.hasAudio, actualFps: s.source === "screen" ? s.fps : runtime.framesDrawn / Math.max(0.1, total), targetFps: s.fps, verified });
            if (!verified.ok) setError(`File đã tạo nhưng không phát được: ${verified.reason}`);
            setStep(null);
          })
          .catch((e: Error) => {
            billiardSound.releaseCapture();
            setError(e.message);
            setStep(null);
          });
      };
      // cập nhật thanh tiến độ ~5 lần/giây (không render lại cả trang mỗi khung hình)
      let lastUi = 0;
      let lastScene = "";
      runtime.setHandlers((t, tot, scene) => {
        const now = performance.now();
        if (scene === lastScene && now - lastUi < 200) return;
        lastUi = now;
        lastScene = scene;
        setRun((r) => (r ? { ...r, t, total: tot, scene } : r));
      }, onDone);

      setRun({ kind, t: 0, total, scene: parts[0].scenes[0].id, paused: false });
      runtime.play(job);
      // play() đặt lại nhịp vẽ, nên chỉnh sau khi gọi
      const recNow = recorder.current;
      runtime.setPacing(kind === "record" && s.source === "canvas" ? s.fps : 60, recNow && s.source === "canvas" ? () => recNow.requestFrame() : null);
    },
    [runtime, positions, s, title, category, tts, voice, support.supported, exp],
  );

  // tab bị ẩn khi đang ghi: trình duyệt dừng vẽ khung hình -> huỷ để không xuất video hỏng
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && recorder.current) {
        cancelAll();
        setError("Đã huỷ ghi vì tab bị ẩn (trình duyệt ngừng vẽ khung hình khi tab không hiển thị).");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [cancelAll]);

  const retry = () => {
    if (lastAction === "search") void generate();
    else if (lastAction) void execute(lastAction === "record" ? recordList : candidate ? [candidate] : [], lastAction);
  };

  const narrationPreview = useMemo(() => {
    if (!candidate) return null;
    const scenes = buildSequence({ mode: s.mode, shotDuration: candidate.analysis.duration, replay: s.replay });
    return buildNarration({ title, category, shot: candidate.shot, analysis: candidate.analysis, scenes, style: s.voiceStyle, rate: s.voiceRate, detail: s.detail });
  }, [candidate, s.mode, s.replay, s.voiceStyle, s.voiceRate, s.detail, title, category]);

  const scenarioJson = (): ShotScenario | null => {
    if (!candidate || !template) return null;
    const a = candidate.analysis;
    return {
      id: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      difficulty: candidate.difficulty,
      tags: candidate.tags,
      setup: { ballPositions: template.positions.map(([x, y], i) => ({ ballId: i as 0 | 1 | 2, position: { x, y } })), cueBallId: 0, targetBallId: a.verdict.firstBall ?? 1, thirdBallId: a.verdict.secondBall ?? 2 },
      shot: { aimDirection: { x: candidate.shot.dirX, y: candidate.shot.dirY }, power: candidate.shot.power, elevation: candidate.shot.elevation, spin: { x: candidate.shot.tipX, y: candidate.shot.tipY }, english: a.english },
      goal: { description: CATEGORY_INFO[template.category].goal, scoringExpected: true, ...(template.positionGoal ? { positionGoal: template.positionGoal } : {}) },
      simulationResult: { validated: true, score: candidate.total, contacts: a.contacts },
      ...(narrationPreview ? { narration: narrationPreview } : {}),
    };
  };

  const busy = !!progress || !!run || !!step;
  const sel = "w-full rounded-lg border border-white/10 bg-[#0b0d1a] px-2 py-1.5 text-xs text-slate-100";
  const lbl = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400";
  const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold disabled:opacity-40";

  return (
    <div className="min-h-screen bg-[#0b0d1a] text-slate-100">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Link href="/games/billiard" className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Về sảnh bida">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Clapperboard className="h-5 w-5 text-violet-300" />
        <h1 className="text-base font-black">AI Shot Studio · Libre</h1>
        <span className="ml-auto hidden text-[11px] text-slate-400 sm:block">Tách biệt với trận đấu thật — không ảnh hưởng ván đang chơi</span>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[300px_1fr]">
        {/* ------------------------------------------------ cài đặt */}
        <aside className="space-y-3">
          <section className="space-y-2 rounded-2xl border border-white/10 bg-[#11132a] p-3">
            <h2 className="text-xs font-black text-[#ffd166]">1. Cú đánh</h2>
            <div>
              <label className={lbl}>Loại cú</label>
              <select className={sel} value={category} disabled={busy} onChange={(e) => {
                const cat = e.target.value as ShotScenarioCategory;
                const first = scenariosFor(cat)[0];
                // thế bi khai cuộc giữ nguyên khi đổi loại cú (để tìm nhiều cách đánh từ cùng một thế)
                setS((p) => (p.scenarioId === "opening-break" ? { ...p, category: cat } : { ...p, category: cat, scenarioId: first ? first.id : "random", difficulty: first?.difficulty ?? p.difficulty }));
              }}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_INFO[c].name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Thế bi</label>
              <select className={sel} value={s.scenarioId} disabled={busy} onChange={(e) => set("scenarioId", e.target.value)}>
                <option value="opening-break">Thế bi khai cuộc (đổi loại cú để tìm cách đánh khác)</option>
                {scenariosFor(category).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
                <option value="random">Thế bi ngẫu nhiên (theo seed)</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-400">{template ? template.description : "Bi đặt ngẫu nhiên hợp lệ; đổi seed để có thế khác."}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Độ khó</label>
                <select className={sel} value={template?.difficulty ?? s.difficulty} disabled={busy || !!template} onChange={(e) => set("difficulty", e.target.value as ShotDifficulty)}>
                  {DIFFS.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Seed</label>
                <div className="flex gap-1">
                  <input className={sel} type="number" value={s.seed} disabled={busy} onChange={(e) => set("seed", Number(e.target.value) || 0)} />
                  <button type="button" title="Seed mới" className="rounded-lg bg-white/10 px-2" disabled={busy} onClick={() => set("seed", Math.floor(Math.random() * 1e6))}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className={lbl}>Phong cách</label>
                <select className={sel} value={s.preset} disabled={busy} onChange={(e) => set("preset", e.target.value as StylePreset)}>
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Số ứng viên</label>
                <select className={sel} value={s.count} disabled={busy} onChange={(e) => set("count", Number(e.target.value))}>
                  {[3, 4, 6, 8].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="button" className={`${btn} w-full bg-[#ffd166] text-[#1a1206]`} disabled={busy} onClick={() => void generate()}>
              <Search className="h-4 w-4" /> Tìm cú đánh (Generate Shot)
            </button>
          </section>

          <section className="space-y-2 rounded-2xl border border-white/10 bg-[#11132a] p-3">
            <h2 className="text-xs font-black text-[#ffd166]">2. Video</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Kiểu video</label>
                <select className={sel} value={s.mode} disabled={busy} onChange={(e) => set("mode", e.target.value as VideoMode)}>
                  <option value="CINEMATIC">Cinematic</option>
                  <option value="COACH">Coach overlay</option>
                  <option value="CLEAN">Gameplay sạch</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Camera</label>
                <select className={sel} value={s.camera} disabled={busy} onChange={(e) => set("camera", e.target.value as CameraMode)}>
                  <option value="cinematic">Điện ảnh (theo cảnh)</option>
                  <option value="top">Từ trên xuống</option>
                  <option value="angle">Nhìn nghiêng</option>
                </select>
              </div>
                            <div>
                <label className={lbl}>Nguồn ghi</label>
                <select className={sel} value={s.source} disabled={busy} onChange={(e) => set("source", e.target.value as "canvas" | "screen")}>
                  <option value="canvas">Khung hình studio (không tiếng)</option>
                  <option value="screen">Ghi màn hình tab (chọn tab này)</option>
                </select>
              </div>
<div>
                <label className={lbl}>Khung hình</label>
                <select className={sel} value={s.aspect} disabled={busy} onChange={(e) => set("aspect", e.target.value as Aspect)}>
                  <option value="16:9">16:9 ngang</option>
                  <option value="9:16">9:16 dọc</option>
                  <option value="1:1">1:1 vuông</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Độ phân giải</label>
                <select className={sel} value={s.resolution} disabled={busy} onChange={(e) => set("resolution", Number(e.target.value) as 720 | 1080)}>
                  <option value={720}>720p</option>
                  <option value={1080}>1080p</option>
                </select>
              </div>
              <div>
                <label className={lbl}>FPS</label>
                <select className={sel} value={s.fps} disabled={busy} onChange={(e) => set("fps", Number(e.target.value) as 30 | 60)}>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Chất lượng</label>
                <select className={sel} value={s.quality} disabled={busy} onChange={(e) => set("quality", e.target.value as "standard" | "high")}>
                  <option value="standard">Tiêu chuẩn</option>
                  <option value="high">Cao</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              {(
                [
                  ["annotate", "Chú thích đường bi"],
                  ["captions", "Phụ đề"],
                  ["replay", "Quay chậm"],
                  ["gameAudio", "Âm va chạm (khi quay)"],
                ] as const
              ).map(([k, name]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={s[k]} disabled={busy} onChange={(e) => set(k, e.target.checked)} />
                  {name}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-2 rounded-2xl border border-white/10 bg-[#11132a] p-3">
            <h2 className="text-xs font-black text-[#ffd166]">3. Thuyết minh</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Giọng điệu</label>
                <select className={sel} value={s.voiceStyle} disabled={busy} onChange={(e) => set("voiceStyle", e.target.value as VoiceStyle)}>
                  {VOICE_STYLES.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Tốc độ nói</label>
                <select className={sel} value={s.voiceRate} disabled={busy} onChange={(e) => set("voiceRate", Number(e.target.value))}>
                  {[0.85, 1, 1.15].map((r) => (
                    <option key={r} value={r}>{r}×</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Giọng đọc (trình duyệt)</label>
                <select className={sel} value={voice?.name ?? ""} disabled={busy || !voices.length} onChange={(e) => set("voiceName", e.target.value)}>
                  {voices.length ? voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>) : <option value="">Không có giọng tiếng Việt</option>}
                </select>
              </div>
              <div>
                <label className={lbl}>Chi tiết</label>
                <select className={sel} value={s.detail} disabled={busy} onChange={(e) => set("detail", e.target.value as "brief" | "full")}>
                  <option value="full">Đầy đủ</option>
                  <option value="brief">Ngắn gọn</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={s.voiceOn && tts} disabled={busy || !tts} onChange={(e) => set("voiceOn", e.target.checked)} /> Đọc thành tiếng
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={s.duck} disabled={busy} onChange={(e) => set("duck", e.target.checked)} /> Giảm âm game khi nói
              </label>
            </div>
            <p className="text-[11px] leading-snug text-slate-400">
              {tts
                ? "Giọng đọc của trình duyệt phát ra loa nhưng không ghi được vào file video. Video xuất ra có phụ đề in sẵn, kèm file phụ đề .vtt / .srt để lồng tiếng ở bước hậu kỳ."
                : "Trình duyệt không có tính năng đọc văn bản. Video vẫn có phụ đề và kịch bản thuyết minh."}
            </p>
          </section>
        </aside>

        {/* ------------------------------------------------ sân khấu + kết quả */}
        <main className="min-w-0 space-y-3">
          <StudioStage ref={stage} runtime={runtime} aspect={s.aspect} outWidth={outputWidth(s.aspect, s.resolution)} camera={s.camera} />

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${btn} bg-white/10`} disabled={!candidate || busy} onClick={() => candidate && void execute([candidate], "preview")}>
              <Play className="h-4 w-4" /> Xem trước
            </button>
            <button type="button" className={`${btn} bg-rose-600 text-white`} disabled={!recordList.length || busy || !support.supported} onClick={() => recordList.length && void execute(recordList, "record")}>
              <Video className="h-4 w-4" /> {recordList.length > 1 ? `Quay video (${recordList.length} cú)` : "Quay video"}
            </button>
            {run?.kind === "preview" && (
              <button type="button" className={`${btn} bg-white/10`} onClick={() => {
                runtime.pause(!runtime.paused);
                setRun((r) => (r ? { ...r, paused: runtime.paused } : r));
              }}>
                <Pause className="h-4 w-4" /> {run.paused ? "Tiếp tục" : "Tạm dừng"}
              </button>
            )}
            {busy && (
              <button type="button" className={`${btn} bg-white/10 text-rose-200`} onClick={() => {
                cancelAll();
                setError("Đã huỷ.");
              }}>
                <Square className="h-4 w-4" /> Huỷ
              </button>
            )}
            {error && lastAction && !busy && (
              <button type="button" className={`${btn} bg-white/10`} onClick={retry}>
                <RefreshCw className="h-4 w-4" /> Thử lại
              </button>
            )}
            {!support.supported && <span className="text-[11px] text-rose-300">Không ghi được video: {"reason" in support ? support.reason : ""}</span>}
          </div>

          {(progress || run || step) && (
            <div className="rounded-2xl border border-white/10 bg-[#11132a] p-3 text-xs">
              {progress && (
                <>
                  <p className="font-bold">
                    <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                    {STAGE_VI[progress.stage]} — {progress.done}/{progress.total} mô phỏng · {progress.valid} cú đạt mục tiêu
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-[#ffd166]" style={{ width: `${Math.min(100, (progress.done / Math.max(1, progress.total)) * 100)}%` }} />
                  </div>
                </>
              )}
              {run && (
                <>
                  <p className="font-bold">
                    {run.kind === "record" ? "● Đang ghi" : "▶ Xem trước"} · {SCENE_VI[run.scene] ?? run.scene} · {run.t.toFixed(1)}/{run.total.toFixed(1)} s
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full ${run.kind === "record" ? "bg-rose-500" : "bg-sky-400"}`} style={{ width: `${(run.t / Math.max(0.1, run.total)) * 100}%` }} />
                  </div>
                  {run.kind === "record" && <p className="mt-1 text-[11px] text-slate-400">Giữ tab này hiển thị cho tới khi ghi xong.</p>}
                </>
              )}
              {step && !run && !progress && (
                <p className="font-bold">
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  {step}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {exp && (
            <section className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              <h2 className="text-sm font-black text-emerald-300">Video đã xuất</h2>
              <video src={exp.url} controls className="max-h-[50vh] w-full rounded-xl bg-black" />
              <p className="text-slate-300">
                {exp.ext.toUpperCase()} · {(exp.bytes / 1024 / 1024).toFixed(1)} MB · {exp.verified?.ok ? `đã mở thử: ${exp.verified.width}×${exp.verified.height}` : `chưa phát được (${exp.verified?.reason ?? "?"})`} · {exp.hasAudio ? "có âm va chạm" : "không có âm thanh"} · {exp.actualFps.toFixed(0)}/{exp.targetFps} khung hình/giây
              </p>
              {exp.actualFps < exp.targetFps * 0.9 && (
                <p className="text-amber-300">
                  Máy vẽ chưa kịp {exp.targetFps} khung/giây nên video có thể bị giật. Thử hạ FPS hoặc độ phân giải, tắt các ứng dụng nặng khác rồi quay lại.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <a className={`${btn} bg-emerald-500 text-[#04210f]`} href={exp.url} download={`ai-shot-${s.scenarioId}-${s.seed}.${exp.ext}`}>
                  <Download className="h-4 w-4" /> Tải video
                </a>
                {exp.segments.length > 0 && (
                  <>
                    <button type="button" className={`${btn} bg-white/10`} onClick={() => downloadText(`ai-shot-${s.scenarioId}.vtt`, toWebVTT(exp.segments), "text/vtt")}>Phụ đề .vtt</button>
                    <button type="button" className={`${btn} bg-white/10`} onClick={() => downloadText(`ai-shot-${s.scenarioId}.srt`, toSRT(exp.segments))}>Phụ đề .srt</button>
                  </>
                )}
              </div>
            </section>
          )}

          {/* ------------------------------------------------ kho ứng viên đã xác minh */}
          {pool.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-[#11132a] p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="mr-auto text-xs font-black text-[#ffd166]">
                  Ứng viên đã xác minh · {pool.length} cú
                  {result ? ` · lần tìm gần nhất: ${result.valid}/${result.evaluated} đạt mục tiêu` : ""}
                </h2>
                <span className="text-[11px] text-slate-400">Chọn «Thêm vào video» để ghép nhiều cú (theo thứ tự bên dưới)</span>
                <button type="button" disabled={busy} className="rounded-lg bg-white/10 px-2 py-1 text-[11px]" onClick={() => {
                  setPool([]);
                  setPicks([]);
                  setSelected(null);
                  setResult(null);
                }}>Xoá kho</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {pool.map((c, i) => {
                  const picked = picks.includes(c.id);
                  return (
                    <div key={c.id} className="flex flex-col gap-1">
                      <button type="button" disabled={busy} onClick={() => setSelected(c.id)} className={`rounded-xl border p-2 text-left text-xs transition ${selected === c.id ? "border-[#ffd166] bg-[#ffd166]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                        <Thumb c={c} start={positions} />
                        <p className="mt-1.5 font-extrabold">
                          #{i + 1} · {c.category ? CATEGORY_INFO[c.category].name : ""} · {DIFF_VI[c.difficulty]} · điểm {(c.total * 100).toFixed(0)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          ✔ đã mô phỏng · {c.analysis.duration.toFixed(1)} s · ổn định {(c.breakdown.repeatability * 100).toFixed(0)}%
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{t}</span>
                          ))}
                        </div>
                      </button>
                      <button type="button" disabled={busy} onClick={() => setPicks((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${picked ? "bg-emerald-500/25 text-emerald-200" : "bg-white/10 text-slate-200"}`}>
                        {picked ? `✓ Trong video (cú ${picks.indexOf(c.id) + 1})` : "+ Thêm vào video"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {candidate && narrationPreview && (
            <section className="space-y-2 rounded-2xl border border-white/10 bg-[#11132a] p-3 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-[#ffd166]">Thuyết minh (sinh từ kết quả mô phỏng)</h2>
                <div className="flex gap-1">
                  <button type="button" className="rounded-lg bg-white/10 px-2 py-1 text-[11px]" onClick={() => downloadText(`ai-shot-${s.scenarioId}-script.txt`, narrationPreview.segments.map((x) => `[${x.start.toFixed(1)}s] ${x.text}`).join("\n"))}>Tải kịch bản</button>
                  {template && (
                    <button type="button" className="rounded-lg bg-white/10 px-2 py-1 text-[11px]" onClick={() => downloadText(`ai-shot-${template.id}.json`, JSON.stringify(scenarioJson(), null, 2), "application/json")}>Tải kịch bản cú đánh (JSON)</button>
                  )}
                </div>
              </div>
              <ol className="space-y-1">
                {narrationPreview.segments.map((x, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-14 shrink-0 tabular-nums text-slate-500">{x.start.toFixed(1)}s</span>
                    <span>{x.text}</span>
                  </li>
                ))}
              </ol>
              <p className="text-[11px] text-slate-400">
                Lực {Math.round(candidate.shot.power * 100)}% · điểm chạm ({candidate.shot.tipX.toFixed(2)}, {candidate.shot.tipY.toFixed(2)}) · hướng {((Math.atan2(candidate.shot.dirY, candidate.shot.dirX) * 180) / Math.PI).toFixed(1)}° · nhãn: {techniqueLabels(candidate.shot, candidate.analysis).join(", ") || "—"}
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

/** Ảnh nhỏ nhìn từ trên: bàn + đường 3 bi (từ khung hình mô phỏng) */
function Thumb({ c, start }: { c: ShotCandidate; start: BallPositions }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const W = cv.width;
    const H = cv.height;
    const sx = (x: number) => ((x + 1.42) / 2.84) * (W - 12) + 6;
    const sy = (y: number) => ((0.71 - y) / 1.42) * (H - 12) + 6;
    ctx.fillStyle = "#4a230d";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1d6b45";
    ctx.fillRect(6, 6, W - 12, H - 12);
    const colors = ["#f8fafc", "#facc15", "#ef4444"];
    for (let id = 0; id < 3; id++) {
      ctx.strokeStyle = colors[id];
      ctx.lineWidth = id === 0 ? 1.6 : 1;
      ctx.beginPath();
      c.analysis.frames.forEach((f, i) => (i ? ctx.lineTo(sx(f.balls[id][0]), sy(f.balls[id][1])) : ctx.moveTo(sx(f.balls[id][0]), sy(f.balls[id][1]))));
      ctx.stroke();
      ctx.fillStyle = colors[id];
      ctx.beginPath();
      ctx.arc(sx(start[id][0]), sy(start[id][1]), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [c, start]);
  return <canvas ref={ref} width={240} height={126} className="h-auto w-full rounded-lg" />;
}
