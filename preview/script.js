import { db } from "../config/firebase-config.js";
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async function () {
    const bookContainer = document.getElementById("bookContainer");
    const zineTitleEl = document.getElementById("zineTitle");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    
    const btnAbrirComentario = document.getElementById("btnAbrirComentario");
    const modalComentarioEl = document.getElementById("modalComentario");
    const modalComentario = window.bootstrap ? new bootstrap.Modal(modalComentarioEl) : null;
    const txtComentario = document.getElementById("txtComentario");
    const selectPaginaAlvo = document.getElementById("selectPaginaAlvo");
    const seletorPaginaContainer = document.getElementById("seletorPaginaContainer");
    const comentarioAtualContainer = document.getElementById("comentarioAtualContainer");
    const sugestoesMentions = document.getElementById("sugestoesMentions");

    const inputAnexo = document.getElementById("inputAnexo");
    const previewAnexoContainer = document.getElementById("previewAnexoContainer");
    const imgPreviewAnexo = document.getElementById("imgPreviewAnexo");
    let anexoBase64 = null;

    const urlParams = new URLSearchParams(window.location.search);
    const zineId = urlParams.get("id");

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

    if (!zineId) {
        mostrarNotificacao("Zine não encontrado.", "error");
        setTimeout(() => window.location.href = "../index.html?restaurar=true", 1500);
        return;
    }

    let zineAtualData = null;
    let paginasUrls = [];
    let carouselItems = [];
    let currentIndex = 0;
    let meusZinesCache = [];

    // Carregar APENAS zines do utilizador logado usando localStorage para garantir consistência
    async function carregarMeusZinesParaMention() {
        const userEmailLogado = localStorage.getItem("user_email");
        if (!userEmailLogado) return;

        try {
            const snapshot = await getDocs(collection(db, "zines"));
            meusZinesCache = [];
            snapshot.forEach(d => {
                const data = d.data();
                if (data.userEmail === userEmailLogado) {
                    meusZinesCache.push(data);
                }
            });
        } catch (e) {
            console.error("Erro ao carregar cache de zines pessoais:", e);
        }
    }
    carregarMeusZinesParaMention();

    try {
        const docRef = doc(db, "zines", zineId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            mostrarNotificacao("Zine não existe.", "error");
            setTimeout(() => window.location.href = "../index.html?restaurar=true", 1500);
            return;
        }

        zineAtualData = docSnap.data();
        zineTitleEl.textContent = zineAtualData.nomeZine;
        paginasUrls = zineAtualData.paginas || [];

        montarEstruturaLivro(paginasUrls);
        atualizarExibicaoComentarioPagina(currentIndex);

    } catch (error) {
        console.error("Erro ao carregar zine para preview:", error);
        zineTitleEl.textContent = "Erro ao carregar";
    }

    function montarEstruturaLivro(paginas) {
        bookContainer.innerHTML = "";
        carouselItems = [];

        if (paginas.length === 0) return;

        let slidesArray = [];
        slidesArray.push({ type: 'single', index: 0, url: paginas[0] });

        let i = 1;
        const totalPaginas = paginas.length;

        while (i < totalPaginas - 1) {
            let leftUrl = paginas[i];
            let rightUrl = paginas[i + 1];

            if (rightUrl) {
                slidesArray.push({ 
                    type: 'double', 
                    leftIndex: i, leftUrl: leftUrl, 
                    rightIndex: i + 1, rightUrl: rightUrl 
                });
                i += 2;
            } else {
                slidesArray.push({ type: 'single', index: i, url: leftUrl });
                i += 1;
            }
        }

        if (totalPaginas > 1 && (totalPaginas - 1) >= i) {
            slidesArray.push({ type: 'single', index: totalPaginas - 1, url: paginas[totalPaginas - 1] });
        }

        slidesArray.forEach((slide, idx) => {
            const itemDiv = document.createElement("div");
            itemDiv.className = `carousel-item ${idx === 0 ? 'active show' : ''}`;

            if (slide.type === 'single') {
                itemDiv.innerHTML = `
                    <article class="singlePage" style="background-image: url('${slide.url}');">
                        <span class="pagenumber">${slide.index + 1}</span>
                    </article>
                `;
                itemDiv.dataset.indicesPaginas = JSON.stringify([slide.index]);
            } else {
                itemDiv.className += " carousel-item--double";
                itemDiv.innerHTML = `
                    <article class="leftPage" style="background-image: url('${slide.leftUrl}');">
                        <span class="pagenumber">${slide.leftIndex + 1}</span>
                    </article>
                    <article class="rightPage" style="background-image: url('${slide.rightUrl}');">
                        <span class="pagenumber">${slide.rightIndex + 1}</span>
                    </article>
                `;
                itemDiv.dataset.indicesPaginas = JSON.stringify([slide.leftIndex, slide.rightIndex]);
            }

            bookContainer.appendChild(itemDiv);
            carouselItems.push(itemDiv);
        });
    }

    function mostrarSlide(index) {
        carouselItems.forEach((item, idx) => {
            item.classList.remove("active", "show");
            if (idx === index) {
                item.classList.add("active", "show");
            }
        });

        const indices = JSON.parse(carouselItems[index].dataset.indicesPaginas);
        atualizarExibicaoComentarioPagina(indices[0]);
    }

    prevBtn.addEventListener("click", () => {
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : carouselItems.length - 1;
        mostrarSlide(currentIndex);
    });

    nextBtn.addEventListener("click", () => {
        currentIndex = (currentIndex < carouselItems.length - 1) ? currentIndex + 1 : 0;
        mostrarSlide(currentIndex);
    });

    // Inserção de Emojis
    document.querySelectorAll(".btn-emoji").forEach(btn => {
        btn.addEventListener("click", function() {
            txtComentario.value += this.textContent;
            txtComentario.focus();
        });
    });

    // Processar Imagem Anexada
    if (inputAnexo) {
        inputAnexo.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    anexoBase64 = evt.target.result;
                    imgPreviewAnexo.src = anexoBase64;
                    previewAnexoContainer.classList.remove("d-none");
                };
                reader.readAsDataURL(file);
            } else {
                anexoBase64 = null;
                previewAnexoContainer.classList.add("d-none");
            }
        });
    }

    btnAbrirComentario.addEventListener("click", () => {
        const itemAtual = carouselItems[currentIndex];
        const indices = JSON.parse(itemAtual.dataset.indicesPaginas);

        txtComentario.value = "";
        anexoBase64 = null;
        if (inputAnexo) inputAnexo.value = "";
        if (previewAnexoContainer) previewAnexoContainer.classList.add("d-none");
        selectPaginaAlvo.innerHTML = "";

        if (indices.length > 1) {
            seletorPaginaContainer.classList.remove("d-none");
            selectPaginaAlvo.innerHTML = `
                <option value="${indices[0]}">Página Esquerda (Página ${indices[0] + 1})</option>
                <option value="${indices[1]}">Página Direita (Página ${indices[1] + 1})</option>
            `;
        } else {
            seletorPaginaContainer.classList.add("d-none");
            selectPaginaAlvo.innerHTML = `<option value="${indices[0]}">Página ${indices[0] + 1}</option>`;
        }

        modalComentario.show();
    });

    // Filtro de Autocompletar @ apenas com Meus Zines
    txtComentario.addEventListener("input", function() {
        const val = this.value;
        const cursorPos = this.selectionStart;
        const textoAteCursor = val.substring(0, cursorPos);
        const match = textoAteCursor.match(/@(\w*)$/);

        if (match) {
            const termoBusca = match[1].toLowerCase();
            const filtrados = meusZinesCache.filter(z => z.nomeZine.toLowerCase().includes(termoBusca));

            if (filtrados.length > 0) {
                sugestoesMentions.innerHTML = "";
                filtrados.forEach(z => {
                    const item = document.createElement("button");
                    item.type = "button";
                    item.className = "list-group-item list-group-item-action list-group-item-dark py-1 small";
                    item.textContent = z.nomeZine;
                    item.onclick = () => {
                        const antes = val.substring(0, cursorPos - match[0].length);
                        const depois = val.substring(cursorPos);
                        txtComentario.value = `${antes}@${z.nomeZine} ${depois}`;
                        sugestoesMentions.classList.add("d-none");
                        txtComentario.focus();
                    };
                    sugestoesMentions.appendChild(item);
                });
                sugestoesMentions.classList.remove("d-none");
            } else {
                sugestoesMentions.classList.add("d-none");
            }
        } else {
            sugestoesMentions.classList.add("d-none");
        }
    });

    // Salvar Comentário
    document.getElementById("btnSalvarComentario").addEventListener("click", async () => {
        const texto = txtComentario.value.trim();
        if (!texto && !anexoBase64) {
            mostrarNotificacao("Escreva um comentário ou anexe uma imagem.", "error");
            return;
        }

        const paginaAlvo = selectPaginaAlvo.classList.contains("d-none") 
            ? JSON.parse(carouselItems[currentIndex].dataset.indicesPaginas)[0] 
            : parseInt(selectPaginaAlvo.value);

        const userEmail = localStorage.getItem("user_email");
        const userNickname = localStorage.getItem("user_nickname") || userEmail;

        if (!userEmail) {
            mostrarNotificacao("Você precisa estar logado para comentar.", "error");
            return;
        }

        let zineCitadoId = null;
        meusZinesCache.forEach(z => {
            if (texto.includes(`@${z.nomeZine}`)) {
                zineCitadoId = z.id;
            }
        });

        if (!zineAtualData.comentarios) {
            zineAtualData.comentarios = {};
        }

        zineAtualData.comentarios[paginaAlvo] = {
            texto: texto,
            autorEmail: userEmail,
            autorNickname: userNickname,
            zineCitadoId: zineCitadoId,
            anexoUrl: anexoBase64 || null,
            atualizadoEm: new Date().toISOString()
        };

        try {
            const zineRef = doc(db, "zines", zineAtualData.id);
            await setDoc(zineRef, { comentarios: zineAtualData.comentarios }, { merge: true });
            modalComentario.hide();
            mostrarNotificacao("Comentário salvo com sucesso!");
            atualizarExibicaoComentarioPagina(paginaAlvo);
        } catch (e) {
            console.error("Erro ao salvar comentário:", e);
            mostrarNotificacao("Erro ao salvar comentário.", "error");
        }
    });

    function atualizarExibicaoComentarioPagina(indicePagina) {
        if (zineAtualData && zineAtualData.comentarios && zineAtualData.comentarios[indicePagina]) {
            const com = zineAtualData.comentarios[indicePagina];
            comentarioAtualContainer.classList.remove("d-none");
            
            let linkCitacao = "";
            if (com.zineCitadoId) {
                // Caminho corrigido para garantir que aponta corretamente para o preview a partir da subpasta
                linkCitacao = `<br><a href="preview/index.html?id=${com.zineCitadoId}" target="_blank" rel="noopener noreferrer" class="text-info text-decoration-underline small mt-1 d-inline-block">🔗 Ver Zine citado</a>`;
            }

            let anexoHtml = "";
            if (com.anexoUrl) {
                anexoHtml = `<div class="mt-2"><img src="${com.anexoUrl}" class="rounded border" style="max-height: 120px; object-fit: contain;"></div>`;
            }

            comentarioAtualContainer.innerHTML = `
                <div><strong>${com.autorNickname}:</strong> ${com.texto}</div>
                ${anexoHtml}
                ${linkCitacao}
            `;
        } else {
            comentarioAtualContainer.classList.add("d-none");
        }
    }
});