
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserProfile } from '../../types';

interface StudentWithClass extends UserProfile {
  className?: string;
}

interface StudentApprovalProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const StudentApproval: React.FC<StudentApprovalProps> = ({ onNotify }) => {
  const [students, setStudents] = useState<StudentWithClass[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, classes:class_id(name)')
        .eq('role', 'student')
        .eq('status', 'pending');
      
      if (error) throw error;

      const mappedStudents: StudentWithClass[] = (data || []).map((s: any) => ({
        id: s.id,
        fullName: s.full_name,
        role: s.role,
        status: s.status,
        classId: s.class_id,
        avatarUrl: s.avatar_url,
        updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : undefined,
        className: s.classes?.name || 'Chưa gán lớp',
        email: '' 
      }));

      setStudents(mappedStudents);
    } catch (err: any) {
      console.error(err);
      onNotify(err.message || 'Lỗi tải danh sách học viên', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingStudents();
  }, []);

  const approveStudent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'active' })
        .eq('id', id);
      
      if (error) throw error;
      
      onNotify("Đã phê duyệt quyền truy cập.", "success");
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <i className="fas fa-user-clock text-[#14452F]"></i> Yêu cầu truy cập
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-8">Danh sách học viên chờ duyệt vào lớp</p>
        </div>
        <button 
          onClick={fetchPendingStudents}
          className="bg-slate-100 text-slate-500 px-6 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
        >
          <i className="fas fa-sync-alt"></i> Tải lại
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center"><i className="fas fa-circle-notch fa-spin text-3xl text-[#14452F]"></i></div>
        ) : students.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 gap-4 border-2 border-dashed border-slate-200 chamfer-lg">
            <i className="fas fa-check-double text-4xl opacity-50"></i>
            <p className="font-black uppercase tracking-widest text-xs">Không có yêu cầu nào đang chờ</p>
          </div>
        ) : (
          students.map(s => (
            <div key={s.id} className="bg-white border-l-4 border-orange-400 p-6 chamfer-md shadow-sm hover:shadow-lg transition-all relative group">
              <div className="flex justify-between items-start mb-4">
                 <div className="w-12 h-12 bg-slate-100 chamfer-sm flex items-center justify-center text-slate-500 font-black uppercase text-lg border border-slate-200">
                    {s.fullName.charAt(0)}
                 </div>
                 <span className="text-[8px] font-black uppercase bg-orange-100 text-orange-600 px-2 py-1 chamfer-sm animate-pulse">Pending</span>
              </div>
              
              <div className="mb-6">
                 <h4 className="font-black text-slate-800 text-lg uppercase truncate">{s.fullName}</h4>
                 <div className="flex items-center gap-2 mt-2">
                    <i className="fas fa-layer-group text-slate-400 text-xs"></i>
                    <span className="text-xs font-bold text-slate-500 uppercase">{s.className}</span>
                 </div>
              </div>
              
              <button 
                onClick={() => approveStudent(s.id)}
                className="w-full py-3 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#0F3624] transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <i className="fas fa-check"></i> Chấp thuận
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudentApproval;
