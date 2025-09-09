'use client';

import { useState, useEffect, useContext, createContext } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Types for our enhanced user data
export interface AuthUser extends User {
  // Additional user data from our database
  profile?: {
    id: string;
    clerk_id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    image_url?: string;
    default_workspace_id?: string;
    current_workspace_id?: string;
    created_at: string;
    updated_at: string;
  };
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: AuthUser | null; error: any }>;
  signUp: (email: string, password: string, userData?: any) => Promise<{ user: AuthUser | null; error: any }>;
  signOut: () => Promise<{ error: any }>;
  refreshUser: () => Promise<void>;
}

// Create the auth context
export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => ({ user: null, error: null }),
  signUp: async () => ({ user: null, error: null }),
  signOut: async () => ({ error: null }),
  refreshUser: async () => {},
});

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to get user profile from our database
export const getUserProfile = async (userId: string): Promise<AuthUser['profile'] | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return {
      id: data.id,
      clerk_id: data.clerk_id,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      image_url: data.image_url,
      current_workspace_id: data.current_workspace_id,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

// Helper function to create user profile in our database
export const createUserProfile = async (user: User, additionalData?: any): Promise<AuthUser['profile'] | null> => {
  try {
    const profileData = {
      id: user.id,
      clerk_id: user.id, // For now, use Supabase user ID as clerk_id
      email: user.email!,
      first_name: additionalData?.firstName || user.user_metadata?.first_name || null,
      last_name: additionalData?.lastName || user.user_metadata?.last_name || null,
      image_url: user.user_metadata?.avatar_url || null,
      ...additionalData
    };

    const { data, error } = await supabase
      .from('users')
      .insert([profileData])
      .select()
      .single();

    if (error) {
      // If user already exists, try to update instead
      if (error.code === '23505') { // Unique constraint violation
        const { data: updateData, error: updateError } = await supabase
          .from('users')
          .update(profileData)
          .eq('id', user.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating user profile:', updateError);
          return null;
        }
        return updateData;
      }
      
      console.error('Error creating user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error creating user profile:', error);
    return null;
  }
};