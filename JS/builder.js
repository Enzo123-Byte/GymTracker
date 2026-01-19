import { supabase } from './supabase.js';
import { currentUser } from './state.js';
import { workouts} from './config.js';
import { showToast, openConfirmModal } from './ui.js';

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
        // On récupère aussi la colonne 'aliases' qu'on a créée
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
        // On rend tout visible au démarrage
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
        
        // ⚡️ MAGIE ICI : On prépare les tags cachés pour la recherche
        const aliases = ex.aliases || [];
        const searchTags = aliases.join(" ").toLowerCase();

        return `
        <div id="builder-item-${ex.id}" 
             data-tags="${searchTags}" 
             data-category="${ex.category}"
             onclick="toggleBuilderSelection('${ex.id}')" 
             class="flex items-center gap-4 p-3 mb-2 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/20 dark:border-emerald-500' : 'bg-white dark:bg-slate-850 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}">
            
            <div class="w-12 h-12 rounded-lg bg-white p-1 overflow-hidden border border-slate-100 flex-shrink-0">
                <img src="${ex.img_url}" class="w-full h-full object-contain mix-blend-multiply" loading="lazy">
            </div>
            
            <div class="flex-1">
                <h4 class="font-bold text-sm text-slate-800 dark:text-white leading-tight">${ex.name}</h4>
                <span class="text-[10px] text-slate-400 uppercase tracking-wide bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">${ex.category}</span>
            </div>
            
            <div class="check-circle w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}">
                ${isSelected ? '✓' : ''}
            </div>
        </div>`;
    }).join('');
    
    document.getElementById('builder-count').innerText = selectedExercises.size;
}

// 🚀 NOUVEAU FILTRE PUISSANT (DOM-BASED)
export function filterBuilderList() {
    const searchInput = document.getElementById('builder-search');
    const categoryInput = document.getElementById('builder-category');
    const builderList = document.getElementById('builder-list');

    if (!searchInput || !builderList) return;

    const term = searchInput.value.toLowerCase().trim();
    const category = categoryInput ? categoryInput.value : "ALL";
    
    // On travaille directement sur les éléments HTML pour la rapidité
    const items = Array.from(builderList.children);

    items.forEach(item => {
        // 1. Recherche Texte (Nom + Tags cachés)
        const name = item.querySelector('h4').textContent.toLowerCase();
        const tags = item.dataset.tags || ""; // Les alias sont ici !
        
        const matchesText = name.includes(term) || tags.includes(term);

        // 2. Recherche Catégorie
        const itemCategory = item.dataset.category;
        const matchesCategory = category === "ALL" || itemCategory === category;

        // Affichage / Masquage
        if (matchesText && matchesCategory) {
            item.classList.remove('hidden');
            item.style.display = ''; 
        } else {
            item.classList.add('hidden');
            item.style.display = 'none';
        }
    });
}

