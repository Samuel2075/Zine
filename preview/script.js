import { db } from "../config/firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const zineId = urlParams.get("id"); // Agora buscamos diretamente pelo ID do documento no Firestore

    const magazineContainer = document.getElementById("magazineContainer");
    const navElement = document.getElementById("pageNav") || document.querySelector('.carousel__nav');
    const titleEl = document.getElementById("zineTitle");

    if (!zineId) {
        magazineContainer.innerHTML = `<p style="color: #ff6b6b; text-align: center; width: 100%; margin-top: 50px;">Zine não encontrado.</p>`;
        return;
    }

    try {
        // Busca os dados do zine diretamente no Firestore
        const docRef = doc(db, "zines", zineId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            magazineContainer.innerHTML = `<p style="color: #ff6b6b; text-align: center; width: 100%; margin-top: 50px;">Zine não existe no sistema.</p>`;
            return;
        }

        const zineData = docSnap.data();
        if (titleEl) titleEl.textContent = zineData.nomeZine;

        const paginas = zineData.paginas || [];

        if (paginas.length === 0) {
            magazineContainer.innerHTML = `<p style="color: #f39c12; text-align: center; width: 100%; margin-top: 50px;">Nenhuma página encontrada neste Zine.</p>`;
            return;
        }

        const oldItems = magazineContainer.querySelectorAll('.carousel-item');
        oldItems.forEach(item => item.remove());

        // Cria os blocos de páginas duplas com base nos links guardados
        for (let i = 0; i < paginas.length; i += 2) {
            const pageNumLeft = i + 1;
            const urlLeft = paginas[i] || "../assets/imgNotFound.jpg";

            let rightArticleHtml = '';
            if (i + 1 < paginas.length && paginas[i + 1]) {
                const pageNumRight = i + 2;
                const urlRight = paginas[i + 1];
                rightArticleHtml = `
                    <article class="rightPage page" style="background-image: url('${urlRight}');">
                        <span class="pagenumber">${pageNumRight}</span>
                    </article>
                `;
            } else {
                rightArticleHtml = `
                    <article class="rightPage page" style="background: #1f1f1f;">
                        <span class="pagenumber">${i + 2}</span>
                    </article>
                `;
            }

            const itemIndex = (i / 2) + 1;
            const carouselItemDiv = document.createElement("div");
            
            if (itemIndex === 1) {
                carouselItemDiv.className = `carousel-item carousel-item--${itemIndex} active`;
            } else {
                carouselItemDiv.className = `carousel-item carousel-item--${itemIndex}`;
            }

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