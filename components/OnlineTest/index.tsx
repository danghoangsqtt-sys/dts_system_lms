import React, { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import ExamRoom from './ExamRoom';
import { generateExamPaper } from '../../utils/examEngine';

export default function OnlineTestManager({ user }: { user: any }) {
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [selectedExam, setSelectedExam] = useState<any>(null);

    // Form States
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [examPassword, setExamPassword] = useState('');
    const [shuffleQ, setShuffleQ] = useState(true);
    const [shuffleO, setShuffleO] = useState(true);
    const [examStatus, setExamStatus] = useState<'draft' | 'published'>('draft');
    const [maxAttempts, setMaxAttempts] = useState<number>(1);

    // Phòng thi
    const [activeExamData, setActiveExamData] = useState<any>(null);
    const [examQuestions, setExamQuestions] = useState<any[]>([]);
    const [examAnswerData, setExamAnswerData] = useState<any>(null);

    // Giao lớp
    const [availableClasses, setAvailableClasses] = useState<any[]>([]);
    const [targetClassId, setTargetClassId] = useState<string>('');

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // 1. Tải danh sách lớp AN TOÀN (Không sập nếu chưa có API fetchClasses)
                if (user.role !== 'student') {
                    try {
                        if (typeof databaseService.fetchClasses === 'function') {
                            const classes = await databaseService.fetchClasses();
                            setAvailableClasses(classes || []);
                        }
                    } catch (classErr) {
                        console.warn("Chưa có API Class hoặc Lỗi tải Lớp học:", classErr);
                    }
                }

                // 2. Tải toàn bộ Đề thi
                const allExams = await databaseService.fetchExams();
                
                // 3. Lọc đề thi (Chỉ lấy đề có mục đích Kiểm Tra hoặc Cả hai)
                const onlineExams = allExams.filter((e: any) => e.exam_purpose === 'online_test' || e.exam_purpose === 'both');
                
                let filteredExams = [];
                const role = user.role?.toLowerCase();

                if (role === 'student') {
                    // Học viên: Thấy đề đã Xuất bản + Đúng Lớp
                    const studentClassId = user.class_id || user.classId || '';
                    filteredExams = onlineExams.filter((e: any) => 
                        e.status === 'published' && e.class_id === studentClassId
                    );
                } else if (role === 'teacher') {
                    // Giáo viên: Thấy đề do mình tạo (Bảo toàn cả 2 kiểu biến)
                    filteredExams = onlineExams.filter((e: any) => e.creatorId === user.id || e.creator_id === user.id);
                } else {
                    // Admin: Thấy toàn bộ đề kiểm tra
                    filteredExams = onlineExams;
                }
                
                // Sắp xếp đề mới nhất lên đầu
                filteredExams.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setExams(filteredExams);
            } catch (err) { 
                console.error('Lỗi tải đề thi Online Test:', err); 
            } finally { 
                setLoading(false); 
            }
        };
        fetchData();
    }, [user]);

    const isTeacherOrAdmin = user?.role === 'admin' || user?.role === 'teacher';

    const openConfigModal = (exam: any) => {
        setSelectedExam(exam);
        setStartTime(exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : '');
        setEndTime(exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : '');
        setExamPassword(exam.exam_password || '');
        setShuffleQ(exam.shuffle_questions !== false);
        setShuffleO(exam.shuffle_options !== false);
        setExamStatus(exam.status || 'draft');
        setTargetClassId(exam.class_id || '');
        setMaxAttempts(exam.max_attempts || 1);
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
                class_id: targetClassId || null,
                max_attempts: maxAttempts
            };
            await databaseService.updateExam(selectedExam.id, payload);
            setExams(prev => prev.map(e => e.id === selectedExam.id ? { ...e, ...payload } : e));
            setConfigModalOpen(false);
            alert('Đã lưu cấu hình bài thi Kiểm tra!');
        } catch (e) { alert("Lỗi khi lưu cấu hình!"); }
    };

    const handleTakeExam = async (exam: any) => {
        // 1. Kiểm tra thời gian
        const now = new Date();
        if (exam.start_time && now < new Date(exam.start_time)) {
            alert("Chưa đến giờ làm bài!"); return;
        }
        if (exam.end_time && now > new Date(exam.end_time)) {
            alert("Đã hết thời gian làm bài!"); return;
        }

        // 2. Kiểm tra mật khẩu
        if (exam.exam_password) {
            const pass = window.prompt("Bài thi này có mật khẩu. Vui lòng nhập mật khẩu:");
            if (pass !== exam.exam_password) {
                alert("Mật khẩu không chính xác!"); return;
            }
        }

        try {
            // 3. Lấy câu hỏi gốc
            const sourceQuestions = await databaseService.fetchQuestions(user.id, user.role);
            const examFolderQuestions = sourceQuestions.filter((q: any) => {
                const meta = typeof q.metadata === 'string' ? JSON.parse(q.metadata) : (q.metadata || {});
                return meta.folder === exam.folder;
            });

            // 4. Trộn đề
            const { examQuestions: eqs, answerData } = generateExamPaper(examFolderQuestions, examFolderQuestions.length, "ONLINE_TEST");

            setExamQuestions(eqs);
            setExamAnswerData(answerData);
            setActiveExamData(exam);
        } catch (error) {
            alert("Lỗi khi tải đề thi!");
        }
    };

    // Nếu đang thi, ẩn danh sách đi và hiện ExamRoom
    if (activeExamData) {
        return (
            <ExamRoom 
                exam={activeExamData} 
                questions={examQuestions} 
                answerData={examAnswerData} 
                user={user} 
                onExit={() => setActiveExamData(null)} 
            />
        );
    }

    return (
        <div className="p-6 h-full flex flex-col">
            <h1 className="text-2xl font-black text-[#14452F] uppercase mb-1">Kiểm tra trực tuyến</h1>
            <p className="text-slate-500 text-sm mb-6">
                {isTeacherOrAdmin
                    ? 'Quản lý và cấu hình các bài kiểm tra đã giao cho lớp.'
                    : 'Danh sách các bài kiểm tra được giao cho lớp của bạn.'}
            </p>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                    <i className="fas fa-circle-notch fa-spin text-2xl mr-3"></i> Đang tải...
                </div>
            ) : exams.length === 0 ? (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-4">
                        <i className="fas fa-file-signature"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Chưa có bài kiểm tra nào</h3>
                    <p className="text-slate-500">
                        {isTeacherOrAdmin
                            ? 'Hãy giao đề thi cho lớp từ Ngân hàng Đề để bài thi xuất hiện tại đây.'
                            : 'Khi Giảng viên giao đề thi cho lớp, bài kiểm tra sẽ xuất hiện tại đây.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {exams.map(exam => (
                        <div key={exam.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col cursor-pointer hover:shadow-md transition-all" onClick={() => {
                            if (user?.role === 'student') {
                                handleTakeExam(exam);
                            } else {
                                openConfigModal(exam);
                            }
                        }}>
                            <h3 className="font-bold text-[#14452F] text-lg mb-2">{exam.title}</h3>
                            <p className="text-sm text-slate-600 mb-1"><i className="fas fa-clock mr-2"></i> Mở: {exam.start_time ? new Date(exam.start_time).toLocaleString() : 'Tự do'}</p>
                            <p className="text-sm text-slate-600 mb-3"><i className="fas fa-hourglass-end mr-2"></i> Đóng: {exam.end_time ? new Date(exam.end_time).toLocaleString() : 'Tự do'}</p>
                            <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center">
                                <span className={`text-xs font-bold px-2 py-1 rounded ${exam.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {exam.status === 'published' ? 'Đã Xuất Bản' : 'Bản Nháp'}
                                </span>
                                <button className="text-blue-600 text-sm font-bold hover:underline">Cấu hình <i className="fas fa-cog"></i></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL CẤU HÌNH BÀI THI */}
            {configModalOpen && selectedExam && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl">
                        <h3 className="font-black text-[#14452F] text-xl mb-4 uppercase border-b-2 border-slate-100 pb-2">
                            Cấu hình Bài Thi: <span className="text-blue-600">{selectedExam.title}</span>
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
                                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu (Để trống nếu thi tự do)</label>
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

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Giao cho Lớp</label>
                                <select 
                                    value={targetClassId} 
                                    onChange={e => setTargetClassId(e.target.value)}
                                    title="Chọn lớp để giao đề thi"
                                    className="w-full border-2 border-slate-200 p-2 rounded outline-none focus:border-[#14452F] font-bold text-sm"
                                >
                                    <option value="">-- Chưa giao lớp --</option>
                                    {availableClasses.map((cls: any) => (
                                        <option key={cls.$id || cls.id} value={cls.$id || cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Số lần thi tối đa</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={maxAttempts} 
                                    onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)}
                                    className="w-full border-2 border-slate-200 p-2 rounded outline-none focus:border-[#14452F]" 
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">Trạng thái phát hành</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="status" checked={examStatus === 'draft'} onChange={() => setExamStatus('draft')} /> <span className="text-sm font-bold text-slate-600">Lưu nháp</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="status" checked={examStatus === 'published'} onChange={() => setExamStatus('published')} /> <span className="text-sm font-bold text-green-600">Xuất bản (Thi ngay / Theo giờ)</span>
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
        </div>
    );
}
