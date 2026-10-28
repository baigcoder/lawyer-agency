/**
 * Timing and shape of a reply that reads like a person on WhatsApp: a short
 * "typing…" proportional to what is being sent, several short messages rather
 * than one wall of text, and "recording audio…" before a voice note.
 *
 * Compressed on purpose — a real 40 wpm typist would take a minute over a
 * 300-character answer, which reads as slow service, not as a human.
 */

const MIN_TYPING_MS = 1_200;
const MAX_TYPING_MS = 5_500;
const MS_PER_CHAR = 30;
const BASE_TYPING_MS = 700;

/** "typing…" duration for one bubble; time already spent thinking counts. */
export function typingMs(chars: number, alreadyElapsedMs = 0): number {
  const natural = Math.min(MAX_TYPING_MS, Math.max(MIN_TYPING_MS, BASE_TYPING_MS + chars * MS_PER_CHAR));
  return Math.max(600, natural - Math.max(0, alreadyElapsedMs));
}

/** "recording audio…" before a voice note — a fraction of its length, bounded. */
export function recordingMs(audioSeconds: number, alreadyElapsedMs = 0): number {
  const natural = Math.min(6_000, Math.max(1_500, audioSeconds * 600));
  return Math.max(800, natural - Math.max(0, alreadyElapsedMs));
}

/** Pause between two bubbles of the same answer, before the next "typing…". */
export const BETWEEN_BUBBLES_MS = 450;

const SPLIT_ABOVE_CHARS = 280;
const MAX_BUBBLES = 3;
const TARGET_BUBBLE_CHARS = 240;
const LIST_LINE = /^\s*([-•*]|\d+[.)])\s+/;

/**
 * Splits a long reply the way people split it: at paragraph breaks first,
 * then at sentence ends. Short replies stay one message. Lists stay whole
 * with the line that introduces them, and there are never more than three
 * bubbles (the tail is merged into the last).
 */
export function splitIntoBubbles(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= SPLIT_ABOVE_CHARS) return trimmed ? [trimmed] : [];

  const paragraphs = mergeLists(trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean));
  const pieces =
    paragraphs.length > 1 ? paragraphs : groupSentences(trimmed, TARGET_BUBBLE_CHARS);

  if (pieces.length <= MAX_BUBBLES) return pieces;
  const head = pieces.slice(0, MAX_BUBBLES - 1);
  const tail = pieces.slice(MAX_BUBBLES - 1).join('\n\n');
  return [...head, tail];
}

/** A list (and the sentence introducing it) is one bubble, never split up. */
function mergeLists(paragraphs: string[]): string[] {
  const out: string[] = [];
  for (const paragraph of paragraphs) {
    const isList = paragraph.split('\n').every((line) => LIST_LINE.test(line));
    const previous = out[out.length - 1];
    if (isList && previous !== undefined) out[out.length - 1] = `${previous}\n${paragraph}`;
    else out.push(paragraph);
  }
  return out;
}

function groupSentences(text: string, target: number): string[] {
  const sentences = text.split(/(?<=[.!?۔؟])\s+/).filter(Boolean);
  if (sentences.length < 3) return [text];
  const groups: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + 1 + sentence.length > target) {
      groups.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) groups.push(current);
  return groups;
}
