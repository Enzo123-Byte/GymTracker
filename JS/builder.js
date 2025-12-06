import { supabase } from './supabase.js';
import { currentUser } from './state.js';
import { workouts } from './config.js';
import { showToast, openConfirmModal } from './ui.js'; // Ajoute openConfirmModal
// --- VARIABLES LOCALES ---
let libraryCache = []; // Cache pour ne pas recharger la DB à chaque clic
let selectedExercises = new Set(); // Pour le Builder (Création)
let currentManagerProgram = null; // Pour le Manager (Édition)

// ==========================================
// 1. PARTIE BUILDER (CRÉATION DE PROGRAMME)
// ==========================================

export async function openBuilder() {
    document.getElementById('builder-modal').classList.remove('hidden');
    
    // Si la librairie est vide, on la charge depuis Supabase
    if (libraryCache.length === 0) {
        const { data, error } = await supabase
            .from('exercises')
            .select('*')
            .order('name');
        
        if (!error && data) {
            libraryCache = data;
            renderBuilderList();
        } else {
            document.getElementById('builder-list').innerHTML = `<p class="text-red-500 text-center">Erreur de chargement.</p>`;
        }
    } else {
        renderBuilderList();
    }
}

export function renderBuilderList(listToRender = null) {
    // Si aucune liste n'est fournie, on prend tout le cache
    const list = listToRender || libraryCache;
    const container = document.getElementById('builder-list');
    
    if (list.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs italic">Aucun exercice trouvé.</div>`;
        return;
    }

    container.innerHTML = list.map(ex => {
        const isSelected = selectedExercises.has(ex.id);
        return `
        <div onclick="toggleBuilderSelection('${ex.id}')" class="flex items-center gap-4 p-3 mb-2 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/20 dark:border-emerald-500' : 'bg-white dark:bg-slate-850 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}">
            <div class="w-12 h-12 rounded-lg bg-white p-1 overflow-hidden border border-slate-100 flex-shrink-0">
                <img src="${ex.img_url}" class="w-full h-full object-contain mix-blend-multiply" loading="lazy">
            </div>
            <div class="flex-1">
                <h4 class="font-bold text-sm text-slate-800 dark:text-white leading-tight">${ex.name}</h4>
                <span class="text-[10px] text-slate-400 uppercase tracking-wide bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">${ex.category}</span>
            </div>
            <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}">
                ${isSelected ? '✓' : ''}
            </div>
        </div>`;
    }).join('');
    
    document.getElementById('builder-count').innerText = selectedExercises.size;
}

export function filterBuilderList() {
    const term = document.getElementById('builder-search').value.toLowerCase();
    const category = document.getElementById('builder-category').value;
    
    const filtered = libraryCache.filter(ex => {
        // 1. Filtre par texte (Nom)
        const matchesText = ex.name.toLowerCase().includes(term);
        
        // 2. Filtre par catégorie (Si "ALL", on prend tout, sinon on vérifie l'égalité)
        const matchesCategory = category === "ALL" || ex.category === category;

        return matchesText && matchesCategory;
    });
    
    renderBuilderList(filtered);
}

export function toggleBuilderSelection(id) {
    if (selectedExercises.has(id)) {
        selectedExercises.delete(id);
    } else {
        selectedExercises.add(id);
    }
    renderBuilderList();
}

export async function saveNewProgram() {
    const name = document.getElementById('builder-name').value.trim();
    if (!name) return alert("Donne un nom à ton programme !");
    if (selectedExercises.size === 0) return alert("Sélectionne au moins 1 exercice !");

    const exerciseIds = Array.from(selectedExercises);

    const { error } = await supabase
        .from('user_programs')
        .insert([{
            user_id: currentUser.id,
            name: name,
            exercises: exerciseIds
        }])
        .select();

    if (error) {
        showToast("Erreur : " + error.message);
    } else {
        showToast("Programme créé ! 🎉");
        document.getElementById('builder-modal').classList.add('hidden');
        document.getElementById('builder-name').value = "";
        selectedExercises.clear();
        window.location.reload();
    }
}

// ==========================================
// 2. PARTIE MANAGER (MODIFICATION PROGRAMME)
// ==========================================

export async function openProgramManager(programName) {
    const { data, error } = await supabase
        .from('user_programs')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('name', programName)
        .single();

    if (error || !data) {
        alert("Erreur: Impossible de charger les données du programme.");
        return;
    }

    currentManagerProgram = data;
    
    document.getElementById('manager-name').value = data.name;
    document.getElementById('manager-original-name').value = data.name;
    
    const container = document.getElementById('manager-list');
    container.innerHTML = '';

    const exercisesDetails = workouts[programName];

    if(exercisesDetails) {
        exercisesDetails.forEach((ex, idx) => {
            container.innerHTML += `
            <div class="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-3" id="mgr-item-${idx}">
                <div class="flex justify-between items-center">
                    <span class="font-bold text-sm text-slate-700 dark:text-slate-200 truncate w-[80%]">${ex.name}</span>
                    <button onclick="removeManagerItem(${idx})" class="text-red-400 text-xs font-bold hover:text-red-600">✕</button>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[9px] text-slate-400 uppercase">Séries</label>
                        <input type="number" class="mgr-sets w-full bg-white dark:bg-slate-900 rounded-lg p-1.5 text-center font-bold text-sm outline-none border focus:border-emerald-500" value="${ex.sets}">
                    </div>
                    <div>
                        <label class="text-[9px] text-slate-400 uppercase">Reps</label>
                        <input type="text" class="mgr-reps w-full bg-white dark:bg-slate-900 rounded-lg p-1.5 text-center font-bold text-sm outline-none border focus:border-emerald-500" value="${ex.reps}">
                    </div>
                </div>
                <input type="hidden" class="mgr-id" value="${ex.id}">
            </div>
            `;
        });
    }

    document.getElementById('manager-modal').classList.remove('hidden');
}

