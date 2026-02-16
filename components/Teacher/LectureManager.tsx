
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Lecture {
    id: string;
    title: string;
    file_url: string;
    shared_with_class_id: string;
    classes: { name: string };
    created_at: string;
}

interface LectureManagerProps {
    onNotify: (message: string, type: any) => void;
}

const LectureManager: React.FC<LectureManagerProps> = ({ onNotify }) => {
    const { user } = useAuth();
    const [lectures, setLectures] = useState<Lecture[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [formData, setFormData] = useState({ title: '', classId: '', file: null as File | null });

    const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

    const fetchData = async () => {
        try {
            if (isTeacher) {
                const { data: classData } = await supabase.from('classes').select('*').eq('teacher_id', user?.id);
                setClasses(classData || []);

                const { data: lectureData, error } = await supabase
                    .from('lectures')
                    .select('*, classes(name)')
                    .eq('creator_id', user?.id);
                
                if (error) throw error;
                setLectures(lectureData as any);
            } else if (user?.classId) {
                // Học viên chỉ thấy bài giảng của lớp mình
                const { data: lectureData, error } = await supabase
                    .from('lectures')
                    .select('*, classes(name)')
                    .eq('shared_with_class_id', user.classId);
                
                if (error) throw error;
                setLectures(lectureData as any);
            }
        } catch (err: any) {
            onNotify(err.message, 'error');
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.file || !formData.classId) return;

        setIsUploading(true);
        try {
            const fileExt = formData.file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `lectures/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('elearning')
                .upload(filePath, formData.file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('elearning')
                .getPublicUrl(filePath);

            const { error: dbError } = await supabase
                .from('lectures')
                .insert([{
                    title: formData.title,
                    file_url: publicUrl,
                    creator_id: user?.id,
                    shared_with_class_id: formData.classId
                }]);

            if (dbError) throw dbError;

            onNotify("Đã tải bài giảng lên thành công!", "success");
            setShowUploadModal(false);
            fetchData();
        } catch (err: any) {
            onNotify(err.message, "error");
        } finally {
            setIsUploading(false);
        }
    };

    const deleteLecture = async (id: string, url: string) => {
        if (!window.confirm("Xóa bài giảng này?")) return;
        try {
            const { error } = await supabase.from('lectures').delete().eq('id', id);
            if (error) throw error;
            onNotify("Đã xóa bài giảng.", "info");
            fetchData();
        } catch (err: any) {
            onNotify(err.message, "error");
        }
    };

    return (
        <div className="p-10 animate-fade-in space-y-10 max-w-7xl mx-auto">
            <header className="flex justify-between items-end bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="relative z-10">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Kho Bài giảng Số</h2>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">
                        {isTeacher ? "Phân phối học liệu an toàn cho từng lớp học" : "Tài liệu học tập chính thống từ giảng viên"}
                    </p>
                </div>
                {isTeacher && (
                    <button 
                        onClick={() => setShowUploadModal(true)}
                        className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all flex items-center gap-3 relative z-10"
                    >
                        <i className="fas fa-cloud-arrow-up"></i> Tải bài giảng mới
                    </button>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {lectures.length === 0 ? (
                    <div className="col-span-full py-32 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Chưa có bài giảng nào được đăng tải</div>
                ) : (
                    lectures.map(l => (
                        <div key={l.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-inner">
                                        <i className="fas fa-file-pdf"></i>
                                    </div>
                                    {isTeacher && (
                                        <button onClick={() => deleteLecture(l.id, l.file_url)} className="text-slate-300 hover:text-red-500 transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                                    )}
                                </div>
                                <h4 className="font-black text-slate-800 text-lg leading-snug line-clamp-2 mb-4">{l.title}</h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-indigo-500 uppercase bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Lớp: {l.classes?.name}</span>
                                </div>
                            </div>
                            <a href={l.file_url} target="_blank" className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all">
                                <i className="fas fa-eye"></i> Xem bài giảng
                            </a>
                        </div>
                    ))
                )}
            </div>

            {showUploadModal && isTeacher && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-fade-in-up">
                        <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tighter">Tải lên bài giảng PDF</h3>
                        <form onSubmit={handleUpload} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề bài giảng</label>
                                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chia sẻ cho Lớp</label>
                                <select required value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold">
                                    <option value="">-- Chọn lớp --</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chọn tệp PDF</label>
                                <input required type="file" accept=".pdf" onChange={e => setFormData({...formData, file: e.target.files?.[0] || null})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold text-xs" />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest">Hủy</button>
                                <button type="submit" disabled={isUploading} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
                                    {isUploading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : null}
                                    {isUploading ? 'ĐANG TẢI...' : 'TẢI LÊN NGAY'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LectureManager;