export function toggleBuilderSelection(id) {
    if (selectedExercises.has(id)) {
        selectedExercises.delete(id);
    } else {
        selectedExercises.add(id);
    }
    
    // OPTIMISATION : On met à jour juste l'élément cliqué sans tout recharger
    // Cela permet de garder le filtre actif !
    const item = document.getElementById(`builder-item-${id}`);
    if (item) {
        const isSelected = selectedExercises.has(id);
        const checkCircle = item.querySelector('.check-circle');

        if (isSelected) {
            item.className = "flex items-center gap-4 p-3 mb-2 rounded-xl border transition-all cursor-pointer bg-emerald-50 border-emerald-500 dark:bg-emerald-900/20 dark:border-emerald-500";
            checkCircle.className = "check-circle w-6 h-6 rounded-full border-2 flex items-center justify-center border-emerald-500 bg-emerald-500 text-white";
            checkCircle.innerText = "✓";
        } else {
            item.className = "flex items-center gap-4 p-3 mb-2 rounded-xl border transition-all cursor-pointer bg-white dark:bg-slate-850 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800";
            checkCircle.className = "check-circle w-6 h-6 rounded-full border-2 flex items-center justify-center border-slate-300 dark:border-slate-600";
            checkCircle.innerText = "";
        }
    }
    
    document.getElementById('builder-count').innerText = selectedExercises.size;
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
            // J'ai ajouté l'icône de poignée (drag-handle) à gauche 👇
            container.innerHTML += `
            <div class="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-3 group" id="mgr-item-${idx}">
                <div class="flex justify-between items-center gap-2">
                    
                    <div class="drag-handle cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-emerald-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </div>

                    <span class="font-bold text-sm text-slate-700 dark:text-slate-200 truncate flex-1">${ex.name}</span>
                    
                    <button onclick="removeManagerItem(${idx})" class="text-red-400 text-xs font-bold hover:text-red-600 p-1">✕</button>
                </div>
                <div class="grid grid-cols-2 gap-3 pl-8"> <div>
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

    // --- ACTIVATION DU DRAG & DROP ---
    // On vérifie si une instance existe déjà pour éviter les bugs, sinon on crée
    if (container._sortable) container._sortable.destroy();
    
    container._sortable = new Sortable(container, {
        animation: 150,           // Animation fluide (ms)
        handle: '.drag-handle',   // On ne peut déplacer qu'en attrapant la poignée (meilleur pour le mobile)
        ghostClass: 'bg-emerald-50', // Couleur de l'élément fantôme pendant le déplacement
    });
}

export async function shareProgramme(programName){
    const { data, error } = await supabase
        .from('user_programs')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('name', programName)
        .single();

    if (error || !data) {
        alert("Erreur: Impossible de charger les données du programme.");
        return;
    }
    if (typeof window.openFriendSelector === 'function') {
        window.openFriendSelector(data.id);
    } else {
        openFriendSelector(data.id);
    }
}   

const DOM_IDS = {
    MODAL: 'friend-modal',
    LIST: 'friend-list',
    SEARCH: 'friend-search'
};

// État local du module (State)
let state = {
    currentProgramId: null,
    friendsCache: []
};

// --- COUCHE SERVICE (Appels API) ---

/**
 * Récupère la liste des amis depuis la DB.
 * @returns {Promise<Array>} Liste d'amis ou tableau vide en cas d'erreur.
 */
async function fetchFriendsService() {
    const { data, error } = await supabase.rpc('get_my_friends_v3');
    if (error) {
        console.error("[FriendService] Erreur fetch:", error);
        throw new Error("Impossible de charger la liste d'amis.");
    }
    return data || [];
}

/**
 * Exécute le partage du programme.
 * @param {string} programId 
 * @param {string} friendId 
 */
async function shareProgramService(programId, friendId) {
    const { data, error } = await supabase.rpc('share_program_v3', {
        p_program_id: programId,
        p_friend_id: friendId
    });

    if (error || (data && !data.success)) {
        throw new Error(error?.message || data?.message || "Erreur inconnue");
    }
    return data;
}

// --- COUCHE VUE (Rendu HTML) ---

/**
 * Génère le HTML d'une ligne "Ami".
 * @param {Object} friend 
 * @returns {string} HTML string
 */
function createFriendItemHTML(friend) {
    const fullName = `${friend.first_name || ''} ${friend.last_name || ''}`.trim() || 'Ami sans nom';
    const initials = fullName.substring(0, 2).toUpperCase();
    const avatar = friend.avatar_url 
        ? `<img src="${friend.avatar_url}" class="w-full h-full object-cover">` 
        : initials;

    return `
    <div class="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-100 group">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-xs overflow-hidden border border-indigo-100 dark:border-indigo-800">
                ${avatar}
            </div>
            <div class="flex flex-col">
                <span class="font-bold text-sm text-slate-700 dark:text-slate-200">${fullName}</span>
            </div>
        </div>
        
        <button onclick="handleShareClick(this, '${friend.friend_id}')" 
                class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-white hover:bg-emerald-500 hover:border-emerald-500 p-2 rounded-lg transition-all shadow-sm active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
    </div>`;
}

/**
 * Met à jour le DOM avec la liste des amis.
 * @param {Array} friendsList 
 */
function renderFriendsList(friendsList) {
    const container = document.getElementById(DOM_IDS.LIST);
    if (!container) return;

    if (friendsList.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 opacity-50">
                <p class="text-3xl mb-2">🔍</p>
                <p class="text-sm font-medium">Aucun ami trouvé.</p>
            </div>`;
        return;
    }

    container.innerHTML = friendsList.map(createFriendItemHTML).join('');
}

