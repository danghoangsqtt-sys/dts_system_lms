import React, { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import ExamRoom from '../OnlineTest/ExamRoom';
import { generateExamPaper } from '../../utils/examEngine';

export default function SelfStudyManager({ user }: { user: any }) {
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [selectedExam, setSelectedExam] = useState<any>(null);

    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [examPassword, setExamPassword] = useState('');
    const [shuffleQ, setShuffleQ] = useState(true);
    const [shuffleO, setShuffleO] = useState(true);
    const [examStatus, setExamStatus] = useState<'draft' | 'published'>('draft');

    const [activeExamData, setActiveExamData] = useState<any>(null);
    const [examQuestions, setExamQuestions] = useState<any[]>([]);
    const [examAnswerData, setExamAnswerData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const allExams = await databaseService.fetchExams();
                // CHỈ LẤY ĐỀ ÔN TẬP
                const studyExams = allExams.filter((e: any) => e.exam_purpose === 'self_study' || e.exam_purpose === 'both');
                
                let filteredExams = [];
                if (user.role === 'student') {
                    // HỌC VIÊN: Thấy toàn bộ đề Ôn tập đã xuất bản (KHÔNG CẦN CHECK LỚP)
                    filteredExams = studyExams.filter((e: any) => e.status === 'published');
                } else if (user.role === 'teacher') {
                    filteredExams = studyExams.filter((e: any) => e.creatorId === user.id);
                } else {
                    filteredExams = studyExams;
                }
                
                filteredExams.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setExams(filteredExams);
            } catch (err) { console.error('Lỗi tải đề ôn tập:', err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [user]);

    const openConfigModal = (exam: any) => {
        setSelectedExam(exam);
        setStartTime(exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : '');
        setEndTime(exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : '');
        setExamPassword(exam.exam_password || '');
        setShuffleQ(exam.shuffle_questions !== false);
        setShuffleO(exam.shuffle_options !== false);
        setExamStatus(exam.status || 'draft');
        setConfigModalOpen(true);
    };

    const handleSaveConfig = async () => {
        if (!selectedExam) return;
        try {
            const payload: any = {
                start_time: startTime ? new Date(startTime).toISOString() : null,
                end_time: endTime ? new Date(endTime).toISOString() : null,
                exam_password: examPassword,
                shuffle_questions: shuffleQ,
                shuffle_options: shuffleO,
                status: examStatus,
                class_id: null, // Ôn tập không gán lớp
                max_attempts: 9999 // Ôn tập làm vô hạn lần
            };
            await databaseService.updateExam(selectedExam.id, payload);
            setExams(prev => prev.map(e => e.id === selectedExam.id ? { ...e, ...payload } : e));
            setConfigModalOpen(false);
            alert('Đã lưu cấu hình bài Ôn tập!');
        } catch (e) { alert("Lỗi khi lưu cấu hình!"); }
    };

    const handleTakeExam = async (exam: any) => {
        const now = new Date();
        if (exam.start_time && now < new Date(exam.start_time)) { alert("Chưa đến giờ mở đề!"); return; }
        if (exam.end_time && now > new Date(exam.end_time)) { alert("Đã đóng đề!"); return; }
        if (exam.exam_password) {
            const pass = window.prompt("Nhập mật khẩu ôn tập:");
            if (pass !== exam.exam_password) { alert("Sai mật khẩu!"); return; }
        }

        try {
            const sourceQuestions = await databaseService.fetchQuestions(); 
            const examFolderQuestions = sourceQuestions.filter(q => {
                const meta = typeof q.metadata === 'string' ? JSON.parse(q.metadata) : (q.metadata || {});
                return meta.folder === exam.folder;
            });
            const { examQuestions, answerData } = generateExamPaper(examFolderQuestions, examFolderQuestions.length, "ONLINE_TEST");
            setExamQuestions(examQuestions);
            setExamAnswerData(answerData);
            setActiveExamData(exam);
        } catch (error) { alert("Lỗi tải đề ôn tập!"); }
    };

    if (activeExamData) {
        return <ExamRoom exam={activeExamData} questions={examQuestions} answerData={examAnswerData} user={user} onExit={() => setActiveExamData(null)} />;
    }

    return (
        <div className="p-6 h-full flex flex-col relative">
            <h1 className="text-2xl font-black text-[#14452F] uppercase mb-1">Ôn tập tự học</h1>
            <p className="text-slate-500 text-sm mb-6">Luyện tập không giới hạn với các đề thi được mở công khai.</p>
            
            {loading ? ( <div className="text-center p-8"><i className="fas fa-spinner fa-spin text-2xl text-[#14452F]"></i></div> ) 
            : exams.length === 0 ? (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                    <p className="text-slate-500">Hệ thống chưa có bài ôn tập nào.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {exams.map(exam => (
                        <div key={exam.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col hover:shadow-lg transition-all">
                            <h3 className="font-black text-[#14452F] text-lg mb-3 cursor-pointer hover:underline" onClick={() => {
                                if (user?.role === 'student') handleTakeExam(exam);
                            }}>{exam.title}</h3>
                            <div className="space-y-1 mb-4">
                                <p className="text-xs font-bold text-slate-600"><i className="fas fa-infinity mr-2 text-blue-500"></i> Làm lại không giới hạn</p>
                            </div>
                            
                            <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                                <span className={`text-[10px] font-black px-3 py-1.5 rounded uppercase tracking-widest ${exam.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {exam.status === 'published' ? 'Đã Xuất Bản' : 'Bản Nháp'}
                                </span>
                                {user?.role !== 'student' && (
                                    <div className="flex gap-2">
                                        <button className="text-orange-600 text-xs font-black uppercase hover:underline" title="Xem thống kê">
                                            <i className="fas fa-chart-bar"></i> Thống kê
                                        </button>
                                        <button onClick={() => openConfigModal(exam)} className="text-blue-600 text-xs font-black uppercase hover:underline">
                                            <i className="fas fa-cog"></i> Cài đặt
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {configModalOpen && selectedExam && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl">
                        <h3 className="font-black text-[#14452F] text-xl mb-4">CẤU HÌNH ÔN TẬP: {selectedExam.title}</h3>
                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold">Mở đề</label><input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border p-2 rounded" /></div>
                                <div><label className="text-xs font-bold">Đóng đề</label><input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full border p-2 rounded" /></div>
                            </div>
                            <label className="flex items-center gap-2"><input type="radio" checked={examStatus === 'draft'} onChange={() => setExamStatus('draft')} /> Nháp</label>
                            <label className="flex items-center gap-2"><input type="radio" checked={examStatus === 'published'} onChange={() => setExamStatus('published')} /> Xuất bản (Tất cả học viên đều thấy)</label>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setConfigModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded">Hủy</button>
                            <button onClick={handleSaveConfig} className="px-6 py-2 bg-[#14452F] text-white font-bold rounded">Lưu Cấu Hình</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
