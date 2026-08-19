import { describe, expect, it } from 'vitest';
import { fastRoute, needsRetrieval } from './fast-route';

describe('fastRoute', () => {
  it('classifies short greetings without an LLM', () => {
    expect(fastRoute({ clientText: 'Hy', hasOpenCase: false, hasIntakeFields: false })?.intent).toBe('GREETING');
    expect(fastRoute({ clientText: 'Salam', hasOpenCase: false, hasIntakeFields: false })?.intent).toBe(
      'GREETING',
    );
  });

  it('classifies flirty chat as off-topic', () => {
    expect(fastRoute({ clientText: 'hi love', hasOpenCase: false, hasIntakeFields: false })?.intent).toBe(
      'OFF_TOPIC',
    );
  });

  it('routes a new legal matter to intake', () => {
    expect(
      fastRoute({ clientText: 'I need help with divorce', hasOpenCase: false, hasIntakeFields: false })?.intent,
    ).toBe('INTAKE');
  });

  it('routes fee/hours questions to FAQ', () => {
    expect(
      fastRoute({ clientText: 'what is your consultation fee?', hasOpenCase: false, hasIntakeFields: false })
        ?.intent,
    ).toBe('FAQ');
  });

  it('continues intake when fields already exist', () => {
    expect(
      fastRoute({ clientText: 'Lahore, DHA phase 5', hasOpenCase: false, hasIntakeFields: true })?.intent,
    ).toBe('INTAKE');
  });

  it('routes appointment and document-collection asks', () => {
    expect(
      fastRoute({ clientText: 'I need an appointment', hasOpenCase: false, hasIntakeFields: false })?.intent,
    ).toBe('APPOINTMENT');
    expect(
      fastRoute({ clientText: 'kya documents chahiye', hasOpenCase: false, hasIntakeFields: false })?.intent,
    ).toBe('DOCUMENT_REQUEST');
    expect(
      fastRoute({ clientText: 'I will send documents', hasOpenCase: false, hasIntakeFields: false })?.intent,
    ).toBe('DOCUMENT_REQUEST');
  });
});

describe('needsRetrieval', () => {
  it('skips RAG for greetings and off-topic', () => {
    expect(needsRetrieval('GREETING')).toBe(false);
    expect(needsRetrieval('OFF_TOPIC')).toBe(false);
    expect(needsRetrieval('INTAKE')).toBe(true);
  });
});
