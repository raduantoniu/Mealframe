import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, Check, Loader2, ChevronDown, ChevronUp, ExternalLink, AlertTriangle, Copy, Clock, Dumbbell, Moon, Coffee, UtensilsCrossed, AlarmClock } from 'lucide-react';

// =====================================================
// OPTIWORKOUT HANDOFF
// =====================================================
const OPTIWORKOUT_URL = 'https://optiworkout.raduantoniu.com';
const MACROMETRIC_URL = 'https://strategy.raduantoniu.com';

// =====================================================
// UNIT / ROUNDING HELPERS  (copied verbatim from MacroMetric)
// =====================================================

const kgToLb = (kg) => kg * 2.20462;
const lbToKg = (lb) => lb / 2.20462;
const roundUpTo50 = (x) => Math.ceil(x / 50) * 50;
const roundToNearest50 = (x) => Math.round(x / 50) * 50;
const roundToNearest5 = (x) => Math.round(x / 5) * 5;
const roundTo5g = (x) => Math.round(x / 5) * 5;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

const minutesToClock = (mins) => {
  let m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, '0')}`;
};
const minutesToHHMM = (mins) => {
  let m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const hhmmToMinutes = (s) => {
  const [h, m] = (s || '').split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

// =====================================================
// ░░░ TUNING SURFACE ░░░
// =====================================================

const CALORIE_VECTORS = {
  cut: {
    // 2-meal: kept EVEN (the last meal is capped at 50% — see LAST_MEAL_MAX_PCT —
    // so two meals split ~50/50 rather than a small lunch + an oversized dinner).
    // High-cal heavy days still first-heavy via the absolute 1,100 kcal dinner cap.
    2: { light: [50, 50], moderate: [50, 50], heavy: [50, 50] },
    3: { light: [25, 35, 40], moderate: [25, 30, 45], heavy: [25, 28, 47] },
  },
  // BULK: meals sum to 100% of target (snacks sit ON TOP, never budgeted). The
  // default shape mildly backloads — dinner is the largest, matching the practical
  // reality that most people eat most easily in the evening. These are the "even
  // day" shapes; buildMealPlan reshapes them for a light morning anchor, a small
  // post-workout meal, or a big pre-gym meal (see BULK_* vector variants below).
  bulk: {
    3: { low: [30, 33, 37], mid: [30, 33, 37], high: [30, 33, 37] },
    4: { low: [22, 26, 26, 26], mid: [22, 26, 26, 26], high: [22, 26, 26, 26] },
    5: { low: [18, 20, 21, 20, 21], mid: [18, 20, 21, 20, 21], high: [18, 20, 21, 20, 21] },
  },
};

// Bulk morning-anchor shapes: a small light AM feeding, remaining calories loaded
// into the later meals (dinner biggest). Used when morningMode === 'light_anchor'.
const BULK_ANCHOR_VECTORS = {
  3: [18, 40, 42],
  4: [15, 28, 28, 29],
};

// Bulk "trains after last meal" shapes: real meals carry the day, then a small
// post-workout meal closes it (protein feeding before bed). NOT an anchor/shake —
// a real, small meal. Matches the case-2 / case-7 pattern.
const BULK_POST_WORKOUT_VECTORS = {
  3: [34, 46, 20],            // two full meals + small post-gym meal
  4: [25, 32, 29, 14],        // three real meals + small post-gym meal
};

// Per-meal calorie ceiling on a bulk. No single meal exceeds this; overflow is
// pushed to other meals or absorbed by an extra meal / optional snacks.
const BULK_MEAL_KCAL_CAP = 1200;

// Breakfast-mode calorie vectors (3-meal only): a real breakfast, a smaller
// "valley" lunch, and the biggest meal still at dinner (never front-loaded).
// 2-meal breakfast plans reuse the IF 2-meal shape (breakfast + dinner).
const CUT_BREAKFAST_VECTORS = {
  3: { light: [33, 30, 37], moderate: [33, 25, 42], heavy: [30, 22, 48] },
};

// Late-evening ("after my last meal") calorie vectors. 3-meal: big meal sits
// second-to-last (pre-gym), last meal is a light post-gym wrap-up. 2-meal: a
// normal first meal, then the big pre-gym meal (the post-gym feed is a shake).
const CUT_LATE_EVENING_VECTORS = {
  2: [42, 58],
  3: [33, 42, 25],
};

const PROTEIN_WEIGHTS = {
  cut: {
    // Cut protein is distributed EVENLY (the engine reads this as a fallback; the
    // cut macro build uses an even split + per-meal cap, not these weights).
    2: { light: [1, 1], moderate: [1, 1], heavy: [1, 1] },
    3: { light: [1, 1, 1], moderate: [1, 1, 1], heavy: [1, 1, 1] },
  },
  bulk: {
    3: { low: [1, 1, 1], mid: [1, 1, 1], high: [1, 1, 1] },
    4: { low: [1, 1, 1, 1], mid: [1, 1, 1, 1], high: [1, 1, 1, 1] },
    5: { low: [1, 1, 1, 1, 1], mid: [1, 1, 1, 1, 1], high: [1, 1, 1, 1, 1] },
  },
};

const FAT_WEIGHTS = {
  cut: {
    2: { light: [1, 1], moderate: [0.9, 1.1], heavy: [0.8, 1.2] },
    3: { light: [1, 1, 1], moderate: [0.9, 0.95, 1.15], heavy: [0.85, 0.85, 1.3] },
  },
  bulk: {
    3: { low: [1, 1, 1], mid: [1, 1, 1], high: [1, 1, 1] },
    4: { low: [1, 1, 1, 1], mid: [1, 1, 1, 1], high: [1, 1, 1, 1] },
    5: { low: [1, 1, 1, 1, 1], mid: [1, 1, 1, 1, 1], high: [1, 1, 1, 1, 1] },
  },
};

const FIBER_WEIGHTS = {
  cut: {
    2: { light: [1, 1], moderate: [1.2, 0.85], heavy: [1.5, 0.6] },
    3: { light: [1, 1, 1], moderate: [1.2, 1.2, 0.7], heavy: [1.4, 1.4, 0.5] },
  },
  bulk: {
    3: { low: [1, 1, 1], mid: [1, 1, 1], high: [0.9, 1, 0.9] },
    4: { low: [1, 1, 1, 1], mid: [1, 1, 1, 1], high: [0.9, 1, 1, 0.9] },
    5: { low: [1, 1, 1, 1, 1], mid: [1, 1, 1, 1, 1], high: [0.8, 1, 1, 1, 0.8] },
  },
};

const DENSITY_BANDS = {
  cut: {
    early: [0.6, 1.1],
    mid: [0.9, 1.4],
    dinner: { light: [1.1, 1.6], moderate: [1.3, 1.9], heavy: [1.5, 2.6] },
  },
  bulk: {
    early: { low: [0.9, 1.5], mid: [1.2, 1.9], high: [1.6, 2.6] },
    mid: { low: [1.0, 1.6], mid: [1.3, 2.0], high: [1.8, 2.8] },
    dinner: { low: [1.2, 1.8], mid: [1.5, 2.2], high: [2.0, 3.2] },
  },
};

const LEANNESS_DENSITY_MULT = [
  { maxHeightDiff: 80, mult: 1.0 },
  { maxHeightDiff: 95, mult: 0.95 },
  { maxHeightDiff: Infinity, mult: 0.88 },
];

// --- SHAKE SLOT ---------------------------------------------------------------
const SHAKE_PROTEIN_G = 30;             // one scoop — 30g protein
const SHAKE_CARB_G = 5;                 // a splash of carbs (half a banana); ~140 kcal total
const EARLY_FEED_SHAKE_PCT = 0.10;      // early protein feeding = ~10% of daily kcal
const EARLY_FEED_SHAKE_PROTEIN_G = 35;  // protein-forward AM feeding (helps plant-based reach targets)
const BULK_AM_PROTEIN_FLOOR = 25;       // bulk "light anchor" mandatory morning protein

// --- PER-MEAL MACRO GUARDRAILS (cut) -----------------------------------------
// Protein distributes evenly across meals, capped per meal (3-meal plans keep
// meals moderate; 2-meal plans allow bigger protein meals + a shake to top up).
// Carbs are the remainder and carry the backload; every meal gets carb + fat
// floors so it's real food, never a supplement-only "bomb". The last meal is
// capped so we never bank an unrealistic dinner.
const PROTEIN_CAP_BY_MEALS = { 2: 70, 3: 55 };
const PROTEIN_FLOOR_G = 20;
const CARB_FLOOR_G = 25;
const FAT_FLOOR_G = 10;
const LAST_MEAL_MAX_PCT = { 2: 0.50, 3: 0.50 };
const LAST_MEAL_MAX_KCAL_HEAVY = 1100; // heavy/social: enough to absorb a family dinner

const BULK_LOAD_KCAL_PER_KG = [
  { maxLoad: 3.5, tier: 'low' },
  { maxLoad: 6.0, tier: 'mid' },
  { maxLoad: Infinity, tier: 'high' },
];

const DEFAULT_WAKE = 7 * 60;
const DEFAULT_SLEEP = 23 * 60;
const DEFAULT_TRAIN = 18 * 60;

// The sleep-anchored last meal sits this far before bed. ~3.5h keeps dinner from
// running uncomfortably late (lifters consistently prefer ~19:00-19:30 for an 11pm
// bed). Evening-workout plans override this and anchor the last meal to the gym.
const LAST_MEAL_BEFORE_SLEEP = 210;
const MIN_LAST_MEAL_GAP = 120;
// Cap on how far the pre-workout meal drifts from the previous meal, so a late
// session (e.g. 8pm) doesn't strand a huge morning gap — past this we hold the
// pre-workout meal earlier and bridge the rest with a pre-workout shake.
const MAX_PRE_WORKOUT_SPREAD = 300;

const FIRST_MEAL_AFTER_WAKE_FASTED = 240;
const FIRST_MEAL_AFTER_WAKE = 60;
const INTER_MEAL_GAP = 210;
const MIN_INTER_MEAL_GAP = 150;
// On a long day (e.g. a 2am bedtime) the sleep-anchored last meal can sit hours
// after a forward-spaced earlier meal. If that tail gap exceeds this, switch from
// forward fixed-gap to even spacing so no single gap is oversized. Tuned to keep
// the normal cases (C/J/M/D ≤7h tail) on forward spacing.
const MAX_TAIL_GAP = 450;

const POST_WORKOUT_MEAL_DELAY = 150;
const POST_WORKOUT_LIGHT_DELAY = 90;
const PRE_WORKOUT_MEAL_GAP = 120;

// Shake / gap-bridging thresholds (minutes). A shake only ever bridges a gap.
const SHAKE_BRIDGE_GAP = 210;     // only a gap >3.5h needs bridging (4-5h between meals is fine)
const SHAKE_FASTED_POST_MIN = 150; // fasted + ravenous: bridge to the first meal if it's >2.5h out
const SHAKE_ADJACENT_GAP = 90;     // a meal within 1.5h counts as "right after" — no shake needed

const MORNING_TRAIN_CUTOFF = 11 * 60;
const EVENING_TRAIN_CUTOFF = 16 * 60;

const FLATTEN_TIER_MAP = { heavy: 'light', moderate: 'light', light: 'light' };

const FIBER_PER_1000KCAL = 14;
const calcFiber = (kcal) => roundToNearest5((kcal / 1000) * FIBER_PER_1000KCAL);

// =====================================================
// MM1 DECODER  (MUST mirror MacroMetric's buildMacroMetricCode EXACTLY)
// 13 fields: units|dir|kcal|P|F|C|fiber|tier|sub|weight|height|maint|genDate
// =====================================================

const MM_SCHEMA_PREFIX = 'MM1';
const TIER_NAME = ['novice', 'intermediate', 'proficient', 'advanced'];

function checksum2(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1296;
  return h.toString(36).padStart(2, '0');
}
function base64urlDecode(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return atob(t);
}
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function genDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
function genDateAgeWeeks(genDate) {
  if (!genDate || genDate.length !== 8) return null;
  const then = new Date(+genDate.slice(0, 4), +genDate.slice(4, 6) - 1, +genDate.slice(6, 8));
  if (isNaN(then.getTime())) return null;
  return (Date.now() - then.getTime()) / (1000 * 60 * 60 * 24 * 7);
}

function decodeMacroMetricCode(raw) {
  if (!raw || !raw.trim()) return { ok: false, error: 'empty' };
  const parts = raw.trim().split('-');
  if (parts.length !== 3) return { ok: false, error: 'format' };
  const [prefix, body, checksum] = parts;
  if (prefix !== MM_SCHEMA_PREFIX) {
    if (/^MM\d+$/i.test(prefix)) return { ok: false, error: 'version' };
    if (/^SS\d+$/i.test(prefix)) return { ok: false, error: 'wrongcode' };
    return { ok: false, error: 'format' };
  }
  let payload;
  try { payload = base64urlDecode(body); } catch { return { ok: false, error: 'corrupt' }; }
  if (checksum2(payload) !== checksum) return { ok: false, error: 'checksum' };
  const f = payload.split('|');
  if (f.length < 13) return { ok: false, error: 'fields' };
  const tierIdx = parseInt(f[7], 10);
  const data = {
    units: f[0] === 'i' ? 'imperial' : 'metric',
    direction: f[1] === 'c' ? 'cut' : 'bulk',
    target: parseInt(f[2], 10),
    protein: parseInt(f[3], 10),
    fat: parseInt(f[4], 10),
    carbs: parseInt(f[5], 10),
    fiber: parseInt(f[6], 10),
    tier: TIER_NAME[tierIdx] ?? 'novice',
    tierIdx,
    subBracket: parseInt(f[8], 10),
    weight: parseFloat(f[9]),
    height: parseInt(f[10], 10),
    maintenance: parseInt(f[11], 10),
    genDate: f[12],
  };
  if (isNaN(data.target) || isNaN(data.protein) || isNaN(data.weight) || isNaN(data.height) || isNaN(data.subBracket)) {
    return { ok: false, error: 'fields' };
  }
  return { ok: true, data };
}

// Build the same macro object decodeMacroMetricCode produces, but from hand-entered
// numbers (the "Build from custom macros" path). Carbs already fill the calories left
// after protein and fat; fiber is 14g per 1000 kcal. Fields the cut engine never reads
// (tier, weight, height, maintenance) get harmless defaults; the cut structure comes
// entirely from the questionnaire, and the reload ID embeds the macros directly.
function buildCustomCode({ direction, target, protein, fat, carbs, fiber }) {
  const d = new Date();
  const genDate = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return {
    units: 'metric', direction, target, protein, fat, carbs, fiber,
    tier: 'intermediate', tierIdx: 1, subBracket: 1,
    weight: 0, height: 0, maintenance: 0, genDate,
  };
}

const subBracketTierLabel = (tier, sub) => {
  const t = { novice: 'Novice', intermediate: 'Intermediate', proficient: 'Proficient', advanced: 'Advanced' }[tier] || 'Novice';
  const w = { 0: 'Low', 1: '', 2: 'High' }[sub];
  return w ? `${w}-${t}` : t;
};

// =====================================================
// QUESTIONNAIRE CONFIG (data-driven; engines read the answer keys)
// =====================================================
//
// CUT question set rebuilt for the template-classifier model:
//   REMOVED: mealCount (now diagnosed), shape (now diagnosed), snack (replaced
//            by cravings), pastFail (orphaned; its only engine use — the
//            evenings→moderate nudge — is now covered by the backload axis),
//            satiety (orphaned once 3 meals became the universal default — its
//            only job was the 2-vs-3 count).
//   ADDED:   cravings (snack modifier + treat).
//   KEPT:    morningHunger, eveningOvereat, daytimeControl, dinnerControl,
//            workout, hungryPostWorkout, alcohol, schedule, restriction.

const CUT_QUESTIONS = [
  { id: 'morningHunger', q: 'Can you comfortably skip breakfast (water + coffee) without struggling?',
    options: [['easy','Yes, easily (no morning appetite)'],['ok','I can manage (usually eat breakfast, but can skip it)'],['hard','No, I get very hungry in the morning']] },
  { id: 'eveningOvereat', q: 'Do you tend to eat more in the evenings?',
    options: [
      ['no','No'],
      ['hungry','Yes — I\'m genuinely hungry at night'],
      ['onlytime','Yes — it\'s the only time I have to eat'],
      ['habit','Yes — to decompress / boredom / habit'],
    ] },
  { id: 'daytimeControl', q: 'How do you handle food during the day?',
    options: [
      ['cook','I cook or bring my own meals'],
      ['eatout','I eat out / takeout most days'],
      ['none','No real daytime meals — I skip or grab snacks'],
      ['wfh','Work from home, eat normally'],
    ] },
  { id: 'dinnerControl', q: 'What does dinner usually look like?',
    options: [
      ['control','I cook it / control the ingredients (alone or with a partner)'],
      ['family','Family or partner cooks, we eat together'],
      ['social','Frequent social or restaurant dinners'],
      ['varies','It varies a lot week to week'],
    ] },
  { id: 'workout', q: 'When do you usually train?',
    options: [
      ['before_first','Before my first meal (fasted or pre-workout shake)'],
      ['midday','Morning, afternoon, or evening — between two meals'],
      ['evening','Evening, after my last meal'],
    ] },
  { id: 'hungryPostWorkout', q: 'Do you get really hungry right after training?',
    options: [
      ['yes','Yes — I\'m ravenous after the gym'],
      ['no','Not especially'],
    ] },
  { id: 'cravings', q: 'How have cravings affected your past diet attempts?',
    options: [
      ['wrecked','They\'ve wrecked my cuts — I need a treat every day'],
      ['manage','I get them but I manage'],
      ['none','Not really an issue'],
    ] },
  { id: 'alcohol', q: 'How often do you drink alcohol?',
    options: [
      ['none','I don\'t drink'],
      ['rare','Rarely — events only (1–2/week)'],
      ['moderate','Moderate — mostly weekends (3–6/week)'],
      ['daily','Daily (1–2+/day)'],
    ] },
  { id: 'schedule', q: 'How predictable is your weekly schedule?',
    options: [
      ['consistent','Consistent — most days look similar'],
      ['travel','I travel often for work'],
      ['shifts','I work shifts'],
      ['nights','I work night shifts'],
      ['erratic','Most days look very different'],
    ] },
  { id: 'restriction', q: 'Any dietary restrictions? (choose all that apply)', multi: true,
    options: [
      ['none','No restrictions'],
      ['nomeat','I don\'t eat meat'],
      ['vegetarian','Lacto-ovo vegetarian'],
      ['vegan','Vegan'],
      ['pescatarian','Pescatarian'],
      ['nopork','No pork'],
      ['nodairy','No dairy'],
      ['allergy','Nut / gluten allergy'],
    ] },
];

// BULK questionnaire (v1 — 10 questions). Answer IDs are the logic keys used by
// selectBulkStructure. Q1×Q2 derive the bulk TYPE; Q1 alone drives copy barrier.
// Q3 drives morning mode; Q7/Q8 drive pre-workout sizing; Q4/Q5/Q6 shape copy and
// distribution; Q9 is schedule; Q10 restrictions. (Old Q4/Q5 "how many meals"
// dropped — the engine picks meal count from calories, not the client's guess.)
const BULK_QUESTIONS = [
  { id: 'gainExperience', q: 'When you\'ve bulked before, how did it go?',
    options: [
      ['hardgain','I found it hard to gain weight — I physically struggled to eat enough'],
      ['undereat','I didn\'t gain consistently — I was often undereating (no time, forgot, food wasn\'t appealing)'],
      ['selfsab','I barely gained — I pulled back from the surplus for fear of fat gain or to stay lean'],
      ['ontarget','I gained at the target rate without much trouble'],
      ['toofast','I gained too fast and put on fat quickly — hard to hold to the target surplus'],
      ['never','I\'ve never really bulked before'],
    ] },
  { id: 'appetite', q: 'When you\'re intentionally eating a calorie surplus, how is your appetite?',
    options: [
      ['low','Low — I struggle to eat enough'],
      ['normal','Normal — I can eat a bit more without forcing it'],
      ['high','High — I have to hold back to not overeat'],
    ] },
  { id: 'shape', q: 'How do you naturally eat in the morning?',
    options: [
      ['breakfast','I eat breakfast — I\'m hungry in the AM'],
      ['light','Something light — I\'d rather not eat much early'],
      ['skip','I usually don\'t eat for a few hours after waking up'],
    ] },
  { id: 'daytime', q: 'How do you handle food during the day?',
    options: [
      ['cook','I cook or bring my own meals'],
      ['eatout','I eat out / takeout most days'],
      ['none','No real daytime meals — I skip or grab snacks'],
      ['wfh','Work from home, eat normally'],
    ] },
  { id: 'evening', q: 'Do you tend to eat more in the evenings?',
    options: [
      ['no','No'],
      ['hungry','Yes — I\'m genuinely hungry at night'],
      ['onlytime','Yes — it\'s the only time I have to eat'],
      ['habit','Yes — to decompress / boredom / habit'],
    ] },
  { id: 'dinner', q: 'What does dinner usually look like?',
    options: [
      ['control','I cook it / control the ingredients (alone or with a partner)'],
      ['family','Family or partner cooks, we eat together'],
      ['social','Frequent social or restaurant dinners'],
      ['varies','It varies a lot week to week'],
    ] },
  { id: 'workout', q: 'When do you usually train?',
    options: [
      ['before_first','Before my first meal'],
      ['midday','Morning, afternoon, or evening — between two meals'],
      ['evening','Evening, after my last meal'],
    ] },
  { id: 'preworkoutTolerance', q: 'Can you train comfortably soon after eating a big meal?',
    options: [
      ['light','No — I prefer training with little food in my stomach'],
      ['big','Yes — I can eat big and train just fine after an hour or two'],
    ] },
  { id: 'schedule', q: 'How predictable is your weekly schedule?',
    options: [
      ['consistent','Consistent — most days look similar'],
      ['travel','I travel often for work'],
      ['shifts','I work shifts'],
      ['nights','I work night shifts'],
      ['erratic','Most days look very different'],
    ] },
  { id: 'restriction', q: 'Any dietary restrictions? (choose all that apply)', multi: true,
    options: [
      ['none','No restrictions'],
      ['nomeat','I don\'t eat meat'],
      ['vegetarian','Lacto-ovo vegetarian'],
      ['vegan','Vegan'],
      ['pescatarian','Pescatarian'],
      ['nopork','No pork'],
      ['nodairy','No dairy'],
      ['allergy','Nut / gluten allergy'],
    ] },
];

// =====================================================
// CUT SELECTION ENGINE  (template-classifier model)
// Returns { morningMode, mealCount, backloadTier, flags, notes[] }
//   morningMode:  'if' (fast to a midday first meal)  |  'breakfast' (real AM meal)
//   mealCount:    2  |  3            (default leans 3, the workhorse)
//   backloadTier: 'light' (even) | 'moderate' | 'heavy'
//
// Backload is driven by the evening/dinner answers only — post-workout hunger no
// longer skews calories (it only affects shake placement, in buildMealPlan/timeline).
// =====================================================

function selectCutStructure(a) {
  const notes = [];

  // --- DECISION 1: meal count ---
  // 3 meals is the universal default — it fits the great majority of lifters and
  // satisfies satiety on its own. The 2-meal plan is always offered as the
  // alternative (selectCutAlternative) for anyone who prefers fewer, bigger meals.
  // Cravings that have wrecked past cuts still earn a planned daily treat.
  const mealCount = 3;
  const cravingsSnack = a.cravings === 'wrecked';
  if (cravingsSnack) {
    notes.push('Cravings have derailed past cuts, so the plan keeps one planned daily treat — a structure that bends instead of breaking.');
  }

  // --- DECISION 2: morning mode — IF vs breakfast ---
  // Driven only by morning appetite. There is no "10% feeding" mode: a genuinely
  // morning-hungry lifter simply eats breakfast. "Easy" and "I can manage" both
  // default to IF (the cleaner cut tool, and late risers fast well); "manage"
  // gets breakfast offered as the alternative plan.
  let morningMode = (a.morningHunger === 'hard') ? 'breakfast' : 'if';

  // --- DECISION 3: backload tier (none/even · moderate · heavy) ---
  let backloadTier;
  if (a.dinnerControl === 'family' || a.dinnerControl === 'social' || a.daytimeControl === 'none' || a.daytimeControl === 'eatout') {
    backloadTier = 'heavy';
    if (a.dinnerControl === 'family' || a.dinnerControl === 'social') {
      notes.push('Your dinner is largely out of your hands, so we bank protein and fiber into the earlier meals and leave a big, flexible calorie budget for the evening.');
    } else {
      notes.push('With no daytime cooking, your earlier feedings are simple high-protein, high-fiber bridges (protein yogurt + fruit, a smoothie, cottage cheese + fruit) and the bulk of your calories land at the meal you control.');
    }
  } else if (a.eveningOvereat === 'hungry' || a.eveningOvereat === 'onlytime') {
    backloadTier = 'moderate';
  } else if (a.eveningOvereat === 'no' && (a.daytimeControl === 'cook' || a.daytimeControl === 'wfh') && a.dinnerControl === 'control') {
    // none/even: steady appetite + cooks own + doesn't overeat at night.
    backloadTier = 'light';
  } else {
    backloadTier = 'moderate'; // ambiguous default — always keep an evening buffer
  }

  // Q3 rule: a breakfast-eater who ISN'T hungry at night gets an even plan (still
  // never front-loaded — a little is saved for the evening, just in case). This
  // catches the morning-hungry / not-night-hungry lifter who isn't already 'light'.
  if (morningMode === 'breakfast' && a.eveningOvereat === 'no' && backloadTier === 'moderate') {
    backloadTier = 'light';
    notes.push('You eat in the morning but aren\'t especially hungry at night, so we keep your meals fairly even — with a little buffer saved for the evening, just in case.');
  }

  // --- FLAGS ---
  const flags = {
    shakePre: a.workout === 'before_first',
    shakePost: false,
    hungryPostWorkout: a.hungryPostWorkout === 'yes', // R3: shake placement only, NOT backload
    cravingsSnack,                              // Stage 2 budgeted snack modifier
    dessert: a.cravings === 'wrecked',          // single-serving planned-treat prose
    alcohol: a.alcohol === 'moderate' || a.alcohol === 'daily',
    alcoholLevel: a.alcohol,
    restriction: a.restriction || ['none'],
    irregular: ['travel', 'shifts', 'nights', 'erratic'].includes(a.schedule),
    workout: a.workout,
  };

  return { morningMode, mealCount, backloadTier, flags, notes };
}

// The "see an alternative that also fits" plan. The recommended plan is always
// 3 meals; the standing alternative is the same plan run as 2 larger meals, for
// lifters who'd rather eat fewer, bigger plates. The alternative carries its own
// lead note so the rationale on screen always matches the option shown.
function selectCutAlternative(answers, primary) {
  if (primary.mealCount !== 3) return null; // only ever fork down to 2 off a 3-meal primary
  const blurb = 'Two larger meals instead of three \u2014 simpler if you\'d rather eat big and go longer between meals.';
  return {
    structure: { ...primary, mealCount: 2, notes: [blurb, ...(primary.notes || [])] },
    primaryLabel: '3 meals',
    label: '2 meals',
    blurb,
  };
}

// =====================================================
// BULK SELECTION ENGINE  (v1 — type-matrix model, derived from 12 worked plans)
// =====================================================
//
// Two independent axes:
//   bulkType (structure): cautious / balanced / hardgainer — drives density band,
//     snack count, and food-choice copy.
//   barrier (copy only):  physiological / logistical / psychological / restraint /
//     none — same structure can carry different narratives.
//
// TYPE MATRIX (Q1 gainExperience × Q2 appetite):
//   cautious   = toofast(1e, any Q2), OR ontarget(1d) + high(2c)
//   hardgainer = {hardgain,undereat,selfsab}(1a/1b/1c) + low(2a),
//                OR hardgain(1a) + normal(2b)
//   balanced   = everything else
//
// loadTier (surplus/kg) is still computed and exposed, but gates nothing in v1.

function bulkTypeOf(a) {
  const g = a.gainExperience, ap = a.appetite;
  if (g === 'toofast') return 'cautious';
  if (g === 'ontarget' && ap === 'high') return 'cautious';
  if ((g === 'hardgain' || g === 'undereat' || g === 'selfsab') && ap === 'low') return 'hardgainer';
  if (g === 'hardgain' && ap === 'normal') return 'hardgainer';
  return 'balanced';
}

function bulkBarrierOf(a) {
  const g = a.gainExperience;
  if (g === 'hardgain') return 'physiological';
  if (g === 'undereat') return 'logistical';
  if (g === 'selfsab') return 'psychological';
  if (g === 'toofast') return 'restraint';
  if (g === 'ontarget') return a.appetite === 'high' ? 'restraint' : 'none';
  return 'none';                      // never
}

// gainRisk: struggles to gain OR low appetite. Used to (a) push harder in 3b copy,
// (b) block the morning fast. NOT the same set as hardgainer.
function bulkGainRisk(a) {
  return ['hardgain', 'undereat', 'selfsab'].includes(a.gainExperience) || a.appetite === 'low';
}

// Which meal count is shown FIRST. Both the 3- and 4-meal plans always render and
// neither is tagged "recommended" on a bulk (it's genuinely hard to call which is
// better, and a label makes people cling to it). We just order them: a lifter who
// needs restraint (cautious) sees the 3-meal plan first — fewer, larger meals suit
// someone holding calories down — and everyone else sees the 4-meal plan first.
function bulkMealCount(a, code, bulkType) {
  return bulkType === 'cautious' ? 3 : 4;
}

// The bulk results page always shows a 3-meal and a 4-meal plan (mirroring the
// cut's 2/3). The recommended one comes from bulkMealCount; the alternative is the
// same structure run at the other count.
function selectBulkAlternative(a, primary) {
  const other = primary.mealCount === 4 ? 3 : 4;
  const label = `${other} meals`;
  const primaryLabel = `${primary.mealCount} meals`;
  const blurb = other === 3
    ? 'Three larger meals instead of four \u2014 simpler if you\'d rather eat bigger plates and go longer between meals.'
    : 'Four smaller meals instead of three \u2014 easier to hit your surplus without any single meal feeling huge.';
  return {
    structure: { ...primary, mealCount: other, notes: [blurb, ...(primary.notes || [])] },
    primaryLabel, label, blurb,
  };
}

function selectBulkStructure(a, code) {
  const notes = [];
  const surplus = Math.max(0, code.target - code.maintenance);
  const loadPerKg = surplus / Math.max(1, code.weight);
  const band = BULK_LOAD_KCAL_PER_KG.find((b) => loadPerKg <= b.maxLoad) || BULK_LOAD_KCAL_PER_KG[BULK_LOAD_KCAL_PER_KG.length - 1];
  const loadTier = band.tier;

  const bulkType = bulkTypeOf(a);
  const barrier = bulkBarrierOf(a);
  const gainRisk = bulkGainRisk(a);

  // MORNING MODE
  //  breakfast : real AM meal (3a)
  //  light_anchor : a light AM feeding (3b), or a FORCED feeding when 3c but no fast
  //  if : morning fast — ONLY when 3c AND Q1∈{ontarget,toofast} AND Q2≠low
  let morningMode, amPush = false;
  const fastAllowed = a.shape === 'skip'
    && ['ontarget', 'toofast'].includes(a.gainExperience)
    && a.appetite !== 'low';
  if (a.shape === 'breakfast') {
    morningMode = 'breakfast';
  } else if (a.shape === 'light') {
    morningMode = 'light_anchor';
    if (gainRisk) amPush = true;      // copy nudges him to eat a bit more in the AM
  } else { // skip
    if (fastAllowed) {
      morningMode = 'if';
    } else {
      morningMode = 'light_anchor';   // forced feeding despite his preference
      amPush = true;
    }
  }

  const mealCount = bulkMealCount(a, code, bulkType);

  // SNACKS (optional, ON TOP of the meal budget — never carved out). Cautious
  // lifters get none. Everyone else gets up to 2; how many actually appear is
  // decided by the timeline from qualifying meal gaps (a 3-meal day has two big
  // gaps → 2 snacks; a 4-meal day usually has one → 1). So this is a cap, not a
  // fixed count.
  const snackCount = bulkType === 'cautious' ? 0 : 2;

  // Pre-workout sizing: the "light stomach" answer BIASES the pre-gym meal smaller
  // when there's an adjacent feeding to offload onto. It's not a hard cap; the plan
  // may still hand him a big pre-gym meal if the day can't absorb it elsewhere.
  const preLight = a.preworkoutTolerance === 'light';

  if (bulkType === 'cautious') {
    notes.push('You gain fat easily, so even on a bulk we keep a little restraint — moderate-density meals, more volume, and no snacks piled on top.');
  } else if (bulkType === 'hardgainer') {
    notes.push('Gaining is a struggle for you, so we spread food across more meals, lean on easier-to-eat, higher-calorie foods, and add optional snacks to top up your surplus.');
  }

  const flags = {
    bulkType,
    barrier,
    gainRisk,
    amPush,
    amProtein: morningMode === 'light_anchor',
    shakePre: a.workout === 'before_first',
    preLight,
    snackCount,
    snacksOnTop: true,
    restriction: a.restriction || ['none'],
    irregular: ['travel', 'shifts', 'nights', 'erratic'].includes(a.schedule),
    workout: a.workout,
    daytime: a.daytime,
    evening: a.evening,
    dinner: a.dinner,
    loadPerKg: Math.round(loadPerKg * 10) / 10,
    surplus: Math.round(surplus),
  };

  return { morningMode, mealCount, loadTier, bulkType, barrier, flags, notes };
}

// =====================================================
// PER-MEAL MACRO + DENSITY COMPUTATION
// =====================================================

function distribute(total, weights) {
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  return weights.map((w) => (total * w) / sum);
}

function pickDensityBand(direction, slotPos, slotCount, tier, heightDiff) {
  const isFirst = slotPos === 0;
  const isLast = slotPos === slotCount - 1;
  let band;
  if (direction === 'cut') {
    if (isLast) band = DENSITY_BANDS.cut.dinner[tier];
    else if (isFirst) band = DENSITY_BANDS.cut.early;
    else band = DENSITY_BANDS.cut.mid;
    const lm = LEANNESS_DENSITY_MULT.find((x) => heightDiff <= x.maxHeightDiff) || { mult: 1 };
    return [band[0], Math.round(band[1] * lm.mult * 100) / 100];
  } else {
    if (isLast) band = DENSITY_BANDS.bulk.dinner[tier];
    else if (isFirst) band = DENSITY_BANDS.bulk.early[tier];
    else band = DENSITY_BANDS.bulk.mid[tier];
    return band;
  }
}

// Which meal index is the "post-workout meal" — derived from TRAIN TIME (which is
// in the MF1 payload), not the workout-category answer, so a decoded ID rebuilds
// the same plan. Morning training → first meal; evening (that fits) → last meal;
// evening that doesn't fit (big meal sits pre-gym) → none; between cutoffs → middle.
function postWorkoutMealIndex(timing, mealCount) {
  if (!timing || !timing.trains || !timing.train) return -1;
  const w = classifyWorkout(timing.wake, timing.sleep, timing.train, true);
  if (w.morning) return 0;
  if (w.evening) return w.fits ? mealCount - 1 : -1;
  return Math.min(1, mealCount - 1); // between meals → the meal after the first
}

function buildMealPlan(code, structure, timing = {}) {
  const { direction } = code;
  const tier = direction === 'cut' ? structure.backloadTier : structure.loadTier;
  const mealCount = structure.mealCount;
  const heightDiff = code.height - code.weight;

  let calVec = CALORIE_VECTORS[direction][mealCount][tier];
  // Breakfast mode (cut, 3-meal) uses the valley shape instead of the IF ascending one.
  if (direction === 'cut' && structure.morningMode === 'breakfast' && CUT_BREAKFAST_VECTORS[mealCount] && CUT_BREAKFAST_VECTORS[mealCount][tier]) {
    calVec = CUT_BREAKFAST_VECTORS[mealCount][tier];
  }
  // Big-meal-pre-gym plans (the "after my last meal" answer, or a not-night-hungry
  // lifter whose post-workout meal would land near bed): big pre-gym meal, light
  // post-gym. Overrides the morning-mode shape — the gym placement drives it.
  const preGymPlan = direction === 'cut'
    && timing && timing.trains && timing.train
    && computeMealSchedule(structure, { wake: timing.wake, sleep: timing.sleep, train: timing.train }).bigMealPreGym;
  if (preGymPlan && CUT_LATE_EVENING_VECTORS[mealCount]) {
    calVec = CUT_LATE_EVENING_VECTORS[mealCount];
  }

  // BULK vector selection (bulk-only; cut path above is untouched).
  //  - trains after last meal + can tolerate food -> small post-workout meal shape
  //  - light morning anchor (3b, or forced 3c) -> small AM feed + backloaded rest
  //  - otherwise the default mildly-backloaded even-day shape
  let bulkPostWorkout = false;
  if (direction === 'bulk') {
    const trainsAfterLast = structure.flags && structure.flags.workout === 'evening';
    if (trainsAfterLast && BULK_POST_WORKOUT_VECTORS[mealCount]) {
      calVec = BULK_POST_WORKOUT_VECTORS[mealCount];
      bulkPostWorkout = true;
    } else if (structure.morningMode === 'light_anchor' && BULK_ANCHOR_VECTORS[mealCount]) {
      calVec = BULK_ANCHOR_VECTORS[mealCount];
    }
  }
  const isCut = direction === 'cut';
  const pW = PROTEIN_WEIGHTS[direction][mealCount][tier];
  const fW = FAT_WEIGHTS[direction][mealCount][tier];
  const fibW = FIBER_WEIGHTS[direction][mealCount][tier];

  let kcalArr = calVec.map((p) => (code.target * p) / 100);

  // CUT: cap the last meal (never bank an unrealistic dinner), redistribute the
  // freed calories to the earlier meals. EXCEPTION: a pre-gym 2-meal plan's last
  // meal IS the big pre-workout meal (the post-gym feed is a shake), so it's exempt.
  const capLastMeal = isCut && mealCount >= 2 && !(preGymPlan && mealCount === 2);
  if (capLastMeal) {
    const pctCap = (LAST_MEAL_MAX_PCT[mealCount] ?? 0.5) * code.target;
    const absCap = tier === 'heavy' ? LAST_MEAL_MAX_KCAL_HEAVY : Infinity;
    const cap = Math.min(pctCap, absCap);
    const last = mealCount - 1;
    if (kcalArr[last] > cap) {
      const excess = kcalArr[last] - cap;
      kcalArr[last] = cap;
      const earlierSum = kcalArr.slice(0, last).reduce((s, x) => s + x, 0) || 1;
      for (let i = 0; i < last; i++) kcalArr[i] += excess * (kcalArr[i] / earlierSum);
    }
  }

  const fatArr = distribute(code.fat, fW);
  const fiberArr = distribute(code.fiber, fibW);

  let meals;
  if (isCut) {
    // Protein: EVEN across meals (no front-loading), floored at 20g. The per-meal
    // cap is a structure signal (handled in selectCutStructure/shake logic); here
    // an even split already avoids the protein "bombs".
    const evenP = code.protein / mealCount;
    const p = Array.from({ length: mealCount }, () => Math.max(PROTEIN_FLOOR_G, roundTo5g(evenP)));
    // Make the served protein total match the target (absorb 5g rounding on meal 1).
    const pDiff = roundTo5g(code.protein) - p.reduce((s, x) => s + x, 0);
    p[0] = Math.max(PROTEIN_FLOOR_G, p[0] + pDiff);
    // Fat: distributed by the (softened) weights, floored at 10g.
    const f = fatArr.map((x) => Math.max(FAT_FLOOR_G, roundTo5g(x)));
    // Carbs: the remainder, floored at 25g so no meal is supplement-only.
    let c = kcalArr.map((kc, i) => Math.max(CARB_FLOOR_G, roundTo5g((kc - p[i] * 4 - f[i] * 9) / 4)));

    // RECONCILE carbs so the day hits its CALORIE target (carbs are the remainder
    // after protein + fat). Flooring small early meals up adds carbs; pull the
    // surplus off the largest meal. Keeps totals on target and the dinner biggest.
    const carbTarget = Math.max(0, Math.round((code.target - p.reduce((s, x) => s + x, 0) * 4 - f.reduce((s, x) => s + x, 0) * 9) / 4));
    const carbTotal = () => c.reduce((s, x) => s + x, 0);
    let guard = 0;
    while (carbTotal() - carbTarget >= 5 && guard++ < 200) {
      let big = 0;
      for (let i = 1; i < mealCount; i++) if (c[i] > c[big]) big = i;
      if (c[big] <= CARB_FLOOR_G) break;
      c[big] -= 5;
    }
    guard = 0;
    while (carbTarget - carbTotal() >= 5 && guard++ < 200) c[mealCount - 1] += 5;

    meals = p.map((pp, i) => {
      const kc = roundToNearest50(pp * 4 + f[i] * 9 + c[i] * 4);
      return {
        index: i,
        kcal: kc,
        protein: pp, fat: f[i], carbs: c[i], fiber: roundTo5g(fiberArr[i]),
        densityBand: pickDensityBand(direction, i, mealCount, tier, heightDiff),
        pctOfDay: Math.round((kc / code.target) * 100),
        isShake: false,
      };
    });
  } else {
    // BULK v1. Meals sum to 100% of target (snacks are optional, on top). Enforce
    // the 1200 kcal per-meal ceiling by pushing overflow onto the meals with the
    // most headroom, then split macros: protein EVEN to target (20g floor), fat by
    // weights, carbs the remainder. A small post-workout meal keeps a low floor.

    // 1200-cap redistribution on the kcal vector.
    let kc = kcalArr.slice();
    const capPass = () => {
      let overflow = 0;
      for (let i = 0; i < kc.length; i++) {
        if (kc[i] > BULK_MEAL_KCAL_CAP) { overflow += kc[i] - BULK_MEAL_KCAL_CAP; kc[i] = BULK_MEAL_KCAL_CAP; }
      }
      if (overflow <= 0) return false;
      // pour overflow into meals with remaining headroom, proportional to headroom
      const head = kc.map((x) => Math.max(0, BULK_MEAL_KCAL_CAP - x));
      const headSum = head.reduce((s, x) => s + x, 0);
      if (headSum <= 0) return false;                 // every meal capped; overflow is lost to snacks
      for (let i = 0; i < kc.length; i++) kc[i] += overflow * (head[i] / headSum);
      return true;
    };
    let guardC = 0; while (capPass() && guardC++ < 10) { /* re-pour until stable */ }

    // Protein: EVEN across real meals, floored at 20g, summed to target.
    const evenP = code.protein / mealCount;
    const pArr = Array.from({ length: mealCount }, () => Math.max(PROTEIN_FLOOR_G, roundTo5g(evenP)));
    const pDiff = roundTo5g(code.protein) - pArr.reduce((s, x) => s + x, 0);
    // put the rounding remainder on the largest meal (keeps small post-wo meal at floor)
    let bigIdx = 0; for (let i = 1; i < mealCount; i++) if (kc[i] > kc[bigIdx]) bigIdx = i;
    pArr[bigIdx] = Math.max(PROTEIN_FLOOR_G, pArr[bigIdx] + pDiff);

    const fArr = fatArr.map((x) => Math.max(FAT_FLOOR_G, roundTo5g(x)));
    let cArr = kc.map((k, i) => Math.max(0, roundTo5g((k - pArr[i] * 4 - fArr[i] * 9) / 4)));

    // Reconcile carbs so the day hits the CALORIE target (carbs are the remainder).
    const carbTarget = Math.max(0, Math.round((code.target - pArr.reduce((s, x) => s + x, 0) * 4 - fArr.reduce((s, x) => s + x, 0) * 9) / 4));
    const carbTotal = () => cArr.reduce((s, x) => s + x, 0);
    let g2 = 0;
    while (carbTotal() - carbTarget >= 5 && g2++ < 300) {
      let b = 0; for (let i = 1; i < mealCount; i++) if (cArr[i] > cArr[b]) b = i;
      if (cArr[b] <= 0) break; cArr[b] -= 5;
    }
    g2 = 0;
    while (carbTarget - carbTotal() >= 5 && g2++ < 300) {
      // add to the meal furthest below the cap so we don't blow the ceiling
      let b = 0; for (let i = 1; i < mealCount; i++) {
        const ki = pArr[i] * 4 + fArr[i] * 9 + cArr[i] * 4;
        const kb = pArr[b] * 4 + fArr[b] * 9 + cArr[b] * 4;
        if (ki < kb) b = i;
      }
      cArr[b] += 5;
    }

    meals = pArr.map((pp, i) => {
      const mkcal = roundToNearest50(pp * 4 + fArr[i] * 9 + cArr[i] * 4);
      return {
        index: i,
        kcal: mkcal,
        protein: pp, fat: fArr[i], carbs: cArr[i], fiber: roundTo5g(fiberArr[i]),
        densityBand: pickDensityBand(direction, i, mealCount, tier, heightDiff),
        pctOfDay: Math.round((mkcal / code.target) * 100),
        isShake: false,
        smallPostWorkout: bulkPostWorkout && i === mealCount - 1,
      };
    });
  }

  // SHAKE SLOT — a single budgeted feeding, deducted from a real meal so the day
  // still sums to target. For a cut, existence + kind come from the REAL gaps around
  // the workout (decideCutShake); for a bulk, it's the AM protein-floor feeding.
  const fl = structure.flags || {};

  let shakeKind = null, deductIdx = 0, optional = false;
  if (direction === 'bulk') {
    // v1: the ONLY bulk shake is an OPTIONAL pre-workout shake for a fasted (trains
    // before first meal) session, so he gets protein/timing without a forced meal
    // he doesn't want. It sits ON TOP (optional), never carved from a meal. The
    // light-anchor morning feeding is a REAL small meal (vector slot 0), not a shake.
    // Fire the shake only for GENUINELY fasted training — a morning fast (IF mode)
    // with the session landing in that fasted window, or the explicit "I train
    // before my first meal" answer. A lifter who eats a light morning meal and then
    // trains (light_anchor) is NOT fasted; a shake stacked next to that meal is
    // redundant, so he gets none.
    const isIf = structure.morningMode === 'if' || structure.morningMode === 'fasted';
    const w = (timing && timing.trains && timing.train != null)
      ? classifyWorkout(timing.wake, timing.sleep, timing.train, true) : null;
    const fastedMorning = (w && w.morning && isIf) || fl.shakePre;
    if (fastedMorning) { shakeKind = 'pre'; optional = true; }
  } else {
    const decision = decideCutShake(structure, timing);
    if (decision) { shakeKind = decision.shakeKind; deductIdx = decision.deductIdx; optional = decision.optional; }
  }

  if (shakeKind && meals.length) {
    // Cut shake is a consistent one-scoop drink (30P / 5C). Bulk v1 shake is the
    // same standard drink — an OPTIONAL pre-workout feed for fasted trainers, on
    // top of the day (never carved from a meal).
    const isBulk = direction === 'bulk';
    const sp = roundTo5g(SHAKE_PROTEIN_G);
    const shakeC = SHAKE_CARB_G;
    const shake = {
      index: -1,
      kcal: roundToNearest50(sp * 4 + shakeC * 4),
      protein: sp, fat: 0, carbs: shakeC, fiber: 0,
      densityBand: null,
      isShake: true,
      shakeKind,
      optional,
    };
    // How the shake's macros relate to the meals:
    //  - OPTIONAL shake (e.g. a pre-workout drink for a fasted session): do NOT carve
    //    it out of any meal. A client who skips it must still hit full protein, and a
    //    single carved meal (e.g. 350 kcal / 15g) is too low-protein for any real meal
    //    to match. The meals keep their full protein as if the shake weren't taken; the
    //    optional shake sits on top for whoever wants it.
    //  - BUDGETED shake (post-workout feed, morning anchor): it IS part of the day, so
    //    spread its protein/carbs deduction EVENLY across every meal rather than carving
    //    it out of one (which starves that meal), keeping the day on target.
    if (!optional) {
      const nReal = meals.length;
      meals.forEach((m) => {
        m.protein = Math.max(PROTEIN_FLOOR_G, roundTo5g(m.protein - shake.protein / nReal));
        m.carbs = Math.max(0, roundTo5g(m.carbs - shake.carbs / nReal));
        m.kcal = roundToNearest50(m.protein * 4 + m.fat * 9 + m.carbs * 4);
      });
      // Per-meal 50-kcal rounding (and the shake's tiny carb spreading to ~nothing)
      // can leave the day off target; close the gap on the largest meal's carbs so
      // meals + shake still sum to target.
      const want = code.target - shake.kcal;
      const sumK = () => meals.reduce((s, m) => s + m.kcal, 0);
      const biggest = () => { let b = 0; for (let i = 1; i < meals.length; i++) if (meals[i].kcal > meals[b].kcal) b = i; return b; };
      let guard = 0;
      while (sumK() - want >= 50 && guard++ < 50) { const b = biggest(); if (meals[b].carbs < 5) break; meals[b].carbs = roundTo5g(meals[b].carbs - 5); meals[b].kcal = roundToNearest50(meals[b].protein * 4 + meals[b].fat * 9 + meals[b].carbs * 4); }
      while (want - sumK() >= 50 && guard++ < 50) { const b = biggest(); meals[b].carbs = roundTo5g(meals[b].carbs + 5); meals[b].kcal = roundToNearest50(meals[b].protein * 4 + meals[b].fat * 9 + meals[b].carbs * 4); }
    }
    if (shakeKind === 'post') meals.push(shake);
    else meals.unshift(shake);
  }

  // 2-MEAL EVEN PASS (cut only). A 2-meal day should read as two similar meals, not
  // a small one + a big one. The shake (if any) has already been carved out of one
  // meal — here we pool the two real meals' served macros and re-split them evenly,
  // so protein/carbs/fat/fiber/kcal all match across the two. This both closes the
  // shake's protein gap (e.g. 85/55 → 70/70 + the 30g shake) and flattens the carb
  // front-loading that the heavy tier (eat-out / no-daytime) otherwise produces.
  // EXEMPT: the pre-gym 2-meal ("after my last meal" / late not-night-hungry), whose
  // larger pre-gym meal is intentional.
  if (isCut && mealCount === 2 && !preGymPlan) {
    const reals = meals.filter((m) => !m.isShake);
    if (reals.length === 2) {
      // Split each macro into two ~equal halves. When a total isn't an even multiple
      // of 10, the spare 5g goes to whichever meal is currently lighter (by running
      // kcal), so the leftovers offset each other instead of piling onto one meal.
      let k0 = 0, k1 = 0;
      const split = (tot, floor, kcalPerG) => {
        let lo = Math.max(floor, roundTo5g(tot / 2));
        let hi = tot - lo;
        if (hi < lo) { const t = lo; lo = hi; hi = t; }     // hi is the larger half
        if (lo < floor) { lo = floor; hi = Math.max(floor, tot - floor); }
        let a, b;
        if (k0 <= k1) { a = hi; b = lo; } else { a = lo; b = hi; } // larger half → lighter meal
        k0 += a * kcalPerG; k1 += b * kcalPerG;
        return [a, b];
      };
      const [p0, p1] = split(reals[0].protein + reals[1].protein, PROTEIN_FLOOR_G, 4);
      const [c0, c1] = split(reals[0].carbs + reals[1].carbs, CARB_FLOOR_G, 4);
      const [f0, f1] = split(reals[0].fat + reals[1].fat, FAT_FLOOR_G, 9);
      const [fb0, fb1] = split(reals[0].fiber + reals[1].fiber, 0, 0);
      const apply = (m, p, c, f, fib) => {
        m.protein = p; m.carbs = c; m.fat = f; m.fiber = fib;
        m.kcal = roundToNearest50(p * 4 + f * 9 + c * 4);
        m.pctOfDay = Math.round((m.kcal / code.target) * 100);
      };
      apply(reals[0], p0, c0, f0, fb0);
      apply(reals[1], p1, c1, f1, fb1);
    }
  }

  // BULK SNACKS — optional, ON TOP of the meal budget (never carved out). ~10% of
  // target each, near-zero protein, balanced fat/carb. Count comes from bulkType
  // (hardgainer 2, balanced 1, cautious 0). Placement is decided in buildDayEvents
  // (equidistant between meals). Returned separately so meals still sum to target.
  let snacks = [];
  if (direction === 'bulk') {
    const n = (structure.flags && structure.flags.snackCount) || 0;
    if (n > 0) {
      const snackKcal = roundToNearest50(code.target * 0.10);
      const snackFat = roundTo5g((snackKcal * 0.4) / 9);      // ~40% kcal from fat
      const snackCarb = Math.max(0, roundTo5g((snackKcal - snackFat * 9) / 4));
      for (let i = 0; i < n; i++) {
        snacks.push({
          index: -10 - i,
          kcal: roundToNearest50(snackFat * 9 + snackCarb * 4),
          protein: 0, fat: snackFat, carbs: snackCarb, fiber: 0,
          isSnack: true, optional: true,
        });
      }
    }
  }

  return { meals, snacks, tier, mealCount };
}

// =====================================================
// WORKOUT TIMING CLASSIFIER (shared by the timeline + the results notes)
// =====================================================

function classifyWorkout(wake, sleep, train, trains) {
  if (!trains || !train) return { trains: false, morning: false, evening: false, fits: false };
  const cont = (t) => (t < wake ? t + 1440 : t);
  const sleepC = cont(sleep);
  const trainC = cont(train);
  const morning = train <= MORNING_TRAIN_CUTOFF;
  const evening = train >= EVENING_TRAIN_CUTOFF;
  let fits = false;
  if (evening) fits = (trainC + POST_WORKOUT_MEAL_DELAY) <= sleepC - MIN_LAST_MEAL_GAP;
  return { trains: true, morning, evening, fits, sleepC, trainC, cont };
}

// =====================================================
// MF1 TEMPLATE ID  (self-contained; pasting it rebuilds the page)
//   PREFIX:  <C|B>-<morning>-<tier>-<kcal>-<meals>
//     morning (cut): IF (intermittent fast) | EF (early feeding)
//     morning (bulk): EV (even) | LA (light anchor)   [FA legacy decode only]
//     tier (cut): LT|MO|HV  ·  tier (bulk): LO|MD|HI
//   SUFFIX:  P|F|C|fiber|wake|sleep|train|dessert|alcohol|shakePre|shakeAnchor|hungryPost|restrictionCSV
//   (cravings-snack flag is a Stage 3 payload extension — not yet added)
// =====================================================

const MF_SCHEMA_PREFIX = 'MF1';
const MORNING_CODE = { if: 'IF', breakfast: 'BF', early_feed: 'EF', even: 'EV', light_anchor: 'LA', fasted: 'FA' };
const MORNING_DECODE = { IF: 'if', BF: 'breakfast', EF: 'early_feed', EV: 'even', LA: 'light_anchor', FA: 'fasted' };
const CUT_TIER_CODE = { light: 'LT', moderate: 'MO', heavy: 'HV' };
const BULK_TIER_CODE = { low: 'LO', mid: 'MD', high: 'HI' };
const TIER_DECODE = { LT: 'light', MO: 'moderate', HV: 'heavy', LO: 'low', MD: 'mid', HI: 'high' };

function encodeAnswers(answers) {
  if (!answers) return '';
  return Object.keys(answers)
    .filter((k) => k !== 'restriction' && answers[k] != null && answers[k] !== '')
    .sort()
    .map((k) => `${k}:${answers[k]}`)
    .join(';');
}

function decodeAnswers(s) {
  if (!s) return null;
  const obj = {};
  s.split(';').forEach((pair) => {
    const i = pair.indexOf(':');
    if (i > 0) obj[pair.slice(0, i)] = pair.slice(i + 1);
  });
  return Object.keys(obj).length ? obj : null;
}

function buildTemplateId(code, structure, personalization, answers) {
  const dir = code.direction === 'cut' ? 'C' : 'B';
  const tier = code.direction === 'cut' ? structure.backloadTier : structure.loadTier;
  const tierCode = code.direction === 'cut' ? CUT_TIER_CODE[tier] : BULK_TIER_CODE[tier];
  const prefix = `${dir}-${MORNING_CODE[structure.morningMode]}-${tierCode}-${code.target}-${structure.mealCount}`;

  const p = personalization;
  const suffixFields = [
    code.protein, code.fat, code.carbs, code.fiber,
    p.wake, p.sleep, p.train,
    p.dessert ? 1 : 0,
    p.alcohol ? 1 : 0,
    p.shakePre ? 1 : 0,
    p.shakeAnchor ? 1 : 0,
    p.hungryPostWorkout ? 1 : 0,
    (structure.flags.restriction || ['none']).join('.'),
    encodeAnswers(answers),                 // NEW field 13
  ];
  const payload = suffixFields.join('|');
  const enc = base64urlEncode(payload);
  const ck = checksum2(`${prefix}|${payload}`);
  return `${MF_SCHEMA_PREFIX}-${prefix}-${enc}-${ck}`;
}

// Unchanged from the original EXCEPT the two lines reading field 13 (answers).

function decodeTemplateId(raw) {
  if (!raw || !raw.trim()) return { ok: false, error: 'empty' };
  const s = raw.trim();
  if (!s.startsWith(MF_SCHEMA_PREFIX + '-')) {
    if (/^(SS|MM)\d+-/i.test(s)) return { ok: false, error: 'wrongcode' };
    return { ok: false, error: 'format' };
  }
  const parts = s.split('-');
  if (parts.length !== 8) return { ok: false, error: 'format' };
  const [, dir, morn, tierCode, kcalStr, mealsStr, enc, ck] = parts;
  let payload;
  try { payload = base64urlDecode(enc); } catch { return { ok: false, error: 'corrupt' }; }
  const prefix = `${dir}-${morn}-${tierCode}-${kcalStr}-${mealsStr}`;
  if (checksum2(`${prefix}|${payload}`) !== ck) return { ok: false, error: 'checksum' };

  const f = payload.split('|');
  if (f.length < 13) return { ok: false, error: 'fields' };
  const direction = dir === 'C' ? 'cut' : 'bulk';
  const morningMode = MORNING_DECODE[morn];
  const tier = TIER_DECODE[tierCode];
  if (!morningMode || !tier) return { ok: false, error: 'fields' };

  const code = {
    direction,
    target: parseInt(kcalStr, 10),
    protein: parseInt(f[0], 10),
    fat: parseInt(f[1], 10),
    carbs: parseInt(f[2], 10),
    fiber: parseInt(f[3], 10),
    weight: 0, height: 0, maintenance: 0,
  };
  const mealCount = parseInt(mealsStr, 10);
  const structure = {
    morningMode, mealCount,
    backloadTier: direction === 'cut' ? tier : undefined,
    loadTier: direction === 'bulk' ? tier : undefined,
    flags: { restriction: (f[12] || 'none').split('.') },
  };
  const personalization = {
    wake: parseInt(f[4], 10), sleep: parseInt(f[5], 10), train: parseInt(f[6], 10),
    dessert: f[7] === '1', alcohol: f[8] === '1',
    shakePre: f[9] === '1', shakeAnchor: f[10] === '1',
    hungryPostWorkout: f[11] === '1',
  };
  const answers = decodeAnswers(f[13]);                 // NEW: null when field absent/empty
  if (isNaN(code.target) || isNaN(mealCount)) return { ok: false, error: 'fields' };
  return { ok: true, data: { code, structure, personalization, answers } };
}

// =====================================================
// GENERATED PROSE  (tagged bank → assembled by flags; the coaching voice)
// =====================================================

function buildDescription(code, structure, p) {
  const lines = [];
  const isCut = code.direction === 'cut';
  const mm = structure.morningMode;

  // Opening — morning
  if (mm === 'if' || mm === 'fasted') {
    lines.push(`Wake around ${minutesToClock(p.wake)}. Skip breakfast — water and 1–3 cups of black coffee carry you through the morning fast and blunt hunger until your first meal.`);
  } else if (mm === 'breakfast') {
    lines.push(`Wake around ${minutesToClock(p.wake)} and eat a real breakfast — protein- and fiber-forward (eggs, Greek yogurt, oats, fruit, vegetables). You're hungry in the morning, so we feed it; the day stays balanced, with a little more saved for the evening.`);
  } else if (mm === 'light_anchor') {
    lines.push(`Wake around ${minutesToClock(p.wake)}. Start with a small, high-protein, low-calorie first feeding — a protein shake/smoothie, lean meat and veg, or low-fat cheese and fruit. Keep it modest so most of your budget is saved for later.`);
  } else {
    lines.push(`Wake around ${minutesToClock(p.wake)} and eat a real breakfast — protein and fiber forward — then keep meals fairly even across the day.`);
  }

  if (p.shakePre) {
    lines.push('You train before your first meal, so have a protein shake before lifting to keep amino acids available until you eat.');
  }

  // Middle — the structure
  if (isCut) {
    if (structure.backloadTier === 'heavy') {
      lines.push('Front-load your protein and fiber in the earlier meals — lean protein and vegetables, low calorie density, very filling. Save the largest, most flexible calorie budget for dinner, where you can eat what\'s served (family meals, social dinners) without blowing the deficit.');
    } else if (structure.backloadTier === 'moderate') {
      lines.push('Keep your earlier meals protein- and fiber-forward with low calorie density. Your dinner is the largest meal — enough budget to feel satisfied while staying in the deficit.');
    } else {
      lines.push('Keep your meals high in protein and fiber and low in calorie density — lean protein, vegetables, and lower-density carbs like potatoes or rice. Your meals are fairly balanced, with a little more food later in the day (or around your workout if you train hungry).');
    }
  } else {
    if (structure.loadTier === 'high') {
      lines.push('Spread your food across more meals and lean on higher-calorie, easy-to-eat foods. Add snacks between meals (nuts, trail mix, protein bars, dried fruit) and don\'t over-fill on vegetables — you need room for calories.');
    } else if (structure.loadTier === 'mid') {
      lines.push('Eat evenly across your meals with a moderate calorie density. Keep protein in every meal and add calories where it\'s easy.');
    } else {
      lines.push('Approach this bulk much like a cut: a moderate number of balanced meals, lower calorie density, protein in each. Your surplus is small, so a little restraint keeps the bulk lean.');
    }
  }

  if (p.train && structure.flags?.workout !== 'none') {
    lines.push(`Train around ${minutesToClock(p.train)}. Aim to have your workout sit between two protein feedings no more than ~6 hours apart.`);
  }

  if (p.dessert) {
    lines.push('For sweets: buy them in single-serving packages (one chocolate bar, one ice cream cone, one cookie) and eat the whole package — never open a big bag and try to stop. The package is your portion control.');
  }

  if (p.alcohol && isCut) {
    lines.push('On a day you drink, bank the calories by cutting some carbs and fat earlier so 1–2 drinks fit your budget. Favor lower-calorie options (spirits with zero-cal mixers).');
  }

  if (isCut) {
    lines.push(`Don\'t snack between meals — when you eat, eat a full meal. End your eating by around ${minutesToClock(p.sleep - 60)} and take only water until your first meal tomorrow. Once a week, schedule a maintenance/refeed day on a social occasion.`);
  } else {
    lines.push('Keep protein in every meal and stay consistent. If the scale stalls for a few weeks, add calories before adding stress.');
  }

  return lines;
}

