
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole, UserStatus } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  session: any;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email!);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email!);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        // Map snake_case from DB to camelCase for UserProfile interface
        setUser({
          id: userId,
          email: email,
          fullName: data.full_name || 'User',
          role: data.role as UserRole,
          avatarUrl: data.avatar_url,
          classId: data.class_id,
          status: (data.status as UserStatus) || 'active', // Default to active if missing
          updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      // Fallback: Create a minimal user object if profile fetch fails but auth exists
      // This prevents the app from crashing in edge cases
      setUser({
        id: userId,
        email: email,
        fullName: 'Người dùng',
        role: 'student', // Default fallback role
        status: 'active',
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (session?.user) {
      setLoading(true);
      await fetchProfile(session.user.id, session.user.email!);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const value = {
    user,
    session,
    loading,
    signOut,
    refreshProfile,
    isAdmin,
    isTeacher,
    isStudent
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
