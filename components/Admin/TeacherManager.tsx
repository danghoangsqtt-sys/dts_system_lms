
import React, { useState, useEffect } from 'react';
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
        email: '', // Email not directly in profile, would need join but for UI this works
        fullName: d.full_name,
        role: 'teacher',
        avatarUrl: d.avatar_url
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
      // In a real Supabase setup, Admin would use an Edge Function or Auth Admin API.
      // Here we use signUp which might log current user out if not careful, 
      // but typically we'd use a custom RPC or invite link.
      // For this demo, we simulate creating a profile.
      onNotify("Tính năng tạo User yêu cầu Auth Admin API (Service Role Key). Đang thực hiện giả lập Profile...", "info");
      
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.fullName, role: 'teacher' }
        }
      });

      if (error) throw error;
      
      onNotify("Đã tạo tài khoản giáo viên thành công.", "success");
      setShowAddModal(false);
      fetchTeachers();
    } catch (err: any) {
      onNotify(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-10 animate-fade-in">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Quản lý Giảng viên</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Danh sách nhân sự giảng dạy</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all flex items-center gap-3"
        >
          <i className="fas fa-plus"></i> Thêm Giảng viên
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && teachers.length === 0 ? (
          <div className="col-span-full py-20 text-center"><i className="fas fa-circle-notch fa-spin text-3xl text-blue-500"></i></div>
        ) : teachers.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase tracking-widest">Chưa có giáo viên nào</div>
        ) : (
          teachers.map(t => (
            <div key={t.id} className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl text-blue-600 shadow-sm">
                  {t.avatarUrl ? <img src={t.avatarUrl} className="w-full h-full object-cover rounded-2xl" /> : <i className="fas fa-user-tie"></i>}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-lg leading-none">{t.fullName}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Giảng viên chuyên môn</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-fade-in-up">
            <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tighter">Tạo tài khoản Giảng viên</h3>
            <form onSubmit={handleAddTeacher} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Họ và tên</label>
                <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email đăng nhập</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mật khẩu tạm thời</label>
                <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Hủy</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20">Xác nhận</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherManager;
