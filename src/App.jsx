import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Check, Loader2, ChevronDown, ChevronUp, ExternalLink, AlertTriangle, Copy, Clock, Dumbbell, Moon, Coffee, UtensilsCrossed } from 'lucide-react';

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
    // "light" = the even tier. NOT perfectly flat: it carries a mild backload onto
    // the LAST meal (a little more food later in the day). The ravenous-post-workout
    // override below can redirect that bump onto a middle meal instead.
    2: { light: [40, 60], moderate: [38, 62], heavy: [35, 65] },
    3: { light: [25, 35, 40], moderate: [25, 30, 45], heavy: [25, 28, 47] },
  },
  bulk: {
    3: { low: [33, 33, 34], mid: [30, 35, 35], high: [30, 35, 35] },
    4: { low: [25, 25, 25, 25], mid: [25, 25, 25, 25], high: [22, 26, 26, 26] },
    5: { low: [20, 20, 20, 20, 20], mid: [20, 20, 20, 20, 20], high: [18, 20, 22, 20, 20] },
  },
};

// Breakfast-mode calorie vectors (3-meal only): a real breakfast, a smaller
// "valley" lunch, and the biggest meal still at dinner (never front-loaded).
// 2-meal breakfast plans reuse the IF 2-meal shape (breakfast + dinner).
const CUT_BREAKFAST_VECTORS = {
  3: { light: [33, 30, 37], moderate: [33, 25, 42], heavy: [30, 22, 48] },
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
const SHAKE_KCAL_PCT = 0.06;            // IF morning-trainer pre/post bridge (~5-6%)
const SHAKE_PROTEIN_G = 25;             // ~25g protein, ~110 kcal drink
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
const LAST_MEAL_MAX_PCT = { 2: 0.62, 3: 0.50 };
const LAST_MEAL_MAX_KCAL_HEAVY = 1100; // heavy/social: enough to absorb a family dinner

const BULK_LOAD_KCAL_PER_KG = [
  { maxLoad: 3.5, tier: 'low' },
  { maxLoad: 6.0, tier: 'mid' },
  { maxLoad: Infinity, tier: 'high' },
];

const DEFAULT_WAKE = 7 * 60;
const DEFAULT_SLEEP = 23 * 60;
const DEFAULT_TRAIN = 18 * 60;

const LAST_MEAL_BEFORE_SLEEP = 150;
const MIN_LAST_MEAL_GAP = 120;

const FIRST_MEAL_AFTER_WAKE_FASTED = 240;
const FIRST_MEAL_AFTER_WAKE = 60;
const INTER_MEAL_GAP = 210;
const MIN_INTER_MEAL_GAP = 150;

const POST_WORKOUT_MEAL_DELAY = 150;
const POST_WORKOUT_LIGHT_DELAY = 90;
const PRE_WORKOUT_MEAL_GAP = 120;

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
//            evenings→moderate nudge — is now covered by the backload axis).
//   ADDED:   satiety (primary 2-vs-3 signal), cravings (snack modifier + treat).
//   KEPT:    morningHunger, eveningOvereat, daytimeControl, dinnerControl,
//            workout, hungryPostWorkout, alcohol, schedule, restriction.

const CUT_QUESTIONS = [
  { id: 'satiety', q: 'After a normal-sized meal, how long does your fullness last?',
    options: [
      ['large','Not long — I need a big meal, or I\'m hungry again within an hour or two'],
      ['moderate','A moderate meal keeps me full for a few hours'],
      ['easily','I stay satisfied easily, even after smaller meals'],
    ] },
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

const BULK_QUESTIONS = [
  { id: 'gainExperience', q: 'When you\'ve tried to gain weight before, what happens?',
    options: [
      ['easy','I gain weight easily'],
      ['struggle','It\'s a struggle to eat enough to grow'],
      ['fatfast','I gain, but I get fat fast'],
      ['never','I\'ve never really tried to bulk'],
    ] },
  { id: 'appetite', q: 'How is your appetite, day to day?',
    options: [
      ['low','Low — I forget to eat / fill up fast'],
      ['normal','Normal'],
      ['high','High — I\'m hungry often'],
    ] },
  { id: 'shape', q: 'How do you naturally eat in the morning?',
    options: [
      ['big_breakfast','Big breakfast — I\'m hungry in the AM'],
      ['light','Something light'],
      ['skip','I\'d rather skip / not eat much early'],
    ] },
  { id: 'mealCapacity', q: 'How many real meals can you realistically fit in a day?',
    options: [['three','About 3'],['four','Up to 4'],['five','4–5, no problem']] },
  { id: 'workout', q: 'When do you usually train?',
    options: [
      ['before_first','Before my first meal'],
      ['midday','Midday / afternoon'],
      ['evening','Evening'],
      ['none','I don\'t train / rarely'],
      ['varies','It varies'],
    ] },
  { id: 'hungryPostWorkout', q: 'Do you get really hungry right after training?',
    options: [
      ['yes','Yes — I\'m ravenous after the gym'],
      ['no','Not especially'],
    ] },
  { id: 'liquidOk', q: 'Are you open to liquid calories (shakes, milk, juice) to help hit your surplus?',
    options: [['yes','Yes'],['some','A little'],['no','I\'d rather eat solid food']] },
  { id: 'schedule', q: 'How predictable is your weekly schedule?',
    options: [
      ['consistent','Consistent'],
      ['travel','I travel often'],
      ['shifts','I work shifts'],
      ['nights','Night shifts'],
      ['erratic','Very variable'],
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

  // --- DECISION 1: meal count (2 vs 3, default leans 3) ---
  // Hard constraint first: no real daytime eating window OR eating out forces 2
  // higher-density meals (no prep time; only satiating at 800-1200 kcal/meal).
  // This overrides everything.
  let mealCount;
  let cravingsSnack = false;
  if (a.daytimeControl === 'none' || a.daytimeControl === 'eatout') {
    mealCount = 2;
    notes.push('You don\'t have a reliable window to prep or eat during the day, so we build around 2 larger, higher-density meals instead of meals you can\'t realistically hit.');
  } else if (a.cravings === 'wrecked') {
    // Cravings derailed past cuts → 2 satisfying meals + a planned daily treat.
    mealCount = 2;
    cravingsSnack = true;
    notes.push('Cravings have derailed past cuts, so we use 2 satisfying meals plus one planned daily treat — a structure that bends instead of breaking.');
  } else {
    // Can prep → satiety decides. "Need a large meal" → 2; otherwise 3.
    // Ambiguous / unanswered → 3 (the workhorse).
    mealCount = (a.satiety === 'large') ? 2 : 3;
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

// =====================================================
// BULK SELECTION ENGINE  (unchanged this round — revisit after cut is locked)
// =====================================================

function selectBulkStructure(a, code) {
  const notes = [];
  const surplus = Math.max(0, code.target - code.maintenance);
  const loadPerKg = surplus / Math.max(1, code.weight);
  const band = BULK_LOAD_KCAL_PER_KG.find((b) => loadPerKg <= b.maxLoad) || BULK_LOAD_KCAL_PER_KG[BULK_LOAD_KCAL_PER_KG.length - 1];
  let loadTier = band.tier;

  let resist = 0;
  if (a.gainExperience === 'struggle') resist += 2;
  if (a.gainExperience === 'fatfast') resist -= 2;
  if (a.gainExperience === 'easy') resist -= 1;
  if (a.appetite === 'low') resist += 2;
  if (a.appetite === 'high') resist -= 1;

  const tierOrder = ['low', 'mid', 'high'];
  let idx = tierOrder.indexOf(loadTier);
  if (resist >= 2) idx = Math.min(2, idx + 1);
  if (resist <= -2) idx = Math.max(0, idx - 1);
  loadTier = tierOrder[idx];

  const overeater = (a.gainExperience === 'fatfast' || a.appetite === 'high');
  if (overeater) {
    notes.push('Because you gain fat easily, we keep food volume high and density lower — even on a bulk, you still need a little restraint.');
  } else if (loadTier === 'high') {
    notes.push('You\'re resistant to weight gain for your size, so we spread food across more meals and lean on higher-calorie, easier-to-eat foods to hit your surplus.');
  }

  let mealCount;
  if (loadTier === 'low') mealCount = 3;
  else if (loadTier === 'mid') mealCount = 4;
  else mealCount = 5;
  const cap = { three: 3, four: 4, five: 5 }[a.mealCapacity] ?? 5;
  if (mealCount > cap) {
    mealCount = cap;
    notes.push(`You can fit about ${cap} meals, so we kept it there and made up the rest with higher-calorie choices${a.liquidOk !== 'no' ? ' and liquid calories' : ''}.`);
  }
  if (overeater && mealCount > 4) mealCount = 4;

  let morningMode;
  if (a.shape === 'big_breakfast') morningMode = 'even';
  else if (a.shape === 'light') morningMode = 'even';
  else {
    morningMode = 'light_anchor';
    notes.push('On a bulk we don\'t fully fast — you\'ll start the day with at least a protein feeding (shake, high-protein yogurt/cheese + fruit) to support muscle growth, even if you don\'t want a full breakfast.');
  }

  const flags = {
    shakePre: a.workout === 'before_first',
    shakePost: false,
    hungryPostWorkout: a.hungryPostWorkout === 'yes',
    amProtein: morningMode === 'light_anchor',
    liquidCalories: loadTier === 'high' && a.liquidOk !== 'no',
    snacksBetween: loadTier === 'high' || (loadTier === 'mid' && mealCount < 4),
    higherDensity: loadTier !== 'low' && !overeater,
    overeater,
    restriction: a.restriction || ['none'],
    irregular: ['travel','shifts','nights','erratic'].includes(a.schedule),
    workout: a.workout,
    loadPerKg: Math.round(loadPerKg * 10) / 10,
    surplus: Math.round(surplus),
  };

  return { morningMode, mealCount, loadTier, flags, notes };
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
  const isCut = direction === 'cut';
  const pW = PROTEIN_WEIGHTS[direction][mealCount][tier];
  const fW = FAT_WEIGHTS[direction][mealCount][tier];
  const fibW = FIBER_WEIGHTS[direction][mealCount][tier];

  let kcalArr = calVec.map((p) => (code.target * p) / 100);

  // CUT: cap the last meal (never bank an unrealistic dinner), redistribute the
  // freed calories to the earlier meals.
  if (isCut && mealCount >= 2) {
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
    // BULK: unchanged behavior.
    let proteinArr = distribute(code.protein, pW);
    for (let i = 0; i < proteinArr.length; i++) {
      if (proteinArr[i] < PROTEIN_FLOOR_G && code.protein >= PROTEIN_FLOOR_G * mealCount) proteinArr[i] = PROTEIN_FLOOR_G;
    }
    meals = kcalArr.map((kcal, i) => {
      const p = roundTo5g(proteinArr[i]);
      const f = roundTo5g(fatArr[i]);
      const c = Math.max(0, roundTo5g((kcal - p * 4 - f * 9) / 4));
      return {
        index: i,
        kcal: roundToNearest50(p * 4 + f * 9 + c * 4),
        protein: p, fat: f, carbs: c, fiber: roundTo5g(fiberArr[i]),
        densityBand: pickDensityBand(direction, i, mealCount, tier, heightDiff),
        pctOfDay: calVec[i],
        isShake: false,
      };
    });
  }

  // SHAKE SLOT — a single budgeted feeding, deducted from a real meal so the day
  // still sums to target. Placement: anchor (morning feeding) / pre / post.
  const fl = structure.flags || {};
  const hungry = !!fl.hungryPostWorkout;
  const eveningNoFit = !!timing.eveningNoFit;

  let shakeKind = null;
  let deductFrom = 'first';
  if (fl.shakePre) {
    shakeKind = hungry ? 'post' : 'pre';
    deductFrom = 'first';
  } else if (fl.shakeAnchor || fl.amProtein) {
    shakeKind = 'anchor';
  } else if (eveningNoFit && hungry) {
    shakeKind = 'post';
    deductFrom = 'last';
  }

  if (shakeKind && meals.length) {
    // Early protein feeding is a bigger AM slice (~10% / ~35g); the IF morning-
    // trainer bridge and the bulk AM floor stay at the smaller ~6% / 25g size.
    const isEarlyFeed = direction === 'cut' && structure.morningMode === 'early_feed';
    let shakeP, shakePct;
    if (direction === 'bulk') { shakeP = BULK_AM_PROTEIN_FLOOR; shakePct = SHAKE_KCAL_PCT; }
    else if (isEarlyFeed) { shakeP = EARLY_FEED_SHAKE_PROTEIN_G; shakePct = EARLY_FEED_SHAKE_PCT; }
    else { shakeP = SHAKE_PROTEIN_G; shakePct = SHAKE_KCAL_PCT; }

    const shakeKcalRaw = Math.max(shakeP * 4, Math.round(code.target * shakePct));
    const shakeC = Math.max(0, roundTo5g((shakeKcalRaw - shakeP * 4) / 4));
    const sp = roundTo5g(shakeP);
    const shake = {
      index: -1,
      kcal: roundToNearest50(sp * 4 + shakeC * 4),
      protein: sp, fat: 0, carbs: shakeC, fiber: 0,
      densityBand: null,
      isShake: true,
      shakeKind,
      optional: false,
    };
    const tgt = deductFrom === 'last' ? meals[meals.length - 1] : meals[0];
    const tp = Math.max(0, roundTo5g(tgt.protein - shake.protein));
    const tc = Math.max(0, roundTo5g(tgt.carbs - shake.carbs));
    tgt.protein = tp; tgt.carbs = tc;
    tgt.kcal = roundToNearest50(tp * 4 + tgt.fat * 9 + tc * 4);
    if (shakeKind === 'post') meals.push(shake);
    else meals.unshift(shake);
  }

  return { meals, tier, mealCount };
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

function buildTemplateId(code, structure, personalization) {
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
  ];
  const payload = suffixFields.join('|');
  const enc = base64urlEncode(payload);
  const ck = checksum2(`${prefix}|${payload}`);
  return `${MF_SCHEMA_PREFIX}-${prefix}-${enc}-${ck}`;
}

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
  if (isNaN(code.target) || isNaN(mealCount)) return { ok: false, error: 'fields' };
  return { ok: true, data: { code, structure, personalization } };
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

// =====================================================
// SEED MEAL LIBRARY (tiny — full tagged library + photos arrive in Artifact B)
// =====================================================

const SEED_LIBRARY = [
  { name: 'Tofu scramble + mushrooms', slot: ['early','mid'], kcal: 580, p: 48, f: 27, c: 44, g: 520, pal: 'enjoyable', diet: ['vegan','vegetarian','nomeat','none'] },
  { name: 'Burrito bowl (plant mince + veg)', slot: ['early','mid'], kcal: 660, p: 45, f: 27, c: 59, g: 650, pal: 'enjoyable', diet: ['vegan','vegetarian','nomeat','none'] },
  { name: 'Chicken, veg & potatoes', slot: ['early','mid','dinner'], kcal: 620, p: 55, f: 18, c: 60, g: 600, pal: 'enjoyable', diet: ['none','nopork','pescatarian'] },
  { name: 'Protein smoothie', slot: ['anchor'], kcal: 300, p: 35, f: 6, c: 28, g: 400, pal: 'enjoyable', diet: ['vegan','vegetarian','nomeat','none'], liquid: true },
  { name: 'Lean meat wraps + veg', slot: ['dinner'], kcal: 830, p: 54, f: 22, c: 110, g: 700, pal: 'enjoyable', diet: ['none','nopork'] },
  { name: 'Veggie burgers + side veg', slot: ['dinner'], kcal: 740, p: 43, f: 21, c: 109, g: 650, pal: 'hyperpalatable', diet: ['vegan','vegetarian','nomeat','none'] },
  { name: 'Family pasta (lean meat + sauce)', slot: ['dinner'], kcal: 900, p: 50, f: 26, c: 120, g: 550, pal: 'hyperpalatable', diet: ['none','nopork','vegetarian'] },
];

function matchMeals(meal, slotName, restriction) {
  const restr = (restriction && restriction.length) ? restriction : ['none'];
  const noRestr = restr.includes('none');
  return SEED_LIBRARY
    .filter((d) => d.slot.includes(slotName))
    .filter((d) => noRestr || d.diet.some((t) => restr.includes(t)))
    .map((d) => {
      const density = d.kcal / d.g;
      const inBand = density >= meal.densityBand[0] && density <= meal.densityBand[1];
      const proteinFit = Math.abs(d.p - meal.protein);
      return { ...d, density: Math.round(density * 100) / 100, inBand, proteinFit };
    })
    .sort((a, b) => (b.inBand - a.inBand) || (a.proteinFit - b.proteinFit))
    .slice(0, 2);
}

function slotNameFor(i, count, morningMode) {
  if (i === count - 1) return 'dinner';
  if (i === 0) return 'early';
  return 'mid';
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

const LandingScreen = ({ onStart, onDecode }) => (
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
          I already have a MealFrame™ ID
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
      <div className="mt-3 space-y-6">
        {current.map((qq) => (
          <div key={qq.id}>
            <label className="text-sm font-medium text-stone-900">{qq.q}</label>
            {qq.multi && <p className="text-xs text-stone-500 mt-0.5">Select all that apply</p>}
            <div className="space-y-2 mt-2">
              {qq.options.map(([val, label]) => {
                const sel = qq.multi ? (Array.isArray(answers[qq.id]) && answers[qq.id].includes(val)) : answers[qq.id] === val;
                return (
                  <button key={val} onClick={() => setAnswer(qq.id, val, qq.multi)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors text-sm ${sel ? 'border-orange-500 bg-orange-50' : 'border-stone-200 hover:border-orange-500 hover:bg-orange-50'}`}>
                    <span className="font-medium text-stone-900">{label}</span>
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

// Compute the ordered day events. Placement is RELATIONAL: the last meal floats
// off SLEEP, and an evening workout shifts where the big meal lands. Depends only
// on tier + times, so a decoded ID reproduces the same timeline.
function buildDayEvents(structure, p, meals) {
  const round15 = (m) => Math.round(m / 15) * 15;
  const events = [{ t: p.wake, icon: 'wake', label: 'Wake' }];
  const trains = structure.flags?.workout !== 'none' && p.train > 0;
  const realMeals = meals.filter((m) => !m.isShake);
  const shakeMeal = meals.find((m) => m.isShake);
  const rn = realMeals.length;

  const wake = p.wake;
  const w = classifyWorkout(wake, p.sleep, p.train, trains);
  const cont = (t) => (t < wake ? t + 1440 : t);
  const sleepC = cont(p.sleep);
  const trainC = trains ? cont(p.train) : 0;

  const sleepAnchored = sleepC - LAST_MEAL_BEFORE_SLEEP;
  let lastMealTime = sleepAnchored;
  let priorEnd;
  let lightAfterWorkout = false;

  if (w.evening) {
    if (w.fits) {
      lastMealTime = trainC + POST_WORKOUT_MEAL_DELAY;
      priorEnd = trainC - 45;
    } else {
      lastMealTime = Math.min(trainC - PRE_WORKOUT_MEAL_GAP, sleepAnchored);
      priorEnd = lastMealTime - 75;
      lightAfterWorkout = true;
    }
  } else {
    priorEnd = lastMealTime - 75;
  }

  // First eating event by morning mode. IF delays the first real meal (fast to
  // midday); breakfast / bulk modes eat early. Don't start before a morning workout.
  const delayedStart = (structure.morningMode === 'if' || structure.morningMode === 'fasted');
  let firstMeal = delayedStart ? wake + FIRST_MEAL_AFTER_WAKE_FASTED : wake + FIRST_MEAL_AFTER_WAKE;
  if (w.morning && trainC >= wake && trainC < firstMeal) firstMeal = Math.max(firstMeal, trainC + 45);
  if (rn > 1 && firstMeal > lastMealTime - MIN_INTER_MEAL_GAP * (rn - 1)) {
    firstMeal = Math.max(wake + 30, lastMealTime - INTER_MEAL_GAP * (rn - 1));
  }

  const mealTimes = [];
  if (rn === 1) {
    mealTimes.push(lastMealTime);
  } else {
    const forwardLastNonFinal = firstMeal + INTER_MEAL_GAP * (rn - 2);
    if (forwardLastNonFinal <= lastMealTime - INTER_MEAL_GAP) {
      for (let i = 0; i < rn - 1; i++) mealTimes.push(firstMeal + INTER_MEAL_GAP * i);
    } else {
      for (let i = 0; i < rn - 1; i++) {
        mealTimes.push(firstMeal + ((lastMealTime - firstMeal) * i) / (rn - 1));
      }
    }
    mealTimes.push(lastMealTime);
  }

  if (shakeMeal) {
    let st, label;
    if (shakeMeal.shakeKind === 'post' && trains) {
      st = trainC + POST_WORKOUT_LIGHT_DELAY;
      label = `Post-workout shake · ${shakeMeal.kcal} kcal`;
    } else if (shakeMeal.shakeKind === 'pre' && trains) {
      st = Math.max(wake + 5, trainC - 15);
      label = `Pre-workout shake · ${shakeMeal.kcal} kcal`;
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

  const hasPostShake = shakeMeal && shakeMeal.shakeKind === 'post';
  if (lightAfterWorkout && !hasPostShake) {
    events.push({ t: round15(trainC + POST_WORKOUT_LIGHT_DELAY), icon: 'snack', label: 'Light snack or shake (optional)', sub: 'if you\'re hungry after training' });
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

const TimelinePreview = ({ structure, personalization, meals }) => {
  const events = buildDayEvents(structure, personalization, meals);
  const Icon = { wake: Coffee, meal: UtensilsCrossed, train: Dumbbell, sleep: Moon, shake: ShakeIcon, snack: ShakeIcon };
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-5">
      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Your day (preview — visual timeline coming soon)</div>
      <div className="space-y-2">
        {events.map((e, i) => {
          const I = Icon[e.icon];
          const isMeal = e.icon === 'meal';
          const isLight = e.icon === 'shake' || e.icon === 'snack';
          return (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div className="w-16 text-stone-500 tabular-nums">{minutesToClock(e.t)}</div>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isMeal ? 'bg-orange-100 text-orange-600' : isLight ? 'bg-orange-50 text-orange-500' : 'bg-stone-200 text-stone-600'}`}><I className="w-4 h-4" /></div>
              <div><div className="font-medium text-stone-900">{e.label}</div>{e.sub && <div className="text-xs text-stone-500">{e.sub}</div>}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ResultsScreen = ({ code, structure, personalization, plan, templateId, decodedMode, onRestart, onBack }) => {
  const [copied, setCopied] = useState(false);
  const isCut = code.direction === 'cut';
  const tier = isCut ? structure.backloadTier : structure.loadTier;
  const tierLabel = { light: 'Balanced', moderate: 'Moderate backload', heavy: 'Heavy backload', low: 'Low load', mid: 'Moderate load', high: 'High load' }[tier];
  const morningLabel = { if: 'Intermittent fasting', breakfast: 'Breakfast', early_feed: 'Early protein feeding', fasted: 'Fasted morning', light_anchor: 'Light start', even: 'Even meals' }[structure.morningMode];
  const prose = buildDescription(code, structure, personalization);
  const restriction = structure.flags?.restriction || ['none'];

  const goToOptiWorkout = () => window.open(`${OPTIWORKOUT_URL}?code=${encodeURIComponent(templateId)}`, '_blank');
  const copyId = async () => {
    try { await navigator.clipboard.writeText(templateId); setCopied(true); setTimeout(()=>setCopied(false),2000); } catch {}
  };

  return (
    <Card className="max-w-2xl">
      <BackButton onClick={onBack} />
      <span className="text-xs font-semibold text-orange-600 tracking-widest uppercase">Your Meal Structure</span>
      <h2 className="mt-2 text-3xl font-bold text-stone-900">{structure.mealCount} meals · {isCut ? 'cutting' : 'bulking'}</h2>
      <p className="text-stone-600 mt-2 text-sm">{morningLabel} · {tierLabel} · {code.target} kcal/day</p>

      {decodedMode && (
        <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 mt-3">
          Loaded from a MealFrame™ ID. The structure and macros are exact; clock times shown are from the ID. (Body-composition fine-tuning of density only applies on a fresh run.)
        </p>
      )}

      <div className="mt-5"><TimelinePreview structure={structure} personalization={personalization} meals={plan.meals} /></div>

      <div className="mt-5 bg-orange-50 border border-orange-200 rounded-xl p-5">
        <h3 className="font-semibold text-stone-900 text-sm mb-2">How to run your day</h3>
        <div className="space-y-2 text-sm text-stone-700 leading-relaxed">
          {prose.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Meal-by-meal targets</h3>
        <div className="space-y-2">
          {(() => {
            const realCount = plan.meals.filter((m) => !m.isShake).length;
            let realIdx = 0;
            return plan.meals.map((m, i) => {
              if (m.isShake) {
                return (
                  <div key={i} className="bg-orange-50/60 border border-orange-200 rounded-xl p-4">
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
              const slot = slotNameFor(realIdx - 1, realCount, structure.morningMode);
              const examples = matchMeals(m, slot, restriction);
              return (
                <div key={i} className="bg-white border border-stone-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-stone-900">Meal {myNum} <span className="text-xs font-normal text-stone-500">· {m.pctOfDay}% of calories</span></div>
                    <div className="text-lg font-bold text-stone-900">{m.kcal} kcal</div>
                  </div>
                  <div className="text-sm text-stone-600 mt-1">{m.protein}g protein · {m.carbs}g carbs · {m.fat}g fat · {m.fiber}g fiber</div>
                  {m.densityBand && <div className="text-xs text-stone-400 mt-1">Target density: {m.densityBand[0]}–{m.densityBand[1]} kcal/g</div>}
                  {examples.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-stone-100 text-xs text-stone-500">
                      <span className="font-medium text-stone-600">Examples (seed):</span> {examples.map((e)=>`${e.name} (~${e.density} kcal/g)`).join(' · ')}
                      <div className="text-stone-400 mt-0.5">Scale portions to hit the targets above. Full photo library coming soon.</div>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>

      {structure.notes && structure.notes.length > 0 && (
        <div className="mt-4 bg-stone-50 border border-stone-200 rounded-xl p-5">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Why this structure</div>
          <ul className="space-y-1.5 text-sm text-stone-600">
            {structure.notes.map((n, i) => <li key={i} className="flex gap-2"><Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" /><span>{n}</span></li>)}
          </ul>
        </div>
      )}

      <div className="border-t border-stone-200 my-6"></div>
      <div className="bg-stone-900 rounded-xl p-5 text-center">
        <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Your MealFrame™ ID</h4>
        <p className="text-stone-400 text-xs mt-1">This is your structure. Paste it back into MealFrame anytime to see this page again, and give it to your coach to set up your plan in the ShredSmart app.</p>
        <div className="mt-3 bg-stone-800 border border-stone-700 rounded-lg px-3 py-3"><code className="text-orange-300 text-xs break-all leading-relaxed">{templateId}</code></div>
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
  const [decodedMode, setDecodedMode] = useState(false);

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
        const trains = struct.flags?.workout !== 'none';
        const w = classifyWorkout(times?.wake ?? DEFAULT_WAKE, times?.sleep ?? DEFAULT_SLEEP, times?.train ?? DEFAULT_TRAIN, trains);
        const hungry = !!struct.flags?.hungryPostWorkout;
        if (w.evening && !w.fits) {
          const after = hungry
            ? 'with a protein shake or light snack right after training, since you get hungry then.'
            : 'with an optional light snack or shake after if you\'re hungry.';
          struct = {
            ...struct,
            notes: [...(struct.notes || []), `You train late, so a big post-workout meal wouldn't digest before bed. Your largest meal is placed before the gym — about 2 hours prior, so it settles before you train — ${after}`],
          };
        }
        const mealPlan = buildMealPlan(code, struct, {
          eveningNoFit: w.evening && !w.fits,
          trains,
          wake: times?.wake ?? DEFAULT_WAKE,
          sleep: times?.sleep ?? DEFAULT_SLEEP,
          train: trains ? (times?.train ?? DEFAULT_TRAIN) : 0,
        });
        const pers = {
          wake: times?.wake ?? DEFAULT_WAKE,
          sleep: times?.sleep ?? DEFAULT_SLEEP,
          train: struct.flags?.workout === 'none' ? 0 : (times?.train ?? DEFAULT_TRAIN),
          dessert: !!struct.flags?.dessert,
          alcohol: !!struct.flags?.alcohol,
          shakePre: !!struct.flags?.shakePre,
          shakeAnchor: !!struct.flags?.shakeAnchor || !!struct.flags?.amProtein,
          hungryPostWorkout: hungry,
        };
        const id = buildTemplateId(code, struct, pers);
        setStructure(struct); setPlan(mealPlan); setPersonalization(pers); setTemplateId(id);
        setDecodedMode(false);
        setScreen('results');
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [screen, code, answers, times]);

  const loadFromId = (data) => {
    const p = data.personalization || {};
    const struct = {
      ...data.structure,
      flags: {
        ...(data.structure.flags || {}),
        hungryPostWorkout: !!p.hungryPostWorkout,
        shakePre: !!p.shakePre,
        shakeAnchor: !!p.shakeAnchor,
        workout: p.train > 0 ? (data.structure.flags?.workout || 'varies') : 'none',
      },
    };
    const w = classifyWorkout(p.wake, p.sleep, p.train, p.train > 0);
    setCode(data.code);
    setStructure(struct);
    setPersonalization(p);
    setPlan(buildMealPlan(data.code, struct, {
      eveningNoFit: w.evening && !w.fits,
      trains: p.train > 0,
      wake: p.wake, sleep: p.sleep, train: p.train,
    }));
    setTemplateId(buildTemplateId(data.code, struct, p));
    setDecodedMode(true);
    setScreen('results');
  };

  const restart = () => {
    setScreen('landing'); setCode(null); setPastedCode(''); setCodeError(null);
    setAnswers({}); setTimes(null); setStructure(null); setPlan(null); setPersonalization(null);
    setTemplateId(''); setDecodedMode(false);
  };

  return (
    <Container>
      {screen === 'landing' && <LandingScreen onStart={() => setScreen('code')} onDecode={() => setScreen('decode_id')} />}

      {screen === 'code' && (
        <CodeScreen initialCode={pastedCode} initialError={codeError}
          onDecoded={(data, c) => { setCode(data); setUnits(data.units); setPastedCode(c); setCodeError(null); setScreen('intro'); }}
          onBack={() => setScreen('landing')} />
      )}
      {screen === 'intro' && code && (
        <IntroScreen code={code} units={units} onContinue={() => setScreen('questionnaire')} onBack={() => setScreen('code')} />
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
          templateId={templateId} decodedMode={decodedMode}
          onRestart={restart} onBack={() => setScreen(decodedMode ? 'decode_id' : 'questionnaire')} />
      )}

      {screen === 'decode_id' && <DecodeIdScreen onDecoded={loadFromId} onBack={() => setScreen('landing')} />}
    </Container>
  );
}