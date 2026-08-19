import { Injectable, Logger } from '@nestjs/common';
import type { EmailClient } from './email-digest.channel';

/**
 * Development stand-in for the email digest channel. Logs the message instead
 * of talking to an SMTP server so local development does not require email
 * credentials.
 */
@Injectable()
export class LogEmailClient implements EmailClient {
  private readonly logger = new Logger(LogEmailClient.name);

  async sendMail(to: string, subject: string, text: string): Promise<void> {
    this.logger.log({ to, subject, body: text }, 'Email digest (logged)');
  }
}
