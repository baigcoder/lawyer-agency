import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../../../common/crypto/crypto.service';
import type { Env } from '../../../config/env';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface CalendarEvent {
  id: string;
  htmlLink: string;
}

/**
 * Google Calendar integration for lawyer appointments.
 *
 * OAuth tokens are stored encrypted at rest (D-024). All calls use fetch so
 * the module does not depend on the Google client SDK (D-052 discipline).
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly scopes = ['https://www.googleapis.com/auth/calendar.events'];

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly crypto: CryptoService,
  ) {}

  private get clientId(): string | undefined {
    return this.config.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  private get clientSecret(): string | undefined {
    return this.config.get('GOOGLE_CLIENT_SECRET', { infer: true });
  }

  private get redirectUri(): string | undefined {
    return this.config.get('GOOGLE_REDIRECT_URI', { infer: true });
  }

  private get reminderMinutes(): number {
    return this.config.get('GOOGLE_CALENDAR_REMINDER_MINUTES', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  buildAuthUrl(state: string): string {
    if (!this.isConfigured()) throw new Error('Google Calendar OAuth is not configured');
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.redirectUri!,
      response_type: 'code',
      scope: this.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ refreshToken: string }> {
    if (!this.isConfigured()) throw new Error('Google Calendar OAuth is not configured');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: this.redirectUri!,
        grant_type: 'authorization_code',
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google token exchange failed: ${response.status} ${text}`);
    }
    const data = (await response.json()) as TokenResponse;
    if (!data.refresh_token) {
      throw new Error('Google did not return a refresh token; re-authorize with prompt=consent');
    }
    return { refreshToken: data.refresh_token };
  }

  async createEvent(input: {
    refreshTokenEnc: string;
    calendarId: string;
    summary: string;
    description?: string | undefined;
    location?: string | undefined;
    start: Date;
    end: Date;
    attendees?: { email: string }[] | undefined;
  }): Promise<CalendarEvent | null> {
    const accessToken = await this.refreshAccessToken(input.refreshTokenEnc);
    const body = {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start.toISOString() },
      end: { dateTime: input.end.toISOString() },
      attendees: input.attendees ?? [],
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: this.reminderMinutes }],
      },
    };
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      this.logger.warn({ status: response.status, body: text }, 'Google Calendar create event failed');
      return null;
    }
    return (await response.json()) as CalendarEvent;
  }

  async updateEvent(input: {
    refreshTokenEnc: string;
    calendarId: string;
    eventId: string;
    summary: string;
    description?: string | undefined;
    location?: string | undefined;
    start: Date;
    end: Date;
    attendees?: { email: string }[] | undefined;
  }): Promise<CalendarEvent | null> {
    const accessToken = await this.refreshAccessToken(input.refreshTokenEnc);
    const body = {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start.toISOString() },
      end: { dateTime: input.end.toISOString() },
      attendees: input.attendees ?? [],
    };
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      this.logger.warn({ status: response.status, body: text }, 'Google Calendar update event failed');
      return null;
    }
    return (await response.json()) as CalendarEvent;
  }

  async deleteEvent(input: {
    refreshTokenEnc: string;
    calendarId: string;
    eventId: string;
  }): Promise<boolean> {
    const accessToken = await this.refreshAccessToken(input.refreshTokenEnc);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!response.ok && response.status !== 410) {
      const text = await response.text();
      this.logger.warn({ status: response.status, body: text }, 'Google Calendar delete event failed');
      return false;
    }
    return true;
  }

  private async refreshAccessToken(refreshTokenEnc: string): Promise<string> {
    const refreshToken = this.crypto.decrypt(refreshTokenEnc);
    if (!this.isConfigured()) throw new Error('Google Calendar OAuth is not configured');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google refresh token failed: ${response.status} ${text}`);
    }
    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }
}
