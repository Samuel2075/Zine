import { salvarOuAtualizarUsuarioGoogle, buscarUsuarioPorId } from "./config/usuario-repository.js";

const CLIENT_ID = "334263251975-0ov5qpk3lo495j9e65hjhjqbto700ihn.apps.googleusercontent.com"; 
let tokenClient = null;

document.addEventListener("DOMContentLoaded", function () {
    const loginCard = document.getElementById("loginCard");
    const profileCard = document.getElementById("profileCard");
    const btnGoogleLogin = document.getElementById("btnGoogleLogin");
    const btnLogout = document.getElementById("btnLogout");

    // Verifica se já existe uma sessão ativa válida ao carregar a página
    verificarSessaoAtiva();

    function inicializarGoogleClient() {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                // IMPORTANTE: Inclui explicitamente os escopos do Drive e de Perfil/Email
                scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
                callback: async (response) => {
                    if (response.error) {
                        console.error("Erro na autenticação:", response);
                        alert("Falha na autenticação com o Google.");
                        return;
                    }
                    
                    const accessToken = response.access_token;
                    // Salva o novo token fresco na sessão com validade de 1 hora
                    sessionStorage.setItem("google_access_token", accessToken);
                    sessionStorage.setItem("token_expiration", Date.now() + 3600000);

                    await processarLoginGoogle(accessToken);
                },
            });
            console.log("Google Identity Services inicializado com sucesso!");
        } else {
            setTimeout(inicializarGoogleClient, 500);
        }
    }

    inicializarGoogleClient();

    // Botão de login abre o pop-up do Google forçando a geração de um novo token fresco
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener("click", () => {
            if (!tokenClient) {
                alert("O sistema do Google ainda está carregando. Aguarde um segundo e tente novamente.");
                return;
            }
            // O parâmetro prompt: 'consent' força a revalidação e a criação de um token novo com todos os escopos
            tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    // Botão de logout limpa completamente a sessão e retorna ao card de login
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            sessionStorage.clear();
            if (profileCard) profileCard.classList.add("d-none");
            if (loginCard) loginCard.classList.remove("d-none");
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

        // Se o token ainda for válido, mantém a interface logada
        if (token && expiration && Date.now() < parseInt(expiration)) {
            atualizarInterfacePerfil();
        } else {
            sessionStorage.clear();
        }
    }

    function atualizarInterfacePerfil() {
        if (loginCard && profileCard) {
            loginCard.classList.add("d-none");
            profileCard.classList.remove("d-none");

            const nickEl = document.getElementById("userNickname");
            const emailEl = document.getElementById("userEmail");
            const avatarEl = document.getElementById("userAvatar");

            if (nickEl) nickEl.textContent = sessionStorage.getItem("user_nickname");
            if (emailEl) emailEl.textContent = sessionStorage.getItem("user_email");
            
            if (avatarEl) {
                const avatarUrl = sessionStorage.getItem("user_avatar");
                avatarEl.src = avatarUrl;
                
                avatarEl.onerror = function() {
                    this.src = "assets/imgNotFound.jpg";
                };
            }
        }
    }
});