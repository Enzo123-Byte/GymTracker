import { workouts, BADGES_CONFIG } from './config.js';
import { currentTab, getActiveSession, getEditSessionId, getHistory,saveActiveSession} from './state.js'; 
import { calculate1RM, getLastPerf, getDaysInMonth, getFirstDayOfMonth } from './utils.js';

// --- VARIABLES LOCALES POUR LE CALENDRIER ---
let currentCalendarDate = new Date();
let selectedDateKey = null; // Format "JJ/MM/AAAA"

// --- FONCTIONS DE NAVIGATION (CALENDRIER) ---
// On les attache à window pour que les onclick="" du HTML fonctionnent
window.changeMonth = (offset) => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    renderHistory();
};

window.selectDate = (dateKey) => {
    // Si on clique sur la même date, on désélectionne, sinon on sélectionne
    selectedDateKey = (selectedDateKey === dateKey) ? null : dateKey;
    renderHistory();
};

// --- GESTION DU THEME ---
export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const themeIcon = document.getElementById('theme-icon');

    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.documentElement.classList.add('dark');
        if(themeIcon) themeIcon.innerText = '🌙';
    } else {
        document.documentElement.classList.remove('dark');
        if(themeIcon) themeIcon.innerText = '☀️';
    }
}

export function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    const themeIcon = document.getElementById('theme-icon');
    if(themeIcon) themeIcon.innerText = isDark ? '🌙' : '☀️';
}

