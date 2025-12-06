import { getActiveSession, saveActiveSession, currentUser, getHistory, getEditSessionId, clearEditSessionId, setEditSessionId, setCurrentTab } from './state.js';
import { workouts } from './config.js';
import { supabase } from './supabase.js';
import { calculate1RM, toggleTimer, resetTimer } from './utils.js';
import { renderHistory, renderWorkout, renderTabs, showToast, updateProgressBar, update1RMDisplay, openConfirmModal } from './ui.js';
import { syncHistoryFromCloud } from './auth.js';

// --- NAVIGATION ---
export function switchTab(tabName) {
    setCurrentTab(tabName);
    renderTabs();
    const main = document.getElementById('main-container');
    main.classList.remove('fade-in');
    void main.offsetWidth; 
    if (tabName === 'HISTORIQUE') renderHistory();
    else renderWorkout(tabName);
    main.classList.add('fade-in');
    updateProgressBar();
}

// --- GESTION DES SÉRIES ---

export function addSet(exId) {
    const data = getActiveSession();
    if (!data[exId]) data[exId] = { series: [], note: "" };
    if (!data[exId].series) data[exId].series = [];

    const lastSet = data[exId].series[data[exId].series.length - 1];
    const newWeight = lastSet ? lastSet.weight : "";
    
    data[exId].series.push({ reps: "", weight: newWeight });
    saveActiveSession(data);
    renderWorkout(localStorage.getItem('lastTab'));
}

export function removeSet(exId, index) {
    const data = getActiveSession();
    if (data[exId] && data[exId].series) {
        data[exId].series.splice(index, 1);
        saveActiveSession(data);
        renderWorkout(localStorage.getItem('lastTab'));
    }
}

// ... Imports ...

export function updateSet(exId, index, field, value) {
    const data = getActiveSession();
    if (!data[exId]) data[exId] = { series: [{reps:"", weight:""}], note: "" };
    
    // 1. Sauvegarde donnée
    data[exId].series[index][field] = value;
    saveActiveSession(data);
    
    // 2. Gestion couleur cercle (Vert/Gris)
    const set = data[exId].series[index];
    const isComplete = set.reps && set.reps.toString().trim() !== "" && set.weight && set.weight.toString().trim() !== "";
    const circle = document.getElementById(`circle-${exId}-${index}`);
    
    if (circle) {
        if (isComplete) {
            circle.classList.remove('bg-slate-100', 'dark:bg-slate-700', 'text-slate-400', 'border-transparent');
            circle.classList.add('bg-emerald-500', 'text-white', 'border-emerald-500');
        } else {
            circle.classList.add('bg-slate-100', 'dark:bg-slate-700', 'text-slate-400', 'border-transparent');
            circle.classList.remove('bg-emerald-500', 'text-white', 'border-emerald-500');
        }
    }

    // 3. Barre de progression
    if (typeof updateProgressBar === 'function') updateProgressBar();

    // 4. APPEL DU CALCULATEUR 1RM
    // On vérifie que la fonction existe pour éviter les crashs
    if (typeof update1RMDisplay === 'function') {
        update1RMDisplay(exId);
    } else {
        console.error("Fonction update1RMDisplay non trouvée !");
    }


}
export function updateNote(exId, value) {
    const data = getActiveSession();
    if (!data[exId]) data[exId] = { series: [], note: "" };
    data[exId].note = value;
    saveActiveSession(data);
}
// --- VALIDATION SÉANCE ---
export async function finishSession(day) {
    // 👇 REMPLACEMENT DU CONFIRM NATIF
    openConfirmModal(
        "Valider la séance ?",
        "Bravo pour tes efforts ! Veux-tu enregistrer ?",
        async () => {
            // TOUT LE CODE DE SAUVEGARDE VA ICI (DANS LE CALLBACK)
            const activeData = getActiveSession();
            const exercises = workouts[day];

            const exerciseData = exercises.map(ex => {
                const userEx = activeData[ex.id];
                if (!userEx || !userEx.series) return null;

                const cleanSeries = userEx.series.filter(s => s.reps !== "" && s.reps !== null);
                if (cleanSeries.length === 0) return null;

                return {
                    id: ex.id,
                    name: ex.name,
                    series: cleanSeries,
                    note: userEx.note || ""
                };
            }).filter(e => e !== null);

            const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

            const { error } = await supabase
                .from('workout_logs')
                .insert([{
                    user_id: currentUser.id,
                    program_name: day,
                    date: dateStr,
                    session_data: exerciseData
                }]);

            if (error) {
                showToast("Erreur : " + error.message); // Remplace alert
            } else {
                showToast("Séance sauvegardée ! ☁️");
                localStorage.removeItem('activeSession');
                clearEditSessionId();

                // Animation de célébration (optionnel, si tu veux utiliser le modal congrats plus tard)
                // ... 

                await syncHistoryFromCloud();
                switchTab('HISTORIQUE');
            }
        }
    );
}

// --- SUPPRESSION SÉANCE (HISTORIQUE) ---
export function deleteSession(id) {
    // 👇 On utilise bien openConfirmModal, pas confirm()
    openConfirmModal(
        "Supprimer la séance ?",
        "Cette action est irréversible.",
        async () => {
            const { error } = await supabase.from('workout_logs').delete().eq('id', id);
            
            if (error) {
                showToast("Erreur : " + error.message);
            } else {
                showToast("Séance supprimée 🗑️");
                await syncHistoryFromCloud();
                renderHistory();
            }
        }
    );
}

export function editSession(id) {
    alert("L'édition sera disponible bientôt !");
}

export function cancelEdit() {
    clearEditSessionId();
    localStorage.removeItem('activeSession');
    switchTab('HISTORIQUE');
    showToast("Annulé");
}