// --- CONTROLLERS (Logique métier) ---

/**
 * Point d'entrée principal : Ouvre la modale et initialise les données.
 * @param {string} programId 
 */
export async function openFriendSelector(programId) {
    state.currentProgramId = programId; // Mise à jour du state
    
    const modal = document.getElementById(DOM_IDS.MODAL);
    const searchInput = document.getElementById(DOM_IDS.SEARCH);
    const listContainer = document.getElementById(DOM_IDS.LIST);

    if (!modal) return console.error("Modal introuvable dans le DOM");

    // 1. Reset UI
    modal.classList.remove('hidden');
    if (searchInput) {
        searchInput.value = "";
        searchInput.oninput = handleSearchInput; // Attachement de l'event listener
    }
    
    // 2. Loading State
    if (listContainer) {
        listContainer.innerHTML = `<div class="flex justify-center py-8"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div></div>`;
    }

    // 3. Fetch Data & Render
    try {
        state.friendsCache = await fetchFriendsService();
        renderFriendsList(state.friendsCache);
    } catch (err) {
        if (listContainer) listContainer.innerHTML = `<p class="text-red-400 text-center text-sm py-4">${err.message}</p>`;
    }
}

/**
 * Gère la recherche en temps réel (Filtrage client-side).
 * @param {Event} event 
 */
function handleSearchInput(event) {
    const term = event.target.value.toLowerCase();
    
    const filteredFriends = state.friendsCache.filter(friend => {
        const fullName = `${friend.first_name} ${friend.last_name}`.toLowerCase();
        return fullName.includes(term);
    });

    renderFriendsList(filteredFriends);
}

/**
 * Gère le clic sur le bouton "Envoyer".
 * Gère les états de chargement, succès et erreur du bouton.
 * @param {HTMLElement} btnElement 
 * @param {string} friendId 
 */
export async function handleShareClick(btnElement, friendId) {
    if (!state.currentProgramId) return alert("Erreur: Aucun programme sélectionné.");

    // UI: Loading State
    const originalContent = btnElement.innerHTML;
    btnElement.innerHTML = `<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>`;
    btnElement.disabled = true;

    try {
        await shareProgramService(state.currentProgramId, friendId);

        // UI: Success State
        btnElement.className = "bg-emerald-500 text-white p-2 rounded-lg shadow-md transform scale-105 transition-all";
        btnElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        // Fermeture automatique après délai
        setTimeout(() => {
            document.getElementById(DOM_IDS.MODAL)?.classList.add('hidden');
        }, 1200);

    } catch (error) {
        // UI: Error State
        console.error(error);
        alert(error.message);
        btnElement.innerHTML = originalContent; // Reset
        btnElement.disabled = false;
    }
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
    
    container.innerHTML = list.map(ex => {
        // On injecte les alias pour la recherche
        const aliases = ex.aliases || [];
        const searchTags = aliases.join(" ").toLowerCase();

        return `
        <div onclick="addExerciseToManager('${ex.id}')" 
             data-tags="${searchTags}"
             class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
            <img src="${ex.img_url}" class="w-16 h-16 object-contain bg-white rounded p-0.5">
            <div>
                <div class="font-bold text-xs text-slate-800 dark:text-white">${ex.name}</div>
                <div class="text-[9px] text-slate-400 uppercase">${ex.category}</div>
            </div>
        </div>
    `}).join('');
}

