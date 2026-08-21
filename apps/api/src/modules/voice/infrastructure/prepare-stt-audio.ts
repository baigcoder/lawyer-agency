import { spawn } from 'node:child_process';

const FFMPEG_TIMEOUT_MS = 20_000;

/** Convert WhatsApp ogg/opus (and similar) to 16 kHz mono WAV for STT. */
export async function prepareSttAudio(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (mimeType.includes('wav')) return { buffer, mimeType: 'audio/wav' };
  const hinted = ffmpegFormat(mimeType);
  try {
    return { buffer: await convertToWav(buffer, hinted), mimeType: 'audio/wav' };
  } catch {
    if (!hinted) return { buffer, mimeType };
    try {
      return { buffer: await convertToWav(buffer, undefined), mimeType: 'audio/wav' };
    } catch {
      return { buffer, mimeType };
    }
  }
}

function ffmpegFormat(mimeType: string): string | undefined {
  if (mimeType.includes('ogg') || mimeType.includes('opus')) return 'ogg';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) return 'mp4';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  return undefined;
}

function convertToWav(input: Buffer, format: string | undefined): Promise<Buffer> {
  const args = ['-hide_banner', '-loglevel', 'error'];
  if (format) args.push('-f', format);
  args.push('-i', 'pipe:0', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1');
  return spawnStdout('ffmpeg', args, input);
}

function spawnStdout(command: string, args: string[], stdin: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} timeout`));
    }, FFMPEG_TIMEOUT_MS);
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
    child.stdin.end(stdin);
  });
}
