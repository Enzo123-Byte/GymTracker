import { supabase } from './supabase.js';
import { currentUser } from './state.js';
import { showToast } from './ui.js';

// --- 1. RECHERCHE UTILISATEURS ---
// --- RECHERCHE AVEC DEBUG ---
export async function searchUsers(query) {
    const cleanQuery = query.trim();
    

    if (cleanQuery.length < 3) {
        return [];
    }


    const { data, error } = await supabase
        .rpc('search_profiles_secure', { search_term: cleanQuery });

    if (error) {
        return [];
    }

    return data;
}

// --- 2. ENVOYER DEMANDE ---
export async function sendFriendRequest(targetId) {
    const { error } = await supabase
        .from('friendships')
        .insert([{ requester_id: currentUser.id, receiver_id: targetId }]);

    if (error) {
        if (error.code === '23505' || error.status === 409) { 
            showToast("⚠️ Déjà demandé !");
        } else {
            alert("Erreur : " + error.message);
        }
    } else {
        showToast("Demande envoyée ! 📩");
        const searchInput = document.getElementById('social-search');
        const results = document.getElementById('search-results');
        if(searchInput) searchInput.value = "";
        if(results) results.classList.add('hidden');
    }
}

// --- 3. RÉCUPÉRER AMIS & DEMANDES ---
export async function getFriendships() {
    const { data, error } = await supabase
        .from('friendships')
        .select(`
            id, 
            status, 
            requester_id, 
            receiver_id,
            requester:profiles!friendships_requester_id_fkey(first_name, last_name, avatar_url),
            receiver:profiles!friendships_receiver_id_fkey(first_name, last_name, avatar_url)
        `) // 👆 VÉRIFIE BIEN QUE avatar_url EST ÉCRIT DEUX FOIS ICI
        .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

    if (error) {
        console.error("Erreur récupération amis:", error);
        return { friends: [], requests: [] };
    }

    const friends = [];
    const requests = [];

    data.forEach(rel => {
        if (rel.status === 'accepted') {
            // C'est un ami
            let friendProfile = rel.requester_id === currentUser.id ? rel.receiver : rel.requester;
            
            if (friendProfile) {
                friendProfile.friendship_id = rel.id; 
                friends.push(friendProfile);
            }
            
        } else if (rel.status === 'pending' && rel.receiver_id === currentUser.id) {
            // C'est une demande
            if(rel.requester) {
                requests.push({
                    friendship_id: rel.id,
                    ...rel.requester // Récupère first_name, last_name ET avatar_url
                });
            }
        }
    });

    return { friends, requests };
}

// --- 4. ACCEPTER DEMANDE ---
export async function acceptFriendRequest(friendshipId) {
    const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

    if (!error) {
        showToast("Nouvel ami ajouté ! 🎉");
        if (typeof window.refreshSocialUI === 'function') window.refreshSocialUI();
    }
}

// --- 5. SUPPRIMER AMI ---
export async function deleteFriendship(friendshipId) {
    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

    if (!error) {
        showToast("Ami retiré.");
        if (typeof window.refreshSocialUI === 'function') window.refreshSocialUI();
    } else {
        alert("Erreur suppression: " + error.message);
    }
}

// --- 6. RÉCUPÉRER LE FEED ---
export async function getSocialFeed() {
    // La fonction SQL get_social_feed renvoie déjà avatar_url, donc pas de souci ici
    const { data, error } = await supabase.rpc('get_social_feed');

    if (error) {
        console.error("Erreur feed:", error);
        return [];
    }
    return data;
}