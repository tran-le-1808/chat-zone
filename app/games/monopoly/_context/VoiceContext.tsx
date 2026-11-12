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

/** Dự phòng khi server chưa trả cấu hình (TURN lấy từ biến môi trường server) */
const FALLBACK_ICE: RTCIceServer[] = [
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
  /** Trạng thái kết nối tới từng người (new / connecting / connected / failed ...) */
  peerStates: Record<string, RTCPeerConnectionState>;
  /** Âm lượng nghe voice 0..1 */
  volume: number;
  setVolume: (v: number) => void;
  /** Danh sách micro & micro đang dùng */
  devices: MediaDeviceInfo[];
  deviceId: string | null;
  selectDevice: (deviceId: string) => Promise<void>;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

const storageKey = (code: string) => `room-voice:${code}`;
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
  const { code, myUserId, prefix } = useRoom();

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
  const [peerStates, setPeerStates] = useState<
    Record<string, RTCPeerConnectionState>
  >({});
  const [volume, setVolumeState] = useState(1);
  const volumeRef = useRef(1);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const iceRef = useRef<RTCIceServer[]>(FALLBACK_ICE);
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
  const sendSignal = useCallback(
    (to: string, data: Signal) => {
      void monoEmit(`${prefix}:voice:signal`, { to, data });
    },
    [prefix],
  );

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
      const pc = new RTCPeerConnection({ iceServers: iceRef.current });
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
        el.volume = volumeRef.current;
        playAudio(el);
        addAnalyser(peerId, stream);
      };
      pc.onconnectionstatechange = () => {
        setPeerStates((prev) => ({ ...prev, [peerId]: pc.connectionState }));
        // Mất kết nối -> thử lại ICE (TURN sẽ được dùng nếu kết nối trực tiếp thất bại)
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
    setPeerStates({});
  }, [closePeer]);

  // ---------- Thiết bị micro ----------
  const deviceIdRef = useRef<string | null>(null);
  const leaveRef = useRef<() => void>(() => {});

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "audioinput"));
    } catch {
      /* bỏ qua */
    }
  }, []);

  /** Micro bị rút / tắt giữa chừng -> báo & rời voice (vẫn chơi tiếp được) */
  const watchTrack = (stream: MediaStream) => {
    stream.getAudioTracks().forEach((t) => {
      t.onended = () => {
        if (!enabledRef.current) return;
        toast.error("Micro đã bị ngắt kết nối — đã tắt voice chat");
        leaveRef.current();
      };
      const settings = t.getSettings?.();
      if (settings?.deviceId) {
        deviceIdRef.current = settings.deviceId;
        setDeviceId(settings.deviceId);
      }
    });
  };

  /** Đổi micro khi đang trong voice: thay track trên mọi kết nối, không cần kết nối lại */
  const selectDevice = useCallback(
    async (id: string) => {
      deviceIdRef.current = id;
      setDeviceId(id);
      if (!enabledRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: id },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const track = stream.getAudioTracks()[0];
        track.enabled = !mutedRef.current;
        await Promise.all(
          Array.from(pcsRef.current.values()).map((pc) =>
            pc
              .getSenders()
              .find((s) => s.track?.kind === "audio")
              ?.replaceTrack(track),
          ),
        );
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = stream;
        watchTrack(stream);
        if (myUserId) addAnalyser(myUserId, stream);
      } catch {
        toast.error("Không dùng được micro này");
      }
    },
     
    [myUserId, addAnalyser],
  );

  const setVolume = useCallback((v: number) => {
    const next = Math.max(0, Math.min(1, v));
    volumeRef.current = next;
    setVolumeState(next);
    audioElsRef.current.forEach((el) => (el.volume = next));
  }, []);

  // ---------- Bật / tắt ----------
  const join = useCallback(
    async (startMuted = mutedRef.current) => {
      if (!supported || enabledRef.current) return;
      setConnecting(true);
      try {
        // Cấu hình STUN / TURN do server cấp (không để credential ở frontend)
        const ice = await monoEmit<{ iceServers: RTCIceServer[] }>(
          `${prefix}:voice:config`,
        );
        if (ice.ok && ice.data?.iceServers?.length)
          iceRef.current = ice.data.iceServers;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(deviceIdRef.current
              ? { deviceId: { exact: deviceIdRef.current } }
              : {}),
          },
        });
        watchTrack(stream);
        void refreshDevices();
        stream.getAudioTracks().forEach((t) => (t.enabled = !startMuted));
        localStreamRef.current = stream;
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        audioCtxRef.current = Ctx ? new Ctx() : null;
        void audioCtxRef.current?.resume().catch(() => {});
        if (myUserId) addAnalyser(myUserId, stream);

        const res = await monoEmit<{ peers: string[] }>(
          `${prefix}:voice:join`,
          {
            muted: startMuted,
          },
        );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supported, myUserId, addAnalyser, teardown, code, createPeer, prefix],
  );

  const leave = useCallback(() => {
    if (!enabledRef.current) return;
    enabledRef.current = false;
    setEnabled(false);
    writePref(code, null);
    teardown();
    void monoEmit(`${prefix}:voice:leave`);
  }, [code, teardown, prefix]);

  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !next));
    if (enabledRef.current) {
      writePref(code, next ? "muted" : "on");
      void monoEmit(`${prefix}:voice:mute`, { muted: next });
    }
  }, [code, prefix]);

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

    socket.on(`${prefix}:voice:users`, onUsers);
    socket.on(`${prefix}:voice:left`, onLeft);
    socket.on(`${prefix}:voice:signal`, onSignal);
    // Lấy danh sách người đang bật voice khi vừa vào phòng
    void monoEmit<{ users: VoiceUser[] }>(`${prefix}:voice:list`).then(
      (res) => {
        if (res.ok && res.data) onUsers(res.data);
      },
    );
    return () => {
      socket.off(`${prefix}:voice:users`, onUsers);
      socket.off(`${prefix}:voice:left`, onLeft);
      socket.off(`${prefix}:voice:signal`, onSignal);
    };
  }, [closePeer, createPeer, flushIce, sendSignal, prefix]);

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
      if (enabledRef.current) void monoEmit(`${prefix}:voice:leave`);
      enabledRef.current = false;
      writePref(code, null);
      teardown();
    },
    [teardown, code, prefix],
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
        peerStates,
        volume,
        setVolume,
        devices,
        deviceId,
        selectDevice,
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
