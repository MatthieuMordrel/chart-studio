import type { RecipeLogRecord } from '../mock-data'
import { isoDateDaysAgo, seededRandom } from './utils'

const DISHES = [
  { dish: 'Spaghetti Carbonara' as const, cuisine: 'Italian' as const, prep: 15, cook: 20, difficulty: 'Medium' as const },
  { dish: 'Tacos al Pastor', cuisine: 'Mexican', prep: 30, cook: 25, difficulty: 'Medium' },
  { dish: 'Fried Rice', cuisine: 'Asian', prep: 10, cook: 15, difficulty: 'Easy' },
  { dish: 'Grilled Cheese', cuisine: 'American', prep: 2, cook: 5, difficulty: 'Easy' },
  { dish: 'Risotto', cuisine: 'Italian', prep: 15, cook: 35, difficulty: 'Hard' },
  { dish: 'Burrito Bowl', cuisine: 'Mexican', prep: 20, cook: 10, difficulty: 'Easy' },
  { dish: 'Pad Thai', cuisine: 'Asian', prep: 25, cook: 15, difficulty: 'Medium' },
  { dish: 'Mac and Cheese', cuisine: 'American', prep: 5, cook: 15, difficulty: 'Easy' },
  { dish: 'Lasagna', cuisine: 'Italian', prep: 45, cook: 60, difficulty: 'Hard' },
  { dish: 'Quesadilla', cuisine: 'Mexican', prep: 5, cook: 8, difficulty: 'Easy' },
  { dish: 'Stir Fry', cuisine: 'Asian', prep: 20, cook: 10, difficulty: 'Medium' },
  { dish: 'Pizza Margherita', cuisine: 'Italian', prep: 20, cook: 15, difficulty: 'Medium' },
  { dish: 'Enchiladas', cuisine: 'Mexican', prep: 25, cook: 25, difficulty: 'Medium' },
  { dish: 'Ramen', cuisine: 'Asian', prep: 40, cook: 20, difficulty: 'Hard' },
  { dish: 'Burgers', cuisine: 'American', prep: 10, cook: 12, difficulty: 'Easy' },
  { dish: 'Pasta Puttanesca', cuisine: 'Italian', prep: 10, cook: 15, difficulty: 'Easy' },
  { dish: 'Guacamole', cuisine: 'Mexican', prep: 10, cook: 0, difficulty: 'Easy' },
  { dish: 'Dumplings', cuisine: 'Asian', prep: 35, cook: 12, difficulty: 'Medium' },
  { dish: 'Pancakes', cuisine: 'American', prep: 5, cook: 10, difficulty: 'Easy' }
] as const

/**
 * Generate home cooking records – many points over ~18 months.
 */
export function generateRecipeLogData(count: number): RecipeLogRecord[] {
  const out: RecipeLogRecord[] = []
  for (let i = 0; i < count; i++) {
    const d = DISHES[Math.floor(seededRandom(i * 7) * DISHES.length)]
    const daysAgo = Math.floor(seededRandom(i * 11) * 550)
    const rating = Math.floor(seededRandom(i * 13) * 3) + 3 // 3–5
    out.push({
      cookedAt: isoDateDaysAgo(daysAgo),
      dish: d.dish,
      cuisine: d.cuisine,
      prepMinutes: d.prep + Math.floor(seededRandom(i * 17) * 10),
      cookMinutes: d.cook + Math.floor(seededRandom(i * 19) * 15),
      difficulty: d.difficulty,
      rating
    })
  }
  return out.sort((a, b) => new Date(a.cookedAt).getTime() - new Date(b.cookedAt).getTime())
}
