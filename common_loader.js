async function loadComponent(selector, file) {
    const element = document.querySelector(selector);
    if (element) {
        const response = await fetch(file);
        if (response.ok) {
            element.innerHTML = await response.text();
        } else {
            console.error(`Failed to load ${file}: ${response.status}`);
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
