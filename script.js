document.addEventListener('finishedLoadingComponents', function() {
    document.querySelectorAll('a[href^="/#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const element = document.querySelector(this.getAttribute('href').replace('/', ''));
            if(element === null) {
                window.location.href = this.getAttribute('href');
                return;
            }

            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

        });
    });
});