export function removeManagerItem(idx) {
    const item = document.getElementById(`mgr-item-${idx}`);
    if(item) item.remove();
}

export async function saveManagerChanges() {
    const newName = document.getElementById('manager-name').value.trim();
    const originalName = document.getElementById('manager-original-name').value;
    
    if (!newName) return alert("Le nom ne peut pas être vide.");

    const items = document.querySelectorAll('#manager-list > div');
    const newExercisesList = [];

    items.forEach(div => {
        const id = div.querySelector('.mgr-id').value;
        const sets = div.querySelector('.mgr-sets').value;
        const reps = div.querySelector('.mgr-reps').value;
        
        newExercisesList.push({
            id: id,
            sets: parseInt(sets),
            reps: reps
        });
    });

    if (newExercisesList.length === 0) return alert("Le programme ne peut pas être vide.");

    const { error } = await supabase
        .from('user_programs')
        .update({ name: newName, exercises: newExercisesList })
        .eq('id', currentManagerProgram.id);

    if (error) {
        alert("Erreur sauvegarde: " + error.message);
    } else {
        showToast("Programme modifié !");
        document.getElementById('manager-modal').classList.add('hidden');
        if (newName !== originalName) {
            localStorage.setItem('lastTab', newName);
        }
        window.location.reload();
    }
}

export async function deleteCustomProgram() {
    if (!confirm("Vraiment supprimer ce programme définitivement ?")) return;
    
    const { error } = await supabase
        .from('user_programs')
        .delete()
        .eq('id', currentManagerProgram.id);

    if (error) {
        alert("Erreur suppression: " + error.message);
    } else {
        showToast("Programme supprimé.");
        localStorage.setItem('lastTab', 'PUSH');
        window.location.reload();
    }
}

// ==========================================
// 3. PARTIE SELECTEUR (AJOUT RAPIDE)
// ==========================================

export function openExerciseSelector() {
    if (libraryCache.length === 0) {
        loadLibraryForSelector();
    } else {
        renderSelectorList(libraryCache);
        document.getElementById('selector-modal').classList.remove('hidden');
    }
}

async function loadLibraryForSelector() {
    const { data, error } = await supabase.from('exercises').select('*').order('name');
    if (data) {
        libraryCache = data;
        renderSelectorList(libraryCache);
        document.getElementById('selector-modal').classList.remove('hidden');
    }
}

export function renderSelectorList(list) {
    const container = document.getElementById('selector-list');
    container.innerHTML = list.map(ex => `
        <div onclick="addExerciseToManager('${ex.id}')" class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
            <img src="${ex.img_url}" class="w-8 h-8 object-contain bg-white rounded p-0.5">
            <div>
                <div class="font-bold text-xs text-slate-800 dark:text-white">${ex.name}</div>
                <div class="text-[9px] text-slate-400 uppercase">${ex.category}</div>
            </div>
        </div>
    `).join('');
}

export function filterSelectorList() {
    const term = document.getElementById('selector-search').value.toLowerCase();
    const filtered = libraryCache.filter(ex => ex.name.toLowerCase().includes(term));
    renderSelectorList(filtered);
}

export function addExerciseToManager(exId) {
    const ex = libraryCache.find(e => e.id === exId);
    if (!ex) return;

    const tempIdx = Date.now(); 

    const html = `
        <div class="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-3 animate-pulse" id="mgr-item-${tempIdx}">
            <div class="flex justify-between items-center">
                <span class="font-bold text-sm text-slate-700 dark:text-slate-200 truncate w-[80%]">${ex.name}</span>
                <button onclick="removeManagerItem(${tempIdx})" class="text-red-400 text-xs font-bold hover:text-red-600">✕</button>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-[9px] text-slate-400 uppercase">Séries</label>
                    <input type="number" class="mgr-sets w-full bg-white dark:bg-slate-900 rounded-lg p-1.5 text-center font-bold text-sm outline-none border focus:border-emerald-500" value="3">
                </div>
                <div>
                    <label class="text-[9px] text-slate-400 uppercase">Reps</label>
                    <input type="text" class="mgr-reps w-full bg-white dark:bg-slate-900 rounded-lg p-1.5 text-center font-bold text-sm outline-none border focus:border-emerald-500" value="10-12">
                </div>
            </div>
            <input type="hidden" class="mgr-id" value="${ex.id}">
        </div>
    `;

    document.getElementById('manager-list').insertAdjacentHTML('beforeend', html);
    document.getElementById('selector-modal').classList.add('hidden');
    
    const list = document.getElementById('manager-list');
    list.scrollTop = list.scrollHeight;
}