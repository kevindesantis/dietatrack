'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  buildDailySuggestions,
  buildGeneratedDietWeek,
  calculateNutrition,
  estimatePersonalizedPlan,
  estimateTargets,
  mealTypes,
  remaining,
  restrictionGroups,
  restrictionMatchesForFood,
  restrictionSummary,
  round,
  sumLogs,
  targetDatesForPlan,
  todayISO,
  weekdays
} from '../lib/nutrition';

const emptyProfile = {
  name: '',
  email: '',
  sex: 'maschio',
  birth_date: '',
  height_cm: '',
  activity_level: 'sedentario',
  start_weight: '',
  current_weight: '',
  target_weight: '',
  target_date: '',
  goal_notes: '',
  food_preferences: '',
  excluded_foods: '',
  selected_restrictions: [],
  custom_allergies: '',
  allergy_notes: '',
  diet_style: 'equilibrata'
};

const emptyTarget = {
  kcal_target: 2000,
  protein_target: 140,
  carbs_target: 220,
  fat_target: 65
};

export default function Home() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('oggi');
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const [profile, setProfile] = useState(emptyProfile);
  const [foods, setFoods] = useState([]);
  const [foodSearch, setFoodSearch] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [grams, setGrams] = useState('100');
  const [mealType, setMealType] = useState('pranzo');
  const [logs, setLogs] = useState([]);
  const [target, setTarget] = useState(emptyTarget);
  const [dailyStatus, setDailyStatus] = useState('non_registrata');
  const [measurements, setMeasurements] = useState([]);
  const [plannedOptions, setPlannedOptions] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [workoutLog, setWorkoutLog] = useState(null);

  const [manualFood, setManualFood] = useState({
    name: '', brand: '', category: '', barcode: '', allergens: '', tags: '', kcal_100g: '', protein_100g: '', carbs_100g: '', fat_100g: '', fiber_100g: '', sugar_100g: '', salt_100g: ''
  });
  const [barcode, setBarcode] = useState('');
  const [onlineFoodQuery, setOnlineFoodQuery] = useState('');
  const [onlineFoodResults, setOnlineFoodResults] = useState([]);
  const [onlineFoodLoading, setOnlineFoodLoading] = useState(false);
  const [measurementForm, setMeasurementForm] = useState({ weight: '', waist: '', hips: '', chest: '', abdomen: '', arm: '', thigh: '', neck: '', notes: '' });
  const [plannedForm, setPlannedForm] = useState({ weekday: 1, meal_type: 'pranzo', option_name: '', food_id: '', grams: 100, notes: '' });
  const [workoutForm, setWorkoutForm] = useState({ weekday: 1, title: '', exercises: '', notes: '' });

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [selectedManagedUserId, setSelectedManagedUserId] = useState('');

  const user = session?.user;
  const activeUserId = isAdmin && selectedManagedUserId ? selectedManagedUserId : user?.id;
  const selectedManagedUser = adminUsers.find(item => item.user_id === activeUserId);
  const viewingOtherUser = Boolean(isAdmin && activeUserId && user?.id && activeUserId !== user.id);
  const totals = useMemo(() => sumLogs(logs), [logs]);
  const remain = useMemo(() => remaining(target, totals), [target, totals]);
  const currentWeekday = useMemo(() => new Date(`${selectedDate}T12:00:00`).getDay(), [selectedDate]);
  const filteredFoods = useMemo(() => {
    const q = foodSearch.trim().toLowerCase();
    if (!q) return foods.slice(0, 40);
    return foods.filter(food => `${food.name} ${food.brand || ''} ${food.category || ''} ${food.barcode || ''}`.toLowerCase().includes(q)).slice(0, 60);
  }, [foods, foodSearch]);
  const dailySuggestions = useMemo(() => buildDailySuggestions(foods, target, totals, profile), [foods, target, totals, profile]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setIsAdmin(false);
        setAdminUsers([]);
        setSelectedManagedUserId('');
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    loadAdminStatus();
  }, [user]);

  useEffect(() => {
    if (!activeUserId) return;
    loadAll();
  }, [activeUserId, selectedDate]);

  async function loadAdminStatus() {
    const { data, error } = await supabase.rpc('is_app_admin');
    const admin = !error && data === true;
    setIsAdmin(admin);
    setSelectedManagedUserId(prev => prev || user.id);
    if (admin) await loadManagedUsers();
  }

  async function loadManagedUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id,email,name,sex,birth_date,height_cm,current_weight,start_weight,target_weight,target_date,activity_level,updated_at')
      .order('name', { ascending: true, nullsFirst: false });
    if (!error) setAdminUsers(data || []);
  }

  async function loadAll() {
    setLoading(true);
    setMessage('');
    await Promise.all([
      loadProfile(),
      loadFoods(),
      loadLogs(),
      loadTarget(),
      loadDailyStatus(),
      loadMeasurements(),
      loadPlannedOptions(),
      loadWorkouts(),
      loadWorkoutLog()
    ]);
    setLoading(false);
  }

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', activeUserId).maybeSingle();
    if (data) {
      setProfile({ ...emptyProfile, ...data });
      return;
    }
    if (activeUserId === user.id) {
      const fallback = { user_id: user.id, email: user.email, name: user.email?.split('@')[0] || '' };
      await supabase.from('profiles').upsert(fallback, { onConflict: 'user_id' });
      setProfile({ ...emptyProfile, ...fallback });
      if (isAdmin) await loadManagedUsers();
    } else {
      setProfile(emptyProfile);
    }
  }

  async function loadFoods() {
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .or(`user_id.eq.${activeUserId},is_public.eq.true`)
      .order('name');
    if (!error) setFoods(dedupeFoods(data || []));
  }

  async function loadLogs() {
    const { data, error } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', activeUserId)
      .eq('log_date', selectedDate)
      .order('created_at', { ascending: true });
    if (!error) setLogs(data || []);
  }

  async function loadTarget() {
    const { data } = await supabase
      .from('daily_targets')
      .select('*')
      .eq('user_id', activeUserId)
      .eq('target_date', selectedDate)
      .maybeSingle();
    setTarget(data || emptyTarget);
  }

  async function loadDailyStatus() {
    const { data } = await supabase
      .from('daily_status')
      .select('*')
      .eq('user_id', activeUserId)
      .eq('status_date', selectedDate)
      .maybeSingle();
    setDailyStatus(data?.status || 'non_registrata');
  }

  async function loadMeasurements() {
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', activeUserId)
      .order('measure_date', { ascending: true });
    setMeasurements(data || []);
  }

  async function loadPlannedOptions() {
    const { data } = await supabase
      .from('planned_meal_options')
      .select('*, planned_meal_foods(*)')
      .eq('user_id', activeUserId)
      .eq('weekday', currentWeekday)
      .order('meal_type')
      .order('created_at');
    setPlannedOptions(data || []);
  }

  async function loadWorkouts() {
    const { data } = await supabase
      .from('workout_schedule')
      .select('*')
      .eq('user_id', activeUserId)
      .eq('weekday', currentWeekday)
      .order('created_at');
    setWorkouts(data || []);
  }

  async function loadWorkoutLog() {
    const { data } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', activeUserId)
      .eq('log_date', selectedDate)
      .maybeSingle();
    setWorkoutLog(data);
  }

  function getRedirectUrl() {
    if (typeof window === 'undefined') return undefined;
    return window.location.origin;
  }

  function formatAuthError(error) {
    if (!error?.message) return '';
    const msg = error.message.toLowerCase();
    if (msg.includes('email not confirmed')) {
      return 'Email non confermata. Controlla la mail di conferma oppure, per i test, disattiva Confirm email in Supabase > Authentication > Providers > Email.';
    }
    if (msg.includes('invalid login credentials')) {
      return 'Email o password non corretti. Se ti sei appena registrato e non hai confermato la mail, prima devi cliccare il link ricevuto.';
    }
    if (msg.includes('email address not authorized')) {
      return 'Supabase non può inviare email a questo indirizzo con il servizio email predefinito. Per i test usa una mail del team Supabase, disattiva Confirm email oppure configura un SMTP personalizzato.';
    }
    return error.message;
  }

  async function handleAuth(event) {
    event.preventDefault();
    setMessage('');

    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setMessage(error ? formatAuthError(error) : 'Accesso effettuato.');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getRedirectUrl(),
      },
    });

    if (error) {
      setMessage(formatAuthError(error));
      return;
    }

    if (data?.session) {
      setMessage('Registrazione completata. Sei già dentro.');
    } else {
      setMessage('Registrazione creata. Se Supabase ha Confirm email attivo, devi cliccare il link ricevuto via email prima di entrare. Se non arriva, controlla spam oppure disattiva Confirm email per i test.');
    }
  }

  async function resendConfirmation() {
    setMessage('');
    if (!email) {
      setMessage('Inserisci prima la tua email nel campo sopra.');
      return;
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getRedirectUrl(),
      },
    });

    setMessage(error ? formatAuthError(error) : 'Email di conferma reinviata. Controlla anche la cartella spam.');
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function persistProfile() {
    const payload = {
      user_id: activeUserId,
      ...profile,
      email: profile.email || (activeUserId === user.id ? user.email : null),
      birth_date: nullableDate(profile.birth_date),
      target_date: nullableDate(profile.target_date),
      height_cm: nullableNumber(profile.height_cm),
      start_weight: nullableNumber(profile.start_weight),
      current_weight: nullableNumber(profile.current_weight),
      target_weight: nullableNumber(profile.target_weight),
      food_preferences: profile.food_preferences || null,
      excluded_foods: profile.excluded_foods || null,
      selected_restrictions: Array.isArray(profile.selected_restrictions) ? profile.selected_restrictions : csvToArray(profile.selected_restrictions),
      custom_allergies: profile.custom_allergies || null,
      allergy_notes: profile.allergy_notes || null,
      diet_style: profile.diet_style || 'equilibrata',
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
    return { error, payload };
  }

  async function saveProfile() {
    const { error } = await persistProfile();
    if (!error && isAdmin) await loadManagedUsers();
    setMessage(error ? error.message : 'Profilo salvato.');
  }

  async function saveTarget(nextTarget = target) {
    const payload = {
      user_id: activeUserId,
      target_date: selectedDate,
      kcal_target: Number(nextTarget.kcal_target || 0),
      protein_target: Number(nextTarget.protein_target || 0),
      carbs_target: Number(nextTarget.carbs_target || 0),
      fat_target: Number(nextTarget.fat_target || 0)
    };
    const { error } = await supabase.from('daily_targets').upsert(payload, { onConflict: 'user_id,target_date' });
    setMessage(error ? error.message : 'Obiettivo giornaliero salvato.');
    if (!error) setTarget(payload);
  }

  async function estimateAndSaveTarget() {
    const estimated = estimateTargets(profile);
    if (!estimated) {
      setMessage('Inserisci sesso, data di nascita, altezza e peso per calcolare l’obiettivo.');
      return;
    }
    await saveTarget(estimated);
    setMessage(`Obiettivo stimato salvato. BMR ${estimated.bmr} kcal, mantenimento circa ${estimated.tdee} kcal. Valori indicativi.`);
  }

  async function generatePersonalizedDiet() {
    setLoading(true);
    setMessage('');

    const plan = estimatePersonalizedPlan(profile, selectedDate);
    if (!plan.valid) {
      setLoading(false);
      setMessage(plan.message);
      return;
    }

    const week = buildGeneratedDietWeek(foods, plan, profile);
    if (!week.options.length) {
      setLoading(false);
      setMessage('Non riesco a generare la dieta: mancano alimenti base nel database o hai escluso troppi alimenti. Vai nella sezione Alimenti e aggiungi gli alimenti principali.');
      return;
    }

    const { error: profileError } = await persistProfile();
    if (profileError) {
      setLoading(false);
      setMessage(profileError.message);
      return;
    }

    const generationId = crypto.randomUUID();

    await supabase.from('diet_generations').insert({
      id: generationId,
      user_id: activeUserId,
      title: `Dieta ${plan.goal_type} - ${selectedDate}`,
      goal_type: plan.goal_type,
      realistic: plan.realistic,
      kcal_target: plan.kcal_target,
      protein_target: plan.protein_target,
      carbs_target: plan.carbs_target,
      fat_target: plan.fat_target,
      bmr: plan.bmr,
      tdee: plan.tdee,
      daily_deficit: plan.daily_deficit,
      planned_rate_kg_week: plan.planned_rate_kg_week,
      notes: plan.message
    });

    await supabase
      .from('planned_meal_options')
      .delete()
      .eq('user_id', activeUserId)
      .eq('source', 'generated');

    for (const option of week.options) {
      const { data: insertedOption, error } = await supabase.from('planned_meal_options').insert({
        user_id: activeUserId,
        generation_id: generationId,
        source: 'generated',
        weekday: option.weekday,
        meal_type: option.meal_type,
        option_name: option.option_name,
        notes: option.notes
      }).select().single();

      if (error) {
        setLoading(false);
        setMessage(error.message);
        return;
      }

      const rows = option.items.map(item => ({
        user_id: activeUserId,
        option_id: insertedOption.id,
        food_id: item.food_id,
        food_name: item.food_name,
        grams: item.grams,
        kcal: item.kcal,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber || 0,
        sugar: item.sugar || 0,
        salt: item.salt || 0
      }));

      const { error: itemError } = await supabase.from('planned_meal_foods').insert(rows);
      if (itemError) {
        setLoading(false);
        setMessage(itemError.message);
        return;
      }
    }

    const targetRows = targetDatesForPlan(plan, selectedDate).map(date => ({
      user_id: activeUserId,
      target_date: date,
      kcal_target: plan.kcal_target,
      protein_target: plan.protein_target,
      carbs_target: plan.carbs_target,
      fat_target: plan.fat_target
    }));

    await supabase.from('daily_targets').upsert(targetRows, { onConflict: 'user_id,target_date' });

    await Promise.all([loadTarget(), loadPlannedOptions()]);
    setLoading(false);
    setTab('dieta');
    setMessage(`${plan.message} Ho creato una dieta settimanale automatica con ${week.options.length} opzioni e obiettivi giornalieri già salvati. ${week.warnings.length ? week.warnings[0] : ''}`);
  }

  async function saveManualFood() {
    if (!manualFood.name.trim()) return setMessage('Inserisci il nome alimento.');
    const payload = {
      user_id: activeUserId,
      name: manualFood.name.trim(),
      brand: manualFood.brand || null,
      category: manualFood.category || null,
      barcode: manualFood.barcode || null,
      allergens: csvToArray(manualFood.allergens),
      tags: csvToArray(manualFood.tags),
      kcal_100g: Number(manualFood.kcal_100g || 0),
      protein_100g: Number(manualFood.protein_100g || 0),
      carbs_100g: Number(manualFood.carbs_100g || 0),
      fat_100g: Number(manualFood.fat_100g || 0),
      fiber_100g: nullableNumber(manualFood.fiber_100g),
      sugar_100g: nullableNumber(manualFood.sugar_100g),
      salt_100g: nullableNumber(manualFood.salt_100g),
      source: 'manuale',
      is_public: false
    };
    const { error } = await supabase.from('foods').insert(payload);
    if (error) return setMessage(error.message);
    setManualFood({ name: '', brand: '', category: '', barcode: '', allergens: '', tags: '', kcal_100g: '', protein_100g: '', carbs_100g: '', fat_100g: '', fiber_100g: '', sugar_100g: '', salt_100g: '' });
    await loadFoods();
    setMessage('Alimento salvato.');
  }

  function openFoodFactsPayload(product, fallbackBarcode = '') {
    const p = product || {};
    const n = p.nutriments || {};
    const code = String(p.code || fallbackBarcode || '').trim();
    return {
      user_id: activeUserId,
      name: p.product_name || p.product_name_it || p.product_name_en || `Prodotto ${code || 'senza barcode'}`,
      brand: p.brands || null,
      category: p.categories_tags?.[0]?.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ') || p.categories || null,
      barcode: code || null,
      kcal_100g: Number(n['energy-kcal_100g'] || n['energy-kcal_serving'] || 0),
      protein_100g: Number(n.proteins_100g || 0),
      carbs_100g: Number(n.carbohydrates_100g || 0),
      fat_100g: Number(n.fat_100g || 0),
      fiber_100g: Number(n.fiber_100g || 0),
      sugar_100g: Number(n.sugars_100g || 0),
      salt_100g: Number(n.salt_100g || 0),
      allergens: (p.allergens_tags || []).map(tag => tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')),
      tags: [...(p.labels_tags || []), ...(p.categories_tags || [])].map(tag => tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')).slice(0, 20),
      source: 'openfoodfacts',
      is_public: false
    };
  }

  async function saveOpenFoodFactsProduct(product, fallbackBarcode = '') {
    const payload = openFoodFactsPayload(product, fallbackBarcode);
    if (!payload.name || !Number(payload.kcal_100g || 0)) {
      return setMessage('Prodotto trovato, ma mancano calorie o valori nutrizionali. Puoi inserirlo manualmente leggendo l’etichetta.');
    }
    const query = payload.barcode
      ? supabase.from('foods').upsert(payload, { onConflict: 'user_id,barcode' })
      : supabase.from('foods').insert(payload);
    const { error } = await query;
    if (error) return setMessage(error.message);
    await loadFoods();
    setMessage('Prodotto importato da Open Food Facts. Controlla sempre i valori perché possono essere incompleti o diversi dall’etichetta.');
  }

  async function importBarcode() {
    if (!barcode.trim()) return setMessage('Inserisci un codice a barre.');
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode.trim()}.json`);
      const json = await response.json();
      if (!json.product) return setMessage('Prodotto non trovato su Open Food Facts.');
      await saveOpenFoodFactsProduct({ ...json.product, code: json.code || barcode.trim() }, barcode.trim());
      setBarcode('');
    } catch (error) {
      setMessage('Errore durante il collegamento a Open Food Facts.');
    }
  }

  async function searchOnlineFoods() {
    const q = onlineFoodQuery.trim();
    if (q.length < 2) return setMessage('Scrivi almeno 2 caratteri per cercare online.');
    setOnlineFoodLoading(true);
    setOnlineFoodResults([]);
    try {
      const params = new URLSearchParams({
        search_terms: q,
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: '12',
        fields: 'code,product_name,product_name_it,product_name_en,brands,categories,categories_tags,labels_tags,allergens_tags,nutriments'
      });
      const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`);
      const json = await response.json();
      const products = (json.products || [])
        .filter(item => item.product_name || item.product_name_it || item.product_name_en)
        .filter(item => Number(item.nutriments?.['energy-kcal_100g'] || 0) > 0)
        .slice(0, 12);
      setOnlineFoodResults(products);
      setMessage(products.length ? `Trovati ${products.length} prodotti online. Importa quello corretto e controlla l’etichetta.` : 'Nessun prodotto con valori nutrizionali trovato online.');
    } catch (error) {
      setMessage('Errore durante la ricerca online.');
    } finally {
      setOnlineFoodLoading(false);
    }
  }

  async function addFoodLog() {
    const food = foods.find(item => item.id === selectedFoodId);
    if (!food) return setMessage('Seleziona un alimento.');
    const blocked = restrictionMatchesForFood(food, profile);
    if (blocked.length) return setMessage(`Attenzione: ${food.name} corrisponde a restrizioni/allergie impostate: ${blocked.join(', ')}. Modifica il profilo se vuoi consentirlo.`);
    const g = Number(grams || 0);
    if (g <= 0) return setMessage('Inserisci i grammi.');
    const calc = calculateNutrition(food, g);
    const payload = {
      user_id: activeUserId,
      food_id: food.id,
      log_date: selectedDate,
      meal_type: mealType,
      food_name: [food.name, food.brand].filter(Boolean).join(' - '),
      grams: g,
      ...calc
    };
    const { error } = await supabase.from('food_logs').insert(payload);
    if (error) return setMessage(error.message);
    await Promise.all([loadLogs(), setStatus('parziale', false)]);
    setMessage('Alimento aggiunto al diario.');
  }

  async function addSuggestedFoodLog(suggestion, meal = mealType) {
    if (!suggestion?.food_id) return setMessage('Suggerimento non valido.');
    const payload = {
      user_id: activeUserId,
      food_id: suggestion.food_id,
      log_date: selectedDate,
      meal_type: meal,
      food_name: suggestion.food_name,
      grams: suggestion.grams,
      kcal: suggestion.kcal,
      protein: suggestion.protein,
      carbs: suggestion.carbs,
      fat: suggestion.fat,
      fiber: suggestion.fiber || 0,
      sugar: suggestion.sugar || 0,
      salt: suggestion.salt || 0,
      notes: `Suggerito dall'app per rientrare nei valori giornalieri`
    };
    const { error } = await supabase.from('food_logs').insert(payload);
    if (error) return setMessage(error.message);
    await Promise.all([loadLogs(), setStatus('parziale', false)]);
    setMessage('Suggerimento aggiunto al diario. Puoi continuare a scegliere altri alimenti finché rientri nei valori.');
  }

  async function deleteLog(id) {
    await supabase.from('food_logs').delete().eq('id', id).eq('user_id', activeUserId);
    await loadLogs();
  }

  async function setStatus(status, showMessage = true) {
    const { error } = await supabase.from('daily_status').upsert({
      user_id: activeUserId,
      status_date: selectedDate,
      status
    }, { onConflict: 'user_id,status_date' });
    if (!error) setDailyStatus(status);
    if (showMessage) setMessage(error ? error.message : 'Stato giornata aggiornato.');
  }

  async function saveMeasurement() {
    const payload = {
      user_id: activeUserId,
      measure_date: selectedDate,
      weight: nullableNumber(measurementForm.weight),
      waist: nullableNumber(measurementForm.waist),
      hips: nullableNumber(measurementForm.hips),
      chest: nullableNumber(measurementForm.chest),
      abdomen: nullableNumber(measurementForm.abdomen),
      arm: nullableNumber(measurementForm.arm),
      thigh: nullableNumber(measurementForm.thigh),
      neck: nullableNumber(measurementForm.neck),
      notes: measurementForm.notes || null
    };
    const { error } = await supabase.from('body_measurements').upsert(payload, { onConflict: 'user_id,measure_date' });
    if (error) return setMessage(error.message);
    setMeasurementForm({ weight: '', waist: '', hips: '', chest: '', abdomen: '', arm: '', thigh: '', neck: '', notes: '' });
    await loadMeasurements();
    setMessage('Misure salvate.');
  }

  async function savePlannedOption() {
    const food = foods.find(item => item.id === plannedForm.food_id);
    if (!food) return setMessage('Seleziona un alimento per la dieta programmata.');
    const blocked = restrictionMatchesForFood(food, profile);
    if (blocked.length) return setMessage(`Questo alimento è escluso dal profilo: ${blocked.join(', ')}. Cambia alimento o modifica le restrizioni.`);
    const g = Number(plannedForm.grams || 0);
    const calc = calculateNutrition(food, g);
    const { data: option, error } = await supabase.from('planned_meal_options').insert({
      user_id: activeUserId,
      weekday: Number(plannedForm.weekday),
      meal_type: plannedForm.meal_type,
      option_name: plannedForm.option_name || `${food.name} ${g} g`,
      notes: plannedForm.notes || null
    }).select().single();
    if (error) return setMessage(error.message);
    const { error: itemError } = await supabase.from('planned_meal_foods').insert({
      user_id: activeUserId,
      option_id: option.id,
      food_id: food.id,
      food_name: [food.name, food.brand].filter(Boolean).join(' - '),
      grams: g,
      ...calc
    });
    if (itemError) return setMessage(itemError.message);
    setPlannedForm({ weekday: plannedForm.weekday, meal_type: plannedForm.meal_type, option_name: '', food_id: '', grams: 100, notes: '' });
    await loadPlannedOptions();
    setMessage('Opzione dieta salvata.');
  }

  async function eatPlannedOption(option) {
    const rows = (option.planned_meal_foods || []).map(item => ({
      user_id: activeUserId,
      food_id: item.food_id,
      log_date: selectedDate,
      meal_type: option.meal_type,
      food_name: item.food_name,
      grams: item.grams,
      kcal: item.kcal,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber || 0,
      sugar: item.sugar || 0,
      salt: item.salt || 0,
      notes: `Da opzione: ${option.option_name}`
    }));
    if (!rows.length) return setMessage('Questa opzione non contiene alimenti.');
    const { error } = await supabase.from('food_logs').insert(rows);
    if (error) return setMessage(error.message);
    await Promise.all([loadLogs(), setStatus('parziale', false)]);
    setMessage('Opzione aggiunta al diario di oggi.');
  }

  async function deletePlannedOption(id) {
    await supabase.from('planned_meal_options').delete().eq('id', id).eq('user_id', activeUserId);
    await loadPlannedOptions();
  }

  async function saveWorkout() {
    if (!workoutForm.title.trim()) return setMessage('Inserisci il titolo allenamento.');
    const { error } = await supabase.from('workout_schedule').insert({
      user_id: activeUserId,
      weekday: Number(workoutForm.weekday),
      title: workoutForm.title,
      exercises: workoutForm.exercises,
      notes: workoutForm.notes || null
    });
    if (error) return setMessage(error.message);
    setWorkoutForm({ weekday: workoutForm.weekday, title: '', exercises: '', notes: '' });
    await loadWorkouts();
    setMessage('Allenamento salvato.');
  }

  async function setWorkoutStatus(status) {
    const { error } = await supabase.from('workout_logs').upsert({
      user_id: activeUserId,
      log_date: selectedDate,
      status
    }, { onConflict: 'user_id,log_date' });
    if (!error) await loadWorkoutLog();
    setMessage(error ? error.message : 'Allenamento aggiornato.');
  }

  if (loading && !session) {
    return <main className="shell center"><div className="loader">Caricamento...</div></main>;
  }

  if (!session) {
    return (
      <main className="authPage">
        <section className="authCard">
          <div className="brandMark">DT</div>
          <h1>DietaTrack</h1>
          <p>Web app personale per dieta, calorie, misure e allenamenti.</p>
          <form onSubmit={handleAuth} className="formStack">
            <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" required /></label>
            <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="almeno 6 caratteri" required /></label>
            <button className="primary" type="submit">{authMode === 'login' ? 'Accedi' : 'Registrati'}</button>
          </form>
          <button className="linkBtn" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
            {authMode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
          </button>
          {authMode === 'login' && (
            <button className="linkBtn smallLink" onClick={resendConfirmation} type="button">
              Non ti è arrivata la mail? Reinvia conferma
            </button>
          )}
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">DietaTrack</p>
          <h1>{tab === 'oggi' ? 'Dashboard giornaliera' : labelForTab(tab)}</h1>
        </div>
        <button className="ghost" onClick={signOut}>Esci</button>
      </header>

      <section className="dateCard">
        <label>Giorno<input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} /></label>
        <div className={`statusPill ${dailyStatus}`}>{statusLabel(dailyStatus)}</div>
        {isAdmin && (
          <div className="adminViewing">
            <strong>{viewingOtherUser ? 'Stai gestendo un utente' : 'Modalità admin'}</strong>
            <span>{selectedManagedUser?.name || selectedManagedUser?.email || (viewingOtherUser ? activeUserId : user.email)}</span>
          </div>
        )}
      </section>

      <nav className="tabs">
        {[
          ['oggi', 'Oggi'], ['dieta', 'Dieta'], ['alimenti', 'Alimenti'], ['misure', 'Misure'], ['allenamento', 'Allenamento'], ['profilo', 'Profilo'], ...(isAdmin ? [['admin', 'Admin']] : [])
        ].map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}
      </nav>

      {message && <section className="notice stickyNotice">{message}</section>}

      {tab === 'oggi' && (
        <Dashboard
          totals={totals}
          target={target}
          remain={remain}
          logs={logs}
          selectedDate={selectedDate}
          mealType={mealType}
          setMealType={setMealType}
          filteredFoods={filteredFoods}
          foodSearch={foodSearch}
          setFoodSearch={setFoodSearch}
          selectedFoodId={selectedFoodId}
          setSelectedFoodId={setSelectedFoodId}
          grams={grams}
          setGrams={setGrams}
          addFoodLog={addFoodLog}
          deleteLog={deleteLog}
          setStatus={setStatus}
          targetSetter={setTarget}
          targetSaver={saveTarget}
          plannedOptions={plannedOptions}
          eatPlannedOption={eatPlannedOption}
          dailySuggestions={dailySuggestions}
          addSuggestedFoodLog={addSuggestedFoodLog}
          workouts={workouts}
          workoutLog={workoutLog}
          setWorkoutStatus={setWorkoutStatus}
        />
      )}

      {tab === 'dieta' && (
        <DietTab
          plannedOptions={plannedOptions}
          plannedForm={plannedForm}
          setPlannedForm={setPlannedForm}
          foods={foods}
          savePlannedOption={savePlannedOption}
          deletePlannedOption={deletePlannedOption}
          currentWeekday={currentWeekday}
        />
      )}

      {tab === 'alimenti' && (
        <FoodsTab
          foods={foods}
          filteredFoods={filteredFoods}
          foodSearch={foodSearch}
          setFoodSearch={setFoodSearch}
          manualFood={manualFood}
          setManualFood={setManualFood}
          saveManualFood={saveManualFood}
          barcode={barcode}
          setBarcode={setBarcode}
          importBarcode={importBarcode}
          onlineFoodQuery={onlineFoodQuery}
          setOnlineFoodQuery={setOnlineFoodQuery}
          onlineFoodResults={onlineFoodResults}
          onlineFoodLoading={onlineFoodLoading}
          searchOnlineFoods={searchOnlineFoods}
          saveOpenFoodFactsProduct={saveOpenFoodFactsProduct}
        />
      )}

      {tab === 'misure' && (
        <MeasurementsTab
          measurements={measurements}
          measurementForm={measurementForm}
          setMeasurementForm={setMeasurementForm}
          saveMeasurement={saveMeasurement}
        />
      )}

      {tab === 'allenamento' && (
        <WorkoutTab
          workouts={workouts}
          workoutForm={workoutForm}
          setWorkoutForm={setWorkoutForm}
          saveWorkout={saveWorkout}
          workoutLog={workoutLog}
          setWorkoutStatus={setWorkoutStatus}
        />
      )}

      {tab === 'profilo' && (
        <ProfileTab
          profile={profile}
          setProfile={setProfile}
          saveProfile={saveProfile}
          estimateAndSaveTarget={estimateAndSaveTarget}
          generatePersonalizedDiet={generatePersonalizedDiet}
          selectedDate={selectedDate}
          target={target}
          viewingOtherUser={viewingOtherUser}
          selectedManagedUser={selectedManagedUser}
        />
      )}

      {tab === 'admin' && isAdmin && (
        <AdminTab
          adminUsers={adminUsers}
          selectedManagedUserId={selectedManagedUserId}
          setSelectedManagedUserId={setSelectedManagedUserId}
          refreshUsers={loadManagedUsers}
        />
      )}
    </main>
  );
}

