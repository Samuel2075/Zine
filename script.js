import { salvarOuAtualizarUsuarioGoogle, buscarUsuarioPorId } from "./config/usuario-repository.js";
import { db } from "./config/firebase-config.js";
import { collection, getDocs, deleteDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const CLIENT_ID = "334263251975-0ov5qpk3lo495j9e65hjhjqbto700ihn.apps.googleusercontent.com";
let tokenClient = null;

document.addEventListener("DOMContentLoaded", function () {
    const loginCard = document.getElementById("loginCard");
    const profileCard = document.getElementById("profileCard");
    const mainHeader = document.getElementById("mainHeader");
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
                    localStorage.setItem("google_access_token", accessToken);
                    localStorage.setItem("token_expiration", Date.now() + 3600000);
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
            localStorage.clear();
            if (mainHeader) mainHeader.classList.add("d-none");
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

            localStorage.setItem("user_nickname", nicknameFinal);
            localStorage.setItem("user_email", userInfo.email);
            localStorage.setItem("user_avatar", avatarFinal);

            mostrarNotificacao("Login efetuado com sucesso!");
            atualizarInterfacePerfil();
        } catch (error) {
            console.error("Erro no login:", error);
            mostrarNotificacao("Erro ao processar os dados do utilizador.", "error");
        }
    }

    function verificarSessaoAtiva() {
        const token = localStorage.getItem("google_access_token");
        const email = localStorage.getItem("user_email");

        if (token && email) {
            atualizarInterfacePerfil();
        } else {
            localStorage.clear();
            if (mainHeader) mainHeader.classList.add("d-none");
            if (loginCard) loginCard.classList.remove("d-none");
        }
    }

    async function carregarZines(userEmailLogado) {
        if (!meusZinesContainer || !zinesPublicadosContainer) return;

        meusZinesContainer.innerHTML = "<p class='text-secondary m-0' style='grid-column: 1 / -1;'>Carregando os seus zines...</p>";
        zinesPublicadosContainer.innerHTML = "<p class='text-secondary m-0' style='grid-column: 1 / -1;'>Carregando zines publicados...</p>";

        try {
            const querySnapshot = await getDocs(collection(db, "zines"));

            meusZinesContainer.innerHTML = "";
            zinesPublicadosContainer.innerHTML = "";

            let countMeus = 0;
            let countPublicos = 0;

            if (querySnapshot.empty) {
                meusZinesContainer.innerHTML = "<p class='text-secondary m-0' style='grid-column: 1 / -1;'>Você ainda não criou nenhum zine.</p>";
                zinesPublicadosContainer.innerHTML = "<p class='text-secondary m-0' style='grid-column: 1 / -1;'>Nenhum zine publicado no momento.</p>";
                return;
            }

            querySnapshot.forEach((docSnap) => {
                const zine = docSnap.data();
                const isDono = zine.userEmail === userEmailLogado;

                let primeiraImagemUrl = "assets/imgNotFound.jpg";
                if (zine.paginas && zine.paginas.length > 0 && zine.paginas[0]) {
                    primeiraImagemUrl = zine.paginas[0];
                }

                if (isDono) {
                    countMeus++;
                    const itemMeus = document.createElement("div");
                    itemMeus.className = "zine-mosaic-item zine-container-click";

                    itemMeus.innerHTML = `
                        <img src="${primeiraImagemUrl}" class="zine-mosaic-img" alt="Capa" onerror="this.src='assets/imgNotFound.jpg'">
                        <div class="zine-tooltip-menu">
                            <div class="fw-bold text-white small mb-1 text-center text-truncate">${zine.nomeZine}</div>
                            <div class="text-secondary text-center small mb-2 text-truncate" style="font-size: 0.75rem;">Por: ${zine.autorNickname || zine.userEmail || "Autor Desconhecido"}</div>
                            <div class="d-grid gap-1 border-top border-dark pt-2">
                                <a href="preview/index.html?id=${zine.id}&origin=home" class="btn btn-sm btn-dark-custom w-100 py-1" style="font-size: 0.8rem;">Visualizar</a>
                                <a href="createZine/index.html?edit=${zine.id}" class="btn btn-sm btn-dark-custom w-100 py-1" style="font-size: 0.8rem;">Editar / Publicar</a>
                                <button class="btn btn-sm btn-dark-custom w-100 py-1 btn-ver-comentarios" data-id="${zine.id}" style="font-size: 0.8rem;">Ver Comentários</button>
                                <button class="btn btn-sm btn-outline-danger w-100 py-1 btn-excluir mt-1" data-id="${zine.id}" style="font-size: 0.8rem;">Excluir</button>
                            </div>
                        </div>
                    `;
                    meusZinesContainer.appendChild(itemMeus);
                }

                if (zine.publicado === true) {
                    countPublicos++;
                    const itemPub = document.createElement("div");
                    itemPub.className = "zine-mosaic-item zine-container-click";

                    itemPub.innerHTML = `
                        <img src="${primeiraImagemUrl}" class="zine-mosaic-img" alt="Capa" onerror="this.src='assets/imgNotFound.jpg'">
                        <div class="zine-tooltip-menu">
                            <div class="fw-bold text-white small mb-2 text-center pb-1 border-bottom border-dark text-truncate">${zine.nomeZine}</div>
                            <div class="d-grid gap-1">
                                <a href="preview/index.html?id=${zine.id}&origin=home" class="btn btn-sm btn-accent w-100 py-1" style="font-size: 0.8rem;">Visualizar Zine</a>
                                <button class="btn btn-sm btn-dark-custom w-100 py-1 btn-ver-comentarios" data-id="${zine.id}" style="font-size: 0.8rem;">Ver Comentários</button>
                            </div>
                        </div>
                    `;
                    zinesPublicadosContainer.appendChild(itemPub);
                }
            });

            if (countMeus === 0) meusZinesContainer.innerHTML = "<p class='text-secondary m-0' style='grid-column: 1 / -1;'>Você ainda não criou nenhum zine.</p>";
            if (countPublicos === 0) zinesPublicadosContainer.innerHTML = "<p class='text-secondary m-0' style='grid-column: 1 / -1;'>Nenhum zine publicado no momento.</p>";

            document.querySelectorAll(".zine-container-click").forEach(container => {
                container.addEventListener("click", function (e) {
                    e.stopPropagation();
                    document.querySelectorAll(".zine-tooltip-menu").forEach(menu => {
                        if (menu !== this.querySelector(".zine-tooltip-menu")) {
                            menu.classList.remove("active");
                        }
                    });
                    const menu = this.querySelector(".zine-tooltip-menu");
                    if (menu) menu.classList.toggle("active");
                });
            });

            document.addEventListener("click", () => {
                document.querySelectorAll(".zine-tooltip-menu").forEach(menu => menu.classList.remove("active"));
            });

            document.querySelectorAll(".zine-tooltip-menu").forEach(menu => {
                menu.addEventListener("click", (e) => e.stopPropagation());
            });

            document.querySelectorAll(".btn-excluir").forEach(btn => {
                btn.addEventListener("click", function () {
                    zineIdParaExcluir = this.getAttribute("data-id");
                    if (modalBootstrap) modalBootstrap.show();
                });
            });

            document.querySelectorAll(".btn-ver-comentarios").forEach(btn => {
                btn.addEventListener("click", async function () {
                    const zineId = this.getAttribute("data-id");
                    const emailLogado = localStorage.getItem("user_email");

                    try {
                        const docRef = doc(db, "zines", zineId);
                        const docSnap = await getDoc(docRef);

                        if (docSnap.exists()) {
                            const zineData = docSnap.data();
                            const isDonoZine = zineData.userEmail === emailLogado;
                            listaComentariosModalBody.innerHTML = "";

                            if (zineData.comentarios && Object.keys(zineData.comentarios).length > 0) {
                                for (const [pagIdx, com] of Object.entries(zineData.comentarios)) {
                                    const cardDiv = document.createElement("div");
                                    cardDiv.className = "mb-3 p-3 rounded-3 position-relative";
                                    cardDiv.style.backgroundColor = "#1b1b1b";
                                    cardDiv.style.border = "1px solid #2a2a2a";

                                    let linkCitacao = "";
                                    if (com.zineCitadoId) {
                                        linkCitacao = `
                                            <div class="mt-2 pt-2 border-top border-dark">
                                                <a href="preview/index.html?id=${com.zineCitadoId}" target="_blank" rel="noopener noreferrer" class="text-info text-decoration-none small d-inline-flex align-items-center gap-1">
                                                    🔗 Ver Zine Citado
                                                </a>
                                            </div>
                                        `;
                                    }

                                    let anexoHtml = "";
                                    if (com.anexoUrl) {
                                        anexoHtml = `
                                            <div class="mt-3">
                                                <img src="${com.anexoUrl}" class="rounded border border-dark img-thumbnail img-comentario-zoom" data-img="${com.anexoUrl}" style="max-height: 130px; object-fit: cover; background-color: #0f0f0f; cursor: pointer;" title="Clique para ampliar">
                                            </div>
                                        `;
                                    }

                                    // UNICA ALTERAÇÃO REALIZADA:
                                    // Verifica se quem está logado é o autor do comentário OU o dono do zine
                                    const isAutorComentario = com.autorEmail === emailLogado;

                                    let botaoExcluir = "";
                                    if (isDonoZine || isAutorComentario) {
                                        botaoExcluir = `
                                            <button class="btn btn-sm btn-link text-danger p-0 text-decoration-none small btn-excluir-comentario" data-zineid="${zineId}" data-pag="${pagIdx}">
                                                Excluir
                                            </button>
                                        `;
                                    }

                                    cardDiv.innerHTML = `
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span class="badge" style="background-color: #262626; color: #a0a0a0; font-weight: 500; font-size: 0.75rem;">Página ${parseInt(pagIdx) + 1}</span>
                                            ${botaoExcluir}
                                        </div>
                                        <div class="mb-1 text-light">
                                            <strong style="color: #e0e0e0;">${com.autorNickname || com.autorEmail}:</strong>
                                            <span class="text-secondary ms-1" style="word-break: break-word;">${com.texto}</span>
                                        </div>
                                        ${anexoHtml}
                                        ${linkCitacao}
                                    `;
                                    listaComentariosModalBody.appendChild(cardDiv);
                                }

                                document.querySelectorAll(".img-comentario-zoom").forEach(imgEl => {
                                    imgEl.addEventListener("click", function () {
                                        const srcImg = this.getAttribute("data-img");
                                        document.getElementById("imgZoomPreview").src = srcImg;
                                        const modalZoom = new bootstrap.Modal(document.getElementById("modalZoomImagem"));
                                        modalZoom.show();
                                    });
                                });

                                document.querySelectorAll(".btn-excluir-comentario").forEach(delBtn => {
                                    delBtn.addEventListener("click", async function () {
                                        if (!confirm("Deseja realmente excluir este comentário?")) return;

                                        const zId = this.getAttribute("data-zineid");
                                        const pIdx = this.getAttribute("data-pag");

                                        try {
                                            const zRef = doc(db, "zines", zId);
                                            const zSnap = await getDoc(zRef);
                                            if (zSnap.exists()) {
                                                let zData = zSnap.data();
                                                if (zData.comentarios && zData.comentarios[pIdx]) {
                                                    delete zData.comentarios[pIdx];
                                                    await setDoc(zRef, { comentarios: zData.comentarios }, { merge: true });
                                                    mostrarNotificacao("Comentário excluído com sucesso!");
                                                    modalVerComentarios.hide();
                                                }
                                            }
                                        } catch (err) {
                                            console.error("Erro ao excluir comentário:", err);
                                            mostrarNotificacao("Erro ao excluir comentário.", "error");
                                        }
                                    });
                                });

                            } else {
                                listaComentariosModalBody.innerHTML = "<p class='text-secondary text-center py-4 m-0'>Nenhum comentário neste zine ainda.</p>";
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
            meusZinesContainer.innerHTML = "<p class='text-danger m-0' style='grid-column: 1 / -1;'>Erro ao carregar os seus zines.</p>";
            zinesPublicadosContainer.innerHTML = "<p class='text-danger m-0' style='grid-column: 1 / -1;'>Erro ao carregar zines publicados.</p>";
        }
    }

    const btnConfirmarExclusao = document.getElementById("btnConfirmarExclusao");
    if (btnConfirmarExclusao) {
        const novoBtnConfirmar = btnConfirmarExclusao.cloneNode(true);
        btnConfirmarExclusao.parentNode.replaceChild(novoBtnConfirmar, btnConfirmarExclusao);

        document.getElementById("btnConfirmarExclusao").addEventListener("click", async function () {
            if (!zineIdParaExcluir) return;
            const emailLogado = localStorage.getItem("user_email");

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
        if (loginCard && profileCard && mainHeader) {
            loginCard.classList.add("d-none");
            mainHeader.classList.remove("d-none");
            profileCard.classList.remove("d-none");
            if (listaZinesSection) listaZinesSection.classList.remove("d-none");

            const nickEl = document.getElementById("userNickname");
            const emailEl = document.getElementById("userEmail");
            const avatarEl = document.getElementById("userAvatar");

            const nickname = localStorage.getItem("user_nickname");
            const email = localStorage.getItem("user_email");

            if (nickEl) nickEl.textContent = nickname;
            if (emailEl) emailEl.textContent = email;

            if (avatarEl) {
                avatarEl.src = localStorage.getItem("user_avatar") || "assets/imgNotFound.jpg";
                avatarEl.onerror = function () { this.src = "assets/imgNotFound.jpg"; };
            }

            carregarZines(email);
        }
    }
});