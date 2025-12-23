import React from 'react';
import { Sun, Moon, Coffee, Sparkles } from 'lucide-react';
import './ThemeSwitcher.css';

const themes = [
    { id: 'dark', name: 'Dark', icon: <Moon size={18} /> },
    { id: 'light', name: 'Light', icon: <Sun size={18} /> },
    { id: 'gruvbox', name: 'Gruvbox', icon: <Coffee size={18} /> },
    { id: 'tokyo-night', name: 'Tokyo Night', icon: <Sparkles size={18} /> }
];

const ThemeSwitcher = ({ currentTheme, onThemeChange }) => {
    return (
        <div className="theme-switcher">
            {themes.map((theme) => (
                <button
                    key={theme.id}
                    className={`theme-btn ${currentTheme === theme.id ? 'active' : ''}`}
                    onClick={() => onThemeChange(theme.id)}
                    title={`${theme.name} Theme`}
                >
                    {theme.icon}
                    <span className="theme-name">{theme.name}</span>
                </button>
            ))}
        </div>
    );
};

export default ThemeSwitcher;
