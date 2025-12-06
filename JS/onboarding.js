import { supabase } from './supabase.js';
import { currentUser } from './state.js';
import { showToast } from './ui.js';
import { openBuilder } from './builder.js';

// --- GESTION DE LA MODALE ---
export function openOnboarding() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.classList.remove('hidden');
}

export function closeOnboardingAndBuild() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.classList.add('hidden');
    openBuilder();
}

// --- APPLIQUER UN TEMPLATE DEPUIS LA DB ---
export async function applyTemplate(templateKey) {
    const btn = document.querySelector(`button[onclick="applyTemplate('${templateKey}')"]`);
    const originalText = btn ? btn.innerHTML : "";
    if(btn) btn.innerHTML = "⏳ Recherche...";

    try {
        // 1. On cherche le template dans la DB
        const { data: templates } = await supabase
            .from('program_templates')
            .select('*')
            .ilike('name', `%${templateKey}%`) 
            .limit(1);

        if (!templates || templates.length === 0) {
            throw new Error("Modèle introuvable dans la base de données.");
        }
        
        const selectedTemplate = templates[0];
        const structure = selectedTemplate.structure;

        if(btn) btn.innerHTML = "⏳ Installation...";

        // 2. On charge les IDs des exercices
        const { data: dbExercises } = await supabase
            .from('exercises')
            .select('id, name, default_sets, default_reps');
            
        if (!dbExercises) throw new Error("Impossible de lire les exercices.");

        const inserts = [];

        // 3. Construction
        for (const [dayName, exerciseNames] of Object.entries(structure)) {
            
            const exerciseListForDB = exerciseNames.map(name => {
                const foundEx = dbExercises.find(e => e.name === name);
                
                if (!foundEx) {
                    console.warn(`Exercice manquant : ${name}`);
                    return null;
                }

                return {
                    id: foundEx.id,
                    sets: foundEx.default_sets || 3,
                    reps: foundEx.default_reps || "10-12"
                };
            }).filter(e => e !== null);

            if (exerciseListForDB.length > 0) {
                inserts.push({
                    user_id: currentUser.id,
                    name: dayName,
                    exercises: exerciseListForDB
                });
            }
        }

        // 4. Sauvegarde
        const { error: insertError } = await supabase.from('user_programs').insert(inserts);
        if (insertError) throw insertError;

        showToast("Programme installé ! 🔥");
        window.location.reload();

    } catch (error) {
        console.error(error);
        alert("Erreur : " + error.message);
        if(btn) btn.innerHTML = originalText;
    }
}