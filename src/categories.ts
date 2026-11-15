// Finds score 1 to 1000; higher is more niche. Each dictionary tier is a band of that scale,
// and Gemini picks the exact score inside the band.
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
    // Common
    { name: 'pen', aliases: ['ballpoint', 'ballpoint pen', 'gel pen'], tier: RARITY.common },
    { name: 'water bottle', aliases: ['bottle'], tier: RARITY.common },
    { name: 'backpack', aliases: ['rucksack', 'bookbag'], tier: RARITY.common },
    { name: 'notebook', aliases: ['journal'], tier: RARITY.common },
    { name: 'recycling bin', aliases: ['recycle bin'], tier: RARITY.common },
    { name: 'mug', aliases: ['coffee mug'], tier: RARITY.common },
    { name: 't-shirt', aliases: ['shirt', 'tee'], tier: RARITY.common },
    { name: 'jeans', aliases: ['denim', 'blue jeans'], tier: RARITY.common },
    { name: 'folder', aliases: ['file folder', 'binder'], tier: RARITY.common },
    { name: 'sock', aliases: ['socks'], tier: RARITY.common },
    { name: 'towel', aliases: ['hand towel', 'bath towel'], tier: RARITY.common },
    { name: 'sticky note', aliases: ['post-it', 'post-it note'], tier: RARITY.common },
    { name: 'toothbrush', aliases: [], tier: RARITY.common },
    { name: 'cap', aliases: ['hat', 'baseball cap'], tier: RARITY.common },
    { name: 'book', aliases: ['hardcover book', 'paperback'], tier: RARITY.common },
    { name: 'marker', aliases: ['sharpie', 'highlighter'], tier: RARITY.common },
    { name: 'plate', aliases: ['bowl', 'dish'], tier: RARITY.common },

    // Uncommon
    { name: 'jacket', aliases: ['coat'], tier: RARITY.uncommon },
    { name: 'umbrella', aliases: [], tier: RARITY.uncommon },
    { name: 'headphones', aliases: ['earbuds', 'headset'], tier: RARITY.uncommon },
    { name: 'blanket', aliases: ['throw blanket'], tier: RARITY.uncommon },
    { name: 'pillow', aliases: ['cushion'], tier: RARITY.uncommon },
    { name: 'sneaker', aliases: ['shoe', 'sneakers', 'shoes'], tier: RARITY.uncommon },
    { name: 'scissors', aliases: [], tier: RARITY.uncommon },
    { name: 'painters tape', aliases: ['masking tape', 'blue tape'], tier: RARITY.uncommon },
    { name: 'sponge', aliases: ['dish sponge'], tier: RARITY.uncommon },
    { name: 'lunchbox', aliases: ['lunch bag', 'cooler'], tier: RARITY.uncommon },
    { name: 'scarf', aliases: [], tier: RARITY.uncommon },
    { name: 'sunglasses', aliases: ['glasses'], tier: RARITY.uncommon },

    // Rare
    { name: 'stapler', aliases: [], tier: RARITY.rare },
    { name: 'watering can', aliases: [], tier: RARITY.rare },
    { name: 'yoga mat', aliases: ['exercise mat'], tier: RARITY.rare },
    { name: 'bucket', aliases: ['pail'], tier: RARITY.rare },
    { name: 'skateboard', aliases: ['longboard'], tier: RARITY.rare },
    { name: 'guitar pick', aliases: ['pick'], tier: RARITY.rare },
    { name: 'bicycle', aliases: ['bike'], tier: RARITY.rare },
    { name: 'hair dryer', aliases: ['blow dryer'], tier: RARITY.rare },
    { name: 'toolbox', aliases: [], tier: RARITY.rare },
    { name: 'helmet', aliases: ['bike helmet'], tier: RARITY.rare },

    // Super Rare
    { name: 'binoculars', aliases: ['field glasses'], tier: RARITY.superRare },
    { name: 'flashlight', aliases: ['torch'], tier: RARITY.superRare },
    { name: 'guitar', aliases: ['electric guitar', 'acoustic guitar'], tier: RARITY.superRare },
    { name: 'globe', aliases: ['world globe'], tier: RARITY.superRare },
    { name: 'blender', aliases: ['stand mixer'], tier: RARITY.superRare },
    { name: 'suitcase', aliases: ['luggage'], tier: RARITY.superRare },
    { name: 'telescope', aliases: [], tier: RARITY.superRare },
    { name: 'bowling ball', aliases: [], tier: RARITY.superRare },
    { name: 'kayak', aliases: ['canoe'], tier: RARITY.superRare },

    // Ultra Rare
    { name: 'violin', aliases: ['fiddle'], tier: RARITY.ultraRare },
    { name: 'typewriter', aliases: [], tier: RARITY.ultraRare },
    { name: 'rotary phone', aliases: ['rotary telephone'], tier: RARITY.ultraRare },
    { name: 'accordion', aliases: [], tier: RARITY.ultraRare },
    { name: 'lava lamp', aliases: [], tier: RARITY.ultraRare },
    { name: 'gumball machine', aliases: [], tier: RARITY.ultraRare },
    { name: 'record player', aliases: ['turntable'], tier: RARITY.ultraRare },
    { name: 'grandfather clock', aliases: [], tier: RARITY.ultraRare },
  ],
} as const;

export function findItem(label: string) {
  const words = label.toLowerCase().trim().replace(/^blue\s+/, '').replace(/\s+/g, ' ');
  return blue.items.find(item => item.name === words || item.aliases.some(alias => alias === words));
}
