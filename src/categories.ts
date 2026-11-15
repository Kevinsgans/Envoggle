export const blue = {
  prompt: 'Things that are blue',
  rule: 'The real object must be visibly and prominently blue. A tiny blue logo or a depiction on a screen does not qualify.',
  items: [
    // Common / Low Scores (1 - 150)
    { name: 'pen', aliases: ['ballpoint', 'ballpoint pen', 'gel pen'], rarityScore: 10 },
    { name: 'water bottle', aliases: ['bottle'], rarityScore: 25 },
    { name: 'notebook', aliases: ['journal'], rarityScore: 35 },
    { name: 'mug', aliases: ['coffee mug'], rarityScore: 50 },
    { name: 't-shirt', aliases: ['shirt', 'tee'], rarityScore: 65 },
    { name: 'jeans', aliases: ['denim', 'blue jeans'], rarityScore: 80 },
    { name: 'folder', aliases: ['file folder', 'binder'], rarityScore: 95 },
    { name: 'sticky note', aliases: ['post-it', 'post-it note'], rarityScore: 110 },
    { name: 'marker', aliases: ['sharpie', 'highlighter'], rarityScore: 130 },
    { name: 'book', aliases: ['hardcover book', 'paperback'], rarityScore: 150 },

    // Uncommon / Moderate Scores (180 - 450)
    { name: 'backpack', aliases: ['rucksack', 'bookbag'], rarityScore: 180 },
    { name: 'recycling bin', aliases: ['recycle bin'], rarityScore: 210 },
    { name: 'sock', aliases: ['socks'], rarityScore: 240 },
    { name: 'towel', aliases: ['hand towel', 'bath towel'], rarityScore: 270 },
    { name: 'toothbrush', aliases: [], rarityScore: 300 },
    { name: 'cap', aliases: ['hat', 'baseball cap'], rarityScore: 330 },
    { name: 'plate', aliases: ['bowl', 'dish'], rarityScore: 360 },
    { name: 'blanket', aliases: ['throw blanket'], rarityScore: 390 },
    { name: 'pillow', aliases: ['cushion'], rarityScore: 420 },
    { name: 'sneaker', aliases: ['shoe', 'sneakers', 'shoes'], rarityScore: 450 },
    { name: 'sponge', aliases: ['dish sponge'], rarityScore: 470 },

    // Rare / Elevated Scores (500 - 720)
    { name: 'jacket', aliases: ['coat'], rarityScore: 500 },
    { name: 'umbrella', aliases: [], rarityScore: 530 },
    { name: 'headphones', aliases: ['earbuds', 'headset'], rarityScore: 560 },
    { name: 'scissors', aliases: [], rarityScore: 590 },
    { name: 'painters tape', aliases: ['masking tape', 'blue tape'], rarityScore: 620 },
    { name: 'lunchbox', aliases: ['lunch bag', 'cooler'], rarityScore: 650 },
    { name: 'scarf', aliases: [], rarityScore: 680 },
    { name: 'sunglasses', aliases: ['glasses'], rarityScore: 700 },
    { name: 'stapler', aliases: [], rarityScore: 710 },
    { name: 'yoga mat', aliases: ['exercise mat'], rarityScore: 720 },

    // Super Rare / High Scores (750 - 890)
    { name: 'bucket', aliases: ['pail'], rarityScore: 750 },
    { name: 'flashlight', aliases: ['torch'], rarityScore: 770 },
    { name: 'watering can', aliases: [], rarityScore: 790 },
    { name: 'skateboard', aliases: ['longboard'], rarityScore: 810 },
    { name: 'guitar pick', aliases: ['pick'], rarityScore: 830 },
    { name: 'bicycle', aliases: ['bike'], rarityScore: 850 },
    { name: 'hair dryer', aliases: ['blow dryer'], rarityScore: 865 },
    { name: 'toolbox', aliases: [], rarityScore: 880 },
    { name: 'helmet', aliases: ['bike helmet'], rarityScore: 890 },

    // Ultra Rare / Apex Scores (910 - 1000)
    { name: 'binoculars', aliases: ['field glasses'], rarityScore: 910 },
    { name: 'globe', aliases: ['world globe'], rarityScore: 925 },
    { name: 'blender', aliases: ['stand mixer'], rarityScore: 940 },
    { name: 'suitcase', aliases: ['luggage'], rarityScore: 950 },
    { name: 'bowling ball', aliases: [], rarityScore: 960 },
    { name: 'guitar', aliases: ['electric guitar', 'acoustic guitar'], rarityScore: 970 },
    { name: 'telescope', aliases: [], rarityScore: 978 },
    { name: 'kayak', aliases: ['canoe'], rarityScore: 985 },
    { name: 'violin', aliases: ['fiddle'], rarityScore: 990 },
    { name: 'typewriter', aliases: [], rarityScore: 994 },
    { name: 'rotary phone', aliases: ['rotary telephone'], rarityScore: 996 },
    { name: 'accordion', aliases: [], rarityScore: 998 },
    { name: 'lava lamp', aliases: [], rarityScore: 999 },
    { name: 'gumball machine', aliases: [], rarityScore: 999 },
    { name: 'record player', aliases: ['turntable'], rarityScore: 1000 },
    { name: 'grandfather clock', aliases: [], rarityScore: 1000 },
  ],
} as const;

export function findItem(label: string) {
  const words = label.toLowerCase().trim().replace(/^blue\s+/, '').replace(/\s+/g, ' ');
  return blue.items.find(item => item.name === words || item.aliases.some(alias => alias === words));
}