const CUT_COPY = {
  q1: {
    easy: `You naturally skip breakfast, so you'll use that to your advantage. Your first meal lands four to six hours after waking, around {firstMeal}. This is intermittent fasting and it is a powerful fat loss tool because it makes staying in a calorie deficit far easier. Many of the most impressive ShredSmart transformations were made possible thanks to intermittent fasting. A short morning fast blunts appetite and saves calories for later in the day, where they satisfy genuine hunger and allow flexibility for social meals. Until your first meal, drink water, black coffee, and zero-calorie drinks. Water blunts hunger, so drink it on purpose rather than waiting to feel thirsty. Fasting suppresses thirst, and you want to deliberately drink at least a liter (0.3 gallons) before you eat. Black coffee is a strong appetite suppressant. If caffeine does not affect your sleep, one to three cups across the morning, spaced a few hours apart, makes the fast effortless. Diet soda and zero-calorie energy drinks work just as well.`,
    ok: `You can go without breakfast, so we skip it and push your first meal three to five hours after you wake, around {firstMeal}. This is intermittent fasting and it is a powerful fat loss tool because it makes staying in a calorie deficit far easier. Many of the most impressive ShredSmart transformations were made possible thanks to intermittent fasting. A short morning fast blunts appetite and saves calories for later in the day, where they satisfy genuine hunger and allow flexibility for social meals. Until your first meal, drink water, black coffee, and zero-calorie drinks. Water blunts hunger, so drink it on purpose rather than waiting to feel thirsty. Fasting suppresses thirst, and you want to deliberately drink at least a liter (0.3 gallons) before you eat. Black coffee is a strong appetite suppressant. If caffeine does not affect your sleep, one to three cups across the morning, spaced a few hours apart, makes the fast effortless. Diet soda and zero-calorie energy drinks work just as well.`,
    hard: `You're hungry in the morning, so you eat early. The key constraint is that this can't be a typical breakfast built on carbs and fat (pancakes, eggs and bacon, peanut-butter toast, or cereal). Your first meal must include protein and fiber, the two most filling nutrients you can eat. This allows you to reach satiety on fewer calories and save a larger calorie budget for later in the day. Moreover, meeting your total daily protein target requires multiple feedings throughout the day, otherwise you'll end up needing massive protein portions later. So the recipe for your morning meal is: lean protein and high-volume, fibrous food, low on fat and carbs. The meal examples show you exactly what that looks like.`,
  },
  q3: {
    cook: `You prepare and bring your own daytime meals, which is ideal for precise portions, ingredients, and tracking. That matters, because the hard part of eating away from home is finding food that is high in protein, low in calories, and still filling enough to work on a cut. Bringing your own meal in containers removes the problem. Build these meals from a lean protein source and mostly vegetables or fruit (limit carbs and fat). The best strategy is to settle on a handful of meals you enjoy and repeat them consistently. By standardizing a few favorite meals and repeating them, you eliminate daily food decisions, buy ingredients in bulk, and train your hunger signals to adjust to stable portions. Store them in your office fridge or bag (a few hours unrefrigerated will not spoil them). The meal examples give you options to start from.`,
    eatout: `Buying your daytime meals (ordering or takeout) makes hitting high protein on low calories challenging, but it's doable with the right food choices. Order lean meat and vegetables, such as a large salad with a double portion of grilled meat or a burrito bowl with double meat, beans, and low-fat sauce. Realistically, your choices are limited. Most quick restaurant meals (sandwiches, pizza, pasta, or even standard meat-and-rice portions) overshoot your calorie target for daytime meals. Scan local menus in advance, find the few meals that actually fit your protein and calorie budget, and stick with those in rotation. Alternatively, there are catering services designed specifically for fitness enthusiasts that deliver meals built to your calorie and macro targets. This is a simple way to get "meal prepped nutrition" without cooking. That said, you should still consider prepping and bringing your own meals. You'll have full control over portions and ingredients and spend far less money on food.`,
    none: [
      `You're busy, and eating during the day is a struggle. There's no real lunch slot, so you either skip it or grab something quick: a sandwich, a pretzel, or something from a vending machine. On ShredSmart, that backfires twice. Skipping meals makes it almost impossible to hit your protein target, and fast-food is high in calories and low in protein. The solution is to pack your own high protein food that is easy to carry with you and can be consumed quickly. You have two options:`,
      `1. Cook and bring your own meals in containers: Build these meals from a lean protein source and mostly vegetables or fruit (limit carbs and fat). The best strategy is to settle on a handful of meals you enjoy and repeat them consistently. By standardizing a few favorite meals and repeating them, you eliminate daily food decisions, buy ingredients in bulk, and train your hunger signals to adjust to stable portions. Store them in your office fridge or bag (a few hours unrefrigerated will not spoil them). The meal examples give you a set to start from.`,
      `2. Rely on liquid meal replacements: protein smoothies made ahead in a sealed bottle, or single-serve meal replacement products.`,
      `The meal examples show you options you can pack.`,
    ],
    wfh: `Working from home allows you to prep your meals in advance or cook fresh while weighing everything precisely and maintaining full control over the ingredients. The best strategy is to settle on a handful of meals you enjoy and repeat them consistently. Standardizing a few favorite meals allows you to eliminate daily food decisions, stock the ingredients in bulk, and train your hunger signals to adjust to stable portions. Build your meals on lean protein and veggies. This way you can hit protein, eat a large volume, and stay within the calorie budget. The meal examples provide a starting framework.`,
  },
  q4: {
    control: `You control your dinner, which is the ideal situation. You choose the ingredients, set the portion, and weigh exactly what you eat. The best strategy is to settle on a few dinner options that you enjoy and eat those daily, in rotation. However, dinner is also your chance to include the foods you crave and add variety. If your earlier meals are more standardized, dinner is where you can loosen the structure and enjoy some flexibility while still staying on target.`,
    family: [
      `You eat dinner cooked by someone else, together with family or a partner. This is something to include into your plan, not avoid. Social eating is deeply human. While eating alone might make it easier to stay strict on your cut, it can also create social alienation, friction within the family, even resentment or tension at home. We don't want that. So we build your day around that shared dinner. Your earlier meals are higher in protein and lower in calories, which saves a large part of your daily calories (up to half) for the evening. We also deliberately program that dinner with less protein and more carbs and fat, because that's what's usually served, so it can fit a normal family dinner in normal portions.`,
      `If the food served fits your calories but doesn't fill you up, the solution is to add food, not remove it. Reduce what's served a little bit and add a portion of plain protein on the side (extra chicken, a scoop of cottage cheese, a block of tofu) and a plate of vegetables or mushrooms. Adding food is much easier to justify socially than refusing it, and it lowers the calorie density of the meal, adds volume, and leaves you full.`,
      `Getting the people you live with to actively support your cut is its own conversation, and it makes a big difference. See the Q&A.`,
    ],
    social: [
      `You eat dinner out often, which makes hitting protein and staying within your calorie budget harder, but it's doable. There are two strategies. First, backloading: keep your earlier meals small and high in protein so you arrive at dinner with a large calorie budget, around 1000 calories. That covers most of a normal restaurant meal (a portion of pasta, a burger and fries, meat and potatoes) with some moderation. Second, order well. The best choice is lean meat with a side of potatoes or vegetables, which gives you high protein on controlled calories. But with a 1000-calorie budget, most options fit. Check the menu online before you go and decide in advance what you'll order.`,
      `A useful side effect is that you never have to tell anyone you're cutting. Once you've decided what fits, you order it with a glass of water and nobody asks questions. If you mention you're cutting, suddenly the spotlight is on you and people start asking questions. With this strategy, you can cut without anyone noticing. (How to estimate and log a restaurant meal you didn't cook is in the Q&A.)`,
    ],
    varies: `Your dinner changes a lot from week to week, so we use it as the flexible part of your day instead of fighting it. Lock in your earlier meals (enough protein, controlled calories) and save a large budget, around 1000 calories, for the evening. That cushion covers almost any unexpected meal or food choice. In the long run, work toward a more predictable pattern, because the best transformations come from people who find one system and repeat it with little variation. If you want help building that structure, post in the community.`,
  },
  q5: {
    fastedCalm: `You train before your first meal, and training fasted is completely fine. Almost all of your results come from three things: staying in the deficit, progressing in the gym, and hitting your daily protein. Get those right and meal timing barely matters. There is a small, optional benefit to having a protein shake before you lift, because amino acids in your blood during and after training slightly help muscle growth/retention. So if you want to optimize, have a shake before training, then eat normally at your first meal. If you'd rather train fasted, do that. The difference is small. (Why timing matters so little is in the Q&A.)`,
    fastedRavenous: `You train before your first meal and you get hungry afterward, which makes the wait until you eat harder than it needs to be. The fix is a protein shake right after training. It bridges the gap to your first meal so you have something to digest, it's slightly better for muscle growth/retention, and it takes the edge off the hunger. After the shake, water and a cup or two of black coffee carry you to your first meal easily. You train fasted because it's the better trade for you: saving more food for the second half of the day makes the cut much easier to stick to, and that's worth more than the small cost of training fasted.`,
    betweenNormal: `Your workout falls between two meals, which is the ideal setup. You have amino acids and glucose in your blood during the session to fuel it and support protein synthesis afterward.`,
    lateHungry: `You train late and you're hungriest at night, after your workout, so your biggest meal goes there. This covers two things at once: your appetite after training and your natural tendency to eat more at night. It's also easier to stay disciplined earlier in the day when you know a big meal is waiting at the end. The opposite, eating most of your food by 5 or 6 PM and then staring at a nearly empty budget all evening, is what makes people go over the calorie target.`,
    lateNotHungry: `You train late, so your biggest meal goes after work and before the gym. That's your flexible, eat-what-you-want meal, and placing it there means you're not eating a large meal right before sleep. After training, you still have a light protein meal. It helps recovery, and it closes out the day: going to bed right after a workout with nothing in you usually ends in snacking, so we schedule the meal instead of leaving it to chance.`,
    afterLast: `You train after what you'd think of as your last meal, so we keep your big meal before the session and a light one after. The big meal goes first for two reasons: a large meal right before sleep interferes with your sleep, and going the whole day without a real meal leaves you low on energy and ravenous by the evening. So you eat your main meal, then train. The light meal afterward isn't just padding: it helps protein synthesis, and it stops the day ending on an empty stomach, which is what leads to late-night snacking. We schedule it on purpose.`,
  },
  q7: {
    wrecked: [
      `Feeling deprived of the foods you love is one of the most common reasons a cut falls apart, and it doesn't have to happen. You can keep a daily treat. The trick isn't willpower, it's controlling your food environment. If cravings have wrecked your cuts before, it usually came down to a few things: keeping trigger foods in the house, buying them in large packages, and leaving them in sight. Fix the environment and most of the willpower problem disappears.`,
      `Buy only the amount you'll eat in one sitting, in single-serving packaging, 200 to 400 calories, and let the empty package be your signal that eating is done. Opening a second package feels different from taking more out of an open container, and that difference is what keeps the portion in check. Keep anything ready-to-eat out of sight, behind other things, hard to reach. A small obstacle between your hand and the food is often enough.`,
      `Then give the treat a fixed spot in your day and eat it there every day, whether you feel like it or not. Removing the variability is what kills the sense of deprivation, because once the treat arrives on schedule you stop negotiating with yourself about it. Time it where the craving usually hits: mid-afternoon if that's your boredom window, or after dinner if that's when you tend to slip, taking those calories from dinner to make room. One planned treat, same spot, every day.`,
    ],
    manage: [
      `You can fit any food into your diet without hurting your results, as long as you stay in your calorie budget and hit your protein. For fat loss specifically, the source of a calorie barely matters. But that's permission, not a plan: it means you can include the foods you crave, not that they should make up your diet. Keep 80 to 90% of your intake low-to-medium calorie density (vegetables, lean protein, little fat), because that's what controls hunger, performance, and adherence. Spend the rest on what you want.`,
      `When a craving won't fit alongside your protein, you have two options: pick a higher-protein version of it, or raise the protein in your other meals to compensate. Want pizza for your third meal? Make your second meal a protein smoothie (two scoops, soy milk, a banana, around 60g of protein) and the day still balances out. The same trick saves room for a night out: shrink your earlier meals, or swap dinner for a shake, and free up 500 to 1000 calories for drinks, popcorn, or a restaurant. It's worth doing a few times a week, but not something to lean on daily.`,
    ],
    none: `Cravings aren't a problem for you, which is a real advantage on a cut. Not being triggered by the sight and smell of food makes everything easier. If you do want something tastier on a given day, you can: fit it into your budget, and if it's low in protein, either choose a higher-protein version or raise the protein in your other meals to compensate. The same approach frees up calories for a night out, by shrinking your earlier meals or swapping dinner for a shake. Just keep most of your food high-volume and protein-led. The treat is the exception, not the foundation.`,
  },
  q8: {
    rare: `You drink occasionally, which is fine. Alcohol won't stop fat loss as long as you stay in your deficit. But it does have a real cost: alcohol is the first fuel your body burns, so it pauses fat and carb burning while it's processed, and any dietary fat you eat alongside it gets stored (if you overeat and end up in a surplus). So the strategy is to make room for alcohol. On a day you're going to drink, run your earlier meals higher in protein and fiber and lower in carbs and fat, and save a few hundred calories. Choose your drinks by calorie cost: the sweeter the drink, the more it costs, so spirits with a zero-calorie mixer go the furthest, while beer, wine, and cocktails are fine if you're drinking for the taste. One or two drinks fits a budget easily.`,
    moderate: `A clean week undone by the weekend is the single most common reason a cut stalls, and alcohol is usually at the center of it. The math is harsh: 1000 calories over maintenance on Friday and Saturday wipes out the 500-calorie daily deficit you built from Sunday to Wednesday, leaving Thursday as your only real deficit day. That isn't enough to lose fat. To lose about a pound (0.5 kg) a week, you need roughly a 3500-calorie weekly deficit. You don't have to quit drinking, but you do have to contain it. On a day you'll drink, save the calories from your earlier meals (higher protein and fiber, lower carbs and fat) and keep it to one to three lower-calorie drinks, with spirits and a zero-calorie mixer being the most efficient. Alcohol is the first fuel your body burns, so it stalls fat-burning while it clears and stores any surplus fat you eat with it. That's the cost you're budgeting around.`,
    daily: `Whether daily drinking breaks your plan comes down to the amount. One drink a day is fine: alcohol is 7 calories per gram, but a single drink fits easily if you pull a little carbohydrate from your meals (higher protein and fiber, lower carbs and fat, and bank the room). Two or three a day is a different story. At that amount, alcohol becomes the biggest single factor holding back your results, and the plan gets much harder than it needs to be. The honest advice is to bring it down to one drink. Not because one is off-limits, but because the deficit you're trying to maintain can't absorb more than that.`,
  },
  q9: {
    consistent: `Consistency of schedule is one of the strongest predictors of a successful cut. Eating at the same times every day is, on its own, often enough to drive fat loss, and you already have that going for you. Hold the pattern MealFrame gave you (the same number of meals at roughly the same times) for the length of your diet. The occasional off day doesn't matter, but repetition should be the default.`,
    travel: `Travel breaks the thing that makes dieting easy: a fixed schedule. There are two ways to handle it, depending on how much you travel. If it's only a day or two a week, the simplest answer is to not diet on those days. Eat at maintenance, keep your protein up with a shake or two, and accept slightly slower fat loss. Frequent maintenance days are fine. If you travel for several days in a row, you can't do that, so you plan ahead: pack protein powder, protein bars, and fruit for the trip, and rely heavily on fasting and backloading so you don't overshoot on grab-food and restaurant meals. Have small, protein-led meals early and save most of your calories for dinner, when your schedule finally settles. For meals out, use the same approach you'd use at home: check the menu in advance and pick what fits your budget.`,
    shifts: `Shift work is hard to plan for in a general way, because the right structure depends on your specific rotation. The principle that helps most is to keep your meal times, your workout, and as much of your wake and sleep times as possible steady across both shifts, changing as little as you can. Hunger is partly trained by time: ghrelin rises around the hours you normally eat, so when your eating times move around constantly, your hunger never settles into a pattern and starts hitting at random. Find a structure that fits both rotations (same workout time, same meal times, with only wake and sleep shifting) and hold it. If you can't make it fit, post in the community and we'll build it around your rotation together.`,
    nights: `Night shifts need an individual solution, and the honest answer is to work it out with us in the community rather than from a template. The same principle applies as with rotating shifts: anchor your structure to your wake time, wherever it falls, and treat that as your morning. Bring your situation to the community and we'll find a solution together.`,
    erratic: `An erratic schedule is the hardest case, because stability is one of the biggest predictors of success. People who settle into a routine consistently outperform those who change their meal counts, times, and calorie distribution on a whim. The instruction is straightforward: take the pattern MealFrame gave you and hold it. The occasional change is fine, but eating the same number of meals at roughly the same times every day is what keeps the deficit going. If a fixed schedule genuinely isn't possible for you, make a community post where you detail your situation and we'll find a solution together.`,
  },
  q2: {
    even: `You prepare your own food and your appetite stays steady through the day, so your meals stay about the same size. Even intake suits you well.`,
    backloaded: `Your appetite is strongest at night, so your plan matches it: your biggest meal is the evening one. This works with your hunger instead of against it, and it's easier to stay in control earlier in the day when you know your largest meal is waiting at the end. Your earlier meals lean on protein and high-volume food to keep you comfortable until then.`,
    buffered: `You tend to eat more at night out of habit or boredom, often in front of a screen. This habit works against the physique you want, so we redirect it rather than ban it. Your plan saves more calories for a real evening meal that satisfies the urge to eat at night. Part of that budget can go toward snacks if you need it, though the better long-term move is to spend it all on real food and let the boredom snacking fade. If the food-and-screen combination is the real anchor, keep your last meal there. Just make it the planned meal, not an open-ended graze.`,
  },
  combo: {
    bothOut: `Both your daytime food and your dinner are outside your control, so your whole cut comes down to two things: making the meals you buy during the day high in protein and fiber to save calories, and spending that saved budget at dinner. Front-loading your protein is what makes this work. If you skip it, you're left needing a high-protein dinner in a social setting, which is exactly what you can't control. Get your protein in during the day, and save the carbs and the flexibility for the evening. (Your dinner section above, family or restaurant, covers how to handle the meal itself.)`,
    hungryBoth: `You're hungry in the morning and at night, and the plan can't fully expand both ends at once. So it splits the difference: a real breakfast, a lighter middle, and your biggest meal at night, with protein spread fairly evenly across all of them. Your morning meal gets protein and volume to hold you, and your evening meal gets the size.`,
  },
  q10: {
    nomeat: `You don't eat meat, so your protein comes from fish, eggs, low-fat dairy, soy, and legumes. The strategy stays the same, only the sourcing changes. Daytime meals you prep or bring should be built on those: lean fish, Greek yogurt and fruit, cottage cheese, protein oatmeal, tofu, mock meats. For dinners out, take the fish or plant options and check in advance what fits. Everything else in your plan stays the same.`,
    vegetarian: `You eat eggs and dairy but not meat or fish, so your protein comes from low-fat cheese, eggs, soy (tofu, mock meats), and dairy. Build your daytime meals on those: protein oatmeal, Greek yogurt with fruit, cottage cheese, eggs, tofu. For dinners out, take the vegetarian or vegan options, and it's worth choosing vegetarian or vegan places in the first place, since a standard menu leaves you few choices.`,
    vegan: [
      `You're vegan, which changes the approach more than any other restriction, and it's one I follow myself, so the plan accounts for it properly. The main difference is that there is no separate protein source. Every food you eat has to carry a meaningful amount of protein, because your protein, carbs, and fat all come from the same foods. That makes planning essential, and it makes prepping your own food close to mandatory, especially away from home, where high-protein low-calorie vegan options barely exist. If you already cook and bring your own, keep doing exactly that. If you currently buy lunch, the honest advice is to switch to prepping, because the alternative is genuinely hard. For dinners out, confirm in advance that the place has real vegan options, otherwise you'll be left with french fries and ketchup. An occasional low-calorie dinner is fine, but you can't rely on it.`,
      `Protein powder matters more here than on any other plan. A day that works well: fast the first few hours, then have a smoothie with a scoop and a half of plant protein, a banana, and flaxseed for fiber, which is low in calories and gives you around 45g of protein. For your second meal, a Buddha bowl (smoked tofu, green beans, carrots, lentils, hummus) for fiber and another 50g of protein. For dinner, something varied: mock meats with potatoes, lentil or chickpea pasta with plant mince and tomato sauce, or high-protein wraps. A vegan cut absolutely hits protein and holds a deficit. It just takes more planning and more attention to detail than any other version.`,
    ],
    pescatarian: `You eat fish but not meat, so swap every mention of lean meat for lean fish. Build your daytime meals on low-fat fish and plant protein (tofu, mock meats): tuna salad, lean fish with vegetables, protein oatmeal. For dinners out, take the fish or plant options, and fish-based or plant-forward places give you the most room.`,
    nopork: `You don't eat pork, which has almost no effect on the plan. We simply keep pork out of your meal examples (no sausages or pork tenderloin). Everything else stays the same.`,
    nodairy: `You don't eat dairy, so anywhere the plan leans on low-fat cheese or yogurt, your protein comes from lean meat, plant options, and protein powder instead. The structure stays the same, only the sourcing shifts.`,
    gluten: `You avoid gluten, so the plan keeps bread and pasta out of your meals and examples. Nothing structural changes; your protein and the rest of your food stay as written.`,
  },
};

