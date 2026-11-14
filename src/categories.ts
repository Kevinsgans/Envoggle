export const blue = {
  prompt: 'Things that are blue',
  rule: 'The real object must be visibly and prominently blue. A tiny blue logo or a depiction on a screen does not qualify.',
  items: [
    { name: 'pen', aliases: ['ballpoint', 'ballpoint pen', 'gel pen'], points: 1 },
    { name: 'water bottle', aliases: ['bottle'], points: 1 },
    { name: 'backpack', aliases: ['rucksack', 'bookbag'], points: 1 },
    { name: 'notebook', aliases: ['journal'], points: 1 },
    { name: 'recycling bin', aliases: ['recycle bin'], points: 1 },
    { name: 'mug', aliases: ['coffee mug'], points: 1 },
    { name: 'jacket', aliases: ['coat'], points: 1 },
    { name: 'stapler', aliases: [], points: 3 },
    { name: 'watering can', aliases: [], points: 3 },
    { name: 'binoculars', aliases: ['field glasses'], points: 3 },
    { name: 'flashlight', aliases: ['torch'], points: 3 },
    { name: 'violin', aliases: ['fiddle'], points: 5 },
    { name: 'typewriter', aliases: [], points: 5 },
    { name: 'rotary phone', aliases: ['rotary telephone'], points: 5 },
  ],
} as const;

export function findItem(label: string) {
  const words = label.toLowerCase().trim().replace(/^blue\s+/, '').replace(/\s+/g, ' ');
  return blue.items.find(item => item.name === words || item.aliases.some(alias => alias === words));
}
