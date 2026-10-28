import en from './locales/en.json';
import fr from './locales/fr.json';

function keypaths(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keypaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('locales', () => {
  it('en has exactly the same keys as fr', () => {
    expect(keypaths(en).sort()).toEqual(keypaths(fr).sort());
  });
});
