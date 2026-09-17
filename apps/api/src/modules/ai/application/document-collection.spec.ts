import { describe, expect, it } from 'vitest';
import { isDocumentAsk, isDocumentQuestion } from './document-collection';

describe('isDocumentAsk', () => {
  it('fires when the client offers to send a file', () => {
    expect(isDocumentAsk('I will send the documents tonight')).toBe(true);
    expect(isDocumentAsk("I'll send my CNIC")).toBe(true);
    expect(isDocumentAsk('sending you my papers')).toBe(true);
    expect(isDocumentAsk('میں دستاویز بھیج رہا ہوں')).toBe(true);
  });

  it('does NOT fire on a question about which documents are needed', () => {
    // These used to create a case plus a PENDING document request.
    expect(isDocumentAsk('kya documents chahiye?')).toBe(false);
    expect(isDocumentAsk('what documents are required for khula?')).toBe(false);
    expect(isDocumentAsk('which papers do you need from me?')).toBe(false);
    expect(isDocumentAsk('کون سے کاغذات چاہیئے؟')).toBe(false);
  });

  it('leaves unrelated messages alone', () => {
    expect(isDocumentAsk('what are your fees?')).toBe(false);
    expect(isDocumentAsk('Salam')).toBe(false);
  });
});

describe('isDocumentQuestion', () => {
  it('recognises the question form in both languages', () => {
    expect(isDocumentQuestion('kya documents chahiye')).toBe(true);
    expect(isDocumentQuestion('what documents are needed')).toBe(true);
    expect(isDocumentQuestion('کون سے کاغذات چاہیئے')).toBe(true);
  });

  it('does not swallow an offer to send', () => {
    expect(isDocumentQuestion('I will send the documents tonight')).toBe(false);
  });
});
