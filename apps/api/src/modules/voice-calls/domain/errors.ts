export class VoiceCallNotAnswerableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoiceCallNotAnswerableError';
  }
}
