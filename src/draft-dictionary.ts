import { askGemini } from './judge.js';

const category = process.argv[2]?.trim();
if (!category) {
  console.error('Usage: npm run draft-dictionary -- "Category name"');
  process.exitCode = 1;
} else {
  const draft = await askGemini([
    `Draft a scoring dictionary for the Envoggle category ${JSON.stringify(category)}.`,
    'Return a JSON array of 30 objects with name, aliases (array of strings), and points (1 for common, 3 for uncommon, 5 for niche).',
    'Score how difficult the actual object would be to find in a 20-second campus hunt. Use short canonical names, omit duplicates, and include believable objects at all three tiers.',
  ].join('\n'));
  if (!Array.isArray(draft) || !draft.every(item =>
    item && typeof item.name === 'string' && Array.isArray(item.aliases) &&
    item.aliases.every((alias: unknown) => typeof alias === 'string') && [1, 3, 5].includes(item.points))) {
    throw new Error('Gemini did not return a usable dictionary draft');
  }
  console.log(JSON.stringify(draft, null, 2));
}
