import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

// retries needed because Supabase trigger creates profile with a small delay after signup
const fetchProfileWithRetry = async (userId, userEmail, userMeta, attempts = 8, delay = 1000) => {
    for (let i = 0; i < attempts; i++) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, role')
                .eq('id', userId)
                .maybeSingle();

            if (!error && data) return data;
        } catch { /* retry */ }

        if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, delay));
        }
    }

    // fallback: trigger didn't fire — create profile manually
    try {
        const username =
            userMeta?.username ||
            userMeta?.name ||
            (userEmail ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') : null) ||
            `user_${userId.slice(0, 6)}`;

        const { data } = await supabase
            .from('profiles')
            .upsert({ id: userId, username }, { onConflict: 'id', ignoreDuplicates: true })
            .select()
            .maybeSingle();

        return data ?? null;
    } catch {
        return null;
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser]       = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId, email, meta) => {
        const data = await fetchProfileWithRetry(userId, email, meta);
        setProfile(data);
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
            if (session?.user) fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
        }).catch(() => {
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'INITIAL_SESSION') return;

                setUser(session?.user ?? null);

                if (session?.user) {
                    fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
                } else {
                    setProfile(null);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const refreshProfile = () => {
        if (user) fetchProfile(user.id);
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#0f0f12',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c9a84c',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '0.9rem',
                gap: '10px',
            }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     style={{ animation: 'spin 0.8s linear infinite' }}>
                    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
                    <circle cx="12" cy="12" r="10" stroke="#c9a84c"
                            strokeWidth="2.5" strokeDasharray="32" strokeDashoffset="10"/>
                </svg>
                Завантаження...
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};