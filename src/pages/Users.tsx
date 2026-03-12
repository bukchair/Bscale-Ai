import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Users as UsersIcon, Shield, UserPlus, MoreVertical, Search, Edit2, Trash2, Building, Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'agency' | 'owner' | 'editor' | 'viewer';
  plan?: string;
  subscriptionStatus?: string;
  createdAt: string;
  storeIds?: string[];
  photoURL?: string;
}

const roleLabels: Record<UserProfile['role'], { labelKey: string, icon: React.ElementType, color: string, bg: string }> = {
  admin: { labelKey: 'users.roles.admin', icon: Shield, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  agency: { labelKey: 'users.roles.agency', icon: UsersIcon, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  owner: { labelKey: 'users.roles.owner', icon: Building, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  editor: { labelKey: 'users.roles.editor', icon: Edit2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  viewer: { labelKey: 'users.roles.viewer', icon: Search, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
};

export function Users() {
  const { t, dir } = useLanguage();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as UserProfile[];
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserProfile['role']) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const handleSubscriptionChange = async (userId: string, grantAccess: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        subscriptionStatus: grantAccess ? 'active' : 'demo',
        plan: grantAccess ? 'granted_by_admin' : 'demo',
      });
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                         (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    active: users.length, // For now assuming all are active
    agencies: users.filter(u => u.role === 'agency').length,
    admins: users.filter(u => u.role === 'admin').length
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.users')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('users.subtitle')}</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm">
          <UserPlus className="w-4 h-4" />
          {t('users.addNewUser')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{t('users.totalUsers')}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{t('users.activeUsers')}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{t('users.agencies')}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.agencies}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{t('users.admins')}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.admins}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400", dir === 'rtl' ? "right-3" : "left-3")} />
            <input 
              type="text" 
              placeholder={t('users.searchPlaceholder')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-full border border-gray-200 bg-gray-50 rounded-lg py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
                dir === 'rtl' ? "pr-10 pl-4" : "pl-10 pr-4"
              )}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <button 
              onClick={() => setSelectedRole('all')}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors", selectedRole === 'all' ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
            >
              {t('users.all')}
            </button>
            {Object.entries(roleLabels).map(([key, role]) => (
              <button 
                key={key}
                onClick={() => setSelectedRole(key)}
                className={cn("px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors", selectedRole === key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
              >
                {t(role.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-medium">{t('users.user')}</th>
                <th className="px-6 py-4 font-medium">{t('users.role')}</th>
                <th className="px-6 py-4 font-medium">{t('users.subscriptionAccess')}</th>
                <th className="px-6 py-4 font-medium">{t('users.managedStores')}</th>
                <th className="px-6 py-4 font-medium">{t('users.status')}</th>
                <th className="px-6 py-4 font-medium">{t('users.lastActivity')}</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => {
                const roleInfo = roleLabels[user.role];
                const RoleIcon = roleInfo.icon;
                
                return (
                   <tr key={user.uid} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.name} className="w-10 h-10 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-200/50">
                            {user.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-900">{user.name}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.uid, e.target.value as UserProfile['role'])}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer transition-colors",
                          roleInfo.bg, 
                          roleInfo.color
                        )}
                        disabled={user.email === 'asher205@gmail.com'}
                      >
                        {Object.entries(roleLabels).map(([key, role]) => (
                          <option key={key} value={key}>{t(role.labelKey)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'admin' ? (
                        <span className="text-gray-400 text-xs font-medium">—</span>
                      ) : (
                        <select
                          value={user.subscriptionStatus === 'active' ? 'active' : 'demo'}
                          onChange={(e) => handleSubscriptionChange(user.uid, e.target.value === 'active')}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer transition-colors",
                            user.subscriptionStatus === 'active'
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          )}
                        >
                          <option value="active">{t('users.accessActive')}</option>
                          <option value="demo">{t('users.accessDemo')}</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(user.storeIds || []).slice(0, 2).map((store, idx) => (
                          <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-medium border border-gray-200/50">
                            {store}
                          </span>
                        ))}
                        {(user.storeIds || []).length > 2 && (
                          <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-md text-xs font-medium border border-gray-200/50">
                            +{(user.storeIds || []).length - 2}
                          </span>
                        )}
                        {(user.storeIds || []).length === 0 && (
                          <span className="text-gray-400 text-xs italic">{t('users.noStores')}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('users.active')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs font-medium">
                      {new Date(user.createdAt).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-US')}
                    </td>
                    <td className="px-6 py-4 text-left">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setDeleteConfirmId(user.uid)}
                          disabled={user.email === 'asher205@gmail.com'}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{t('users.noResults')}</h3>
              <p className="text-gray-500 text-sm">{t('users.noResultsDesc')}</p>
            </div>
          )}
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('users.deleteUser')}</h3>
            <p className="text-sm text-gray-500 mb-6">{t('users.deleteUserConfirm')}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t('users.cancel')}
              </button>
              <button 
                onClick={() => handleDeleteUser(deleteConfirmId)}
                className="flex-1 px-4 py-2 bg-red-600 rounded-xl text-sm font-bold text-white hover:bg-red-700 transition-colors"
              >
                {t('users.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
