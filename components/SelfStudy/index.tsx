import React, { useState, useEffect } from 'react';
import { databaseService, fetchStudentAttemptCount } from '../../services/databaseService';
import ExamRoom from '../OnlineTest/ExamRoom';
import ExamStatistics from '../ExamStatistics';
import { generateExamPaper } from '../../utils/examEngine';

export default function SelfStudyManager({ user }: { user: any }) {
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [selectedExam, setSelectedExam] = useState<any>(null);

    // Config Form States
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [examPassword, setExamPassword] = useState('');
    const [shuffleQ, setShuffleQ] = useState(true);
    const [shuffleO, setShuffleO] = useState(true);
    const [examStatus, setExamStatus] = useState<'draft' | 'published'>('draft');

    // Phòng thi
    const [activeExamData, setActiveExamData] = useState<any>(null);
    const [examQuestions, setExamQuestions] = useState<any[]>([]);
    const [examAnswerData, setExamAnswerData] = useState<any>(null);

    // Thống kê
    const [statsExam, setStatsExam] = useState<any>(null);

    const isTeacherOrAdmin = user?.role === 'admin' || user?.role === 'teacher';

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // Truyền ID và Role để Backend cho phép lấy dữ liệu
                const allExams = await databaseService.fetchExams(user.id, user.role);
                // CHỈ LẤY ĐỀ ÔN TẬP
                const studyExams = allExams.filter((e: any) => e.exam_purpose === 'self_study' || e.exam_purpose === 'both');
                
                let filteredExams = [];
                if (user.role === 'student') {
                    // HỌC VIÊN: Thấy toàn bộ đề Ôn tập đã xuất bản (KHÔNG CẦN CHECK LỚP)
                    filteredExams = studyExams.filter((e: any) => e.status === 'published');
                } else if (user.role === 'teacher') {
                    filteredExams = studyExams.filter((e: any) => e.creatorId === user.id || e.creator_id === user.id);
                } else {
                    filteredExams = studyExams;
                }
                
                filteredExams.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
            const examFolderQuestions = sourceQuestions.filter((q: any) => {
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
            <p className="text-slate-500 text-sm mb-6">
                {isTeacherOrAdmin
                    ? 'Quản lý và theo dõi thống kê các bài ôn tập. Học viên được phép làm lại không giới hạn.'
                    : 'Luyện tập không giới hạn với các đề thi được mở công khai.'}
            </p>
            
            {loading ? ( <div className="text-center p-8"><i className="fas fa-spinner fa-spin text-2xl text-[#14452F]"></i></div> ) 
            : exams.length === 0 ? (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mb-4">
                        <i className="fas fa-book-reader"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Chưa có bài ôn tập nào</h3>
                    <p className="text-slate-500">
                        {isTeacherOrAdmin
                            ? 'Hãy tạo đề thi với mục đích "Ôn tập" trong Ngân hàng Đề để bài ôn tập xuất hiện tại đây.'
                            : 'Khi Giảng viên xuất bản bài ôn tập, đề sẽ xuất hiện tại đây.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {exams.map(exam => (
                        <div key={exam.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col hover:shadow-lg transition-all">
                            <h3 className="font-black text-[#14452F] text-lg mb-2 cursor-pointer hover:underline" onClick={() => {
                                if (user?.role === 'student') handleTakeExam(exam);
                            }}>{exam.title}</h3>
                            
                            <div className="space-y-1 mb-3 text-xs text-slate-600">
                                <p><i className="fas fa-infinity mr-2 text-blue-500"></i> Làm lại không giới hạn</p>
                                {exam.start_time && <p><i className="fas fa-clock mr-2 text-green-500"></i> Mở: {new Date(exam.start_time).toLocaleString('vi-VN')}</p>}
                                {exam.end_time && <p><i className="fas fa-hourglass-end mr-2 text-orange-500"></i> Đóng: {new Date(exam.end_time).toLocaleString('vi-VN')}</p>}
                                {exam.exam_password && <p><i className="fas fa-lock mr-2 text-red-500"></i> Có mật khẩu</p>}
                            </div>
                            
                            <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                                <span className={`text-[10px] font-black px-3 py-1.5 rounded uppercase tracking-widest ${exam.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {exam.status === 'published' ? 'Đã Xuất Bản' : 'Bản Nháp'}
                                </span>
                                {isTeacherOrAdmin && (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setStatsExam(exam)} 
                                            className="text-orange-600 text-xs font-black uppercase hover:underline"
                                            title="Xem thống kê bài ôn tập"
                                        >
                                            <i className="fas fa-chart-bar mr-1"></i> Thống kê
                                        </button>
                                        <button onClick={() => openConfigModal(exam)} className="text-blue-600 text-xs font-black uppercase hover:underline">
                                            <i className="fas fa-cog mr-1"></i> Cài đặt
                                        </button>
                                    </div>
                                )}
                                {user?.role === 'student' && (
                                    <button onClick={() => handleTakeExam(exam)} className="bg-[#14452F] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#0F3624] transition-all">
                                        <i className="fas fa-play mr-1"></i> Làm bài
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL CẤU HÌNH ÔN TẬP */}
            {configModalOpen && selectedExam && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl">
                        <h3 className="font-black text-[#14452F] text-xl mb-4 uppercase border-b-2 border-slate-100 pb-2">
                            Cấu hình Ôn tập: <span className="text-blue-600">{selectedExam.title}</span>
                        </h3>

                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Thời gian Mở đề</label>
                                    <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border-2 border-slate-200 p-2 rounded outline-none focus:border-[#14452F]" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Thời gian Đóng đề</label>
                                    <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full border-2 border-slate-200 p-2 rounded outline-none focus:border-[#14452F]" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu (Để trống nếu tự do)</label>
                                <input type="text" value={examPassword} onChange={e => setExamPassword(e.target.value)} placeholder="Nhập mật khẩu..." className="w-full border-2 border-slate-200 p-2 rounded outline-none focus:border-[#14452F]" />
                            </div>

                            <div className="flex gap-6 bg-slate-50 p-3 rounded border border-slate-200">
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-700">
                                    <input type="checkbox" checked={shuffleQ} onChange={e => setShuffleQ(e.target.checked)} className="w-4 h-4 text-[#14452F]" /> Đảo câu hỏi
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-700">
                                    <input type="checkbox" checked={shuffleO} onChange={e => setShuffleO(e.target.checked)} className="w-4 h-4 text-[#14452F]" /> Đảo đáp án
                                </label>
                            </div>

                            <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                <p className="text-xs font-bold text-blue-700"><i className="fas fa-infinity mr-2"></i> Ôn tập: Làm lại không giới hạn | Không gán lớp</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">Trạng thái phát hành</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="selfStudyStatus" checked={examStatus === 'draft'} onChange={() => setExamStatus('draft')} /> <span className="text-sm font-bold text-slate-600">Lưu nháp</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="selfStudyStatus" checked={examStatus === 'published'} onChange={() => setExamStatus('published')} /> <span className="text-sm font-bold text-green-600">Xuất bản (Tất cả học viên đều thấy)</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setConfigModalOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded">Hủy</button>
                            <button onClick={handleSaveConfig} className="px-6 py-2 bg-[#14452F] text-white font-bold rounded">Lưu Cấu Hình</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL THỐNG KÊ */}
            {statsExam && (
                <ExamStatistics 
                    examId={statsExam.id} 
                    examTitle={statsExam.title} 
                    onClose={() => setStatsExam(null)} 
                />
            )}
        </div>
    );
}
