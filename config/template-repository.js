import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Cadastra um novo usuário no Firestore (Create)
 */
export async function cadastrarUsuario(userId, dadosUsuario) {
    try {
        const docRef = doc(db, "usuarios", userId);
        const novoUsuario = {
            id: userId,
            email: dadosUsuario.email,
            senha: dadosUsuario.senha, // Nota: Em produção real, a senha deve ser criptografada via Firebase Auth
            nome: dadosUsuario.nome || "",
            criadoEm: new Date().toISOString()
        };

        await setDoc(docRef, novoUsuario);
        console.log("Usuário cadastrado com sucesso!");
        return true;
    } catch (error) {
        console.error("Erro ao cadastrar usuário:", error);
        throw error;
    }
}

/**
 * Busca os dados de um usuário específico pelo ID (Read)
 */
export async function buscarUsuarioPorId(userId) {
    try {
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

/**
 * Valida o login buscando pelo e-mail e senha
 */
export async function validarLogin(email, senha) {
    try {
        const q = query(collection(db, "usuarios"), where("email", "==", email), where("senha", "==", senha));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Retorna os dados do primeiro usuário encontrado com esse e-mail e senha
            let usuarioEncontrado = null;
            querySnapshot.forEach((docSnap) => {
                usuarioEncontrado = docSnap.data();
            });
            return usuarioEncontrado;
        }
        
        return null; // Credenciais inválidas
    } catch (error) {
        console.error("Erro ao realizar login:", error);
        return null;
    }
}