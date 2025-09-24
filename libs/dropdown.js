// Dropdown functionality for header navigation
class DropdownManager {
    constructor() {
        this.activeDropdown = null;
        this.bound = false; // guard against duplicate binding
        this.observer = null;
        this.init();
    }

    init() {
        // Wait for components to be loaded by common_loader.js
        const bindWhenReady = () => {
            setTimeout(() => {
                this.bindEvents();
            }, 100); // Small delay to ensure header is fully rendered
        };

        // Listen for the component loading event
        document.addEventListener('finishedLoadingComponents', bindWhenReady);
        
        // Fallback: If DOM is already loaded and components might be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindWhenReady);
        } else {
            // Check if header content is already loaded
            setTimeout(() => {
                const headerExists = document.querySelector('header .dropdown-btn');
                if (headerExists) {
                    this.bindEvents();
                } else {
                    // Listen for the component loading event
                    document.addEventListener('finishedLoadingComponents', bindWhenReady);
                }
            }, 100);
        }
    }

    bindEvents(force = false) {
        if (this.bound && !force) {
            return; // already bound
        }
        this.bound = true;
        console.log('[Dropdown] Binding dropdown events...');

        // Initialize buttons
        this.refreshButtons();

        // Delegated click handler (only add once)
        if (!this._delegatedClickHandler) {
            this._delegatedClickHandler = (e) => {
                if (e.target.closest('#themeToggle, .theme-toggle')) {
                    return;
                }
                const dropdownBtn = e.target.closest('.dropdown-btn');
                if (dropdownBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleDropdown(dropdownBtn);
                } else if (!e.target.closest('.dropdown-menu')) {
                    this.closeAllDropdowns();
                }
            };
            document.addEventListener('click', this._delegatedClickHandler, true);
        }

        // Keydown handler
        if (!this._keydownHandler) {
            this._keydownHandler = (e) => {
                if (e.key === 'Escape') {
                    this.closeAllDropdowns();
                }
            };
            document.addEventListener('keydown', this._keydownHandler);
        }

        // Item click close handler
        if (!this._itemClickHandler) {
            this._itemClickHandler = (e) => {
                const dropdownItem = e.target.closest('.dropdown-item');
                if (dropdownItem) {
                    setTimeout(() => this.closeAllDropdowns(), 80);
                }
            };
            document.addEventListener('click', this._itemClickHandler);
        }

        // Observe header mutations to re-bind if buttons replaced
        this.setupObserver();
    }

    refreshButtons() {
        const dropdownBtns = document.querySelectorAll('.dropdown-btn');
        console.log(`[Dropdown] Found buttons: ${dropdownBtns.length}`);
        dropdownBtns.forEach(btn => {
            if (!btn.dataset.dropdownInit) {
                btn.setAttribute('aria-expanded', btn.getAttribute('aria-expanded') === 'true' ? 'true' : 'false');
                btn.dataset.dropdownInit = 'true';
            }
        });
    }

    setupObserver() {
        if (this.observer) return;
        const header = document.querySelector('header');
        if (!header) return;
        this.observer = new MutationObserver((mutations) => {
            let needsRefresh = false;
            for (const m of mutations) {
                if (m.type === 'childList') {
                    needsRefresh = true; break;
                }
            }
            if (needsRefresh) {
                // Re-scan for buttons but keep existing listeners
                this.refreshButtons();
            }
        });
        this.observer.observe(header, { childList: true, subtree: true });
    }

    toggleDropdown(button) {
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        const dropdownMenu = button.nextElementSibling;
        
        console.log('[Dropdown] Toggle', {btn: button, expanded: isExpanded});
        
        if (isExpanded) {
            // Close this dropdown
            console.log('[Dropdown] Closing');
            button.setAttribute('aria-expanded', 'false');
            if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
                dropdownMenu.classList.remove('open');
            }
            this.activeDropdown = null;
        } else {
            // Close all other dropdowns first, but exclude this button
            this.closeAllDropdowns(button);
            
            // Open this dropdown
            console.log('[Dropdown] Opening');
            button.setAttribute('aria-expanded', 'true');
            if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
                dropdownMenu.classList.add('open');
                console.log('[Dropdown] Opened');
            } else {
                console.error('Dropdown menu not found or missing class:', dropdownMenu);
            }
            this.activeDropdown = button;
        }
    }

    closeAllDropdowns(excludeButton = null) {
        const allDropdownBtns = document.querySelectorAll('.dropdown-btn');
        const allDropdownMenus = document.querySelectorAll('.dropdown-menu');
        
        allDropdownBtns.forEach(btn => {
            if (btn !== excludeButton) {
                btn.setAttribute('aria-expanded', 'false');
            }
        });
        
        allDropdownMenus.forEach(menu => {
            if (!excludeButton || menu !== excludeButton.nextElementSibling) {
                menu.classList.remove('open');
            }
        });
        
        if (excludeButton !== this.activeDropdown) {
            this.activeDropdown = null;
        }
    }
}

// Initialize dropdown manager
const dropdownManager = new DropdownManager();

// Make it available globally if needed
if (typeof window !== 'undefined') {
    window.dropdownManager = dropdownManager;
}