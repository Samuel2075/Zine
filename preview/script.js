document.addEventListener("DOMContentLoaded", function () {
    const items = document.querySelectorAll('.carousel-item');
    const total = items.length;
    let current = 0;

    if (total > 0) {
        items[0].classList.add('active');
    }

    const moveRightBtn = document.getElementById('moveRight');
    const moveLeftBtn = document.getElementById('moveLeft');

    if (moveRightBtn) {
        moveRightBtn.addEventListener('click', function () {
            let next = current;
            current = current + 1;
            setSlide(next, current);
        });
    }

    if (moveLeftBtn) {
        moveLeftBtn.addEventListener('click', function () {
            let prev = current;
            current = current - 1;
            setSlide(prev, current);
        });
    }

    function setSlide(prev, next) {
        let slide = current;
        if (next > total - 1) {
            slide = 0;
            current = 0;
        }
        if (next < 0) {
            slide = total - 1;
            current = total - 1;
        }

        if (items[prev]) {
            items[prev].classList.remove('active');
        }
        if (items[slide]) {
            items[slide].classList.add('active');
        }

        setTimeout(function () {
            // Callback vazio equivalente ao setTimeout original
        }, 800);

        console.log('current ' + current);
        console.log('prev ' + prev);
    }
});