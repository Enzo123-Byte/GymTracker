import { searchUsers, sendFriendRequest, getFriendships, acceptFriendRequest, getSocialFeed, deleteFriendship } from './social.js';
import { currentUser } from './state.js';

let currentSocialTab = 'FEED';
let feedCache = []; 


// --- HELPER : GÉNÉRER L'HTML DE L'AVATAR ---
function getAvatarHTML(url, firstName) {
    if (url) {
        // Si URL existe -> IMAGE
        return `<img src="${url}" class="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-600 bg-slate-100">`;
    } else {
        // Sinon -> ROND AVEC LETTRE
        return `<div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center font-bold text-sm border border-transparent">${firstName[0]}</div>`;
    }
}

export function openSocialModal() {
    document.getElementById('social-modal').classList.remove('hidden');
    // On force le rafraichissement sur l'onglet par défaut ou actuel
    switchSocialTab('FEED');
}

export function switchSocialTab(tab) {
    currentSocialTab = tab;
    const btnFeed = document.getElementById('tab-btn-feed');
    const btnFriends = document.getElementById('tab-btn-friends');
    
    if (tab === 'FEED') {
        btnFeed.className = "text-sm font-bold text-emerald-500 border-b-2 border-emerald-500 pb-1 w-1/2 text-center";
        btnFriends.className = "text-sm font-bold text-slate-400 pb-1 w-1/2 text-center hover:text-slate-600";
        renderFeed();
    } else {
        btnFeed.className = "text-sm font-bold text-slate-400 pb-1 w-1/2 text-center hover:text-slate-600";
        btnFriends.className = "text-sm font-bold text-emerald-500 border-b-2 border-emerald-500 pb-1 w-1/2 text-center";
        renderFriendsList();
    }
}

