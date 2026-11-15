export const MAX_POINTS = 1000;

export const RARITY = {
  common: { name: 'Common', band: [1, 200] },
  uncommon: { name: 'Uncommon', band: [201, 400] },
  rare: { name: 'Rare', band: [401, 600] },
  superRare: { name: 'Super rare', band: [601, 800] },
  ultraRare: { name: 'Ultra rare', band: [801, 1000] },
} as const;

export const blue = {
  prompt: 'Things that are blue',
  rule: 'The real object must be visibly and prominently blue. A tiny blue logo or a depiction on a screen does not qualify.',
  items: [
    // Common (1 - 200)
    { name: 'pen', aliases: ['ballpoint', 'ballpoint pen', 'gel pen'], tier: RARITY.common, points: 15 },
    { name: 'water bottle', aliases: ['bottle'], tier: RARITY.common, points: 30 },
    { name: 'backpack', aliases: ['rucksack', 'bookbag'], tier: RARITY.common, points: 45 },
    { name: 'notebook', aliases: ['journal'], tier: RARITY.common, points: 60 },
    { name: 'recycling bin', aliases: ['recycle bin'], tier: RARITY.common, points: 80 },
    { name: 'mug', aliases: ['coffee mug'], tier: RARITY.common, points: 100 },
    { name: 't-shirt', aliases: ['shirt', 'tee'], tier: RARITY.common, points: 120 },
    { name: 'jeans', aliases: ['denim', 'blue jeans'], tier: RARITY.common, points: 140 },
    { name: 'folder', aliases: ['file folder', 'binder'], tier: RARITY.common, points: 160 },
    { name: 'sock', aliases: ['socks'], tier: RARITY.common, points: 175 },
    { name: 'towel', aliases: ['hand towel', 'bath towel'], tier: RARITY.common, points: 185 },
    { name: 'sticky note', aliases: ['post-it', 'post-it note'], tier: RARITY.common, points: 190 },
    { name: 'toothbrush', aliases: [], tier: RARITY.common, points: 195 },
    { name: 'cap', aliases: ['hat', 'baseball cap'], tier: RARITY.common, points: 197 },
    { name: 'book', aliases: ['hardcover book', 'paperback'], tier: RARITY.common, points: 198 },
    { name: 'marker', aliases: ['sharpie', 'highlighter'], tier: RARITY.common, points: 199 },
    { name: 'plate', aliases: ['bowl', 'dish'], tier: RARITY.common, points: 200 },

    // Uncommon (201 - 400)
    { name: 'jacket', aliases: ['coat'], tier: RARITY.uncommon, points: 230 },
    { name: 'umbrella', aliases: [], tier: RARITY.uncommon, points: 260 },
    { name: 'headphones', aliases: ['earbuds', 'headset'], tier: RARITY.uncommon, points: 290 },
    { name: 'blanket', aliases: ['throw blanket'], tier: RARITY.uncommon, points: 320 },
    { name: 'pillow', aliases: ['cushion'], tier: RARITY.uncommon, points: 350 },
    { name: 'sneaker', aliases: ['shoe', 'sneakers', 'shoes'], tier: RARITY.uncommon, points: 375 },
    { name: 'scissors', aliases: [], tier: RARITY.uncommon, points: 385 },
    { name: 'painters tape', aliases: ['masking tape', 'blue tape'], tier: RARITY.uncommon, points: 390 },
    { name: 'sponge', aliases: ['dish sponge'], tier: RARITY.uncommon, points: 395 },
    { name: 'lunchbox', aliases: ['lunch bag', 'cooler'], tier: RARITY.uncommon, points: 397 },
    { name: 'scarf', aliases: [], tier: RARITY.uncommon, points: 398 },
    { name: 'sunglasses', aliases: ['glasses'], tier: RARITY.uncommon, points: 400 },

    // Rare (401 - 600)
    { name: 'stapler', aliases: [], tier: RARITY.rare, points: 440 },
    { name: 'watering can', aliases: [], tier: RARITY.rare, points: 480 },
    { name: 'yoga mat', aliases: ['exercise mat'], tier: RARITY.rare, points: 520 },
    { name: 'bucket', aliases: ['pail'], tier: RARITY.rare, points: 560 },
    { name: 'skateboard', aliases: ['longboard'], tier: RARITY.rare, points: 580 },
    { name: 'guitar pick', aliases: ['pick'], tier: RARITY.rare, points: 590 },
    { name: 'bicycle', aliases: ['bike'], tier: RARITY.rare, points: 595 },
    { name: 'hair dryer', aliases: ['blow dryer'], tier: RARITY.rare, points: 597 },
    { name: 'toolbox', aliases: [], tier: RARITY.rare, points: 599 },
    { name: 'helmet', aliases: ['bike helmet'], tier: RARITY.rare, points: 600 },

    // Super Rare (601 - 800)
    { name: 'binoculars', aliases: ['field glasses'], tier: RARITY.superRare, points: 650 },
    { name: 'flashlight', aliases: ['torch'], tier: RARITY.superRare, points: 700 },
    { name: 'guitar', aliases: ['electric guitar', 'acoustic guitar'], tier: RARITY.superRare, points: 750 },
    { name: 'globe', aliases: ['world globe'], tier: RARITY.superRare, points: 780 },
    { name: 'blender', aliases: ['stand mixer'], tier: RARITY.superRare, points: 790 },
    { name: 'suitcase', aliases: ['luggage'], tier: RARITY.superRare, points: 795 },
    { name: 'telescope', aliases: [], tier: RARITY.superRare, points: 797 },
    { name: 'bowling ball', aliases: [], tier: RARITY.superRare, points: 799 },
    { name: 'kayak', aliases: ['canoe'], tier: RARITY.superRare, points: 800 },

    // Ultra Rare (801 - 1000)
    { name: 'violin', aliases: ['fiddle'], tier: RARITY.ultraRare, points: 850 },
    { name: 'typewriter', aliases: [], tier: RARITY.ultraRare, points: 900 },
    { name: 'rotary phone', aliases: ['rotary telephone'], tier: RARITY.ultraRare, points: 940 },
    { name: 'accordion', aliases: [], tier: RARITY.ultraRare, points: 970 },
    { name: 'lava lamp', aliases: [], tier: RARITY.ultraRare, points: 985 },
    { name: 'gumball machine', aliases: [], tier: RARITY.ultraRare, points: 993 },
    { name: 'record player', aliases: ['turntable'], tier: RARITY.ultraRare, points: 997 },
    { name: 'grandfather clock', aliases: [], tier: RARITY.ultraRare, points: 1000 },
  ],
} as const;

export function findItem(label: string) {
  const words = label.toLowerCase().trim().replace(/^blue\s+/, '').replace(/\s+/g, ' ');
  return blue.items.find(item => item.name === words || item.aliases.some(alias => alias === words));
}