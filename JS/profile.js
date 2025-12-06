import { supabase } from './supabase.js';
import { currentUser } from './state.js';
import { showToast, updateHeaderGreeting } from './ui.js';

// --- OUVERTURE MODALE ---
export async function openProfileModal() {
    document.getElementById('profile-modal').classList.remove('hidden');
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        // Fallback si first_name est vide
        const displayName = profile.first_name ? `${profile.first_name} ${profile.last_name || ''}` : profile.email;
        document.getElementById('profile-name').innerText = displayName;
        document.getElementById('profile-email').innerText = profile.email;
        updateAvatarPreview(profile.avatar_url, profile.first_name || profile.email);
    }
}

// --- FONCTION MAGIQUE : COMPRESSION ---
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // On fixe une taille max raisonnable pour un avatar
                const MAX_WIDTH = 500;
                const MAX_HEIGHT = 500;
                
                let width = img.width;
                let height = img.height;

                // Calcul du ratio pour garder les proportions
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Conversion en Blob (Fichier léger) - Qualité 0.7 (70%)
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// --- UPLOAD ---
export async function uploadAvatar(input) {
    const originalFile = input.files[0];
    if (!originalFile) return;

    const loading = document.getElementById('avatar-loading');
    loading.classList.remove('hidden');

    try {
        // 1. COMPRESSION (On transforme le gros fichier en petit fichier)
        console.log("Compression en cours...");
        const compressedFile = await compressImage(originalFile);
        console.log(`Taille avant: ${originalFile.size} / Après: ${compressedFile.size}`);

        // 2. NETTOYAGE (Supprimer les anciennes photos)
        const { data: listFiles } = await supabase.storage
            .from('avatars')
            .list(currentUser.id + '/');

        if (listFiles && listFiles.length > 0) {
            const filesToRemove = listFiles.map(x => `${currentUser.id}/${x.name}`);
            await supabase.storage.from('avatars').remove(filesToRemove);
        }

        // 3. UPLOAD (On utilise toujours .jpg car on a converti)
        const fileName = `${currentUser.id}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, compressedFile, { upsert: true });

        if (uploadError) throw uploadError;

        // 4. URL
        const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;

        // 5. MISE À JOUR PROFIL (C'est là que l'erreur RLS arrivait)
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', currentUser.id);

        if (updateError) throw updateError;

        // 6. SUCCÈS
        showToast("Photo mise à jour ! 😎");
        updateAvatarPreview(publicUrl);
        
        const firstName = document.getElementById('profile-name').innerText.split(' ')[0];
        updateHeaderGreeting(firstName, publicUrl);

    } catch (error) {
        console.error(error);
        alert("Erreur : " + error.message);
    } finally {
        loading.classList.add('hidden');
    }
}

function updateAvatarPreview(url, firstName = "?") {
    const container = document.getElementById('profile-preview');
    if (url) {
        // On ajoute un timestamp pour forcer le rafraichissement de l'image
        container.innerHTML = `<img src="${url}?t=${Date.now()}" class="w-full h-full object-cover">`;
    } else {
        container.innerHTML = `<span class="text-4xl font-bold text-slate-400">${firstName[0]}</span>`;
    }
}