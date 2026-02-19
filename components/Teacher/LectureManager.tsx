import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { databases, APPWRITE_CONFIG, Query } from '../../lib/appwrite';
import { useAuth } from '../../contexts/AuthContext';
import { databaseService } from '../../services/databaseService';

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
        if (!user?.id) return;
        try {
            if (isTeacher) {
                // Fetch classes
                const classRes = await databases.listDocuments(
                    APPWRITE_CONFIG.dbId, 
                    APPWRITE_CONFIG.collections.classes,
                    [Query.equal('teacher_id', [user.id])]
                );
                const classMap = new Map(classRes.documents.map(c => [c.$id, c.name]));
                setClasses(classRes.documents.map(c => ({ id: c.$id, name: c.name })));

                // Fetch lectures
                const lectureRes = await databases.listDocuments(
                    APPWRITE_CONFIG.dbId,
                    APPWRITE_CONFIG.collections.lectures,
                    [
                        Query.equal('creator_id', [user.id]),
                        Query.orderDesc('$createdAt')
                    ]
                );
                
                setLectures(lectureRes.documents.map((l: any) => ({
                    id: l.$id,
                    title: l.title,
                    file_url: l.file_url,
                    shared_with_class_id: l.shared_with_class_id,
                    classes: { name: classMap.get(l.shared_with_class_id) || 'Unknown' },
                    created_at: l.$createdAt
                })));

            } else if (user?.classId) {
                // Students
                const lectureRes = await databases.listDocuments(
                    APPWRITE_CONFIG.dbId,
                    APPWRITE_CONFIG.collections.lectures,
                    [
                        Query.equal('shared_with_class_id', [user.classId]),
                        Query.orderDesc('$createdAt')
                    ]
                );
                
                // For students, fetch their class name once
                let className = 'Lớp của bạn';
                try {
                    const cls = await databases.getDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.classes, user.classId);
                    className = cls.name;
                } catch(e) {}

                setLectures(lectureRes.documents.map((l: any) => ({
                    id: l.$id,
                    title: l.title,
                    file_url: l.file_url,
                    shared_with_class_id: l.shared_with_class_id,
                    classes: { name: className },
                    created_at: l.$createdAt
                })));
            }
        } catch (err: any) {
            console.error('LectureManager fetchData error:', err);
            onNotify(err.message, 'error');
        }
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.file || !formData.classId || !user?.id) return;

        setIsUploading(true);
        try {
            await databaseService.uploadLecture(formData.file, formData.title, formData.classId, user.id);

            onNotify("Đã tải bài giảng lên thành công!", "success");
            setShowUploadModal(false);
            setFormData({ title: '', classId: '', file: null });
            fetchData();
        } catch (err: any) {
            console.error(err);
            onNotify(err.message || "Lỗi tải lên", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const deleteLecture = async (id: string) => {
        if (!window.confirm("Xóa bài giảng này?")) return;
        try {
            await databases.deleteDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.lectures, id);
            // Lưu ý: Chưa xóa file gốc trong storage để đơn giản hóa, 
            // có thể bổ sung logic xóa file storage nếu cần thiết.
            onNotify("Đã xóa bài giảng.", "info");
            fetchData();
        } catch (err: any) {
            onNotify(err.message, "error");
        }
    };

    return (
        <div className="p-10 animate-fade-in space-y-10 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-end bg-white p-10 chamfer-lg border border-slate-100 chamfer-shadow relative overflow-hidden gap-4">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#14452F]/5 chamfer-sm -mr-20 -mt-20"></div>
                <div className="relative z-10">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Kho Bài giảng Số</h2>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">{isTeacher ? "Phân phối học liệu an toàn" : "Tài liệu học tập chính thống"}</p>
                </div>
                {isTeacher && (
                    <button onClick={() => setShowUploadModal(true)} className="bg-[#14452F] text-white px-10 py-4 chamfer-md font-black text-[11px] uppercase tracking-widest chamfer-shadow hover:bg-[#0F3624] transition-all flex items-center gap-3 relative z-10"><i className="fas fa-cloud-arrow-up"></i> Tải bài giảng mới</button>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {lectures.length === 0 ? (
                    <div className="col-span-full py-32 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Chưa có bài giảng nào được đăng tải</div>
                ) : (
                    lectures.map(l => (
                        <div key={l.id} className="bg-white p-8 chamfer-lg border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-14 h-14 bg-[#E8F5E9] text-[#14452F] chamfer-sm flex items-center justify-center text-xl shadow-inner"><i className="fas fa-file-pdf"></i></div>
                                    {isTeacher && <button onClick={() => deleteLecture(l.id)} className="text-slate-300 hover:text-red-500 transition-all"><i className="fas fa-trash-alt text-xs"></i></button>}
                                </div>
                                <h4 className="font-black text-slate-800 text-lg leading-snug line-clamp-2 mb-4 uppercase">{l.title}</h4>
                                <div className="flex items-center gap-2"><span className="text-[9px] font-black text-[#14452F] uppercase bg-[#E8F5E9] px-3 py-1 chamfer-sm border border-[#14452F]/10">Lớp: {l.classes?.name}</span></div>
                            </div>
                            <a href={l.file_url} target="_blank" rel="noopener noreferrer" className="mt-8 w-full py-4 bg-slate-900 text-white chamfer-md font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#14452F] transition-all"><i className="fas fa-eye"></i> Xem bài giảng</a>
                        </div>
                    ))
                )}
            </div>

            {showUploadModal && isTeacher && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white w-full max-w-md chamfer-lg p-10 chamfer-shadow animate-fade-in-up border border-white/20">
                        <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tighter uppercase">Tải lên bài giảng PDF</h3>
                        <form onSubmit={handleUpload} className="space-y-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề bài giảng</label><input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 chamfer-sm outline-none focus:border-[#14452F] font-bold text-slate-800" autoFocus /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chia sẻ cho Lớp</label><select required value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 chamfer-sm outline-none focus:border-[#14452F] font-bold text-slate-800"><option value="">-- Chọn lớp --</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chọn tệp PDF</label><input required type="file" accept=".pdf" onChange={e => setFormData({...formData, file: e.target.files?.[0] || null})} className="w-full p-4 bg-slate-50 border border-slate-200 chamfer-sm outline-none focus:border-[#14452F] font-bold text-xs" /></div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy</button>
                                <button type="submit" disabled={isUploading} className="flex-1 py-4 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-[#0F3624] transition-all">{isUploading ? 'ĐANG TẢI...' : 'TẢI LÊN NGAY'}</button>
                            </div>
                        </form>
                    </div>
                </div>, document.body
            )}
        </div>
    );
};

export default LectureManager;