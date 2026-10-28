'use client';

import { Play } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLandingCopy } from '@/lib/landing-copy';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

/**
 * The narrated product film (EN or UR, following the language toggle) in a
 * dialog. Nothing downloads until the dialog opens (`preload="none"` and the
 * video only mounts when open), so the landing page stays light. Captions are
 * generated from the narration script.
 */
export function FilmDialog({ variant = 'pill', className }: { variant?: 'pill' | 'link'; className?: string }) {
  const copy = useLandingCopy();
  const { language, dir } = useLanguage();
  const urdu = dir === 'rtl' ? 'font-urdu' : undefined;
  const base = `/video/wakeel-tour-${language === 'ur' ? 'ur' : 'en'}`;

  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          'group inline-flex items-center gap-3 rounded-full text-start transition-colors',
          variant === 'pill' && 'border border-border bg-card py-1.5 pe-5 ps-1.5 hover:bg-muted',
          variant === 'link' && 'rounded-xl',
          className,
        )}
      >
        {/* Play button with two staggered rings pulsing outward (still under reduced motion). */}
        <span className={cn('relative flex shrink-0 items-center justify-center', variant === 'pill' ? 'size-10' : 'size-11')}>
          <span aria-hidden className="film-pulse absolute inset-0 rounded-full bg-primary/35" />
          <span aria-hidden className="film-pulse absolute inset-0 rounded-full bg-primary/25 [animation-delay:1.1s]" />
          <span className="relative flex size-full items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_-6px_var(--primary)] transition-transform group-hover:scale-110">
            <Play className="ms-0.5 size-4 fill-current" aria-hidden />
          </span>
        </span>
        <span className="flex flex-col leading-tight">
          <span className="flex items-baseline gap-1.5 text-sm font-semibold">
            <span className={cn(variant === 'link' && 'text-primary', urdu)}>{copy.film.watch}</span>
            <span className="font-normal tabular-nums text-muted-foreground">· 2:00</span>
          </span>
          <span className={cn('text-xs text-muted-foreground', urdu)}>{copy.film.hint}</span>
        </span>
      </DialogTrigger>
      <DialogContent className="film-dialog gap-0 overflow-hidden bg-black p-0 text-white ring-white/10 sm:max-w-[min(64rem,calc(100%-2rem))] [&_[data-slot=dialog-close]]:z-10 [&_[data-slot=dialog-close]]:bg-black/50 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]:hover]:bg-black/70">
        <DialogTitle className="sr-only">{copy.film.title}</DialogTitle>
        <DialogDescription className="sr-only">{copy.film.description}</DialogDescription>
        <video
          key={base}
          className="block aspect-video w-full bg-black"
          controls
          autoPlay
          playsInline
          preload="none"
          poster={`${base}.jpg`}
        >
          <source src={`${base}.webm`} type="video/webm" />
          <track kind="captions" src={`${base}.vtt`} srcLang={language === 'ur' ? 'ur' : 'en'} label={copy.film.captions} />
        </video>
      </DialogContent>
    </Dialog>
  );
}
