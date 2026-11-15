export const MAX_POINTS = 1000;

export const RARITY = {
  common: { name: 'Common', band: [1, 200] },
  uncommon: { name: 'Uncommon', band: [201, 400] },
  rare: { name: 'Rare', band: [401, 600] },
  superRare: { name: 'Super rare', band: [601, 800] },
  ultraRare: { name: 'Ultra rare', band: [801, 1000] },
} as const;

// Each round scores on its own 1–1000 scale (`measure`), and its dictionary items are fixed anchors
// on that scale. `tiers` names the five 200-point bands shown on the reveal.
export const blue = {
  prompt: 'Rare things that are blue',
  goal: 'Find the rarest blue thing you can',
  rule: 'The real object must be visibly and prominently blue. A tiny blue logo or a depiction on a screen does not qualify.',
  measure: `how rare it is to have one at hand on a college campus: 1 is something nearly everyone carries, ${MAX_POINTS} is almost impossible to find during a 30-second hunt. Ordinary personal items (pens, bottles, clothes) stay low; craft, hobby, specialist or unusual items score well above them, and most real finds land between 150 and 850`,
  tiers: ['Common', 'Uncommon', 'Rare', 'Super rare', 'Ultra rare'],
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
    { name: 'chip bag', aliases: ['bag of chips', 'snack bag', 'doritos'], tier: RARITY.uncommon, points: 263 },
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
    { name: 'construction paper', aliases: ['blue construction paper', 'craft paper', 'card stock', 'cardstock'], tier: RARITY.rare, points: 547 },
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

// Points from typical power draw while running, on a log scale: 1000 × (log10(watts) + 2) / 6.
// 0.01 W = 0, 1 W ≈ 333, 10 W = 500, 100 W ≈ 667, 1,000 W ≈ 833, 10,000 W = 1000.
export const electricity = {
  prompt: 'Things that use the most electricity',
  goal: 'Find the thing that uses the most electricity',
  rule: 'The real object must run on electricity, plugged in or on batteries. It does not need to be switched on. A depiction on a screen does not qualify.',
  measure: 'its typical power draw while running, on a log scale: 0.01 W is 1, 1 W is 333, 10 W is 500, 100 W is 667, 1,000 W is 833, 10,000 W or more is 1000',
  tiers: ['Trickle', 'Low power', 'Medium power', 'High power', 'Power hog'],
  items: [
    { name: 'calculator', aliases: ['pocket calculator'], tier: RARITY.common, points: 133 },
    { name: 'smartwatch', aliases: ['watch', 'fitness tracker', 'apple watch'], tier: RARITY.uncommon, points: 283 },
    { name: 'computer mouse', aliases: ['mouse', 'wireless mouse'], tier: RARITY.uncommon, points: 283 },
    { name: 'headphones', aliases: ['earbuds', 'airpods', 'wireless headphones'], tier: RARITY.uncommon, points: 333 },
    { name: 'keyboard', aliases: ['computer keyboard'], tier: RARITY.uncommon, points: 333 },
    { name: 'flashlight', aliases: ['torch'], tier: RARITY.rare, points: 450 },
    { name: 'smartphone', aliases: ['phone', 'cell phone', 'mobile phone', 'iphone'], tier: RARITY.rare, points: 450 },
    { name: 'light bulb', aliases: ['led bulb', 'bulb'], tier: RARITY.rare, points: 492 },
    { name: 'router', aliases: ['wifi router', 'modem'], tier: RARITY.rare, points: 500 },
    { name: 'tablet', aliases: ['ipad'], tier: RARITY.rare, points: 500 },
    { name: 'phone charger', aliases: ['charger', 'usb charger', 'power adapter'], tier: RARITY.rare, points: 550 },
    { name: 'desk lamp', aliases: ['lamp', 'table lamp'], tier: RARITY.rare, points: 590 },
    { name: 'monitor', aliases: ['computer monitor', 'display'], tier: RARITY.superRare, points: 613 },
    { name: 'electric fan', aliases: ['fan', 'desk fan', 'box fan'], tier: RARITY.superRare, points: 616 },
    { name: 'laptop', aliases: ['computer', 'macbook', 'notebook computer'], tier: RARITY.superRare, points: 630 },
    { name: 'television', aliases: ['tv'], tier: RARITY.superRare, points: 667 },
    { name: 'refrigerator', aliases: ['fridge', 'mini fridge'], tier: RARITY.superRare, points: 700 },
    { name: 'desktop computer', aliases: ['pc', 'gaming pc', 'imac'], tier: RARITY.superRare, points: 747 },
    { name: 'printer', aliases: ['laser printer', 'inkjet printer'], tier: RARITY.superRare, points: 783 },
    { name: 'coffee maker', aliases: ['espresso machine', 'keurig'], tier: RARITY.ultraRare, points: 833 },
    { name: 'toaster', aliases: ['toaster oven'], tier: RARITY.ultraRare, points: 840 },
    { name: 'microwave', aliases: ['microwave oven'], tier: RARITY.ultraRare, points: 846 },
    { name: 'vacuum cleaner', aliases: ['vacuum'], tier: RARITY.ultraRare, points: 858 },
    { name: 'electric kettle', aliases: ['kettle'], tier: RARITY.ultraRare, points: 863 },
    { name: 'space heater', aliases: ['heater'], tier: RARITY.ultraRare, points: 863 },
    { name: 'hair dryer', aliases: ['blow dryer'], tier: RARITY.ultraRare, points: 876 },
    { name: 'electric oven', aliases: ['oven', 'stove', 'range'], tier: RARITY.ultraRare, points: 913 },
    { name: 'clothes dryer', aliases: ['dryer', 'tumble dryer'], tier: RARITY.ultraRare, points: 950 },
    { name: 'electric car', aliases: ['tesla', 'ev charger'], tier: RARITY.ultraRare, points: 1000 },
  ],
} as const;

// Points from the typical price new in US dollars, on a log scale: 1000 × (log10(dollars) + 1) / 6.
// $0.10 = 0, $1 ≈ 167, $10 ≈ 333, $100 = 500, $1,000 ≈ 667, $10,000 ≈ 833, $100,000 = 1000.
export const price = {
  prompt: 'Most expensive thing',
  goal: 'Find the most expensive thing you can',
  rule: 'Any real object counts. People and animals do not count, and neither does a depiction on a screen.',
  measure: 'its typical price new in US dollars, on a log scale: $0.10 is 1, $1 is 167, $10 is 333, $100 is 500, $1,000 is 667, $10,000 is 833, $100,000 or more is 1000',
  tiers: ['Pocket change', 'Cheap', 'Pricey', 'Expensive', 'Luxury'],
  items: [
    { name: 'paper clip', aliases: ['paperclip'], tier: RARITY.common, points: 1 },
    { name: 'pencil', aliases: [], tier: RARITY.common, points: 66 },
    { name: 'pen', aliases: ['ballpoint pen', 'marker'], tier: RARITY.common, points: 167 },
    { name: 'notebook', aliases: ['journal'], tier: RARITY.uncommon, points: 283 },
    { name: 'mug', aliases: ['coffee mug', 'cup'], tier: RARITY.uncommon, points: 333 },
    { name: 'book', aliases: ['textbook', 'paperback'], tier: RARITY.uncommon, points: 384 },
    { name: 'water bottle', aliases: ['hydro flask', 'bottle'], tier: RARITY.rare, points: 414 },
    { name: 'backpack', aliases: ['bag', 'bookbag'], tier: RARITY.rare, points: 464 },
    { name: 'sneakers', aliases: ['shoes', 'sneaker', 'shoe'], tier: RARITY.rare, points: 514 },
    { name: 'headphones', aliases: ['earbuds', 'airpods'], tier: RARITY.rare, points: 546 },
    { name: 'guitar', aliases: ['acoustic guitar', 'electric guitar'], tier: RARITY.superRare, points: 601 },
    { name: 'smartwatch', aliases: ['watch', 'apple watch'], tier: RARITY.superRare, points: 581 },
    { name: 'bicycle', aliases: ['bike'], tier: RARITY.superRare, points: 617 },
    { name: 'tablet', aliases: ['ipad'], tier: RARITY.superRare, points: 617 },
    { name: 'television', aliases: ['tv'], tier: RARITY.superRare, points: 631 },
    { name: 'smartphone', aliases: ['phone', 'iphone', 'cell phone'], tier: RARITY.superRare, points: 660 },
    { name: 'laptop', aliases: ['macbook', 'computer'], tier: RARITY.superRare, points: 681 },
    { name: 'camera', aliases: ['dslr', 'mirrorless camera'], tier: RARITY.superRare, points: 697 },
    { name: 'piano', aliases: ['upright piano'], tier: RARITY.ultraRare, points: 784 },
    { name: 'motorcycle', aliases: ['motorbike'], tier: RARITY.ultraRare, points: 834 },
    { name: 'car', aliases: ['sedan', 'suv', 'tesla'], tier: RARITY.ultraRare, points: 914 },
    { name: 'grand piano', aliases: [], tier: RARITY.ultraRare, points: 951 },
  ],
} as const;

// Dictionary anchor whose tier is the 200-point band its points fall in.
const band = (points: number) => points <= 200 ? RARITY.common : points <= 400 ? RARITY.uncommon : points <= 600 ? RARITY.rare : points <= 800 ? RARITY.superRare : RARITY.ultraRare;
const anchor = (name: string, aliases: string[], points: number) => ({ name, aliases, tier: band(points), points });
const SCREEN = 'A depiction on a screen does not qualify.';

// Points from typical weight on a log scale: 1000 × (log10(kg) + 3) / 6. 1 g = 0, 1 kg = 500, 1,000 kg = 1000.
export const heavy = {
  prompt: 'Heaviest thing',
  goal: 'Find the heaviest thing you can show',
  rule: `Any real object counts; it does not need to be lifted, only shown clearly. People and animals do not count. ${SCREEN}`,
  measure: 'its typical weight, on a log scale: 1 g is 1, 10 g is 167, 100 g is 333, 1 kg is 500, 10 kg is 667, 100 kg is 833, 1,000 kg or more is 1000',
  tiers: ['Featherweight', 'Light', 'Hefty', 'Heavy', 'Massive'],
  items: [
    anchor('coin', ['quarter', 'penny'], 126), anchor('pen', ['pencil', 'marker'], 131), anchor('key', ['keys'], 167),
    anchor('smartphone', ['phone', 'iphone'], 384), anchor('water bottle', ['bottle'], 451), anchor('book', ['textbook'], 499),
    anchor('laptop', ['macbook', 'computer'], 534), anchor('guitar', ['acoustic guitar'], 581), anchor('backpack', ['bag'], 616),
    anchor('chair', ['desk chair', 'office chair'], 641), anchor('bicycle', ['bike'], 681), anchor('mini fridge', ['refrigerator', 'fridge'], 717),
    anchor('desk', ['table'], 767), anchor('couch', ['sofa'], 808), anchor('piano', ['upright piano'], 901), anchor('car', ['sedan', 'suv'], 998),
  ],
} as const;

// Points from age since it was made on a log scale: 1000 × (log10(years) + 1) / 4. 1 year = 250, 10 = 500, 100 = 750.
export const oldest = {
  prompt: 'Oldest thing',
  goal: 'Find the oldest thing you can',
  rule: `The real object must be made by people; judge its age from its design, wear and model. Rocks, fossils, plants, people and animals do not count. ${SCREEN}`,
  measure: 'how many years ago this object was made, on a log scale: a month is 1, 1 year is 250, 3 years is 369, 10 years is 500, 30 years is 619, 100 years is 750, 1,000 years or more is 1000',
  tiers: ['Brand new', 'Recent', 'Seasoned', 'Vintage', 'Antique'],
  items: [
    anchor('snack', ['chips', 'candy bar', 'granola bar'], 3), anchor('smartphone', ['phone', 'iphone'], 326), anchor('laptop', ['macbook'], 369),
    anchor('textbook', ['book'], 424), anchor('stuffed animal', ['teddy bear', 'plushie'], 521), anchor('vinyl record', ['record', 'lp'], 651),
    anchor('film camera', ['polaroid camera'], 663), anchor('typewriter', [], 711), anchor('pocket watch', [], 749), anchor('antique coin', ['old coin'], 768),
  ],
} as const;

// Points from the loudest sound it makes in normal use: 1000 × (dB − 20) / 110. 20 dB = 0, 75 dB = 500, 130 dB = 1000.
export const loud = {
  prompt: 'Loudest thing',
  goal: 'Find the thing that can make the loudest sound',
  rule: `The real object scores by the loudest sound it makes in normal use; it does not need to be making sound now. People, animals and voices do not count. ${SCREEN}`,
  measure: 'the loudest sound it makes in normal use, in decibels: 20 dB is 1, 50 dB is 273, 75 dB is 500, 90 dB is 636, 100 dB is 727, 115 dB is 864, 130 dB or more is 1000',
  tiers: ['Whisper', 'Quiet', 'Moderate', 'Loud', 'Deafening'],
  items: [
    anchor('pencil', ['pen'], 46), anchor('keyboard', ['computer keyboard'], 273), anchor('electric toothbrush', [], 318),
    anchor('vacuum cleaner', ['vacuum'], 499), anchor('smartphone', ['phone', 'iphone'], 544), anchor('alarm clock', ['clock'], 591),
    anchor('smoke alarm', ['smoke detector'], 592), anchor('hair dryer', ['blow dryer'], 636), anchor('blender', [], 681),
    anchor('acoustic guitar', ['guitar'], 683), anchor('bluetooth speaker', ['speaker'], 727), anchor('trumpet', ['trombone', 'saxophone'], 863),
    anchor('whistle', [], 864), anchor('air horn', ['airhorn'], 991),
  ],
} as const;

// Points from food energy on a log scale: 1000 × log10(kcal) / 4. 10 kcal = 250, 100 = 500, 1,000 = 750, 10,000 = 1000.
export const calories = {
  prompt: 'Most calories',
  goal: 'Find the food or drink with the most calories',
  rule: `Real food or drink only, scored by everything in the container shown. Empty packaging and things that are not food score nothing. ${SCREEN}`,
  measure: 'the total calories in the food or drink shown (the whole container), on a log scale: 1 kcal is 1, 10 kcal is 250, 100 kcal is 500, 300 kcal is 619, 1,000 kcal is 750, 3,000 kcal is 869, 10,000 kcal or more is 1000',
  tiers: ['Crumb', 'Snack', 'Meal', 'Feast', 'Bulk'],
  items: [
    anchor('mint', ['breath mint', 'tic tac'], 76), anchor('gum', ['chewing gum'], 174), anchor('apple', [], 494), anchor('banana', [], 506),
    anchor('soda can', ['soda', 'coke', 'can of soda'], 537), anchor('chip bag', ['bag of chips', 'chips'], 544), anchor('granola bar', ['protein bar'], 569),
    anchor('energy drink', ['red bull', 'monster'], 586), anchor('candy bar', ['chocolate bar', 'snickers'], 599), anchor('instant ramen', ['ramen', 'cup noodles'], 646),
    anchor('family size chips', ['family size bag of chips'], 801), anchor('whole pizza', ['pizza'], 841), anchor('cereal box', ['cereal', 'box of cereal'], 854),
    anchor('peanut butter jar', ['peanut butter', 'jar of peanut butter'], 866), anchor('olive oil bottle', ['olive oil', 'cooking oil'], 976),
  ],
} as const;

// Points from the longest dimension on a log scale: 1000 × log10(cm) / 3. 10 cm ≈ 333, 1 m ≈ 667, 10 m = 1000.
export const longest = {
  prompt: 'Longest thing',
  goal: 'Find the longest thing you can show',
  rule: `The real object scores by its longest dimension; a coiled cable or rope counts at full length. People and animals do not count. ${SCREEN}`,
  measure: 'its longest dimension, on a log scale: 1 cm is 1, 3 cm is 159, 10 cm is 333, 30 cm is 492, 1 m is 667, 3 m is 826, 10 m or more is 1000',
  tiers: ['Tiny', 'Short', 'Medium', 'Long', 'Giant'],
  items: [
    anchor('paper clip', ['paperclip'], 159), anchor('pen', ['pencil', 'marker'], 382), anchor('smartphone', ['phone', 'iphone'], 392),
    anchor('ruler', [], 493), anchor('laptop', ['macbook'], 491), anchor('umbrella', [], 651), anchor('guitar', ['acoustic guitar', 'electric guitar'], 668),
    anchor('broom', ['mop'], 716), anchor('yoga mat', ['exercise mat'], 746), anchor('extension cord', ['power strip cord', 'cable'], 888), anchor('garden hose', ['hose', 'rope'], 997),
  ],
} as const;

// Every category; each match plays ROUNDS_PER_MATCH of them, drawn at random.
export const rounds = [blue, electricity, price, heavy, oldest, loud, calories, longest] as const;
export const ROUNDS_PER_MATCH = 3;
export type Category = typeof rounds[number];

// A match's categories: indexes into `rounds`, drawn at random with no repeats. ENVOGGLE_ROUNDS fixes
// them instead (1-based positions in `rounds`, in play order, e.g. "1,7,8" for a demo video).
export function drawRounds(random = Math.random, fixed = globalThis.process?.env?.ENVOGGLE_ROUNDS) {
  if (fixed) {
    const picks = fixed.split(',').map(value => Number(value.trim()) - 1);
    if (picks.length === ROUNDS_PER_MATCH && new Set(picks).size === picks.length && picks.every(index => Number.isInteger(index) && index >= 0 && index < rounds.length)) return picks;
    console.warn('[envoggle] Ignoring ENVOGGLE_ROUNDS: give', ROUNDS_PER_MATCH, 'different positions from 1 to', rounds.length);
  }
  return rounds.map((_, index) => ({ index, key: random() })).sort((a, b) => a.key - b.key).map(item => item.index).slice(0, ROUNDS_PER_MATCH);
}
type DictionaryItem = { name: string; aliases: readonly string[]; tier: (typeof RARITY)[keyof typeof RARITY]; points: number };

// The reveal tag for a score in a round: the name of its 200-point band.
export function tierName(points: number, prompt: string) {
  const index = Math.min(4, Math.max(0, Math.ceil(points / 200) - 1));
  return points > 0 ? (rounds.find(round => round.prompt === prompt) ?? blue).tiers[index] : undefined;
}

export function findItem(label: string, category: Category = blue) {
  const words = label.toLowerCase().trim().replace(/^(a|an|the|blue)\s+/, '').replace(/\s+/g, ' ');
  return (category.items as readonly DictionaryItem[]).find(item => item.name === words || item.aliases.some(alias => alias === words));
}
