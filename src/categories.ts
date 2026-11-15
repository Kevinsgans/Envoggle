export const RARITY_POINTS = {
  common: 10,
  uncommon: 20,
  rare: 40,
  superRare: 60,
  ultraRare: 100,
} as const;
export const blue = {
  prompt: 'Things that are blue',
  rule: 'The real object must be visibly and prominently blue. A tiny blue logo or a depiction on a screen does not qualify.',
  items: [
    // Common
    { name: 'pen', aliases: ['ballpoint', 'ballpoint pen', 'gel pen'], points: RARITY_POINTS.common },
    { name: 'water bottle', aliases: ['bottle'], points: RARITY_POINTS.common },
    { name: 'backpack', aliases: ['rucksack', 'bookbag'], points: RARITY_POINTS.common },
    { name: 'notebook', aliases: ['journal'], points: RARITY_POINTS.common },
    { name: 'recycling bin', aliases: ['recycle bin'], points: RARITY_POINTS.common },
    { name: 'mug', aliases: ['coffee mug'], points: RARITY_POINTS.common },
    { name: 't-shirt', aliases: ['shirt', 'tee'], points: RARITY_POINTS.common },
    { name: 'jeans', aliases: ['denim', 'blue jeans'], points: RARITY_POINTS.common },
    { name: 'folder', aliases: ['file folder', 'binder'], points: RARITY_POINTS.common },
    { name: 'sock', aliases: ['socks'], points: RARITY_POINTS.common },
    { name: 'towel', aliases: ['hand towel', 'bath towel'], points: RARITY_POINTS.common },
    { name: 'sticky note', aliases: ['post-it', 'post-it note'], points: RARITY_POINTS.common },
    { name: 'toothbrush', aliases: [], points: RARITY_POINTS.common },
    { name: 'cap', aliases: ['hat', 'baseball cap'], points: RARITY_POINTS.common },
    { name: 'book', aliases: ['hardcover book', 'paperback'], points: RARITY_POINTS.common },
    { name: 'marker', aliases: ['sharpie', 'highlighter'], points: RARITY_POINTS.common },
    { name: 'plate', aliases: ['bowl', 'dish'], points: RARITY_POINTS.common },

    // Uncommon
    { name: 'jacket', aliases: ['coat'], points: RARITY_POINTS.uncommon },
    { name: 'umbrella', aliases: [], points: RARITY_POINTS.uncommon },
    { name: 'headphones', aliases: ['earbuds', 'headset'], points: RARITY_POINTS.uncommon },
    { name: 'blanket', aliases: ['throw blanket'], points: RARITY_POINTS.uncommon },
    { name: 'pillow', aliases: ['cushion'], points: RARITY_POINTS.uncommon },
    { name: 'sneaker', aliases: ['shoe', 'sneakers', 'shoes'], points: RARITY_POINTS.uncommon },
    { name: 'scissors', aliases: [], points: RARITY_POINTS.uncommon },
    { name: 'painters tape', aliases: ['masking tape', 'blue tape'], points: RARITY_POINTS.uncommon },
    { name: 'sponge', aliases: ['dish sponge'], points: RARITY_POINTS.uncommon },
    { name: 'lunchbox', aliases: ['lunch bag', 'cooler'], points: RARITY_POINTS.uncommon },
    { name: 'scarf', aliases: [], points: RARITY_POINTS.uncommon },
    { name: 'sunglasses', aliases: ['glasses'], points: RARITY_POINTS.uncommon },

    // Rare
    { name: 'stapler', aliases: [], points: RARITY_POINTS.rare },
    { name: 'watering can', aliases: [], points: RARITY_POINTS.rare },
    { name: 'yoga mat', aliases: ['exercise mat'], points: RARITY_POINTS.rare },
    { name: 'bucket', aliases: ['pail'], points: RARITY_POINTS.rare },
    { name: 'skateboard', aliases: ['longboard'], points: RARITY_POINTS.rare },
    { name: 'guitar pick', aliases: ['pick'], points: RARITY_POINTS.rare },
    { name: 'bicycle', aliases: ['bike'], points: RARITY_POINTS.rare },
    { name: 'hair dryer', aliases: ['blow dryer'], points: RARITY_POINTS.rare },
    { name: 'toolbox', aliases: [], points: RARITY_POINTS.rare },
    { name: 'helmet', aliases: ['bike helmet'], points: RARITY_POINTS.rare },

    // Super Rare
    { name: 'binoculars', aliases: ['field glasses'], points: RARITY_POINTS.superRare },
    { name: 'flashlight', aliases: ['torch'], points: RARITY_POINTS.superRare },
    { name: 'guitar', aliases: ['electric guitar', 'acoustic guitar'], points: RARITY_POINTS.superRare },
    { name: 'globe', aliases: ['world globe'], points: RARITY_POINTS.superRare },
    { name: 'blender', aliases: ['stand mixer'], points: RARITY_POINTS.superRare },
    { name: 'suitcase', aliases: ['luggage'], points: RARITY_POINTS.superRare },
    { name: 'telescope', aliases: [], points: RARITY_POINTS.superRare },
    { name: 'bowling ball', aliases: [], points: RARITY_POINTS.superRare },
    { name: 'kayak', aliases: ['canoe'], points: RARITY_POINTS.superRare },

    // Ultra Rare
    { name: 'violin', aliases: ['fiddle'], points: RARITY_POINTS.ultraRare },
    { name: 'typewriter', aliases: [], points: RARITY_POINTS.ultraRare },
    { name: 'rotary phone', aliases: ['rotary telephone'], points: RARITY_POINTS.ultraRare },
    { name: 'accordion', aliases: [], points: RARITY_POINTS.ultraRare },
    { name: 'lava lamp', aliases: [], points: RARITY_POINTS.ultraRare },
    { name: 'gumball machine', aliases: [], points: RARITY_POINTS.ultraRare },
    { name: 'record player', aliases: ['turntable'], points: RARITY_POINTS.ultraRare },
    { name: 'grandfather clock', aliases: [], points: RARITY_POINTS.ultraRare },
  ],
} as const;

export function findItem(label: string) {
  const words = label.toLowerCase().trim().replace(/^blue\s+/, '').replace(/\s+/g, ' ');
  return blue.items.find(item => item.name === words || item.aliases.some(alias => alias === words));
}
