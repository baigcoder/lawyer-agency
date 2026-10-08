'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

/**
 * The Wakeel launch film. Autoplays muted only while on screen (browsers block
 * autoplay with sound) and pauses when scrolled away; the viewer opts into
 * sound. Reduced motion: no autoplay — the poster waits for a play press.
 */
export function FilmPlayer({ src, poster, className }: { src: string; poster: string; className?: string }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.45 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  };

  const toggleSound = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    // Turning sound on restarts the film so the score lands from its first bar.
    if (!video.muted) {
      video.currentTime = 0;
      void video.play().catch(() => undefined);
    }
  };

  return (
    <div className={cn('group relative overflow-hidden rounded-2xl bg-black shadow-[var(--shadow-frame)] ring-1 ring-white/10', className)}>
      <video
        ref={ref}
        className="block aspect-video w-full"
        src={src}
        poster={poster}
        muted
        playsInline
        loop
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label={t('filmLabel')}
      />
      {!playing ? (
        <button
          type="button"
          onClick={toggle}
          className="absolute inset-0 grid place-items-center bg-black/25 transition-colors hover:bg-black/15 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
          aria-label={t('filmPlay')}
        >
          <span className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl ring-8 ring-primary/20">
            <Play className="ms-1 size-8" aria-hidden />
          </span>
        </button>
      ) : null}
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={toggle}
          className="flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/70"
          aria-label={playing ? t('filmPause') : t('filmPlay')}
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={!muted}
          className="flex h-10 items-center gap-2 rounded-full bg-black/55 px-4 text-sm text-white backdrop-blur-md transition-colors hover:bg-black/70"
        >
          {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
          {muted ? t('filmSoundOn') : t('filmSoundOff')}
        </button>
      </div>
    </div>
  );
}
