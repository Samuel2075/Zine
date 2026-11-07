import { salvarOuAtualizarUsuarioGoogle, buscarUsuarioPorId } from "./config/usuario-repository.js";
import { db } from "./config/firebase-config.js";
import { collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const CLIENT_ID = "334263251975-0ov5qpk3lo495j9e65hjhjqbto700ihn.apps.googleusercontent.com";
let tokenClient = null;

document.addEventListener("DOMContentLoaded", function () {
    const loginCard = document.getElementById("loginCard");
    const profileCard = document.getElementById("profileCard");
    const btnGoogleLogin = document.getElementById("btnGoogleLogin");
    const btnLogout = document.getElementById("btnLogout");
    const listaZinesSection = document.getElementById("listaZinesSection");
    const zinesContainer = document.getElementById("zinesContainer");

    verificarSessaoAtiva();

    function inicializarGoogleClient() {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
                callback: async (response) => {
                    if (response.error) {
                        console.error("Erro na autenticação:", response);
                        alert("Falha na autenticação com o Google.");
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
                alert("O sistema do Google ainda está carregando. Tente novamente.");
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
        });
    }

    async function processarLoginGoogle(accessToken) {
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const userInfo = await res.json();

            let usuarioFirestore = await buscarUsuarioPorId(userInfo.email);
            let nicknameFinal = "";

            if (usuarioFirestore && usuarioFirestore.nickname) {
                nicknameFinal = usuarioFirestore.nickname;
            } else {
                nicknameFinal = prompt("Escolha o seu Nickname para o sistema:", userInfo.name || "Usuário");
                if (!nicknameFinal) nicknameFinal = userInfo.name || "Usuário";
            }

            const avatarFinal = userInfo.picture || "assets/imgNotFound.jpg";

            await salvarOuAtualizarUsuarioGoogle(userInfo.email, {
                nome: userInfo.name,
                nickname: nicknameFinal,
                avatar: avatarFinal
            });

            sessionStorage.setItem("user_nickname", nicknameFinal);
            sessionStorage.setItem("user_email", userInfo.email);
            sessionStorage.setItem("user_avatar", avatarFinal);

            atualizarInterfacePerfil();
        } catch (error) {
            console.error("Erro ao processar login do Google:", error);
            alert("Erro ao processar os dados do utilizador.");
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
        if (!zinesContainer) return;
        zinesContainer.innerHTML = "<p class='text-muted'>Carregando zines...</p>";

        try {
            const querySnapshot = await getDocs(collection(db, "zines"));
            zinesContainer.innerHTML = "";

            if (querySnapshot.empty) {
                zinesContainer.innerHTML = "<p class='text-muted'>Nenhum zine criado ainda.</p>";
                return;
            }

            for (const docSnap of querySnapshot.docs) {
                const zine = docSnap.data();
                const isDono = zine.userEmail === userEmailLogado;

                let primeiraImagemUrl = "assets/imgNotFound.jpg";
                if (zine.paginas && zine.paginas.length > 0 && zine.paginas[0]) {
                    primeiraImagemUrl = zine.paginas[0];
                }

                const col = document.createElement("div");
                col.className = "col-md-4 mb-4";

                let botoesAcao = `
                    <a href="preview/index.html?id=${zine.id}" class="btn btn-sm btn-outline-primary w-100 mb-1">Visualizar</a>
                `;

                if (isDono) {
                    botoesAcao = `
                        <a href="preview/index.html?id=${zine.id}" class="btn btn-sm btn-outline-primary w-100 mb-1">Visualizar</a>
                        <a href="createZine/index.htm?edit=${zine.id}" class="btn btn-sm btn-outline-secondary w-100 mb-1">Editar</a>
                        <button class="btn btn-sm btn-outline-danger w-100 btn-excluir" data-id="${zine.id}">Excluir</button>
                    `;
                }

                col.innerHTML = `
                    <div class="card shadow-sm h-100">
                        <img src="${primeiraImagemUrl}" class="card-img-top" alt="Capa do Zine" style="height: 200px; object-fit: cover;" onerror="this.src='assets/imgNotFound.jpg'">
                        <div class="card-body d-flex flex-column justify-content-between">
                            <div>
                                <h5 class="card-title fw-bold text-dark mb-1" style="font-size: 1.25rem;">${zine.nomeZine}</h5>
                                <p class="card-text text-muted small mb-3" style="font-size: 0.85rem;">Autor: ${zine.userEmail}</p>
                            </div>
                            <div class="d-grid gap-1">
                                ${botoesAcao}
                            </div>
                        </div>
                    </div>
                `;
                zinesContainer.appendChild(col);
            }

            document.querySelectorAll(".btn-excluir").forEach(btn => {
                btn.addEventListener("click", async function () {
                    const zineId = this.getAttribute("data-id");
                    if (confirm("Tem certeza que deseja excluir este zine?")) {
                        try {
                            await deleteDoc(doc(db, "zines", zineId));
                            alert("Zine excluído com sucesso!");
                            carregarZines(userEmailLogado);
                        } catch (err) {
                            console.error("Erro ao excluir:", err);
                            alert("Erro ao excluir o zine.");
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Erro ao carregar zines:", error);
            zinesContainer.innerHTML = "<p class='text-danger'>Erro ao carregar lista de zines.</p>";
        }
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
                avatarEl.onerror = function () {
                    this.src = "assets/imgNotFound.jpg";
                };
            }

            carregarZines(email);
        }
    }
});