'use client';
import { LayoutDashboard, BarChart3, Dumbbell, Upload, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import './Sidebar.css';

interface SidebarProps {
    activeView: string;
    onViewChange: (view: string) => void;
}

const Sidebar = ({ activeView, onViewChange }: SidebarProps) => {
    const { data: session } = useSession();

    const allMenuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'practice', label: 'Practice', icon: Dumbbell },
        { id: 'upload', label: 'Upload', icon: Upload, devOnly: true },
    ];

    const menuItems = allMenuItems.filter(item =>
        !item.devOnly || process.env.NODE_ENV === 'development'
    );

    const handleLogout = async () => {
        await signOut({ callbackUrl: '/login' });
    };

    const userInitial = session?.user?.name?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || 'U';

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo-placeholder">S</div>
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
            {session?.user && (
                <div className="sidebar-user">
                    <div className="user-avatar">
                        {session.user.image ? (
                            <img src={session.user.image} alt={session.user.name || ''} />
                        ) : (
                            <span>{userInitial}</span>
                        )}
                    </div>
                    <div className="user-info">
                        <span className="user-name">{session.user.name || 'User'}</span>
                        <span className="user-email">{session.user.email}</span>
                    </div>
                    <button onClick={handleLogout} className="logout-btn" title="Sign out">
                        <LogOut size={18} />
                    </button>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
