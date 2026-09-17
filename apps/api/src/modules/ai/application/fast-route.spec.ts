import { describe, expect, it } from 'vitest';
import { fastRoute, needsRetrieval } from './fast-route';

describe('fastRoute', () => {
  it('classifies unusable voice transcripts without an LLM', () => {
    expect(
      fastRoute({
        clientText: '(voice note — transcription unavailable)',
        hasOpenCase: false,
        hasIntakeFields: false,
      })?.intent,
    ).toBe('GREETING');
  });

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
      fastRoute({ clientText: 'I will send documents', hasOpenCase: false, hasIntakeFields: false })?.intent,
    ).toBe('DOCUMENT_REQUEST');
  });

  it('answers "which documents?" from the knowledge base instead of opening a request', () => {
    expect(
      fastRoute({ clientText: 'kya documents chahiye', hasOpenCase: false, hasIntakeFields: false })?.intent,
    ).toBe('FAQ');
    expect(
      fastRoute({ clientText: 'which papers do you need from me?', hasOpenCase: false, hasIntakeFields: false })
        ?.intent,
    ).toBe('FAQ');
    // A matter keyword still wins — "khula" makes this an intake turn, and the
    // intake agent answers the document question with its own task focus.
    expect(
      fastRoute({ clientText: 'what documents are required for khula?', hasOpenCase: false, hasIntakeFields: false })
        ?.intent,
    ).toBe('INTAKE');
  });
});

describe('needsRetrieval', () => {
  it('skips RAG for greetings and off-topic', () => {
    expect(needsRetrieval('GREETING')).toBe(false);
    expect(needsRetrieval('OFF_TOPIC')).toBe(false);
    expect(needsRetrieval('INTAKE')).toBe(true);
  });
});
