import { getActiveSession, saveActiveSession, currentUser, getHistory, getEditSessionId, clearEditSessionId, setEditSessionId, setCurrentTab } from './state.js';
import { workouts } from './config.js';
import { supabase } from './supabase.js';
import { calculate1RM, toggleTimer, resetTimer} from './utils.js';
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

// --- VARIABLE TEMPORAIRE ---
let sessionToEditDateId = null;

// 1. Ouvrir la modale (Avec restriction MAX)
export function openDateEditor(id, currentIsoDate) {
    sessionToEditDateId = id;
    const modal = document.getElementById('date-modal');
    const input = document.getElementById('new-session-date');
    
    // Calcul de "Maintenant" au format YYYY-MM-DDTHH:MM pour l'attribut MAX
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const maxDateString = now.toISOString().slice(0, 16);
    
    // Appliquer la limite au calendrier (grise les dates futures)
    input.max = maxDateString;

    // Pré-remplir avec la date de la séance
    if (currentIsoDate) {
        const dateObj = new Date(currentIsoDate);
        dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
        input.value = dateObj.toISOString().slice(0, 16);
    } else {
        // Par défaut : maintenant
        input.value = maxDateString;
    }
    
    modal.classList.remove('hidden');
}

// 2. Sauvegarder (Avec validation stricte)
export async function saveDateChange() {
    const input = document.getElementById('new-session-date');
    const newDateVal = input.value; 

    if (!newDateVal || !sessionToEditDateId) return;

    const selectedDate = new Date(newDateVal);
    const now = new Date();

    // SÉCURITÉ : Vérification anti-futur
    if (selectedDate > now) {
        showToast("Impossible : Tu ne peux pas aller dans le futur ! 🚗⚡");
        return; // On arrête tout ici
    }

    // A. Formatage
    const displayDate = selectedDate.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    const isoDate = selectedDate.toISOString();

    // B. Envoi Supabase
    const { error } = await supabase
        .from('workout_logs')
        .update({ 
            date: displayDate,
            created_at: isoDate
        })
        .eq('id', sessionToEditDateId);

    if (error) {
        showToast("Erreur : " + error.message);
    } else {
        showToast("Date modifiée ! 🗓️");
        document.getElementById('date-modal').classList.add('hidden');
        await syncHistoryFromCloud();
        renderHistory();
    }
}

// Récupère l'historique 1RM d'un exercice spécifique
export function getExerciseHistoryData(exerciseId) {
    const history = getHistory(); // Vient de state.js
    const dataPoints = [];

    // On parcourt l'historique du plus ancien au plus récent (reverse pour le graph)
    [...history].reverse().forEach(session => {
        // On cherche si l'exercice est dans cette session
        // Note: session.exercises peut être un tableau direct ou via 'session_data' selon ta version DB
        const exercises = session.exercises || session.session_data || [];
        
        if (!Array.isArray(exercises)) return;

        const exData = exercises.find(e => e.id === exerciseId);
        
        if (exData) {
            // On calcule le MEILLEUR 1RM de la séance
            let max1RM = 0;
            
            // Compatibilité ancien/nouveau format
            const series = exData.series || (exData.reps ? [{reps: exData.reps, weight: exData.weight}] : []);

            series.forEach(s => {
                const r = parseFloat(s.reps);
                const w = parseFloat(s.weight);
                if (r > 0 && w > 0) {
                    const rm = calculate1RM(w, r);
                    if (rm > max1RM) max1RM = rm;
                }
            });

            if (max1RM > 0) {
                // On formate la date "DD/MM"
                const dateObj = new Date(session.created_at);
                const label = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
                
                dataPoints.push({
                    x: label,
                    y: max1RM,
                    fullDate: session.created_at
                });
            }
        }
    });

    return dataPoints;
}