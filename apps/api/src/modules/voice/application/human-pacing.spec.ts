import { describe, expect, it } from 'vitest';
import { recordingMs, splitIntoBubbles, typingMs } from './human-pacing';

describe('typingMs', () => {
  it('grows with length but stays within human bounds', () => {
    expect(typingMs(10)).toBe(1_200);
    expect(typingMs(100)).toBe(3_700);
    expect(typingMs(2_000)).toBe(5_500);
  });

  it('counts time already spent thinking, never dropping below a beat', () => {
    expect(typingMs(100, 2_000)).toBe(1_700);
    expect(typingMs(100, 60_000)).toBe(600);
  });
});

describe('recordingMs', () => {
  it('is a bounded fraction of the voice note length', () => {
    expect(recordingMs(1)).toBe(1_500);
    expect(recordingMs(5)).toBe(3_000);
    expect(recordingMs(60)).toBe(6_000);
    expect(recordingMs(5, 10_000)).toBe(800);
  });
});

describe('splitIntoBubbles', () => {
  it('keeps short replies as one message', () => {
    expect(splitIntoBubbles('Ji, consultation fee PKR 5,000 hai.')).toEqual(['Ji, consultation fee PKR 5,000 hai.']);
  });

  it('splits long replies at paragraph breaks', () => {
    const a = 'Shukriya Ahmed sahab, main aap ki baat samajh gaya. '.repeat(4).trim();
    const b = 'Ayesha Khan sahiba aap ka maamla dekhengi aur aaj raat 10 baje se pehle aap ko call karengi.';
    expect(splitIntoBubbles(`${a}\n\n${b}`)).toEqual([a, b]);
  });

  it('keeps a list together with its introduction', () => {
    const intro = 'Baraye meharbani yeh documents bhej dein, taa ke hum aap ki file jaldi tayyar kar saken aur kal ki peshi ke liye mukammal tayyari ho sake:';
    const list = '- FIR ki copy\n- Shanakhti card (dono taraf)\n- Pichli peshi ka order';
    const outro = 'Agar koi document abhi nahi mil raha to bata dein, hum us ka hal nikal lenge. Hum aap ke saath hain.';
    expect(splitIntoBubbles(`${intro}\n\n${list}\n\n${outro}`)).toEqual([`${intro}\n${list}`, outro]);
  });

  it('never sends more than three bubbles', () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Paragraph ${i + 1} ${'x'.repeat(80)}.`);
    const bubbles = splitIntoBubbles(paragraphs.join('\n\n'));
    expect(bubbles).toHaveLength(3);
    expect(bubbles.join('\n\n')).toBe(paragraphs.join('\n\n'));
  });

  it('groups sentences of one long paragraph, including Urdu full stops', () => {
    const urdu = 'یہ پہلا جملہ ہے جو کافی لمبا ہے اور اس میں تفصیل ہے۔ '.repeat(8).trim();
    const bubbles = splitIntoBubbles(urdu);
    expect(bubbles.length).toBeGreaterThan(1);
    expect(bubbles.length).toBeLessThanOrEqual(3);
  });
});
