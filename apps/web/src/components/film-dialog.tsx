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
          'group inline-flex items-center gap-2.5 rounded-full text-sm font-medium transition-colors',
          variant === 'pill' && 'border border-border bg-card py-1 pe-4 ps-1 hover:bg-muted',
          variant === 'link' && 'text-primary hover:text-primary/80',
          className,
        )}
      >
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105',
            variant === 'pill' ? 'size-8' : 'size-7',
          )}
        >
          <Play className="ms-0.5 size-3.5 fill-current" aria-hidden />
        </span>
        <span className={urdu}>{copy.film.watch}</span>
        <span className="text-muted-foreground tabular-nums">· 2:00</span>
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
