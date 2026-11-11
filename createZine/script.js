import { db } from "../config/firebase-config.js";
import { collection, getDocs, getDoc, query, where, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { salvarCapaNoDrive } from "../config/drive-repository.js";

document.addEventListener("DOMContentLoaded", async function () {
    const templateSelect = document.getElementById("templateSelect");
    const templatesUpload = document.getElementById("templatesUpload");
    const zineNameInput = document.getElementById("zineName");
    const btnLogout = document.getElementById("btnLogout");
    const btnPublicar = document.getElementById("btnPublicar");
    const btnVisualizar = document.getElementById("btnVisualizar");
    const btnVoltarIncio = document.querySelector("a[href='../index.html']");

    const accessToken = localStorage.getItem("google_access_token");
    const tokenExpiration = localStorage.getItem("token_expiration");
    const userEmail = localStorage.getItem("user_email");

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

    if (!accessToken || !tokenExpiration || Date.now() >= parseInt(tokenExpiration) || !userEmail) {
        mostrarNotificacao("Sua sessão expirou ou você não está logado.", "error");
        localStorage.clear();
        setTimeout(() => window.location.href = "../index.html", 1500);
        return;
    }

    const userId = userEmail.replace(/[.#$[\]]/g, "_");
    let pastaDriveId = null; 
    let zineIdFinal = "";
    let paginasUrls = [];
    let publicadoState = false;
    let comentariosData = {};

    const urlParams = new URLSearchParams(window.location.search);
    let zineEditId = urlParams.get("edit");

    if (!zineEditId) {
        sessionStorage.removeItem("current_editing_zine_id");
    } else {
        sessionStorage.setItem("current_editing_zine_id", zineEditId);
    }

    zineEditId = sessionStorage.getItem("current_editing_zine_id");

    if (zineEditId) {
        try {
            const docRef = doc(db, "zines", zineEditId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const zineData = docSnap.data();
                zineNameInput.value = zineData.nomeZine;
                pastaDriveId = zineData.pastaDriveId;
                templateSelect.value = zineData.templateQuantidade || "";
                zineIdFinal = zineData.id;
                paginasUrls = zineData.paginas || [];
                publicadoState = zineData.publicado || false;
                comentariosData = zineData.comentarios || {};

                atualizarVisualBotoesAcao();
                
                if (zineData.templateQuantidade) {
                    await renderizarCardsEImagens(parseInt(zineData.templateQuantidade), paginasUrls);
                }
            }
        } catch (error) {
            console.error("Erro ao carregar zine para edição:", error);
        }
    } 
    
    if (!zineIdFinal && !urlParams.get("edit")) {
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
    }

    async function salvarZineNoFirestore() {
        if (!zineNameInput.value.trim()) return;

        if (!zineIdFinal) {
            zineIdFinal = `${userId}_${zineNameInput.value.trim().replace(/\s+/g, '_')}`;
            sessionStorage.setItem("current_editing_zine_id", zineIdFinal);
            
            const novaUrl = `${window.location.pathname}?edit=${zineIdFinal}`;
            window.history.replaceState({ path: novaUrl }, '', novaUrl);
            
            comentariosData = {};
        }

        const zineRef = doc(db, "zines", zineIdFinal);
        const zineData = {
            id: zineIdFinal,
            userId: userId,
            userEmail: userEmail,
            nomeZine: zineNameInput.value.trim(),
            pastaDriveId: pastaDriveId || "",
            templateQuantidade: templateSelect.value || "",
            paginas: paginasUrls,
            publicado: publicadoState,
            comentarios: comentariosData,
            atualizadoEm: new Date().toISOString()
        };

        try {
            await setDoc(zineRef, zineData, { merge: true });
            atualizarVisualBotoesAcao();
        } catch (error) {
            console.error("Erro ao salvar zine automaticamente:", error);
        }
    }

    zineNameInput.addEventListener("blur", salvarZineNoFirestore);
    
    templateSelect.addEventListener("change", async function () {
        const quantidade = parseInt(this.value);
        if (!isNaN(quantidade)) {
            await renderizarCardsEImagens(quantidade, paginasUrls);
            await salvarZineNoFirestore();
        }
    });

    if (btnVisualizar) {
        btnVisualizar.addEventListener("click", async function () {
            await salvarZineNoFirestore();
            if (zineIdFinal) {
                window.location.href = `../preview/index.html?id=${zineIdFinal}&origin=create`;
            } else {
                mostrarNotificacao("Preencha o nome e selecione um template para visualizar.", "error");
            }
        });
    }

    if (btnVoltarIncio) {
        btnVoltarIncio.addEventListener("click", async function (e) {
            e.preventDefault();
            await salvarZineNoFirestore();
            sessionStorage.removeItem("current_editing_zine_id");
            window.location.href = "../index.html";
        });
    }

    function atualizarVisualBotoesAcao() {
        if (zineIdFinal && templateSelect.value) {
            btnVisualizar.style.display = "inline-block";
            btnPublicar.style.display = "inline-block";
        } else {
            btnVisualizar.style.display = "none";
            btnPublicar.style.display = "none";
        }

        if (publicadoState) {
            btnPublicar.textContent = "Despublicar Zine";
            btnPublicar.className = "btn btn-danger btn-sm";
        } else {
            btnPublicar.textContent = "Publicar Zine";
            btnPublicar.className = "btn btn-success btn-sm";
        }
    }

    if (btnPublicar) {
        btnPublicar.addEventListener("click", async () => {
            await salvarZineNoFirestore();
            publicadoState = !publicadoState;
            atualizarVisualBotoesAcao();

            try {
                const zineRef = doc(db, "zines", zineIdFinal);
                await setDoc(zineRef, {
                    publicado: publicadoState,
                    atualizadoEm: new Date().toISOString()
                }, { merge: true });

                mostrarNotificacao(publicadoState ? "Zine publicado com sucesso!" : "Zine despublicado com sucesso!");
            } catch (err) {
                console.error("Erro ao atualizar status de publicação:", err);
                mostrarNotificacao("Erro ao atualizar o status.", "error");
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            await salvarZineNoFirestore();
            sessionStorage.removeItem("current_editing_zine_id");
            localStorage.clear();
            window.location.href = "../index.html";
        });
    }

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
            throw new Error(`Erro ao criar pasta no Google Drive (${response.status}): ${response.statusText}`);
        }

        const folderData = await response.json();
        pastaDriveId = folderData.id;

        await fetch(`https://www.googleapis.com/drive/v3/files/${pastaDriveId}/permissions`, {
            method: 'POST',
            headers: new Headers({
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
        });

        return pastaDriveId;
    }

    async function renderizarCardsEImagens(quantidade, urlsSalvas) {
        templatesUpload.innerHTML = "";

        for (let i = 1; i <= quantidade; i++) {
            const colDiv = document.createElement("div");
            colDiv.className = "col-md-3 mb-4";
            
            const indexArr = i - 1;
            const imagemAtual = (urlsSalvas && urlsSalvas[indexArr]) ? urlsSalvas[indexArr] : "../assets/imgNotFound.jpg";

            let tituloCapa = "";
            if (i === 1) {
                tituloCapa = "Capa";
            } else if (i === quantidade) {
                tituloCapa = "Contracapa";
            } else {
                tituloCapa = `Imagem ${i - 1}`;
            }

            colDiv.innerHTML = `
                <div class="card zine-upload-card shadow-sm h-100">
                    <img class="card-img-top card-img-${i}" src="${imagemAtual}" alt="${tituloCapa}" style="height: 180px; object-fit: cover; border-bottom: 1px solid #262626;" onerror="this.src='../assets/imgNotFound.jpg'">
                    <div class="card-body text-center d-flex flex-column justify-content-between">
                        <h6 class="card-title text-light fw-bold">${tituloCapa}</h6>
                        <input type="file" id="fileInput-${i}" class="d-none" accept="image/jpeg, image/png">
                        <button type="button" class="btn btn-sm btn-dark-custom w-100 mt-2 btn-upload" data-id="${i}">Selecionar Imagem</button>
                    </div>
                </div>
            `;
            templatesUpload.appendChild(colDiv);
        }

        ativarEventosUpload();
        atualizarVisualBotoesAcao();
    }

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
                    const idCard = parseInt(input.id.split("-")[1]);
                    const card = input.closest(".card");
                    const imagemCard = card.querySelector(".card-img-top");
                    
                    imagemCard.style.opacity = "0.4";

                    try {
                        const folderId = await garantirPastaNoDrive();
                        const downloadURL = await salvarCapaNoDrive(file, accessToken, folderId);

                        imagemCard.src = downloadURL;
                        imagemCard.style.opacity = "1";

                        paginasUrls[idCard - 1] = downloadURL;

                        await salvarZineNoFirestore();

                    } catch (error) {
                        console.error("Erro detalhado no processo:", error);
                        mostrarNotificacao("Erro ao enviar imagem: " + error.message, "error");
                        imagemCard.style.opacity = "1";
                    }

                } else {
                    mostrarNotificacao("Apenas arquivos JPEG ou PNG são permitidos.", "error");
                    this.value = "";
                }
            };
        });
    }
});