import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import type { Env } from '../../../../config/env';
import type { EmailClient } from './email-digest.channel';

const SMTP_TIMEOUT_MS = 20_000;

/**
 * Minimal SMTP client: implicit TLS on 465, STARTTLS on other ports (typically
 * 587). Used when SMTP_HOST is configured so payment receipts can reach the
 * firm owner without a vendor SDK.
 */
@Injectable()
export class SmtpEmailClient implements EmailClient {
  private readonly logger = new Logger(SmtpEmailClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendMail(to: string, subject: string, text: string): Promise<void> {
    const host = this.config.get('SMTP_HOST', { infer: true });
    const from = this.config.get('EMAIL_FROM', { infer: true });
    const user = this.config.get('SMTP_USER', { infer: true });
    const pass = this.config.get('SMTP_PASS', { infer: true });
    const port = this.config.get('SMTP_PORT', { infer: true }) ?? 465;
    if (!host || !from) {
      throw new Error('SMTP_HOST and EMAIL_FROM are required to send email');
    }

    const implicitTls = port === 465;
    const raw = implicitTls
      ? tlsConnect({ host, port, servername: host })
      : netConnect({ host, port });
    await waitReady(raw, implicitTls);
    raw.setTimeout(SMTP_TIMEOUT_MS);

    let socket: Socket | TLSSocket = raw;
    let read = createReader(socket);
    try {
      await expectCode(read, 220);
      await send(socket, 'EHLO wakeel.local');
      await drainUntil250(read);

      if (!implicitTls) {
        await send(socket, 'STARTTLS');
        await expectCode(read, 220);
        detachReader(socket);
        const upgraded = tlsConnect({ socket, host, servername: host });
        await waitReady(upgraded, true);
        upgraded.setTimeout(SMTP_TIMEOUT_MS);
        socket = upgraded;
        read = createReader(socket);
        await send(socket, 'EHLO wakeel.local');
        await drainUntil250(read);
      }

      if (user && pass) {
        await send(socket, 'AUTH LOGIN');
        await expectCode(read, 334);
        await send(socket, Buffer.from(user).toString('base64'));
        await expectCode(read, 334);
        await send(socket, Buffer.from(pass).toString('base64'));
        await expectCode(read, 235);
      }
      await send(socket, `MAIL FROM:<${from}>`);
      await expectCode(read, 250);
      await send(socket, `RCPT TO:<${to}>`);
      await expectCode(read, 250);
      await send(socket, 'DATA');
      await expectCode(read, 354);
      const body = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject.replace(/\r?\n/g, ' ')}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        text.replace(/^\./gm, '..'),
        '.',
      ].join('\r\n');
      await send(socket, body);
      await expectCode(read, 250);
      await send(socket, 'QUIT');
    } finally {
      socket.end();
    }
    this.logger.debug({ to, subject }, 'SMTP mail sent');
  }
}

function send(socket: NodeJS.WritableStream, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(`${line}\r\n`, (error) => (error ? reject(error) : resolve()));
  });
}

function waitReady(socket: Socket, tls: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    socket.once('error', onError);
    socket.once(tls ? 'secureConnect' : 'connect', () => {
      socket.off('error', onError);
      resolve();
    });
  });
}

function detachReader(socket: Socket): void {
  socket.removeAllListeners('data');
}

function createReader(socket: NodeJS.ReadableStream): () => Promise<string> {
  let buffer = '';
  const lines: string[] = [];
  const pending: Array<(value: string) => void> = [];
  socket.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    let idx = buffer.indexOf('\r\n');
    while (idx >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const waiter = pending.shift();
      if (waiter) waiter(line);
      else lines.push(line);
      idx = buffer.indexOf('\r\n');
    }
  });
  return () =>
    new Promise((resolve, reject) => {
      const queued = lines.shift();
      if (queued !== undefined) {
        resolve(queued);
        return;
      }
      const timer = setTimeout(() => reject(new Error('SMTP read timeout')), SMTP_TIMEOUT_MS);
      pending.push((value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
}

async function expectCode(read: () => Promise<string>, code: number): Promise<void> {
  const line = await read();
  if (!line.startsWith(String(code))) {
    throw new Error(`SMTP expected ${code}, got: ${line}`);
  }
}

async function drainUntil250(read: () => Promise<string>): Promise<void> {
  for (;;) {
    const line = await read();
    if (/^250 /.test(line)) return;
    if (!/^250-/.test(line) && !line.startsWith('250')) {
      throw new Error(`SMTP EHLO failed: ${line}`);
    }
  }
}