// --- AFFICHAGE DU FEED ---
async function renderFeed() {
    const container = document.getElementById('social-list');
    
    if (feedCache.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 text-xs mt-10 animate-pulse">Chargement de l'actu...</div>`;
        const feedData = await getSocialFeed();
        feedCache = feedData || []; 
    }

    if (!feedCache || feedCache.length === 0) {
        container.innerHTML = `<div class="text-center py-10 opacity-60"><div class="text-4xl mb-2">📭</div><p class="text-xs text-slate-500">Aucune activité récente.</p></div>`;
        return;
    }

    container.innerHTML = feedCache.map((post, index) => {
        const date = new Date(post.created_at);
        const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute:'2-digit' });
        const exos = post.session_summary || [];
        const exoCount = exos.length;
        const bestExo = exos[0]?.name || "Entraînement";
        const isMe = post.user_id === currentUser.id;

        return `
        <div onclick="openFeedDetails(${index})" class="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 mb-3 shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
            <div class="flex items-center gap-3 mb-3">
                
                ${getAvatarHTML(post.avatar_url, post.first_name)}
                
                <div>
                    <div class="text-sm font-bold text-slate-800 dark:text-white group-hover:text-emerald-500 transition-colors">
                        ${isMe ? 'Vous' : post.first_name + ' ' + post.last_name}
                    </div>
                    <div class="text-[10px] text-slate-400">${dateStr}</div>
                </div>
            </div>
            
            <div class="pl-13">
                <div class="text-xs text-slate-600 dark:text-slate-300 mb-2">
                    A terminé la séance <span class="font-bold text-slate-900 dark:text-white uppercase">${post.program_name}</span>
                </div>
                
                <div class="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div class="flex items-center gap-2 text-xs font-bold text-emerald-500">
                        <span>🔥 ${exoCount} Exercices</span>
                        <span class="text-slate-300">•</span>
                        <span class="text-slate-500 truncate max-w-[100px]">${bestExo}...</span>
                    </div>
                    <span class="text-slate-400 text-xs">Voir ➜</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

// --- OUVERTURE DÉTAILS ---
export function openFeedDetails(index) {
    const post = feedCache[index];
    if (!post) return;

    document.getElementById('feed-detail-title').innerText = post.program_name;
    const isMe = post.user_id === currentUser.id;
    const name = isMe ? "Vous" : `${post.first_name} ${post.last_name}`;
    document.getElementById('feed-detail-subtitle').innerText = `Séance réalisée par ${name}`;

    const list = document.getElementById('feed-detail-list');
    const exos = post.session_summary || [];

    if (exos.length === 0) {
        list.innerHTML = `<p class="text-center text-slate-500 text-sm">Aucun détail disponible.</p>`;
    } else {
        list.innerHTML = exos.map(ex => `
            <div class="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-sm text-slate-800 dark:text-white w-[70%]">${ex.name}</h4>
                </div>
                <div class="flex items-center gap-2">
                    <span class="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-2 py-1 rounded">
                        ${ex.sets} séries
                    </span>
                    <span class="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        ${ex.reps} reps ${ex.weight ? `@ ${ex.weight}kg` : ''}
                    </span>
                </div>
                ${ex.feel ? `<p class="text-[10px] text-slate-400 mt-2 italic">"${ex.feel}"</p>` : ''}
            </div>
        `).join('');
    }

    document.getElementById('feed-details-modal').classList.remove('hidden');
}

// --- AMIS ---
// --- AMIS ---
async function renderFriendsList() {
    const container = document.getElementById('social-list');
    
    // On met un petit loader le temps que ça arrive
    // (Note: on ne vide pas tout de suite si on veut éviter le clignotement, mais pour le debug c'est mieux)
    
    const { friends, requests } = await getFriendships();
    
    // Debug pour être sûr
    console.log("Rendu liste amis avec :", friends);

    let html = "";

    // 1. Demandes en attente
    if (requests.length > 0) {
        html += `<div class="mb-4"><h4 class="text-[10px] font-bold text-orange-500 uppercase mb-2">Demandes (${requests.length})</h4>`;
        requests.forEach(req => html += `
            <div class="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl flex justify-between items-center mb-2">
                <div class="flex items-center gap-3">
                    ${getAvatarHTML(req.avatar_url, req.first_name)}
                    <span class="font-bold text-sm text-slate-800 dark:text-white">${req.first_name} ${req.last_name}</span>
                </div>
                <button onclick="acceptRequest('${req.friendship_id}')" class="bg-orange-500 text-white text-xs px-3 py-1.5 rounded-lg">Accepter</button>
            </div>`);
        html += `</div>`;
    }

    // 2. Liste des Amis
    html += `<h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Mes Amis (${friends.length})</h4>`;
    
    if (friends.length === 0) {
        html += `<div class="text-center py-8 text-xs text-slate-400">Aucun ami pour l'instant.</div>`;
    } else {
        friends.forEach(friend => {
            html += `
            <div class="bg-white dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center mb-2">
                <div class="flex items-center gap-3">
                    ${getAvatarHTML(friend.avatar_url, friend.first_name)}
                    
                    <div class="font-bold text-sm text-slate-800 dark:text-white">${friend.first_name} ${friend.last_name}</div>
                </div>
                
                <button onclick="removeFriend('${friend.friendship_id}', '${friend.first_name}')" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    ✕
                </button>
            </div>`;
        });
    }
    container.innerHTML = html;
}

export async function handleUserSearch() {
    const query = document.getElementById('social-search').value.trim();
    const resultsContainer = document.getElementById('search-results');
    if (query.length < 3) { resultsContainer.classList.add('hidden'); return; }
    const users = await searchUsers(query);
    if (users.length > 0) {
        resultsContainer.innerHTML = users.map(u => `<div class="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex justify-between items-center cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"><span class="text-sm font-bold text-slate-700 dark:text-slate-200">${u.first_name} ${u.last_name}</span><button onclick="addFriend('${u.id}')" class="text-[10px] bg-slate-100 dark:bg-slate-600 px-2 py-1 rounded text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 transition-colors">Ajouter</button></div>`).join('');
        resultsContainer.classList.remove('hidden');
    } else {
        resultsContainer.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">Aucun résultat</div>`;
        resultsContainer.classList.remove('hidden');
    }
}

// --- HELPERS (BINDING HTML) ---
export function refreshSocialUI() {
    feedCache = []; // On vide le cache
    if (currentSocialTab === 'FEED') {
        document.getElementById('social-list').innerHTML = `<div class="text-center text-slate-400 text-xs mt-10 animate-pulse">Mise à jour...</div>`;
    }
    switchSocialTab(currentSocialTab);
}

export function addFriend(id) { sendFriendRequest(id); }
export function acceptRequest(id) { acceptFriendRequest(id); }

// 👇 C'ÉTAIT CELLE-LÀ QUI MANQUAIT 👇
export function removeFriend(id, name) {
    if(confirm(`Retirer ${name} de tes amis ?`)) {
        deleteFriendship(id);
    }
}