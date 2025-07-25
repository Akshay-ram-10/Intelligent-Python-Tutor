import React from 'react';

const ThemeToggleSwitch = ({ theme, toggleTheme }) => {
  return (
    <div className="theme-switch-container">
      <div
        className={`theme-switch ${theme}`} // Apply 'light' or 'dark' class based on theme
        onClick={toggleTheme}
      >
        <div className="theme-switch-thumb">
          {/* Conditional rendering of icons inside the thumb */}
          {theme === 'light' ? (
            <span className="sun-icon" role="img" aria-label="sun">☀️</span> // Sun icon for light mode
          ) : (
            <span className="moon-icon" role="img" aria-label="moon">🌙</span> // Moon icon for dark mode
          )}
        </div>
      </div>
    </div>
  );
};

export default ThemeToggleSwitch;