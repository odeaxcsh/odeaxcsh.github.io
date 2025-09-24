/**
 * Universal Theme Management System
 * Provides consistent theming across all pages
 */

class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'site-theme';
    this.currentTheme = 'light'; // Default theme
    this.init();
  }

  init() {
    // Load saved theme or use default
    const savedTheme = this.loadTheme();
    this.setTheme(savedTheme);

    // Set up theme toggle if it exists
    this.setupThemeToggle();
  }

  loadTheme() {
    try {
      return localStorage.getItem(this.STORAGE_KEY) || 'light';
    } catch (e) {
      console.warn('Could not load theme from localStorage:', e);
      return 'light';
    }
  }

  saveTheme() {
    try {
      localStorage.setItem(this.STORAGE_KEY, this.currentTheme);
    } catch (e) {
      console.warn('Could not save theme to localStorage:', e);
    }
  }

  setTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // Update theme toggle button if it exists
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
      themeToggle.setAttribute('title', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
    }

    this.saveTheme();
  }

  toggleTheme(event) {
    console.log('Theme toggle clicked!');

    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';

    // Add ripple effect if click event is provided
    if (event && event.currentTarget) {
      this.addRippleEffect(event);
    }

    this.setTheme(newTheme);
  }

  addRippleEffect(event) {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    // Calculate ripple origin
    const rippleX = rect.left + rect.width / 2;
    const rippleY = rect.top + rect.height / 2;

    // Set CSS custom properties for ripple position
    document.documentElement.style.setProperty('--theme-ripple-x', rippleX + 'px');
    document.documentElement.style.setProperty('--theme-ripple-y', rippleY + 'px');

    // Add transitioning class
    document.body.classList.add('theme-transitioning');

    // Remove transitioning class after animation completes
    setTimeout(() => {
      document.body.classList.remove('theme-transitioning');
    }, 2200);
  }

  setupThemeToggle() {
    const bindThemeToggle = () => {
      const themeToggle = document.getElementById('themeToggle');
      console.log('Looking for theme toggle:', !!themeToggle);
      if (themeToggle) {
        console.log('Binding theme toggle event listener');
        themeToggle.addEventListener('click', (e) => this.toggleTheme(e));
      }
    };

    // Try to bind immediately
    bindThemeToggle();

    // Also listen for when components are loaded
    document.addEventListener('finishedLoadingComponents', () => {
      console.log('Components finished loading, setting up theme toggle');
      setTimeout(bindThemeToggle, 100);
    });
  }

  // Get current theme for external use
  getCurrentTheme() {
    return this.currentTheme;
  }
}

// Initialize theme manager when DOM is ready
let themeManager;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    themeManager = new ThemeManager();
  });
} else {
  themeManager = new ThemeManager();
}

// Export for use in other scripts
window.ThemeManager = ThemeManager;
window.themeManager = themeManager;