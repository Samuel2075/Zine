import { db } from "../config/firebase-config.js";
import { collection, getDocs, query, where, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { salvarCapaNoDrive } from "../config/drive-repository.js";

document.addEventListener("DOMContentLoaded", async function () {
    const templateSelect = document.getElementById("templateSelect");
    const templatesUpload = document.getElementById("templatesUpload");
    const zineNameInput = document.getElementById("zineName");
    const btnLogout = document.getElementById("btnLogout");

    // 1. Validação de Sessão: Se não houver token ou expirar, redireciona para o index (login)
    const accessToken = sessionStorage.getItem("google_access_token");
    const tokenExpiration = sessionStorage.getItem("token_expiration");
    const userEmail = sessionStorage.getItem("user_email");

    if (!accessToken || !tokenExpiration || Date.now() >= parseInt(tokenExpiration) || !userEmail) {
        alert("Sua sessão expirou ou você não está logado.");
        sessionStorage.clear();
        window.location.href = "../index.html"; 
        return;
    }

    const userId = userEmail.replace(/[.#$[\]]/g, "_");
    let pastaDriveId = null; // ID da pasta criada no Google Drive para este Zine

    // 4. Preenche o input do Zine com base na quantidade de zines já criados pelo usuário ("Sem titulo 01", etc.)
    async function sugerirNomeZine() {
        try {
            const q = query(collection(db, "zines"), where("userId", "==", userId));
            const querySnapshot = await getDocs(q);
            const totalZines = querySnapshot.size + 1;
            const numeroFormatado = String(totalZines).padStart(2, '0');
            zineNameInput.value = `Sem titulo ${numeroFormatado}`;
        } catch (error) {
            console.error("Erro ao calcular sequência de Zines:", error);
            zineNameInput.value = "Sem titulo 01";
        }
    }

    await sugerirNomeZine();

    // Botão de Logout limpa a sessão e retorna ao login
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            sessionStorage.clear();
            window.location.href = "../index.html";
        });
    }

    // Função auxiliar para formatar a data atual: diaMesAnoHoraMinutoSegundo
    function obterTimestampFormatado() {
        const agora = new Date();
        const d = String(agora.getDate()).padStart(2, '0');
        const m = String(agora.getMonth() + 1).padStart(2, '0');
        const y = agora.getFullYear();
        const h = String(agora.getHours()).padStart(2, '0');
        const min = String(agora.getMinutes()).padStart(2, '0');
        const s = String(agora.getSeconds()).padStart(2, '0');
        return `${d}${m}${y}${h}${min}${s}`;
    }

    // 6. Função para criar a pasta dedicada no Google Drive antes do primeiro upload
    async function garantirPastaNoDrive() {
        if (pastaDriveId) return pastaDriveId;

        const nomeBaseZine = zineNameInput.value.trim() || "Zine";
        const timestamp = obterTimestampFormatado();
        const nomePastaFinal = `${nomeBaseZine}_${timestamp}_${userId}`;

        const metadata = {
            name: nomePastaFinal,
            mimeType: 'application/vnd.google-apps.folder'
        };

        const response = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: new Headers({
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Detalhes do erro 403/Drive:", errorData);
            throw new Error(`Erro ao criar pasta no Google Drive (${response.status}): ${response.statusText}`);
        }

        const folderData = await response.json();
        pastaDriveId = folderData.id;
        return pastaDriveId;
    }

    // Lógica de renderização dos cards com base no template selecionado
    templateSelect.addEventListener("change", function () {
        const quantidade = parseInt(this.value);
        templatesUpload.innerHTML = "";

        if (isNaN(quantidade)) return;

        for (let i = 1; i <= quantidade; i++) {
            const colDiv = document.createElement("div");
            colDiv.className = "col-md-3 mb-4";

            // Corrigido o caminho da imagem padrão e removido o loop do onerror
            colDiv.innerHTML = `
                <div class="card shadow-sm" style="width: 100%;">
                    <img class="card-img-top card-img-${i}" src="../assets/imgNotFound.jpg" alt="Capa ${i}" style="height: 180px; object-fit: cover;">
                    <div class="card-body text-center">
                        <h5 class="card-title">Capa ${i}</h5>
                        <input type="file" id="fileInput-${i}" class="d-none" accept="image/jpeg, image/png">
                        <button type="button" class="btn btn-primary btn-upload w-100" data-id="${i}">Selecionar Imagem</button>
                    </div>
                </div>
            `;
            templatesUpload.appendChild(colDiv);
        }

        ativarEventosUpload();
    });

    function ativarEventosUpload() {
        document.querySelectorAll(".btn-upload").forEach(botao => {
            botao.addEventListener("click", function () {
                const id = this.getAttribute("data-id");
                document.getElementById(`fileInput-${id}`).click();
            });
        });

        document.querySelectorAll("input[type='file']").forEach(input => {
            input.onchange = async function (event) {
                const file = event.target.files[0];
                if (!file) return;

                if (file.type === "image/jpeg" || file.type === "image/png") {
                    const idCard = input.id.split("-")[1];
                    const card = input.closest(".card");
                    const imagemCard = card.querySelector(".card-img-top");
                    
                    imagemCard.style.opacity = "0.4";

                    try {
                        // Garante que a pasta única do Zine foi criada no Drive
                        const folderId = await garantirPastaNoDrive();

                        // Faz o upload da imagem para dentro da pasta específica do Zine no Drive
                        const downloadURL = await salvarCapaNoDrive(file, accessToken, folderId);

                        imagemCard.src = downloadURL;
                        imagemCard.style.opacity = "1";

                        // 5. Salva ou atualiza o registo do Zine no Firestore para futura listagem
                        const zineId = `${userId}_${zineNameInput.value.replace(/\s+/g, '_')}`;
                        const zineRef = doc(db, "zines", zineId);

                        const zineData = {
                            id: zineId,
                            userId: userId,
                            userEmail: userEmail,
                            nomeZine: zineNameInput.value,
                            pastaDriveId: folderId,
                            templateQuantidade: templateSelect.value,
                            atualizadoEm: new Date().toISOString()
                        };

                        await setDoc(zineRef, zineData, { merge: true });
                        console.log(`Capa ${idCard} salva no Drive e metadados atualizados no Firestore!`);

                    } catch (error) {
                        console.error("Erro detalhado no processo:", error);
                        
                        if (error.message && (error.message.includes("401") || error.message.includes("Unauthorized"))) {
                            sessionStorage.clear();
                            alert("Sua sessão expirou. Por favor, faça login novamente.");
                            window.location.href = "../index.html";
                        } else {
                            alert("Erro detalhado: " + error.message);
                        }
                        imagemCard.style.opacity = "1";
                    }

                } else {
                    alert("Apenas arquivos JPEG ou PNG são permitidos.");
                    this.value = "";
                }
            };
        });
    }
});