function AdminTab({ adminUsers, selectedManagedUserId, setSelectedManagedUserId, refreshUsers }) {
  const sortedUsers = [...(adminUsers || [])].sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
  return (
    <section className="grid">
      <div className="card wide">
        <h3>Gestione utenti</h3>
        <p className="muted">Seleziona un utente registrato: dopo la selezione, le sezioni Oggi, Dieta, Misure, Allenamento e Profilo mostreranno e modificheranno i suoi dati.</p>
        <button className="secondary" onClick={refreshUsers}>Aggiorna elenco utenti</button>
        <div className="userGrid">
          {sortedUsers.map(item => {
            const active = item.user_id === selectedManagedUserId;
            return (
              <button key={item.user_id} className={`userCard ${active ? 'activeUser' : ''}`} onClick={() => setSelectedManagedUserId(item.user_id)}>
                <strong>{item.name || item.email || 'Utente senza nome'}</strong>
                <span>{item.email || item.user_id}</span>
                <small>Peso: {item.current_weight || item.start_weight || '-'} kg · Obiettivo: {item.target_weight || '-'} kg</small>
                <small>Altezza: {item.height_cm || '-'} cm · Attività: {item.activity_level || '-'}</small>
              </button>
            );
          })}
        </div>
        {!sortedUsers.length && <p className="muted">Non ci sono ancora profili. Gli utenti compariranno qui dopo la registrazione/accesso o dopo l'esecuzione dello SQL aggiornato.</p>}
      </div>
      <div className="card wide warningCard">
        <h3>Permessi admin</h3>
        <p>Solo le email presenti nella tabella <code>app_admins</code> possono vedere e modificare i dati degli altri utenti. Gli utenti normali continuano a vedere solo il proprio profilo.</p>
      </div>
    </section>
  );
}

function Dashboard(props) {
  const { totals, target, remain, logs, mealType, setMealType, filteredFoods, foodSearch, setFoodSearch, selectedFoodId, setSelectedFoodId, grams, setGrams, addFoodLog, deleteLog, setStatus, targetSetter, targetSaver, plannedOptions, eatPlannedOption, dailySuggestions, addSuggestedFoodLog, workouts, workoutLog, setWorkoutStatus } = props;

  return (
    <section className="grid">
      <div className="card heroStats">
        <div>
          <p className="eyebrow">Calorie</p>
          <h2>{round(totals.kcal, 0)} / {round(target.kcal_target, 0)} kcal</h2>
          <Progress value={totals.kcal} max={target.kcal_target} />
        </div>
        <div className="macroGrid">
          <Macro label="Proteine" value={totals.protein} max={target.protein_target} unit="g" />
          <Macro label="Carboidrati" value={totals.carbs} max={target.carbs_target} unit="g" />
          <Macro label="Grassi" value={totals.fat} max={target.fat_target} unit="g" />
        </div>
      </div>

      <div className="card">
        <h3>Ti mancano oggi</h3>
        <div className="remainingGrid">
          <strong>{round(remain.kcal, 0)}<span>kcal</span></strong>
          <strong>{round(remain.protein, 1)}<span>proteine</span></strong>
          <strong>{round(remain.carbs, 1)}<span>carboidrati</span></strong>
          <strong>{round(remain.fat, 1)}<span>grassi</span></strong>
        </div>
      </div>

      <div className="card wide">
        <h3>Aggiungi quello che hai mangiato</h3>
        <div className="formGrid four">
          <label>Pasto<select value={mealType} onChange={e => setMealType(e.target.value)}>{mealTypes.map(m => <option key={m}>{m}</option>)}</select></label>
          <label>Cerca alimento<input value={foodSearch} onChange={e => setFoodSearch(e.target.value)} placeholder="pasta, pollo, banana..." /></label>
          <label>Alimento<select value={selectedFoodId} onChange={e => setSelectedFoodId(e.target.value)}><option value="">Seleziona</option>{filteredFoods.map(food => <option key={food.id} value={food.id}>{food.name}{food.brand ? ` - ${food.brand}` : ''}</option>)}</select></label>
          <label>Grammi<input type="number" min="1" value={grams} onChange={e => setGrams(e.target.value)} /></label>
        </div>
        <button className="primary" onClick={addFoodLog}>Aggiungi al diario</button>
      </div>

      <div className="card wide">
        <h3>Proposte per rientrare nei valori di oggi</h3>
        <p className="muted">Queste non sono obbligatorie: sono alimenti/porzioni compatibili con le calorie e i macro che ti mancano. Scegli tu cosa mangiare e l'app aggiorna automaticamente i rimanenti.</p>
        {!dailySuggestions?.length && <p className="muted">Non ci sono suggerimenti: aggiungi altri alimenti nell'archivio oppure controlla le restrizioni nel profilo.</p>}
        <div className="suggestionGrid">
          {(dailySuggestions || []).map(suggestion => (
            <article className="suggestionCard" key={`${suggestion.food_id}-${suggestion.grams}`}>
              <span className="mealBadge">{suggestion.reason}</span>
              <h4>{suggestion.food_name}</h4>
              <p>{suggestion.grams} g · {round(suggestion.kcal, 0)} kcal · P {round(suggestion.protein, 1)} · C {round(suggestion.carbs, 1)} · G {round(suggestion.fat, 1)}</p>
              <button className="secondary" onClick={() => addSuggestedFoodLog(suggestion)}>Aggiungi</button>
            </article>
          ))}
        </div>
      </div>

      <div className="card wide">
        <h3>Dieta prevista per oggi</h3>
        {plannedOptions.length === 0 && <p className="muted">Non hai ancora inserito opzioni dieta per questo giorno.</p>}
        <div className="optionList">
          {plannedOptions.map(option => (
            <article className="optionCard" key={option.id}>
              <div>
                <span className="mealBadge">{option.meal_type}{option.source === 'generated' ? ' · generata' : ''}</span>
                <h4>{option.option_name}</h4>
                <p>{(option.planned_meal_foods || []).map(f => `${f.food_name} ${f.grams} g`).join(', ')}</p>
              </div>
              <button className="secondary" onClick={() => eatPlannedOption(option)}>Ho mangiato questo</button>
            </article>
          ))}
        </div>
      </div>

      <div className="card wide">
        <h3>Diario di oggi</h3>
        {mealTypes.map(meal => {
          const mealLogs = logs.filter(log => log.meal_type === meal);
          if (!mealLogs.length) return null;
          return (
            <div className="mealBlock" key={meal}>
              <h4>{meal}</h4>
              {mealLogs.map(log => (
                <div className="logRow" key={log.id}>
                  <span>{log.food_name}</span>
                  <small>{log.grams} g · {round(log.kcal, 0)} kcal · P {log.protein} · C {log.carbs} · G {log.fat}</small>
                  <button className="danger" onClick={() => deleteLog(log.id)}>Elimina</button>
                </div>
              ))}
            </div>
          );
        })}
        {!logs.length && <p className="muted">Ancora nessun alimento registrato oggi.</p>}
      </div>

      <div className="card">
        <h3>Stato giornata</h3>
        <div className="buttonStack">
          <button className="secondary" onClick={() => setStatus('completata')}>Completata</button>
          <button className="secondary" onClick={() => setStatus('sgarro')}>Sgarro</button>
          <button className="secondary" onClick={() => setStatus('saltata')}>Ho saltato la dieta</button>
        </div>
      </div>

      <div className="card">
        <h3>Obiettivo calorie/macros</h3>
        <div className="formGrid two">
          <label>Kcal<input type="number" value={target.kcal_target} onChange={e => targetSetter({ ...target, kcal_target: e.target.value })} /></label>
          <label>Proteine<input type="number" value={target.protein_target} onChange={e => targetSetter({ ...target, protein_target: e.target.value })} /></label>
          <label>Carboidrati<input type="number" value={target.carbs_target} onChange={e => targetSetter({ ...target, carbs_target: e.target.value })} /></label>
          <label>Grassi<input type="number" value={target.fat_target} onChange={e => targetSetter({ ...target, fat_target: e.target.value })} /></label>
        </div>
        <button className="primary" onClick={() => targetSaver(target)}>Salva obiettivo</button>
      </div>

      <div className="card wide">
        <h3>Allenamento di oggi</h3>
        <p className="muted">Stato: {workoutLog?.status || 'non registrato'}</p>
        {workouts.map(w => <article key={w.id} className="workoutBox"><h4>{w.title}</h4><pre>{w.exercises}</pre>{w.notes && <p>{w.notes}</p>}</article>)}
        {!workouts.length && <p className="muted">Nessun allenamento programmato per oggi.</p>}
        <div className="buttonRow"><button className="secondary" onClick={() => setWorkoutStatus('fatto')}>Fatto</button><button className="secondary" onClick={() => setWorkoutStatus('saltato')}>Saltato</button></div>
      </div>
    </section>
  );
}

function FoodsTab({ foods, filteredFoods, foodSearch, setFoodSearch, manualFood, setManualFood, saveManualFood, barcode, setBarcode, importBarcode, onlineFoodQuery, setOnlineFoodQuery, onlineFoodResults, onlineFoodLoading, searchOnlineFoods, saveOpenFoodFactsProduct }) {
  return (
    <section className="grid">
      <div className="card wide">
        <h3>Importa prodotto da codice a barre</h3>
        <p className="muted">Utile per alimenti confezionati. I dati arrivano da Open Food Facts: controllali sempre.</p>
        <div className="formGrid two"><label>Codice a barre<input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="es. 800..." /></label></div>
        <button className="primary" onClick={importBarcode}>Importa prodotto</button>
      </div>
      <div className="card wide">
        <h3>Cerca prodotto online per nome</h3>
        <p className="muted">Utile quando non hai il codice a barre: cerca prodotti confezionati o piatti già presenti su Open Food Facts. Non cercare a ogni lettera: scrivi il nome e premi il pulsante.</p>
        <div className="formGrid two">
          <label>Nome prodotto<input value={onlineFoodQuery} onChange={e => setOnlineFoodQuery(e.target.value)} placeholder="es. Nippon, bastoncini Findus, spinacine" /></label>
        </div>
        <button className="primary" onClick={searchOnlineFoods} disabled={onlineFoodLoading}>{onlineFoodLoading ? 'Cerco...' : 'Cerca online'}</button>
        {onlineFoodResults.length > 0 && <div className="foodTable onlineResults">
          <div className="foodHead"><span>Prodotto</span><span>Kcal</span><span>P</span><span>C</span><span>G</span><span></span></div>
          {onlineFoodResults.map(product => {
            const n = product.nutriments || {};
            const name = product.product_name || product.product_name_it || product.product_name_en || 'Prodotto';
            return <div className="foodHead foodRow" key={product.code || name}>
              <span>{name}{product.brands ? ` - ${product.brands}` : ''}</span>
              <span>{Number(n['energy-kcal_100g'] || 0)}</span>
              <span>{Number(n.proteins_100g || 0)}</span>
              <span>{Number(n.carbohydrates_100g || 0)}</span>
              <span>{Number(n.fat_100g || 0)}</span>
              <button className="secondary small" onClick={() => saveOpenFoodFactsProduct(product, product.code)}>Importa</button>
            </div>;
          })}
        </div>}
      </div>
      <div className="card wide">
        <h3>Aggiungi alimento manuale</h3>
        <div className="formGrid four">
          <label>Nome<input value={manualFood.name} onChange={e => setManualFood({ ...manualFood, name: e.target.value })} /></label>
          <label>Marca<input value={manualFood.brand} onChange={e => setManualFood({ ...manualFood, brand: e.target.value })} /></label>
          <label>Categoria<input value={manualFood.category} onChange={e => setManualFood({ ...manualFood, category: e.target.value })} /></label>
          <label>Barcode<input value={manualFood.barcode} onChange={e => setManualFood({ ...manualFood, barcode: e.target.value })} /></label>
          <label>Allergeni/tag<input value={manualFood.allergens} onChange={e => setManualFood({ ...manualFood, allergens: e.target.value })} placeholder="es. glutine, lattosio" /></label>
          <label>Parametri<input value={manualFood.tags} onChange={e => setManualFood({ ...manualFood, tags: e.target.value })} placeholder="es. vegano, senza glutine" /></label>
          <label>Kcal/100g<input type="number" value={manualFood.kcal_100g} onChange={e => setManualFood({ ...manualFood, kcal_100g: e.target.value })} /></label>
          <label>Proteine/100g<input type="number" value={manualFood.protein_100g} onChange={e => setManualFood({ ...manualFood, protein_100g: e.target.value })} /></label>
          <label>Carboidrati/100g<input type="number" value={manualFood.carbs_100g} onChange={e => setManualFood({ ...manualFood, carbs_100g: e.target.value })} /></label>
          <label>Grassi/100g<input type="number" value={manualFood.fat_100g} onChange={e => setManualFood({ ...manualFood, fat_100g: e.target.value })} /></label>
          <label>Fibre/100g<input type="number" value={manualFood.fiber_100g} onChange={e => setManualFood({ ...manualFood, fiber_100g: e.target.value })} /></label>
          <label>Zuccheri/100g<input type="number" value={manualFood.sugar_100g} onChange={e => setManualFood({ ...manualFood, sugar_100g: e.target.value })} /></label>
          <label>Sale/100g<input type="number" value={manualFood.salt_100g} onChange={e => setManualFood({ ...manualFood, salt_100g: e.target.value })} /></label>
        </div>
        <button className="primary" onClick={saveManualFood}>Salva alimento</button>
      </div>
      <div className="card wide">
        <h3>Archivio alimenti</h3>
        <label>Cerca<input value={foodSearch} onChange={e => setFoodSearch(e.target.value)} placeholder="cerca alimento" /></label>
        <div className="foodTable">
          <div className="foodHead"><span>Alimento</span><span>Kcal</span><span>P</span><span>C</span><span>G</span></div>
          {filteredFoods.map(food => <div className="foodHead foodRow" key={food.id}><span>{food.name}{food.brand ? ` - ${food.brand}` : ''}{Array.isArray(food.allergens) && food.allergens.length ? <small className="muted"> · {food.allergens.join(', ')}</small> : null}</span><span>{food.kcal_100g}</span><span>{food.protein_100g}</span><span>{food.carbs_100g}</span><span>{food.fat_100g}</span></div>)}
        </div>
      </div>
    </section>
  );
}

function DietTab({ plannedOptions, plannedForm, setPlannedForm, foods, savePlannedOption, deletePlannedOption, currentWeekday }) {
  return (
    <section className="grid">
      <div className="card wide">
        <h3>Inserisci opzione dieta settimanale</h3>
        <p className="muted">Ogni opzione può essere cliccata dalla dashboard per inserirla nel diario. Per piatti più complessi crea più opzioni o aggiungi altri alimenti come extra nel diario.</p>
        <div className="formGrid four">
          <label>Giorno<select value={plannedForm.weekday} onChange={e => setPlannedForm({ ...plannedForm, weekday: e.target.value })}>{weekdays.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
          <label>Pasto<select value={plannedForm.meal_type} onChange={e => setPlannedForm({ ...plannedForm, meal_type: e.target.value })}>{mealTypes.filter(m => m !== 'extra').map(m => <option key={m}>{m}</option>)}</select></label>
          <label>Nome opzione<input value={plannedForm.option_name} onChange={e => setPlannedForm({ ...plannedForm, option_name: e.target.value })} placeholder="Opzione A" /></label>
          <label>Alimento<select value={plannedForm.food_id} onChange={e => setPlannedForm({ ...plannedForm, food_id: e.target.value })}><option value="">Seleziona</option>{foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <label>Grammi<input type="number" value={plannedForm.grams} onChange={e => setPlannedForm({ ...plannedForm, grams: e.target.value })} /></label>
          <label>Note<input value={plannedForm.notes} onChange={e => setPlannedForm({ ...plannedForm, notes: e.target.value })} /></label>
        </div>
        <button className="primary" onClick={savePlannedOption}>Salva opzione</button>
      </div>
      <div className="card wide">
        <h3>Opzioni per il giorno selezionato nella dashboard</h3>
        <p className="muted">Giorno corrente: {weekdays.find(w => w.value === currentWeekday)?.label}</p>
        <div className="optionList">
          {plannedOptions.map(o => <article className="optionCard" key={o.id}><div><span className="mealBadge">{o.meal_type}{o.source === 'generated' ? ' · generata' : ''}</span><h4>{o.option_name}</h4><p>{(o.planned_meal_foods || []).map(f => `${f.food_name} ${f.grams} g`).join(', ')}</p></div><button className="danger" onClick={() => deletePlannedOption(o.id)}>Elimina</button></article>)}
        </div>
      </div>
    </section>
  );
}

function MeasurementsTab({ measurements, measurementForm, setMeasurementForm, saveMeasurement }) {
  return (
    <section className="grid">
      <div className="card wide">
        <h3>Registra peso e misure</h3>
        <div className="formGrid four">
          {['weight', 'waist', 'hips', 'chest', 'abdomen', 'arm', 'thigh', 'neck'].map(field => <label key={field}>{measurementLabel(field)}<input type="number" step="0.1" value={measurementForm[field]} onChange={e => setMeasurementForm({ ...measurementForm, [field]: e.target.value })} /></label>)}
          <label>Note<input value={measurementForm.notes} onChange={e => setMeasurementForm({ ...measurementForm, notes: e.target.value })} /></label>
        </div>
        <button className="primary" onClick={saveMeasurement}>Salva misure</button>
      </div>
      <div className="card wide"><h3>Grafico peso</h3><LineChart data={measurements} field="weight" /></div>
      <div className="card wide"><h3>Storico misure</h3><div className="foodTable"><div className="foodHead"><span>Data</span><span>Peso</span><span>Vita</span><span>Fianchi</span><span>Addome</span></div>{measurements.slice().reverse().map(m => <div className="foodHead foodRow" key={m.id}><span>{m.measure_date}</span><span>{m.weight || '-'}</span><span>{m.waist || '-'}</span><span>{m.hips || '-'}</span><span>{m.abdomen || '-'}</span></div>)}</div></div>
    </section>
  );
}

function WorkoutTab({ workouts, workoutForm, setWorkoutForm, saveWorkout, workoutLog, setWorkoutStatus }) {
  return (
    <section className="grid">
      <div className="card wide">
        <h3>Programma allenamento</h3>
        <div className="formGrid two">
          <label>Giorno<select value={workoutForm.weekday} onChange={e => setWorkoutForm({ ...workoutForm, weekday: e.target.value })}>{weekdays.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
          <label>Titolo<input value={workoutForm.title} onChange={e => setWorkoutForm({ ...workoutForm, title: e.target.value })} placeholder="Allenamento A" /></label>
          <label className="span2">Esercizi<textarea value={workoutForm.exercises} onChange={e => setWorkoutForm({ ...workoutForm, exercises: e.target.value })} placeholder={'Squat 4x12\nPiegamenti 4x10\nCamminata 30 min'} /></label>
          <label className="span2">Note<input value={workoutForm.notes} onChange={e => setWorkoutForm({ ...workoutForm, notes: e.target.value })} /></label>
        </div>
        <button className="primary" onClick={saveWorkout}>Salva allenamento</button>
      </div>
      <div className="card wide"><h3>Allenamenti di oggi</h3><p className="muted">Stato oggi: {workoutLog?.status || 'non registrato'}</p>{workouts.map(w => <article className="workoutBox" key={w.id}><h4>{w.title}</h4><pre>{w.exercises}</pre></article>)}<div className="buttonRow"><button className="secondary" onClick={() => setWorkoutStatus('fatto')}>Fatto</button><button className="secondary" onClick={() => setWorkoutStatus('saltato')}>Saltato</button></div></div>
    </section>
  );
}

function ProfileTab({ profile, setProfile, saveProfile, estimateAndSaveTarget, generatePersonalizedDiet, selectedDate, target, viewingOtherUser, selectedManagedUser }) {
  const preview = estimatePersonalizedPlan(profile, selectedDate);
  const activeRestrictions = restrictionSummary(profile);

  function toggleRestriction(key) {
    const current = Array.isArray(profile.selected_restrictions) ? profile.selected_restrictions : csvToArray(profile.selected_restrictions);
    const next = current.includes(key) ? current.filter(item => item !== key) : [...current, key];
    setProfile({ ...profile, selected_restrictions: next });
  }

  return (
    <section className="grid">
      <div className="card wide">
        <h3>Profilo dieta</h3>
        <p className="muted">Compila questi dati per usare l'app in due modi: inserire la tua dieta manuale oppure generare una proposta automatica modificabile.</p>
        <div className="formGrid four">
          {viewingOtherUser && <p className="notice">Stai modificando il profilo di {selectedManagedUser?.name || selectedManagedUser?.email || profile.email || 'questo utente'}.</p>}
          <label>Nome<input value={profile.name || ''} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label>
          <label>Sesso<select value={profile.sex || 'maschio'} onChange={e => setProfile({ ...profile, sex: e.target.value })}><option value="maschio">Maschio</option><option value="femmina">Femmina</option></select></label>
          <label>Data nascita<input type="date" value={profile.birth_date || ''} onChange={e => setProfile({ ...profile, birth_date: e.target.value })} /></label>
          <label>Altezza cm<input type="number" value={profile.height_cm || ''} onChange={e => setProfile({ ...profile, height_cm: e.target.value })} /></label>
          <label>Attività<select value={profile.activity_level || 'sedentario'} onChange={e => setProfile({ ...profile, activity_level: e.target.value })}><option value="sedentario">Sedentario</option><option value="leggero">Leggero</option><option value="medio">Medio</option><option value="alto">Alto</option></select></label>
          <label>Stile dieta<select value={profile.diet_style || 'equilibrata'} onChange={e => setProfile({ ...profile, diet_style: e.target.value })}><option value="equilibrata">Equilibrata</option><option value="alta_proteica">Più proteica</option><option value="mediterranea">Mediterranea semplice</option></select></label>
          <label>Peso iniziale<input type="number" step="0.1" value={profile.start_weight || ''} onChange={e => setProfile({ ...profile, start_weight: e.target.value })} /></label>
          <label>Peso attuale<input type="number" step="0.1" value={profile.current_weight || ''} onChange={e => setProfile({ ...profile, current_weight: e.target.value })} /></label>
          <label>Peso obiettivo<input type="number" step="0.1" value={profile.target_weight || ''} onChange={e => setProfile({ ...profile, target_weight: e.target.value })} /></label>
          <label>Data obiettivo<input type="date" value={profile.target_date || ''} onChange={e => setProfile({ ...profile, target_date: e.target.value })} /><small className="muted">Se la lasci vuota, l’app usa un ritmo sostenibile e calcola una data indicativa.</small></label>
          <label className="span2">Preferenze alimentari<input value={profile.food_preferences || ''} onChange={e => setProfile({ ...profile, food_preferences: e.target.value })} placeholder="es. pasta, riso, pollo, pesce" /></label>
          <label className="span2">Alimenti da evitare<input value={profile.excluded_foods || ''} onChange={e => setProfile({ ...profile, excluded_foods: e.target.value })} placeholder="es. latte, yogurt, mela, farro" /></label>
          <label className="span2">Altre allergie/intolleranze<input value={profile.custom_allergies || ''} onChange={e => setProfile({ ...profile, custom_allergies: e.target.value })} placeholder="es. kiwi, fragole, pomodoro" /></label>
          <label className="span2">Note obiettivo<input value={profile.goal_notes || ''} onChange={e => setProfile({ ...profile, goal_notes: e.target.value })} /></label>
          <label className="span2">Note allergie e preferenze<input value={profile.allergy_notes || ''} onChange={e => setProfile({ ...profile, allergy_notes: e.target.value })} placeholder="es. rischio contaminazione, alimenti che tollero solo in piccole quantità" /></label>
        </div>
        <div className="restrictionPanel">
          <h4>Restrizioni alimentari selezionabili</h4>
          <p className="muted">Se selezioni allergie, intolleranze o preferenze, il generatore evita automaticamente gli alimenti compatibili con quelle restrizioni. Per allergie vere controlla sempre etichette e contaminazioni.</p>
          {restrictionGroups.map(group => (
            <div key={group.title} className="restrictionGroup">
              <strong>{group.title}</strong>
              <div className="checkGrid">
                {group.options.map(option => {
                  const checked = (Array.isArray(profile.selected_restrictions) ? profile.selected_restrictions : csvToArray(profile.selected_restrictions)).includes(option.key);
                  return (
                    <label key={option.key} className="checkCard">
                      <input type="checkbox" checked={checked} onChange={() => toggleRestriction(option.key)} />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {activeRestrictions.length > 0 && <p className="notice">Restrizioni attive: {activeRestrictions.join(', ')}</p>}
        </div>
        <div className="buttonRow"><button className="primary" onClick={saveProfile}>Salva profilo</button><button className="secondary" onClick={estimateAndSaveTarget}>Calcola solo calorie</button><button className="primary" onClick={generatePersonalizedDiet}>Genera dieta personalizzata</button></div>
        <p className="muted">Target attuale: {target.kcal_target} kcal · P {target.protein_target} g · C {target.carbs_target} g · G {target.fat_target} g. Calcolo indicativo, non sostituisce medico o nutrizionista.</p>
      </div>

      <div className={`card wide ${preview.valid && !preview.realistic ? 'warningCard' : ''}`}>
        <h3>Controllo obiettivo realistico</h3>
        {!preview.valid && <p className="muted">{preview.message}</p>}
        {preview.valid && (
          <>
            <div className="previewGrid">
              <strong>{preview.kcal_target}<span>kcal/giorno</span></strong>
              <strong>{preview.protein_target} g<span>proteine</span></strong>
              <strong>{preview.carbs_target} g<span>carboidrati</span></strong>
              <strong>{preview.fat_target} g<span>grassi</span></strong>
            </div>
            <p>{preview.message}</p>
            <div className="pillRow">
              <span className="pill">BMR {preview.bmr} kcal</span>
              <span className="pill">Mantenimento {preview.tdee} kcal</span>
              {preview.daily_deficit > 0 && <span className="pill">Deficit {preview.daily_deficit} kcal/giorno</span>}
              {preview.daily_surplus > 0 && <span className="pill">Surplus {preview.daily_surplus} kcal/giorno</span>}
            </div>
            <p className="muted">Se chiedi un dimagrimento troppo rapido, l'app non crea una dieta estrema: abbassa il deficit e ti suggerisce una data più realistica.</p>
          </>
        )}
      </div>
    </section>
  );
}

function Macro({ label, value, max, unit }) {
  return <div className="macro"><span>{label}</span><strong>{round(value, 1)} / {round(max, 1)} {unit}</strong><Progress value={value} max={max} /></div>;
}

function Progress({ value, max }) {
  const width = Math.min(100, Math.max(0, Number(value || 0) / Math.max(Number(max || 1), 1) * 100));
  return <div className="progress"><div style={{ width: `${width}%` }} /></div>;
}

function LineChart({ data, field }) {
  const points = data.filter(d => d[field] !== null && d[field] !== undefined).map((d, i) => ({ x: i, y: Number(d[field]), date: d.measure_date }));
  if (points.length < 2) return <p className="muted">Inserisci almeno due misurazioni per vedere il grafico.</p>;
  const min = Math.min(...points.map(p => p.y));
  const max = Math.max(...points.map(p => p.y));
  const width = 620;
  const height = 220;
  const pad = 24;
  const range = Math.max(max - min, 1);
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.y - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img"><polyline fill="none" stroke="currentColor" strokeWidth="4" points={coords} />{points.map((p, i) => { const [x, y] = coords.split(' ')[i].split(','); return <circle key={p.date} cx={x} cy={y} r="5" fill="currentColor" />; })}<text x="24" y="24">{max} kg</text><text x="24" y="210">{min} kg</text></svg>;
}


function dedupeFoods(items) {
  const seen = new Set();
  const result = [];
  for (const food of items) {
    const key = [
      food.user_id || 'public',
      String(food.name || '').trim().toLowerCase(),
      String(food.brand || '').trim().toLowerCase(),
      String(food.barcode || '').trim().toLowerCase(),
      food.source || ''
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(food);
  }
  return result;
}

function labelForTab(tab) {
  return { dieta: 'Dieta settimanale', alimenti: 'Archivio alimenti', misure: 'Peso e misure', allenamento: 'Allenamento', profilo: 'Profilo', admin: 'Gestione utenti' }[tab] || tab;
}

function statusLabel(status) {
  return { completata: 'Completata', parziale: 'Parziale', sgarro: 'Sgarro', saltata: 'Saltata', non_registrata: 'Non registrata' }[status] || status;
}

function measurementLabel(field) {
  return { weight: 'Peso kg', waist: 'Vita cm', hips: 'Fianchi cm', chest: 'Petto cm', abdomen: 'Addome cm', arm: 'Braccio cm', thigh: 'Coscia cm', neck: 'Collo cm' }[field] || field;
}

function csvToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  return String(value).split(/[,;\n]/).map(item => item.trim()).filter(Boolean);
}

function nullableDate(value) {
  if (value === '' || value === null || value === undefined) return null;
  return value;
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  return Number(value);
}
