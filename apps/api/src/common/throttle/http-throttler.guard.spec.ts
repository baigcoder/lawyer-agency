import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { throttleTracker } from './http-throttler.guard';

function req(headers: Record<string, string>, ip = '10.0.0.5'): Request {
  return { headers, ip } as never;
}

function jwt(payload: object): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(payload)}.signature`;
}

describe('throttleTracker', () => {
  it('counts signed-in requests against the Clerk user, not the shared proxy IP', () => {
    const a = throttleTracker(req({ authorization: `Bearer ${jwt({ sub: 'user_a' })}`, 'x-real-ip': '76.76.21.1' }));
    const b = throttleTracker(req({ authorization: `Bearer ${jwt({ sub: 'user_b' })}`, 'x-real-ip': '76.76.21.1' }));
    expect(a).toBe('user:user_a');
    expect(b).toBe('user:user_b');
  });

  it('uses the dev-seam tenant and user headers', () => {
    expect(throttleTracker(req({ 'x-tenant-id': 't1', 'x-user-id': 'u1' }))).toBe('dev:t1:u1');
  });

  it('falls back to the Caddy-set client IP, then the socket address', () => {
    expect(throttleTracker(req({ 'x-real-ip': '203.0.113.9' }))).toBe('ip:203.0.113.9');
    expect(throttleTracker(req({ authorization: 'Bearer not-a-jwt' }))).toBe('ip:10.0.0.5');
  });
});
