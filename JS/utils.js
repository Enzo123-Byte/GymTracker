import { getHistory, getEditSessionId } from './state.js';

// --- FONCTIONS UTILITAIRES ---

export function generateUUID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function calculate1RM(weight, reps) {
    if (!weight || !reps || reps < 1) return 0;
    if (reps == 1) return weight;
    return Math.round(weight * (1 + reps / 30));
}

// --- HELPER : Trouver la dernière perf ---
export function getLastPerf(exerciseId) {
    const history = getHistory();
    const editingId = getEditSessionId();
    
    // On parcourt l'historique à l'envers
    for (let i = history.length - 1; i >= 0; i--) {
        const session = history[i];
        if (editingId && session.id === editingId) continue;
        
        // Gestion compatibilité (Array direct ou propriété exercises)
        const exercisesList = Array.isArray(session.exercises) ? session.exercises : [];
        const exerciseData = exercisesList.find(ex => ex.id === exerciseId);
        
        if (exerciseData && (exerciseData.reps || exerciseData.weight)) {
            return exerciseData;
        }
    }
    return null;
}

// --- GESTION DU TIMER ---
let timerInterval;
let seconds = 0;
let isTimerRunning = false;

export function toggleTimer() {
    const display = document.getElementById('timer-display');
    const btn = document.getElementById('timer-btn');
    
    if (display.classList.contains('hidden')) {
        display.classList.remove('hidden');
        startTimer();
        btn.classList.add('pulse-active');
    } else {
        display.classList.add('hidden');
        stopTimer();
        btn.classList.remove('pulse-active');
    }
}

export function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        seconds++;
        updateTimerDisplay();
    }, 1000);
}

export function stopTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
}

export function resetTimer() {
    stopTimer();
    seconds = 0;
    updateTimerDisplay();
    startTimer();
}

function updateTimerDisplay() {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    const el = document.getElementById('chrono');
    if(el) el.innerText = `${m}:${s}`;
}
// --- CALENDRIER HELPERS ---

export function getDaysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(month, year) {
    // 0 = Dimanche, 1 = Lundi... on veut que Lundi soit 0 pour notre grille
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
}

// Convertit "2023-10-25" ou Date object en string comparable "DD/MM/YYYY"
// Note : Tes dates Supabase sont stockées en format texte français "Jeudi 24 Octobre" ?
// Si oui, c'est compliqué pour un calendrier. 
// Idéalement, il faut utiliser la propriété 'created_at' (ISO timestamp) qui vient de la DB.
export function formatDateKey(isoDateString) {
    const d = new Date(isoDateString);
    return `${d.getDate()}/${d.getMonth()}/${d.getFullYear()}`;
}