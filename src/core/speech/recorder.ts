import { audioCtx } from '../audio';

// うたの録音（あとで保護者・子どもが聞けるように）。音声認識と同時に MediaRecorder で録る。
// ・形式は webm（Opus）を先に。指定したビットレートを守るので小さい（40秒で約 160KB。記録の共有の1件 1MB に入る）。
//   使えない端末（iPhone など）は mp4（AAC）。Chrome の mp4 は ビットレートの指定が効かず、40秒で約 640KB
// ・音の大きさを見ておき、まったく音が入っていない録音（ほかの機能にマイクを取られたときなど）は保存しない

export interface RecordingResult {
  dataUrl: string;
  mime: string;
  durationMs: number;
  peak: number; // 0..1（いちばん大きかった音）
}

export interface RecorderHandle {
  /** 録音を止めて、中身を返す（録れていなければ null） */
  stop(): Promise<RecordingResult | null>;
  /** 録音を捨てる */
  cancel(): void;
}

/** これより小さい音しかない録音は「録れていない」とする（マイクを取られて無音になったとき） */
export const SILENT_PEAK = 0.003;

const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];

export function canRecord(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function pickMime(): string | undefined {
  for (const m of MIMES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* noop */
    }
  }
  return undefined;
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** 録音を始める（使えないときは null。録音できなくても、うたの問題はそのまま続ける） */
export async function startRecording(maxMs = 40_000): Promise<RecorderHandle | null> {
  if (!canRecord()) return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
  } catch {
    return null;
  }
  const mime = pickMime();
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32_000 });
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }

  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  // 音の大きさ（入っているかどうかだけ見る。スピーカーにはつながない）
  let peak = 0;
  let measured = false;
  let meter: ReturnType<typeof setInterval> | undefined;
  let source: MediaStreamAudioSourceNode | null = null;
  const ctx = audioCtx();
  if (ctx) {
    try {
      source = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      source.connect(an);
      const buf = new Float32Array(an.fftSize);
      meter = setInterval(() => {
        if (ctx.state !== 'running') return;
        measured = true;
        an.getFloatTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) {
          const a = Math.abs(buf[i]);
          if (a > peak) peak = a;
        }
      }, 100);
    } catch {
      /* 大きさは測れない → 録音はそのまま保存する */
    }
  }

  const t0 = performance.now();
  let tEnd = 0;
  const stopped = new Promise<void>((resolve) => {
    rec.onstop = () => {
      tEnd = performance.now();
      resolve();
    };
  });
  rec.start(1000);
  const maxTimer = setTimeout(() => {
    if (rec.state === 'recording') rec.stop();
  }, maxMs);

  const cleanup = () => {
    clearTimeout(maxTimer);
    if (meter) clearInterval(meter);
    try {
      source?.disconnect();
    } catch {
      /* noop */
    }
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    async stop() {
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch {
        /* noop */
      }
      await stopped;
      cleanup();
      if (!chunks.length) return null;
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      return {
        dataUrl: await blobToDataUrl(blob),
        mime: blob.type,
        durationMs: Math.round((tEnd || performance.now()) - t0),
        peak: measured ? peak : 1 // 測れなかったときは「入っている」とする
      };
    },
    cancel() {
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch {
        /* noop */
      }
      cleanup();
    }
  };
}
