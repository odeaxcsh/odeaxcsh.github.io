// Dynamic page header management
class PageHeaderManager {
    constructor() {
        this.init();
    }

    init() {
        const updateWhenReady = () => {
            this.updatePageHeader();
        };

        // Listen for the finishedLoadingComponents event from common_loader.js
        document.addEventListener('finishedLoadingComponents', updateWhenReady);
        
        // Fallback: if components are already loaded, update immediately
        setTimeout(() => {
            const headerElement = document.querySelector('header');
            if (headerElement && headerElement.innerHTML.trim()) {
                this.updatePageHeader();
            }
        }, 100);
    }

    updatePageHeader() {
        const currentPage = this.getCurrentPage();
        const pageConfig = this.getPageConfig(currentPage);
        
        // Skip update for home page as it's handled by script.js
        if (currentPage === 'home') {
            return;
        }
        
        this.updateSubtitle(pageConfig.subtitle);
        this.updateNavigation(pageConfig.navigation);
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        
        if (filename === '' || filename === 'index.html') return 'home';
        if (filename === 'fourier-vis.html') return 'fourier';
        if (filename === 'pclipperp.html') return 'pclipper';
        if (filename === 'sorry.html') return 'sorry';
        
        return 'home';
    }

    getPageConfig(page) {
        const configs = {
            home: {
                subtitle: 'CS • Computer Vision • Robotics',
                navigation: [
                    { text: 'About Me', href: '#bio' },
                    { text: 'Research', href: '#research' },
                    { text: 'Hobbies', href: '#hobbies' }
                ]
            },
            fourier: {
                subtitle: '2D Discrete Fourier Transformation Visualization',
                navigation: []
            },
            pclipper: {
                subtitle: 'Research Project • Point Cloud Registration',
                navigation: []
            },
            sorry: {
                subtitle: 'Coming Soon • Work in Progress',
                navigation: []
            }
        };

        return configs[page] || configs.home;
    }

    updateSubtitle(subtitle) {
        const subtitleElement = document.querySelector('.site-subtitle');
        if (subtitleElement) {
            subtitleElement.textContent = subtitle;
        }
    }

    updateNavigation(navigationItems) {
        const navGroup = document.querySelector('.nav-group');
        if (!navGroup) return;

        // Find the projects dropdown
        const projectsDropdown = navGroup.querySelector('.projects-dropdown');
        
        // Remove existing page navigation
        const existingPageNav = navGroup.querySelector('.page-navigation');
        if (existingPageNav) {
            existingPageNav.remove();
        }

        // Add page-specific navigation if any
        if (navigationItems.length > 0) {
            const pageNav = document.createElement('div');
            pageNav.className = 'page-navigation';
            pageNav.style.cssText = 'display: flex; gap: 16px; align-items: center;';

            navigationItems.forEach(item => {
                const link = document.createElement('a');
                link.href = item.href;
                link.textContent = item.text;
                link.className = 'page-nav-link';
                link.style.cssText = `
                    color: var(--muted);
                    text-decoration: none;
                    font-weight: 500;
                    padding: 8px 12px;
                    border-radius: 8px;
                    transition: all 0.2s ease;
                `;
                
                // Add hover styles via CSS
                this.addPageNavStyles();
                
                pageNav.appendChild(link);
            });

            // Insert before projects dropdown
            navGroup.insertBefore(pageNav, projectsDropdown);
        }
    }

    addPageNavStyles() {
        // Add styles if not already added
        if (document.getElementById('page-nav-styles')) return;

        const style = document.createElement('style');
        style.id = 'page-nav-styles';
        style.textContent = `
            .page-nav-link:hover {
                color: var(--fg) !important;
                background: var(--control-bg) !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize page header manager
const pageHeaderManager = new PageHeaderManager();

// Make it available globally if needed
if (typeof window !== 'undefined') {
    window.pageHeaderManager = pageHeaderManager;
}