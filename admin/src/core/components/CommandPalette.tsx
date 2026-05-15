import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Building2, Users, ShieldAlert, Settings, Gift, Network,
    Search, Plus, UserPlus, Building, FileText
} from 'lucide-react';

interface CommandItem {
    id: string;
    label: string;
    icon: React.FC<any>;
    action: () => void;
    section: 'navigation' | 'actions' | 'recent';
    keywords?: string[];
}

export const CommandPalette: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    // Toggle on Ctrl+K / Cmd+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === 'F1') {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = useCallback((action: () => void) => {
        setOpen(false);
        setTimeout(action, 100);
    }, []);

    const commands: CommandItem[] = [
        // Navigation
        {
            id: 'nav-dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'navigation',
            keywords: ['home', 'stats', 'overview'], action: () => navigate('/owner/dashboard')
        },
        {
            id: 'nav-tenants', label: 'Tenants & Branding', icon: Building2, section: 'navigation',
            keywords: ['white-label', 'branding', 'cities'], action: () => navigate('/owner/white-label')
        },
        {
            id: 'nav-users', label: 'Users', icon: Users, section: 'navigation',
            keywords: ['athletes', 'members', 'people'], action: () => navigate('/owner/users')
        },
        {
            id: 'nav-departments', label: 'Departments', icon: Network, section: 'navigation',
            keywords: ['classes', 'teams', 'groups'], action: () => navigate('/owner/departments')
        },
        {
            id: 'nav-anticheat', label: 'Anti-Cheat', icon: ShieldAlert, section: 'navigation',
            keywords: ['fraud', 'verification', 'security'], action: () => navigate('/owner/anti-cheat')
        },
        {
            id: 'nav-sponsor', label: 'Sponsorship', icon: Gift, section: 'navigation',
            keywords: ['ads', 'partners'], action: () => navigate('/owner/sponsor')
        },
        {
            id: 'nav-settings', label: 'Settings', icon: Settings, section: 'navigation',
            keywords: ['config', 'preferences'], action: () => navigate('/owner/settings')
        },
        // Quick actions
        {
            id: 'action-new-tenant', label: 'Create Tenant', icon: Building, section: 'actions',
            keywords: ['new', 'add', 'city'], action: () => navigate('/owner/white-label')
        },
        {
            id: 'action-new-user', label: 'Create User', icon: UserPlus, section: 'actions',
            keywords: ['new', 'add', 'athlete'], action: () => navigate('/owner/users')
        },
        {
            id: 'action-search', label: 'Search...', icon: Search, section: 'actions',
            keywords: ['find', 'lookup'], action: () => navigate('/owner/users')
        },
    ];

    const filtered = commands.filter((c) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return c.label.toLowerCase().includes(s) ||
            c.keywords?.some((k) => k.includes(s));
    });

    const sections = {
        navigation: 'Navigation',
        actions: 'Quick Actions',
        recent: 'Recent',
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        paddingTop: '15vh',
                        background: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={() => setOpen(false)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -10 }}
                        transition={{ duration: 0.2 }}
                        style={{ width: '90vw', maxWidth: 560 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Command
                            style={{
                                borderRadius: 16,
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                boxShadow: 'var(--shadow-xl)',
                                overflow: 'hidden',
                            }}
                            shouldFilter={false}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                                <Search size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                <Command.Input
                                    value={search}
                                    onValueChange={setSearch}
                                    autoFocus
                                    placeholder="Search or type a command..."
                                    style={{
                                        flex: 1,
                                        marginLeft: 10,
                                        border: 'none',
                                        background: 'transparent',
                                        fontSize: 15,
                                        color: 'var(--text-primary)',
                                        outline: 'none',
                                        fontFamily: 'Inter, sans-serif',
                                    }}
                                />
                                <kbd style={{
                                    padding: '2px 8px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    background: 'var(--surface-tertiary)',
                                    color: 'var(--text-tertiary)',
                                    border: '1px solid var(--border)',
                                    fontFamily: 'JetBrains Mono, monospace',
                                }}>
                                    ESC
                                </kbd>
                            </div>
                            <Command.List style={{ maxHeight: 360, overflowY: 'auto', padding: '8px 6px' }}>
                                <Command.Empty style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                                    No results found.
                                </Command.Empty>

                                {(['navigation', 'actions'] as const).map((section) => {
                                    const items = filtered.filter((c) => c.section === section);
                                    if (items.length === 0) return null;
                                    return (
                                        <Command.Group key={section} heading={sections[section]} style={{
                                            padding: '4px 0',
                                        }}>
                                            {items.map((item) => (
                                                <Command.Item
                                                    key={item.id}
                                                    value={item.id}
                                                    onSelect={() => runCommand(item.action)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        padding: '10px 12px',
                                                        borderRadius: 8,
                                                        cursor: 'pointer',
                                                        fontSize: 14,
                                                        color: 'var(--text-primary)',
                                                        margin: '2px 4px',
                                                    }}
                                                >
                                                    <item.icon size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                                    {item.label}
                                                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                        {item.section === 'navigation' ? 'Go to' : 'Action'}
                                                    </span>
                                                </Command.Item>
                                            ))}
                                        </Command.Group>
                                    );
                                })}
                            </Command.List>
                            <div style={{
                                padding: '8px 16px',
                                borderTop: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 11,
                                color: 'var(--text-tertiary)',
                            }}>
                                <span><kbd>↑↓</kbd> Navigate</span>
                                <span><kbd>↵</kbd> Select</span>
                                <span><kbd>Esc</kbd> Close</span>
                            </div>
                        </Command>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
