
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { UserProfile } from '../../types';

interface TeacherManagerProps {
  onNotify: (message: string, type: any) => void;
}

const TeacherManager: React.FC<TeacherManagerProps> = ({ onNotify }) => {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '' });

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'teacher');
      
      if (error) throw error;
      setTeachers(data.map(d => ({
        id: d.id,
        email: '', 
        fullName: d.full_name,
        role: 'teacher',
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
    fetchTeachers();
  }, []);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      onNotify("Đang xử lý yêu cầu tạo tài khoản...", "info");
      
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.fullName, role: 'teacher' }
        }
      });

      if (error) throw error;
      
      onNotify("Đã tạo hồ sơ giảng viên thành công.", "success");
      setShowAddModal(false);
      setFormData({ email: '', password: '', fullName: '' });
      fetchTeachers();
    } catch (err: any) {
      onNotify(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <i className="fas fa-chalkboard-user text-[#14452F]"></i> Danh sách Giảng viên
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-8">Nhân sự đào tạo chính thức</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-[#14452F] text-white px-6 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all flex items-center gap-2 active:scale-95"
        >
          <i className="fas fa-plus"></i> Cấp tài khoản mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && teachers.length === 0 ? (
          <div className="col-span-full py-20 text-center"><i className="fas fa-circle-notch fa-spin text-3xl text-[#14452F]"></i></div>
        ) : teachers.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase tracking-widest border-2 border-dashed border-slate-200 chamfer-md">Không có dữ liệu giảng viên</div>
        ) : (
          teachers.map(t => (
            <div key={t.id} className="bg-slate-50 p-6 chamfer-md border border-slate-200 hover:border-[#14452F] hover:shadow-xl transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#14452F] w-16 h-16 -mr-8 -mt-8 rotate-45"></div>
              
              <div className="flex items-start gap-5 relative z-10">
                <div className="w-14 h-14 bg-white border-2 border-slate-200 chamfer-sm flex items-center justify-center text-2xl text-[#14452F] shadow-sm">
                  {t.avatarUrl ? <img src={t.avatarUrl} className="w-full h-full object-cover chamfer-sm" /> : <i className="fas fa-user-tie"></i>}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-800 text-sm uppercase truncate">{t.fullName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="text-[9px] font-bold bg-[#E8F5E9] text-[#14452F] px-2 py-0.5 chamfer-sm uppercase">Giảng viên</span>
                     <span className={`text-[8px] font-bold px-2 py-0.5 chamfer-sm uppercase ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t.status === 'active' ? 'Hoạt động' : 'Khóa'}
                     </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-2 truncate">ID: {t.id.substring(0, 8)}...</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md chamfer-lg p-8 shadow-2xl animate-slide-up border-t-4 border-[#14452F]">
            <div className="mb-8">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cấp tài khoản Giảng viên</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Thông tin đăng nhập hệ thống</p>
            </div>
            
            <form onSubmit={handleAddTeacher} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Họ và tên</label>
                <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" autoFocus placeholder="NGUYEN VAN A" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Email định danh</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" placeholder="email@truong.edu.vn" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Mật khẩu khởi tạo</label>
                <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy bỏ</button>
                <button type="submit" className="flex-1 py-3 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all">Xác nhận cấp</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TeacherManager;
