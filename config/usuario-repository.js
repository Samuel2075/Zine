import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Salva ou atualiza os dados do usuário do Google no Firestore (Upsert)
 */
export async function salvarOuAtualizarUsuarioGoogle(email, dadosUsuario) {
    try {
        // Usamos o e-mail (tratado sem caracteres inválidos se necessário) ou podemos gerar um ID limpo
        const userId = email.replace(/[.#$[\]]/g, "_");
        const docRef = doc(db, "usuarios", userId);
        
        const infoUsuario = {
            id: userId,
            email: email,
            nome: dadosUsuario.nome || "",
            nickname: dadosUsuario.nickname || "",
            avatar: dadosUsuario.avatar || "",
            ultimoLogin: new Date().toISOString()
        };

        // setDoc com { merge: true } atualiza se já existir ou cria se for o primeiro login
        await setDoc(docRef, infoUsuario, { merge: true });
        console.log("Dados do usuário sincronizados com o Firestore com sucesso!");
        return infoUsuario;
    } catch (error) {
        console.error("Erro ao salvar usuário no Firestore:", error);
        throw error;
    }
}

/**
 * Busca os dados de um usuário específico pelo ID/E-mail (Read)
 */
export async function buscarUsuarioPorId(email) {
    try {
        const userId = email.replace(/[.#$[\]]/g, "_");
        const docRef = doc(db, "usuarios", userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        return null;
    }
}