export function calculateNutrition(food, grams) {
  const factor = Number(grams || 0) / 100;
  return {
    kcal: round((Number(food.kcal_100g) || 0) * factor, 1),
    protein: round((Number(food.protein_100g) || 0) * factor, 1),
    carbs: round((Number(food.carbs_100g) || 0) * factor, 1),
    fat: round((Number(food.fat_100g) || 0) * factor, 1),
    fiber: round((Number(food.fiber_100g) || 0) * factor, 1),
    sugar: round((Number(food.sugar_100g) || 0) * factor, 1),
    salt: round((Number(food.salt_100g) || 0) * factor, 2)
  };
}

export function sumLogs(logs) {
  return logs.reduce(
    (acc, item) => ({
      kcal: acc.kcal + Number(item.kcal || 0),
      protein: acc.protein + Number(item.protein || 0),
      carbs: acc.carbs + Number(item.carbs || 0),
      fat: acc.fat + Number(item.fat || 0),
      fiber: acc.fiber + Number(item.fiber || 0),
      sugar: acc.sugar + Number(item.sugar || 0),
      salt: acc.salt + Number(item.salt || 0)
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 }
  );
}

export function remaining(target, totals) {
  return {
    kcal: round(Number(target?.kcal_target || 0) - Number(totals.kcal || 0), 1),
    protein: round(Number(target?.protein_target || 0) - Number(totals.protein || 0), 1),
    carbs: round(Number(target?.carbs_target || 0) - Number(totals.carbs || 0), 1),
    fat: round(Number(target?.fat_target || 0) - Number(totals.fat || 0), 1)
  };
}

export function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

export function calculateAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

function addDaysISO(startDate, amount) {
  const date = new Date(`${startDate}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function activityFactor(level) {
  return {
    sedentario: 1.2,
    leggero: 1.375,
    medio: 1.55,
    alto: 1.725
  }[level] || 1.2;
}

function bmrMifflin({ sex, weight, height, age }) {
  return sex === 'femmina'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;
}

function macroTargets({ kcalTarget, weight, sex, goalType }) {
  const minCalories = sex === 'femmina' ? 1200 : 1500;
  const kcal = Math.max(Number(kcalTarget || 0), minCalories);

  let protein = goalType === 'perdita'
    ? Math.max(1.7 * weight, sex === 'femmina' ? 75 : 95)
    : Math.max(1.5 * weight, sex === 'femmina' ? 70 : 90);

  let fat = Math.max(0.75 * weight, sex === 'femmina' ? 45 : 50);
  let carbs = (kcal - protein * 4 - fat * 9) / 4;

  if (carbs < 80) {
    fat = Math.max(0.55 * weight, sex === 'femmina' ? 38 : 45);
    carbs = (kcal - protein * 4 - fat * 9) / 4;
  }

  if (carbs < 80) {
    protein = Math.max(1.35 * weight, sex === 'femmina' ? 65 : 85);
    carbs = (kcal - protein * 4 - fat * 9) / 4;
  }

  return {
    kcal_target: round(kcal, 0),
    protein_target: round(protein, 0),
    carbs_target: round(Math.max(carbs, 80), 0),
    fat_target: round(fat, 0)
  };
}

export function estimateTargets(profile) {
  const plan = estimatePersonalizedPlan(profile);
  if (!plan?.valid) return null;
  return {
    kcal_target: plan.kcal_target,
    protein_target: plan.protein_target,
    carbs_target: plan.carbs_target,
    fat_target: plan.fat_target,
    bmr: plan.bmr,
    tdee: plan.tdee
  };
}

export function estimatePersonalizedPlan(profile, startDate = todayISO()) {
  const sex = profile?.sex || 'maschio';
  const weight = Number(profile?.current_weight || profile?.start_weight || 0);
  const height = Number(profile?.height_cm || 0);
  const age = calculateAge(profile?.birth_date) || Number(profile?.age || 0);
  const targetWeight = Number(profile?.target_weight || 0);
  const targetDays = daysBetween(startDate, profile?.target_date);

  if (!sex || !weight || !height || !age) {
    return {
      valid: false,
      message: 'Inserisci sesso, data di nascita, altezza e peso attuale o iniziale.'
    };
  }

  const bmr = bmrMifflin({ sex, weight, height, age });
  const tdee = bmr * activityFactor(profile?.activity_level);
  const minCalories = sex === 'femmina' ? 1200 : 1500;

  let goalType = 'mantenimento';
  let kcalTarget = tdee;
  let dailyDeficit = 0;
  let dailySurplus = 0;
  let requestedRateKgWeek = 0;
  let plannedRateKgWeek = 0;
  let realistic = true;
  let message = 'Obiettivo di mantenimento: dieta impostata intorno al consumo giornaliero stimato.';
  let suggestedTargetDate = null;

  if (targetWeight && targetWeight < weight) {
    goalType = 'perdita';
    const kgToLose = weight - targetWeight;
    const requestedDays = targetDays || Math.ceil((kgToLose / 0.5) * 7);
    const safeDays = Math.max(requestedDays, 14);
    requestedRateKgWeek = kgToLose / (safeDays / 7);

    const requiredDeficit = (kgToLose * 7700) / safeDays;
    const maxDeficit = Math.min(1000, tdee * 0.25);
    const preferredDeficit = targetDays ? requiredDeficit : 500;
    dailyDeficit = Math.max(250, Math.min(preferredDeficit, maxDeficit));

    kcalTarget = Math.max(tdee - dailyDeficit, minCalories);
    dailyDeficit = Math.max(0, tdee - kcalTarget);
    plannedRateKgWeek = (dailyDeficit * 7) / 7700;

    const realisticDays = Math.ceil((kgToLose * 7700) / Math.max(dailyDeficit, 1));
    suggestedTargetDate = addDaysISO(startDate, realisticDays);

    if (!targetDays) {
      message = `Non hai inserito una data obiettivo: uso un ritmo sostenibile, circa ${round(plannedRateKgWeek, 2)} kg/settimana. Data stimata indicativa: ${suggestedTargetDate}.`;
    } else if (requiredDeficit > maxDeficit || kcalTarget <= minCalories || requestedRateKgWeek > 0.9) {
      realistic = false;
      message = `L'obiettivo richiesto è troppo veloce. Ho impostato un deficit più prudente: circa ${round(plannedRateKgWeek, 2)} kg/settimana. Data realistica stimata: ${suggestedTargetDate}.`;
    } else {
      message = `Obiettivo impostato per perdere circa ${round(plannedRateKgWeek, 2)} kg/settimana.`;
    }
  }

  if (targetWeight && targetWeight > weight) {
    goalType = 'aumento';
    const kgToGain = targetWeight - weight;
    const requestedDays = targetDays || Math.ceil((kgToGain / 0.25) * 7);
    const requiredSurplus = (kgToGain * 7700) / Math.max(requestedDays, 14);
    dailySurplus = Math.max(150, Math.min(requiredSurplus, 350, tdee * 0.15));
    kcalTarget = tdee + dailySurplus;
    plannedRateKgWeek = (dailySurplus * 7) / 7700;

    const realisticDays = Math.ceil((kgToGain * 7700) / Math.max(dailySurplus, 1));
    suggestedTargetDate = addDaysISO(startDate, realisticDays);

    if (!targetDays) {
      message = `Non hai inserito una data obiettivo: uso un aumento graduale, circa ${round(plannedRateKgWeek, 2)} kg/settimana. Data stimata indicativa: ${suggestedTargetDate}.`;
    } else if (requiredSurplus > dailySurplus) {
      realistic = false;
      message = `L'aumento richiesto è troppo rapido. Ho impostato un surplus più graduale: circa ${round(plannedRateKgWeek, 2)} kg/settimana. Data realistica stimata: ${suggestedTargetDate}.`;
    } else {
      message = `Obiettivo impostato per aumentare circa ${round(plannedRateKgWeek, 2)} kg/settimana.`;
    }
  }

  const macros = macroTargets({ kcalTarget, weight, sex, goalType });

  return {
    valid: true,
    goal_type: goalType,
    realistic,
    message,
    suggested_target_date: suggestedTargetDate,
    age,
    weight,
    height,
    bmr: round(bmr, 0),
    tdee: round(tdee, 0),
    daily_deficit: round(dailyDeficit, 0),
    daily_surplus: round(dailySurplus, 0),
    requested_rate_kg_week: round(requestedRateKgWeek, 2),
    planned_rate_kg_week: round(plannedRateKgWeek, 2),
    min_calories: minCalories,
    target_days: targetDays,
    ...macros
  };
}


