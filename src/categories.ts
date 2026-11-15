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

// Judged, not measured: how unexpected the object is in a dorm or study room.
export const weird = {
  prompt: 'Weirdest thing',
  goal: 'Find the weirdest thing you own',
  rule: `Any real object counts. People and animals do not count. ${SCREEN}`,
  measure: 'how strange and unexpected it is to find in a student\'s room: 1 is utterly ordinary (a pen), 500 is a fun oddity (a rubber duck), 1000 is something nobody would believe you own (a suit of armour). Everyday items stay under 150',
  tiers: ['Normal', 'Quirky', 'Odd', 'Weird', 'Bizarre'],
  items: [
    anchor('pen', ['pencil'], 4), anchor('water bottle', ['bottle'], 12), anchor('mug', ['cup'], 23), anchor('stuffed animal', ['teddy bear', 'plushie'], 238),
    anchor('rubber duck', ['rubber ducky'], 497), anchor('lava lamp', [], 563), anchor('fake mustache', ['moustache'], 641),
    anchor('traffic cone', ['cone'], 733), anchor('mannequin head', ['mannequin'], 812), anchor('taxidermy', ['stuffed animal head', 'mounted head'], 917),
  ],
} as const;

// Points from the number of separate pieces in one pack or set on a log scale: 1000 × log10(pieces) / 4.
// 10 pieces = 250, 100 = 500, 1,000 = 750, 10,000 = 1000.
export const pieces = {
  prompt: 'Most pieces',
  goal: 'Find the pack or set with the most pieces',
  rule: `The real object scores by how many separate pieces it holds; the pieces must already be together in one pack, box, jar or set. A pile you gather yourself does not count. People and animals do not count. ${SCREEN}`,
  measure: 'how many separate pieces the pack, box or set shown holds, on a log scale: 1 piece is 1, 10 is 250, 30 is 369, 100 is 500, 1,000 is 750, 3,000 is 869, 10,000 or more is 1000',
  tiers: ['Single', 'Handful', 'Pack', 'Bulk', 'Countless'],
  items: [
    anchor('pencil', ['pen'], 1), anchor('pack of gum', ['gum'], 294), anchor('box of crayons', ['crayons'], 345),
    anchor('deck of cards', ['playing cards', 'cards'], 429), anchor('sticky notes', ['post-it notes', 'sticky note pad'], 500),
    anchor('cotton swabs', ['q-tips', 'box of q-tips'], 675), anchor('ream of paper', ['printer paper'], 675), anchor('jigsaw puzzle', ['puzzle'], 750),
    anchor('box of staples', ['staples'], 925), anchor('bag of rice', ['rice'], 1000),
  ],
} as const;

// Points from the number of clearly different colours on a log scale: 1000 × log2(colours) / 5.
// 2 colours = 200, 4 = 400, 8 = 600, 16 = 800, 32 = 1000.
export const colours = {
  prompt: 'Most colours',
  goal: 'Find the most colourful thing you can',
  rule: `The real object scores by how many clearly different colours the camera can see on it; shades of one colour count once. A set in one box counts as one object. People and animals do not count. ${SCREEN}`,
  measure: 'how many clearly different colours it shows, counting black, white and grey, on a log scale: 1 colour is 1, 2 is 200, 4 is 400, 6 is 517, 8 is 600, 16 is 800, 32 or more is 1000',
  tiers: ['Plain', 'Two-tone', 'Colourful', 'Vivid', 'Rainbow'],
  items: [
    anchor('sheet of paper', ['paper'], 1), anchor('pen', ['pencil'], 200), anchor('sneaker', ['shoe', 'sneakers'], 317),
    anchor('highlighters', ['set of highlighters'], 464), anchor('cereal box', ['cereal'], 517), anchor("rubik's cube", ['rubiks cube', 'puzzle cube'], 517),
    anchor('tie-dye shirt', ['tie dye shirt'], 600), anchor('markers', ['set of markers', 'marker set'], 717),
    anchor('box of crayons', ['crayons'], 917), anchor('64 crayons', ['64-pack of crayons', 'big box of crayons'], 1000),
  ],
} as const;

// Points from how much liquid it holds when full on a log scale: 1000 × (log10(litres) + 2) / 4.
// 10 mL = 0, 100 mL = 250, 1 L = 500, 10 L = 750, 100 L = 1000.
export const liquid = {
  prompt: 'Holds the most liquid',
  goal: 'Find the container that holds the most liquid',
  rule: `The real object must be made to hold liquid, such as a cup, bottle, pot or bucket. It scores by how much it holds when full, not by what is in it now. ${SCREEN}`,
  measure: 'how much liquid it holds when full, on a log scale: 10 mL is 1, 100 mL is 250, 330 mL is 380, 1 L is 500, 4 L is 651, 10 L is 750, 100 L or more is 1000',
  tiers: ['Sip', 'Cup', 'Jug', 'Tub', 'Tank'],
  items: [
    anchor('shot glass', [], 161), anchor('mug', ['coffee mug', 'cup'], 386), anchor('soda can', ['can', 'can of soda'], 388),
    anchor('water bottle', ['bottle', 'hydro flask'], 469), anchor('electric kettle', ['kettle'], 558), anchor('2-liter bottle', ['two liter bottle', 'soda bottle'], 575),
    anchor('gallon jug', ['milk jug', 'gallon of water'], 645), anchor('pot', ['cooking pot', 'saucepan'], 651), anchor('bucket', ['pail'], 750),
    anchor('water cooler jug', ['5 gallon jug', 'water jug'], 819), anchor('cooler', ['ice chest'], 849),
  ],
} as const;

