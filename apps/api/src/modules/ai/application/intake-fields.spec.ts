import { describe, expect, it } from 'vitest';
import { mergeIntakeFields } from './intake-fields';

describe('mergeIntakeFields', () => {
  it('keeps known facts when the model omits or blanks them', () => {
    expect(
      mergeIntakeFields({ city: 'Lahore', name: 'Ali' }, { city: '', practiceArea: 'Family Law' }),
    ).toEqual({ city: 'Lahore', name: 'Ali', practiceArea: 'Family Law' });
  });
});