export const restrictionGroups = [
  {
    title: 'Allergie e intolleranze',
    options: [
      { key: 'lattosio', label: 'Lattosio / latte', terms: ['latte', 'lattosio', 'yogurt', 'formaggio', 'mozzarella', 'ricotta', 'burro', 'panna', 'whey', 'siero di latte', 'milk'] },
      { key: 'glutine', label: 'Glutine / celiachia', terms: ['glutine', 'pasta', 'pane', 'farro', 'orzo', 'segale', 'frumento', 'grano', 'cous cous', 'seitan', 'wheat', 'barley', 'rye'] },
      { key: 'uova', label: 'Uova', terms: ['uovo', 'uova', 'albume', 'tuorlo', 'egg'] },
      { key: 'pesce', label: 'Pesce', terms: ['pesce', 'tonno', 'salmone', 'merluzzo', 'orata', 'spigola', 'fish'] },
      { key: 'crostacei_molluschi', label: 'Crostacei / molluschi', terms: ['gambero', 'gamberi', 'scampo', 'scampi', 'aragosta', 'cozze', 'vongole', 'molluschi', 'crostacei', 'shellfish', 'crustaceans', 'molluscs'] },
      { key: 'frutta_secca', label: 'Frutta secca a guscio', terms: ['mandorle', 'nocciole', 'noci', 'pistacchi', 'anacardi', 'pinoli', 'frutta secca', 'nuts', 'almond', 'hazelnut', 'walnut', 'pistachio', 'cashew'] },
      { key: 'arachidi', label: 'Arachidi', terms: ['arachidi', 'arachide', 'peanuts', 'peanut'] },
      { key: 'soia', label: 'Soia', terms: ['soia', 'tofu', 'edamame', 'soy', 'soybean'] },
      { key: 'sesamo', label: 'Sesamo', terms: ['sesamo', 'tahina', 'tahini', 'sesame'] },
      { key: 'nichel', label: 'Nichel alto', terms: ['cacao', 'cioccolato', 'lenticchie', 'ceci', 'fagioli', 'soia', 'frutta secca', 'spinaci', 'pomodoro', 'avena'] }
    ]
  },
  {
    title: 'Preferenze / esclusioni',
    options: [
      { key: 'vegetariano', label: 'Vegetariano', terms: ['pollo', 'manzo', 'carne', 'maiale', 'tacchino', 'prosciutto', 'salame', 'tonno', 'salmone', 'pesce', 'gamberi'] },
      { key: 'vegano', label: 'Vegano', terms: ['pollo', 'manzo', 'carne', 'maiale', 'tacchino', 'prosciutto', 'salame', 'tonno', 'salmone', 'pesce', 'gamberi', 'uovo', 'uova', 'latte', 'yogurt', 'formaggio', 'miele'] },
      { key: 'no_maiale', label: 'No maiale / salumi', terms: ['maiale', 'prosciutto', 'salame', 'pancetta', 'speck', 'salsiccia', 'mortadella', 'pork'] },
      { key: 'no_carne_rossa', label: 'No carne rossa', terms: ['manzo', 'vitello', 'bovino', 'hamburger', 'carne rossa', 'beef'] },
      { key: 'no_pesce', label: 'No pesce', terms: ['pesce', 'tonno', 'salmone', 'merluzzo', 'orata', 'spigola', 'gamberi'] },
      { key: 'pochi_zuccheri', label: 'Preferisco pochi zuccheri', terms: ['zucchero', 'miele', 'marmellata', 'biscotti', 'dolce', 'merendina'] },
      { key: 'poco_sale', label: 'Preferisco poco sale', terms: ['salato', 'salumi', 'tonno', 'formaggio stagionato', 'snack'] }
    ]
  }
];

