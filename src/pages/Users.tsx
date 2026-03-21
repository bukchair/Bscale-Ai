import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Users as UsersIcon, Shield, UserPlus, MoreVertical, Search, Edit2, Trash2, Building, Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, writeBatch, getDoc } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'agency' | 'owner' | 'editor' | 'viewer';
  createdAt: string;
  storeIds?: string[];
  photoURL?: string;
}

type BasicMembershipUser = Pick<UserProfile, 'uid' | 'name' | 'email' | 'role'>;

const roleLabels: Record<UserProfile['role'], { labelKey: string, icon: React.ElementType, color: string, bg: string }> = {
  admin: { labelKey: 'users.roles.admin', icon: Shield, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  agency: { labelKey: 'users.roles.agency', icon: UsersIcon, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  owner: { labelKey: 'users.roles.owner', icon: Building, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  editor: { labelKey: 'users.roles.editor', icon: Edit2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  viewer: { labelKey: 'users.roles.viewer', icon: Search, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
};

export function Users() {
  const { t, dir } = useLanguage();
  const isHebrew = dir === 'rtl';
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUserUid, setNewUserUid] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserProfile['role']>('viewer');
  const [newUserStoreIds, setNewUserStoreIds] = useState('');
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [storeIdDraftByUser, setStoreIdDraftByUser] = useState<Record<string, string>>({});
  const [storeIdSaveState, setStoreIdSaveState] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [systemTarget, setSystemTarget] = useState<'all' | 'single'>('all');
  const [systemSelectedUserId, setSystemSelectedUserId] = useState('');
  const [systemTitle, setSystemTitle] = useState('');
  const [systemMessage, setSystemMessage] = useState('');
  const [systemSending, setSystemSending] = useState(false);
  const [systemStatus, setSystemStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setStoreIdDraftByUser((prev) => {
      const next = { ...prev };
      const existingUids = new Set(users.map((user) => user.uid));
      users.forEach((user) => {
        if (typeof next[user.uid] === 'string') return;
        next[user.uid] = Array.isArray(user.storeIds) ? user.storeIds.join(', ') : '';
      });
      Object.keys(next).forEach((uid) => {
        if (!existingUids.has(uid)) delete next[uid];
      });
      return next;
    });
  }, [users]);

  const parseStoreIdsInput = (value: string): string[] =>
    [...new Set(String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean))];

  const syncStoreMembershipDocs = async (
    user: BasicMembershipUser,
    previousStoreIds: string[],
    nextStoreIds: string[]
  ) => {
    const previous = new Set(previousStoreIds.filter(Boolean));
    const next = new Set(nextStoreIds.filter(Boolean));
    const toRemove = [...previous].filter((storeId) => !next.has(storeId));
    const toUpsert = [...next];
    if (toRemove.length === 0 && toUpsert.length === 0) return;

    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    const actorUid = auth.currentUser?.uid || null;

    for (const storeId of toUpsert) {
      const memberRef = doc(db, 'stores', storeId, 'members', user.uid);
      batch.set(
        memberRef,
        {
          uid: user.uid,
          name: user.name || '',
          email: user.email || '',
          role: user.role,
          updatedAt: nowIso,
          updatedByUid: actorUid,
        },
        { merge: true }
      );
    }

    for (const storeId of toRemove) {
      const memberRef = doc(db, 'stores', storeId, 'members', user.uid);
      batch.delete(memberRef);
    }

    await batch.commit();
  };

  const handleRoleChange = async (userId: string, newRole: UserProfile['role']) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      const targetUser = users.find((item) => item.uid === userId);
      if (targetUser) {
        await syncStoreMembershipDocs(
          { uid: targetUser.uid, name: targetUser.name, email: targetUser.email, role: newRole },
          targetUser.storeIds || [],
          targetUser.storeIds || []
        );
      }
    } catch (error) {
      console.error("Error updating role:", error);
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

  const handleCreateUser = async () => {
    setCreateUserError(null);
    const uid = newUserUid.trim();
    if (!uid || !newUserName.trim() || !newUserEmail.trim()) {
      setCreateUserError(isHebrew ? 'יש למלא UID, שם ואימייל.' : 'UID, name and email are required.');
      return;
    }

    const normalizedStoreIds = parseStoreIdsInput(newUserStoreIds);
    try {
      const existing = await getDoc(doc(db, 'users', uid));
      if (existing.exists()) {
        setCreateUserError(
          isHebrew ? 'UID זה כבר קיים. הזן UID של משתמש Auth קיים אחר.' : 'This UID already exists. Use another existing Auth UID.'
        );
        return;
      }
      await setDoc(doc(db, 'users', uid), {
        uid,
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole,
        createdAt: new Date().toISOString(),
        storeIds: normalizedStoreIds,
      });
      await syncStoreMembershipDocs(
        {
          uid,
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          role: newUserRole,
        },
        [],
        normalizedStoreIds
      );
      setIsCreateModalOpen(false);
      setNewUserUid('');
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('viewer');
      setNewUserStoreIds('');
      setCreateUserError(null);
    } catch (error) {
      console.error('Error creating user:', error);
      setCreateUserError(isHebrew ? 'יצירת משתמש נכשלה.' : 'Failed to create user.');
    }
  };

  const handleStoreIdsSave = async (userId: string) => {
    setStoreIdSaveState((prev) => ({ ...prev, [userId]: 'saving' }));
    try {
      const targetUser = users.find((item) => item.uid === userId);
      if (!targetUser) {
        setStoreIdSaveState((prev) => ({ ...prev, [userId]: 'error' }));
        return;
      }
      const normalizedStoreIds = parseStoreIdsInput(storeIdDraftByUser[userId] || '');
      await updateDoc(doc(db, 'users', userId), { storeIds: normalizedStoreIds });
      await syncStoreMembershipDocs(
        {
          uid: targetUser.uid,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        },
        targetUser.storeIds || [],
        normalizedStoreIds
      );
      setStoreIdSaveState((prev) => ({ ...prev, [userId]: 'saved' }));
      window.setTimeout(() => {
        setStoreIdSaveState((prev) => ({ ...prev, [userId]: 'idle' }));
      }, 1400);
    } catch (error) {
      console.error('Error updating storeIds:', error);
      setStoreIdSaveState((prev) => ({ ...prev, [userId]: 'error' }));
      window.setTimeout(() => {
        setStoreIdSaveState((prev) => ({ ...prev, [userId]: 'idle' }));
      }, 1800);
    }
  };

  const handleOpenSingleUserComposer = (userId: string) => {
    setSystemTarget('single');
    setSystemSelectedUserId(userId);
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const recipientUsers = useMemo(() => {
    if (systemTarget === 'all') return users;
    return users.filter((user) => user.uid === systemSelectedUserId);
  }, [systemSelectedUserId, systemTarget, users]);

  const handleSendSystemMessage = async () => {
    const title = systemTitle.trim();
    const message = systemMessage.trim();
    if (!title || !message) {
      setSystemStatus({
        type: 'error',
        message: isHebrew ? 'יש למלא כותרת ותוכן הודעה.' : 'Please provide both title and message.',
      });
      return;
    }

    if (recipientUsers.length === 0) {
      setSystemStatus({
        type: 'error',
        message: isHebrew ? 'לא נבחרו נמענים לשליחה.' : 'No recipients selected.',
      });
      return;
    }

    const adminUser = auth.currentUser;
    if (!adminUser) {
      setSystemStatus({
        type: 'error',
        message: isHebrew ? 'נדרש אימות אדמין לפני שליחה.' : 'Admin authentication is required before sending.',
      });
      return;
    }

    setSystemSending(true);
    setSystemStatus(null);
    try {
      // Firestore batch limit is 500 operations; commit in chunks for safety.
      const chunkSize = 400;
      for (let i = 0; i < recipientUsers.length; i += chunkSize) {
        const chunk = recipientUsers.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        const createdAt = new Date().toISOString();

        for (const user of chunk) {
          const notificationRef = doc(collection(db, 'users', user.uid, 'notifications'));
          batch.set(notificationRef, {
            type: 'system',
            title,
            message,
            read: false,
            createdAt,
            createdByUid: adminUser.uid,
            createdByName: adminUser.displayName || adminUser.email || 'Admin',
            targetScope: systemTarget,
            targetUserId: systemTarget === 'single' ? user.uid : null,
          });
        }

        await batch.commit();
      }

      setSystemStatus({
        type: 'success',
        message:
          systemTarget === 'all'
            ? isHebrew
              ? `הודעת מערכת נשלחה ל-${recipientUsers.length} משתמשים.`
              : `System message sent to ${recipientUsers.length} users.`
            : isHebrew
            ? 'הודעת מערכת נשלחה למשתמש בהצלחה.'
            : 'System message sent successfully.',
      });
      setSystemTitle('');
      setSystemMessage('');
    } catch (error) {
      console.error('Error sending system message:', error);
      setSystemStatus({
        type: 'error',
        message: isHebrew ? 'שליחת הודעת המערכת נכשלה.' : 'Failed to send system message.',
      });
    } finally {
      setSystemSending(false);
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
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
        >
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
                      <div className="flex flex-wrap gap-1.5 mb-2">
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
                      <div className="flex items-center gap-1.5">
                        <input
                          value={storeIdDraftByUser[user.uid] ?? ''}
                          onChange={(e) =>
                            setStoreIdDraftByUser((prev) => ({ ...prev, [user.uid]: e.target.value }))
                          }
                          className="w-full border border-gray-200 bg-gray-50 rounded-md px-2 py-1 text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder={
                            isHebrew
                              ? 'Store IDs מופרדים בפסיק'
                              : 'Comma-separated store IDs'
                          }
                        />
                        <button
                          type="button"
                          onClick={() => handleStoreIdsSave(user.uid)}
                          className={cn(
                            'px-2 py-1 rounded-md text-[11px] font-bold border whitespace-nowrap',
                            storeIdSaveState[user.uid] === 'saved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : storeIdSaveState[user.uid] === 'error'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                          )}
                          disabled={storeIdSaveState[user.uid] === 'saving'}
                        >
                          {storeIdSaveState[user.uid] === 'saving'
                            ? isHebrew
                              ? 'שומר...'
                              : 'Saving...'
                            : storeIdSaveState[user.uid] === 'saved'
                            ? isHebrew
                              ? 'נשמר'
                              : 'Saved'
                            : storeIdSaveState[user.uid] === 'error'
                            ? isHebrew
                              ? 'שגיאה'
                              : 'Error'
                            : isHebrew
                            ? 'שמור'
                            : 'Save'}
                        </button>
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
                          onClick={() => handleOpenSingleUserComposer(user.uid)}
                          className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                          title={isHebrew ? 'שלח הודעת מערכת למשתמש' : 'Send system message to user'}
                        >
                          <Mail className="w-4 h-4" />
                        </button>
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

      <div ref={composerRef} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              {isHebrew ? 'שליחת הודעת מערכת למשתמשים' : 'Send system message to users'}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {isHebrew
                ? 'רק אדמין יכול לשלוח הודעה למשתמש ספציפי או לכל המשתמשים.'
                : 'Only admins can send a message to a specific user or to all users.'}
            </p>
          </div>
          <div className="text-[11px] font-bold px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            Admin only
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setSystemTarget('all')}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-bold border transition-colors',
              systemTarget === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            )}
          >
            {isHebrew ? 'לכל המשתמשים' : 'All users'}
          </button>
          <button
            onClick={() => setSystemTarget('single')}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-bold border transition-colors',
              systemTarget === 'single'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            )}
          >
            {isHebrew ? 'למשתמש ספציפי' : 'Specific user'}
          </button>
          <select
            value={systemSelectedUserId}
            onChange={(e) => setSystemSelectedUserId(e.target.value)}
            disabled={systemTarget !== 'single'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">{isHebrew ? 'בחר משתמש' : 'Select user'}</option>
            {users.map((user) => (
              <option key={`system-recipient-${user.uid}`} value={user.uid}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <input
            value={systemTitle}
            onChange={(e) => setSystemTitle(e.target.value)}
            placeholder={isHebrew ? 'כותרת הודעת מערכת' : 'System message title'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={systemMessage}
            onChange={(e) => setSystemMessage(e.target.value)}
            placeholder={isHebrew ? 'כתוב כאן את תוכן ההודעה...' : 'Write the message content here...'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-28 resize-y"
          />
        </div>

        {systemStatus && (
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-xs font-bold border',
              systemStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            )}
          >
            {systemStatus.message}
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            onClick={handleSendSystemMessage}
            disabled={systemSending || (systemTarget === 'single' && !systemSelectedUserId)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {systemSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {isHebrew ? 'שלח הודעת מערכת' : 'Send system message'}
          </button>
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

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('users.addNewUser')}</h3>
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mb-3">
              {isHebrew
                ? 'יש להזין UID אמיתי של משתמש שקיים כבר ב-Firebase Auth.'
                : 'Enter an existing Firebase Auth UID for this user.'}
            </p>
            <div className="space-y-3">
              <input
                value={newUserUid}
                onChange={(e) => setNewUserUid(e.target.value)}
                placeholder="Firebase UID"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserProfile['role'])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(roleLabels).map(([key, role]) => (
                  <option key={key} value={key}>{t(role.labelKey)}</option>
                ))}
              </select>
              <input
                value={newUserStoreIds}
                onChange={(e) => setNewUserStoreIds(e.target.value)}
                placeholder={isHebrew ? 'Store IDs (מופרד בפסיק)' : 'Store IDs (comma-separated)'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            {createUserError && (
              <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                {createUserError}
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreateUserError(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                {t('users.cancel')}
              </button>
              <button
                onClick={handleCreateUser}
                className="flex-1 px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold text-white hover:bg-indigo-700"
              >
                {t('users.addNewUser')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
