import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function salvarOuAtualizarUsuarioGoogle(email, dadosUsuario) {
    try {
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

        await setDoc(docRef, infoUsuario, { merge: true });
        console.log("Dados do usuário sincronizados com o Firestore com sucesso!");
        return infoUsuario;
    } catch (error) {
        console.error("Erro ao salvar usuário no Firestore:", error);
        throw error;
    }
}

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