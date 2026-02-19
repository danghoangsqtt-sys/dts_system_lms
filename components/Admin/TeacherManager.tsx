import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { databases, APPWRITE_CONFIG, Query } from '../../lib/appwrite';
import { UserProfile } from '../../types';
import { createAuthUserAsAdmin, databaseService } from '../../services/databaseService';

interface TeacherManagerProps {
  onNotify: (message: string, type: any) => void;
}

const TeacherManager: React.FC<TeacherManagerProps> = ({ onNotify }) => {
  const [activeTab, setActiveTab] = useState<'TEACHERS' | 'CANDIDATES'>('TEACHERS');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Teacher Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState(''); // NEW Field
  const [isCreating, setIsCreating] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const response = await databases.listDocuments(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        [
            Query.equal('role', ['teacher', 'student']),
            Query.orderDesc('$createdAt')
        ]
      );

      setUsers(response.documents.map(d => ({
        id: d.$id,
        email: d.email || 'N/A', 
        fullName: d.full_name || 'Người dùng hệ thống',
        role: d.role,
        avatarUrl: d.avatar_url,
        status: d.status || 'active'
      })));
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: 'teacher' | 'student') => {
    const actionName = newRole === 'teacher' ? 'Thăng cấp Giảng viên' : 'Hủy quyền Giảng viên';
    if (!window.confirm(`Xác nhận hành động: ${actionName} cho người dùng này?`)) return;

    try {
      await databases.updateDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        userId,
        { role: newRole }
      );

      onNotify(`${actionName} thành công!`, 'success');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
      if (!window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${userName}" không? Dữ liệu không thể khôi phục.`)) return;

      try {
          await databaseService.deleteUserProfileAndAuth(userId);
          onNotify(`Đã xóa vĩnh viễn tài khoản ${userName}.`, "success");
          setUsers(prev => prev.filter(u => u.id !== userId));
      } catch (err: any) {
          onNotify("Lỗi xóa tài khoản: " + err.message, "error");
      }
  };

  const handleAddTeacher = async () => {
    if (!newTeacherName.trim() || !newTeacherEmail.trim() || !newTeacherPassword.trim()) {
        onNotify("Vui lòng nhập tên, email và mật khẩu.", "warning");
        return;
    }

    if (newTeacherPassword.length < 8) {
        onNotify("Mật khẩu phải có ít nhất 8 ký tự.", "warning");
        return;
    }
    
    setIsCreating(true);
    try {
        // 1. Tạo Auth User
        const authUser = await createAuthUserAsAdmin(newTeacherEmail, newTeacherPassword, newTeacherName);

        // 2. Tạo Profile Document với ID trùng khớp
        await databases.createDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.profiles,
            authUser.$id, 
            {
                full_name: newTeacherName,
                email: newTeacherEmail,
                role: 'teacher',
                status: 'active', // Teachers created by admin are active by default
                avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(newTeacherName)}&background=random&color=fff`
            }
        );

        onNotify("Đã tạo tài khoản Giảng viên thành công.", "success");
        setShowAddModal(false);
        setNewTeacherName('');
        setNewTeacherEmail('');
        setNewTeacherPassword('');
        fetchProfiles();
    } catch (err: any) {
        onNotify(err.message, 'error');
    } finally {
        setIsCreating(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'TEACHERS') return u.role === 'teacher' && matchSearch;
    return u.role === 'student' && matchSearch; 
  });

  return (
    <div className="p-8 animate-fade-in font-[Roboto]">
      <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm">
         <div className="flex-1">
            <h4 className="text-sm font-black text-slate-800 uppercase mb-2 flex items-center gap-2">
                <i className="fas fa-server text-blue-600"></i> Quản trị Nhân sự
            </h4>
            <p className="text-xs text-slate-600 font-medium">
               Hệ thống cho phép tạo trực tiếp tài khoản Giảng viên với mật khẩu khởi tạo. Vui lòng bàn giao thông tin đăng nhập an toàn.
            </p>
         </div>
         <div className="flex gap-3">
            <button onClick={() => setShowAddModal(true)} className="px-6 py-3 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#0F3624] transition-all flex items-center gap-2 shadow-lg">
                <i className="fas fa-plus"></i> Thêm Giảng viên mới
            </button>
            <button onClick={fetchProfiles} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-2 shadow-sm shrink-0">
                <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i> Tải lại
            </button>
         </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <i className="fas fa-chalkboard-user text-[#14452F]"></i> Danh sách Tài khoản
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-8">Phân quyền Giảng viên & Đào tạo</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 chamfer-sm border border-slate-200">
            <button onClick={() => setActiveTab('TEACHERS')} className={`px-6 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'TEACHERS' ? 'bg-[#14452F] text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}><i className="fas fa-user-tie"></i> Giảng viên</button>
            <button onClick={() => setActiveTab('CANDIDATES')} className={`px-6 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'CANDIDATES' ? 'bg-[#14452F] text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}><i className="fas fa-users"></i> Học viên</button>
        </div>
      </div>

      <div className="mb-6 relative max-w-md">
         <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
         <input type="text" placeholder={activeTab === 'TEACHERS' ? "Tìm giảng viên (Tên, Email)..." : "Tìm học viên..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 chamfer-sm text-sm font-bold text-slate-700 outline-none focus:border-[#14452F] transition-all shadow-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-20 text-center"><i className="fas fa-circle-notch fa-spin text-3xl text-[#14452F]"></i></div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 gap-3 border-2 border-dashed border-slate-200 chamfer-md bg-slate-50"><i className="fas fa-inbox text-4xl"></i><span className="font-black uppercase tracking-widest text-xs">Không tìm thấy dữ liệu</span></div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="bg-white p-6 chamfer-md border border-slate-200 hover:border-[#14452F] hover:shadow-xl transition-all group relative overflow-hidden flex flex-col h-full">
              
              {/* DELETE BUTTON */}
              <button 
                onClick={() => handleDeleteUser(user.id, user.fullName)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-red-500 hover:text-white text-slate-400 flex items-center justify-center transition-all z-10"
                title="Xóa vĩnh viễn"
              >
                  <i className="fas fa-trash-alt text-[10px]"></i>
              </button>

              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 border-2 chamfer-sm flex items-center justify-center text-xl shadow-sm ${activeTab === 'TEACHERS' ? 'bg-[#E8F5E9] border-[#14452F] text-[#14452F]' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover chamfer-sm" /> : <i className={`fas ${activeTab === 'TEACHERS' ? 'fa-user-tie' : 'fa-user-graduate'}`}></i>}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-800 text-sm uppercase truncate leading-tight pr-6">{user.fullName}</h4>
                  <p className="text-[10px] text-slate-500 font-mono truncate mt-1">{user.email}</p>
                  <p className="text-[9px] text-slate-400 font-mono truncate mt-0.5">ID: {user.id.substring(0, 8)}...</p>
                  <div className="mt-2"><span className={`text-[8px] font-bold px-2 py-0.5 chamfer-sm uppercase ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{user.status === 'active' ? 'Active' : 'Pending'}</span></div>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-100">
                 {activeTab === 'TEACHERS' ? (
                    <button onClick={() => handleUpdateRole(user.id, 'student')} className="w-full py-2 bg-red-50 text-red-600 border border-red-100 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"><i className="fas fa-arrow-down"></i> Hủy quyền Giảng viên</button>
                 ) : (
                    <button onClick={() => handleUpdateRole(user.id, 'teacher')} className="w-full py-2 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#0F3624] transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/10"><i className="fas fa-arrow-up"></i> Thăng cấp Giảng viên</button>
                 )}
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md chamfer-lg p-8 shadow-2xl animate-slide-up border-t-4 border-[#14452F]">
            <div className="mb-8"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thêm Giảng viên</h3></div>
            <div className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Họ và Tên</label>
                <input type="text" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" autoFocus placeholder="Ví dụ: Nguyễn Văn A" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Email Đăng nhập</label>
                <input type="email" value={newTeacherEmail} onChange={e => setNewTeacherEmail(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" placeholder="teacher@domain.edu.vn" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Mật khẩu Khởi tạo</label>
                <input type="password" value={newTeacherPassword} onChange={e => setNewTeacherPassword(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" placeholder="Tối thiểu 8 ký tự" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy</button>
                <button onClick={handleAddTeacher} disabled={isCreating} className="flex-1 py-3 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all disabled:opacity-70">{isCreating ? 'Đang tạo...' : 'Tạo tài khoản'}</button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default TeacherManager;