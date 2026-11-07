import { salvarOuAtualizarUsuarioGoogle, buscarUsuarioPorId } from "./config/usuario-repository.js";
import { db } from "./config/firebase-config.js";
import { collection, getDocs, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const CLIENT_ID = "334263251975-0ov5qpk3lo495j9e65hjhjqbto700ihn.apps.googleusercontent.com";
let tokenClient = null;

document.addEventListener("DOMContentLoaded", function () {
    const loginCard = document.getElementById("loginCard");
    const profileCard = document.getElementById("profileCard");
    const btnGoogleLogin = document.getElementById("btnGoogleLogin");
    const btnLogout = document.getElementById("btnLogout");
    const listaZinesSection = document.getElementById("listaZinesSection");
    
    const meusZinesContainer = document.getElementById("meusZinesContainer");
    const zinesPublicadosContainer = document.getElementById("zinesPublicadosContainer");

    const modalElement = document.getElementById('modalConfirmacao');
    const modalBootstrap = window.bootstrap ? new bootstrap.Modal(modalElement) : null;
    let zineIdParaExcluir = null;

    const modalVerComentariosEl = document.getElementById("modalVerComentarios");
    const modalVerComentarios = window.bootstrap ? new bootstrap.Modal(modalVerComentariosEl) : null;
    const listaComentariosModalBody = document.getElementById("listaComentariosModalBody");

    function mostrarNotificacao(mensagem, tipo = "success") {
        const toastContainer = document.getElementById("toastContainer");
        if (!toastContainer) return;

        const toast = document.createElement("div");
        toast.className = `alert alert-${tipo === "success" ? "success" : "danger"} shadow-sm py-2 px-3 mb-2`;
        toast.style.minWidth = "250px";
        toast.style.fontSize = "14px";
        toast.textContent = mensagem;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = "opacity 0.5s ease";
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    verificarSessaoAtiva();

    function inicializarGoogleClient() {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
                callback: async (response) => {
                    if (response.error) {
                        mostrarNotificacao("Falha na autenticação com o Google.", "error");
                        return;
                    }
                    const accessToken = response.access_token;
                    sessionStorage.setItem("google_access_token", accessToken);
                    sessionStorage.setItem("token_expiration", Date.now() + 3600000);
                    await processarLoginGoogle(accessToken);
                },
            });
        } else {
            setTimeout(inicializarGoogleClient, 500);
        }
    }

    inicializarGoogleClient();

    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener("click", () => {
            if (!tokenClient) {
                mostrarNotificacao("O sistema do Google ainda está carregando. Tente novamente.", "error");
                return;
            }
            tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            sessionStorage.clear();
            if (profileCard) profileCard.classList.add("d-none");
            if (loginCard) loginCard.classList.remove("d-none");
            if (listaZinesSection) listaZinesSection.classList.add("d-none");
            mostrarNotificacao("Sessão encerrada com sucesso.");
        });
    }

    async function processarLoginGoogle(accessToken) {
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const userInfo = await res.json();

            let usuarioFirestore = await buscarUsuarioPorId(userInfo.email);
            let nicknameFinal = usuarioFirestore?.nickname || prompt("Escolha o seu Nickname para o sistema:", userInfo.name || "Usuário") || userInfo.name || "Usuário";
            const avatarFinal = userInfo.picture || "assets/imgNotFound.jpg";

            await salvarOuAtualizarUsuarioGoogle(userInfo.email, {
                nome: userInfo.name,
                nickname: nicknameFinal,
                avatar: avatarFinal
            });

            sessionStorage.setItem("user_nickname", nicknameFinal);
            sessionStorage.setItem("user_email", userInfo.email);
            sessionStorage.setItem("user_avatar", avatarFinal);

            mostrarNotificacao("Login efetuado com sucesso!");
            atualizarInterfacePerfil();
        } catch (error) {
            console.error("Erro no login:", error);
            mostrarNotificacao("Erro ao processar os dados do utilizador.", "error");
        }
    }

    function verificarSessaoAtiva() {
        const token = sessionStorage.getItem("google_access_token");
        const expiration = sessionStorage.getItem("token_expiration");
        if (token && expiration && Date.now() < parseInt(expiration)) {
            atualizarInterfacePerfil();
        } else {
            sessionStorage.clear();
        }
    }

    async function carregarZines(userEmailLogado) {
        if (!meusZinesContainer || !zinesPublicadosContainer) return;

        meusZinesContainer.innerHTML = "<p class='text-muted'>Carregando os seus zines...</p>";
        zinesPublicadosContainer.innerHTML = "<p class='text-muted'>Carregando zines publicados...</p>";

        try {
            const querySnapshot = await getDocs(collection(db, "zines"));
            
            meusZinesContainer.innerHTML = "";
            zinesPublicadosContainer.innerHTML = "";

            let countMeus = 0;
            let countPublicos = 0;

            if (querySnapshot.empty) {
                meusZinesContainer.innerHTML = "<p class='text-muted'>Você ainda não criou nenhum zine.</p>";
                zinesPublicadosContainer.innerHTML = "<p class='text-muted'>Nenhum zine publicado no momento.</p>";
                return;
            }

            querySnapshot.forEach((docSnap) => {
                const zine = docSnap.data();
                const isDono = zine.userEmail === userEmailLogado;

                let primeiraImagemUrl = "assets/imgNotFound.jpg";
                if (zine.paginas && zine.paginas.length > 0 && zine.paginas[0]) {
                    primeiraImagemUrl = zine.paginas[0];
                }

                // 1. Seção: Meus Zines
                if (isDono) {
                    countMeus++;
                    const colMeus = document.createElement("div");
                    colMeus.className = "col-md-4 mb-4";

                    const badgeStatus = zine.publicado 
                        ? '<span class="badge bg-success mb-2">Publicado</span>' 
                        : '<span class="badge bg-secondary mb-2">Rascunho</span>';

                    colMeus.innerHTML = `
                        <div class="card shadow-sm h-100">
                            <img src="${primeiraImagemUrl}" class="card-img-top" alt="Capa do Zine" style="height: 200px; object-fit: cover;" onerror="this.src='assets/imgNotFound.jpg'">
                            <div class="card-body d-flex flex-column justify-content-between">
                                <div>
                                    <h5 class="card-title fw-bold text-dark mb-1" style="font-size: 1.25rem;">${zine.nomeZine}</h5>
                                    ${badgeStatus}
                                    <p class="card-text text-muted small mb-2" style="font-size: 0.85rem;">Autor: Você</p>
                                </div>
                                <div class="d-grid gap-1">
                                    <a href="preview/index.html?id=${zine.id}" class="btn btn-sm btn-outline-primary w-100 mb-1">Visualizar</a>
                                    <a href="createZine/index.htm?edit=${zine.id}" class="btn btn-sm btn-outline-secondary w-100 mb-1">Editar / Publicar</a>
                                    <button class="btn btn-sm btn-outline-info w-100 mb-1 btn-ver-comentarios" data-id="${zine.id}">Ver Comentários</button>
                                    <button class="btn btn-sm btn-outline-danger w-100 btn-excluir" data-id="${zine.id}">Excluir</button>
                                </div>
                            </div>
                        </div>
                    `;
                    meusZinesContainer.appendChild(colMeus);
                }

                // 2. Seção: Zines Publicados da Comunidade
                if (zine.publicado === true) {
                    countPublicos++;
                    const colPub = document.createElement("div");
                    colPub.className = "col-md-4 mb-4";

                    colPub.innerHTML = `
                        <div class="card shadow-sm h-100">
                            <img src="${primeiraImagemUrl}" class="card-img-top" alt="Capa do Zine" style="height: 200px; object-fit: cover;" onerror="this.src='assets/imgNotFound.jpg'">
                            <div class="card-body d-flex flex-column justify-content-between">
                                <div>
                                    <h5 class="card-title fw-bold text-dark mb-1" style="font-size: 1.25rem;">${zine.nomeZine}</h5>
                                    <p class="card-text text-muted small mb-3" style="font-size: 0.85rem;">Autor: ${zine.userEmail}</p>
                                </div>
                                <div class="d-grid gap-1">
                                    <a href="preview/index.html?id=${zine.id}" class="btn btn-sm btn-primary w-100 mb-1">Visualizar Zine</a>
                                    <button class="btn btn-sm btn-outline-info w-100 btn-ver-comentarios" data-id="${zine.id}">Ver Comentários</button>
                                </div>
                            </div>
                        </div>
                    `;
                    zinesPublicadosContainer.appendChild(colPub);
                }
            });

            if (countMeus === 0) meusZinesContainer.innerHTML = "<p class='text-muted'>Você ainda não criou nenhum zine.</p>";
            if (countPublicos === 0) zinesPublicadosContainer.innerHTML = "<p class='text-muted'>Nenhum zine publicado no momento.</p>";

            // Evento para abrir modal de exclusão
            document.querySelectorAll(".btn-excluir").forEach(btn => {
                btn.addEventListener("click", function () {
                    zineIdParaExcluir = this.getAttribute("data-id");
                    if (modalBootstrap) modalBootstrap.show();
                });
            });

            // Evento para abrir modal de comentários
            document.querySelectorAll(".btn-ver-comentarios").forEach(btn => {
                btn.addEventListener("click", async function() {
                    const zineId = this.getAttribute("data-id");
                    try {
                        const docSnap = await getDoc(doc(db, "zines", zineId));
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            listaComentariosModalBody.innerHTML = "";

                            if (data.comentarios && Object.keys(data.comentarios).length > 0) {
                                for (const [pagIdx, com] of Object.entries(data.comentarios)) {
                                    const div = document.createElement("div");
                                    div.className = "border-bottom border-secondary pb-2 mb-2";
                                    div.innerHTML = `
                                        <span class="badge bg-secondary mb-1">Página ${parseInt(pagIdx) + 1}</span>
                                        <p class="mb-1 small"><strong>${com.autorNickname}:</strong> ${com.texto}</p>
                                    `;
                                    listaComentariosModalBody.appendChild(div);
                                }
                            } else {
                                listaComentariosModalBody.innerHTML = "<p class='text-muted small'>Nenhum comentário neste zine ainda.</p>";
                            }

                            modalVerComentarios.show();
                        }
                    } catch (e) {
                        console.error(e);
                        mostrarNotificacao("Erro ao carregar comentários.", "error");
                    }
                });
            });

        } catch (error) {
            console.error("Erro ao carregar zines:", error);
            meusZinesContainer.innerHTML = "<p class='text-danger'>Erro ao carregar os seus zines.</p>";
            zinesPublicadosContainer.innerHTML = "<p class='text-danger'>Erro ao carregar zines publicados.</p>";
        }
    }

    const btnConfirmarExclusao = document.getElementById("btnConfirmarExclusao");
    if (btnConfirmarExclusao) {
        const novoBtnConfirmar = btnConfirmarExclusao.cloneNode(true);
        btnConfirmarExclusao.parentNode.replaceChild(novoBtnConfirmar, btnConfirmarExclusao);

        document.getElementById("btnConfirmarExclusao").addEventListener("click", async function () {
            if (!zineIdParaExcluir) return;
            const emailLogado = sessionStorage.getItem("user_email");

            try {
                await deleteDoc(doc(db, "zines", zineIdParaExcluir));
                if (modalBootstrap) modalBootstrap.hide();
                mostrarNotificacao("Zine excluído com sucesso!");
                carregarZines(emailLogado);
            } catch (err) {
                console.error("Erro ao excluir:", err);
                if (modalBootstrap) modalBootstrap.hide();
                mostrarNotificacao("Erro ao excluir o zine.", "error");
            } finally {
                zineIdParaExcluir = null;
            }
        });
    }

    function atualizarInterfacePerfil() {
        if (loginCard && profileCard) {
            loginCard.classList.add("d-none");
            profileCard.classList.remove("d-none");
            if (listaZinesSection) listaZinesSection.classList.remove("d-none");

            const nickEl = document.getElementById("userNickname");
            const emailEl = document.getElementById("userEmail");
            const avatarEl = document.getElementById("userAvatar");

            const nickname = sessionStorage.getItem("user_nickname");
            const email = sessionStorage.getItem("user_email");

            if (nickEl) nickEl.textContent = nickname;
            if (emailEl) emailEl.textContent = email;

            if (avatarEl) {
                avatarEl.src = sessionStorage.getItem("user_avatar") || "assets/imgNotFound.jpg";
                avatarEl.onerror = function () { this.src = "assets/imgNotFound.jpg"; };
            }

            carregarZines(email);
        }
    }
});