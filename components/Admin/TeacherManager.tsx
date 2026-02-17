
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserProfile } from '../../types';

interface TeacherManagerProps {
  onNotify: (message: string, type: any) => void;
}

const TeacherManager: React.FC<TeacherManagerProps> = ({ onNotify }) => {
  const [activeTab, setActiveTab] = useState<'TEACHERS' | 'CANDIDATES'>('TEACHERS');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['teacher', 'student']) // Lấy cả student để Admin thăng cấp
        .order('created_at', { ascending: false }); // Mới nhất lên đầu
      
      if (error) throw error;

      setUsers(data.map(d => ({
        id: d.id,
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
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      onNotify(`${actionName} thành công!`, 'success');
      // Cập nhật state local ngay lập tức
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'TEACHERS') return u.role === 'teacher' && matchSearch;
    return u.role === 'student' && matchSearch; // CANDIDATES (Mặc định khi tạo mới ở Supabase sẽ vào đây)
  });

  return (
    <div className="p-8 animate-fade-in font-[Roboto]">
      
      {/* Workflow Guide */}
      <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm">
         <div className="flex-1">
            <h4 className="text-sm font-black text-slate-800 uppercase mb-2 flex items-center gap-2">
                <i className="fas fa-server text-blue-600"></i> Quy trình thêm Giáo viên mới (An toàn)
            </h4>
            <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside font-medium">
               <li>Truy cập <strong>Supabase Dashboard &rarr; Authentication &rarr; Users &rarr; Add User</strong>.</li>
               <li>Nhập Email và Mật khẩu tạm thời cho Giáo viên.</li>
               <li>Quay lại đây và nhấn nút <strong className="text-blue-600">"Tải lại dữ liệu"</strong>.</li>
               <li>Tìm tài khoản vừa tạo ở tab <strong>"Học viên (Mới)"</strong> và nhấn nút <strong>"Thăng cấp"</strong>.</li>
            </ol>
         </div>
         <button 
            onClick={fetchProfiles}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-2 shadow-sm shrink-0"
         >
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i> Tải lại dữ liệu
         </button>
      </div>

      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <i className="fas fa-chalkboard-user text-[#14452F]"></i> Quản lý Nhân sự
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-8">Phân quyền Giảng viên & Đào tạo</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 chamfer-sm border border-slate-200">
            <button 
                onClick={() => setActiveTab('TEACHERS')} 
                className={`px-6 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'TEACHERS' ? 'bg-[#14452F] text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}
            >
                <i className="fas fa-user-tie"></i> Giảng viên
            </button>
            <button 
                onClick={() => setActiveTab('CANDIDATES')} 
                className={`px-6 py-2 chamfer-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'CANDIDATES' ? 'bg-[#14452F] text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}
            >
                <i className="fas fa-users"></i> Học viên (Mới)
            </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative max-w-md">
         <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
         <input 
            type="text" 
            placeholder={activeTab === 'TEACHERS' ? "Tìm giảng viên (Tên, Email)..." : "Tìm tài khoản mới tạo..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 chamfer-sm text-sm font-bold text-slate-700 outline-none focus:border-[#14452F] transition-all shadow-sm" 
         />
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-20 text-center"><i className="fas fa-circle-notch fa-spin text-3xl text-[#14452F]"></i></div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 gap-3 border-2 border-dashed border-slate-200 chamfer-md bg-slate-50">
             <i className="fas fa-inbox text-4xl"></i>
             <span className="font-black uppercase tracking-widest text-xs">Không tìm thấy dữ liệu</span>
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="bg-white p-6 chamfer-md border border-slate-200 hover:border-[#14452F] hover:shadow-xl transition-all group relative overflow-hidden flex flex-col h-full">
              
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 border-2 chamfer-sm flex items-center justify-center text-xl shadow-sm ${activeTab === 'TEACHERS' ? 'bg-[#E8F5E9] border-[#14452F] text-[#14452F]' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover chamfer-sm" /> : <i className={`fas ${activeTab === 'TEACHERS' ? 'fa-user-tie' : 'fa-user-graduate'}`}></i>}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-800 text-sm uppercase truncate leading-tight">{user.fullName}</h4>
                  <p className="text-[10px] text-slate-500 font-mono truncate mt-1">{user.email}</p>
                  <p className="text-[9px] text-slate-400 font-mono truncate mt-0.5">ID: {user.id.substring(0, 8)}...</p>
                  
                  <div className="mt-2">
                     <span className={`text-[8px] font-bold px-2 py-0.5 chamfer-sm uppercase ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {user.status === 'active' ? 'Đã xác thực' : 'Chờ duyệt'}
                     </span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-100">
                 {activeTab === 'TEACHERS' ? (
                    <button 
                        onClick={() => handleUpdateRole(user.id, 'student')}
                        className="w-full py-2 bg-red-50 text-red-600 border border-red-100 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <i className="fas fa-arrow-down"></i> Hủy quyền Giảng viên
                    </button>
                 ) : (
                    <button 
                        onClick={() => handleUpdateRole(user.id, 'teacher')}
                        className="w-full py-2 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#0F3624] transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/10"
                    >
                        <i className="fas fa-arrow-up"></i> Thăng cấp Giảng viên
                    </button>
                 )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeacherManager;
