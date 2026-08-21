import { spawn } from 'node:child_process';
import type { SynthesizeInput, SynthesizeResult } from '../application/text-to-speech.port';
import { prepareSpokenTtsText } from '../application/spoken-text';

const ESPEAK_TIMEOUT_MS = 20_000;
const FFMPEG_TIMEOUT_MS = 20_000;

/** Local TTS when ElevenLabs is unset — Docker runner already installs espeak-ng. */
export async function synthesizeWithEspeak(input: SynthesizeInput): Promise<SynthesizeResult> {
  const spoken = prepareSpokenTtsText(input.text).slice(0, 800);
  if (!spoken) throw new Error('espeak: empty text');
  const wav = await spawnStdout(
    'espeak-ng',
    ['-v', input.language === 'ur' ? 'ur' : 'en', '-s', '118', '--stdout', spoken],
    ESPEAK_TIMEOUT_MS,
  );
  const mp3 = await wavToMp3(wav).catch(() => null);
  return {
    audioBuffer: mp3 ?? wav,
    mimeType: mp3 ? 'audio/mpeg' : 'audio/wav',
    charactersUsed: spoken.length,
  };
}

function wavToMp3(wav: Buffer): Promise<Buffer> {
  return spawnStdout(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-f', 'wav', '-i', 'pipe:0', '-f', 'mp3', '-codec:a', 'libmp3lame', '-q:a', '4', 'pipe:1'],
    FFMPEG_TIMEOUT_MS,
    wav,
  );
}

function spawnStdout(command: string, args: string[], timeoutMs: number, stdin?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} timeout`));
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', () => undefined);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`${command} ${code ?? 'fail'}`));
    });
    if (stdin) child.stdin.end(stdin);
    else child.stdin.end();
  });
}
