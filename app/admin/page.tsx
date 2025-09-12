'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import SuperAdminInvite from '@/components/SuperAdminInvite';
import AdminDashboard from '@/components/AdminDashboard';
import Link from 'next/link';
import { Mail } from 'lucide-react';

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/signin');
        return;
      }

      // Check if user is super admin
      if (session.user.email !== 'tl@innovareai.com') {
        setLoading(false);
        return; // Will show access denied
      }

      setUser(session.user);
      setLoading(false);
    } catch (error) {
      console.error('Error checking user:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user || user.email !== 'tl@innovareai.com') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-4">🔒 Access Denied</h1>
          <p className="text-gray-600 mb-4">Super admin access required.</p>
          <p className="text-sm text-gray-500">Only tl@innovareai.com can access this panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🛡️ Super Admin Panel</h1>
          <p className="text-gray-600">Welcome, {user.user_metadata?.first_name || 'Thorsten'}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
          
          {/* Quick Navigation */}
          <div className="mt-6 flex justify-center">
            <Link
              href="/admin/activecampaign"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Mail className="h-4 w-4 mr-2" />
              ActiveCampaign Integration
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SuperAdminInvite />
          <AdminDashboard />
        </div>
      </div>
    </div>
  );
}