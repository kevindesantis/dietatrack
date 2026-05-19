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
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function estimateTargets(profile) {
  const sex = profile?.sex;
  const weight = Number(profile?.current_weight || profile?.start_weight || 0);
  const height = Number(profile?.height_cm || 0);
  const age = calculateAge(profile?.birth_date) || Number(profile?.age || 0);
  const targetWeight = Number(profile?.target_weight || 0);

  if (!sex || !weight || !height || !age) {
    return null;
  }

  const activityFactors = {
    sedentario: 1.2,
    leggero: 1.375,
    medio: 1.55,
    alto: 1.725
  };

  const bmr = sex === 'femmina'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;

  const tdee = bmr * (activityFactors[profile.activity_level] || 1.2);
  const wantsLoss = targetWeight && targetWeight < weight;
  const kcalTarget = wantsLoss ? Math.max(1200, tdee - 500) : tdee;
  const protein = Math.max(1.6 * weight, 90);
  const fat = Math.max(0.8 * weight, 45);
  const carbs = Math.max((kcalTarget - protein * 4 - fat * 9) / 4, 80);

  return {
    kcal_target: round(kcalTarget, 0),
    protein_target: round(protein, 0),
    carbs_target: round(carbs, 0),
    fat_target: round(fat, 0),
    bmr: round(bmr, 0),
    tdee: round(tdee, 0)
  };
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
