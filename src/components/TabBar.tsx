import { X } from 'lucide-react';

interface Tab {
    path: string;
    name: string;
}

interface TabBarProps {
    tabs: Tab[];
    activeTab: string;
    onTabSelect: (path: string) => void;
    onTabClose: (path: string) => void;
}

export default function TabBar({ tabs, activeTab, onTabSelect, onTabClose }: TabBarProps) {
    return (
        <div style={{
            display: 'flex',
            height: '36px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--background-secondary)',
            overflowX: 'auto',
            overflowY: 'hidden'
        }}>
            {tabs.map(tab => (
                <div
                    key={tab.path}
                    onClick={() => onTabSelect(tab.path)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 12px',
                        minWidth: '120px',
                        maxWidth: '200px',
                        cursor: 'pointer',
                        backgroundColor: activeTab === tab.path ? 'var(--background-primary)' : 'transparent',
                        borderRight: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s'
                    }}
                >
                    <span style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '13px'
                    }}>
                        {tab.name}
                    </span>
                    <X
                        size={14}
                        onClick={(e) => {
                            e.stopPropagation();
                            onTabClose(tab.path);
                        }}
                        style={{
                            opacity: 0.6,
                            flexShrink: 0
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                    />
                </div>
            ))}
        </div>
    );
}
