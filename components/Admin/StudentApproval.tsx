
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Student {
  id: string;
  full_name: string;
  class_name?: string;
  status: 'pending' | 'active';
}

interface StudentApprovalProps {
  onNotify: (message: string, type: any) => void;
}

const StudentApproval: React.FC<StudentApprovalProps> = ({ onNotify }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, classes(name)')
        .eq('role', 'student')
        .eq('status', 'pending');
      
      if (error) throw error;
      setStudents(data.map(d => ({
        id: d.id,
        full_name: d.full_name,
        class_name: (d as any).classes?.name || 'Chưa gán lớp',
        status: d.status
      })));
    } catch (err: any) {
      onNotify(err.message, 'error');
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
      onNotify("Đã phê duyệt học viên.", "success");
      fetchPendingStudents();
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  return (
    <div className="p-10 animate-fade-in">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Phê duyệt Học viên</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Yêu cầu đăng ký chờ duyệt</p>
        </div>
        <button 
          onClick={fetchPendingStudents}
          className="bg-slate-50 text-slate-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-all"
        >
          <i className="fas fa-sync-alt mr-2"></i> Làm mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full py-20 text-center"><i className="fas fa-circle-notch fa-spin text-3xl text-blue-500"></i></div>
        ) : students.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <i className="fas fa-check-double text-4xl text-green-500/20"></i>
            <p className="text-slate-300 font-black uppercase tracking-widest">Không có yêu cầu chờ duyệt</p>
          </div>
        ) : (
          students.map(s => (
            <div key={s.id} className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm font-black text-sm">
                    {s.full_name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-lg leading-none">{s.full_name}</h4>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full mt-2 inline-block">
                      Lớp: {s.class_name}
                    </span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => approveStudent(s.id)}
                className="w-full mt-8 py-4 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-green-900/10 hover:bg-green-500 transition-all flex items-center justify-center gap-3"
              >
                <i className="fas fa-user-check"></i> Duyệt Học viên
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudentApproval;
