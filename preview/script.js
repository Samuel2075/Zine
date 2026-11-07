import { db } from "../config/firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const zineId = urlParams.get("id");

    const magazineContainer = document.getElementById("magazineContainer");
    const navElement = document.getElementById("pageNav") || document.querySelector('.carousel__nav');
    const titleEl = document.getElementById("zineTitle");

    if (!zineId) {
        magazineContainer.innerHTML = `<p style="color: #ff6b6b; text-align: center; width: 100%; margin-top: 50px;">Zine não encontrado.</p>`;
        return;
    }

    try {
        const docRef = doc(db, "zines", zineId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            magazineContainer.innerHTML = `<p style="color: #ff6b6b; text-align: center; width: 100%; margin-top: 50px;">Zine não existe no sistema.</p>`;
            return;
        }

        const zineData = docSnap.data();
        if (titleEl) titleEl.textContent = zineData.nomeZine;

        // Garante que usamos o array de páginas salvo
        const paginas = zineData.paginas || [];

        if (paginas.length === 0) {
            magazineContainer.innerHTML = `<p style="color: #f39c12; text-align: center; width: 100%; margin-top: 50px;">Nenhuma página encontrada neste Zine.</p>`;
            return;
        }

        const oldItems = magazineContainer.querySelectorAll('.carousel-item');
        oldItems.forEach(item => item.remove());

        let itemIndex = 1;
        const totalPaginas = paginas.length;

        // 1. PRIMEIRA PÁGINA SOZINHA (Capa - Posição 0 do array)
        if (totalPaginas > 0) {
            const urlCapa = paginas[0] || "../assets/imgNotFound.jpg";
            const singleItemDiv = document.createElement("div");
            singleItemDiv.className = `carousel-item carousel-item--single ${itemIndex === 1 ? 'active' : ''}`;
            
            singleItemDiv.innerHTML = `
                <article class="singlePage page" style="background-image: url('${urlCapa}');">
                    <span class="pagenumber">1</span>
                </article>
            `;
            if (navElement) {
                magazineContainer.insertBefore(singleItemDiv, navElement);
            } else {
                magazineContainer.appendChild(singleItemDiv);
            }
            itemIndex++;
        }

        // 2. PÁGINAS INTERMÉDIAS EM DUPLA (Do índice 1 até o penúltimo, se houver)
        let i = 1;
        
        // Determina se a última página deve ficar sozinha (caso o total seja par ou ímpar, dependendo da regra de negócio: se quiser a última sempre sozinha quando for par >= 4 ou ímpar)
        // Aqui assumimos que se o total for par (ex: 8 páginas), a última (8) fica sozinha, logo as duplas vão até totalPaginas - 1.
        // Se o total for ímpar, a última também fica sozinha.
        const limiteDuplas = (totalPaginas % 2 === 0 && totalPaginas > 2) ? totalPaginas - 1 : totalPaginas;

        while (i < limiteDuplas) {
            const pageNumLeft = i + 1;
            const urlLeft = paginas[i] || "../assets/imgNotFound.jpg";
            
            let rightArticleHtml = '';
            let pageNumRight = '';

            if (i + 1 < limiteDuplas) {
                pageNumRight = i + 2;
                const urlRight = paginas[i + 1];
                rightArticleHtml = `
                    <article class="rightPage page" style="background-image: url('${urlRight}');">
                        <span class="pagenumber">${pageNumRight}</span>
                    </article>
                `;
                i += 2;
            } else {
                rightArticleHtml = `
                    <article class="rightPage page" style="background: #1f1f1f;">
                        <span class="pagenumber">${i + 2}</span>
                    </article>
                `;
                i += 1;
            }

            const carouselItemDiv = document.createElement("div");
            carouselItemDiv.className = `carousel-item carousel-item--double`;

            carouselItemDiv.innerHTML = `
                <article class="leftPage page" style="background-image: url('${urlLeft}');">
                    <span class="pagenumber">${pageNumLeft}</span>
                </article>
                ${rightArticleHtml}
            `;

            if (navElement) {
                magazineContainer.insertBefore(carouselItemDiv, navElement);
            } else {
                magazineContainer.appendChild(carouselItemDiv);
            }
            itemIndex++;
        }

        // 3. ÚLTIMA PÁGINA SOZINHA (Contracapa / Ex: Página 8)
        if (totalPaginas > 1 && (totalPaginas % 2 === 0 || totalPaginas > limiteDuplas)) {
            const ultimaPaginaIndex = totalPaginas - 1;
            const urlContracapa = paginas[ultimaPaginaIndex] || "../assets/imgNotFound.jpg";
            const lastSingleDiv = document.createElement("div");
            lastSingleDiv.className = `carousel-item carousel-item--single`;

            lastSingleDiv.innerHTML = `
                <article class="singlePage page" style="background-image: url('${urlContracapa}');">
                    <span class="pagenumber">${totalPaginas}</span>
                </article>
            `;
            if (navElement) {
                magazineContainer.insertBefore(lastSingleDiv, navElement);
            } else {
                magazineContainer.appendChild(lastSingleDiv);
            }
        }

        // Navegação do carrossel
        const items = document.querySelectorAll('.carousel-item');
        const total = items.length;
        let current = 0;

        const moveRightBtn = document.getElementById('moveRight');
        const moveLeftBtn = document.getElementById('moveLeft');

        if (moveRightBtn) {
            moveRightBtn.addEventListener('click', function () {
                let prev = current;
                current = (current + 1) % total;
                setSlide(prev, current);
            });
        }

        if (moveLeftBtn) {
            moveLeftBtn.addEventListener('click', function () {
                let prev = current;
                current = (current - 1 + total) % total;
                setSlide(prev, current);
            });
        }

        function setSlide(prev, next) {
            if (items[prev]) {
                items[prev].classList.remove('active');
            }
            if (items[next]) {
                items[next].classList.add('active');
            }
        }

    } catch (error) {
        console.error("Erro ao carregar o Zine do Firestore:", error);
        magazineContainer.innerHTML = `<p style="color: #ff6b6b; text-align: center; width: 100%; margin-top: 50px;">Erro ao carregar as páginas.</p>`;
    }
});