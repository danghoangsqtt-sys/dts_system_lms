
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { Class, UserProfile } from '../../types';

interface ClassWithTeacher extends Class {
  teacherName?: string;
}

interface ClassManagerProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const ClassManager: React.FC<ClassManagerProps> = ({ onNotify }) => {
  const [classes, setClasses] = useState<ClassWithTeacher[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*, teacher:teacher_id(full_name)')
        .order('created_at', { ascending: false });
      
      if (classError) throw classError;

      const { data: teacherData, error: teacherError } = await supabase
        .from('profiles')
        .select('id, full_name, role, status')
        .eq('role', 'teacher');

      if (teacherError) throw teacherError;

      const mappedClasses: ClassWithTeacher[] = (classData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        teacherId: c.teacher_id,
        isActive: c.is_active,
        createdAt: new Date(c.created_at).getTime(),
        teacherName: c.teacher?.full_name || 'Chưa gán'
      }));

      const mappedTeachers: UserProfile[] = (teacherData || []).map((t: any) => ({
        id: t.id,
        fullName: t.full_name,
        role: t.role,
        status: t.status || 'active',
        email: '', 
        classId: '', 
        avatarUrl: ''
      }));

      setClasses(mappedClasses);
      setTeachers(mappedTeachers);
    } catch (err: any) {
      console.error(err);
      onNotify(err.message || "Lỗi tải dữ liệu lớp học", 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    try {
      const { error } = await supabase
        .from('classes')
        .insert([{ 
          name: newClassName,
          is_active: true 
        }]);
      
      if (error) throw error;
      
      onNotify("Đã tạo lớp học mới.", "success");
      setNewClassName('');
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  const toggleClassActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from('classes')
        .update({ is_active: !current })
        .eq('id', id);
      
      if (error) throw error;
      setClasses(prev => prev.map(c => c.id === id ? { ...c, isActive: !current } : c));
      onNotify(`Đã ${!current ? 'kích hoạt' : 'tạm dừng'} lớp học.`, "info");
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  const assignTeacher = async (classId: string, teacherId: string) => {
    try {
      const { error } = await supabase
        .from('classes')
        .update({ teacher_id: teacherId || null }) 
        .eq('id', classId);
      
      if (error) throw error;
      
      onNotify("Đã cập nhật giảng viên phụ trách.", "success");
      fetchData(); 
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <i className="fas fa-school text-[#14452F]"></i> Quản lý Lớp học
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-8">Cấu trúc tổ chức đào tạo</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-[#14452F] text-white px-6 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all flex items-center gap-2 active:scale-95"
        >
          <i className="fas fa-plus"></i> Khởi tạo Lớp
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px] space-y-3">
          {/* Header Row */}
          <div className="flex px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 chamfer-sm border border-slate-100">
             <div className="w-1/4">Tên Lớp / Mã</div>
             <div className="w-1/3">Giảng viên phụ trách</div>
             <div className="w-1/4 text-center">Trạng thái</div>
             <div className="w-1/6 text-right">Điều khiển</div>
          </div>

          {/* Data Rows */}
          {classes.map(c => (
             <div key={c.id} className="flex items-center px-6 py-4 bg-white border-2 border-slate-100 chamfer-sm hover:border-[#14452F]/30 hover:shadow-md transition-all group">
                <div className="w-1/4 font-black text-slate-800 text-sm">{c.name}</div>
                <div className="w-1/3">
                   <select 
                    value={c.teacherId || ''} 
                    onChange={(e) => assignTeacher(c.id, e.target.value)}
                    className="bg-slate-50 border border-slate-200 chamfer-sm px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#14452F] w-full max-w-[200px]"
                  >
                    <option value="">-- Chưa gán --</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                  </select>
                </div>
                <div className="w-1/4 text-center">
                   <span className={`px-3 py-1 chamfer-sm text-[9px] font-black uppercase tracking-widest ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="w-1/6 text-right">
                   <button 
                    onClick={() => toggleClassActive(c.id, c.isActive)}
                    className={`w-10 h-10 chamfer-sm flex items-center justify-center transition-all ml-auto ${c.isActive ? 'bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white' : 'bg-[#14452F] text-white hover:bg-[#0F3624]'}`}
                    title={c.isActive ? "Tạm dừng" : "Kích hoạt"}
                  >
                    <i className={`fas ${c.isActive ? 'fa-pause' : 'fa-play'}`}></i>
                  </button>
                </div>
             </div>
          ))}
        </div>
        
        {!loading && classes.length === 0 && (
          <div className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest border-2 border-dashed border-slate-200 chamfer-md mt-4">
            Chưa có lớp học nào
          </div>
        )}
      </div>

      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md chamfer-lg p-8 shadow-2xl animate-slide-up border-t-4 border-[#14452F]">
            <div className="mb-8">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tạo Lớp học mới</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Cấu hình đơn vị lớp</p>
            </div>
            
            <div className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Tên Lớp (Mã hóa)</label>
                <input required type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" autoFocus placeholder="K65-DTVT-01" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy</button>
                <button onClick={handleCreateClass} className="flex-1 py-3 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all">Khởi tạo</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ClassManager;