// Fresh-run cut copy: assemble the bank from the questionnaire answers.
function buildCutDayCopy(code, structure, personalization, answers) {
  const a = answers || {};
  const lines = [];
  const restr = a.restriction || structure.flags?.restriction || ['none'];
  const has = (x) => restr.includes(x);

  // Q10 restriction preamble (top of section): one diet block + gluten if present.
  let diet = null;
  if (has('vegan')) diet = CUT_COPY.q10.vegan;
  else if (has('vegetarian')) diet = [CUT_COPY.q10.vegetarian];
  else if (has('pescatarian')) diet = [CUT_COPY.q10.pescatarian];
  else if (has('nomeat')) diet = [CUT_COPY.q10.nomeat];
  else if (has('nodairy')) diet = [CUT_COPY.q10.nodairy];
  else if (has('nopork')) diet = [CUT_COPY.q10.nopork];
  if (diet) lines.push(...diet);
  if (has('gluten') || has('allergy')) lines.push(CUT_COPY.q10.gluten);

  // Q1 morning (firstMeal token).
  const sched = computeMealSchedule(structure, personalization);
  const firstMeal = minutesToClock(sched.firstMeal);
  const q1 = a.morningHunger === 'hard' ? CUT_COPY.q1.hard
    : a.morningHunger === 'ok' ? CUT_COPY.q1.ok
    : CUT_COPY.q1.easy;
  lines.push(q1.replace('{firstMeal}', firstMeal));

  // Combo: hungry at both ends (breakfast + hungry at night).
  if (a.morningHunger === 'hard' && a.eveningOvereat === 'hungry') lines.push(CUT_COPY.combo.hungryBoth);

  // Q3 daytime.
  const q3 = CUT_COPY.q3[a.daytimeControl];
  if (q3) Array.isArray(q3) ? lines.push(...q3) : lines.push(q3);

  // Q4 dinner.
  const q4 = CUT_COPY.q4[a.dinnerControl];
  if (q4) Array.isArray(q4) ? lines.push(...q4) : lines.push(q4);

  // Combo: both meals out of control.
  const dayOut = a.daytimeControl === 'eatout' || a.daytimeControl === 'none';
  const dinnerOut = a.dinnerControl === 'family' || a.dinnerControl === 'social';
  if (dayOut && dinnerOut) lines.push(CUT_COPY.combo.bothOut);

  // Q2 distribution line: only when daytime AND dinner are both controlled.
  const dayControlled = a.daytimeControl === 'cook' || a.daytimeControl === 'wfh';
  if (dayControlled && a.dinnerControl === 'control') {
    if (a.eveningOvereat === 'no') lines.push(CUT_COPY.q2.even);
    else if (a.eveningOvereat === 'hungry' || a.eveningOvereat === 'onlytime') lines.push(CUT_COPY.q2.backloaded);
    else if (a.eveningOvereat === 'habit') lines.push(CUT_COPY.q2.buffered);
  }

  // Q5 training and the meal around it.
  const hungryPost = a.hungryPostWorkout === 'yes';
  if (a.workout === 'before_first') {
    lines.push(hungryPost ? CUT_COPY.q5.fastedRavenous : CUT_COPY.q5.fastedCalm);
  } else if (a.workout === 'evening') {
    lines.push(CUT_COPY.q5.afterLast);
  } else if (a.workout === 'midday') {
    if (sched.eveningWorkout && sched.bigMealPreGym) lines.push(CUT_COPY.q5.lateNotHungry);
    else if (sched.eveningWorkout) lines.push(CUT_COPY.q5.lateHungry);
    else lines.push(CUT_COPY.q5.betweenNormal);
  }

  // Q7 cravings.
  const q7 = a.cravings === 'wrecked' ? CUT_COPY.q7.wrecked
    : a.cravings === 'manage' ? CUT_COPY.q7.manage
    : a.cravings === 'none' ? CUT_COPY.q7.none : null;
  if (q7) Array.isArray(q7) ? lines.push(...q7) : lines.push(q7);

  // Q8 alcohol (none is suppressed).
  if (a.alcohol === 'rare') lines.push(CUT_COPY.q8.rare);
  else if (a.alcohol === 'moderate') lines.push(CUT_COPY.q8.moderate);
  else if (a.alcohol === 'daily') lines.push(CUT_COPY.q8.daily);

  // Q9 schedule.
  const q9 = CUT_COPY.q9[a.schedule];
  if (q9) lines.push(q9);

  return lines;
}

// =====================================================
// BULK "How to Run Your Day" + "Your Bulk Type" COPY
// =====================================================
// Two fields: bulkType (framing, shown first) and howToRun (tactical). Fragments
// are chosen by the answers. Copy approved separately; this is the bank + router.