export const restrictionOptions = restrictionGroups.flatMap(group => group.options.map(option => ({ ...option, group: group.title })));

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).map(item => item.trim()).filter(Boolean);
    } catch (_) {}
    return trimmed.split(/[,;\n]/).map(item => item.trim()).filter(Boolean);
  }
  return [];
}

export function selectedRestrictionKeys(profile = {}) {
  return [...new Set(parseList(profile.selected_restrictions || profile.restriction_keys))];
}

export function restrictionLabelsForProfile(profile = {}) {
  const keys = selectedRestrictionKeys(profile);
  return restrictionOptions.filter(option => keys.includes(option.key)).map(option => option.label);
}

function foodText(food = {}) {
  const allergens = parseList(food.allergens).join(' ');
  const tags = parseList(food.tags).join(' ');
  return `${food.name || ''} ${food.brand || ''} ${food.category || ''} ${allergens} ${tags}`.toLowerCase();
}

export function restrictionMatchesForFood(food, profile = {}) {
  const text = foodText(food);
  const matches = [];
  const selected = selectedRestrictionKeys(profile);

  for (const option of restrictionOptions) {
    if (!selected.includes(option.key)) continue;
    const matched = option.terms.some(term => text.includes(term.toLowerCase()));
    if (matched) matches.push(option.label);
  }

  const manualTerms = [
    ...parseList(profile.excluded_foods),
    ...parseList(profile.custom_allergies)
  ];

  for (const term of manualTerms) {
    if (term && text.includes(term.toLowerCase())) matches.push(term);
  }

  return [...new Set(matches)];
}

