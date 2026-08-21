import { describe, expect, it } from 'vitest';
import { heuristicTurn, receptionistGreeting } from './voice-receptionist.service';

describe('receptionistGreeting', () => {
  it('speaks as the firm assistant, not the lawyer', () => {
    expect(receptionistGreeting('Talha law associates')).toContain('assistant for Talha law associates');
    expect(receptionistGreeting('Talha law associates')).toContain('not the lawyer');
  });
});

describe('heuristicTurn', () => {
  it('lists slots when the client asks to book', () => {
    expect(heuristicTurn('I want to book an appointment tomorrow', null).tool).toBe('list_slots');
  });

  it('books a numbered slot after offers', () => {
    const offered = {
      lawyerId: '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0e',
      lawyerName: 'Ayesha',
      slots: [
        { startsAt: new Date('2026-08-20T04:00:00Z'), endsAt: new Date('2026-08-20T04:30:00Z') },
      ],
    };
    expect(heuristicTurn('1 please', offered)).toMatchObject({ tool: 'book_appointment', slotIndex: 1 });
  });

  it('captures intake otherwise', () => {
    expect(heuristicTurn('my landlord is not returning the deposit', null).tool).toBe('capture_intake');
  });
});
