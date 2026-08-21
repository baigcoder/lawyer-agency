import { describe, expect, it } from 'vitest';
import {
  continueWithoutKb,
  looksLikeMissingAnswer,
  rewriteMissingAnswerReply,
} from './missing-answer-reply';

describe('looksLikeMissingAnswer', () => {
  it('catches the canned Urdu FAQ refusal', () => {
    expect(looksLikeMissingAnswer('معذرت، مجھے اس سوال کا جواب نہیں مل سکا۔ وکیل جلد مدد کرے گا۔')).toBe(
      true,
    );
  });

  it('catches roman Urdu', () => {
    expect(looksLikeMissingAnswer('mujhe sawal ka jawab nahi mil saka')).toBe(true);
  });

  it('leaves a normal reply alone', () => {
    expect(looksLikeMissingAnswer('سمجھ گیا۔ بتائیں آپ کا کیس کس شہر میں ہے؟')).toBe(false);
  });
});

describe('rewriteMissingAnswerReply', () => {
  it('replaces the dead-end with a follow-up', () => {
    expect(rewriteMissingAnswerReply('I don’t have information on that.', 'EN')).toBe(
      continueWithoutKb('EN'),
    );
  });
});