// Points from the hottest temperature reached in normal use on a log scale: 1000 × (log10(°C) − 1) / 2.
// 10 °C = 0, 100 °C = 500, 1,000 °C = 1000.
export const hottest = {
  prompt: 'Hottest thing',
  goal: 'Find the thing that gets the hottest',
  rule: `The real object scores by the hottest temperature it, or the water, air or flame it makes, reaches in normal use; it does not need to be hot now. People and animals do not count. ${SCREEN}`,
  measure: 'the hottest temperature it reaches in normal use, in degrees Celsius on a log scale: 10 °C or colder is 1, 20 °C (room temperature) is 151, 40 °C is 301, 100 °C is 500, 200 °C is 651, 500 °C is 849, 1,000 °C or more is 1000',
  tiers: ['Cold', 'Warm', 'Hot', 'Scorching', 'Blazing'],
  items: [
    anchor('ice pack', ['cold pack'], 1), anchor('pen', ['pencil'], 151), anchor('smartphone', ['phone', 'iphone'], 301), anchor('laptop', ['macbook'], 349),
    anchor('led bulb', ['light bulb', 'bulb'], 389), anchor('mug', ['coffee mug'], 423), anchor('hair dryer', ['blow dryer'], 452),
    anchor('electric kettle', ['kettle'], 500), anchor('clothes iron', ['iron'], 651), anchor('hair straightener', ['flat iron', 'curling iron'], 681),
    anchor('oven', ['toaster oven'], 699), anchor('toaster', [], 889), anchor('lighter', ['candle', 'matches'], 1000),
  ],
} as const;

// Points from total caffeine on a log scale: 1000 × log10(mg) / 4. 10 mg = 250, 100 mg = 500, 1,000 mg = 750, 10,000 mg = 1000.
export const caffeine = {
  prompt: 'Most caffeine',
  goal: 'Find the food or drink with the most caffeine',
  rule: `Real food, drink or pills only, scored by all the caffeine in the container shown. Things without caffeine and empty packaging score nothing. ${SCREEN}`,
  measure: 'the total caffeine in the food, drink or pills shown (the whole container), in milligrams on a log scale: 1 mg is 1, 10 mg is 250, 35 mg is 386, 100 mg is 500, 300 mg is 619, 1,000 mg is 750, 10,000 mg or more is 1000',
  tiers: ['Decaf', 'Mild', 'Buzz', 'Wired', 'Jolt'],
  items: [
    anchor('milk chocolate bar', ['chocolate bar', 'hershey bar'], 239), anchor('soda can', ['soda', 'coke', 'can of soda'], 383), anchor('tea bag', [], 418),
    anchor('dark chocolate bar', ['dark chocolate'], 476), anchor('cup of coffee', ['coffee'], 494), anchor('coffee pod', ['k-cup', 'keurig pod'], 500),
    anchor('energy drink', ['red bull', 'monster'], 551), anchor('cold brew bottle', ['cold brew'], 575), anchor('box of tea bags', ['box of tea'], 743),
    anchor('instant coffee jar', ['instant coffee'], 886), anchor('bag of ground coffee', ['ground coffee', 'coffee beans'], 901),
    anchor('pre-workout tub', ['pre-workout'], 945), anchor('caffeine pills', ['bottle of caffeine pills'], 1000),
  ],
} as const;

// Points from how many separate numbers are visible on it on a log scale: 1000 × log10(numbers) / 3.
// 10 numbers ≈ 333, 100 ≈ 667, 1,000 = 1000.
export const numbers = {
  prompt: 'Most numbers',
  goal: 'Find the thing with the most numbers on it',
  rule: `The real object scores by how many separate numbers are printed or written on it and visible in the frame; count numbers, not digits. People and animals do not count. ${SCREEN}`,
  measure: 'how many separate numbers are printed or written on it and visible in the frame, on a log scale: 1 number is 1, 3 is 159, 10 is 333, 30 is 492, 100 is 667, 300 is 826, 1,000 or more is 1000',
  tiers: ['Blank', 'A few', 'Plenty', 'Dense', 'Spreadsheet'],
  items: [
    anchor('coin', ['quarter', 'penny'], 100), anchor('clock', ['wall clock', 'watch'], 360), anchor('keyboard', ['computer keyboard'], 447),
    anchor('receipt', [], 466), anchor('nutrition label', ['food package'], 492), anchor('calendar', ['wall calendar'], 506), anchor('ruler', [], 541),
    anchor('math textbook page', ['textbook page'], 593), anchor('multiplication chart', ['times table'], 719),
    anchor('periodic table', ['periodic table poster'], 848), anchor('printed spreadsheet', ['spreadsheet printout'], 900),
  ],
} as const;

// Every category; each match plays ROUNDS_PER_MATCH of them, drawn at random.
export const rounds = [blue, electricity, price, heavy, oldest, loud, calories, longest, weird, pieces, colours, liquid, hottest, caffeine, numbers] as const;
export const ROUNDS_PER_MATCH = 3;
export type Category = typeof rounds[number];

// A match's categories: indexes into `rounds`, drawn at random with no repeats.
export function drawRounds(random = Math.random) {
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
