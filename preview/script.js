document.addEventListener("DOMContentLoaded", async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const folderId = urlParams.get("folderId");
    const zineName = urlParams.get("name") ? decodeURIComponent(urlParams.get("name")) : "Visualização do Zine";

    document.getElementById("zineTitle").textContent = zineName;

    const accessToken = sessionStorage.getItem("google_access_token");
    const magazineContainer = document.getElementById("magazineContainer");
    const navElement = document.getElementById("pageNav") || document.querySelector('.carousel__nav');

    if (!folderId || !accessToken) {
        magazineContainer.innerHTML = `<p style="color: #ff6b6b; text-align: center; width: 100%; margin-top: 50px;">Sessão expirada ou pasta do Zine não encontrada.</p>`;
        return;
    }

    try {
        // Busca os arquivos na pasta do Google Drive associada
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&orderBy=createdTime`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();

        if (!data.files || data.files.length === 0) {
            magazineContainer.innerHTML = `<p style="color: #f39c12; text-align: center; width: 100%; margin-top: 50px;">Nenhuma página encontrada neste Zine.</p>`;
            return;
        }

        const files = data.files;

        // Remove itens antigos do carrossel se houver, mantendo a navegação
        const oldItems = magazineContainer.querySelectorAll('.carousel-item');
        oldItems.forEach(item => item.remove());

        // Cria os blocos de páginas duplas dinamicamente com base no template
        for (let i = 0; i < files.length; i += 2) {
            const pageNumLeft = i + 1;
            const fileLeft = files[i];
            const urlLeft = `https://lh3.googleusercontent.com/d/${fileLeft.id}`;

            let rightArticleHtml = '';
            if (i + 1 < files.length) {
                const pageNumRight = i + 2;
                const fileRight = files[i + 1];
                const urlRight = `https://lh3.googleusercontent.com/d/${fileRight.id}`;
                rightArticleHtml = `
                    <article class="rightPage page" style="background-image: url('${urlRight}');">
                        <span class="pagenumber">${pageNumRight}</span>
                    </article>
                `;
            } else {
                // Se for página ímpar final, cria uma página direita vazia ou neutra
                rightArticleHtml = `
                    <article class="rightPage page" style="background: #1f1f1f;">
                        <span class="pagenumber">${i + 2}</span>
                    </article>
                `;
            }

            const itemIndex = (i / 2) + 1;
            const carouselItemDiv = document.createElement("div");
            carouselItemDiv.className = `carousel-item carousel-item--${itemIndex}`;
            if (itemIndex === 1) carouselItemDiv.classList.add('active');

            carouselItemDiv.innerHTML = `
                <article class="leftPage page" style="background-image: url('${urlLeft}');">
                    <span class="pagenumber">${pageNumLeft}</span>
                </article>
                ${rightArticleHtml}
            `;

            // Insere o item antes da barra de navegação
            magazineContainer.insertBefore(carouselItemDiv, navElement);
        }

        // Lógica de navegação do carrossel
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
        console.error("Erro ao carregar páginas do Drive:", error);
        magazineContainer.innerHTML = `<p style="color: #ff6b6b; text-align: center; width: 100%; margin-top: 50px;">Erro ao carregar as páginas do Zine.</p>`;
    }
});