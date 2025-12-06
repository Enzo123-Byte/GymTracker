import { WIZARD_SPLITS, GOAL_MODIFIERS } from './config.js';
import { supabase } from './supabase.js';
import { currentUser } from './state.js';
import { showToast } from './ui.js';

let selectedFreq = 0;
let selectedGoal = "HYPERTROPHIE";

// --- 1. OUVERTURE ---
export function openGeneratorModal() {
    const modal = document.getElementById('generator-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Reset à l'étape 1
        document.getElementById('gen-step-1').classList.remove('hidden');
        document.getElementById('gen-step-2').classList.add('hidden');
        document.getElementById('gen-step-3').classList.add('hidden');
    }
}

// --- 2. ÉTAPE 1 : FRÉQUENCE ---
export function selectFrequency(freq) {
    selectedFreq = freq;
    // Passage à l'étape 2
    document.getElementById('gen-step-1').classList.add('hidden');
    document.getElementById('gen-step-2').classList.remove('hidden');
}

// --- 3. ÉTAPE 2 : OBJECTIF ---
export function selectGoal(goal) {
    selectedGoal = goal;
    
    // Préparation de la confirmation (Étape 3)
    const config = WIZARD_SPLITS[selectedFreq];
    const modifier = GOAL_MODIFIERS[selectedGoal];

    document.getElementById('gen-summary-title').innerText = `${config.name} - ${goal}`;
    document.getElementById('gen-summary-desc').innerText = `Objectif : ${modifier.sets} séries de ${modifier.reps} reps`;

    const daysList = document.getElementById('gen-days-list');
    daysList.innerHTML = Object.keys(config.days).map(day => 
        `<li class="text-xs text-slate-500">• ${day}</li>`
    ).join('');

    // Transition
    document.getElementById('gen-step-2').classList.add('hidden');
    document.getElementById('gen-step-3').classList.remove('hidden');
}

// --- 4. VALIDATION FINALE ---
export async function confirmGeneration() {
    const config = WIZARD_SPLITS[selectedFreq];
    const modifier = GOAL_MODIFIERS[selectedGoal];
    
    if (!config || !modifier) return;

    const btn = document.getElementById('btn-generate-confirm');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Création...";

    try {
        const inserts = [];
        
        // Récupération des IDs depuis la DB
        const { data: dbExercises } = await supabase.from('exercises').select('id, name');
        if (!dbExercises) throw new Error("Erreur DB");

        for (const [dayName, exoNames] of Object.entries(config.days)) {
            
            const exerciseList = exoNames.map(name => {
                const found = dbExercises.find(e => e.name === name);
                
                // Si l'exo n'existe pas, on l'ignore (ou on met un placeholder si tu veux)
                if (!found) return null;

                return {
                    id: found.id,
                    sets: modifier.sets, // On applique l'objectif choisi
                    reps: modifier.reps
                };
            }).filter(e => e !== null);

            if (exerciseList.length > 0) {
                inserts.push({
                    user_id: currentUser.id,
                    name: dayName,
                    exercises: exerciseList
                });
            }
        }

        const { error } = await supabase.from('user_programs').insert(inserts);
        if (error) throw error;

        showToast("Programme généré ! 🚀");
        window.location.reload();

    } catch (e) {
        alert("Erreur : " + e.message);
        btn.innerHTML = originalText;
    }
}