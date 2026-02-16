
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Class {
  id: string;
  name: string;
  teacher_id: string | null;
  is_active: boolean;
  teacher_name?: string;
}

interface ClassManagerProps {
  onNotify: (message: string, type: any) => void;
}

const ClassManager: React.FC<ClassManagerProps> = ({ onNotify }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*, profiles(full_name)');
      
      const { data: teacherData, error: teacherError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'teacher');

      if (classError) throw classError;
      if (teacherError) throw teacherError;

      setClasses(classData.map(c => ({
        ...c,
        teacher_name: (c as any).profiles?.full_name || 'Chưa gán'
      })));
      setTeachers(teacherData);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateClass = async () => {
    if (!newClassName) return;
    try {
      const { error } = await supabase
        .from('classes')
        .insert([{ name: newClassName }]);
      
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
      fetchData();
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  const assignTeacher = async (classId: string, teacherId: string) => {
    try {
      const { error } = await supabase
        .from('classes')
        .update({ teacher_id: teacherId })
        .eq('id', classId);
      
      if (error) throw error;
      onNotify("Đã gán giảng viên cho lớp.", "success");
      fetchData();
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  return (
    <div className="p-10 animate-fade-in">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Quản lý Lớp học</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Hệ thống phân phối giảng dạy</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all"
        >
          <i className="fas fa-plus"></i> Tạo Lớp mới
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-4">
          <thead>
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-6">
              <th className="px-8 py-4">Tên Lớp</th>
              <th className="px-8 py-4">Giảng viên phụ trách</th>
              <th className="px-8 py-4">Trạng thái</th>
              <th className="px-8 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {classes.map(c => (
              <tr key={c.id} className="bg-slate-50 hover:bg-slate-100 transition-all group rounded-2xl">
                <td className="px-8 py-6 font-black text-slate-800 rounded-l-[2rem]">{c.name}</td>
                <td className="px-8 py-6">
                  <select 
                    value={c.teacher_id || ''} 
                    onChange={(e) => assignTeacher(c.id, e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:border-blue-500"
                  >
                    <option value="">-- Chọn giảng viên --</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </td>
                <td className="px-8 py-6">
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${c.is_active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {c.is_active ? 'Đang hoạt động' : 'Đang tạm dừng'}
                  </span>
                </td>
                <td className="px-8 py-6 text-right rounded-r-[2rem]">
                  <button 
                    onClick={() => toggleClassActive(c.id, c.is_active)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${c.is_active ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'}`}
                  >
                    <i className={`fas ${c.is_active ? 'fa-pause' : 'fa-play'}`}></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-fade-in-up">
            <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tighter">Tạo Lớp học mới</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên Lớp (Ví dụ: K65-DIEN01)</label>
                <input required type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Hủy</button>
                <button onClick={handleCreateClass} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20">Tạo ngay</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassManager;