export function isFoodAllowedForProfile(food, profile = {}) {
  return restrictionMatchesForFood(food, profile).length === 0;
}

export function restrictionSummary(profile = {}) {
  const labels = restrictionLabelsForProfile(profile);
  const custom = parseList(profile.custom_allergies);
  const excluded = parseList(profile.excluded_foods);
  return [...new Set([...labels, ...custom, ...excluded])];
}

const mealSplit = {
  colazione: 0.24,
  pranzo: 0.36,
  merenda: 0.1,
  cena: 0.3
};

const weeklyTemplates = {
  colazione: [
    { name: 'Colazione salata', items: [['Pane comune', 70], ['Uovo intero', 65], ['Banana', 100]] },
    { name: 'Colazione yogurt', items: [['Yogurt greco 0%', 220], ['Banana', 120], ['Mandorle', 15]] },
    { name: 'Colazione latte e pane', items: [['Latte parzialmente scremato', 250], ['Pane comune', 65], ['Mandorle', 15]] }
  ],
  pranzo: [
    { name: 'Pasta pollo e verdure', items: [['Pasta di semola cruda', 85], ['Petto di pollo crudo', 150], ['Insalata mista', 180], ['Olio extravergine di oliva', 10]] },
    { name: 'Riso tonno e insalata', items: [['Riso bianco crudo', 90], ['Tonno al naturale sgocciolato', 130], ['Insalata mista', 200], ['Olio extravergine di oliva', 10]] },
    { name: 'Ceci pane e verdure', items: [['Ceci secchi', 75], ['Pane comune', 55], ['Insalata mista', 200], ['Olio extravergine di oliva', 10]] }
  ],
  merenda: [
    { name: 'Frutta secca e banana', items: [['Banana', 150], ['Mandorle', 20]] },
    { name: 'Yogurt e mandorle', items: [['Yogurt greco 0%', 170], ['Mandorle', 15]] },
    { name: 'Pane e tonno', items: [['Pane comune', 45], ['Tonno al naturale sgocciolato', 70]] }
  ],
  cena: [
    { name: 'Salmone patate e verdure', items: [['Salmone', 150], ['Patate crude', 260], ['Insalata mista', 200], ['Olio extravergine di oliva', 8]] },
    { name: 'Manzo pane e insalata', items: [['Manzo magro', 150], ['Pane comune', 65], ['Insalata mista', 220], ['Olio extravergine di oliva', 8]] },
    { name: 'Lenticchie e verdure', items: [['Lenticchie secche', 85], ['Pane comune', 45], ['Insalata mista', 220], ['Olio extravergine di oliva', 8]] }
  ]
};

function findFood(foods, name, profile = {}) {
  const wanted = name.toLowerCase();
  const result = foods.find(food => {
    const text = foodText(food);
    return isFoodAllowedForProfile(food, profile) && text.includes(wanted);
  });
  return result || null;
}

function optionNutrition(items) {
  return sumLogs(items.map(item => item.nutrition || item));
}

function scaleTemplate(template, foods, targetKcal, profile) {
  const baseItems = [];

  for (const [foodName, grams] of template.items) {
    const food = findFood(foods, foodName, profile);
    if (!food) return null;
    baseItems.push({ food, baseGrams: grams, nutrition: calculateNutrition(food, grams) });
  }

  const baseKcal = optionNutrition(baseItems).kcal;
  if (!baseKcal) return null;

  const factor = Math.max(0.55, Math.min(1.75, targetKcal / baseKcal));
  const items = baseItems.map(item => {
    const grams = Math.max(5, Math.round((item.baseGrams * factor) / 5) * 5);
    return {
      food_id: item.food.id,
      food_name: [item.food.name, item.food.brand].filter(Boolean).join(' - '),
      grams,
      ...calculateNutrition(item.food, grams)
    };
  });

  return {
    title: template.name,
    kcal: optionNutrition(items).kcal,
    items
  };
}


const defaultPortions = [
  { test: food => Number(food.kcal_100g || 0) >= 500, grams: 25 },
  { test: food => Number(food.fat_100g || 0) >= 40, grams: 15 },
  { test: food => Number(food.protein_100g || 0) >= 18 && Number(food.carbs_100g || 0) <= 5, grams: 150 },
  { test: food => Number(food.carbs_100g || 0) >= 55 && Number(food.kcal_100g || 0) >= 250, grams: 70 },
  { test: food => /pane/i.test(food.name || ''), grams: 60 },
  { test: food => /patate|banana|mela|frutta|verdure|insalata/i.test(`${food.name || ''} ${food.category || ''}`), grams: 180 },
  { test: () => true, grams: 100 }
];

