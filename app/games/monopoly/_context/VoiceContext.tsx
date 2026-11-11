"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { monoEmit } from "@/lib/monopolySocket";
import { useRoom } from "./RoomContext";

/**
 * VOICE CHAT trong phòng Cờ Tỷ Phú (WebRTC mesh, tối đa 4 người).
 * Server chỉ chuyển tín hiệu (offer / answer / ICE) qua socket.
 *
 * Provider đặt ở cấp phòng (bao cả phòng chờ lẫn bàn cờ) -> bật voice ở phòng chờ
 * thì vào game vẫn giữ nguyên kết nối; chưa bật thì có thể bật ngay trong game.
 */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];
/** Ngưỡng âm lượng (RMS 0..1) coi là "đang nói" */
const SPEAKING_THRESHOLD = 0.04;
const SPEAKING_POLL_MS = 150;

type Signal =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit };

interface VoiceUser {
  userId: string;
  muted: boolean;
}

interface VoiceContextType {
  /** Trình duyệt hỗ trợ voice (cần HTTPS / localhost + WebRTC) */
  supported: boolean;
  /** Mình đang trong voice */
  enabled: boolean;
  connecting: boolean;
  muted: boolean;
  /** Những người đang bật voice (kể cả mình) */
  users: Record<string, { muted: boolean }>;
  /** Ai đang nói (theo âm lượng) */
  speaking: Record<string, boolean>;
  /** Trình duyệt chặn tự phát âm thanh -> cần bấm để nghe */
  audioBlocked: boolean;
  join: () => Promise<void>;
  leave: () => void;
  toggleMute: () => void;
  resumeAudio: () => void;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

const storageKey = (code: string) => `mono-voice:${code}`;
const readPref = (code: string) => {
  try {
    return sessionStorage.getItem(storageKey(code));
  } catch {
    return null;
  }
};
const writePref = (code: string, value: "on" | "muted" | null) => {
  try {
    if (value) sessionStorage.setItem(storageKey(code), value);
    else sessionStorage.removeItem(storageKey(code));
  } catch {
    /* bỏ qua (chế độ ẩn danh...) */
  }
};

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { code, myUserId } = useRoom();

  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof RTCPeerConnection !== "undefined",
  );
  const [enabled, setEnabled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [users, setUsers] = useState<Record<string, { muted: boolean }>>({});
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [audioBlocked, setAudioBlocked] = useState(false);
  // Đọc 1 lần ở lần render đầu (trước mọi cleanup của StrictMode)
  const [initialPref] = useState(() =>
    typeof window === "undefined" ? null : readPref(code),
  );

  const enabledRef = useRef(false);
  const mutedRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const audioElsRef = useRef(new Map<string, HTMLAudioElement>());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef(new Map<string, AnalyserNode>());

  // ---------- Âm lượng / đang nói ----------
  const addAnalyser = useCallback((id: string, stream: MediaStream) => {
    const ctx = audioCtxRef.current;
    if (!ctx || stream.getAudioTracks().length === 0) return;
    try {
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analysersRef.current.set(id, analyser);
    } catch {
      /* bỏ qua */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const buf = new Float32Array(512);
    const id = setInterval(() => {
      const next: Record<string, boolean> = {};
      analysersRef.current.forEach((an, uid) => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        next[uid] =
          rms > SPEAKING_THRESHOLD && !(uid === myUserId && mutedRef.current);
      });
      setSpeaking((prev) => {
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
        for (const k of keys) if (!!prev[k] !== !!next[k]) return next;
        return prev;
      });
    }, SPEAKING_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, myUserId]);

  // ---------- Kết nối tới từng người ----------
  const sendSignal = useCallback((to: string, data: Signal) => {
    void monoEmit("mono:voice:signal", { to, data });
  }, []);

  const closePeer = useCallback((peerId: string) => {
    pcsRef.current.get(peerId)?.close();
    pcsRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);
    const el = audioElsRef.current.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioElsRef.current.delete(peerId);
    }
    analysersRef.current.delete(peerId);
  }, []);

  const playAudio = useCallback((el: HTMLAudioElement) => {
    el.play()
      .then(() => setAudioBlocked(false))
      .catch(() => setAudioBlocked(true));
  }, []);

  const createPeer = useCallback(
    (peerId: string, initiator: boolean) => {
      closePeer(peerId);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcsRef.current.set(peerId, pc);

      localStreamRef.current
        ?.getTracks()
        .forEach((t) => pc.addTrack(t, localStreamRef.current!));

      pc.onicecandidate = (e) => {
        if (e.candidate)
          sendSignal(peerId, { type: "ice", candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        let el = audioElsRef.current.get(peerId);
        if (!el) {
          el = document.createElement("audio");
          el.autoplay = true;
          el.setAttribute("playsinline", "");
          el.style.display = "none";
          document.body.appendChild(el);
          audioElsRef.current.set(peerId, el);
        }
        el.srcObject = stream;
        playAudio(el);
        addAnalyser(peerId, stream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") pc.restartIce?.();
      };

      if (initiator) {
        void (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal(peerId, { type: "offer", sdp: offer });
          } catch {
            /* bỏ qua */
          }
        })();
      }
      return pc;
    },
    [addAnalyser, closePeer, playAudio, sendSignal],
  );

  const flushIce = useCallback(async (peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    const queued = pendingIceRef.current.get(peerId);
    if (!pc || !queued) return;
    pendingIceRef.current.delete(peerId);
    for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
  }, []);

  // ---------- Dọn dẹp ----------
  const teardown = useCallback(() => {
    pcsRef.current.forEach((_, id) => closePeer(id));
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    analysersRef.current.clear();
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setSpeaking({});
    setAudioBlocked(false);
  }, [closePeer]);

  // ---------- Bật / tắt ----------
  const join = useCallback(
    async (startMuted = mutedRef.current) => {
      if (!supported || enabledRef.current) return;
      setConnecting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        stream.getAudioTracks().forEach((t) => (t.enabled = !startMuted));
        localStreamRef.current = stream;
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        audioCtxRef.current = Ctx ? new Ctx() : null;
        void audioCtxRef.current?.resume().catch(() => {});
        if (myUserId) addAnalyser(myUserId, stream);

        const res = await monoEmit<{ peers: string[] }>("mono:voice:join", {
          muted: startMuted,
        });
        if (!res.ok || !res.data) {
          teardown();
          toast.error(res.error ?? "Không bật được voice chat");
          return;
        }
        enabledRef.current = true;
        mutedRef.current = startMuted;
        setMuted(startMuted);
        setEnabled(true);
        writePref(code, startMuted ? "muted" : "on");
        // Người mới vào gửi offer tới những người đã ở trong voice
        res.data.peers.forEach((id) => createPeer(id, true));
      } catch (err) {
        teardown();
        const name = (err as { name?: string })?.name;
        toast.error(
          name === "NotAllowedError"
            ? "Bạn chưa cho phép dùng micro"
            : name === "NotFoundError"
              ? "Không tìm thấy micro"
              : "Không bật được voice chat",
        );
      } finally {
        setConnecting(false);
      }
    },
    [supported, myUserId, addAnalyser, teardown, code, createPeer],
  );

  const leave = useCallback(() => {
    if (!enabledRef.current) return;
    enabledRef.current = false;
    setEnabled(false);
    writePref(code, null);
    teardown();
    void monoEmit("mono:voice:leave");
  }, [code, teardown]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !next));
    if (enabledRef.current) {
      writePref(code, next ? "muted" : "on");
      void monoEmit("mono:voice:mute", { muted: next });
    }
  }, [code]);

  const resumeAudio = useCallback(() => {
    void audioCtxRef.current?.resume().catch(() => {});
    audioElsRef.current.forEach((el) => playAudio(el));
  }, [playAudio]);

  // ---------- Tín hiệu từ server ----------
  useEffect(() => {
    const onUsers = ({ users: list }: { users: VoiceUser[] }) =>
      setUsers(
        Object.fromEntries(list.map((u) => [u.userId, { muted: u.muted }])),
      );
    const onLeft = ({ userId }: { userId: string }) => closePeer(userId);
    const onSignal = async ({ from, data }: { from: string; data: Signal }) => {
      if (!enabledRef.current || !data) return;
      try {
        if (data.type === "offer") {
          const pc = createPeer(from, false);
          await pc.setRemoteDescription(data.sdp);
          await flushIce(from);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(from, { type: "answer", sdp: answer });
        } else if (data.type === "answer") {
          const pc = pcsRef.current.get(from);
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(data.sdp);
            await flushIce(from);
          }
        } else if (data.type === "ice") {
          const pc = pcsRef.current.get(from);
          if (pc?.remoteDescription) {
            await pc.addIceCandidate(data.candidate).catch(() => {});
          } else {
            const q = pendingIceRef.current.get(from) ?? [];
            q.push(data.candidate);
            pendingIceRef.current.set(from, q);
          }
        }
      } catch {
        /* bỏ qua tín hiệu lỗi */
      }
    };

    socket.on("mono:voice:users", onUsers);
    socket.on("mono:voice:left", onLeft);
    socket.on("mono:voice:signal", onSignal);
    // Lấy danh sách người đang bật voice khi vừa vào phòng
    void monoEmit<{ users: VoiceUser[] }>("mono:voice:list").then((res) => {
      if (res.ok && res.data) onUsers(res.data);
    });
    return () => {
      socket.off("mono:voice:users", onUsers);
      socket.off("mono:voice:left", onLeft);
      socket.off("mono:voice:signal", onSignal);
    };
  }, [closePeer, createPeer, flushIce, sendSignal]);

  // Mất kết nối rồi kết nối lại -> server đã cho mình rời voice -> vào lại
  useEffect(() => {
    const onReconnect = () => {
      if (!enabledRef.current) return;
      enabledRef.current = false;
      setEnabled(false);
      teardown();
      // Chờ RoomContext vào lại phòng trước
      setTimeout(() => void join(mutedRef.current), 1200);
    };
    socket.on("connect", onReconnect);
    return () => {
      socket.off("connect", onReconnect);
    };
  }, [join, teardown]);

  // Tải lại trang khi đang bật voice -> tự bật lại
  useEffect(() => {
    const pref = initialPref;
    if (!pref) return;
    const t = setTimeout(() => void join(pref === "muted"), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPref]);

  // Rời phòng -> tắt voice & quên lựa chọn (tải lại trang thì không chạy -> vẫn tự bật lại)
  useEffect(
    () => () => {
      if (enabledRef.current) void monoEmit("mono:voice:leave");
      enabledRef.current = false;
      writePref(code, null);
      teardown();
    },
    [teardown, code],
  );

  return (
    <VoiceContext.Provider
      value={{
        supported,
        enabled,
        connecting,
        muted,
        users,
        speaking,
        audioBlocked,
        join: () => join(),
        leave,
        toggleMute,
        resumeAudio,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

/** Dùng trong phòng (có thể null khi chơi ngoài phòng / trang thử) */
export function useOptionalVoice() {
  return useContext(VoiceContext);
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice phải dùng bên trong VoiceProvider");
  return ctx;
}
