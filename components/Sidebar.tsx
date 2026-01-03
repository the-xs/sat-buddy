'use client';
import { LayoutDashboard, BarChart3, Dumbbell, Upload, BookOpen } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ activeView, onViewChange }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'practice', label: 'Practice', icon: Dumbbell },
        { id: 'upload', label: 'Upload', icon: Upload },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <img src="/logo.png" alt="SAT Buddy Logo" className="sidebar-logo" />
                <span className="sidebar-title">SAT Buddy</span>
            </div>
            <nav className="sidebar-nav">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                        onClick={() => onViewChange(item.id)}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );
};

export default Sidebar;
