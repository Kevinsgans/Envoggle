import { askGemini } from './judge.js';

const category = process.argv[2]?.trim();
if (!category) {
  console.error('Usage: npm run draft-dictionary -- "Category name"');
  process.exitCode = 1;
} else {
  const draft = await askGemini([
    `Draft a scoring dictionary for the Envoggle category ${JSON.stringify(category)}.`,
    'Return a JSON array of 30 objects with name, aliases (array of strings), and tier (one of common, uncommon, rare, superRare, ultraRare).',
    'Rate how difficult the actual object would be to find in a 30-second campus hunt. Use short canonical names, omit duplicates, and include believable objects at all five tiers.',
  ].join('\n'));
  if (!Array.isArray(draft) || !draft.every(item =>
    item && typeof item.name === 'string' && Array.isArray(item.aliases) &&
    item.aliases.every((alias: unknown) => typeof alias === 'string') && ['common', 'uncommon', 'rare', 'superRare', 'ultraRare'].includes(item.tier))) {
    throw new Error('Gemini did not return a usable dictionary draft');
  }
  console.log(JSON.stringify(draft, null, 2));
}