export function filterSelectorList() {
    const searchInput = document.getElementById('selector-search');
    const listContainer = document.getElementById('selector-list');

    if (!searchInput || !listContainer) return;

    const term = searchInput.value.toLowerCase().trim();
    const items = Array.from(listContainer.children);

    items.forEach(item => {
        // Recherche dans le Nom (texte visible)
        const nameDiv = item.querySelector('.font-bold'); // On cible le titre
        const name = nameDiv ? nameDiv.textContent.toLowerCase() : "";
        
        // Recherche dans les Tags (cachés)
        const tags = item.dataset.tags || "";

        if (name.includes(term) || tags.includes(term)) {
            item.classList.remove('hidden');
            item.style.display = '';
        } else {
            item.classList.add('hidden');
            item.style.display = 'none';
        }
    });
}

export function addExerciseToManager(exId) {
    const ex = libraryCache.find(e => e.id === exId);
    if (!ex) return;

    const tempIdx = Date.now(); 
    const html = `
        <div class="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-3 animate-pulse" id="mgr-item-${tempIdx}">
            <div class="flex justify-between items-center gap-2">
                
                <div class="drag-handle cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-emerald-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </div>

                <span class="font-bold text-sm text-slate-700 dark:text-slate-200 truncate flex-1">${ex.name}</span>
                <button onclick="removeManagerItem(${tempIdx})" class="text-red-400 text-xs font-bold hover:text-red-600 p-1">✕</button>
            </div>
            <div class="grid grid-cols-2 gap-3 pl-8">
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

export async function handleVisionSearch(input, mode = 'builder') {
    const file = input.files[0];
    if (!file) return;

    // 1. Déterminer quelle barre viser selon le mode
    let targetInputId = 'builder-search';
    let targetFilterFn = filterBuilderList; // La fonction importée plus haut

    if (mode === 'selector') {
        targetInputId = 'selector-search';
        targetFilterFn = filterSelectorList;
    }

    // 2. UI Loading
    const loader = document.getElementById('vision-loading'); // Assure-toi que ce loader est global ou dupliqué
    const searchInput = document.getElementById(targetInputId);
    
    // Si on est dans le selecteur et qu'il n'y a pas de loader dédié, on ignore ou on en crée un.
    if (loader) loader.classList.remove('hidden');
    
    if (searchInput) {
        searchInput.value = "Analyse en cours...";
        searchInput.disabled = true;
    }

    try {
        const base64Image = await convertToBase64(file);
        const exerciseName = await identifyExerciseWithAI(base64Image);

        if (exerciseName && searchInput) {
            const cleanedName = exerciseName.replace(/[".]/g, '');
            searchInput.value = cleanedName;
            showToast(`Trouvé : ${cleanedName} 🎯`);
            
            searchInput.disabled = false;
            
            // 3. On lance le bon filtre
            targetFilterFn(); 
        } else {
            throw new Error("Aucun exercice reconnu.");
        }

    } catch (error) {
        console.error(error);
        showToast("Erreur Vision : " + error.message);
        if (searchInput) searchInput.value = "";
    } finally {
        if (loader) loader.classList.add('hidden');
        if (searchInput) searchInput.disabled = false;
        input.value = ""; 
    }
}

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function identifyExerciseWithAI(base64Image) {
    console.log("Envoi de l'image à Supabase...");

    const { data, error } = await supabase.functions.invoke('identify-exercise', {
        body: { base64Image: base64Image }
    });

    if (error) {
        console.error("Erreur Edge Function:", error);
        throw new Error("Erreur serveur lors de l'analyse.");
    }
    
    return data.exerciseName ? data.exerciseName.trim() : null;
}

// ==========================================
// 5. INITIALISATION AUTOMATIQUE
// ==========================================

setTimeout(() => {
    // 1. Builder
    const builderInput = document.getElementById('builder-search');
    if (builderInput) {
        builderInput.removeEventListener('input', filterBuilderList);
        builderInput.addEventListener('input', filterBuilderList);
    }

    // 2. Selector (AJOUT)
    const selectorInput = document.getElementById('selector-search');
    if (selectorInput) {
        console.log("✅ Barre de recherche 'Selector' connectée.");
        selectorInput.removeEventListener('input', filterSelectorList);
        selectorInput.addEventListener('input', filterSelectorList);
    }
}, 500);