// --- GESTION DES ONGLETS ---
// --- GESTION DES ONGLETS & ÉTAT VIDE ---
export function renderTabs() {
    const container = document.getElementById('tab-container');
    const emptyState = document.getElementById('empty-state');
    const mainContainer = document.getElementById('main-container');
    // On sélectionne le parent des onglets pour le cacher aussi
    const tabsWrapper = container ? container.parentElement : null; 
    
    const programKeys = Object.keys(workouts);
    
    // CAS 1 : AUCUN PROGRAMME (Nouveau compte ou tout supprimé)
    if (programKeys.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (mainContainer) mainContainer.classList.add('hidden');
        if (tabsWrapper) tabsWrapper.classList.add('hidden'); // Cache la barre d'onglets
        
        // On s'assure que la barre de progression est vide/cachée
        const progressBar = document.getElementById('progress-bar');
        if(progressBar) progressBar.style.width = '0%';
        
        return; // On arrête là, pas besoin de dessiner les boutons
    }

    // CAS 2 : IL Y A DES PROGRAMMES
    if (emptyState) emptyState.classList.add('hidden');
    if (mainContainer) mainContainer.classList.remove('hidden');
    if (tabsWrapper) tabsWrapper.classList.remove('hidden');

    const tabs = [...programKeys, "HISTORIQUE"];
    
    container.innerHTML = tabs.map(key => `
        <button 
            onclick="switchTab('${key}')"
            class="px-3.5 py-1.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all duration-300 whitespace-nowrap ${key === currentTab ? 'tab-active' : 'tab-inactive'}"
        >
            ${key === 'HISTORIQUE' ? 'Historique' : key}
        </button>
    `).join('');
}
// --- AFFICHAGE SÉANCE ---
// --- AFFICHAGE SÉANCE (COMPLETE & CORRIGÉE) ---
export function renderWorkout(day) {
    const container = document.getElementById('main-container');
    if (!day) day = "PUSH";
    
    const exercises = workouts[day];
    const activeData = getActiveSession();
    const isEditing = getEditSessionId();

    // 1. BOUTON MODIFIER (Si programme perso)
    const defaultPrograms = ["PUSH", "PULL", "LEGS", "FULL BODY"];
    let configHtml = "";
    if (!defaultPrograms.includes(day)) {
        configHtml = `
        <div class="flex justify-end mb-4">
            <button onclick="openProgramManager('${day}')" class="text-xs font-bold text-slate-400 hover:text-emerald-500 flex items-center gap-1 transition-colors bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
                <span>⚙️</span> Modifier le programme
            </button>
        </div>`;
    }

    if (!exercises) {
        container.innerHTML = `<div class="text-center text-slate-400 mt-10">Chargement...</div>`;
        return;
    }

    let html = exercises.map((ex, index) => {
        let seriesData = activeData[ex.id]?.series || [];
        const targetSets = parseInt(ex.sets) || 3;
        const isGhostData = seriesData.length === 1 && 
                                (seriesData[0].reps === "" || seriesData[0].reps === null) && 
                                (seriesData[0].weight === "" || seriesData[0].weight === null) &&
                                targetSets > 1;

                                if (seriesData.length === 0 || isGhostData) {
                
                                    // On génère le bon nombre de lignes
                                    seriesData = Array(targetSets).fill().map(() => ({ reps: "", weight: "" }));
                                    
                                    // SAUVEGARDE IMMÉDIATE
                                    if (!activeData[ex.id]) activeData[ex.id] = {};
                                    activeData[ex.id].series = seriesData;
                                    activeData[ex.id].note = activeData[ex.id].note || "";
                                    
                                    saveActiveSession(activeData);
                                }

        const savedNote = activeData[ex.id]?.note || "";
        const allSetsDone = seriesData.every(s => s.reps && s.reps.toString().trim() !== "" && s.weight && s.weight.toString().trim() !== "");
        const isDone = seriesData.length > 0 && allSetsDone;

        // 2. RÉCUPÉRATION DERNIÈRE PERF (C'est ce qui manquait !)
        // On vérifie si getLastPerf est bien importé en haut du fichier, sinon ça plantera pas mais ça sera vide.
        let lastPerfText = "✨ Première séance";
        if (typeof getLastPerf === 'function') {
            const lastPerfData = getLastPerf(ex.id);
            if (lastPerfData && lastPerfData.series && lastPerfData.series.length > 0) {
                // On cherche la meilleure série de la dernière fois
                const bestSet = lastPerfData.series.find(s => s.reps && s.weight);
                if (bestSet) {
                    lastPerfText = `Dernier : ${bestSet.reps} x ${bestSet.weight}kg`;
                }
            }
        }

        // 3. CALCUL 1RM INITIAL (Pour l'affichage au chargement)
        let best1RM = 0;
        seriesData.forEach(s => {
            const r = parseInt(s.reps);
            const w = parseFloat(s.weight);
            if (!isNaN(r) && !isNaN(w) && r > 0 && w > 0) {
                const rm = Math.round(w * (1 + r / 30));
                if (rm > best1RM) best1RM = rm;
            }
        });

        // 4. IMAGE (GIF)
        const imgHtml = ex.img ? 
            `<div class="w-full h-56 bg-white rounded-xl overflow-hidden mb-5 border border-slate-100 dark:border-slate-700 relative group">
                <img src="${ex.img}" alt="${ex.name}" class="w-full h-full object-contain mix-blend-multiply" onerror="this.style.display='none'">
             </div>` : '';

        // 5. LIGNES D'INPUTS (Avec les classes js-reps / js-weight)
        let rowsHtml = seriesData.map((s, i) => {
            const isSetDone = s.reps && s.reps.toString().trim() !== "" && s.weight && s.weight.toString().trim() !== "";
            const circleColor = isSetDone ? "bg-emerald-500 text-white border-emerald-500" : "bg-slate-100 dark:bg-slate-700 text-slate-400 border-transparent";

            return `
            <div class="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div id="circle-${ex.id}-${i}" class="w-8 h-8 rounded-full border-2 ${circleColor} text-sm flex items-center justify-center font-bold transition-colors duration-300">
                    ${i + 1}
                </div>
                
                <input type="tel" placeholder="Reps" value="${s.reps || ''}" 
                    class="js-reps bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center font-bold text-lg text-slate-800 dark:text-white outline-none focus:border-emerald-500 transition-colors w-full min-w-0"
                    oninput="updateSet('${ex.id}', ${i}, 'reps', this.value)">
                
                <input type="tel" placeholder="Kg" value="${s.weight || ''}" 
                    class="js-weight bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center font-bold text-lg text-slate-800 dark:text-white outline-none focus:border-emerald-500 transition-colors w-full min-w-0"
                    oninput="updateSet('${ex.id}', ${i}, 'weight', this.value)">
                
                ${i > 0 ? `<button onclick="removeSet('${ex.id}', ${i})" class="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors">✕</button>` : '<div class="w-8"></div>'} 
            </div>`;
        }).join('');

        return `
        <div id="card-${ex.id}" class="bg-white dark:bg-slate-850 rounded-[2rem] shadow-lg p-5 mb-8 border border-slate-100 dark:border-slate-700 relative transition-all ${isDone ? 'ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-slate-900' : ''}">
            
            <div class="flex flex-col mb-4 relative">
                <div class="absolute top-0 right-0 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 px-2.5 py-2 rounded-md text-[10px] font-black uppercase tracking-wide shadow-sm">
                    Obj : ${ex.sets} x ${ex.reps}
                </div>

                <h3 class="font-black text-xl text-slate-800 dark:text-white leading-tight w-[65%] mb-1">${ex.name}</h3>
                
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    ${lastPerfText.includes('Dernier') ? '⏱️' : ''} ${lastPerfText}
                </p>
            </div>

            ${imgHtml}

            <div class="grid grid-cols-[auto_1fr_1fr_auto] gap-2 mb-2 px-1">
                <div class="w-8"></div>
                <div class="text-[10px] font-bold text-slate-400 uppercase text-center">Répétitions</div>
                <div class="text-[10px] font-bold text-slate-400 uppercase text-center">Charge (kg)</div>
                <div class="w-8"></div>
            </div>

            <div id="rows-${ex.id}">${rowsHtml}</div>

            <div class="mt-4 flex gap-3">
                <button onclick="addSet('${ex.id}')" class="flex-1 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-500 dark:text-slate-400 hover:text-emerald-600 font-bold py-3 rounded-xl text-xs transition-colors border-2 border-dashed border-slate-200 dark:border-slate-700">+ AJOUTER SÉRIE</button>
            </div>

            <div class="mt-4 bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-100 dark:border-slate-700">
                <div class="relative">
                    <span class="absolute top-3 left-3 text-lg">📝</span>
                    <textarea rows="1" placeholder="Ajouter une note..." oninput="updateNote('${ex.id}', this.value)" class="w-full pl-10 bg-transparent rounded-lg p-3 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none placeholder-slate-400 resize-none overflow-hidden" style="min-height: 44px;">${savedNote}</textarea>
                </div>
                
                <div class="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg px-3 py-2 mt-1 mx-1 border border-slate-100 dark:border-slate-700">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max Théorique (1RM)</span>
                    <span id="rm-val-${ex.id}" class="text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">
                        ${best1RM > 0 ? best1RM + ' kg' : '--'}
                    </span>
                </div>
            </div>
        </div>`;
    }).join('');

    const btnText = isEditing ? "Mettre à jour" : "Terminer la séance";
    const btnColor = isEditing ? "bg-orange-600" : "bg-emerald-500";
    
    html += `
    <div id="finish-area" class="mt-8 pb-12 hidden fade-in">
        <button onclick="finishSession('${day}')" class="w-full ${btnColor} text-white font-bold py-4 rounded-2xl shadow-xl active:scale-95 transition-all text-sm uppercase tracking-widest">${btnText}</button>
        ${isEditing ? `<button onclick="cancelEdit()" class="mt-4 w-full text-xs text-slate-400 uppercase">Annuler</button>` : ''}
    </div>`;

    container.innerHTML = configHtml + html;
    updateProgressBar();
}