const BULK_COPY = {
  // ---- Your Bulk Type (framing) : barrier x type ----
  barrier: {
    hardgainer_phys: "Your body naturally resists gaining weight. When you push into a surplus, your appetite drops and your energy expenditure climbs, and together they burn off part of the extra food you eat. That sounds like bad news, but being a hard gainer is usually an advantage. Naturally lean lifters tend to build muscle with less fat and end up with the most impressive transformations. The whole challenge for you is finding a way to eat enough, consistently, without your appetite shutting the process down. This is the opposite of a cut. Everything below is built to get more food into your day with less effort.",
    hardgainer_phys_levers: [
      "Add a meal. Going from three feedings to four, or four to five, is the simplest way to raise your intake without making any single meal a chore.",
      "Add snacks between meals. High-protein, calorie-dense options work best: nuts, seeds, dried fruit, trail mix, cereal or protein bars, bagels. Keep them in reach at your desk or in your bag so eating one is the default, not a decision.",
      "Eat more calorie-dense food at your main meals. Denser food means more calories for the same volume, so you get full less quickly. The meal examples show you which options do this.",
      "Add fat to your cooking. Oil is the easiest way to add calories. One caveat: keep fat under about 30 to 35 percent of your daily calories and build the rest of the surplus from carbs. Dietary fat is stored as body fat more readily than carbs are, so a carb-led surplus tends to add slightly less fat.",
      "Use liquid calories. Drinks bypass the fullness that solid food creates, which is exactly what you want here. Milk, soy milk, a shake, flavored oat milk, or juice all move the needle without filling you up.",
      "Don't overdo fiber. Vegetables and whole grains are fine, but you don't need to load them the way a cut does. Leave room for white rice, pasta, bread, and cereal so volume doesn't cap your intake before your calories do.",
    ],
    hardgainer_logistics: "The thing standing between you and gaining weight isn't your appetite, it's access. You end up under your target because food isn't there when you need it, or you're too busy to sit down and eat what you planned. Fix the logistics and the weight follows.\n\nStart with groceries. If the food isn't in the house, you skip meals or fall back on whatever's around, and neither hits your numbers. Pick one day a week, shop once, and buy everything you'll need for the next five to seven days. Make it a fixed habit, not a when-I-remember one.\n\nThen handle work. Most under-eating happens during the workday, either because there's no good food available or because you're too busy to eat the large meals you need. Meal prep solves both. Cook at home, portion into containers, and bring them with you. Eat at your desk or on your break. It's the cheapest, most reliable way to guarantee your intake. Ordering in works too, but it costs more and it's less consistent, since you don't control the ingredients and some days you'll skip it. A work cafeteria is fine as well. On a bulk you have a lot of freedom in what you can eat, and because the meals are large, you hit your protein without much effort.\n\nSnacks cover the gaps. When there's no time for a real meal, a snack keeps your intake on track. Keep some at work and eat them whenever a meal isn't going to happen.",
    hardgainer_psych: "You have the appetite issues of a hard gainer, but the real thing holding you back is that you won't let yourself gain. A lot of under-eaters are quietly afraid of getting fat. They won't allow the scale to climb, so they pull back after a few higher-calorie days, and the surplus never adds up to anything. They're trying to build muscle with essentially no fat gain, and it rarely works. What usually happens instead is months or years of spinning your wheels with nothing to show for it.\n\nThis is worth naming plainly, because it's the actual barrier. When there's a gap between how you see yourself and the goal you say you want, you sabotage the goal without meaning to. It feels like you'd lose your identity if you changed. On a bulk that shows up as never fully committing: always second-guessing, always finding a reason to pull back to cutting or to hold on to a certain level of leanness.\n\nThe fix is to commit to the bulk. Staying lean-obsessed is the surest way to stay the same size for years. Accept that you'll look a little softer in the short term, because that's the cost of building real muscle and size. You want the bigger frame. The bulk is how you get it. Everything below assumes you're in.",
    balanced_logistics: "You gain fine when you actually eat enough. The reason past bulks haven't stuck is organization, not appetite or biology. Food isn't there when you need it, or the day gets away from you and meals get skipped. So your plan is a normal, moderate-density bulk, and the work is on the logistics around it.\n\nThe two fixes that matter most: shop once a week for everything you'll need over the next five to seven days, so the food is always in the house, and prep your daytime meals in containers so a busy workday can't knock you off target. Get those two habits in place and your intake takes care of itself. The structure below handles the timing; the meal examples handle the food.",
    cautious: "When you bulk, you overshoot. You gain too fast and the weight comes on as fat, either because holding the target surplus takes willpower or because eating intuitively puts you well over it. So we treat your bulk a lot like a cut: the structure and the food choices are there to keep a lid on calories, not to pile them on.\n\nA few things make restraint easier.\n\nEat on a schedule. Same times, similar amounts, similar foods each day. When your intake is consistent, your appetite adapts to it and stops pushing you past your target.\n\nSkip the snacks. You don't need calories stacked on top of your meals, so your plan doesn't put any there. Your meals are built to hit your number on their own.\n\nChoose lower-density food. Enjoyable, but not the hyper-palatable stuff that's easy to overeat. More volume for the same calories keeps you full without the surplus getting away from you. The meal structure and examples below show you what that looks like.",
    balanced_psych: "You gain fine when you commit, but the real thing holding you back is that you won't let yourself gain. A lot of lifters in your position are quietly afraid of getting fat. They won't allow the scale to climb, so they pull back after a few higher-calorie days, and the surplus never adds up to anything. They're trying to build muscle with essentially no fat gain, and it rarely works. What usually happens instead is months or years of spinning your wheels with nothing to show for it.\n\nThis is worth naming plainly, because it's the actual barrier. When there's a gap between how you see yourself and the goal you say you want, you sabotage the goal without meaning to. It feels like you'd lose your identity if you changed. On a bulk that shows up as never fully committing: always second-guessing, always finding a reason to pull back to cutting or to hold on to a certain level of leanness.\n\nThe fix is to commit to the bulk. Staying lean-obsessed is the surest way to stay the same size for years. Accept that you'll look a little softer in the short term, because that's the cost of building real muscle and size. You want the bigger frame. The bulk is how you get it. Your plan is a straightforward, moderate-density bulk; the rest is about actually running it.",
    balanced_default: "You gain weight at a reasonable rate without much drama. You don't have to force food down, and you don't have to fight to hold the line either, so your plan is a straightforward bulk: a normal number of meals at a moderate calorie density, with snacks available if you want them but never required. We're not loading vegetables to blunt your hunger, and we're not leaning on junk to hit the surplus. The goal is simply to eat enough good food, consistently, at the right times around your training. The structure below handles the timing; the meal examples handle the food.",
    never: "You haven't really run a proper bulk before, so there's no pattern to correct, which means we start you on the sensible default and adjust from there. That default is a balanced bulk: a normal number of meals at a moderate calorie density, enough food to gain at a controlled rate without piling on fat, snacks available if you want them but never required. It assumes you're neither a hard gainer who has to force food down nor someone who gains too fast and needs the brakes on. Most people land here.\n\nRun this for a few weeks and watch the scale. If the weight isn't moving and eating enough feels like a chore, you lean toward hard gainer, and you'd add feedings, snacks, and denser food. If it's climbing too fast and the fat is coming on quickly, you lean toward needing restraint, and you'd tighten the food choices and cut the snacks. Once you know which way you run, your next plan gets more specific. For now, the structure below is where to start.",
  },

  // ---- Morning (Q3) ----
  morning: {
    breakfast: "It helps that you're hungry in the morning, because it makes protein distribution easy. Muscle growth is slightly better when protein is spread more or less evenly across three to five meals, each with at least 20 to 30g of protein. Total daily protein still matters most by far, but distribution is a free bonus, and eating breakfast means you get it without trying. Each protein feeding briefly raises muscle protein synthesis, so hitting that mark at breakfast, lunch, and dinner means you're already taking every opportunity to build tissue across the day. If your three meals each land 20 to 30g of protein, your distribution is already ideal and there's nothing else to manage here.",
    light_ok: "You'd rather not eat much early, and that's fine, we don't force it. But a small protein feeding in the morning is worth keeping, and since you're happy with something light, we use that. A small meal with 20 to 30g of protein does the job, or a protein shake or a bar if that's easier. Either way you tick the morning-protein box while staying inside your preference. The reason it's worth doing: muscle growth is slightly better when protein is spread evenly throughout the day, across three to five feedings of 20 to 30g, because each feeding briefly raises muscle protein synthesis. A light morning protein hit lets you take that opportunity without eating a full breakfast you don't want.",
    light_push: "You prefer to eat light in the morning, and that preference is part of why gaining has been hard for you. Keep your calories low in the morning and you're forced to make them up later with oversized meals or constant snacking, which hasn't worked. Eating more in the morning takes the pressure off the rest of the day and makes your target far easier to reach.\n\nYou don't have to eat a big breakfast if that's not you. But aim for 20 to 30g of protein and some real calories alongside it. That alone makes your daily target easier to hit, and it improves your results too: muscle growth is slightly better when protein is spread evenly throughout the day, across three to five feedings of 20 to 30g, because each feeding briefly raises muscle protein synthesis. A morning feeding is the one you've been leaving on the table.",
    forced: "You tend to skip breakfast, and you also struggle to gain consistently. Those two things are connected. When you don't eat in the morning, you have to make up every one of those calories later, which means oversized meals or nonstop snacking, and it hasn't been working. So this plan puts a feeding in your morning even though it cuts against your habit.\n\nIt doesn't have to be big. Aim for 20 to 30g of protein and some calories with it. That one change makes your daily calorie target much easier to reach, and it improves your muscle-building results on top of that, because muscle growth is slightly better when protein is spread evenly throughout the day, across three to five feedings of 20 to 30g, and this takes advantage of every muscle-protein-synthesis spike instead of leaving the morning one unused.",
    fast: "Skipping breakfast suits you, so we keep it. Because you tend to gain quickly, a short morning fast is actually useful here: it keeps your calories in check by leaving more food for later in the day, where it meets real hunger and gives you room for social meals. Until your first meal, drink water, black coffee, and zero-calorie drinks. Drink water on purpose rather than waiting to feel thirsty, since fasting suppresses thirst, at least half a liter before you eat. Black coffee blunts appetite well; if caffeine doesn't wreck your sleep, one to three cups across the morning makes the fast effortless. Diet soda and zero-calorie energy drinks work too.",
  },

  // ---- Daytime (Q4 daytime) ----
  daytime: {
    cook_gain: "You prepare and bring your own daytime meals, which is the ideal setup: exact portions, exact ingredients, easy to track. That matters, because the hard part of eating away from home is finding food that's high enough in protein and calories without being junk. Bringing your own removes the problem. Build these meals on a protein source and a starchy carb, and add fat as needed to reach your calories. The best move is to settle on a handful of meals you like and repeat them. Standardizing a few favorites removes daily food decisions, lets you buy ingredients in bulk, and trains your appetite to expect stable portions. Store them in your office fridge or bag; a few hours unrefrigerated won't spoil them. The meal examples give you a set to start from.",
    cook_cautious: "You prepare and bring your own daytime meals, which is the ideal setup: exact portions, exact ingredients, easy to track. For you the goal is slightly different, since you gain easily, you want daytime meals that are high in protein but controlled in calories, so you don't overshoot or eat into the budget you'd rather keep for dinner. Bringing your own makes that easy. Build these on a lean protein source, vegetables, and a starchy carb, adding fat only as needed to hit your target. The best move is to settle on a handful of meals you like and repeat them. Standardizing a few favorites removes daily food decisions, lets you buy ingredients in bulk, and trains your appetite to expect stable portions. Store them in your office fridge or bag; a few hours unrefrigerated won't spoil them. The meal examples give you a set to start from.",
    eatout_balanced: "Buying your daytime meals is fine on a bulk as long as you keep the protein reasonable. Order meat, dairy, eggs, or a plant protein like tofu, plus a carb and some veg, and you'll do well. The trap is defaulting to junk, so aim for mostly whole foods. Plenty of quick restaurant meals fit your daytime calories: sandwiches, a standard meat-and-rice plate, pasta, even pizza in the right portion. Scan a few local menus ahead of time, find the meals that fit your protein and calorie budget, and keep those in rotation. There are also meal-prep delivery services built to hit macro targets, which is an easy way to get prepped nutrition without cooking. That said, prepping your own is still worth considering, since you get full control over portions and ingredients and spend far less.",
    eatout_hardgainer: "Buying your daytime meals is fine on a bulk as long as you keep the protein reasonable. Order meat, dairy, eggs, or a plant protein like tofu, plus a carb and some veg, and you'll do well. Since eating enough is the hard part for you, lean into the higher-calorie options: burgers, sandwiches, pizza, pasta all help you hit your surplus without a fight. Scan a few local menus ahead of time, find meals you actually enjoy that fit your protein and calorie budget, and keep those in rotation. There are also meal-prep delivery services built to hit macro targets, an easy way to get prepped nutrition without cooking. That said, prepping your own is still worth considering, since you get full control over portions and ingredients and spend far less.",
    eatout_cautious: "Buying your daytime meals makes restraint harder, because most restaurant food is calorie-dense: sandwiches, pizza, pasta. It's easy to overshoot your daytime budget without noticing. The fix is to order lean protein and vegetables, a large salad with a double portion of grilled meat, or a burrito bowl with double meat, beans, and low-fat sauce. Scan a few local menus ahead of time, find the meals that fit your protein and calorie budget, and keep those in rotation. There are also meal-prep delivery services built to hit macro targets, which is an easy way to get controlled nutrition without cooking. That said, prepping your own is still worth considering, since you get full control over portions and ingredients and spend far less.",
    none_cautious: "You tend to skip daytime meals, so there's no real lunch slot, you either skip it or grab something quick from a vending machine or a counter. On a bulk that backfires two ways: skipping makes it hard to hit your protein, and grab-and-go food is usually calorie-dense enough to push you over. The solution is to bring your own food that's easy to carry and quick to eat. Two options:\n\n1. Cook and bring meals in containers. Build them on a protein source, vegetables or fruit, and a starchy carb (potatoes, rice, pasta, bread). Settle on a handful you like and repeat them, it removes daily decisions, lets you buy in bulk, and steadies your appetite. Store them in your office fridge or bag; a few hours out won't spoil them.\n\n2. Use liquid meal replacements: a protein smoothie made ahead in a sealed bottle, or a single-serve meal replacement.\n\nThe meal examples show you what to pack.",
    none_hardgainer: "Skipping daytime meals is one of the main reasons you struggle to hit your calories and add size. Every meal you skip has to be made up later, so you end up backloading the day and facing oversized meals at night, and with a lower appetite you either can't finish them or you just don't eat enough. Two ways to fix it:\n\n1. Cook and bring meals in containers. Build them on a protein source, vegetables or fruit, and a starchy carb (potatoes, rice, pasta, bread). Settle on a handful you like and repeat them, it removes daily decisions, lets you buy in bulk, and steadies your appetite. Store them in your office fridge or bag; a few hours out won't spoil them.\n\n2. Use liquid meal replacements: a protein smoothie made ahead in a sealed bottle, or a single-serve meal replacement. Liquids are especially useful for you, since they add calories without the fullness solid food creates.\n\nThe meal examples show you what to pack.",
    none_balanced: "Skipping daytime meals makes your calorie target harder to reach and affects your protein distribution. It can still work, as long as you eat enough overall, this is secondary, and you've gained fine before eating light in the day. But if hitting your target starts to feel like a chore, add daytime food so you're not stuck with huge meals at night. A few options:\n\n1. Cook and bring meals in containers. Build them on a protein source, vegetables or fruit, and a starchy carb. Settle on a handful you like and repeat them; it removes daily decisions and steadies your appetite. A few hours out of the fridge won't spoil them.\n\n2. Use liquid meal replacements: a protein smoothie made ahead, or a single-serve product.\n\n3. Grab food on the go. Bulking is forgiving with food choices, so a sandwich, a pretzel, or something quick is fine here. As long as you hit your daily protein, these fast meals help you reach your calories.\n\nThe meal examples show you what to pack.",
    wfh: "Working from home is the ideal setup. You can prep ahead or cook fresh, weigh everything, and keep full control of the ingredients. The best move is to settle on a handful of meals you like and repeat them, which removes daily food decisions, lets you stock ingredients in bulk, and steadies your appetite around stable portions. Build your meals on a protein source, some starchy carbs, and vegetables, so you hit protein, get enough volume, and reach your calories. You can also snack whenever you need to at home. The meal examples give you a starting framework.",
  },

  // ---- Evening (Q5 evening) ----
  evening: {
    hungry_cautious: "Your appetite is strongest at night, so your plan matches it: most of your food lands in the evening. Working with your hunger instead of against it makes the day easier, and it's easier to stay controlled earlier when you know your biggest meal is waiting at the end. Keep the earlier meals lighter and higher in protein so you arrive at the evening with room to eat, and let the night meal be the large one. The one thing to watch is that \"hungry at night\" doesn't turn into eating past your target, so keep the evening meal planned rather than open-ended.",
    hungry_gain: "Your appetite is strongest at night, so your plan matches it: most of your food lands in the evening. That's an advantage here, it lets you put the most food where your hunger actually is, when you have access to plenty of it and can eat what you enjoy. Use it. The evening is where the bulk of your calories and your largest meal belong, so lean into it rather than forcing food earlier when you don't want it.",
    onlytime: "Evenings are when you actually have time to eat, so your plan puts more of your food there. This works with your schedule instead of against it. Keep your daytime meals smaller and simpler, then eat the larger share at night, when you can cook properly, have plenty of food on hand, and eat what you enjoy. The structure below already shifts your calories this way, so you're not trying to force big meals into a workday that has no room for them.",
    habit_cautious: "Gaining too much fat in past bulks usually comes from this exact window, the stretch between getting home and going to bed, often in front of a screen. Your plan gives that window real food: a proper dinner and some snacks if they fit. But the point is to eat with intent here, not to graze freely. Control the food choices, keep the portions set, and log what you eat before you eat it so you don't sail past your budget.\n\nThe trick isn't willpower, it's your food environment. If cravings and boredom eating have wrecked bulks before, it usually comes down to keeping trigger foods in the house, buying them in big packages, and leaving them in sight. Fix the environment and most of the willpower problem disappears. Buy only what you'll eat in one sitting, in single-serving packaging, 200 to 400 calories, and let the empty wrapper be the signal that you're done. Opening a second package feels different from taking more from an open bag, and that difference is what keeps the portion in check. Keep anything ready-to-eat out of sight, behind other things, hard to reach. A small obstacle between your hand and the food is often enough.",
    habit_hardgainer: "Eating to decompress at night can actually work in your favor. If you enjoy eating in front of a screen, use it, time your snacks for the evening. Most people eat more when they're eating distractedly, and for you that's a feature, not a bug. If a relaxed evening makes it easier to get more food down, lean on it to help hit your surplus.",
    habit_balanced: "You tend to eat more in the evening to unwind. Your plan matches that by placing more of your food there, which gives you the room to do it. It lets you eat more when you're relaxed and hungry, have plenty of food on hand, and can eat what you enjoy. Just keep the evening meal a planned one rather than an open-ended graze, and it works in your favor.",
  },

  // ---- Dinner (Q6 dinner) ----
  dinner: {
    control: "You control your dinner, which is the ideal situation. You choose the ingredients, set the portion, and weigh exactly what you eat. The best strategy is to settle on a few dinner options you enjoy and rotate them. But dinner is also where you get to include the foods you crave and add some variety. If your earlier meals are more standardized, dinner is where you can loosen the structure and enjoy some flexibility while still hitting your target.",
    family_cautious: "Someone else cooks your dinner and you eat it together, and that's something we build around, not something to avoid. Shared meals are deeply human. Eating alone might make planning easier, but it also breeds isolation and friction at home, and we don't want that. So the plan is built around that shared dinner: your earlier meals run a bit lower in calories, which banks a good part of your day for the evening, and your budget leaves room for a normal family dinner in normal portions.\n\nIf you tend to overeat at that dinner, the fix is to add food, not remove it. Have a little less of what's served and add a portion of plain protein on the side (extra chicken, a scoop of cottage cheese, a block of tofu) plus some vegetables or mushrooms. Adding food is far easier to justify socially than refusing it, and it lowers the calorie density of the meal, adds volume, and leaves you full without pushing you over.",
    family_balanced: "Someone else cooks your dinner and you eat it together, and that's something we build around, not something to avoid. Shared meals are deeply human. Eating alone might make planning easier, but it also breeds isolation and friction at home, and we don't want that. So the plan is built around that shared dinner: your earlier meals run a bit lower in calories, which banks a good part of your day for the evening, and your budget leaves room for a normal family dinner in normal portions.",
    family_hardgainer: "Someone else cooks your dinner and you eat it together, and that's something we build around, not something to avoid. Shared meals are deeply human. Eating alone might make planning easier, but it also breeds isolation and friction at home, and we don't want that. So the plan is built around that shared dinner.\n\nIf you tend to come up short at dinner, the fix is to add calories on the side. Eat what's served and add some extra oil, a dessert, or some liquid calories alongside it. Adding food is far easier to justify socially than refusing it, and it raises the calorie density of the meal so you actually reach your target.",
    social_cautious: "You eat dinner out often, which makes restraint the challenge, since restaurant food is calorie-dense and easy to overshoot. Keep your earlier meals lighter and higher in protein so you arrive with a controlled budget rather than a blank check. Order well: lean meat with a side of vegetables or potatoes gives you the most food for the calories. Check the menu before you go and decide what you'll order, so the choice is made before the table talks you into something bigger. An occasional larger night is fine on a bulk, you have the room, but you don't want every dinner running over.",
    social_balanced: "You eat dinner out often, and on a bulk that's easy to work with. Keep your earlier meals reasonable and you arrive at dinner with a comfortable budget that fits most restaurant meals, a plate of pasta, a burger, meat and potatoes, without much thought. The one thing worth doing is favoring higher-protein options where you can, since restaurant food tends to run low on protein and high on everything else. Beyond that, enjoy it, this is one of the easier situations to bulk in.",
    social_hardgainer: "You eat dinner out often, which actually helps you, restaurant food is calorie-dense, and that's exactly what you need. The one thing to stay on top of is protein, since restaurant meals lean carb- and fat-heavy. Build your order on a protein source (meat, fish, dairy, plant protein) and let the rest of the plate carry the calories. Check the menu ahead of time, find a few high-protein meals you enjoy across your regular spots, and keep them in rotation so hitting protein doesn't depend on the night.",
    varies: "Your dinner changes a lot from week to week, so we treat it as the flexible part of your day instead of fighting it. Lock in your earlier meals, enough protein, controlled calories, and leave a generous budget for the evening. That cushion covers almost any dinner that comes up, cooked at home, out with friends, or whatever the week throws at you. Over time, working toward a more predictable pattern helps, since the best results come from finding one system and repeating it, but the flexible-evening approach keeps you on track until then.",
  },

  // ---- Restriction (Q10) ----
  restriction: {
    nomeat: "You don't eat meat, so your protein comes from fish, eggs, dairy, soy, and legumes. The strategy stays the same, only the sourcing changes. Daytime meals you prep or bring should be built on those: fish, Greek yogurt and fruit, cottage cheese, protein oatmeal, tofu, mock meats. For dinners out, take the fish or plant options and check in advance what fits. Everything else in your plan stays the same.",
    vegetarian: "You eat eggs and dairy but not meat or fish, so your protein comes from cheese, eggs, soy (tofu, mock meats), and dairy. Build your daytime meals on those: protein oatmeal, Greek yogurt with fruit, cottage cheese, eggs, tofu. For dinners out, take the vegetarian or vegan options, and it's worth choosing vegetarian or vegan places in the first place, since a standard menu leaves you few choices.",
    vegan: [
      "You're vegan, which changes the approach more than any other restriction, and it's one I follow myself, so the plan accounts for it properly. The main difference is that there is no separate protein source. Every food you eat has to carry a meaningful amount of protein, because your protein, carbs, and fat all come from the same foods. That makes planning essential. The good news is that calories are the easy part for you on a bulk, nuts, nut butters, oils, tahini, seeds, and dense grains add a surplus without much volume, so hitting your target is rarely the problem. Protein is. Prepping your own food is close to mandatory, especially away from home, where high-protein vegan options barely exist. If you already cook and bring your own, keep doing exactly that. If you currently buy lunch, the honest advice is to switch to prepping. For dinners out, confirm in advance that the place has real vegan options, otherwise you'll be left with fries and a side salad, which won't touch your protein.",
      "Protein powder matters more here than on any other plan. A day that works well: a smoothie with a scoop and a half of plant protein, a banana, peanut butter, and oats blended in, which is calorie-dense and gives you around 45g of protein to start the day. For a second meal, a Buddha bowl (smoked tofu, green beans, carrots, lentils, hummus) for fiber and another 50g of protein. For dinner, something varied and generous: mock meats with potatoes, lentil or chickpea pasta with plant mince and tomato sauce, or high-protein wraps, with oil or avocado added to push the calories. A vegan bulk absolutely hits protein and reaches a surplus. It just takes more planning and more attention to detail than any other version.",
    ],
    pescatarian: "You eat fish but not meat, so swap every mention of meat for fish. Build your daytime meals on fish and plant protein (tofu, mock meats): tuna salad, fish with vegetables, protein oatmeal. Fattier fish like salmon and mackerel are useful here, since they add calories along with the protein. For dinners out, take the fish or plant options, and fish-based or plant-forward places give you the most room.",
    nopork: "You don't eat pork, which has almost no effect on the plan. We simply keep pork out of your meal examples (no sausages or pork tenderloin). Everything else stays the same.",
    nodairy: "You don't eat dairy, so anywhere the plan leans on cheese or yogurt, your protein comes from meat, plant options, and protein powder instead. The structure stays the same, only the sourcing shifts.",
    gluten: "You avoid gluten, so the plan keeps bread and pasta out of your meals and examples. Nothing structural changes; your protein and the rest of your food stay as written.",
  },
};

// Assemble the two bulk copy fields from the answers.
function buildBulkDayCopy(code, structure, personalization, answers) {
  const a = answers || {};
  const fl = structure.flags || {};
  const type = structure.bulkType || fl.bulkType || 'balanced';
  const barrier = structure.barrier || fl.barrier || 'none';
  const C = BULK_COPY;

  // ---------- FIELD 1: Your Bulk Type (framing) ----------
  // The BARRIER (why he struggles) leads the framing, not the structure. A lifter
  // can be balanced-structure but come in for logistics (1b) or psychology (1c),
  // and the opening should speak to that reason. Structure still decides the plan;
  // this only decides which "why" narrative he reads.
  const bulkType = [];
  const g = a.gainExperience;
  if (type === 'hardgainer') {
    if (barrier === 'logistical') bulkType.push(C.barrier.hardgainer_logistics);
    else if (barrier === 'psychological') bulkType.push(C.barrier.hardgainer_psych);
    else { bulkType.push(C.barrier.hardgainer_phys); C.barrier.hardgainer_phys_levers.forEach((l) => bulkType.push(l)); }
  } else if (type === 'cautious') {
    bulkType.push(C.barrier.cautious);
  } else { // balanced structure — but let the barrier pick the narrative
    if (g === 'never') bulkType.push(C.barrier.never);
    else if (barrier === 'logistical') bulkType.push(C.barrier.balanced_logistics);   // 1b
    else if (barrier === 'psychological') bulkType.push(C.barrier.balanced_psych);     // 1c
    else bulkType.push(C.barrier.balanced_default);                                     // 1d/1f neutral
  }

  // ---------- FIELD 2: How to Run Your Day (tactical) ----------
  const howToRun = [];

  // Restriction preamble (one strictest diet block + gluten if flagged).
  const restr = a.restriction || fl.restriction || ['none'];
  const has = (x) => restr.includes(x);
  let diet = null;
  if (has('vegan')) diet = C.restriction.vegan;
  else if (has('vegetarian')) diet = [C.restriction.vegetarian];
  else if (has('pescatarian')) diet = [C.restriction.pescatarian];
  else if (has('nomeat')) diet = [C.restriction.nomeat];
  else if (has('nodairy')) diet = [C.restriction.nodairy];
  else if (has('nopork')) diet = [C.restriction.nopork];
  if (diet) diet.forEach((d) => howToRun.push(d));
  if (has('gluten') || has('allergy')) howToRun.push(C.restriction.gluten);

  // Morning — driven by the resolved morningMode + gain-risk.
  const gainRisk = fl.gainRisk;
  const mm = structure.morningMode;
  if (mm === 'if' || mm === 'fasted') {
    // fasted mode: fast copy only for cautious (restraint); otherwise no morning para
    // (the fasted-morning eater just trains then eats — handled by structure, not copy).
    if (type === 'cautious') howToRun.push(C.morning.fast);
  } else if (mm === 'breakfast') {
    howToRun.push(C.morning.breakfast);
  } else if (mm === 'light_anchor') {
    if (a.shape === 'skip') howToRun.push(C.morning.forced);        // forced feeding (3c, no fast)
    else if (gainRisk) howToRun.push(C.morning.light_push);         // 3b + struggles
    else howToRun.push(C.morning.light_ok);                          // 3b, no gain risk
  }

  // Daytime (Q4).
  const dt = a.daytime;
  if (dt === 'cook') howToRun.push(type === 'cautious' ? C.daytime.cook_cautious : C.daytime.cook_gain);
  else if (dt === 'eatout') howToRun.push(type === 'cautious' ? C.daytime.eatout_cautious : type === 'hardgainer' ? C.daytime.eatout_hardgainer : C.daytime.eatout_balanced);
  else if (dt === 'none') howToRun.push(type === 'cautious' ? C.daytime.none_cautious : type === 'hardgainer' ? C.daytime.none_hardgainer : C.daytime.none_balanced);
  else if (dt === 'wfh') howToRun.push(C.daytime.wfh);

  // Evening (Q5).
  const ev = a.evening;
  if (ev === 'hungry') howToRun.push(type === 'cautious' ? C.evening.hungry_cautious : C.evening.hungry_gain);
  else if (ev === 'onlytime') howToRun.push(C.evening.onlytime);
  else if (ev === 'habit') howToRun.push(type === 'cautious' ? C.evening.habit_cautious : type === 'hardgainer' ? C.evening.habit_hardgainer : C.evening.habit_balanced);
  // ev === 'no' -> no fragment

  // Dinner (Q6).
  const dn = a.dinner;
  if (dn === 'control') howToRun.push(C.dinner.control);
  else if (dn === 'family') howToRun.push(type === 'cautious' ? C.dinner.family_cautious : type === 'hardgainer' ? C.dinner.family_hardgainer : C.dinner.family_balanced);
  else if (dn === 'social') howToRun.push(type === 'cautious' ? C.dinner.social_cautious : type === 'hardgainer' ? C.dinner.social_hardgainer : C.dinner.social_balanced);
  else if (dn === 'varies') howToRun.push(C.dinner.varies);

  // Split any multi-paragraph fragments (they contain blank-line breaks) so each
  // paragraph renders as its own <p>. Keeps single-paragraph fragments untouched.
  const explode = (arr) => arr.reduce((out, s) => out.concat(String(s).split('\n\n')), []);
  return { bulkType: explode(bulkType), howToRun: explode(howToRun) };
}

function buildDayCopy(code, structure, personalization, answers) {
  if (code.direction === 'cut' && answers && answers.morningHunger) {
    return buildCutDayCopy(code, structure, personalization, answers);
  }
  if (code.direction === 'bulk' && structure.bulkType) {
    return buildBulkDayCopy(code, structure, personalization, answers);
  }
  return buildDescription(code, structure, personalization);
}

// =====================================================
// MEAL LIBRARY + SOLVER + RECIPES + CAROUSEL SELECTION
// Macros are source of truth; energy = 4/9/4 with fiber at 2 kcal/g. Solver scales
// each meal to the slot targets (as-written when it already fits); selection builds
// 4 options/slot (>=1 vegan, protein-type balanced, no animal/plant variant pair
// together, MRs gated+capped, starch only for higher-cal/even slots). STEPS holds
// the recipe per meal id; images at /meals/<id>.jpg.
// =====================================================

// MealFrame meal library. Macros are the source of truth; energy is computed
// (4/9/4, fiber at 2 kcal/g). Ingredient roles: P=protein group, S=starch/energy
// lever, X=side (scales a little with meal size). diet = what the meal CONTAINS.
// band = the calorie range Radu wrote it for. mr = meal replacement. vg = variant
// group (animal/plant pair that must never appear together in one plan).
// ing tuple: [name, grams, protein, fat, carbs, fiber, role]

