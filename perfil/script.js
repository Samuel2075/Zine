import { db } from "../config/firebase-config.js";
import { collection, getDocs, query, where, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { salvarCapaNoDrive } from "../config/drive-repository.js";

document.addEventListener("DOMContentLoaded", async function () {
    const userEmailLogado = localStorage.getItem("user_email");
    const accessToken = localStorage.getItem("google_access_token");

    if (!userEmailLogado || !accessToken) {
        alert("Sessão expirada. Faça login novamente.");
        window.location.href = "../index.html";
        return;
    }

    // Verifica se foi passado um e-mail na URL (ex: perfil/index.html?email=outro@email.com)
    const urlParams = new URLSearchParams(window.location.search);
    const emailPerfilAlvo = urlParams.get("email");

    // Define se estamos a ver o nosso próprio perfil ou o de outro utilizador
    const eMeuPerfil = !emailPerfilAlvo || emailPerfilAlvo === userEmailLogado;
    const emailAtivo = eMeuPerfil ? userEmailLogado : emailPerfilAlvo;
    const userId = emailAtivo.replace(/[.#$[\]]/g, "_");

    // Elementos da UI
    const profileAvatarImg = document.getElementById("profileAvatarImg");
    const profileBanner = document.getElementById("profileBanner");
    const profileNickname = document.getElementById("profileNickname");
    const profileEmail = document.getElementById("profileEmail");
    const profileBio = document.getElementById("profileBio");

    const btnAlterarAvatar = document.getElementById("btnAlterarAvatar");
    const inputAvatarFile = document.getElementById("inputAvatarFile");
    const btnAlterarBanner = document.getElementById("btnAlterarBanner");
    const inputBannerFile = document.getElementById("inputBannerFile");
    const btnEditarNome = document.getElementById("btnEditarNome");
    const btnEditarBio = document.getElementById("btnEditarBio");

    const ultimosZinesContainer = document.getElementById("ultimosZinesContainer");
    const todosZinesContainer = document.getElementById("todosZinesContainer");

    const modalEditarEl = document.getElementById("modalEditarPerfil");
    const modalEditarPerfil = window.bootstrap ? new bootstrap.Modal(modalEditarEl) : null;
    const modalEditarTitulo = document.getElementById("modalEditarTitulo");
    const containerInputModal = document.getElementById("containerInputModal");
    const btnSalvarEdicaoModal = document.getElementById("btnSalvarEdicaoModal");

    // Se não for o nosso perfil, oculta os botões de edição
    if (!eMeuPerfil) {
        if (btnAlterarAvatar) btnAlterarAvatar.style.display = "none";
        if (btnAlterarBanner) btnAlterarBanner.style.display = "none";
        if (btnEditarNome) btnEditarNome.style.display = "none";
        if (btnEditarBio) btnEditarBio.style.display = "none";
    }

    function mostrarNotificacao(mensagem, tipo = "success") {
        const toastContainer = document.getElementById("toastContainer");
        if (!toastContainer) return;
        const toast = document.createElement("div");
        toast.className = `alert alert-${tipo === "success" ? "success" : "danger"} shadow-sm py-2 px-3 mb-2`;
        toast.style.minWidth = "250px";
        toast.style.fontSize = "14px";
        toast.textContent = mensagem;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    let userData = {
        nickname: eMeuPerfil ? (localStorage.getItem("user_nickname") || "Usuário") : "Usuário",
        avatar: eMeuPerfil ? (localStorage.getItem("user_avatar") || "../assets/imgNotFound.jpg") : "../assets/imgNotFound.jpg",
        banner: "",
        bio: ""
    };

    // Carregar dados do perfil do Firestore
    async function carregarDadosPerfil() {
        try {
            const userRef = doc(db, "usuarios", userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                userData.nickname = data.nickname || userData.nickname;
                userData.avatar = data.avatar || userData.avatar;
                userData.banner = data.banner || "";
                userData.bio = data.bio || "";
            }

            profileNickname.textContent = userData.nickname;
            profileEmail.textContent = emailAtivo;
            profileAvatarImg.src = userData.avatar;
            profileBio.textContent = userData.bio || "Nenhuma descrição adicionada ainda.";
            if (userData.banner) {
                profileBanner.style.backgroundImage = `url('${userData.banner}')`;
            }
        } catch (e) {
            console.error("Erro ao carregar perfil:", e);
        }
    }

    await carregarDadosPerfil();

    // Salvar alterações no Firestore (apenas se for o próprio perfil)
    async function salvarPerfilNoFirestore(novosDados) {
        if (!eMeuPerfil) return;
        try {
            const userRef = doc(db, "usuarios", userId);
            await setDoc(userRef, { ...novosDados, email: emailAtivo }, { merge: true });
            mostrarNotificacao("Perfil atualizado com sucesso!");
        } catch (e) {
            console.error("Erro ao salvar perfil:", e);
            mostrarNotificacao("Erro ao atualizar perfil.", "error");
        }
    }

    // Função auxiliar para abrir a modal de edição (Nickname ou Bio)
// Função auxiliar para abrir a modal de edição (Nickname ou Bio)
    function abrirModalEdicao(titulo, valorAtual, tipoInput, aoSalvar) {
        if (!modalEditarPerfil) return;
        modalEditarTitulo.textContent = titulo;
        containerInputModal.innerHTML = "";

        let inputEl;
        if (tipoInput === "textarea") {
            inputEl = document.createElement("textarea");
            inputEl.className = "form-control bg-black text-light border-secondary shadow-none";
            inputEl.rows = 4;
            inputEl.style.resize = "none";
        } else {
            inputEl = document.createElement("input");
            inputEl.type = "text";
            inputEl.className = "form-control bg-black text-light border-secondary shadow-none";
        }

        inputEl.value = valorAtual;
        containerInputModal.appendChild(inputEl);

        // Seleciona o botão atual do DOM diretamente
        const btnSalvarEdicaoModal = document.getElementById("btnSalvarEdicaoModal");
        
        // Cria um clone fresco do botão para garantir que não acumula eventos antigos
        const novoBtnSalvar = btnSalvarEdicaoModal.cloneNode(true);
        btnSalvarEdicaoModal.parentNode.replaceChild(novoBtnSalvar, btnSalvarEdicaoModal);

        // Adiciona o evento ao novo botão recém-criado
        document.getElementById("btnSalvarEdicaoModal").addEventListener("click", async () => {
            const valorNovo = inputEl.value;
            modalEditarPerfil.hide();
            if (aoSalvar) await aoSalvar(valorNovo);
        });

        modalEditarPerfil.show();
        setTimeout(() => inputEl.focus(), 200);
    }

    if (eMeuPerfil) {
        // Alterar Nickname com Modal Bonita
        btnEditarNome.addEventListener("click", () => {
            abrirModalEdicao("Editar Nickname", profileNickname.textContent, "text", async (novoNome) => {
                if (novoNome && novoNome.trim() !== "") {
                    profileNickname.textContent = novoNome.trim();
                    userData.nickname = novoNome.trim();
                    localStorage.setItem("user_nickname", novoNome.trim());
                    await salvarPerfilNoFirestore({ nickname: userData.nickname });
                }
            });
        });

        // Alterar Bio com Modal Bonita
        btnEditarBio.addEventListener("click", () => {
            const bioAtual = profileBio.textContent === "Nenhuma descrição adicionada ainda." ? "" : profileBio.textContent;
            abrirModalEdicao("Editar Descrição / Bio", bioAtual, "textarea", async (novaBio) => {
                if (novaBio !== null) {
                    profileBio.textContent = novaBio.trim() || "Nenhuma descrição adicionada ainda.";
                    userData.bio = novaBio.trim();
                    await salvarPerfilNoFirestore({ bio: userData.bio });
                }
            });
        });

        async function garantirPastaPerfilDrive() {
            const metadata = {
                name: `Perfil_${userId}`,
                mimeType: 'application/vnd.google-apps.folder'
            };
            const response = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' }),
                body: JSON.stringify(metadata)
            });
            const folder = await response.json();
            return folder.id;
        }

        // Upload de Avatar
        btnAlterarAvatar.addEventListener("click", () => inputAvatarFile.click());
        inputAvatarFile.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                mostrarNotificacao("A carregar nova foto de perfil...");
                const folderId = await garantirPastaPerfilDrive();
                const url = await salvarCapaNoDrive(file, accessToken, folderId);
                profileAvatarImg.src = url;
                userData.avatar = url;
                localStorage.setItem("user_avatar", url);
                await salvarPerfilNoFirestore({ avatar: url });
            } catch (err) {
                console.error(err);
                mostrarNotificacao("Erro ao alterar foto de perfil.", "error");
            }
        });

        // Upload de Banner
        btnAlterarBanner.addEventListener("click", () => inputBannerFile.click());
        inputBannerFile.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                mostrarNotificacao("A carregar imagem de banner...");
                const folderId = await garantirPastaPerfilDrive();
                const url = await salvarCapaNoDrive(file, accessToken, folderId);
                profileBanner.style.backgroundImage = `url('${url}')`;
                userData.banner = url;
                await salvarPerfilNoFirestore({ banner: url });
            } catch (err) {
                console.error(err);
                mostrarNotificacao("Erro ao alterar banner.", "error");
            }
        });
    }

    // Carregar Zines Publicados do Utilizador do Perfil Atual
    async function carregarZinesDoUtilizador() {
        try {
            const q = query(collection(db, "zines"), where("userId", "==", userId));
            const snapshot = await getDocs(q);

            let zines = [];
            snapshot.forEach(docSnap => {
                const zine = docSnap.data();
                if (zine.publicado === true) {
                    zines.push(zine);
                }
            });

            zines.sort((a, b) => new Date(b.atualizadoEm || 0) - new Date(a.atualizadoEm || 0));

            if (zines.length === 0) {
                todosZinesContainer.innerHTML = "<p class='text-secondary small m-0'>Ainda não publicou nenhum zine.</p>";
                ultimosZinesContainer.innerHTML = "<p class='text-secondary small m-0'>Ainda não publicou nenhum zine.</p>";
                return;
            }

            todosZinesContainer.innerHTML = "";
            zines.forEach(z => {
                const capa = (z.paginas && z.paginas[0]) ? z.paginas[0] : "../assets/imgNotFound.jpg";
                const item = document.createElement("div");
                item.className = "d-flex align-items-center justify-content-between p-2 rounded border border-dark bg-black";
                item.innerHTML = `
                    <div class="d-flex align-items-center gap-3">
                        <img src="${capa}" class="zine-thumb" alt="Capa">
                        <div>
                            <h6 class="text-white mb-1 small fw-bold">${z.nomeZine}</h6>
                            <span class="text-secondary" style="font-size: 0.75rem;">Template: ${z.templateQuantidade || '-'} páginas</span>
                        </div>
                    </div>
                    <a href="../preview/index.html?id=${z.id}&origin=profile" class="btn btn-sm btn-dark-custom py-1 px-2" style="font-size: 0.75rem;">Visualizar</a>
                `;
                todosZinesContainer.appendChild(item);
            });

            const ultimos = zines.slice(0, 5);
            ultimosZinesContainer.innerHTML = "";
            ultimos.forEach(z => {
                const capa = (z.paginas && z.paginas[0]) ? z.paginas[0] : "../assets/imgNotFound.jpg";
                const item = document.createElement("div");
                item.className = "d-flex align-items-center justify-content-between p-2 rounded border border-dark bg-black";
                item.innerHTML = `
                    <div class="d-flex align-items-center gap-3">
                        <img src="${capa}" class="zine-thumb" alt="Capa">
                        <div>
                            <h6 class="text-white mb-1 small fw-bold">${z.nomeZine}</h6>
                            <span class="text-secondary" style="font-size: 0.75rem;">Template: ${z.templateQuantidade || '-'} páginas</span>
                        </div>
                    </div>
                    <a href="../preview/index.html?id=${z.id}&origin=profile" class="btn btn-sm btn-dark-custom py-1 px-2" style="font-size: 0.75rem;">Visualizar</a>
                `;
                ultimosZinesContainer.appendChild(item);
            });

        } catch (err) {
            console.error("Erro ao carregar zines do perfil:", err);
            todosZinesContainer.innerHTML = "<p class='text-danger small'>Erro ao carregar zines.</p>";
            ultimosZinesContainer.innerHTML = "<p class='text-danger small'>Erro ao carregar zines.</p>";
        }
    }

    await carregarZinesDoUtilizador();
});