// --- AFFICHAGE HISTORIQUE ---
// --- AFFICHAGE HISTORIQUE COMPLET ---
export function renderHistory() {
    const container = document.getElementById('main-container');
    const history = getHistory(); 
    const totalSessions = history.length;

    // 1. GAMIFICATION
    const nextBadge = BADGES_CONFIG.find(b => b.count > totalSessions);
    const prevBadgeCount = BADGES_CONFIG.filter(b => b.count <= totalSessions).pop()?.count || 0;
    
    let progressPercent = 100;
    let progressText = "Niveau Max !";
    
    if (nextBadge) {
        const range = nextBadge.count - prevBadgeCount;
        const current = totalSessions - prevBadgeCount;
        progressPercent = Math.round((current / range) * 100);
        progressText = `Prochain badge dans ${nextBadge.count - totalSessions} séance(s)`;
    }

    // 👇 TITRE AJOUTÉ ICI 👇
    let statsHtml = `
    <h3 class="text-s font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Récompenses</h3>
    
    <div class="mb-8 bg-white dark:bg-slate-850 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 fade-in">
        <div class="flex justify-between items-end mb-4">
            <div>
                <span class="text-[15px] font-bold text-slate-400 uppercase tracking-widest">Total Séances</span>
                <h2 class="text-3xl font-black text-slate-800 dark:text-white">${totalSessions}</h2>
            </div>
            <div class="text-right">
                <span class="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">${progressText}</span>
            </div>
        </div>
        
        <div class="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-6">
            <div class="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000 ease-out" style="width: ${progressPercent}%"></div>
        </div>

        <div class="grid grid-cols-4 gap-2">
            ${BADGES_CONFIG.map(badge => {
                const isUnlocked = totalSessions >= badge.count;
                const styleClass = isUnlocked ? badge.color + ' opacity-100 scale-100' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-700 opacity-60 grayscale scale-90';
                
                return `
                <div class="flex flex-col items-center justify-center p-2 rounded-xl border ${styleClass} transition-all duration-300">
                    <span class="text-2xl mb-1 filter ${isUnlocked ? 'drop-shadow-md' : ''}">${badge.icon}</span>
                    <span class="text-[8px] font-bold uppercase tracking-wide">${badge.count}</span>
                </div>`;
            }).join('')}
        </div>
    </div>`;

    // 2. CALENDRIER
    const sessionsByDate = {};
    history.forEach(session => {
        const dateObj = new Date(session.created_at);
        const key = `${dateObj.getDate()}/${dateObj.getMonth()+1}/${dateObj.getFullYear()}`;
        if (!sessionsByDate[key]) sessionsByDate[key] = [];
        sessionsByDate[key].push(session);
    });

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    
    // Import dynamique (si utils n'est pas chargé, mais ici on l'a importé en haut donc on peut simplifier)
    // Pour rester cohérent avec ton code actuel, on utilise les fonctions importées en haut du fichier
    import('./utils.js').then(({ getDaysInMonth, getFirstDayOfMonth }) => {
        const daysInMonth = getDaysInMonth(month, year);
        const firstDayIndex = getFirstDayOfMonth(month, year);
        
        // 👇 TITRE AJOUTÉ ICI 👇
        let calendarHtml = `
        <h3 class="text-s font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1 mt-8">Calendrier</h3>

        <div class="mb-6 fade-in bg-white dark:bg-slate-850 rounded-3xl p-2.5 shadow-sm border border-slate-200 dark:border-slate-700">
            <div class="flex justify-between items-center mb-6 px-2">
                <button onclick="changeMonth(-1)" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">◀</button>
                <h2 class="text-xl font-black text-slate-800 dark:text-white capitalize">${monthNames[month]} <span class="text-emerald-500">${year}</span></h2>
                <button onclick="changeMonth(1)" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">▶</button>
            </div>

            <div class="grid grid-cols-7 gap-1 text-center mb-2">
                ${['L','M','M','J','V','S','D'].map(d => `<span class="text-[10px] font-bold text-slate-400">${d}</span>`).join('')}
            </div>

            <div class="grid grid-cols-7 gap-2">
        `;

        for (let i = 0; i < firstDayIndex; i++) calendarHtml += `<div></div>`;

        const today = new Date();
        const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${day}/${month+1}/${year}`;
            const hasSession = sessionsByDate[dateKey];
            const isToday = isCurrentMonth && day === today.getDate();
            const isSelected = selectedDateKey === dateKey;

            let bgClass = "bg-slate-50 dark:bg-slate-900 text-slate-400"; // Légèrement plus foncé pour le fond du calendrier
            let borderClass = "border-transparent";

            if (hasSession) bgClass = "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/40 border-none";        
            if (isSelected) borderClass = "border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900";
            else if (isToday) borderClass = "border-slate-300 dark:border-slate-500";

            calendarHtml += `<button onclick="selectDate('${dateKey}')" class="w-full aspect-square rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${bgClass} ${borderClass}">${day}</button>`;
        }
        calendarHtml += `</div></div>`;

        // 3. DÉTAILS SÉANCE
        let detailsHtml = "";
        if (selectedDateKey && sessionsByDate[selectedDateKey]) {
            // 👇 TITRE AJOUTÉ ICI 👇
            detailsHtml = `<div class="fade-in space-y-4 pb-20 mt-8">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Détail du ${selectedDateKey}</h3>
                ${sessionsByDate[selectedDateKey].map(session => renderSessionCard(session)).join('')}
            </div>`;
        } else if (selectedDateKey) {
            detailsHtml = `<div class="text-center py-10 text-slate-400 fade-in mt-4">Aucune séance ce jour-là 💤</div>`;
        } else {
            detailsHtml = `<div class="text-center py-10 text-slate-400 text-xs italic mt-4">Sélectionne un jour vert pour voir les détails</div>`;
        }

        container.innerHTML = statsHtml + calendarHtml + detailsHtml;
    });
}

function renderSessionCard(session) {
    // Cette fonction génère le HTML d'une "carte" de séance dans l'historique
    // Identique à ton design précédent mais encapsulé proprement
    return `
    <div class="bg-white dark:bg-slate-850 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 p-5 relative overflow-hidden">
        <div class="flex justify-between items-start mb-4">
            <div>
                <h3 class="font-black text-slate-800 dark:text-white text-lg leading-tight uppercase">${session.day}</h3>
                <div class="text-xs text-slate-400 font-bold mt-1">${session.exercises.length} Exercices</div>
            </div>
            <button onclick="deleteSession('${session.id}')" class="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>

        <div class="space-y-3">
            ${(Array.isArray(session.exercises) ? session.exercises : []).map(ex => {
                const detailText = Array.isArray(ex.series) 
                    ? ex.series.map(s => `<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold">${s.reps}x${s.weight}</span>`).join(' ') 
                    : `${ex.sets}x${ex.reps} @ ${ex.weight}kg`;
                
                return `
                <div class="flex flex-col gap-1 border-b border-slate-50 dark:border-slate-800 last:border-0 pb-2 last:pb-0">
                    <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${ex.name}</span>
                    <div class="flex flex-wrap gap-1">${detailText}</div>
                    ${ex.note ? `<div class="text-[10px] text-slate-400 italic">"${ex.note}"</div>` : ''}
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

// --- BARRE DE PROGRESSION (REMISE ICI) ---
export function updateProgressBar() {
    if (localStorage.getItem('lastTab') === 'HISTORIQUE') {
        const bar = document.getElementById('progress-bar');
        if(bar) bar.style.width = '0%';
        return;
    }

    const activeData = getActiveSession();
    const tab = localStorage.getItem('lastTab');
    const exercises = workouts[tab];
    
    if (!exercises || exercises.length === 0) return;

    let totalExercises = exercises.length;
    let completedExercises = 0;

    exercises.forEach(ex => {
        const exData = activeData[ex.id];
        // Condition STRICTE : Il faut que TOUTES les séries de l'exo soient remplies
        if (exData && exData.series && exData.series.length > 0) {
            const allSetsDone = exData.series.every(s => 
                s.reps && s.reps.toString().trim() !== "" && 
                s.weight && s.weight.toString().trim() !== ""
            );
            
            if (allSetsDone) {
                completedExercises++;
                const card = document.getElementById(`card-${ex.id}`);
                if(card) card.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2', 'dark:ring-offset-slate-900');
            } else {
                const card = document.getElementById(`card-${ex.id}`);
                if(card) card.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2', 'dark:ring-offset-slate-900');
            }
        }
    });

    const percent = Math.round((completedExercises / totalExercises) * 100);
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = `${percent}%`;

    const finishArea = document.getElementById('finish-area');
    if (finishArea) {
        if (percent === 100) {
            finishArea.classList.remove('hidden');
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
                finishArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            finishArea.classList.add('hidden');
        }
    }
}

// Helpers UI
export function toggleDetails(id) {
    document.getElementById(`hist-details-${id}`).classList.toggle('hidden');
}

export function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.remove('translate-y-4', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
    }, 2000);
}

// --- MISE À JOUR HEADER (SALUTATION) ---
export function updateHeaderGreeting(name, avatarUrl) {
    const greetingEl = document.getElementById('user-greeting');
    
    // 1. Liste des messages aléatoires
    const greetings = [
        "Bon retour !",
        "Bonne séance !",
        "Prêt à tout casser ?",
        "Salut ! ",
    ];
    
    // 2. On choisit un message au hasard
    const randomMsg = greetings[Math.floor(Math.random() * greetings.length)];

    if (greetingEl) {
        // 3. Construction du HTML : Avatar à gauche, Texte (Message + Prénom) à droite
        const avatarHtml = avatarUrl 
            ? `<img src="${avatarUrl}" class="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm group-hover:scale-105 transition-transform">` 
            : `<div class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 font-black flex items-center justify-center border-2 border-emerald-200 group-hover:scale-105 transition-transform">${name[0]}</div>`;

        greetingEl.innerHTML = `
        <div onclick="openProfileModal()" class="flex items-center gap-3 cursor-pointer group">
            ${avatarHtml}
            <div class="flex flex-col items-start justify-center">
                <span class="text-[11px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">${randomMsg}</span>
                <span class="text-[17px] text-sm font-black text-emerald-500 leading-none">${name}</span>
            </div>
        </div>`;
    }

    // Mise à jour de la date (inchangé)
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.innerText = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
}

// --- BASCULE AUTHENTIFICATION (LOGIN / SIGNUP) ---
export function toggleAuthMode() {
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btnLogin = document.getElementById('btn-login');
    const btnSignup = document.getElementById('btn-signup');
    const identityFields = document.getElementById('register-identity');
    const confirmField = document.getElementById('register-confirm');
    const toggleText = document.getElementById('toggle-text');
    const toggleBtn = document.getElementById('toggle-btn');
    const errorMsg = document.getElementById('auth-error');

    // On regarde si les champs d'inscription sont cachés pour savoir dans quel mode on est
    const isLoginMode = identityFields.classList.contains('hidden');

    // On cache les erreurs précédentes pour faire propre
    if(errorMsg) errorMsg.classList.add('hidden');

    if (isLoginMode) {
        // 👉 PASSAGE EN MODE INSCRIPTION
        title.innerText = "Créer un compte";
        subtitle.innerText = "Rejoins l'aventure GymTracker !";
        
        // Boutons
        btnLogin.classList.add('hidden');
        btnSignup.classList.remove('hidden');
        
        // Champs supplémentaires
        identityFields.classList.remove('hidden');
        confirmField.classList.remove('hidden');
        
        // Texte du bas
        toggleText.innerText = "Déjà un compte ?";
        toggleBtn.innerText = "Se connecter";
    } else {
        // 👉 PASSAGE EN MODE CONNEXION
        title.innerText = "Connexion";
        subtitle.innerText = "Retrouve ton historique.";
        
        // Boutons
        btnLogin.classList.remove('hidden');
        btnSignup.classList.add('hidden');
        
        // Champs supplémentaires
        identityFields.classList.add('hidden');
        confirmField.classList.add('hidden');
        
        // Texte du bas
        toggleText.innerText = "Pas encore de compte ?";
        toggleBtn.innerText = "S'inscrire";
    }
}


// --- MISE À JOUR 1RM (AVEC DEBUG) ---
export function update1RMDisplay(exId) {

    // 1. Trouver le conteneur des lignes grâce à l'ID ajouté dans renderWorkout
    const container = document.getElementById(`rows-${exId}`);
    if (!container) {
        return;
    }

    // 2. Récupérer les inputs par classe
    const repsList = container.querySelectorAll('.js-reps');
    const weightList = container.querySelectorAll('.js-weight');

    let best1RM = 0;

    for (let i = 0; i < repsList.length; i++) {
        const r = parseInt(repsList[i].value);
        const w = parseFloat(weightList[i].value);

        // Debug de chaque ligne 

        if (!isNaN(r) && !isNaN(w) && r > 0 && w > 0) {
            const rm = Math.round(w * (1 + r / 30));
            if (rm > best1RM) best1RM = rm;
        }
    }

    // 3. Affichage
    const display = document.getElementById(`rm-val-${exId}`);
    if (display) {
        display.innerText = best1RM > 0 ? best1RM + ' kg' : '--';
        
        // Petit flash visuel pour confirmer que ça marche
        display.style.opacity = "0.2";
        setTimeout(() => display.style.opacity = "1", 200);
    } else {
    }
}

// --- MODALE DE CONFIRMATION PERSONNALISÉE ---
export function openConfirmModal(title, text, onConfirmAction) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const textEl = document.getElementById('confirm-text');
    const btnYes = document.getElementById('btn-confirm-yes');
    const btnNo = document.getElementById('btn-confirm-no');

    if (!modal) return;

    // 1. Remplissage des textes
    titleEl.innerText = title;
    textEl.innerText = text;

    // 2. Gestion du clic sur OUI
    // On écrase l'ancien onclick pour ne pas exécuter les actions précédentes
    btnYes.onclick = () => {
        onConfirmAction(); // Exécute l'action passée en paramètre
        modal.classList.add('hidden'); // Ferme la modale
    };

    // 3. Gestion du clic sur NON
    btnNo.onclick = () => {
        modal.classList.add('hidden');
    };

    // 4. Affichage
    modal.classList.remove('hidden');
}