const MEALS = [
  // ---------------- MEAL REPLACEMENTS ----------------
  { id:'huel', name:'Meal Replacement Product', band:[300,650], mr:true, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Huel Black two scoops',90,40,17,28,11,'P']] },
  { id:'shake_fruit', name:'Protein Shake & Fruit', band:[300,700], mr:true, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Protein powder',60,47,1,1.9,0,'P'],['Large banana',270,3,0.9,55,7,'S']] },
  { id:'bars_fruit', name:'Protein Bars & Fruit', band:[400,900], mr:true, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:0,gluten:0},
    ings:[['Quest bars (x2)',120,40,18,24,22,'P'],['Large apple',420,1.1,0.7,48,10,'S']] },

  // ---------------- DAYTIME / LEAN (300-700) ----------------
  { id:'chicken_fajitas', name:'Chicken Fajitas', band:[350,750], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Chicken breast',225,45,6.8,0,0,'P'],['Onion',250,2.8,0.2,19,4.2,'X'],['Bell pepper',250,2.5,0.8,9.8,5.2,'X'],['Oil',10,0,10,0,0,'F'],['Hot salsa',100,1.5,0.2,4.7,1.9,'F']] },
  { id:'chicken_peas', name:'Chicken & Peas Skillet', band:[250,650], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Chicken thighs',200,40,8.2,0,0,'P'],['Frozen peas',200,10.4,0.8,18.2,9,'X'],['Carrots',200,1.8,0.4,13.6,5.6,'X']] },
  { id:'chicken_greenbeans', name:'Chicken & Green Beans Skillet', band:[250,550], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Chicken thighs',200,40,8.2,0,0,'P'],['Frozen green beans',200,3.6,0.4,8.6,5.4,'X'],['Carrots',200,1.8,0.4,13.6,5.6,'X']] },
  { id:'burrito_sm', name:'Burrito Bowl', band:[400,900], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Lean ground meat',200,42,14.2,0,0,'P'],['Kidney beans',120,9.6,1.3,19,6.6,'S'],['Onion',100,1.1,0.1,7.6,1.7,'X'],['Bell pepper',100,1,0.3,3.9,2.1,'X'],['Oil',10,0,10,0,0,'F'],['Hot salsa',100,1.5,0.2,4.7,1.9,'F']] },
  { id:'tuna_salad', name:'Tuna Salad', band:[300,650], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:1,dairy:1,egg:1,gluten:0},
    ings:[['Tuna (drained)',130,25,1.3,0,0,'P'],['Greek yogurt',150,13.5,7.5,6,0,'P'],['Iceberg lettuce',125,1.1,0.2,2.2,1.5,'X'],['Red onion',100,1.1,0.1,7.6,1.7,'X'],['Green olives',25,0.2,4,0.1,0.8,'F'],['Cherry tomato',100,0.9,0.2,2.7,1.2,'X'],['Mustard',20,0.7,0.7,0.4,0.8,'F'],['Mayo',15,0.15,11.5,0.1,0,'F']] },
  { id:'tuna_stirfry', name:'Tuna Skillet Stir-Fry', band:[350,800], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:1,dairy:0,egg:1,gluten:0},
    ings:[['Tuna (drained)',130,25,1.3,0,0,'P'],['Eggs',100,12,10,0,0,'P'],['Frozen veg mix',250,7.8,1.2,32,10.7,'X'],['Oil',10,0,10,0,0,'F']] },
  { id:'yogurt_mixfruit', name:'Greek Yogurt & Mixed Fruit', band:[350,800], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:0,gluten:0},
    ings:[['Greek yogurt',400,36,20,16,0,'P'],['Frozen fruit mix',250,1.8,0,30,9,'S']] },
  { id:'yogurt_fruit', name:'Greek Yogurt & Fruit', band:[400,950], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:0,gluten:0},
    ings:[['Greek yogurt',400,36,20,16,0,'P'],['Large apple',210,0.6,0.4,24,5,'S'],['Large banana',135,1.5,0.5,28,3.6,'S']] },
  { id:'cottage_veg', name:'Cottage Cheese Veggie Bowl', band:[300,750], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:0,gluten:0},
    ings:[['Cottage cheese',400,44,17.2,13.6,0,'P'],['Cucumber',150,0.4,0.2,2.4,0.4,'X'],['Tomato',150,1.4,0.3,4.1,1.8,'X'],['Carrot',100,0.9,0.2,6.8,2.8,'X'],['Red onion',50,0.6,0.1,3.8,0.8,'X']] },
  { id:'smoothie', name:'Protein Smoothie', band:[350,800], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Protein powder',60,47,1,1.9,0,'P'],['Large banana',270,3,0.9,55,7,'S'],['Ground flaxseed',15,3,6,4,4,'F']] },
  { id:'protein_oats', name:'Protein Oats', band:[400,850], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Protein powder',40,31,0.6,1.3,0,'P'],['Oats',60,8,3.9,35,6,'S'],['Large apple',210,0.6,0.4,24,5,'S'],['Large banana',135,1.5,0.5,28,3.6,'S']] },
  { id:'protein_platter', name:'Protein Platter', band:[350,750], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Firm tofu',100,9,4.2,2,0.9,'P'],['Seitan',50,13,1.8,2.7,0.9,'P'],['Tempeh',100,20,11,0.5,7,'P'],['Oil',10,0,10,0,0,'F'],['Tomato',150,1.4,0.3,4.1,1.8,'X'],['Carrot',100,0.9,0.2,6.8,2.8,'X'],['Spinach',50,1.5,0.2,0.7,1.1,'X']] },
  { id:'tofu_scramble', name:'Tofu Scramble', band:[350,800], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Firm tofu',400,36,16.8,8,3.6,'P'],['Mushrooms',150,3,0,4.5,3,'X'],['Onion',150,1.6,0.2,11.5,2.5,'X'],['Bell pepper',150,1.5,0.4,5.8,3.1,'X'],['Oil',10,0,10,0,0,'F']] },
  { id:'tofu_lentil', name:'Tofu & Lentil Bowl', band:[350,750], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Smoked tofu',200,28,16,1.8,2,'P'],['Lentils (canned)',200,10.8,0.8,28,13,'S'],['Tomato',100,0.9,0.2,2.7,1.2,'X'],['Cucumber',100,0.3,0.1,1.6,0.3,'X'],['Soy sauce',20,1.6,0.1,0.8,0,'F'],['Hot sauce',50,1,0.4,9,0,'F']] },
  { id:'tofu_hummus', name:'Tofu & Hummus Bowl', band:[350,850], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Smoked tofu',200,28,16,1.8,2,'P'],['Hummus',100,7.8,18,9.5,5.5,'F'],['Tomato',100,0.9,0.2,2.7,1.2,'X'],['Cucumber',100,0.3,0.1,1.6,0.3,'X'],['Carrot',100,0.9,0.2,6.8,2.8,'X']] },
  { id:'pork_mushroom', name:'Pork Tenderloin & Mushroom Skillet', band:[300,650], mr:false, vg:'mushroomskillet',
    diet:{meat:1,pork:1,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Pork tenderloin',200,40,6.2,0,0,'P'],['Mushrooms',200,4,0,6,4,'X'],['Oil',10,0,10,0,0,'F'],['Spinach',100,2.9,0.4,1.4,2.2,'X'],['Tomato',100,0.9,0.2,2.7,1.2,'X'],['Carrot',100,0.9,0.2,6.8,2.8,'X']] },
  { id:'tofu_mushroom', name:'Savory Tofu & Mushroom Skillet', band:[400,900], mr:false, vg:'mushroomskillet', plant:true,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Smoked tofu',200,28,16,1.8,2,'P'],['Peanuts',25,6,11,1.7,1.9,'F'],['Mushrooms',200,4,0,6,4,'X'],['Oil',10,0,10,0,0,'F'],['Spinach',100,2.9,0.4,1.4,2.2,'X'],['Tomato',100,0.9,0.2,2.7,1.2,'X'],['Carrot',100,0.9,0.2,6.8,2.8,'X']] },

  // ---------------- LEAN CHICKEN / EGG DAYTIME (with a starch lever so they scale up) ----------------
  { id:'chicken_fajita_wrap', name:'Chicken Fajita Wrap', band:[500,1150], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Chicken breast',225,45,6.8,0,0,'P'],['Small tortillas',80,7.8,7.8,36.7,7.8,'S'],['Onion',250,2.8,0.2,19,4.2,'X'],['Bell pepper',250,2.5,0.8,9.8,5.2,'X'],['Oil',10,0,10,0,0,'F'],['Hot salsa',100,1.5,0.2,4.7,1.9,'F']] },
  { id:'chicken_rice_greenbeans', name:'Chicken, Rice & Green Beans Skillet', band:[350,800], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Chicken thighs',200,40,8.2,0,0,'P'],['Brown rice (dry)',50,3.8,1.6,37,1.8,'S'],['Frozen green beans',200,3.6,0.4,8.6,5.4,'X'],['Carrots',200,1.8,0.4,13.6,5.6,'X']] },
  { id:'egg_platter', name:'Egg & Veggie Protein Platter', band:[500,1200], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:1,gluten:0},
    ings:[['Eggs',150,18,15,0,0,'P'],['Firm tofu',200,18,8.4,4,1.8,'P'],['Hummus',100,7.8,18,9.5,5.5,'F'],['Oil',10,0,10,0,0,'F'],['Cherry tomato',150,1.4,0.3,4.1,1.8,'X'],['Cucumber',150,0.4,0.2,2.4,0.4,'X'],['Carrot',100,0.9,0.2,6.8,2.8,'X']] },

  // ---------------- DINNER / HIGHER CAL (600-1500) ----------------
  { id:'chicken_rice', name:'Chicken & Veggie Rice', band:[550,1250], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Chicken breast',225,45,6.8,0,0,'P'],['White rice (dry)',80,5.7,0.6,63,1,'S'],['Frozen veg mix',250,7.8,1.2,32,10.7,'X'],['Oil',10,0,10,0,0,'F'],['Soy sauce',20,1.6,0.1,0.8,0,'F']] },
  { id:'omelette', name:'Rustic Veggie Omelette', band:[450,1000], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:1,gluten:0},
    ings:[['Eggs',150,18,15,0,0,'P'],['Cottage cheese',250,28,10.8,8.5,0,'P'],['Mushrooms',150,3,0,4.5,3,'X'],['Onion',150,1.6,0.2,11.5,2.5,'X'],['Bell pepper',150,1.5,0.4,5.8,3.1,'X'],['Oil',10,0,10,0,0,'F']] },
  { id:'omelette_toast', name:'Rustic Veggie Omelette & Toast', band:[550,1250], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:1,gluten:1},
    ings:[['Eggs',150,18,15,0,0,'P'],['Cottage cheese',250,28,10.8,8.5,0,'P'],['Bread',60,7,2.1,45.9*0.6,3.6,'S'],['Mushrooms',150,3,0,4.5,3,'X'],['Onion',150,1.6,0.2,11.5,2.5,'X'],['Bell pepper',150,1.5,0.4,5.8,3.1,'X'],['Oil',10,0,10,0,0,'F']] },
  { id:'chicken_potato', name:'Chicken & Baked Potatoes', band:[700,1550], mr:false, vg:'bakedpotato',
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Chicken thighs',200,40,8.2,0,0,'P'],['Potatoes (raw)',500,17.5,1,151.5,18,'S'],['Oil',10,0,10,0,0,'F']] },
  { id:'mockmeat_potato', name:'Mock Meat & Baked Potatoes', band:[700,1600], mr:false, vg:'bakedpotato', plant:true,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Plant-based burger',200,34,26,8.8,1.8,'P'],['Potatoes (raw)',400,14,0.8,121.2,14.4,'S'],['Oil',10,0,10,0,0,'F']] },
  { id:'chickpea_pasta', name:'Chickpea or Lentil Pasta', band:[550,1250], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Chickpea/lentil pasta (dry)',200,54,3.6,116,25,'P'],['Tomato-based sauce',250,4,4,19.5,3.9,'F']] },
  { id:'beans_sausage', name:'Baked Beans & Sausages', band:[550,1250], mr:false, vg:'bakedbeans',
    diet:{meat:1,pork:1,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Sausage',200,30,34,5.2,0,'P'],['Baked beans (can)',400,18.6,0.8,64,14,'S'],['Pickles',150,0.8,0.4,2.1,1.5,'X']] },
  { id:'beans_pbsausage', name:'Baked Beans & Plant Sausages', band:[500,1150], mr:false, vg:'bakedbeans', plant:true,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Plant-based sausage',200,12,22,38,0,'P'],['Baked beans (can)',400,18.6,0.8,64,14,'S'],['Pickles',150,0.8,0.4,2.1,1.5,'X']] },
  { id:'chicken_proteinbowl', name:'Chicken Protein Bowl', band:[550,1250], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Chicken breast',150,30,4.5,0,0,'P'],['Falafel',150,12.3,13.4,33,11.4,'S'],['Hummus',100,7.8,18,9.5,5.5,'F'],['Tomato',150,1.3,0.3,4,1.8,'X'],['Carrots',100,0.9,0.2,6.8,2.8,'X'],['Red onion',50,0.6,0.1,3.8,0.9,'X'],['Oil',5,0,5,0,0,'F']] },
  { id:'chicken_noodles', name:'Chicken Noodles', band:[550,1250], mr:false, vg:'noodles',
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Chicken breast',150,30,4.5,0,0,'P'],['Wheat noodles (dry)',100,13,1.5,74.7,3.2,'S'],['Asian veg mix',200,4,0.6,16.3,5.6,'X'],['Sweet chilli sauce',90,0.7,0.7,35.3,0,'F'],['Oil',5,0,5,0,0,'F']] },
  { id:'tofu_noodles', name:'Tofu Noodles', band:[600,1400], mr:false, vg:'noodles', plant:true,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Smoked tofu',200,28,16,1.8,2,'P'],['Wheat noodles (dry)',100,13,1.5,74.7,3.2,'S'],['Asian veg mix',200,4,0.6,16.3,5.6,'X'],['Sweet chilli sauce',90,0.7,0.7,35.3,0,'F'],['Oil',5,0,5,0,0,'F']] },
  { id:'burgers_meat', name:'Burgers & Carrot Sticks', band:[650,1450], mr:false, vg:'burgers',
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Burger patties',200,34,30,4.2,0,'P'],['Burger buns',120,11.8,4.7,58,2.1,'S'],['Carrots',200,1.8,0.4,13.6,5.6,'X'],['Onion slices',50,0.6,0.1,3.8,0.9,'X'],['Pickles',50,0.2,0.2,0.7,0.5,'X'],['Mustard',50,1.9,1.6,0.9,2,'F'],['Ketchup',50,0.5,0.1,14,0.1,'F']] },
  { id:'burgers_plant', name:'Plant Burgers & Carrot Sticks', band:[600,1400], mr:false, vg:'burgers', plant:true,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Plant-based burger',200,34,26,8.8,1.8,'P'],['Burger buns',120,11.8,4.7,58,2.1,'S'],['Carrots',200,1.8,0.4,13.6,5.6,'X'],['Onion slices',50,0.6,0.1,3.8,0.9,'X'],['Pickles',50,0.2,0.2,0.7,0.5,'X'],['Mustard',50,1.9,1.6,0.9,2,'F'],['Ketchup',50,0.5,0.1,14,0.1,'F']] },
  { id:'wraps_meat', name:'Wraps', band:[550,1200], mr:false, vg:'wraps',
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Ground meat',100,21,7.1,0,0,'P'],['Lentils (canned)',200,10.8,0.8,28,13,'S'],['Small tortillas',130,12.7,12.7,59.7,12.7,'S'],['Onion',100,1.1,0.1,7.6,1.7,'X'],['Bell pepper',100,1,0.3,3.9,2.1,'X'],['Romaine',100,1.2,0.3,1.2,2.1,'X'],['Hot salsa',150,2.2,0.3,7.1,2.8,'F']] },
  { id:'wraps_plant', name:'Wraps', band:[550,1250], mr:false, vg:'wraps', plant:true,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Plant-based mince',100,14,8.6,9.4,0,'P'],['Lentils (canned)',200,10.8,0.8,28,13,'S'],['Small tortillas',130,12.7,12.7,59.7,12.7,'S'],['Onion',100,1.1,0.1,7.6,1.7,'X'],['Bell pepper',100,1,0.3,3.9,2.1,'X'],['Romaine',100,1.2,0.3,1.2,2.1,'X'],['Hot salsa',150,2.2,0.3,7.1,2.8,'F']] },
  { id:'burrito_lg', name:'Burrito Bowl', band:[450,1050], mr:false, vg:'burritolg',
    diet:{meat:1,pork:0,fish:0,dairy:1,egg:0,gluten:0},
    ings:[['Ground meat',150,32,10.6,0,0,'P'],['Kidney beans',150,7.8,0.6,22,6.5,'S'],['Sweet corn',150,3.5,1.8,26,3,'S'],['Greek yogurt',150,13.5,7.5,6,0,'P'],['Romaine',100,1.2,0.3,1.2,2.1,'X'],['Onion',100,1.1,0.1,7.6,1.7,'X'],['Tomato',150,1.3,0.3,4,1.8,'X']] },
  { id:'burrito_vegan', name:'Vegan Burrito Bowl', band:[400,900], mr:false, vg:'burritolg', plant:true,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Plant-based mince',100,14,8.6,9.4,0,'P'],['Kidney beans',150,7.8,0.6,22,6.5,'S'],['Sweet corn',150,3.5,1.8,26,3,'S'],['Soy yogurt',150,5.4,2.7,14.6,1.5,'P'],['Romaine',100,1.2,0.3,1.2,2.1,'X'],['Onion',100,1.1,0.1,7.6,1.7,'X'],['Tomato',150,1.3,0.3,4,1.8,'X']] },
  { id:'chili_meat', name:'Chili', band:[450,700], mr:false, vg:'chili',
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Ground meat',150,32,10.6,0,0,'P'],['Kidney beans',260,13.5,1,40,11.8,'P'],['Diced tomatoes (can)',400,3.2,0.4,12,4,'F'],['Onion',150,1.6,0.2,11.5,2.5,'X'],['Carrot',100,0.9,0.2,6.8,2.8,'X'],['Chilli peppers (x2)',75,1.5,0.5,4.5,0,'X'],['Oil',10,0,10,0,0,'F']] },
  { id:'chili_vegan', name:'Vegan Chili', band:[500,750], mr:false, vg:'chili', plant:true,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Plant-based mince',150,21,12.9,14.1,0,'P'],['Kidney beans',260,13.5,1,40,11.8,'P'],['Diced tomatoes (can)',400,3.2,0.4,12,4,'F'],['Onion',150,1.6,0.2,11.5,2.5,'X'],['Carrot',100,0.9,0.2,6.8,2.8,'X'],['Chilli peppers (x2)',75,1.5,0.5,4.5,0,'X'],['Oil',10,0,10,0,0,'F']] },

  // ---------------- PESCATARIAN DINNERS ----------------
  { id:'salmon_potato', name:'Salmon & Baked Potatoes', band:[600,1350], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:1,dairy:0,egg:0,gluten:0},
    ings:[['Salmon',200,42,8.8,0,0,'P'],['Potatoes (raw)',400,14,0.8,121.2,14.4,'S'],['Oil',10,0,10,0,0,'F']] },
  { id:'trout_rice', name:'Trout & Veggie Rice', band:[550,1300], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:1,dairy:0,egg:0,gluten:0},
    ings:[['Trout',200,40,12.4,0,0,'P'],['White rice (dry)',80,5.7,0.6,63,1,'S'],['Frozen veg mix',250,7.8,1.2,32,10.7,'X'],['Oil',10,0,10,0,0,'F'],['Soy sauce',20,1.6,0.1,0.8,0,'F']] },
  { id:'tuna_pasta', name:'Tuna Pasta', band:[450,1050], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:1,dairy:0,egg:0,gluten:1},
    ings:[['Tuna (drained)',130,25,1.3,0,0,'P'],['Wheat pasta (dry)',100,13,1.5,74.7,0,'S'],['Olive oil',15,0,15,0,0,'F'],['Lemon juice',50,0.2,0.1,3.3,0,'F'],['Garlic clove',5,0.2,0,1,0,'X'],['Green olives',25,0.2,4,0.1,0.8,'F']] },

  // ---------------- VEGETARIAN DINNERS (eggs + higher-fat cheese; also for bulk) ----------------
  { id:'frittata', name:'Cottage Cheese & Veggie Frittata', band:[650,1550], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:1,gluten:0},
    ings:[['Eggs',250,30,25,0,0,'P'],['Cottage cheese',100,11,4.3,3.4,0,'P'],['Cheddar cheese',80,18,26,2.7,0,'P'],['Spinach',50,1.5,0.2,0.7,1.1,'X'],['Red onion',150,1.6,0.2,11.5,2.5,'X'],['Bell pepper',150,1.5,0.4,5.8,3.1,'X'],['Tomato',150,1.4,0.3,4.1,1.8,'X'],['Oil',10,0,10,0,0,'F']] },
  { id:'quesadillas', name:'Cheese & Veggie Quesadillas', band:[700,1650], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:0,gluten:1},
    ings:[['Cheddar cheese',100,23,33,3.4,0,'P'],['Small tortillas',130,12.7,12.7,59.7,12.7,'S'],['Black beans (canned)',120,7.2,0.4,20,5,'S'],['Onion',100,1.1,0.1,7.6,1.7,'X'],['Bell pepper',100,1,0.3,3.9,2.1,'X'],['Oil',10,0,10,0,0,'F']] },
  { id:'cheese_pasta', name:'Cheese & Veggie Pasta', band:[650,1450], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:0,gluten:1},
    ings:[['Mozzarella',100,22,22,2.4,0,'P'],['Cottage cheese',100,11,4.3,3.4,0,'P'],['Whole wheat pasta (dry)',100,14,2.9,72,9.2,'S'],['Frozen broccoli',100,2.8,0.4,4,2.6,'X'],['Cherry tomato',100,0.9,0.2,2.7,1.2,'X'],['Zucchini',150,1.8,0.4,3.2,1.5,'X'],['Garlic',15,1,0.1,5,0.3,'X'],['Oil',10,0,10,0,0,'F']] },
  { id:'gallo_pinto', name:'Gallo Pinto with Fried Eggs', band:[650,1450], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:1,gluten:0},
    ings:[['Eggs',250,30,25,0,0,'P'],['Brown rice (dry)',50,3.7,1.4,37,1.7,'S'],['Kidney beans (canned)',260,13.5,1,40,11.8,'S'],['Onion',100,1.1,0.1,7.6,1.7,'X'],['Bell pepper',100,1,0.3,3.9,2.1,'X'],['Garlic',10,0.6,0.1,3,0.2,'X'],['Oil',10,0,10,0,0,'F'],['Soy sauce',20,1.6,0.1,0.8,0,'F']] },
  // ---------------- ADDED: CHICKEN SANDWICHES + NOODLES ----------------
  { id:'chicken_sandwiches', name:'Chicken Sandwiches', band:[600,1350], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:1,gluten:1},
    ings:[['Chicken ham',150,33,3.8,2.7,0,'P'],['Bread',180,22,6.3,67,10.8,'S'],['Pickles',100,0.5,0.3,1.4,1,'X'],['Mustard',50,1.9,1.6,0.9,2,'F'],['Mayo',30,0.3,23,0.2,0,'F'],['Iceberg lettuce',100,0.9,0.2,1.8,1.2,'X'],['Cherry tomato',100,0.9,0.2,2.7,1.2,'X']] },
  { id:'chicken_sandwiches_apple', name:'Chicken Sandwiches & Apple', band:[450,1100], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:1,gluten:1},
    ings:[['Chicken ham',100,22,2.5,1.8,0,'P'],['Bread',120,14,4.2,44,7.2,'S'],['Pickles',75,0.4,0.2,1,0.7,'X'],['Ketchup',50,0.5,0.1,14,0.1,'F'],['Mayo',20,0.2,15,0.1,0,'F'],['Iceberg lettuce',100,0.9,0.2,1.8,1.2,'X'],['Large apple',220,0.6,0.4,24,5,'S']] },
  { id:'chicken_sandwiches_cucumber', name:'Chicken Sandwiches & Cucumber Salad', band:[450,1050], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:1,gluten:1},
    ings:[['Chicken ham',100,22,2.5,1.8,0,'P'],['Bread',120,14,4.2,44,7.2,'S'],['Pickles',75,0.4,0.2,1,0.7,'X'],['Ketchup',50,0.5,0.1,14,0.1,'F'],['Mayo',20,0.2,15,0.1,0,'F'],['Iceberg lettuce',100,0.9,0.2,1.8,1.2,'X'],['Cucumber',200,0.6,0.2,3.2,0.5,'X'],['Onion',100,1.1,0.1,7.6,1.7,'X'],['Balsamic vinegar',50,0.2,0,9,0,'F']] },
  { id:'chicken_instant_noodles', name:'Chicken Instant Veggie Noodles', band:[400,950], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Chicken breast',150,30,4.5,0,0,'P'],['Instant noodle pack',75,5.1,14.3,35,1.9,'S'],['Asian veggie mix (frozen)',300,6,0.9,24.4,8.4,'X'],['Oil',5,0,5,0,0,'F']] },

  // ---------------- ADDED: BULK BATCH 1 (shared library, untagged) ----------------
  { id:'cheese_pasta_gouda', name:'Cheese Pasta', band:[750,1750], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:0,gluten:1},
    ings:[['White pasta (dry)',200,26,3,149.3,6.4,'S'],['Gouda cheese',50,13,14,1.1,0,'P'],['Cheddar cheese',50,12,17,1.7,0,'P']] },
  { id:'parmesan_spaghetti', name:'Cacio e Pepe', band:[750,1750], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:0,gluten:1},
    ings:[['White pasta (dry)',200,26,3,149.3,6.4,'S'],['Parmesan',50,18,13,1.7,0,'P'],['Olive oil',20,0,20,0,0,'F'],['Black pepper',3,0.3,0.1,1.6,0.8,'X']] },
  { id:'spaghetti_bolognaise', name:'Spaghetti Bolognaise', band:[700,1600], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['White pasta (dry)',200,26,3,149.3,6.4,'S'],['Bolognaise sauce (canned)',400,19.6,12.4,26,0,'P']] },
  { id:'pb_banana_toast', name:'Peanut Butter & Banana Toast', band:[750,1750], mr:false, vg:'pb_banana',
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Bread',180,16,6,85,4.9,'S'],['Peanut butter',75,17,38,13,3.7,'P'],['Medium banana',240,2.6,0.8,48,6.2,'S']] },
  { id:'buttered_rice_eggs', name:'Buttered Rice with Fried Eggs', band:[650,1450], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:1,gluten:0},
    ings:[['White rice',160,11.4,1.2,126,2,'S'],['Eggs',150,18,15,0,0,'P'],['Butter',20,0.2,16,0,0,'F']] },
  { id:'cheese_quesadillas', name:'Cheese & Bean Quesadillas', band:[700,1600], mr:false, vg:null,
    diet:{meat:0,pork:0,fish:0,dairy:1,egg:0,gluten:1},
    ings:[['Small tortillas',195,19,19,70,19,'S'],['Cheddar cheese',100,23,33,3.4,0,'P'],['Red kidney beans (canned)',150,7.8,0.6,17,0,'S']] },
  { id:'pb_quesadillas', name:'Peanut Butter Quesadillas', band:[600,1400], mr:false, vg:'pb_banana', plant:true,
    diet:{meat:0,pork:0,fish:0,dairy:0,egg:0,gluten:1},
    ings:[['Small tortillas',130,12.7,12.7,47,12.7,'S'],['Peanut butter',60,13,31,10,3,'P'],['Large banana',120,1.5,0.5,28,3.6,'S'],['Granola',20,2,2,13,0,'F']] },
  { id:'chicken_buttered_rice', name:'Chicken Buttered Rice', band:[650,1550], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:1,egg:0,gluten:0},
    ings:[['White rice',200,14.2,1.4,158,2.6,'S'],['Chicken thighs (no skin)',100,20,4.1,0,0,'P'],['Butter',20,0.2,16,0,0,'F']] },
  { id:'meat_potato_fries', name:'Chicken & Fries', band:[700,1550], mr:false, vg:null,
    diet:{meat:1,pork:0,fish:0,dairy:0,egg:0,gluten:0},
    ings:[['Chicken thighs (no skin)',200,40,8.2,0,0,'P'],['Frozen potato fries (raw)',400,9.6,18,97.2,11.2,'S'],['Pickles',150,0.8,0.4,2.1,1.5,'X'],['Garlic sauce',50,1.7,9.9,3.1,0.9,'F'],['Ketchup',50,0.5,0.1,14,0.1,'F']] },

];



// energy: 4/9/4 with fiber at 2 kcal/g
const kcalMacro = (p,f,c,fib)=> 4*p + 9*f + 4*c - 2*fib;
const ingKcal = (ig)=> kcalMacro(ig[2],ig[3],ig[4],ig[5]);
const ingP = (ig)=> ig[2];

// Cooking weight change, used ONLY for the calorie-density (food-volume) metric — never
// for macros or solving. Dry starches soak up water and expand; baked potatoes lose
// water and shrink. This makes density reflect the volume actually on the plate.
const COOK_FACTOR = {
  // dry starches soak up water and expand
  'White rice (dry)':2.5, 'White rice':2.5, 'Brown rice (dry)':2.5,
  'White pasta (dry)':2.5, 'Wheat pasta (dry)':2.5, 'Whole wheat pasta (dry)':2.5,
  'Chickpea/lentil pasta (dry)':2.5, 'Wheat noodles (dry)':2.5, 'Instant noodle pack':2.5,
  // baked/roasted lose water and shrink
  'Potatoes (raw)':0.6, 'Frozen potato fries (raw)':0.8,
  // cooked meats/fish lose ~30% (deli ham, canned tuna, eggs already cooked -> ~1x)
  'Chicken breast':0.7, 'Chicken thighs':0.7, 'Chicken thighs (no skin)':0.7,
  'Ground meat':0.7, 'Lean ground meat':0.7, 'Pork tenderloin':0.7,
  'Salmon':0.7, 'Trout':0.7, 'Sausage':0.7,
  'Plant-based mince':0.85, 'Plant-based sausage':0.85,
  // sauteed aromatics shrink hard (~half); boiled/steamed veg barely change; raw = 1x
  'Onion':0.5, 'Onion slices':0.5, 'Red onion':0.5, 'Bell pepper':0.5,
  'Mushrooms':0.5, 'Zucchini':0.5, 'Chilli peppers (x2)':0.5, 'Spinach':0.7,
  'Carrot':0.9, 'Carrots':0.8,
  'Frozen green beans':0.9, 'Frozen peas':0.9, 'Frozen broccoli':0.9,
  'Frozen veg mix':0.9, 'Asian veg mix':0.9, 'Asian veggie mix (frozen)':0.9,
};
const cookFactor = (name)=> COOK_FACTOR[name] || 1;

// Discrete ingredients that must land on whole units (or half-units for cans), so plans
// never show "2.75 tortillas" as grams. unit = grams per unit; step = smallest fraction
// allowed (1 = whole units only; 0.5 = half-can allowed); noun/nounPl = display label.
const UNIT = {
  'Eggs':            {unit:50,  step:1,   noun:'egg',           nounPl:'eggs'},
  'Bread':           {unit:30,  step:1,   noun:'slice',         nounPl:'slices'},
  'Small tortillas': {unit:40,  step:1,   noun:'tortilla',      nounPl:'tortillas'},
  'Burger buns':     {unit:60,  step:1,   noun:'bun',           nounPl:'buns'},
  'Burger patties':  {unit:100, step:1,   noun:'patty',         nounPl:'patties'},
  'Instant noodle pack':{unit:75,step:1,  noun:'pack',          nounPl:'packs'},
  'Large apple':     {unit:220, step:1,   noun:'apple',         nounPl:'apples'},
  'Large banana':    {unit:120, step:1,   noun:'banana',        nounPl:'bananas'},
  'Medium banana':   {unit:100, step:1,   noun:'banana',        nounPl:'bananas'},
  'Trout':           {unit:200, step:1,   noun:'fillet',        nounPl:'fillets'},
  // cans: half-can allowed
  'Tuna (drained)':  {unit:130, step:0.5, noun:'can',           nounPl:'cans'},
  'Kidney beans':    {unit:260, step:0.5, noun:'can',           nounPl:'cans'},
  'Kidney beans (canned)':{unit:260,step:0.5,noun:'can',        nounPl:'cans'},
  'Lentils (canned)':{unit:260,step:0.5,noun:'can',       nounPl:'cans'},
  'Red kidney beans (canned)':{unit:260,step:0.5,noun:'can',    nounPl:'cans'},
  'Black beans (canned)':{unit:260,step:0.5,noun:'can',         nounPl:'cans'},
  'Baked beans (can)':{unit:260,step:0.5, noun:'can',           nounPl:'cans'},
  'Mushrooms (canned)':{unit:150,step:0.5,noun:'can',           nounPl:'cans'},
  'Sweet corn':      {unit:260, step:0.5, noun:'can',           nounPl:'cans'},
  'Diced tomatoes (can)':{unit:400,step:0.5,noun:'can',         nounPl:'cans'},
};
// snap grams to the nearest allowed unit count (min one step), return {grams,label}
// label is the full display string, e.g. "3 eggs", "2 slices bread", "1.5 cans kidney beans"
function snapUnit(name, g){
  const u=UNIT[name]; if(!u) return null;
  let n=Math.round(g/u.unit/u.step)*u.step; if(n<u.step) n=u.step;
  const grams=Math.round(n*u.unit);
  const noun = n===1 ? u.noun : u.nounPl;
  const count = Number.isInteger(n) ? String(n) : n.toFixed(1);
  const clean = name.replace(/\s*\(.*/,'').toLowerCase();  // "small tortillas", "kidney beans"
  // If the food name already reads as the countable thing (tortillas, patties, buns),
  // just use it directly ("2 small tortillas"). Otherwise append food after the unit noun
  // ("2 slices bread", "0.5 cans kidney beans"). For whole foods the noun IS the food
  // ("3 eggs", "1 apple") so no food name is appended.
  const foodIsNoun = ['egg','eggs','apple','apples','banana','bananas','fillet','fillets'].includes(noun);
  const nameIsCountable = clean.includes(u.nounPl) || clean.includes(u.noun); // "tortillas","patties","buns"
  let label;
  if(foodIsNoun) label = `${count} ${noun}`;
  else if(nameIsCountable) label = `${count} ${clean}`;
  else label = `${count} ${noun} ${clean}`;
  return {grams, label};
}

// PTOL: protein may land within +/-5g of target (Radu's rule). BAND_GRACE: a meal
// is only offered where the slot target sits inside its written calorie band.
// PHI (protein-high allowance): on a BULK, protein may run OVER target by this much
// beyond PTOL (default 0 = symmetric, so the cut is unchanged). Overshoot is nearly
// free on a bulk — extra protein displaces carbs at equal kcal, so total calories
// still land, and more protein while gaining is fine. Undershoot stays capped at PTOL.
const TUNE = { spMin:0.35, spMax:2.6, srMin:0.3, srMax:3.2, VD:0.55, vMin:0.6, vMax:1.9, PTOL:5, PHI:0, PROP:2.6, DENS_DIV:900, BAND_GRACE:0.03, MAXDRIFT:0.12 };

// Directional protein-fit test: achieved protein within [-PTOL, +(PTOL+PHI)] of target.
function proteinFits(achP, P, T){ const d = Math.round(achP) - P; return d >= -T.PTOL && d <= T.PTOL + T.PHI; }

function groupSums(ings){ let k=0,p=0; ings.forEach(ig=>{k+=ingKcal(ig); p+=ingP(ig);}); return {k,p}; }
function solve2(a1,b1,c1,a2,b2,c2){ const det=a1*b2-b1*a2; if(Math.abs(det)<1e-6) return null; return [(c1*b2-b1*c2)/det,(a1*c2-c1*a2)/det]; }

function solveMeal(meal, K, P, T=TUNE){
  // band gate: don't scale a meal outside the range it was written for
  if(meal.band && (K < meal.band[0]*(1-T.BAND_GRACE) || K > meal.band[1]*(1+T.BAND_GRACE))) return {feasible:false};

  // THREE LEVERS, by ingredient role:
  //   P (protein)            -> scales on its own to hit the protein target
  //   S (starch) + F (fats/oils/condiments/sauces) -> scale TOGETHER as the main
  //        calorie lever (double the rice -> double the cooking oil; pile on potatoes
  //        to add calories). Written proportions inside this group stay intact.
  //   X (whole veg / fruit / sides) -> DAMPED: a bigger meal has somewhat more veg
  //        but not proportionally, so it never balloons to a mountain of vegetables.
  // The protein serving moves relative to the lever group; a drift guard (PROP) drops
  // any plate where that gap gets unnatural.
  const Pg = meal.ings.filter(i=>i[6]==='P');
  const Lg = meal.ings.filter(i=>i[6]==='S'||i[6]==='F');   // starch + fats = lever
  const Xg = meal.ings.filter(i=>i[6]==='X');               // veg/sides = damped
  const base = groupSums(meal.ings);
  const gp = groupSums(Pg), gl = groupSums(Lg), gx = groupSums(Xg);
  const s = K/base.k;                                        // overall meal scale
  // veg tracks the meal only partway (moderate drift), bounded
  const scaleX = clamp(1 + T.VD*(s-1), T.vMin, T.vMax);
  let scaleP, scaleL, mode;

  if(Pg.length && Lg.length){
    // hit protein & calories with the veg fixed at scaleX:
    //   gp.p*sp + gl.p*sl = P - gx.p*scaleX
    //   gp.k*sp + gl.k*sl = K - gx.k*scaleX
    const sol = solve2(gp.p, gl.p, P - gx.p*scaleX, gp.k, gl.k, K - gx.k*scaleX);
    if(sol && sol[0]>=T.spMin && sol[0]<=T.spMax && sol[1]>=T.srMin && sol[1]<=T.srMax){
      scaleP=sol[0]; scaleL=sol[1]; mode='3lever';
    } else {
      // fallback: scale protein + lever TOGETHER to hit calories, protein floats in tol
      const u=(K - gx.k*scaleX)/(gp.k+gl.k);
      if(u>=T.srMin && u<=T.srMax && proteinFits(u*(gp.p+gl.p)+gx.p*scaleX, P, T)){
        scaleP=u; scaleL=u; mode='coupled';
      } else return {feasible:false};
    }
  } else if(Lg.length){
    // no protein group: lever hits calories, protein floats
    const u=(K - gx.k*scaleX)/gl.k;
    if(u<T.srMin||u>T.srMax) return {feasible:false};
    if(!proteinFits(u*gl.p+gx.p*scaleX, P, T)) return {feasible:false};
    scaleP=1; scaleL=u; mode='lever-only';
  } else {
    // only protein (+veg): protein hits calories, floats on protein
    const u=(K - gx.k*scaleX)/gp.k;
    if(u<T.spMin||u>T.spMax) return {feasible:false};
    if(!proteinFits(u*gp.p+gx.p*scaleX, P, T)) return {feasible:false};
    scaleP=u; scaleL=1; mode='protein-only';
  }

  // drift guard: protein serving must stay in proportion with the lever group
  const drift = Math.max(scaleP/scaleL, scaleL/scaleP);
  if(drift > T.PROP) return {feasible:false};

  const scaleOf=(role)=> role==='P'?scaleP: (role==='S'||role==='F')?scaleL: scaleX;

  // STEP 1: snap discrete/countable ingredients to whole (or half-can) units at their
  // solved scale, and freeze them. STEP 2: re-solve the CONTINUOUS protein and lever
  // ingredients to hit K and P around those frozen contributions, so the whole-unit
  // rounding is absorbed by the continuous foods instead of drifting the totals.
  const snapped = new Map(); // ingredient -> {grams, label}
  let fixedK=0, fixedP=0;    // macro contribution of frozen (snapped) + veg ingredients
  meal.ings.forEach(ig=>{
    const g0=Math.max(5, Math.round(ig[1]*scaleOf(ig[6])/5)*5);
    const snap=snapUnit(ig[0], g0);
    if(snap){ const r=snap.grams/ig[1]; snapped.set(ig, {grams:snap.grams,label:snap.label}); fixedK+=ingKcal(ig)*r; fixedP+=ig[2]*r; }
  });
  // veg (X) is fixed at scaleX; its contribution is also "fixed" for the re-solve
  const contP = Pg.filter(ig=>!snapped.has(ig));  // continuous protein ingredients
  const contL = Lg.filter(ig=>!snapped.has(ig));  // continuous lever ingredients
  const cp=groupSums(contP), cl=groupSums(contL);
  const fixedFromX = { k: gx.k*scaleX, p: gx.p*scaleX };
  // targets left for the continuous groups after frozen items + veg
  const remK = K - fixedK - fixedFromX.k, remP = P - fixedP - fixedFromX.p;
  if(cp.k>0 && cl.k>0){
    const sol=solve2(cp.p,cl.p,remP, cp.k,cl.k,remK);
    if(sol){ scaleP=sol[0]; scaleL=sol[1]; }
  } else if(cl.k>0){ scaleL=remK/cl.k; }
  else if(cp.k>0){ scaleP=remK/cp.k; }
  // clamp so the absorb step can't produce a crazy portion; if it does, keep original scales
  if(!(scaleP>=T.spMin*0.5 && scaleP<=T.spMax*1.5 && scaleL>=T.srMin*0.5 && scaleL<=T.srMax*1.5)){
    scaleP = scaleOf('P'); // revert (unlikely)
  }

  let aK=0,aP=0,aF=0,aC=0,aFib=0,grams=0,cookedGrams=0;
  const portions = meal.ings.map(ig=>{
    let g, label=null;
    if(snapped.has(ig)){ const s=snapped.get(ig); g=s.grams; label=s.label; }
    else { const sc = ig[6]==='P'?scaleP : (ig[6]==='S'||ig[6]==='F')?scaleL : scaleX;
      g=Math.max(5, Math.round(ig[1]*sc/5)*5); }
    const r=g/ig[1];
    aK+=kcalMacro(ig[2]*r,ig[3]*r,ig[4]*r,ig[5]*r); aP+=ig[2]*r; aF+=ig[3]*r; aC+=ig[4]*r; aFib+=ig[5]*r; grams+=g;
    cookedGrams += g * cookFactor(ig[0]);
    return label ? {name:ig[0], grams:g, label} : {name:ig[0], grams:g};
  });
  const cookedDensity = aK/cookedGrams;
  // HARD VOLUME FLOOR: a meal must be at least as calorie-dense (cooked) as K/DENS_DIV,
  // so high-volume meals are excluded from high-calorie slots (a 900 kcal slot needs
  // density >= 1.0; a 1200 slot >= 1.33). Density is cooked-weight, so it reflects the
  // real food volume on the plate, not dry pasta/rice weight.
  if(cookedDensity < K/T.DENS_DIV) return {feasible:false};

  return { feasible:true, mode, portions,
    kcal:Math.round(aK), protein:Math.round(aP), fat:Math.round(aF), carbs:Math.round(aC), fiber:Math.round(aFib),
    density: Math.round(cookedDensity*100)/100, grams:Math.round(grams),
    scaleP:Math.round(scaleP*100)/100, scaleS:Math.round(scaleL*100)/100, scaleX:Math.round(scaleX*100)/100 };
}

function eligible(meal, restr){
  const d=meal.diet; const r=(restr&&restr.length)?restr:['none'];
  if(r.includes('none')) return true;
  for(const x of r){
    if(x==='vegan' && (d.meat||d.pork||d.fish||d.dairy||d.egg)) return false;
    if(x==='vegetarian' && (d.meat||d.pork||d.fish)) return false;
    if((x==='pescatarian'||x==='nomeat') && (d.meat||d.pork)) return false;
    if(x==='nopork' && d.pork) return false;
    if(x==='nodairy' && d.dairy) return false;
    if(x==='gluten' && d.gluten) return false;
  }
  return true;
}
const isVegan=(m)=>{const d=m.diet;return !(d.meat||d.pork||d.fish||d.dairy||d.egg);};


// Recipe steps per meal id (Radu's final wording). Method only; the card shows
// the scaled ingredient weights separately. Rendered as a numbered list behind a
// "See recipe" toggle.
const STEPS = {
  cheese_pasta_gouda: [
    "Cook the pasta and drain it, leaving a little water in the bottom of the pot.",
    "Grate the gouda and cheddar into the hot pasta and stir, so the cheese melts and coats the pasta.",
  ],
  parmesan_spaghetti: [
    "Cook the spaghetti, then drain it but leave a little of the starchy water in the pot.",
    "Off the heat, add the olive oil, black pepper, and grated parmesan to the pot.",
    "Toss hard until the cheese melts into the water and oil and turns creamy, coating the pasta. Add a splash more hot water if it needs loosening.",
  ],
  spaghetti_bolognaise: [
    "Cook and drain the spaghetti.",
    "Warm the bolognaise sauce and spoon it over the top.",
  ],
  pb_banana_toast: [
    "Toast the bread.",
    "Spread the peanut butter across the slices and top with sliced banana.",
  ],
  buttered_rice_eggs: [
    "Toss the hot rice with the butter so it melts through, and season with soy sauce or whatever condiments you like.",
    "Fry the eggs and serve them on the side.",
  ],
  cheese_quesadillas: [
    "Spread the beans over the tortillas and top with shredded cheddar, then fold each in half.",
    "Cook in a hot skillet 3 to 4 minutes per side, until golden and the cheese is melted.",
  ],
  pb_quesadillas: [
    "Spread the peanut butter over each tortilla, add sliced banana, and sprinkle with granola.",
    "Fold in half and cook on a dry pan a minute or two until lightly browned and the peanut butter softens.",
  ],
  chicken_buttered_rice: [
    "Toss the hot rice with the butter so it melts through, and season with soy sauce or whatever condiments you like.",
    "Pan-cook the chicken thighs and serve them on the side.",
  ],
  meat_potato_fries: [
    "Cut the chicken thighs into strips and season them. Lay them on a sheet of foil with the edges curled up so the fat doesn't run onto the tray.",
    "Add the frozen fries to the same tray and bake 20 to 25 minutes.",
    "Serve with the pickles, garlic sauce, and ketchup.",
  ],

  chicken_sandwiches: [
    "Cut the chicken ham into strips and slice the pickles.",
    "Spread mustard on one slice of bread and mayo on the other.",
    "Layer the chicken, pickles, and lettuce between the slices to build each sandwich.",
    "Serve the cherry tomatoes on the side.",
  ],
  chicken_sandwiches_apple: [
    "Cut the chicken ham into strips and slice the pickles.",
    "Spread ketchup on one slice of bread and mayo on the other.",
    "Layer the chicken, pickles, and lettuce between the slices to build each sandwich.",
    "Serve the apple on the side.",
  ],
  chicken_sandwiches_cucumber: [
    "Cut the chicken ham into strips and slice the pickles.",
    "Spread ketchup on one slice of bread and mayo on the other.",
    "Layer the chicken, pickles, and lettuce between the slices to build each sandwich.",
    "Slice the cucumber and onion, toss with balsamic vinegar, and serve the salad on the side.",
  ],
  chicken_instant_noodles: [
    "Cut the chicken into cubes or strips and stir-fry in a little oil for a few minutes until golden.",
    "Add the frozen veggie mix on top and cover with water. Cook 10 to 15 minutes until the veggies are tender.",
    "Stir in the instant noodle pack. The noodles absorb the water, leaving you with a full meal.",
  ],

  huel: [
    "Shake the powder with cold water (roughly 500 ml for two scoops) and drink.",
  ],
  shake_fruit: [
    "Shake the protein powder with cold water.",
    "Eat the bananas alongside.",
  ],
  bars_fruit: [
    "Pack protein bars and fruit and serve at your meal time. This replaces a meal when you're short on time or away from home.",
  ],
  chicken_fajitas: [
    "Slice the chicken and season with paprika, cumin, garlic powder, and salt.",
    "Sear it in a non-stick pan with the measured oil until browned, then set aside. (Or season and bake it, no oil needed.)",
    "Cook the peppers and onion with a bit of water in the same pan (water will prevent them from sticking).",
    "Mix the chicken and the veggies, add the salsa on top, and serve.",
  ],
  chicken_peas: [
    "Slice the chicken thighs and season with salt, pepper, and garlic, then sear in a non-stick pan (thighs are fatty enough that you can cook them with little to no oil and will not stick).",
    "Cook the frozen peas and carrots until tender (boil them in a pot of water, or cook them in a pan with a bit of water, covered, stirring often).",
    "Season the peas and carrots with garlic and chilli, combine with the chicken, and serve.",
  ],
  chicken_greenbeans: [
    "Slice the chicken thighs and season with salt, pepper, and garlic, then sear in a non-stick pan (thighs are fatty enough to cook with little to no oil and will not stick).",
    "Cook the frozen green beans and carrots until tender (boil them in a pot of water, or cook them in a pan with a bit of water, covered, stirring often).",
    "Season with garlic and chilli, combine with the chicken, and serve.",
  ],
  burrito_sm: [
    "Cook the ground meat together with the onion and peppers in a non-stick pan with the measured oil, breaking it into small pieces as it cooks, and season with cumin, paprika, and garlic.",
    "Drain and rinse the canned kidney beans and add to the pan to heat.",
    "Put everything in a bowl and add the salsa on top.",
  ],
  tuna_salad: [
    "Drain the tuna and mix it with the Greek yogurt, mayo, and mustard into a creamy dressing.",
    "Chop the lettuce, onion, tomato, and olives and mix them in a large bowl.",
    "Fold the tuna dressing through, season with black pepper, and add a squeeze of lemon or some hot sauce.",
  ],
  tuna_stirfry: [
    "Cook the frozen veg mix in a non-stick pan with the measured oil until soft.",
    "When the veggies are cooked, add the scrambled eggs on top and mix. Cook until done.",
    "Add the drained tuna, mix everything together, and season with soy sauce or chilli.",
  ],
  yogurt_mixfruit: [
    "Stir the frozen fruit into the yogurt and leave it a few minutes to soften (or heat the fruit briefly in the microwave). Add cinnamon on top if you like.",
  ],
  yogurt_fruit: [
    "Slice the apple and banana over the yogurt. Add cinnamon, or a little sweetener if you want it sweeter.",
  ],
  cottage_veg: [
    "Chop the cucumber, tomato, carrot, and onion and mix them into the cottage cheese.",
    "Season with salt, pepper, and herbs, or add some hot sauce.",
  ],
  smoothie: [
    "Blend the protein powder, bananas, flaxseed, and cold water until smooth. Add ice for a thicker drink.",
  ],
  protein_oats: [
    "Cook the oats with water on the stove or in the microwave until thick.",
    "Take them off the heat, then stir in the protein powder (adding it off the heat keeps it smooth).",
    "Add the sliced apple and banana on top.",
  ],
  protein_platter: [
    "Slice the tofu, tempeh, and seitan and cook them in a non-stick pan with the measured oil until golden on all sides. Season with soy sauce, garlic, or paprika.",
    "Wash and chop the tomato, carrot, and spinach and put them on the plate raw.",
    "Eat the vegetables fresh, between bites of the protein.",
  ],
  tofu_scramble: [
    "Mash the tofu with a fork, breaking it into small pieces.",
    "Add the tofu, mushrooms, onion and pepper together in a non-stick pan and cook with the measured oil until soft. Add water if they stick. Cook until the tofu is golden and dry and the veggies are soft.",
    "Season with salt, garlic, and black pepper.",
  ],
  tofu_lentil: [
    "No cooking needed, since smoked tofu is ready to eat. Cut it into cubes.",
    "Add the drained canned lentils, chopped tomato, and cucumber.",
    "Add the soy sauce and hot sauce and mix.",
  ],
  tofu_hummus: [
    "Cut the smoked tofu into cubes and chop the tomato, cucumber, and carrot.",
    "Put them on a plate with the hummus, to dip or spread.",
  ],
  pork_mushroom: [
    "Season the pork with salt, pepper, and paprika, cook it in a non-stick pan with the measured oil until done.",
    "Cook the mushrooms together with the pork in the same pan (they take on the flavour).",
    "Add the spinach at the end and cook until it softens (or add raw spinach leaves to your plate). Serve with the raw tomato and carrot on the side.",
  ],
  tofu_mushroom: [
    "Cut the smoked tofu into cubes and cook in a non-stick pan with the measured oil until golden.",
    "Add the mushrooms and cook until soft.",
    "Add the spinach and cook until it softens (or add raw spinach leaves to your plate). Serve with the tomato and carrot. Add peanuts on top for crunch. Add soy sauce or chilli if you like.",
  ],
  chicken_fajita_wrap: [
    "Slice the chicken and season with paprika, cumin, garlic powder, and salt.",
    "Sear it in a non-stick pan with the measured oil until browned, then set aside. (Or season and bake it, no oil needed.)",
    "Cook the peppers and onion with a bit of water in the same pan (water will prevent them from sticking).",
    "Mix the chicken and the veggies, spread an appropriate amount on the tortilla, add the salsa on top, and serve.",
  ],
  chicken_rice_greenbeans: [
    "Slice the chicken thighs and season with salt, pepper, and garlic, then sear in a non-stick pan (thighs are fatty enough to cook with little to no oil and will not stick).",
    "Add the dry rice to a pot, cover with water and boil until done.",
    "Cook the frozen green beans and carrots until tender (boil them in a pot of water, or cook them in a pan with a bit of water, covered, stirring often).",
    "Season with soy sauce, garlic or chilli, combine with the chicken, and serve.",
  ],
  egg_platter: [
    "Boil the eggs and cut them into wedges.",
    "Slice the tofu in sticks and cook it in a non-stick pan with the measured oil until golden on all sides. Season with soy sauce, garlic, or paprika.",
    "Wash the veggies, and chop the cucumber and carrot and put them on the plate raw.",
    "Place the measured hummus on the plate. Eat the vegetables fresh, or dip them into the hummus between bites.",
  ],
  chicken_rice: [
    "Add the dry rice and frozen veg mix to the same pot, cover with water and boil until done.",
    "Season and cook the chicken with the measured oil (in a pan or the oven), then slice it.",
    "Add the rice and chicken and mix together with the soy sauce. Adjust the quantity of rice to the target calories.",
  ],
  omelette: [
    "Cook the onion, pepper, and mushrooms in a non-stick pan with the measured oil until soft and lightly browned. This step is what makes it taste good.",
    "Beat the eggs, pour them over the vegetables, and cook, stirring, until set.",
    "Serve the cottage cheese on the side. Season with salt and pepper and hot sauce.",
  ],
  omelette_toast: [
    "Cook the onion, pepper, and mushrooms in a non-stick pan with the measured oil until soft and lightly browned. This step is what makes it taste good.",
    "Beat the eggs, pour them over the vegetables, and cook, stirring, until set.",
    "Serve the cottage cheese on the side and the toasted bread. Season with salt and pepper and hot sauce.",
  ],
  chicken_potato: [
    "Peel the potatoes, cut them into wedges or sticks, coat them with a little oil, and cook in the oven or air fryer until soft and golden.",
    "Season the chicken thighs and cook them in a pan or the oven.",
    "Serve with ketchup, pickles, or hot chilli peppers. Adjust the quantity of potatoes to the target calories.",
  ],
  mockmeat_potato: [
    "Peel the potatoes, cut them into wedges or sticks, coat them with a little oil, and cook in the oven or air fryer until soft and golden.",
    "Cook the plant-based mock meat following the pack instructions, in a pan or the oven.",
    "Serve with ketchup, pickles, or hot chilli peppers. Adjust the quantity of potatoes to the target calories.",
  ],
  chickpea_pasta: [
    "Boil the pasta. Check it often, because legume pasta gets soft faster than wheat pasta. Don't overboil to avoid it getting soggy.",
    "Heat the tomato sauce or add it straight from the jar on top of the pasta.",
    "Mix them together and season with garlic, chilli, and herbs.",
  ],
  beans_sausage: [
    "Cook the sausages in a pan (little to no oil, since they release their own fat) or in the air fryer.",
    "Heat the whole can of baked beans or add as is to a bowl.",
    "Add the sausages. Serve with the pickles on the side. Add canned mushrooms if you want extra food volume.",
  ],
  beans_pbsausage: [
    "Cook the plant sausages following the pack instructions, in a pan with a little oil or in the air fryer.",
    "Heat the whole can of baked beans or add as is to a bowl.",
    "Add the sausages. Serve with the pickles on the side. Add canned mushrooms if you want extra food volume.",
  ],
  chicken_proteinbowl: [
    "Season and cook the chicken (in a pan or the oven), then slice it.",
    "Cook the pre-made falafel (in a pan, microwave, or air fryer) or serve as is, if it's pre-cooked.",
    "Chop the tomato, carrot, and onion.",
    "Put everything in a bowl and add the hummus, to dip or spread.",
  ],
  chicken_noodles: [
    "Add the Asian veg mix to a pot, cover with water and boil for 10 minutes. Then add the noodles to the same boiling pot. Cook until soft.",
    "Season and cook the chicken on a pan with the measured oil, then slice it.",
    "Drain the veg mix and noodles and add to a bowl. Mix with the chicken and add sweet chilli sauce on top. Adjust the quantity of noodles to your target calories.",
  ],
  tofu_noodles: [
    "Add the Asian veg mix to a pot, cover with water and boil for 10 minutes. Then add the noodles to the same boiling pot. Cook until soft.",
    "Cut the smoked tofu into cubes and cook in a non-stick pan with the measured oil until golden. Alternatively, keep the smoked tofu as is, since it's ready to serve.",
    "Drain the veg mix and noodles and add to a bowl. Mix with the tofu and add sweet chilli sauce on top. Adjust the quantity of noodles to your target calories.",
  ],
  burgers_meat: [
    "Cook the patties in a pan (little to no oil, since they are fatty) or under the broiler.",
    "Toast the buns if you like. Spread mustard on the bottom half of the buns, add the patty, put one or two thin slices of onion on top, 5-6 thin slices of pickle, and cover with ketchup. Add the top part of the bun. This makes it taste like a McDonald's burger.",
    "Serve with the raw carrot sticks on the side for crunch or cook the carrot sticks in the air fryer to give them a texture that resembles fries.",
  ],
  burgers_plant: [
    "Cook the patties in a pan (little to no oil, since they are fatty) or under the broiler.",
    "Toast the buns if you like. Spread mustard on the bottom half of the bun, add the patty, put one or two thin slices of onion on top, 5-6 thin slices of pickle, and cover with ketchup. Add the top part of the bun. This makes it taste like a McDonald's burger.",
    "Serve with the raw carrot sticks on the side for crunch or cook the carrot sticks in the air fryer to give them a texture that resembles fries.",
  ],
  wraps_meat: [
    "Cook the ground meat with cumin, paprika, and garlic (little to no oil, since the meat releases its own fat).",
    "Drain and rinse the canned lentils and mix with the meat, lettuce, onion, pepper, and salsa in a large bowl.",
    "Place the tortilla on a large plate, add three to four spoons of the mix on it, and roll.",
  ],
  wraps_plant: [
    "Cook the plant mince with cumin, paprika, and garlic.",
    "Drain and rinse the canned lentils and mix with the mince, lettuce, onion, pepper, and salsa in a large bowl.",
    "Place the tortilla on a large plate, add three to four spoons of the mix on it, and roll.",
  ],
  burrito_lg: [
    "Cook the ground meat with cumin and paprika (little to no oil).",
    "Drain and rinse the canned beans and corn.",
    "Put the meat, beans, corn, chopped romaine, onion, and tomato in a bowl, and add the Greek yogurt on top (it works instead of sour cream). Serve as is or with hot sauce / chilli peppers.",
  ],
  burrito_vegan: [
    "Cook the plant mince with cumin and paprika (little to no oil).",
    "Drain and rinse the canned beans and corn.",
    "Put the mince, beans, corn, chopped romaine, onion, and tomato in a bowl, and add the soy yogurt on top. Serve as is or with hot sauce / chilli peppers.",
  ],
  chili_meat: [
    "Add the meat, onion, carrot, and fresh chilli in a pot with the measured oil, seasoned with cumin, paprika, and chilli. Cook until soft.",
    "Drain and rinse the kidney beans and add to the pot. Then add diced tomatoes (fresh or canned) and let it simmer for 5 to 10 minutes.",
  ],
  chili_vegan: [
    "Add the mock meat, onion, carrot, and fresh chilli in a pot with the measured oil, seasoned with cumin, paprika, and chilli. Cook until soft.",
    "Drain and rinse the kidney beans and add to the pot. Then add diced tomatoes (fresh or canned) and let it simmer for 5 to 10 minutes.",
  ],
  salmon_potato: [
    "Peel the potatoes and cut into wedges, coat them with a little oil, and cook in the oven or air fryer until soft and golden.",
    "Season the salmon with salt, pepper, and lemon and bake it, or cook it skin-side down in a non-stick pan.",
    "Serve with low-fat garlic sauce or lemon juice.",
  ],
  trout_rice: [
    "Add the frozen veg mix together with the dry rice in a pot, cover with water, and boil until soft.",
    "Season the trout with salt, pepper, and lemon and bake it or cook it in a pan.",
    "Drain the rice and veg and season to your liking. Serve as is or with soy sauce, low-fat garlic sauce, or lemon juice.",
  ],
  tuna_pasta: [
    "Boil the pasta and keep a bit of the cooking water.",
    "Take the pan off the heat and mix the drained pasta with the drained tuna, olive oil, lemon juice, crushed garlic, and olives. Add a little of the pasta water to loosen it.",
    "Season with black pepper and chilli.",
  ],
  frittata: [
    "Whisk the eggs and cottage cheese together with garlic powder, salt, and pepper.",
    "Cook the onion, pepper, and spinach in a non-stick pan with the measured oil until soft.",
    "Pour the egg mixture over the veggies, add the cheddar and tomato on top, and bake at 375 F (190 C) for 20 to 25 minutes until set.",
    "Serve as is or with chilli sauce.",
  ],
  quesadillas: [
    "Cook the pepper and onion in a non-stick pan with the measured oil and your spices until soft, then stir in the drained black beans.",
    "Spread the veggie and bean mix over the tortillas, add the shredded cheddar, and fold them over.",
    "Cook in a hot, dry pan for 3 to 4 minutes per side until the outside is golden and the cheese is melted.",
  ],
  cheese_pasta: [
    "Boil the pasta.",
    "Cook the garlic, zucchini, and broccoli in a non-stick pan with the measured oil until tender, adding the cherry tomatoes for the last 2 minutes.",
    "Blend the cottage cheese and mozzarella with a splash of the hot pasta water to make a creamy sauce.",
    "Mix everything together until the cheese melts and coats the pasta and veggies.",
  ],
  gallo_pinto: [
    "Cook the onion and pepper in a non-stick pan with half the measured oil until soft, then add the garlic and cumin for 30 seconds.",
    "Add the kidney beans with a bit of their liquid and simmer for 2 minutes.",
    "Add the cooked rice and pour the soy sauce over it. Stir and cook for 4 to 5 minutes until hot.",
    "Fry the eggs in the rest of the oil in a separate pan, and serve them on top. Keep the yolks runny so they run into the rice and beans.",
  ],
};



const STARCH_SLOT_MIN = 550;
const MR_CAP = 1;
const TARGET_OPTIONS = 6;
const NO_RECIPE = new Set(['huel','shake_fruit','bars_fruit','smoothie','yogurt_mixfruit','yogurt_fruit','cottage_veg','tuna_salad']);

const hasStarch = (m)=> m.ings.some(i=>i[6]==='S');
const needsRecipe = (m)=> !NO_RECIPE.has(m.id);
const fit = (s)=> Math.abs((s.scaleP||1)-1)+Math.abs((s.scaleS||1)-1)+Math.abs((s.scaleX||1)-1);
const category = (m)=> isVegan(m) ? 'plant' : (m.diet.fish ? 'fish' : (m.diet.meat||m.diet.pork ? 'meat' : 'veg-animal'));

function selectCarousels(realMeals, structure, answers){
  const restriction = (answers && answers.restriction) || (structure.flags && structure.flags.restriction) || ['none'];
  const daytimeControl = answers && answers.daytimeControl;
  const allowMR = daytimeControl==='eatout' || daytimeControl==='none';
  const evenPlan = structure.backloadTier==='light';
  // On a bulk, let a meal's protein run up to 5g OVER the slot target (see PHI).
  // This rescues slots whose target protein is low relative to calories, where lean
  // meals would otherwise overshoot and be rejected. Cut keeps the symmetric default.
  const solveTune = structure.bulkType ? { ...TUNE, PHI: 5 } : TUNE;

  // DENSITY ORDERING. The library is shared; a meal's place in each carousel is set
  // by its calorie density, not by a bulk/cut tag. Cutters and cautious bulkers see
  // low-density (high-volume, filling) meals first and discover denser ones as they
  // scroll; hardgainers get the reverse. Balanced bulk stays neutral (fit order).
  // 'densDir' multiplies the density key: +1 = low-first, -1 = high-first, 0 = off.
  const bt = structure.bulkType;
  const densDir = !bt ? 1              // cut: low-density first
    : bt === 'cautious' ? 1            // cautious bulk: low-density first (cut-like)
    : bt === 'hardgainer' ? -1         // hardgainer: high-density first
    : 0;                               // balanced bulk: neutral

  const usedVg = new Set();
  const usedIds = new Set();
  const carousels = [];

  realMeals.forEach((slot)=>{
    const K=slot.kcal, P=slot.protein;
    const starchOK = K>=STARCH_SLOT_MIN || evenPlan;
    let pool = MEALS
      .filter(m => eligible(m,restriction) && (!m.mr || allowMR) && (!hasStarch(m) || starchOK) && !(m.vg && usedVg.has(m.vg)))
      .map(m => ({ m, solved: solveMeal(m, K, P, solveTune) }))
      .filter(o => o.solved.feasible);
    // Pool order: unused meals first, then by density in the chosen direction (so
    // the category-balanced picker below draws from the low- or high-density end),
    // then fit, then a stable id tiebreak. densDir=0 (balanced bulk) falls straight
    // through to fit order, matching the pre-density behavior.
    pool.sort((a,b)=> (usedIds.has(a.m.id)?1:0)-(usedIds.has(b.m.id)?1:0)
      || densDir*(a.solved.density-b.solved.density)
      || fit(a.solved)-fit(b.solved)
      || (a.m.id<b.m.id?-1:1));

    const picked=[]; let mrCount=0; const localVg=new Set(); const catCount={};
    const canTake=(o)=> !picked.includes(o) && !(o.m.vg && localVg.has(o.m.vg)) && !(o.m.mr && mrCount>=MR_CAP);
    const take=(o)=>{ picked.push(o); if(o.m.mr)mrCount++; if(o.m.vg)localVg.add(o.m.vg); catCount[category(o.m)]=(catCount[category(o.m)]||0)+1; };
    // category-balanced greedy: least-used category first, then pool order (density/fit)
    const pickOne=()=>{ let best=null,bk=null; for(let i=0;i<pool.length;i++){ const o=pool[i]; if(!canTake(o))continue; const k=[catCount[category(o.m)]||0, i]; if(!best||k[0]<bk[0]||(k[0]===bk[0]&&k[1]<bk[1])){best=o;bk=k;} } return best; };
    let o; while(picked.length<TARGET_OPTIONS && (o=pickOne())) take(o);

    if(picked.length && !picked.some(x=>isVegan(x.m))){
      const veg = pool.find(x=>isVegan(x.m) && !(x.m.vg && localVg.has(x.m.vg)));
      if(veg){ let ri=-1; for(let i=picked.length-1;i>=0;i--){ if(!isVegan(picked[i].m)){ri=i;break;} }
        if(ri>=0){ const rem=picked[ri]; if(rem.m.vg)localVg.delete(rem.m.vg); picked[ri]=veg; if(veg.m.vg)localVg.add(veg.m.vg); }
        else if(picked.length<TARGET_OPTIONS) take(veg); }
    }

    picked.forEach(o=>{ if(o.m.vg) usedVg.add(o.m.vg); usedIds.add(o.m.id); });

    // Display order. Sort the chosen options by density in the plan's direction so
    // the carousel reads as a gradient (low-to-high for cut/cautious, high-to-low for
    // hardgainer; balanced keeps fit order). Then, for a non-vegan user, push the one
    // required vegan option to the back so it never leads. Selection is unchanged.
    let display = picked.slice().sort((a,b)=>
      densDir*(a.solved.density-b.solved.density) || fit(a.solved)-fit(b.solved) || (a.m.id<b.m.id?-1:1));
    if (!restriction.includes('vegan')) {
      const vi = display.findIndex(x=>isVegan(x.m));
      if (vi > -1) { const [v] = display.splice(vi,1); display.push(v); }
    }

    carousels.push({ K, P, options: display.map(o=>({
      id:o.m.id, name:o.m.name, img:'/meals/'+o.m.id+'.jpg', vegan:isVegan(o.m), recipe:needsRecipe(o.m),
      kcal:o.solved.kcal, protein:o.solved.protein, carbs:o.solved.carbs, fat:o.solved.fat, fiber:o.solved.fiber,
      density:o.solved.density, portions:o.solved.portions, steps:STEPS[o.m.id]||[],
    })) });
  });
  return carousels;
}

// =====================================================
// SHARED UI  (mirrors MacroMetric / PhysiquePlan)
// =====================================================

const Container = ({ children }) => (
  <div className="min-h-screen bg-stone-50 flex flex-col" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
    <Header /><main className="flex-1 flex items-center justify-center px-4 py-8">{children}</main><Footer />
  </div>
);
const LOGO_URL = '/logo.png';
const Logo = ({ size = 32 }) => (
  <img src={LOGO_URL} alt="ShredSmart logo" width={size} height={size} className="rounded-lg" style={{ width: size, height: size }} />
);
const Header = () => (
  <header className="w-full px-6 py-4 flex items-center justify-between border-b border-stone-200 bg-white">
    <div className="flex items-center gap-2.5"><Logo size={32} /><span className="font-semibold text-stone-900 tracking-tight">ShredSmart™</span></div>
    <span className="text-xs text-stone-500 tracking-wider">MealFrame™</span>
  </header>
);
const Footer = () => (
  <footer className="w-full px-6 py-4 border-t border-stone-200 bg-white text-xs text-stone-500 flex justify-between">
    <span>ShredSmart™</span><span>by Radu Antoniu</span>
  </footer>
);
const Card = ({ children, className = '' }) => (
  <div className={`bg-white border border-stone-200 rounded-2xl shadow-sm p-8 max-w-xl w-full ${className}`}>{children}</div>
);
const PrimaryButton = ({ onClick, children, disabled = false, className = '' }) => (
  <button onClick={onClick} disabled={disabled}
    className={`w-full ${disabled ? 'bg-stone-300 cursor-not-allowed text-stone-500' : 'bg-stone-900 hover:bg-stone-800 text-white'} font-medium py-3.5 px-6 rounded-full transition-colors flex items-center justify-center gap-2 ${className}`}>
    {children}
  </button>
);
const SecondaryButton = ({ onClick, children, className = '' }) => (
  <button onClick={onClick} className={`w-full bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium py-3.5 px-6 rounded-full transition-colors flex items-center justify-center gap-2 ${className}`}>{children}</button>
);
const BackButton = ({ onClick }) => (
  <button onClick={onClick} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
);
const StepIndicator = ({ current, total }) => (
  <div className="flex items-center gap-2 mb-8">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < current ? 'bg-orange-500' : 'bg-stone-200'}`} />
    ))}
  </div>
);
const QAItem = ({ question, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors">
        <span className="font-medium text-stone-900 text-sm pr-3">{question}</span>
        {open ? <ChevronUp className="w-4 h-4 text-stone-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-stone-500 flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-4 text-sm text-stone-700 leading-relaxed border-t border-stone-200 pt-3">{children}</div>}
    </div>
  );
};

// =====================================================
// SCREENS
// =====================================================

const LandingScreen = ({ onStart, onDecode, onCustom }) => (
  <Card className="max-w-3xl">
    <div className="grid md:grid-cols-2 gap-10 items-center">
      <div>
        <span className="text-xs font-semibold text-orange-600 tracking-widest">MealFrame™</span>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-tight">
          Turn your macros into a <em className="italic font-semibold text-orange-600">meal structure</em>.
        </h1>
        <p className="mt-4 text-stone-600 leading-relaxed">
          You've got your numbers from MacroMetric™. Now MealFrame builds the day around them — how many meals, when, and how to split your food so hitting your targets is as easy as possible.
        </p>
      </div>
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6">
        <h2 className="font-semibold text-stone-900">What you'll get</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-stone-700">
          {['Your meal count and timing','How to split calories & macros across the day','Sample meals that fit each slot','A structure ID you (and your coach) can reload anytime'].map((t,i)=>(
            <li key={i} className="flex gap-2"><Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" /><span>{t}</span></li>
          ))}
        </ul>
        <div className="mt-5"><PrimaryButton onClick={onStart}>Build my meal structure <ArrowRight className="w-4 h-4" /></PrimaryButton></div>
        <button onClick={onDecode} className="mt-2 w-full bg-stone-50 hover:bg-stone-100 text-stone-900 font-medium py-3.5 px-6 rounded-full transition-colors text-sm border border-stone-200">
          Load a MealFrame™ ID
        </button>
        <button onClick={onCustom} className="mt-2 w-full bg-stone-50 hover:bg-stone-100 text-stone-900 font-medium py-3.5 px-6 rounded-full transition-colors text-sm border border-stone-200">
          Build from custom macros
        </button>
        <p className="text-xs text-stone-500 text-center mt-3">Takes about 3 minutes.</p>
      </div>
    </div>
  </Card>
);

const MM_CODE_ERROR_COPY = {
  version: 'This code is from a newer version of MacroMetric™. Re-run MacroMetric to get a compatible code.',
  wrongcode: 'That looks like a PhysiquePlan™ code (SS1). Paste your MacroMetric™ code (starts with “MM1-”).',
  checksum: 'That code doesn\'t look right — a character may be off. Copy it again from MacroMetric™, or use the “Continue to MealFrame™” button there.',
  corrupt: 'That code couldn\'t be read. Copy it again from MacroMetric™.',
  format: 'That doesn\'t look like a MacroMetric™ code. It should start with “MM1-”.',
  fields: 'That code is incomplete or from an older version of MacroMetric™. Re-run your MacroMetric plan to get a current code.',
  empty: 'Paste your MacroMetric™ code to continue.',
};

const CodeScreen = ({ initialCode = '', initialError = null, onDecoded, onBack }) => {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState(initialError);
  const submit = () => {
    const res = decodeMacroMetricCode(code);
    if (!res.ok) { setError(res.error); return; }
    onDecoded(res.data, code);
  };
  return (
    <Card>
      <BackButton onClick={onBack} />
      <span className="text-xs font-semibold text-stone-400 tracking-widest uppercase">Bring your targets over</span>
      <h2 className="mt-2 text-2xl font-bold text-stone-900">Paste your MacroMetric™ code</h2>
      <p className="text-stone-600 mt-2 text-sm">MacroMetric generated a code with your calories and macros. Paste it here and MealFrame builds your structure around it — no re-entering numbers.</p>
      <div className="mt-5">
        <label className="text-sm font-medium text-stone-700">Your code</label>
        <input type="text" value={code} onChange={(e)=>{setCode(e.target.value); if(error)setError(null);}} placeholder="MM1-…" spellCheck={false} autoCapitalize="off" autoCorrect="off"
          className="mt-1 w-full px-4 py-3 rounded-lg border border-stone-200 bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
        {error && <p className="text-sm text-red-600 mt-2 leading-relaxed">{MM_CODE_ERROR_COPY[error] || MM_CODE_ERROR_COPY.format}</p>}
      </div>
      <PrimaryButton onClick={submit} disabled={!code.trim()} className="mt-5">Load my targets <ArrowRight className="w-4 h-4" /></PrimaryButton>
      <a href={MACROMETRIC_URL} target="_blank" rel="noopener noreferrer"
        className="mt-2 w-full bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium py-3.5 px-6 rounded-full transition-colors text-center flex items-center justify-center gap-2 text-sm">
        I don't have a code — do MacroMetric™ first <ExternalLink className="w-4 h-4" />
      </a>
    </Card>
  );
};

const IntroScreen = ({ code, units, onContinue, onBack }) => {
  const isCut = code.direction === 'cut';
  const weeks = genDateAgeWeeks(code.genDate);
  const stale = weeks !== null && weeks > 12;
  return (
    <Card>
      <BackButton onClick={onBack} />
      <div className="text-center">
        <span className="text-xs font-semibold text-orange-600 tracking-widest uppercase">Targets loaded</span>
        <h2 className="mt-2 text-3xl font-bold text-stone-900">Let's build your day.</h2>
        <p className="text-stone-600 mt-3 leading-relaxed text-sm">A few questions about your schedule and how you like to eat. Then MealFrame structures your {isCut ? 'cut' : 'bulk'} around your numbers.</p>
      </div>
      <div className="mt-5 bg-stone-50 border border-stone-200 rounded-xl p-5 text-left grid grid-cols-2 gap-3 text-sm">
        <div><div className="text-xs text-stone-500 uppercase tracking-wider">Direction</div><div className="font-semibold text-stone-900 mt-0.5">{isCut ? 'Cut' : 'Lean bulk'}</div></div>
        <div><div className="text-xs text-stone-500 uppercase tracking-wider">Daily calories</div><div className="font-semibold text-stone-900 mt-0.5">{code.target} kcal</div></div>
        <div><div className="text-xs text-stone-500 uppercase tracking-wider">Protein</div><div className="font-semibold text-stone-900 mt-0.5">{code.protein}g</div></div>
        <div><div className="text-xs text-stone-500 uppercase tracking-wider">Fat · Carbs · Fiber</div><div className="font-semibold text-stone-900 mt-0.5">{code.fat} · {code.carbs} · {code.fiber}g</div></div>
      </div>
      {stale && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-stone-700"><span className="font-medium text-stone-900">These targets are a few months old.</span> Consider a fresh MacroMetric check-in for the most accurate numbers — but you can proceed.</div>
        </div>
      )}
      <PrimaryButton onClick={onContinue} className="mt-6">Start the questions <ArrowRight className="w-4 h-4" /></PrimaryButton>
    </Card>
  );
};

const PER_PAGE = 3;
const CustomMacrosScreen = ({ onBuild, onBack }) => {
  const [direction, setDirection] = useState('cut');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');

  const cal = parseInt(calories, 10);
  const p = parseInt(protein, 10);
  const f = parseInt(fat, 10);
  const valid = !isNaN(cal) && cal > 0 && !isNaN(p) && p >= 0 && !isNaN(f) && f >= 0;
  const carbsRaw = valid ? (cal - p * 4 - f * 9) / 4 : null;
  const carbs = carbsRaw !== null ? Math.round(carbsRaw) : null;
  const fiber = !isNaN(cal) && cal > 0 ? Math.round((cal / 1000) * 14) : null;
  const overshoot = valid && carbsRaw < 0;
  const lowFat = valid && f < 60;
  const lowCarb = valid && direction === 'cut' && !overshoot && carbs < 100;
  const canBuild = valid && !overshoot;

  const inputCls = 'mt-1 w-full px-3 py-3 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500';

  const submit = () => {
    if (!canBuild) return;
    onBuild({ direction, target: cal, protein: p, fat: f, carbs: Math.max(0, carbs), fiber });
  };

  return (
    <Card>
      <BackButton onClick={onBack} />
      <span className="text-xs font-semibold text-stone-400 tracking-widest uppercase">Your own numbers</span>
      <h2 className="mt-2 text-2xl font-bold text-stone-900">Build from custom macros</h2>
      <p className="text-stone-600 mt-2 text-sm">Already know your targets? Enter them here and MealFrame builds your structure around them, no MacroMetric™ code needed.</p>

      <div className="mt-5">
        <label className="text-sm font-medium text-stone-700">Goal</label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setDirection('cut')}
            className={direction === 'cut'
              ? 'rounded-lg border-2 border-orange-500 bg-orange-50 text-orange-700 font-semibold py-2.5 text-center text-sm'
              : 'rounded-lg border border-stone-200 bg-stone-50 text-stone-500 py-2.5 text-center text-sm hover:border-stone-300'}>Cut</button>
          <button type="button" onClick={() => setDirection('bulk')}
            className={direction === 'bulk'
              ? 'rounded-lg border-2 border-orange-500 bg-orange-50 text-orange-700 font-semibold py-2.5 text-center text-sm'
              : 'rounded-lg border border-stone-200 bg-stone-50 text-stone-500 py-2.5 text-center text-sm hover:border-stone-300'}>Bulk</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div>
          <label className="text-sm font-medium text-stone-700">Calories</label>
          <input type="number" inputMode="numeric" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="2000" className={inputCls} />
        </div>
        <div>
          <label className="text-sm font-medium text-stone-700">Protein</label>
          <input type="number" inputMode="numeric" min="0" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="150" className={inputCls} />
        </div>
        <div>
          <label className="text-sm font-medium text-stone-700">Fat</label>
          <input type="number" inputMode="numeric" min="0" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="60" className={inputCls} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span><span className="text-stone-500">Carbs</span> <span className="font-semibold text-stone-900">{overshoot || carbs === null ? '—' : `${carbs}g`}</span> <span className="text-xs text-stone-400">fills the rest</span></span>
        <span><span className="text-stone-500">Fiber</span> <span className="font-semibold text-stone-900">{fiber === null ? '—' : `${fiber}g`}</span> <span className="text-xs text-stone-400">auto</span></span>
      </div>

      {overshoot && <p className="text-sm text-red-600 mt-3">Your protein and fat already use more than your calories. Lower one, or raise your calories.</p>}
      {!overshoot && (lowFat || lowCarb) && (
        <p className="text-sm text-amber-700 mt-3">{lowFat ? 'Fat is below the ~60g floor. ' : ''}{lowCarb ? 'Carbs land below the ~100g floor. ' : ''}You can still proceed, but staying under these long-term tends to cost you on hormones, sleep, and training.</p>
      )}

      <div className="mt-4 bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm text-stone-700 leading-relaxed">
        <div className="font-semibold text-stone-900 mb-1">How to use these numbers</div>
        {direction === 'cut'
          ? 'Hit your calories and protein. Those two drive your results. Fat and carbs are floors, not exact targets: keep fat around 60g and up, and let carbs fill the rest, staying around 100g and up on a cut.'
          : 'Hit your calories and protein. On a bulk the calories drive the gain, so let carbs fill the rest and keep fat around 60g and up. Getting all your calories in is the priority.'}
      </div>

      <PrimaryButton onClick={submit} disabled={!canBuild} className="mt-5">Review my targets <ArrowRight className="w-4 h-4" /></PrimaryButton>
    </Card>
  );
};

const QuestionnaireScreen = ({ direction, answers, setAnswers, onComplete, onBack }) => {
  const questions = direction === 'cut' ? CUT_QUESTIONS : BULK_QUESTIONS;
  const pages = [];
  for (let i = 0; i < questions.length; i += PER_PAGE) pages.push(questions.slice(i, i + PER_PAGE));
  const [page, setPage] = useState(0);
  const current = pages[page];

  const setAnswer = (id, value, multi) => {
    setAnswers((prev) => {
      if (multi) {
        const cur = Array.isArray(prev[id]) ? prev[id] : [];
        let next;
        if (value === 'none') next = ['none'];
        else { next = cur.filter((v) => v !== 'none'); next = next.includes(value) ? next.filter((v)=>v!==value) : [...next, value]; if (next.length===0) next=['none']; }
        return { ...prev, [id]: next };
      }
      return { ...prev, [id]: value };
    });
  };

  const pageComplete = current.every((qq) => {
    const v = answers[qq.id];
    return qq.multi ? (Array.isArray(v) && v.length > 0) : (v !== undefined && v !== null);
  });

  const next = () => { if (page < pages.length - 1) setPage(page + 1); else onComplete(); };
  const prev = () => { if (page > 0) setPage(page - 1); else onBack(); };

  return (
    <Card className="max-w-2xl">
      <BackButton onClick={prev} />
      <StepIndicator current={page + 1} total={pages.length} />
      <span className="text-xs font-semibold text-stone-400 tracking-widest uppercase">Page {page + 1} of {pages.length}</span>
      <div className="mt-3 space-y-8">
        {current.map((qq, qi) => (
          <div key={qq.id} className={qi > 0 ? 'pt-8 border-t border-stone-100' : ''}>
            <div className="flex items-baseline gap-2">
              <span className="text-stone-900 font-bold text-base leading-6 tabular-nums">{page * PER_PAGE + qi + 1}.</span>
              <label className="text-base font-bold text-stone-900 leading-6">{qq.q}</label>
            </div>
            {qq.multi && <p className="text-xs text-stone-500 mt-1 ml-5">Select all that apply</p>}
            <div className="space-y-2 mt-3 ml-5">
              {qq.options.map(([val, label]) => {
                const sel = qq.multi ? (Array.isArray(answers[qq.id]) && answers[qq.id].includes(val)) : answers[qq.id] === val;
                return (
                  <button key={val} onClick={() => setAnswer(qq.id, val, qq.multi)}
                    className={`w-full text-left px-3.5 py-3 rounded-lg border transition-colors text-sm flex items-start gap-2.5 ${sel ? 'border-orange-500 bg-orange-50' : 'border-stone-200 hover:border-orange-300 hover:bg-orange-50/40'}`}>
                    <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${sel ? 'border-orange-500' : 'border-stone-300'}`}>
                      {sel && <span className="w-2 h-2 rounded-full bg-orange-500" />}
                    </span>
                    <span className={sel ? 'text-stone-900 font-medium' : 'text-stone-800'}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <PrimaryButton onClick={next} disabled={!pageComplete} className="mt-6">
        {page < pages.length - 1 ? 'Next' : 'Build my structure'} <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </Card>
  );
};

const TimesScreen = ({ initial, showTrain, onContinue, onBack }) => {
  const toHour = (mins) => (mins === 0 ? 24 : Math.round(mins / 60));
  const fromHour = (h) => (Number(h) % 24) * 60;
  const [wakeH, setWakeH] = useState(toHour(initial?.wake ?? DEFAULT_WAKE));
  const [sleepH, setSleepH] = useState(toHour(initial?.sleep ?? DEFAULT_SLEEP));
  const [trainH, setTrainH] = useState(toHour(initial?.train ?? DEFAULT_TRAIN));
  const valid = wakeH && sleepH && (!showTrain || trainH);

  const HourField = ({ label, sub, value, onChange, icon: I }) => (
    <div>
      <label className="text-sm font-medium text-stone-700 flex items-center gap-2"><I className="w-4 h-4 text-stone-400" /> {label}</label>
      {sub && <p className="text-xs text-stone-500 mt-0.5">{sub}</p>}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full px-4 py-3 rounded-lg border border-stone-200 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500">
        {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>{h}:00</option>
        ))}
      </select>
    </div>
  );

  return (
    <Card>
      <BackButton onClick={onBack} />
      <span className="text-xs font-semibold text-stone-400 tracking-widest uppercase">Your daily schedule</span>
      <h2 className="mt-2 text-2xl font-bold text-stone-900">What's your daily schedule?</h2>
      <p className="text-stone-600 mt-2 text-sm">Times are on a 24-hour clock (so 7 = 7am, 19 = 7pm, 24 = midnight). Pick the nearest hour — eating 30–45 minutes either side of a target is no problem.</p>
      <div className="space-y-4 mt-5">
        <HourField label="Wake up" value={wakeH} onChange={setWakeH} icon={Coffee} />
        {showTrain && <HourField label="Workout" sub="Roughly when you train on a training day" value={trainH} onChange={setTrainH} icon={Dumbbell} />}
        <HourField label="Sleep" value={sleepH} onChange={setSleepH} icon={Moon} />
      </div>
      <PrimaryButton
        onClick={() => valid && onContinue({ wake: fromHour(wakeH), sleep: fromHour(sleepH), train: showTrain ? fromHour(trainH) : 0 })}
        disabled={!valid} className="mt-6">
        See my structure <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </Card>
  );
};

const LoadingScreen = () => (
  <Card>
    <div className="text-center py-8">
      <Loader2 className="w-10 h-10 mx-auto text-orange-500 animate-spin" />
      <p className="mt-4 font-medium text-stone-900">Structuring your day…</p>
      <p className="text-sm text-stone-500 mt-1">Choosing your meal count, timing, and macro split…</p>
    </div>
  </Card>
);

// Single source of truth for meal TIMES. Both the macro engine (to decide whether
// a shake is needed to bridge a gap) and the timeline (to place events) call this,
// so the shake decision and the displayed schedule can never disagree. Placement is
// RELATIONAL: the last meal floats off SLEEP; spacing is forward-fixed unless that
// leaves an oversized tail gap (then even-spread). Depends only on structure + times,
// so a decoded ID reproduces the same schedule.
function computeMealSchedule(structure, p) {
  const wake = p.wake;
  const trains = structure.flags?.workout !== 'none' && p.train > 0;
  const rn = structure.mealCount;
  const w = classifyWorkout(wake, p.sleep, p.train, trains);
  const cont = (t) => (t < wake ? t + 1440 : t);
  const sleepC = cont(p.sleep);
  const trainC = trains ? cont(p.train) : 0;

  const wk = structure.flags?.workout;
  // Last meal sits ~3.5h before bed, widening up to ~5h for past-midnight bedtimes
  // (a 2am sleeper shouldn't be eating dinner at 11pm just because they're up late).
  const pastMidnight = Math.max(0, sleepC - 1440);
  const sleepAnchored = sleepC - (LAST_MEAL_BEFORE_SLEEP + Math.min(pastMidnight, 90));

  const delayedStart = (structure.morningMode === 'if' || structure.morningMode === 'fasted');
  let firstMeal = delayedStart ? wake + FIRST_MEAL_AFTER_WAKE_FASTED : wake + FIRST_MEAL_AFTER_WAKE;
  if (!delayedStart && trains && wk === 'before_first' && w.morning) {
    // Breakfast-mode lifter who trains before the first meal: the natural first
    // meal (wake + 1h) would collide with the morning workout, so anchor it just
    // after the session. A FASTED morning is excluded — it keeps its later first
    // meal (wake + 4h) and lets the optional pre-workout shake bridge the session.
    firstMeal = Math.max(wake + FIRST_MEAL_AFTER_WAKE, trainC + POST_WORKOUT_LIGHT_DELAY);
  } else if (trains && wk === 'midday' && w.morning && trainC > wake && trainC <= firstMeal) {
    // Trains BETWEEN two meals, but the session lands on (or before) the possibly
    // delayed first meal, so forward spacing would leave nothing in front of it.
    // Pull the first meal ahead of the session as a genuine pre-workout meal; the
    // post-workout meal then follows from the normal spacing.
    firstMeal = Math.max(wake + FIRST_MEAL_AFTER_WAKE, trainC - PRE_WORKOUT_MEAL_GAP);
  } else if (w.morning && trainC >= wake && trainC < firstMeal) {
    firstMeal = Math.max(firstMeal, trainC + 45);
  }

  // "Evening, after my last meal" — trains AFTER dinner. Driven by the CATEGORY.
  const tier = structure.backloadTier;
  const lateEveningCat = trains && wk === 'evening';
  // Evening session (between meals, but late enough that the post-workout meal IS
  // the last meal of the day). 3-meal only — a 2-meal day just has its dinner
  // sleep-anchored with the gym bridged by a shake. We anchor the last meal to the
  // gym (+90m) and frame it with a pre-workout meal (~2h before), so a meal lands
  // near the session instead of stranding the 2nd meal early and needing a shake.
  const eveningWorkout = trains && !lateEveningCat && rn >= 3 &&
    (trainC + POST_WORKOUT_LIGHT_DELAY) >= (sleepAnchored - 90);
  // Not hungry at night AND the post-workout meal would land close to bed → eat the
  // BIG meal before the gym and keep the post-gym feed light, instead of a big late
  // dinner. (Night-hungry lifters keep the big meal post-workout.)
  const latePostMeal = (trainC + POST_WORKOUT_LIGHT_DELAY) >= (sleepC - 180);
  const bigMealPreGym = lateEveningCat || (eveningWorkout && tier === 'light' && latePostMeal);
  const lateEvening = lateEveningCat; // kept name for downstream compatibility

  let lastMealTime;
  const mealTimes = [];

  if (bigMealPreGym) {
    const bigMeal = trainC - PRE_WORKOUT_MEAL_GAP;                      // big meal pre-gym
    const lightMeal = Math.min(trainC + POST_WORKOUT_LIGHT_DELAY, sleepC - 30); // wrap-up after
    if (rn === 1) {
      lastMealTime = bigMeal;
      mealTimes.push(bigMeal);
    } else if (rn === 2) {
      // First meal stays at its normal time; big meal pre-gym; the post-gym feed is
      // a shake (decideCutShake), not a delayed meal — never fast all day to the gym.
      lastMealTime = bigMeal;
      mealTimes.push(firstMeal, bigMeal);
    } else {
      lastMealTime = lightMeal;
      let f = firstMeal;
      if (f > bigMeal - INTER_MEAL_GAP * (rn - 2)) f = Math.max(wake + 30, bigMeal - INTER_MEAL_GAP * (rn - 2));
      for (let i = 0; i < rn - 2; i++) mealTimes.push(f + INTER_MEAL_GAP * i);
      mealTimes.push(bigMeal);    // rn-2: big, pre-gym
      mealTimes.push(lightMeal);  // rn-1: light, post-gym
    }
  } else if (eveningWorkout) {
    lastMealTime = Math.min(trainC + POST_WORKOUT_LIGHT_DELAY, sleepC - 30); // post-workout meal
    const preMeal = Math.min(trainC - PRE_WORKOUT_MEAL_GAP, firstMeal + MAX_PRE_WORKOUT_SPREAD);
    const earlier = rn - 2; // meals before the pre-workout meal
    for (let i = 0; i < earlier; i++) {
      mealTimes.push(earlier === 1 ? firstMeal : firstMeal + ((preMeal - firstMeal) * i) / earlier);
    }
    mealTimes.push(preMeal);      // pre-workout meal (~2h before)
    mealTimes.push(lastMealTime); // post-workout meal (the last meal)
  } else {
    // Early/midday workout, or no workout: forward-fixed spacing with the long-day
    // even-spread guard; last meal sleep-anchored.
    lastMealTime = sleepAnchored;
    if (rn > 1 && firstMeal > lastMealTime - MIN_INTER_MEAL_GAP * (rn - 1)) {
      firstMeal = Math.max(wake + 30, lastMealTime - INTER_MEAL_GAP * (rn - 1));
    }
    if (rn === 1) {
      mealTimes.push(lastMealTime);
    } else {
      const forwardLastNonFinal = firstMeal + INTER_MEAL_GAP * (rn - 2);
      const roomy = forwardLastNonFinal <= lastMealTime - INTER_MEAL_GAP;
      const forwardTail = lastMealTime - forwardLastNonFinal;
      if (roomy && forwardTail <= MAX_TAIL_GAP) {
        for (let i = 0; i < rn - 1; i++) mealTimes.push(firstMeal + INTER_MEAL_GAP * i);
      } else {
        for (let i = 0; i < rn - 1; i++) mealTimes.push(firstMeal + ((lastMealTime - firstMeal) * i) / (rn - 1));
      }
      mealTimes.push(lastMealTime);
    }
  }

  // No meal should sit inside the workout window (the session runs ~90 min). The
  // morning and evening branches anchor meals around the session, but forward/even
  // spacing, and a fasted first meal that happens to fall on the session, can still
  // drop a meal on top of it. Move any meal that starts at or during the session to
  // when it ends, then keep the list ordered. Post-workout meals already sit at the
  // end (trainC + 90), and pre-workout meals sit before trainC, so this leaves them
  // untouched.
  if (trains) {
    const wEnd = trainC + POST_WORKOUT_LIGHT_DELAY;
    for (let i = 0; i < mealTimes.length; i++) {
      if (mealTimes[i] >= trainC && mealTimes[i] < wEnd) mealTimes[i] = wEnd;
    }
    for (let i = 1; i < mealTimes.length; i++) {
      if (mealTimes[i] < mealTimes[i - 1]) mealTimes[i] = mealTimes[i - 1];
    }
  }

  return { wake, trains, w, sleepC, trainC, rn, lastMealTime, lateEvening, eveningWorkout, bigMealPreGym, firstMeal, mealTimes };
}

// Decide the cut shake from the REAL gaps around the workout (computeMealSchedule).
// A shake only ever bridges a gap, and bridges the LONGER side: a long pre-gap means
// the session itself needs fuel; a long post-gap means recovery needs bridging.
//   fasted into training (no meal before)  → post bridge if ravenous + a real wait,
//                                             otherwise pre-workout fuel
//   late-evening 2-meal                     → post-workout shake (replaces the light meal)
//   eats before AND after                   → bridge the longer gap if it's >3.5h
function decideCutShake(structure, timing) {
  const fl = structure.flags || {};
  const hungry = !!fl.hungryPostWorkout;
  if (!timing || !timing.trains || !timing.train) return null;
  const sched = computeMealSchedule(structure, { wake: timing.wake, sleep: timing.sleep, train: timing.train });
  const { mealTimes, trainC, bigMealPreGym, rn } = sched;

  if (bigMealPreGym) {
    // 3-meal has a real light post-gym meal; 2-meal swaps it for a post shake.
    if (rn === 2) return { shakeKind: 'post', deductIdx: 1, optional: true };
    return null;
  }

  const beforeMeals = mealTimes.filter((t) => t <= trainC);
  const afterMeals = mealTimes.filter((t) => t > trainC);
  const beforeT = beforeMeals.length ? Math.max(...beforeMeals) : null;
  const afterT = afterMeals.length ? Math.min(...afterMeals) : null;
  const afterIdx = afterT != null ? mealTimes.indexOf(afterT) : -1;
  const beforeIdx = beforeT != null ? mealTimes.indexOf(beforeT) : -1;
  const preGap = beforeT != null ? trainC - beforeT : Infinity;
  const postGap = afterT != null ? afterT - trainC : Infinity;

  // Fasted into the workout (no meal before it).
  if (beforeT == null) {
    if (afterT != null && hungry && postGap > SHAKE_FASTED_POST_MIN) {
      return { shakeKind: 'post', deductIdx: afterIdx, optional: false }; // ravenous, real wait
    }
    if (afterT == null || postGap > SHAKE_ADJACENT_GAP) {
      return { shakeKind: 'pre', deductIdx: afterIdx >= 0 ? afterIdx : 0, optional: true };
    }
    return null; // eats right after → the first meal covers it
  }

  // Eats before AND after — bridge the longer gap, but only if it's genuinely long.
  if (Math.max(preGap, postGap) <= SHAKE_BRIDGE_GAP) return null;
  if (preGap >= postGap) {
    return { shakeKind: 'pre', deductIdx: beforeIdx, optional: true };
  }
  return { shakeKind: 'post', deductIdx: afterIdx, optional: !hungry };
}

// Compute the ordered day events. Times come from computeMealSchedule so the
// timeline matches the macro engine's shake decision exactly.
function buildDayEvents(structure, p, meals, snacksArg) {
  const __snacksAttached = snacksArg || meals.__snacks;
  const round15 = (m) => Math.round(m / 15) * 15;
  const events = [{ t: p.wake, icon: 'wake', label: 'Wake' }];
  const realMeals = meals.filter((m) => !m.isShake);
  const shakeMeal = meals.find((m) => m.isShake);

  const sched = computeMealSchedule(structure, p);
  const { wake, trains, trainC, sleepC, lateEvening } = sched;
  let { mealTimes } = sched;

  // BULK-ONLY timeline adjustments (the shared scheduler above is never modified):
  //  (a) even spread — the scheduler tends to bunch the early meals when there's a
  //      later workout, leaving a huge gap. Re-space the MIDDLE meals evenly between
  //      the (kept) first and last meal so the day is distributed, not front-loaded.
  //      Skipped for IF plans, which bank late on purpose (restraint / late riser).
  //  (b) fasted-morning post-workout meal — when he trains before his first meal,
  //      pin that first meal just after the session instead of floating it hours out.
  //  (c) preLight digestion gap — if he doesn't want to train on a full stomach,
  //      keep any pre-workout meal at least 90 min before the session.
  //  (d) keep every meal out of the workout window, then re-sort and space.
  if (structure.bulkType && mealTimes.length >= 3) {
    const fl = structure.flags || {};
    const isIf = structure.morningMode === 'if' || structure.morningMode === 'fasted';
    const w = trains ? classifyWorkout(p.wake, p.sleep, p.train, true) : null;
    const n = mealTimes.length;

    if (!isIf) {
      const first = mealTimes[0], last = mealTimes[n - 1];
      for (let i = 1; i < n - 1; i++) mealTimes[i] = Math.round(first + (last - first) * i / (n - 1));
    }

    if (w && w.morning && isIf) {
      const target = trainC + 90 + 30;              // eat ~30 min after a fasted session
      if (mealTimes[0] > target) mealTimes[0] = target;
    }

    if (trains) {
      const preGap = fl.preLight ? 90 : 45;
      const earliest = wake + 60;                  // never shove a meal before this
      for (let i = 0; i < n; i++) {
        if (i === n - 1 && mealTimes[i] >= trainC) continue;   // post-workout meal stays put
        if (mealTimes[i] > trainC - preGap && mealTimes[i] < trainC + 90) {
          mealTimes[i] = mealTimes[i] <= trainC
            ? Math.max(earliest, trainC - preGap)
            : trainC + 90 + 15;
        }
      }
    }

    mealTimes.sort((a, b) => a - b);
    for (let i = 1; i < n; i++) if (mealTimes[i] < mealTimes[i - 1] + 45) mealTimes[i] = mealTimes[i - 1] + 45;
  }

  if (shakeMeal) {
    let st, label;
    const opt = shakeMeal.optional ? ' (optional)' : '';
    if (shakeMeal.shakeKind === 'post' && trains) {
      st = trainC + POST_WORKOUT_LIGHT_DELAY;
      label = `Post-workout shake${opt} · ${shakeMeal.kcal} kcal`;
    } else if (shakeMeal.shakeKind === 'pre' && trains) {
      st = Math.max(wake + 5, trainC - 15);
      label = `Pre-workout shake${opt} · ${shakeMeal.kcal} kcal`;
    } else {
      st = wake + 30;
      label = `Morning protein feeding · ${shakeMeal.kcal} kcal`;
    }
    events.push({
      t: round15(st), icon: 'shake', label,
      sub: `${shakeMeal.protein}P / ${shakeMeal.carbs}C / ${shakeMeal.fat}F`,
    });
  }
  if (trains) events.push({ t: trainC, icon: 'train', label: 'Workout' });

  realMeals.forEach((m, i) => {
    events.push({
      t: round15(mealTimes[i]), icon: 'meal',
      label: `Meal ${i + 1} · ${m.kcal} kcal`,
      sub: `${m.protein}P / ${m.carbs}C / ${m.fat}F`,
    });
  });

  // BULK snacks — optional, placed in meal gaps that are long enough to warrant one.
  // A snack only appears in a gap of at least MIN_SNACK_GAP (short gaps don't need
  // one), and never inside the workout window. We fill the widest qualifying gaps
  // up to the cap the structure set (0 for cautious). Placement is at the gap's
  // midpoint, or the midpoint of the larger sub-gap when the workout splits it.
  const MIN_SNACK_GAP = 240;                 // 4h — below this a snack reads as clutter
  const snacks = __snacksAttached || [];
  const cap = snacks.length;
  if (cap > 0 && mealTimes.length >= 2) {
    const wStart = trains ? trainC : null, wEnd = trains ? trainC + 90 : null;
    const inWorkout = (t) => wStart != null && t > wStart - 30 && t < wEnd + 30;
    const cands = [];
    for (let i = 0; i < mealTimes.length - 1; i++) {
      const a = mealTimes[i], b = mealTimes[i + 1], width = b - a;
      if (width < MIN_SNACK_GAP) continue;
      let mid = (a + b) / 2;
      if (inWorkout(mid)) {
        // the workout sits mid-gap; put the snack in the bigger side if it's big enough
        const pre = wStart - a, post = b - wEnd;
        if (pre >= post && pre >= MIN_SNACK_GAP * 0.6) mid = a + pre / 2;
        else if (post > pre && post >= MIN_SNACK_GAP * 0.6) mid = wEnd + post / 2;
        else continue;                       // neither side justifies a snack
      }
      cands.push({ width, mid });
    }
    cands.sort((x, y) => y.width - x.width);
    cands.slice(0, cap).sort((x, y) => x.mid - y.mid).forEach((g) => {
      events.push({ t: round15(g.mid), icon: 'snack', label: 'Snack (optional)' });
    });
  }

  events.push({ t: sleepC, icon: 'sleep', label: 'Sleep' });

  events.sort((a, b) => (a.t - b.t) || (a.icon === 'shake' && b.icon === 'train' ? -1 : b.icon === 'shake' && a.icon === 'train' ? 1 : 0));
  return events;
}

const ShakeIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8.5 2h7l-.6 2.5a2 2 0 0 1-.5.9l-.9.9a2 2 0 0 0-.5 1.3V9h-3V7.6a2 2 0 0 0-.5-1.3l-.9-.9a2 2 0 0 1-.5-.9L8.5 2Z" />
    <path d="M8 9h8a1 1 0 0 1 1 1v9a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-9a1 1 0 0 1 1-1Z" />
    <path d="M7 13h10" />
  </svg>
);

// Snack marker — a simple apple, clearly distinct from the shake glass so the two
// optional items never read as the same thing on the timeline.
const SnackIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 7c-1.6-1.8-4-2.2-5.8-1C4 7.3 3.6 10.3 5 13.3c.9 2 2.4 4 3.9 4.9 1.2.7 2 .3 3.1.3s1.9.4 3.1-.3c1.5-.9 3-2.9 3.9-4.9 1.4-3 1-6-1.2-7.3-1.8-1.2-4.2-.8-5.8 1Z" />
    <path d="M12 7c.2-1.4.9-2.8 2.2-3.6" />
  </svg>
);

// Vertical day timeline. Not to scale (gaps aren't proportional) — it lists the
// day's events top to bottom for clarity, with the time on the LEFT of the rail.
// Only the morning fast is tinted, running wake -> first meal; a fasted workout
// simply sits inside that window. Meal/shake rows are two plain lines (no capsule);
// the dashed fast card is the lone capsule. The workout node is inverted (solid
// stone, white icon) so it stands out. Geometry is inline-styled (not Tailwind
// arbitrary classes) so it renders the same regardless of the Tailwind build.
// Same props; reads buildDayEvents() unchanged.
const TimelinePreview = ({ structure, personalization, meals, snacks }) => {
  const events = buildDayEvents(structure, personalization, meals, snacks);
  if (!events.length) return null;

  const realMeals = meals.filter((m) => !m.isShake);
  const shakeMeal = meals.find((m) => m.isShake);

  const isFasted = structure.morningMode === 'if' || structure.morningMode === 'fasted';
  const firstMealIdx = events.findIndex((e) => e.icon === 'meal');
  // The fast is the whole wake -> first-meal window. An optional pre-workout shake
  // and the workout are events INSIDE it, not boundaries of it, so the fast shows
  // on any fasted morning regardless of a pre-shake.
  // On a BULK, only label it a "morning fast" for a cautious lifter, who is
  // deliberately compressing his eating window to restrain intake. A non-cautious
  // lifter who simply skips breakfast and trains early isn't fasting on purpose —
  // he just eats his first meal after the gym, so we show no fast banner for him.
  const isBulk = !!structure.bulkType;
  const showFast = isFasted && firstMealIdx > 0 && (!isBulk || structure.bulkType === 'cautious');

  // Render rows = events, plus a "morning fast" band-row right after wake (at the
  // top of the window) when showFast. Track render indices for the fast band.
  const rows = [];
  let wakeRenderIdx = -1, firstMealRenderIdx = -1;
  events.forEach((e, i) => {
    const ri = rows.length;
    if (e.icon === 'wake' && wakeRenderIdx < 0) wakeRenderIdx = ri;
    if (e.icon === 'meal' && firstMealRenderIdx < 0) firstMealRenderIdx = ri;
    rows.push({ type: 'event', e, i });
    if (showFast && e.icon === 'wake') {
      const mins = events[firstMealIdx].t - events[0].t;
      const h = Math.floor(mins / 60), mm = mins % 60;
      rows.push({ type: 'fast', dur: mm === 0 ? `${h} h` : `${h} h ${mm} min` });
    }
  });

  const lastRow = rows.length - 1;
  // Only the morning fast is tinted (wake -> first meal). A fasted workout sits
  // inside that window, so it's already covered; it gets no tint of its own.
  const lowerTinted = (ri) => showFast && ri >= wakeRenderIdx && ri < firstMealRenderIdx;
  const upperTinted = (ri) => showFast && ri > wakeRenderIdx && ri <= firstMealRenderIdx;
  const segOf = (ri) => {
    const u = upperTinted(ri), l = lowerTinted(ri);
    return (u && l) ? 'full' : l ? 'bottom' : u ? 'top' : null;
  };

  const NODE = {
    wake: { Icon: AlarmClock, style: 'plain' },
    meal: { Icon: UtensilsCrossed, style: 'accent' },
    train: { Icon: Dumbbell, style: 'invert' },
    shake: { Icon: ShakeIcon, style: 'plain' },
    snack: { Icon: SnackIcon, style: 'plain' },
    sleep: { Icon: Moon, style: 'plain' },
  };
  const nodeClass = {
    accent: 'bg-orange-100 text-orange-600',
    invert: 'bg-stone-500 text-white',
    plain: 'bg-white border border-stone-300 text-stone-500',
  };

  const ROW = { display: 'grid', gridTemplateColumns: '46px 34px 1fr', alignItems: 'center', columnGap: '10px' };
  const railCell = { position: 'relative', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 42 };
  const seg = (pos) => pos === 'full' ? { top: 0, bottom: 0 } : pos === 'bottom' ? { top: '50%', bottom: 0 } : { top: 0, bottom: '50%' };
  const lineSeg = (ri) => ri === 0 ? { top: '50%', bottom: 0 } : ri === lastRow ? { top: 0, bottom: '50%' } : { top: 0, bottom: 0 };
  const textWrap = { justifySelf: 'start', display: 'flex', flexDirection: 'column', gap: 1, margin: '5px 0' };

  let realCursor = 0;

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 sm:p-5">
      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Your day</div>
      <div>
        {rows.map((row, ri) => {
          const band = segOf(ri);
          const rail = (
            <div style={railCell}>
              <div className="bg-stone-200" style={{ position: 'absolute', left: 16, width: 2, ...lineSeg(ri) }} />
              {band && <div className="bg-orange-300" style={{ position: 'absolute', left: 16, width: 2, ...seg(band) }} />}
              {row.type === 'event' && (() => {
                const cfg = NODE[row.e.icon] || NODE.meal;
                const I = cfg.Icon;
                return (
                  <div className={nodeClass[cfg.style]}
                    style={{ position: 'relative', zIndex: 10, width: 34, height: 34, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 18, height: 18, display: 'inline-flex' }}><I className="w-full h-full" /></span>
                  </div>
                );
              })()}
            </div>
          );

          if (row.type === 'fast') {
            return (
              <div key={ri} style={ROW}>
                <div />
                {rail}
                <div className="rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 px-3 py-2" style={{ justifySelf: 'start', display: 'inline-flex', flexDirection: 'column' }}>
                  <div className="text-xs font-medium text-orange-700">Morning fast <span className="text-orange-400 font-normal">· {row.dur}</span></div>
                  <div className="text-xs text-stone-500">Water, black coffee, zero-calorie drinks</div>
                </div>
              </div>
            );
          }

          const e = row.e;
          const isPlain = e.icon === 'wake' || e.icon === 'train' || e.icon === 'sleep';

          let content;
          if (isPlain) {
            content = (
              <div className="text-sm font-medium text-stone-900" style={{ justifySelf: 'start' }}>
                {e.label}{e.icon === 'train' && <span className="text-stone-400 font-normal text-xs"> · 1.5 h</span>}
              </div>
            );
          } else if (e.icon === 'snack') {
            // Snacks are optional and sit on top of the day, so no calorie or macro
            // figure — just a marker that a snack fits here if the lifter wants one.
            content = (
              <div className="text-sm font-medium text-stone-900" style={{ justifySelf: 'start' }}>
                Snack <span className="text-stone-400 font-normal">· optional</span>
              </div>
            );
          } else {
            let m, title, tag = null;
            if (e.icon === 'meal') {
              m = realMeals[realCursor]; realCursor += 1;
              title = `Meal ${realCursor}`;
              // No dinner/biggest/light tags: when meals share a calorie count the
              // same tag fires on several at once, which reads as noise rather than
              // information. The kcal and macros below already say everything useful.
            } else {
              m = shakeMeal;
              title = (m && m.shakeKind === 'pre') ? 'Pre-workout shake'
                : (m && m.shakeKind === 'post') ? 'Post-workout shake'
                : (m && m.shakeKind === 'anchor') ? 'Morning protein feeding'
                : 'Protein shake';
              if (m && m.optional) tag = 'optional';
            }
            const kcal = m ? m.kcal : 0;
            content = (
              <div style={textWrap}>
                <div className="text-sm font-medium text-stone-900">
                  {title}{tag && <span className="text-stone-400 font-normal"> · {tag}</span>} · {kcal} kcal
                </div>
                {m && <div className="text-xs text-stone-500">{m.protein}P · {m.carbs}C · {m.fat}F</div>}
              </div>
            );
          }

          return (
            <div key={ri} style={ROW}>
              <div className="text-xs text-stone-400 tabular-nums" style={{ justifySelf: 'end' }}>{minutesToClock(e.t)}</div>
              {rail}
              {content}
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-stone-200 text-xs text-stone-500 leading-relaxed">
        Feel free to adjust the meal times a bit earlier or later to perfectly suit your schedule.
      </div>
    </div>
  );
};


const MealCard = ({ o }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 h-full">
      <div className="flex gap-3 items-start">
        <img src={o.img} alt={o.name} loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          style={{ flex: '0 0 auto', width: 112, height: 112, objectFit: 'cover', borderRadius: '10px', background: '#f5f5f4', display: 'block' }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold text-stone-900 text-sm leading-snug">{o.name}</div>
            {o.vegan && <span className="shrink-0 text-xs font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
              style={{ color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>Vegan</span>}
          </div>
          <div className="text-sm text-stone-700 mt-1.5 leading-snug">{o.kcal} kcal · {o.protein}P · {o.carbs}C · {o.fat}F · {o.fiber}g fiber</div>
          <div className="text-xs text-stone-400 mt-1">Calorie density {o.density} kcal/g</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-stone-100">
        <div className="text-xs font-medium text-stone-500 mb-1">Ingredients</div>
        <div className="text-sm text-stone-700 leading-relaxed">{o.portions.map((p) => p.label ? `${p.label} (${p.grams}g)` : `${p.name} ${p.grams}g`).join(' · ')}</div>
      </div>
      {o.steps && o.steps.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-sm font-medium text-orange-600">
            {open ? 'Hide recipe' : 'See recipe'}
            <ChevronDown className="w-4 h-4" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {open && (
            <ol className="mt-2.5 space-y-2">
              {o.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-stone-700 leading-relaxed">
                  <span className="text-stone-400 tabular-nums flex-shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};

const MealCarousel = ({ options }) => {
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const onScroll = () => { const el = ref.current; if (!el) return; setActive(Math.round(el.scrollLeft / el.clientWidth)); };
  const go = (i) => { const el = ref.current; if (!el) return; el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); };
  if (!options || !options.length) return null;
  return (
    <div>
      <style>{'.mf-carousel::-webkit-scrollbar{display:none}'}</style>
      <div ref={ref} onScroll={onScroll} className="mf-carousel"
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {options.map((o, i) => (
          <div key={i} style={{ flex: '0 0 100%', minWidth: 0, boxSizing: 'border-box', scrollSnapAlign: 'start', padding: '2px' }}>
            <MealCard o={o} />
          </div>
        ))}
      </div>
      {options.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {options.map((_, i) => (
            <button key={i} onClick={() => go(i)} aria-label={`Option ${i + 1}`}
              style={{ width: i === active ? 18 : 6, height: 6, borderRadius: 9999, transition: 'width .2s' }}
              className={i === active ? 'bg-stone-800' : 'bg-stone-300'} />
          ))}
        </div>
      )}
    </div>
  );
};

const ResultsScreen = ({ code, structure, personalization, plan, templateId, alternative, decodedMode, answers, onRestart, onBack }) => {
  const [copied, setCopied] = useState(false);
  const [showAlt, setShowAlt] = useState(false);
  const isCut = code.direction === 'cut';

  // Active view: primary, or the alternative when the lifter toggles to it.
  const active = (showAlt && alternative) ? alternative : { structure, plan, templateId };
  const aStructure = active.structure;
  const aPlan = active.plan;
  const aTemplateId = active.templateId;

  const tier = isCut ? aStructure.backloadTier : aStructure.loadTier;
  const tierLabel = { light: 'Balanced', moderate: 'Moderate backload', heavy: 'Heavy backload', low: 'Low load', mid: 'Moderate load', high: 'High load' }[tier];
  const morningLabel = { if: 'Intermittent fasting', breakfast: 'Breakfast', early_feed: 'Early protein feeding', fasted: 'Fasted morning', light_anchor: 'Light start', even: 'Even meals' }[aStructure.morningMode];
  const prose = buildDayCopy(code, aStructure, personalization, answers);
  const restriction = aStructure.flags?.restriction || ['none'];

  const goToOptiWorkout = () => window.open(`${OPTIWORKOUT_URL}?code=${encodeURIComponent(aTemplateId)}`, '_blank');
  const copyId = async () => {
    try { await navigator.clipboard.writeText(aTemplateId); setCopied(true); setTimeout(()=>setCopied(false),2000); } catch {}
  };
  const pill = (on) => `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${on ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'}`;

  return (
    <Card className="max-w-2xl">
      <BackButton onClick={onBack} />
      <span className="text-xs font-semibold text-orange-600 tracking-widest uppercase">Your Meal Structure</span>
      <h2 className="mt-2 text-3xl font-bold text-stone-900">{aStructure.mealCount} meals · {isCut ? 'cutting' : 'bulking'}</h2>
      <p className="text-stone-600 mt-2 text-sm">{morningLabel} · {tierLabel} · {code.target} kcal/day</p>

      {alternative && !decodedMode && (
        <div className="mt-4">
          <div className="inline-flex items-center rounded-full border border-stone-300 p-1 bg-stone-50">
            <button onClick={() => setShowAlt(false)} className={pill(!showAlt)}>{alternative.primaryLabel}{isCut && <span className="opacity-60"> · recommended</span>}</button>
            <button onClick={() => setShowAlt(true)} className={pill(showAlt)}>{alternative.label}</button>
          </div>
          <p className="text-xs text-stone-500 mt-2">{showAlt ? alternative.blurb : (isCut ? 'Both of these fit your numbers. This is the one we\'d start with — tap the other to compare.' : 'Both of these fit your numbers. Tap either to compare — bulking works on both, so pick the pattern you\'ll stick to.')}</p>
        </div>
      )}

      {decodedMode && (
        <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 mt-3">
          Loaded from a MealFrame™ ID. The structure and macros are exact; clock times shown are from the ID. (Body-composition fine-tuning of density only applies on a fresh run.)
        </p>
      )}

      <div className="mt-5"><TimelinePreview structure={aStructure} personalization={personalization} meals={aPlan.meals} snacks={aPlan.snacks} /></div>

      {aStructure.notes && aStructure.notes.length > 0 && (
        <div className="mt-5 bg-stone-50 border border-stone-200 rounded-xl p-5">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Why this structure</div>
          <ul className="space-y-1.5 text-sm text-stone-600">
            {aStructure.notes.map((n, i) => <li key={i} className="flex gap-2"><Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" /><span>{n}</span></li>)}
          </ul>
        </div>
      )}

      {Array.isArray(prose) ? (
        <div className="mt-5 bg-orange-50 border border-orange-200 rounded-xl p-5">
          <h3 className="font-semibold text-stone-900 text-sm mb-2">How to run your day</h3>
          <div className="space-y-2 text-sm text-stone-700 leading-relaxed">
            {prose.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </div>
      ) : (
        <>
          {prose.bulkType && prose.bulkType.length > 0 && (
            <div className="mt-5 bg-stone-50 border border-stone-200 rounded-xl p-5">
              <h3 className="font-semibold text-stone-900 text-sm mb-2">Your bulk type</h3>
              <div className="space-y-2 text-sm text-stone-700 leading-relaxed">
                {prose.bulkType.map((line, i) => <p key={i}>{line}</p>)}
              </div>
            </div>
          )}
          {prose.howToRun && prose.howToRun.length > 0 && (
            <div className="mt-5 bg-orange-50 border border-orange-200 rounded-xl p-5">
              <h3 className="font-semibold text-stone-900 text-sm mb-2">How to run your day</h3>
              <div className="space-y-2 text-sm text-stone-700 leading-relaxed">
                {prose.howToRun.map((line, i) => <p key={i}>{line}</p>)}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-5">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Meal-by-meal targets</h3>
        <p className="text-xs text-stone-500 mb-3 leading-relaxed">Quantities are raw weights unless noted. Scale them to the brands you use — macros vary a little by product. Calorie density is calories per gram; lower means more food for the same calories, so it fills you up more. Swipe each meal for four options.</p>
        <div className="space-y-4">
          {(() => {
            const reals = aPlan.meals.filter((mm) => !mm.isShake).map((mm) => ({ kcal: mm.kcal, protein: mm.protein }));
            const carousels = selectCarousels(reals, aStructure, answers);
            let realIdx = 0;
            return aPlan.meals.map((m, i) => {
              if (m.isShake) {
                return (
                  <div key={i} className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-stone-900 flex items-center gap-2">
                        <ShakeIcon className="w-4 h-4 text-orange-500" />
                        {m.shakeKind === 'post' ? 'Post-workout shake' : m.shakeKind === 'pre' ? 'Pre-workout shake' : 'Morning protein feeding'}
                      </div>
                      <div className="text-lg font-bold text-stone-900">{m.kcal} kcal</div>
                    </div>
                    <div className="text-sm text-stone-600 mt-1">{m.protein}g protein · {m.carbs}g carbs · {m.fat}g fat</div>
                    <div className="mt-2 pt-2 border-t border-orange-100 text-xs text-stone-500">
                      ~{m.protein}g protein powder in water (or a protein smoothie). {m.shakeKind === 'post' ? 'You get hungry after training — this bridges you to your next meal.' : m.shakeKind === 'pre' ? 'Keeps amino acids available through your workout until your first meal.' : 'A quick high-protein start so the rest of the day stays reachable.'}
                    </div>
                  </div>
                );
              }
              const myNum = ++realIdx;
              const car = carousels[realIdx - 1];
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-stone-900 text-sm">Meal {myNum} <span className="text-xs font-normal text-stone-500">· {m.pctOfDay}% of calories</span></div>
                    <div className="text-sm font-semibold text-stone-900">{m.kcal} kcal · {m.protein}P</div>
                  </div>
                  {car && car.options.length > 0
                    ? <MealCarousel options={car.options} />
                    : <div className="bg-white border border-stone-200 rounded-xl p-4 text-sm text-stone-500">No library meals fit this slot yet.</div>}
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div className="border-t border-stone-200 my-6"></div>
      <div className="bg-stone-900 rounded-xl p-5 text-center">
        <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Your MealFrame™ ID</h4>
        <p className="text-stone-400 text-xs mt-1">This is your structure. Paste it back into MealFrame anytime to see this page again, and give it to your coach to set up your plan in the ShredSmart app.</p>
        <div className="mt-3 bg-stone-800 border border-stone-700 rounded-lg px-3 py-3"><code className="text-orange-300 text-xs break-all leading-relaxed">{aTemplateId}</code></div>
        <button onClick={copyId} className="mt-3 inline-flex items-center gap-2 bg-white text-stone-900 text-sm font-medium py-2 px-4 rounded-full hover:bg-stone-100 transition-colors"><Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy ID'}</button>
      </div>

      {!decodedMode && (
        <div className="text-center mt-6">
          <h3 className="text-xl font-bold text-stone-900">What's next?</h3>
          <p className="text-stone-600 mt-2 text-sm leading-relaxed">Continue to <strong>OptiWorkout™</strong> to get the training program that pairs with your plan.</p>
          <div className="mt-5"><PrimaryButton onClick={goToOptiWorkout}>Continue to OptiWorkout™ <ArrowRight className="w-4 h-4" /></PrimaryButton></div>
        </div>
      )}
      <button onClick={onRestart} className="block mx-auto text-xs text-stone-500 hover:text-stone-700 mt-4 underline underline-offset-2">Start over</button>
    </Card>
  );
};

const ID_ERROR_COPY = {
  empty: 'Paste your MealFrame™ ID to continue.',
  format: 'That doesn\'t look like a MealFrame™ ID. It should start with “MF1-”.',
  wrongcode: 'That\'s a PhysiquePlan™ or MacroMetric™ code, not a MealFrame™ ID. To build a structure, use “Build my meal structure” on the home screen.',
  corrupt: 'That ID couldn\'t be read. Copy it again.',
  checksum: 'That ID doesn\'t look right — a character may be off. Copy it again.',
  fields: 'That ID is incomplete. Copy the full ID.',
};
const DecodeIdScreen = ({ onDecoded, onBack }) => {
  const [id, setId] = useState('');
  const [error, setError] = useState(null);
  const submit = () => {
    const res = decodeTemplateId(id);
    if (!res.ok) { setError(res.error); return; }
    onDecoded(res.data);
  };
  return (
    <Card>
      <BackButton onClick={onBack} />
      <span className="text-xs font-semibold text-stone-400 tracking-widest uppercase">Reload a structure</span>
      <h2 className="mt-2 text-2xl font-bold text-stone-900">Paste your MealFrame™ ID</h2>
      <p className="text-stone-600 mt-2 text-sm">Have an ID from a previous run (or a client's)? Paste it to regenerate the full structure, timeline, and meal targets — no questionnaire needed.</p>
      <div className="mt-5">
        <input type="text" value={id} onChange={(e)=>{setId(e.target.value); if(error)setError(null);}} placeholder="MF1-…" spellCheck={false} autoCapitalize="off" autoCorrect="off"
          className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
        {error && <p className="text-sm text-red-600 mt-2 leading-relaxed">{ID_ERROR_COPY[error] || ID_ERROR_COPY.format}</p>}
      </div>
      <PrimaryButton onClick={submit} disabled={!id.trim()} className="mt-5">Reload structure <ArrowRight className="w-4 h-4" /></PrimaryButton>
    </Card>
  );
};

// =====================================================
// MAIN APP
// =====================================================

export default function App() {
  const [screen, setScreen] = useState('landing');
  const [units, setUnits] = useState('metric');
  const [code, setCode] = useState(null);
  const [pastedCode, setPastedCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [times, setTimes] = useState(null);
  const [structure, setStructure] = useState(null);
  const [plan, setPlan] = useState(null);
  const [personalization, setPersonalization] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [alternative, setAlternative] = useState(null);
  const [decodedMode, setDecodedMode] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const c = params.get('code');
      if (!c) return;
      if (c.startsWith('MF1-')) {
        const res = decodeTemplateId(c);
        if (res.ok) { loadFromId(res.data); return; }
      }
      const res = decodeMacroMetricCode(c);
      if (res.ok) { setCode(res.data); setUnits(res.data.units); setPastedCode(c); setScreen('intro'); }
      else { setPastedCode(c); setCodeError(res.error); setScreen('code'); }
    } catch {}
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  useEffect(() => {
    if (screen === 'loading' && code) {
      const t = setTimeout(() => {
        let struct = code.direction === 'cut' ? selectCutStructure(answers) : selectBulkStructure(answers, code);

        // Derive the alternative from the BASE structure, before the late-evening
        // note is layered on, so its notes don't inherit the primary's wording.
        const altPick = code.direction === 'cut' ? selectCutAlternative(answers, struct) : selectBulkAlternative(answers, struct);

        const lateNote = 'You train after your last full meal, so your biggest meal lands before the gym — about 2 hours prior, so it settles before you train — and a lighter, protein-forward meal wraps up the day afterward.';
        const withLateNote = (s) => (s.flags?.workout === 'evening' && s.flags?.workout !== 'none')
          ? { ...s, notes: [...(s.notes || []), lateNote] } : s;
        struct = withLateNote(struct);

        const wakeT = times?.wake ?? DEFAULT_WAKE;
        const sleepT = times?.sleep ?? DEFAULT_SLEEP;
        const timingFor = (s) => ({ trains: s.flags?.workout !== 'none', wake: wakeT, sleep: sleepT, train: s.flags?.workout !== 'none' ? (times?.train ?? DEFAULT_TRAIN) : 0 });
        const persFor = (s) => ({
          wake: wakeT, sleep: sleepT,
          train: s.flags?.workout === 'none' ? 0 : (times?.train ?? DEFAULT_TRAIN),
          dessert: !!s.flags?.dessert,
          alcohol: !!s.flags?.alcohol,
          shakePre: !!s.flags?.shakePre,
          shakeAnchor: !!s.flags?.shakeAnchor || !!s.flags?.amProtein,
          hungryPostWorkout: !!s.flags?.hungryPostWorkout,
        });

        const mealPlan = buildMealPlan(code, struct, timingFor(struct));
        const pers = persFor(struct);
        const id = buildTemplateId(code, struct, pers, answers);

        if (altPick) {
          const altStruct = withLateNote(altPick.structure);
          const altPlan = buildMealPlan(code, altStruct, timingFor(altStruct));
          const altId = buildTemplateId(code, altStruct, persFor(altStruct), answers);
          setAlternative({ structure: altStruct, plan: altPlan, templateId: altId, label: altPick.label, primaryLabel: altPick.primaryLabel, blurb: altPick.blurb });
        } else {
          setAlternative(null);
        }

        setStructure(struct); setPlan(mealPlan); setPersonalization(pers); setTemplateId(id);
        setDecodedMode(false);
        setScreen('results');
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [screen, code, answers, times]);

  const loadFromId = (data) => {
    const p = data.personalization || {};
    const decoded = data.answers || null;
    const struct = {
      ...data.structure,
      flags: {
        ...(data.structure.flags || {}),
        hungryPostWorkout: decoded ? decoded.hungryPostWorkout === 'yes' : !!p.hungryPostWorkout,
        shakePre: !!p.shakePre,
        shakeAnchor: !!p.shakeAnchor,
        workout: p.train > 0 ? (data.structure.flags?.workout || 'varies') : 'none',
      },
    };
    const w = classifyWorkout(p.wake, p.sleep, p.train, p.train > 0);
    // Prefer the decoded workout answer (exact); fall back to the clock inference
    // only when the ID carries no answers (legacy/partial code).
    const inferredWorkout = p.train > 0
      ? (decoded?.workout
          || (data.structure.flags?.workout && data.structure.flags.workout !== 'varies'
              ? data.structure.flags.workout
              : (w.morning ? 'before_first' : (w.evening && !w.fits) ? 'evening' : 'midday')))
      : 'none';
    const struct2 = { ...struct, flags: { ...struct.flags, workout: inferredWorkout } };
    const fullAnswers = decoded
      ? { ...decoded, restriction: struct2.flags?.restriction || ['none'] }
      : null;
    setCode(data.code);
    setStructure(struct2);
    setPersonalization(p);
    setAnswers(fullAnswers || {});
    setAlternative(null);
    setPlan(buildMealPlan(data.code, struct2, {
      trains: p.train > 0,
      wake: p.wake, sleep: p.sleep, train: p.train,
    }));
    setTemplateId(buildTemplateId(data.code, struct2, p, fullAnswers));
    setDecodedMode(true);
    setScreen('results');
  };

  const restart = () => {
    setScreen('landing'); setCode(null); setPastedCode(''); setCodeError(null);
    setAnswers({}); setTimes(null); setStructure(null); setPlan(null); setPersonalization(null);
    setTemplateId(''); setDecodedMode(false); setAlternative(null); setCustomMode(false);
  };

  return (
    <Container>
      {screen === 'landing' && <LandingScreen
        onStart={() => { setCustomMode(false); setScreen('code'); }}
        onDecode={() => setScreen('decode_id')}
        onCustom={() => setScreen('custom')} />}

      {screen === 'custom' && (
        <CustomMacrosScreen
          onBuild={(m) => {
            const c = buildCustomCode(m);
            setCode(c); setUnits('metric'); setPastedCode(''); setCodeError(null);
            setCustomMode(true); setDecodedMode(false); setScreen('intro');
          }}
          onBack={() => setScreen('landing')} />
      )}

      {screen === 'code' && (
        <CodeScreen initialCode={pastedCode} initialError={codeError}
          onDecoded={(data, c) => { setCode(data); setUnits(data.units); setPastedCode(c); setCodeError(null); setCustomMode(false); setScreen('intro'); }}
          onBack={() => setScreen('landing')} />
      )}
      {screen === 'intro' && code && (
        <IntroScreen code={code} units={units} onContinue={() => setScreen('questionnaire')} onBack={() => setScreen(customMode ? 'custom' : 'code')} />
      )}
      {screen === 'questionnaire' && code && (
        <QuestionnaireScreen direction={code.direction} answers={answers} setAnswers={setAnswers}
          onComplete={() => setScreen('times')} onBack={() => setScreen('intro')} />
      )}
      {screen === 'times' && code && (
        <TimesScreen
          initial={times}
          showTrain={answers.workout !== 'none'}
          onContinue={(t) => { setTimes(t); setScreen('loading'); }}
          onBack={() => setScreen('questionnaire')} />
      )}
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'results' && structure && plan && (
        <ResultsScreen code={code} structure={structure} personalization={personalization} plan={plan}
          templateId={templateId} alternative={alternative} decodedMode={decodedMode}
          answers={answers}
          onRestart={restart} onBack={() => setScreen(decodedMode ? 'decode_id' : 'questionnaire')} />
      )}

      {screen === 'decode_id' && <DecodeIdScreen onDecoded={loadFromId} onBack={() => setScreen('landing')} />}
    </Container>
  );
}