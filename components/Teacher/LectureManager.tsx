import React, { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';

interface CourseItem { id: string; title: string; type: 'PDF' | 'PPT' | 'VIDEO'; url: string; }
interface CourseModule { id: string; title: string; items: CourseItem[]; }
interface Course { id?: string; title: string; class_id: string; config: { modules: CourseModule[] }; createdAt?: number; }

export default function LectureManager({ user }: { user: any }) {
    const [courses, setCourses] = useState<Course[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Điều hướng: LIST (Danh sách) | EDIT (Giáo viên soạn bài) | LEARN (Học viên/Giáo viên vào xem)
    const [viewMode, setViewMode] = useState<'LIST' | 'EDIT' | 'LEARN'>('LIST');
    const [activeCourse, setActiveCourse] = useState<Course | null>(null);
    const [activeItem, setActiveItem] = useState<CourseItem | null>(null);
    
    // Ghi chú
    const [note, setNote] = useState('');

    useEffect(() => {
        const fetchInitData = async () => {
            if (!user) return; // Chốt chặn an toàn
            setLoading(true);
            try {
                if (user.role !== 'student' && typeof databaseService.fetchClasses === 'function') {
                    const cls = await databaseService.fetchClasses();
                    setClasses(cls || []);
                }
                const studentClassId = user.class_id || user.classId;
                const fetchedCourses = await databaseService.fetchLectures(user.id, user.role, studentClassId);
                setCourses(fetchedCourses);
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchInitData();
    }, [user]);

    // Xử lý Ghi chú (Lưu tạm vào LocalStorage theo Bài học + ID User)
    useEffect(() => {
        if (activeItem && activeCourse && user?.id) {
            const savedNote = localStorage.getItem(`lms_note_${activeCourse.id}_${activeItem.id}_${user.id}`);
            setNote(savedNote || '');
        }
    }, [activeItem, activeCourse, user?.id]);

    const handleSaveNote = (text: string) => {
        setNote(text);
        if (activeItem && activeCourse && user?.id) {
            localStorage.setItem(`lms_note_${activeCourse.id}_${activeItem.id}_${user.id}`, text);
        }
    };

    // Hàm chuyển đổi Link Drive/Youtube thành Iframe nhúng
    const getEmbedUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : url.split('/').pop();
            return `https://www.youtube.com/embed/${videoId}`;
        }
        if (url.includes('drive.google.com')) {
            return url.replace(/\/view.*$/, '/preview'); // Chuyển /view thành /preview để xem trực tiếp
        }
        return url;
    };

    // --- CÁC HÀM XỬ LÝ BUILDER (GIÁO VIÊN) ---
    const handleAddModule = () => {
        if (!activeCourse) return;
        const newModule: CourseModule = { id: Date.now().toString(), title: 'Chương mới', items: [] };
        setActiveCourse({ ...activeCourse, config: { modules: [...activeCourse.config.modules, newModule] } });
    };

    const handleAddItem = (moduleId: string) => {
        if (!activeCourse) return;
        const newItem: CourseItem = { id: Date.now().toString(), title: 'Tài liệu mới', type: 'PDF', url: '' };
        const updatedModules = activeCourse.config.modules.map(m => 
            m.id === moduleId ? { ...m, items: [...m.items, newItem] } : m
        );
        setActiveCourse({ ...activeCourse, config: { modules: updatedModules } });
    };

    const handleUpdateItem = (moduleId: string, itemId: string, field: keyof CourseItem, value: string) => {
        if (!activeCourse) return;
        const updatedModules = activeCourse.config.modules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, items: m.items.map(i => i.id === itemId ? { ...i, [field]: value } : i) };
        });
        setActiveCourse({ ...activeCourse, config: { modules: updatedModules } });
    };

    const handleSaveCourseDB = async () => {
        if (!activeCourse?.title) return alert("Vui lòng nhập tên Khóa học!");
        try {
            setLoading(true);
            const saved = await databaseService.saveCourse(activeCourse, user?.id || 'unknown');
            setCourses(prev => {
                const exists = prev.find(c => c.id === saved.id);
                return exists ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev];
            });
            setViewMode('LIST');
            alert("Đã lưu Môn học thành công!");
        } catch (error) { alert("Lỗi khi lưu!"); }
        finally { setLoading(false); }
    };

    // --- RENDER GIAO DIỆN ---
    if (loading) return <div className="p-10 text-center"><i className="fas fa-spinner fa-spin text-3xl text-[#14452F]"></i></div>;

    // 1. MÀN HÌNH HỌC TẬP / XEM TÀI LIỆU (LEARN MODE)
    if (viewMode === 'LEARN' && activeCourse) {
        return (
            <div className="h-full flex bg-slate-50 relative">
                {/* Nút thoát */}
                <button onClick={() => setViewMode('LIST')} className="absolute top-4 right-6 z-50 bg-white shadow-md px-4 py-2 rounded-lg font-bold text-slate-600 hover:text-red-500 hover:shadow-lg transition-all">
                    <i className="fas fa-sign-out-alt mr-2"></i> Thoát
                </button>

                {/* Cột trái: Cây thư mục */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm">
                    <div className="p-5 border-b border-slate-100 bg-[#14452F] text-white">
                        <h2 className="font-black text-lg leading-tight">{activeCourse.title}</h2>
                        <p className="text-xs opacity-80 mt-1"><i className="fas fa-book-open mr-1"></i> {activeCourse.config.modules.length} Chương</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {activeCourse.config.modules.map((mod, mIdx) => (
                            <div key={mod.id} className="space-y-2">
                                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight bg-slate-100 px-3 py-2 rounded-md">
                                    Chương {mIdx + 1}: {mod.title}
                                </h3>
                                <div className="pl-2 space-y-1">
                                    {mod.items.map(item => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => setActiveItem(item)}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${activeItem?.id === item.id ? 'bg-[#E8F5E9] text-[#14452F] border border-green-200 font-bold shadow-sm' : 'hover:bg-slate-50 text-slate-600 border border-transparent'}`}
                                        >
                                            <i className={`text-lg ${item.type === 'VIDEO' ? 'fab fa-youtube text-red-500' : item.type === 'PDF' ? 'fas fa-file-pdf text-red-400' : 'fas fa-file-powerpoint text-orange-500'}`}></i>
                                            <span className="text-sm truncate flex-1">{item.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Cột phải: Khung hiển thị & Ghi chú */}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Phần trên: Iframe View */}
                    <div className="flex-1 bg-slate-200 p-4 relative">
                        {activeItem ? (
                            <div className="w-full h-full bg-white rounded-xl shadow-inner overflow-hidden border border-slate-300">
                                {activeItem.url ? (
                                    <iframe src={getEmbedUrl(activeItem.url)} className="w-full h-full border-0" allow="autoplay" allowFullScreen></iframe>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <i className="fas fa-link-slash text-4xl mb-3"></i>
                                        <p>Chưa có Link đính kèm cho tài liệu này.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <i className="fas fa-hand-pointer text-5xl mb-4 opacity-50"></i>
                                <p className="text-lg font-bold">Vui lòng chọn một bài học ở danh sách bên trái</p>
                            </div>
                        )}
                    </div>

                    {/* Phần dưới: Ghi chú */}
                    <div className="h-64 bg-white border-t-2 border-slate-200 p-4 flex flex-col shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-10">
                        <div className="flex justify-between items-end mb-2">
                            <h3 className="font-black text-[#14452F] text-sm uppercase tracking-widest"><i className="fas fa-pen-nib mr-2"></i>Sổ tay ghi chú</h3>
                            {activeItem && <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Đang ghi chú cho: {activeItem.title}</span>}
                        </div>
                        <textarea
                            value={note}
                            onChange={(e) => handleSaveNote(e.target.value)}
                            disabled={!activeItem}
                            placeholder={activeItem ? "Gõ ghi chú của bạn vào đây. Dữ liệu sẽ tự động được lưu lại..." : "Hãy chọn một bài học để bắt đầu ghi chú..."}
                            className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-lg p-4 outline-none focus:border-[#14452F] focus:bg-white transition-all font-medium text-slate-700 resize-none disabled:opacity-50"
                        />
                    </div>
                </div>
            </div>
        );
    }

    // 2. MÀN HÌNH SOẠN THẢO KHÓA HỌC (EDIT MODE - Dành cho Giáo viên)
    if (viewMode === 'EDIT' && activeCourse) {
        return (
            <div className="p-8 max-w-5xl mx-auto space-y-6">
                <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div>
                        <h2 className="text-2xl font-black text-[#14452F] uppercase">Soạn Thảo Môn Học</h2>
                        <p className="text-slate-500 text-sm">Thiết lập cấu trúc chương trình và chèn Link tài liệu.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setViewMode('LIST')} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200">Hủy bỏ</button>
                        <button onClick={handleSaveCourseDB} className="px-6 py-3 bg-[#14452F] text-white font-black rounded-lg hover:bg-[#0f3523] shadow-md"><i className="fas fa-save mr-2"></i> Lưu Xuất Bản</button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <h3 className="font-bold text-lg text-slate-800 border-b pb-2">Thông tin chung</h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên Môn Học</label>
                            <input type="text" value={activeCourse.title} onChange={e => setActiveCourse({...activeCourse, title: e.target.value})} className="w-full p-3 bg-slate-50 border rounded outline-none focus:border-[#14452F]" placeholder="VD: Lập trình C++ Cơ bản" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Giao cho Lớp học</label>
                            <select value={activeCourse.class_id || ''} onChange={e => setActiveCourse({...activeCourse, class_id: e.target.value})} className="w-full p-3 bg-slate-50 border rounded outline-none focus:border-[#14452F]">
                                <option value="">-- Chọn lớp áp dụng --</option>
                                {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <h3 className="font-bold text-lg text-slate-800">Cấu trúc Chương trình</h3>
                        <button onClick={handleAddModule} className="px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded border border-blue-200 hover:bg-blue-100"><i className="fas fa-plus mr-1"></i> Thêm Chương Mới</button>
                    </div>

                    {activeCourse.config.modules.map((mod, mIdx) => (
                        <div key={mod.id} className="bg-white p-5 rounded-xl shadow-sm border-2 border-slate-200 space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="bg-slate-800 text-white font-black px-3 py-1 rounded text-sm">CHƯƠNG {mIdx + 1}</span>
                                <input type="text" value={mod.title} onChange={e => {
                                    const newMods = [...activeCourse.config.modules];
                                    newMods[mIdx].title = e.target.value;
                                    setActiveCourse({...activeCourse, config: {modules: newMods}});
                                }} className="flex-1 font-bold text-lg bg-transparent outline-none border-b-2 border-dashed border-slate-300 focus:border-[#14452F]" placeholder="Tên chương..." />
                            </div>

                            <div className="pl-14 space-y-3">
                                {mod.items.map((item, iIdx) => (
                                    <div key={item.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                                        <select value={item.type} onChange={e => handleUpdateItem(mod.id, item.id, 'type', e.target.value)} className="p-2 border rounded font-bold text-xs bg-white w-24 outline-none">
                                            <option value="PDF">PDF</option>
                                            <option value="PPT">PowerPoint</option>
                                            <option value="VIDEO">Video/Youtube</option>
                                        </select>
                                        <input type="text" value={item.title} onChange={e => handleUpdateItem(mod.id, item.id, 'title', e.target.value)} className="flex-1 p-2 border rounded outline-none text-sm font-medium" placeholder="Tên bài học..." />
                                        <input type="text" value={item.url} onChange={e => handleUpdateItem(mod.id, item.id, 'url', e.target.value)} className="flex-[2] p-2 border rounded outline-none text-sm text-blue-600 font-mono" placeholder="Dán Link Google Drive hoặc Youtube vào đây..." />
                                        <button onClick={() => {
                                            const newMods = [...activeCourse.config.modules];
                                            newMods[mIdx].items = newMods[mIdx].items.filter(i => i.id !== item.id);
                                            setActiveCourse({...activeCourse, config: {modules: newMods}});
                                        }} className="text-red-400 hover:text-red-600 p-2"><i className="fas fa-trash"></i></button>
                                    </div>
                                ))}
                                <button onClick={() => handleAddItem(mod.id)} className="text-sm font-bold text-blue-600 hover:underline"><i className="fas fa-plus-circle mr-1"></i> Thêm Tài liệu</button>
                            </div>
                        </div>
                    ))}
                    
                    {activeCourse.config.modules.length === 0 && (
                        <div className="text-center p-10 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold">
                            Chưa có chương nào. Hãy bấm "Thêm Chương Mới".
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 3. MÀN HÌNH DANH SÁCH KHÓA HỌC (LIST MODE)
    return (
        <div className="p-6 h-full flex flex-col relative">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-black text-[#14452F] uppercase mb-1">Bài giảng số (Khóa học)</h1>
                    <p className="text-slate-500 text-sm">Nền tảng học tập đa phương tiện tương tác trực tiếp.</p>
                </div>
                {user.role !== 'student' && (
                    <button onClick={() => {
                        setActiveCourse({ title: '', class_id: '', config: { modules: [] } });
                        setViewMode('EDIT');
                    }} className="px-6 py-3 bg-[#14452F] text-white rounded-lg font-black uppercase shadow-lg hover:bg-[#0f3523] hover:shadow-xl transition-all">
                        <i className="fas fa-plus-circle mr-2"></i> Tạo Môn Học Mới
                    </button>
                )}
            </div>

            {courses.length === 0 ? (
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center p-10">
                    <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4"><i className="fas fa-layer-group text-4xl"></i></div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Chưa có môn học nào</h3>
                    <p className="text-slate-500 max-w-md">Giáo viên hãy tạo môn học, cấu hình cây bài giảng và giao cho các Lớp để học viên có thể bắt đầu quá trình học tập.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map(course => (
                        <div key={course.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all flex flex-col group">
                            <div className="h-32 bg-gradient-to-r from-[#14452F] to-[#2E7D32] relative p-5 flex flex-col justify-end">
                                <i className="fas fa-laptop-code absolute top-4 right-4 text-4xl text-white opacity-20"></i>
                                <span className="bg-white/20 text-white backdrop-blur-sm px-2 py-1 rounded text-[10px] font-black w-max mb-2 border border-white/30 uppercase tracking-widest">
                                    {course.class_id ? `Lớp ID: ${course.class_id}` : 'Chưa giao lớp'}
                                </span>
                                <h3 className="font-black text-white text-xl truncate drop-shadow-md">{course.title}</h3>
                            </div>
                            
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex gap-4 mb-4 text-sm font-bold text-slate-500">
                                    <div className="flex items-center gap-1"><i className="fas fa-folder text-yellow-500"></i> {course.config.modules.length} Chương</div>
                                    <div className="flex items-center gap-1"><i className="fas fa-file-alt text-blue-500"></i> {course.config.modules.reduce((acc, mod) => acc + mod.items.length, 0)} Bài học</div>
                                </div>
                                
                                <div className="mt-auto flex gap-2 pt-4 border-t border-slate-100">
                                    <button onClick={() => { setActiveCourse(course); setActiveItem(null); setViewMode('LEARN'); }} className="flex-1 py-2.5 bg-green-50 text-green-700 font-black rounded-lg hover:bg-green-600 hover:text-white transition-colors border border-green-200 hover:border-green-600">
                                        <i className="fas fa-play-circle mr-1"></i> VÀO HỌC
                                    </button>
                                    {user.role !== 'student' && (
                                        <button onClick={() => { setActiveCourse(course); setViewMode('EDIT'); }} className="px-4 py-2.5 bg-slate-100 text-slate-600 font-black rounded-lg hover:bg-slate-800 hover:text-white transition-colors" title="Soạn giáo trình">
                                            <i className="fas fa-pen"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}