import { prisma } from '../db.js'

// A trophy/award word with an English name and an optional Swedish name.
// If `sv` is missing, the English name is used everywhere as the fallback.
export interface TrophyWord {
  en: string
  sv?: string
}

const DEFAULT_TROPHY_WORDS_EN = [
  'Old rocking horse', 'Teddy bear with one missing eye', 'Pristine fountain pen',
  'Shiny red apple', 'Cracked porcelain duck', 'Golden banana', 'Tiny wizard hat',
  'Rusty bicycle bell', 'Suspicious pineapple', 'Fancy teaspoon', 'Broken alarm clock',
  'Very proud potato', 'Plastic crown', 'Rubber duck in sunglasses', 'Ancient office chair',
  'Glorious traffic cone', 'Half-melted candle', 'Tiny wooden stool', 'Fancy monocle',
  'Bent silver spoon', 'Emotional support cactus', 'Slightly haunted sandwich',
  'Golden toilet brush', 'Dusty trophy cup', 'Tiny garden gnome', 'Royal-looking cabbage',
  'Sock with a medal', 'Miniature pirate ship', 'Sad balloon', 'Heroic meatball',
  'Crystal doorknob', 'Wobbly chess knight', 'Suspicious egg', 'Majestic cheese wheel',
  'Lonely mitten', 'Fancy umbrella', 'Tiny dragon statue', 'Broken snow globe',
  'Glittery snail shell', 'Old TV remote', 'Ceremonial frying pan', 'Stuffed moose head',
  'Tiny treasure chest', 'Extremely normal rock', 'Banana peel on a pedestal',
  'Wooden spoon of destiny', 'Noble rubber boot', 'Golden stapler', 'Mysterious key',
  'Fancy teacup', 'Angry-looking lemon', 'Tiny accordion', 'Dusty violin',
  'Heroic garden shovel', 'Sparkly fishbowl', 'Old captain\'s hat', 'Royal egg cup',
  'Crooked picture frame', 'Tiny cannon', 'Very serious pumpkin', 'Broken compass',
  'Majestic toothbrush', 'Antique door knocker', 'Golden mushroom', 'Sleepy owl figurine',
  'Trophy-shaped sandwich', 'Fancy feather quill', 'Crowned frog statue', 'Tiny train engine',
  'Melancholy cupcake', 'Ancient calculator', 'Wooden duck on wheels', 'Plastic dinosaur',
  'Dramatic cape', 'Tiny lighthouse', 'Lucky horseshoe', 'Golden carrot',
  'Confused chicken statue', 'Silver waffle iron', 'Tiny bathtub', 'Worn-out boxing glove',
  'Fancy jam jar', 'Noble soup ladle', 'Crystal pineapple', 'Broken magic wand',
  'Tiny castle tower', 'Golden rolling pin', 'Mysterious blue bottle', 'Old leather boot',
  'Tiny scarecrow', 'Decorative fish', 'Bronze acorn', 'Fancy biscuit tin',
  'Tiny astronaut helmet', 'Royal lunchbox', 'Glittering onion', 'Old typewriter key',
  'Miniature windmill', 'Golden popcorn bucket',
]

export const DEFAULT_TROPHY_WORDS: TrophyWord[] = DEFAULT_TROPHY_WORDS_EN.map(en => ({ en }))

// Accept both the legacy format (array of strings) and the new format
// (array of { en, sv }) and always return normalized TrophyWord objects.
export function normalizeTrophyWords(parsed: unknown): TrophyWord[] {
  if (!Array.isArray(parsed)) return DEFAULT_TROPHY_WORDS
  const words = parsed
    .map((w): TrophyWord => {
      if (typeof w === 'string') return { en: w.trim() }
      const en = String((w as any)?.en ?? '').trim()
      const sv = String((w as any)?.sv ?? '').trim()
      return sv ? { en, sv } : { en }
    })
    .filter(w => w.en.length > 0)
  return words.length > 0 ? words : DEFAULT_TROPHY_WORDS
}

export async function getTrophyWords(): Promise<TrophyWord[]> {
  const row = await prisma.setting.findUnique({ where: { key: 'trophy_words' } })
  if (!row) return DEFAULT_TROPHY_WORDS
  try {
    return normalizeTrophyWords(JSON.parse(row.value))
  } catch {
    return DEFAULT_TROPHY_WORDS
  }
}

export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Resolve a chosen word into the title fields stored on a trophy.
// `titleSv` is only set when a distinct Swedish name was provided; display
// code falls back to the English title when it is null.
export function wordToTitle(word: TrophyWord): { title: string; titleSv: string | null } {
  const sv = word.sv?.trim()
  return { title: word.en, titleSv: sv ? sv : null }
}
