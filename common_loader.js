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

document.addEventListener("DOMContentLoaded", () => {
    loadComponent("header", "header.html");
    loadComponent("footer", "footer.html");
});
