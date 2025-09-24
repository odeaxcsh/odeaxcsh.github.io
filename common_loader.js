async function loadComponent(selector, file) {
    const element = document.querySelector(selector);
    if (element) {
        // Support per-page variants: e.g., <footer data-variant="home"> -> footer.home.html
        const variant = element.dataset?.variant;
        const [name, ext] = file.split('.');
        const resolved = variant ? `${name}.${variant}.${ext}` : file;
        try {
            let response = await fetch(resolved);
            if (!response.ok && variant) {
                // Fallback to base file if variant missing
                response = await fetch(file);
            }
            if (response.ok) {
                element.innerHTML = await response.text();
            } else {
                console.error(`Failed to load ${resolved} (and fallback ${file}): ${response.status}`);
            }
        } catch (err) {
            console.error(`Error loading component ${resolved}:`, err);
        }
    }
}

let components = [
    ["header", "header.html"],
    ["footer", "footer.html"]
];

let componentsLoaded = 0;

document.addEventListener("DOMContentLoaded", () => {
    for(let [tag, file] of components) {
        loadComponent(tag, file).then(() => {
            componentsLoaded++;
            if (componentsLoaded === components.length) {
                document.dispatchEvent(new Event("finishedLoadingComponents"));
            }
        });
    }
});
