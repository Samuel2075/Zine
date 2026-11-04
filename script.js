import { salvarCapaNoDrive } from "./config/drive-repository.js";

document.addEventListener("DOMContentLoaded", function () {
    const templateSelect = document.getElementById("templateSelect");
    const templatesUpload = document.getElementById("templatesUpload");

    templateSelect.addEventListener("change", function () {
        const quantidade = parseInt(this.value);
        templatesUpload.innerHTML = "";

        if (isNaN(quantidade)) return;

        for (let i = 1; i <= quantidade; i++) {
            const colDiv = document.createElement("div");
            colDiv.className = "col-md-3 mb-4";

            colDiv.innerHTML = `
                <div class="card" style="width: 100%;">
                    <img class="card-img-top card-img-${i}" src="assets/imgNotFound.jpg" alt="Capa ${i}" style="height: 180px; object-fit: cover;">
                    <div class="card-body">
                        <h5 class="card-title">Capa ${i}</h5>
                        <input type="file" id="fileInput-${i}" class="d-none" accept="image/jpeg, image/png">
                        <button type="button" class="btn btn-primary btn-upload" data-id="${i}">Upload</button>
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
                        // ATENÇÃO: Aqui você deve passar o Access Token obtido no login do Google do usuário
                        const accessToken = sessionStorage.getItem("google_access_token"); 
                        
                        if (!accessToken) {
                            alert("Você precisa fazer login com sua conta Google antes de enviar arquivos.");
                            imagemCard.style.opacity = "1";
                            return;
                        }

                        // ID opcional da pasta no Drive onde você quer salvar os arquivos
                        const pastaId = "COLOQUE_O_ID_DA_PASTA_AQUI_SE_QUISER"; 

                        // Faz o upload direto para o Google Drive
                        const downloadURL = await salvarCapaNoDrive(file, accessToken, pastaId);

                        imagemCard.src = downloadURL;
                        imagemCard.style.opacity = "1";
                        console.log(`Capa ${idCard} enviada para o Google Drive com sucesso!`);

                    } catch (error) {
                        alert("Erro ao enviar a imagem para o Google Drive.");
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