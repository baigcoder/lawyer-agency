import { spawn } from 'node:child_process';

const FFMPEG_TIMEOUT_MS = 20_000;

/**
 * WhatsApp voice notes (PTT) need Ogg/Opus. ElevenLabs returns mp3;
 * Evolution `encoding: true` can convert, but local opus is more reliable.
 */
export async function toWhatsappVoiceNote(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (mimeType.includes('ogg') || mimeType.includes('opus')) {
    return { buffer, mimeType: 'audio/ogg; codecs=opus' };
  }
  try {
    return { buffer: await convertToOpus(buffer), mimeType: 'audio/ogg; codecs=opus' };
  } catch {
    return { buffer, mimeType };
  }
}

function convertToOpus(input: Buffer): Promise<Buffer> {
  return spawnStdout(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'libopus',
      '-b:a',
      '48k',
      '-application',
      'voip',
      '-f',
      'ogg',
      'pipe:1',
    ],
    input,
  );
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
