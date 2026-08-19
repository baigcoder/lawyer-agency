'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Pause, Play } from 'lucide-react';
import { apiRequestBlob } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/language';

interface VoiceNoteProps {
  messageId: string;
  mediaUrl: string | null;
  durationSeconds: number | null;
  inbound: boolean;
}

function waveformHeights(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const heights: number[] = [];
  for (let i = 0; i < 28; i += 1) {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    heights.push(22 + (h >>> 0) % 78);
  }
  return heights;
}

function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function mediaApiPath(mediaUrl: string): string {
  return mediaUrl.startsWith('/backend') ? mediaUrl.slice('/backend'.length) : mediaUrl;
}

export function VoiceNote({ messageId, mediaUrl, durationSeconds }: VoiceNoteProps) {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [knownDuration, setKnownDuration] = useState(durationSeconds ?? 0);
  const [failed, setFailed] = useState(!mediaUrl);
  const bars = useMemo(() => waveformHeights(messageId), [messageId]);

  useEffect(() => {
    if (!mediaUrl) return undefined;
    let objectUrl: string | null = null;
    let cancelled = false;
    apiRequestBlob(mediaApiPath(mediaUrl))
      .then(({ blob, mimeType }) => {
        if (cancelled) return;
        const type =
          mimeType.includes('ogg') || mimeType.includes('opus')
            ? 'audio/ogg; codecs=opus'
            : mimeType.includes('mpeg') || mimeType.includes('mp3')
              ? 'audio/mpeg'
              : mimeType || blob.type || 'audio/mpeg';
        const typed = new Blob([blob], { type });
        objectUrl = URL.createObjectURL(typed);
        setSrc(objectUrl);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onTime = () => setElapsed(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setKnownDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setElapsed(0);
    };
    const onError = () => setFailed(true);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [src]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setFailed(true);
    }
  }

  const progressBase = knownDuration > 0 ? knownDuration : (durationSeconds ?? 0);
  const progress = progressBase > 0 ? Math.min(1, elapsed / progressBase) : 0;
  const displaySeconds = playing || elapsed > 0 ? elapsed : progressBase;

  return (
    <div className="relative mt-1 flex min-w-[210px] max-w-[280px] items-center gap-2">
      {src ? (
        <audio ref={audioRef} src={src} preload="auto" playsInline className="pointer-events-none absolute h-px w-px opacity-0" />
      ) : null}
      <button
        type="button"
        disabled={!src}
        onClick={() => void togglePlay()}
        aria-label={playing ? t('inboxVoiceNotePause') : t('inboxVoiceNotePlay')}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-50',
          'bg-current/15 text-current',
        )}
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ms-0.5 h-4 w-4" aria-hidden />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex h-6 items-end gap-px" aria-hidden>
          {bars.map((height, index) => {
            const filled = index / bars.length <= progress;
            return (
              <span
                key={index}
                className={cn('w-[3px] rounded-full', filled ? 'bg-current' : 'bg-current/30')}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
        <span className="text-[10px] tabular-nums opacity-70">
          {failed && !src ? t('inboxVoiceNoteUnavailable') : formatDuration(displaySeconds)}
        </span>
      </div>
      <Mic className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
    </div>
  );
}
