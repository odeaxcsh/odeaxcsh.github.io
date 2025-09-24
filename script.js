document.addEventListener('finishedLoadingComponents', function() {
    // Set up smooth scrolling for internal links
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
    
    // Update page header for home page
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    
    if (filename === '' || filename === 'index.html') {
        // Add About Me, Research, Hobbies navigation for home page
        const navGroup = document.querySelector('.nav-group');
        if (navGroup) {
            const projectsDropdown = navGroup.querySelector('.projects-dropdown');
            
            // Remove existing page navigation
            const existingPageNav = navGroup.querySelector('.page-navigation');
            if (existingPageNav) {
                existingPageNav.remove();
            }
            
            // Create page navigation
            const pageNav = document.createElement('div');
            pageNav.className = 'page-navigation';
            pageNav.style.cssText = 'display: flex; gap: 16px; align-items: center;';
            
            const navigationItems = [
                { text: 'About Me', href: '#bio' },
                { text: 'Research', href: '#research' },
                { text: 'Hobbies', href: '#hobbies' }
            ];
            
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
                
                // Add click handler for smooth scrolling
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });
                
                pageNav.appendChild(link);
            });
            
            // Add CSS for hover effects
            if (!document.getElementById('page-nav-styles')) {
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
            
            // Insert before projects dropdown
            navGroup.insertBefore(pageNav, projectsDropdown);
        }
    }
});