function defaultPortionForFood(food) {
  const rule = defaultPortions.find(item => item.test(food));
  return rule?.grams || 100;
}

function suggestionReason(nutrition, remain) {
  const reasons = [];
  if (remain.protein > 15 && nutrition.protein >= 12) reasons.push('aiuta con le proteine');
  if (remain.carbs > 25 && nutrition.carbs >= 20) reasons.push('copre carboidrati');
  if (remain.fat > 8 && nutrition.fat >= 5) reasons.push('copre grassi');
  if (nutrition.kcal <= Math.max(remain.kcal, 150)) reasons.push('rientra nelle calorie');
  return reasons.slice(0, 2).join(' · ') || 'porzione bilanciata';
}

export function buildDailySuggestions(foods, target = {}, totals = {}, profile = {}) {
  const remain = remaining(target, totals);
  const remainingKcal = Math.max(Number(remain.kcal || 0), 0);
  const maxKcal = remainingKcal > 0 ? Math.max(remainingKcal + 80, 160) : 250;

  return (foods || [])
    .filter(food => isFoodAllowedForProfile(food, profile))
    .filter(food => Number(food.kcal_100g || 0) > 0)
    .map(food => {
      const base = defaultPortionForFood(food);
      const kcal100 = Math.max(Number(food.kcal_100g || 0), 1);
      const kcalBased = remainingKcal > 0 ? (Math.min(maxKcal, Math.max(120, remainingKcal * 0.45)) / kcal100) * 100 : base;
      let grams = Math.round(Math.min(Math.max(kcalBased, base * 0.55), base * 1.65) / 5) * 5;
      grams = Math.max(5, grams);
      const nutrition = calculateNutrition(food, grams);
      const caloriePenalty = remainingKcal > 0 ? Math.max(0, nutrition.kcal - maxKcal) / 100 : 0;
      const proteinBonus = Math.min(nutrition.protein / Math.max(remain.protein || 1, 1), 1.2);
      const kcalFit = remainingKcal > 0 ? 1 - Math.min(Math.abs(nutrition.kcal - Math.min(maxKcal, remainingKcal * 0.45)) / Math.max(maxKcal, 1), 1) : 0.4;
      const score = proteinBonus * 1.2 + kcalFit - caloriePenalty;
      return {
        food_id: food.id,
        food_name: [food.name, food.brand].filter(Boolean).join(' - '),
        meal_type: 'extra',
        grams,
        reason: suggestionReason(nutrition, remain),
        score,
        ...nutrition
      };
    })
    .filter(item => item.kcal > 0 && (remainingKcal <= 0 || item.kcal <= maxKcal))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function buildGeneratedDietWeek(foods, plan, profile = {}) {
  if (!plan?.valid || !Array.isArray(foods) || foods.length === 0) {
    return { options: [], warnings: ['Mancano alimenti nel database.'] };
  }

  const warnings = [];
  const options = [];

  weekdays.forEach(day => {
    Object.entries(mealSplit).forEach(([mealType, split]) => {
      const mealTarget = plan.kcal_target * split;
      const templates = weeklyTemplates[mealType] || [];
      const start = day.value % templates.length;
      const candidates = [templates[start], templates[(start + 1) % templates.length], templates[(start + 2) % templates.length]].filter(Boolean);
      const usable = candidates
        .map(template => scaleTemplate(template, foods, mealTarget, profile))
        .filter(Boolean)
        .slice(0, 2);

      if (!usable.length) {
        warnings.push(`Non riesco a generare ${mealType} per ${day.label}: mancano alimenti o sono esclusi.`);
        return;
      }

      usable.forEach((option, index) => {
        options.push({
          weekday: day.value,
          meal_type: mealType,
          option_name: `${day.label} ${mealType} - Opzione ${index === 0 ? 'A' : 'B'}: ${option.title}`,
          notes: `Generata automaticamente. Target pasto circa ${round(mealTarget, 0)} kcal; questa opzione circa ${round(option.kcal, 0)} kcal.`,
          items: option.items
        });
      });
    });
  });

  return { options, warnings };
}

export function targetDatesForPlan(plan, startDate = todayISO()) {
  const days = plan?.target_days ? Math.min(Math.max(plan.target_days, 30), 180) : 60;
  return Array.from({ length: days }, (_, i) => addDaysISO(startDate, i));
}

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export const weekdays = [
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
  { value: 0, label: 'Domenica' }
];

export const mealTypes = ['colazione', 'pranzo', 'merenda', 'cena', 'extra'];
