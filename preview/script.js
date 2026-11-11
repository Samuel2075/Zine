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
    const sugestoesMentions = document.getElementById("sugestoesMentions");

    const inputAnexo = document.getElementById("inputAnexo");
    const previewAnexoContainer = document.getElementById("previewAnexoContainer");
    const imgPreviewAnexo = document.getElementById("imgPreviewAnexo");
    let anexoBase64 = null;

    const urlParams = new URLSearchParams(window.location.search);
    const zineId = urlParams.get("id");

    const previewLoader = document.getElementById("previewLoader");
    const loadingProgress = document.getElementById("loadingProgress");

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
        setTimeout(() => window.location.href = "../index.html", 1500);
        return;
    }

    let zineAtualData = null;
    let paginasUrls = [];
    let slidesArray = [];
    let currentIndex = 0;
    let meusZinesCache = [];
    let animando = false;

    function preloadImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = url;
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
        });
    }

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
            setTimeout(() => window.location.href = "../index.html", 1500);
            return;
        }

        zineAtualData = docSnap.data();
        zineTitleEl.textContent = zineAtualData.nomeZine;
        paginasUrls = zineAtualData.paginas || [];

        if (loadingProgress) loadingProgress.textContent = `A carregar 0/${paginasUrls.length} páginas...`;

        let carregadas = 0;
        const promises = paginasUrls.map(async (url) => {
            await preloadImage(url);
            carregadas++;
            if (loadingProgress) {
                loadingProgress.textContent = `A carregar ${carregadas}/${paginasUrls.length} páginas...`;
            }
        });

        await Promise.all(promises);

        // Desbloqueia os cliques imediatamente e remove o loader da árvore do DOM
        if (previewLoader) {
            previewLoader.style.opacity = "0";
            previewLoader.style.pointerEvents = "none";
            setTimeout(() => {
                previewLoader.remove();
            }, 500);
        }

        gerarSlidesDoLivro(paginasUrls);
        renderizarSpreadAtual();

    } catch (error) {
        console.error("Erro ao carregar zine para preview:", error);
        zineTitleEl.textContent = "Erro ao carregar";
        if (previewLoader) previewLoader.remove();
    }

    function gerarSlidesDoLivro(paginas) {
        slidesArray = [];
        if (paginas.length === 0) return;

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
    }

    function renderizarSpreadAtual() {
        const spreadAnterior = bookContainer.querySelector(".book-spread");
        if (spreadAnterior) spreadAnterior.remove();

        const slide = slidesArray[currentIndex];
        const spreadDiv = document.createElement("div");
        spreadDiv.className = "book-spread";

        if (slide.type === 'single') {
            spreadDiv.innerHTML = `
                <article class="singlePage" style="background-image: url('${slide.url}');"></article>
            `;
        } else {
            spreadDiv.innerHTML = `
                <article class="leftPage" style="background-image: url('${slide.leftUrl}');"></article>
                <article class="rightPage" style="background-image: url('${slide.rightUrl}');"></article>
            `;
        }

        bookContainer.insertBefore(spreadDiv, bookContainer.firstChild);
    }

    function mudarPagina(novoIndex, direcao) {
        if (animando || novoIndex === currentIndex || novoIndex < 0 || novoIndex >= slidesArray.length) return;

        const slideAntigo = slidesArray[currentIndex];
        const slideNovo = slidesArray[novoIndex];

        const deveAnimar = (slideAntigo.type === 'double' && slideNovo.type === 'double');

        if (!deveAnimar) {
            currentIndex = novoIndex;
            renderizarSpreadAtual();
            return;
        }

        animando = true;

        const turningPage = document.createElement("div");
        turningPage.className = `turning-page ${direcao === 'next' ? 'right-to-left' : 'left-to-right'}`;

        const faceFront = document.createElement("div");
        faceFront.className = "page-face front";

        const faceBack = document.createElement("div");
        faceBack.className = "page-face back";

        if (direcao === 'next') {
            faceFront.style.backgroundImage = `url('${slideAntigo.rightUrl}')`;
            faceFront.style.backgroundSize = "100% 100%";
            faceFront.style.backgroundPosition = "right center";

            faceBack.style.backgroundImage = `url('${slideNovo.leftUrl}')`;
            faceBack.style.backgroundSize = "100% 100%";
            faceBack.style.backgroundPosition = "left center";
        } else {
            faceFront.style.backgroundImage = `url('${slideAntigo.leftUrl}')`;
            faceFront.style.backgroundSize = "100% 100%";
            faceFront.style.backgroundPosition = "left center";

            faceBack.style.backgroundImage = `url('${slideNovo.rightUrl}')`;
            faceBack.style.backgroundSize = "100% 100%";
            faceBack.style.backgroundPosition = "right center";
        }

    	turningPage.appendChild(faceFront);
        turningPage.appendChild(faceBack);
        bookContainer.appendChild(turningPage);
        
        setTimeout(() => {
            currentIndex = novoIndex;
            renderizarSpreadAtual();
        }, 250);

        setTimeout(() => {
            turningPage.remove();
            animando = false;
        }, 500);
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            mudarPagina(currentIndex - 1, 'prev');
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            mudarPagina(currentIndex + 1, 'next');
        });
    }

    document.querySelectorAll(".btn-emoji").forEach(btn => {
        btn.addEventListener("click", function () {
            txtComentario.value += this.textContent;
            txtComentario.focus();
        });
    });

    if (inputAnexo) {
        inputAnexo.addEventListener("change", function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (evt) {
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
        const slideAtual = slidesArray[currentIndex];
        txtComentario.value = "";
        anexoBase64 = null;
        if (inputAnexo) inputAnexo.value = "";
        if (previewAnexoContainer) previewAnexoContainer.classList.add("d-none");
        selectPaginaAlvo.innerHTML = "";

        if (slideAtual.type === 'double') {
            seletorPaginaContainer.classList.remove("d-none");
            selectPaginaAlvo.innerHTML = `
                <option value="${slideAtual.leftIndex}">Página Esquerda (Página ${slideAtual.leftIndex + 1})</option>
                <option value="${slideAtual.rightIndex}">Página Direita (Página ${slideAtual.rightIndex + 1})</option>
            `;
        } else {
            seletorPaginaContainer.classList.add("d-none");
            selectPaginaAlvo.innerHTML = `<option value="${slideAtual.index}">Página ${slideAtual.index + 1}</option>`;
        }

        modalComentario.show();
    });

    txtComentario.addEventListener("input", function () {
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

    document.getElementById("btnSalvarComentario").addEventListener("click", async () => {
        const texto = txtComentario.value.trim();
        if (!texto && !anexoBase64) {
            mostrarNotificacao("Escreva um comentário ou anexe uma imagem.", "error");
            return;
        }

        const slideAtual = slidesArray[currentIndex];
        const paginaAlvo = selectPaginaAlvo.classList.contains("d-none")
            ? slideAtual.index
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
        } catch (e) {
            console.error("Erro ao salvar comentário:", e);
            mostrarNotificacao("Erro ao salvar comentário.", "error");
        }
    });
});