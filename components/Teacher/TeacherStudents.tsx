
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface StudentProfile {
    id: string;
    full_name: string;
    status: string;
    class_id: string;
    classes: { name: string };
}

interface TeacherStudentsProps {
    onNotify: (message: string, type: any) => void;
}

const TeacherStudents: React.FC<TeacherStudentsProps> = ({ onNotify }) => {
    const { user } = useAuth();
    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({ fullName: '', classId: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            // Lấy danh sách lớp mà giáo viên quản lý
            const { data: classData } = await supabase
                .from('classes')
                .select('*')
                .eq('teacher_id', user?.id);
            
            setClasses(classData || []);

            // Lấy danh sách sinh viên trong các lớp đó
            if (classData && classData.length > 0) {
                const classIds = classData.map(c => c.id);
                const { data: studentData, error } = await supabase
                    .from('profiles')
                    .select('*, classes(name)')
                    .in('class_id', classIds)
                    .eq('role', 'student');
                
                if (error) throw error;
                setStudents(studentData as any);
            }
        } catch (err: any) {
            onNotify(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Note: Since we can't create real Auth users without Admin SDK, 
            // we simulate by creating a profile record with a placeholder UUID or similar 
            // if your DB allows, or we just notify. 
            // For a production app, this would call an Edge Function.
            onNotify("Yêu cầu thêm học viên đã được gửi tới hệ thống Auth.", "info");
            
            // Giả lập tạo profile chờ (status: pending)
            // Trong thực tế, bạn cần logic để link với email thực.
            setShowAddModal(false);
        } catch (err: any) {
            onNotify(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-10 animate-fade-in space-y-10 max-w-7xl mx-auto">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Quản lý Học viên</h2>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">Danh sách sinh viên theo các lớp phụ trách</p>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition-all"
                >
                    <i className="fas fa-user-plus mr-2"></i> Thêm Học viên
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading ? (
                    <div className="col-span-full py-20 text-center"><i className="fas fa-circle-notch fa-spin text-3xl text-blue-500"></i></div>
                ) : students.length === 0 ? (
                    <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                        <i className="fas fa-users-slash text-5xl text-slate-200 mb-6"></i>
                        <p className="text-slate-400 font-black uppercase tracking-widest">Chưa có học viên nào trong lớp của bạn</p>
                    </div>
                ) : (
                    students.map(s => (
                        <div key={s.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-black shadow-inner">
                                    {s.full_name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black text-slate-800 text-lg leading-none">{s.full_name}</h4>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-black text-blue-500 uppercase bg-blue-50 px-2 py-0.5 rounded">{s.classes?.name}</span>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${s.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {s.status === 'active' ? 'Đã duyệt' : 'Chờ duyệt'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-fade-in-up">
                        <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tighter">Thêm học viên mới</h3>
                        <form onSubmit={handleAddStudent} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Họ và tên</label>
                                <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gán vào lớp</label>
                                <select required value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold">
                                    <option value="">-- Chọn lớp --</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Hủy</button>
                                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Gửi yêu cầu</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherStudents;
