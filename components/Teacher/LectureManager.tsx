import React, { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { useAuth } from '../../contexts/AuthContext';

interface CourseItem { id: string; title: string; type: 'PDF' | 'PPT' | 'VIDEO'; url: string; }
interface CourseModule { id: string; title: string; items: CourseItem[]; }
interface Course { id?: string; title: string; class_id: string; config: { modules: CourseModule[] }; createdAt?: number; }

export default function LectureManager(props: any) {
    const auth = useAuth();
    const user = props.user || auth?.user;

    const [courses, setCourses] = useState<Course[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // LIST (Danh sách) | EDIT (Cấu hình tổng) | LEARN (Live Studio / Học viên xem)
    const [viewMode, setViewMode] = useState<'LIST' | 'EDIT' | 'LEARN'>('LIST');
    const [activeCourse, setActiveCourse] = useState<Course | null>(null);
    const [activeItem, setActiveItem] = useState<CourseItem | null>(null);
    
    const [note, setNote] = useState('');

    useEffect(() => {
        const fetchInitData = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
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

    const getEmbedUrl = (url: string) => {
        if (!url) return '';
        
        // 1. Xử lý Link Youtube
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : url.split('/').pop();
            return `https://www.youtube.com/embed/${videoId}`;
        }
        
        // 2. Xử lý Link Google Slides / Docs / Sheets (Tuyệt chiêu ép hiển thị tĩnh)
        if (url.includes('docs.google.com')) {
            // Đổi đuôi /edit hoặc /view thành /embed và thêm ?rm=minimal để giấu toàn bộ Menu/Thanh công cụ
            return url.replace(/\/(edit|view).*$/, '/embed?rm=minimal');
        }

        // 3. Xử lý Link Google Drive (File PPTX/PDF gốc chưa qua Google Slides)
        if (url.includes('drive.google.com')) {
            try {
                let fileId = '';
                const parts = url.split('/');
                const dIndex = parts.indexOf('d');
                if (dIndex !== -1 && parts.length > dIndex + 1) {
                    fileId = parts[dIndex + 1];
                } else if (url.includes('?id=')) {
                    fileId = new URL(url).searchParams.get('id') || '';
                }
                if (fileId) {
                    return `https://drive.google.com/file/d/${fileId}/preview`;
                }
            } catch (error) {
                console.error("Lỗi trích xuất File ID:", error);
            }
            return url.replace(/\/view.*$/, '/preview'); 
        }
        
        return url;
    };

    // --- CÁC HÀM XỬ LÝ DỮ LIỆU ---
    const handleAddModule = () => {
        if (!activeCourse) return;
        const currentModules = activeCourse.config?.modules || [];
        const newModule: CourseModule = { id: Date.now().toString(), title: 'Chương mới', items: [] };
        setActiveCourse({ ...activeCourse, config: { ...activeCourse.config, modules: [...currentModules, newModule] } });
    };

    const handleAddItem = (moduleId: string) => {
        if (!activeCourse) return;
        const currentModules = activeCourse.config?.modules || [];
        const newItem: CourseItem = { id: Date.now().toString(), title: 'Tài liệu mới', type: 'VIDEO', url: '' };
        const updatedModules = currentModules.map(m => 
            m.id === moduleId ? { ...m, items: [...(m.items || []), newItem] } : m
        );
        setActiveCourse({ ...activeCourse, config: { ...activeCourse.config, modules: updatedModules } });
        setActiveItem(newItem); // Tự động Focus vào bài mới tạo để GV dán link ngay
    };

    const handleUpdateItem = (moduleId: string, itemId: string, field: keyof CourseItem, value: string) => {
        if (!activeCourse) return;
        const currentModules = activeCourse.config?.modules || [];
        const updatedModules = currentModules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, items: (m.items || []).map(i => i.id === itemId ? { ...i, [field]: value } : i) };
        });
        setActiveCourse({ ...activeCourse, config: { ...activeCourse.config, modules: updatedModules } });
    };

    // Hàm cập nhật Item trực tiếp từ Toolbar (Inline Edit)
    const handleInlineUpdateItem = (field: keyof CourseItem, value: string) => {
        if (!activeItem || !activeCourse) return;
        const moduleId = activeCourse.config?.modules?.find(m => m.items?.some(i => i.id === activeItem.id))?.id;
        if (!moduleId) return;
        
        setActiveItem(prev => prev ? { ...prev, [field]: value } : prev);
        handleUpdateItem(moduleId, activeItem.id, field, value);
    };

    const handleDeleteItemInline = () => {
        if (!activeItem || !activeCourse) return;
        if (!window.confirm("Xóa tài liệu này?")) return;
        const moduleId = activeCourse.config?.modules?.find(m => m.items?.some(i => i.id === activeItem.id))?.id;
        if (!moduleId) return;
        const updatedModules = activeCourse.config.modules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, items: m.items.filter(i => i.id !== activeItem.id) };
        });
        setActiveCourse({ ...activeCourse, config: { ...activeCourse.config, modules: updatedModules } });
        setActiveItem(null);
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
            alert("Đã lưu Môn học thành công!");
            // Không thoát viewMode để GV tiếp tục làm việc
        } catch (error) { alert("Lỗi khi lưu!"); }
        finally { setLoading(false); }
    };

    const handleDeleteCourse = async (courseId: string, title: string) => {
        if (!window.confirm(`⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA MÔN HỌC:\n"${title}"\n\nHành động này sẽ xóa toàn bộ cây bài giảng và không thể hoàn tác!`)) return;
        try {
            setLoading(true);
            await databaseService.deleteCourse(courseId);
            setCourses(prev => prev.filter(c => c.id !== courseId));
            alert("Đã xóa môn học thành công!");
        } catch (error) { alert("Lỗi khi xóa môn học!"); } 
        finally { setLoading(false); }
    };

    // --- RENDER GIAO DIỆN ---
    if (loading) return <div className="p-10 text-center"><i className="fas fa-spinner fa-spin text-3xl text-[#14452F]"></i></div>;

    // 1. MÀN HÌNH LIVE STUDIO (HỌC TẬP VÀ SOẠN GIẢNG TRỰC TIẾP)
    if (viewMode === 'LEARN' && activeCourse) {
        return (
            <div className="h-full flex bg-slate-50 relative">
                {/* Nút công cụ Góc phải trên */}
                <div className="absolute top-4 right-6 z-50 flex gap-2">
                    {user.role !== 'student' && (
                        <button onClick={handleSaveCourseDB} className="bg-[#14452F] text-white shadow-md px-4 py-2 rounded-lg font-bold hover:bg-[#0f3523] hover:shadow-lg transition-all">
                            <i className="fas fa-save mr-2"></i> Lưu Xuất Bản
                        </button>
                    )}
                    <button onClick={() => setViewMode('LIST')} className="bg-white shadow-md px-4 py-2 rounded-lg font-bold text-slate-600 hover:text-red-500 hover:shadow-lg transition-all">
                        <i className="fas fa-sign-out-alt mr-2"></i> Thoát
                    </button>
                </div>

                {/* Cột trái: Cây thư mục (CÓ THỂ CHỈNH SỬA) */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm z-40">
                    <div className="p-5 border-b border-slate-100 bg-[#14452F] text-white">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="font-black text-lg leading-tight">{activeCourse.title}</h2>
                                <p className="text-xs opacity-80 mt-1"><i className="fas fa-book-open mr-1"></i> {(activeCourse.config?.modules || []).length} Chương</p>
                            </div>
                            {user.role !== 'student' && (
                                <button onClick={() => {
                                    const newTitle = prompt("Đổi tên Môn học:", activeCourse.title);
                                    if (newTitle) setActiveCourse({...activeCourse, title: newTitle});
                                }} className="text-white/50 hover:text-white" title="Đổi tên khóa học"><i className="fas fa-pen"></i></button>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar pb-20">
                        {(activeCourse.config?.modules || []).map((mod, mIdx) => (
                            <div key={mod.id} className="space-y-1">
                                <div className="flex justify-between items-center bg-slate-100 px-3 py-2 rounded-md mb-2">
                                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight truncate flex-1">
                                        Chương {mIdx + 1}: {mod.title}
                                    </h3>
                                    {user.role !== 'student' && (
                                        <div className="flex gap-2 ml-2">
                                            <button onClick={() => {
                                                const newTitle = prompt("Đổi tên Chương:", mod.title);
                                                if (newTitle) {
                                                    const newMods = [...activeCourse.config.modules];
                                                    newMods[mIdx].title = newTitle;
                                                    setActiveCourse({...activeCourse, config: {...activeCourse.config, modules: newMods}});
                                                }
                                            }} className="text-slate-400 hover:text-blue-600" title="Đổi tên chương"><i className="fas fa-edit"></i></button>
                                            <button onClick={() => {
                                                if(!window.confirm("Xóa toàn bộ chương này?")) return;
                                                const newMods = activeCourse.config.modules.filter(m => m.id !== mod.id);
                                                setActiveCourse({...activeCourse, config: {...activeCourse.config, modules: newMods}});
                                                if(activeItem && mod.items.some(i => i.id === activeItem.id)) setActiveItem(null);
                                            }} className="text-slate-400 hover:text-red-500" title="Xóa chương"><i className="fas fa-trash"></i></button>
                                        </div>
                                    )}
                                </div>

                                <div className="pl-2 space-y-1">
                                    {(mod.items || []).map(item => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => setActiveItem(item)}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${activeItem?.id === item.id ? 'bg-[#E8F5E9] text-[#14452F] border border-green-200 font-bold shadow-sm' : 'hover:bg-slate-50 text-slate-600 border border-transparent'}`}
                                        >
                                            <i className={`text-lg ${item.type === 'VIDEO' ? 'fab fa-youtube text-red-500' : item.type === 'PDF' ? 'fas fa-file-pdf text-red-400' : 'fas fa-file-powerpoint text-orange-500'}`}></i>
                                            <span className="text-sm truncate flex-1">{item.title}</span>
                                        </div>
                                    ))}
                                    {user.role !== 'student' && (
                                        <button onClick={() => handleAddItem(mod.id)} className="w-full text-left pl-3 py-2 mt-1 text-xs font-bold text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors">
                                            <i className="fas fa-plus mr-1"></i> Thêm Bài Học
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {user.role !== 'student' && (
                            <button onClick={handleAddModule} className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-lg hover:border-[#14452F] hover:text-[#14452F] hover:bg-green-50 transition-colors text-sm mt-4">
                                <i className="fas fa-plus-circle mr-1"></i> THÊM CHƯƠNG MỚI
                            </button>
                        )}
                    </div>
                </div>

                {/* Cột phải: Khung hiển thị, Inline Editor & Ghi chú */}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    
                    {/* TOOLBAR CHỈNH SỬA NHANH CHO GIÁO VIÊN */}
                    {user.role !== 'student' && activeItem && (
                        <div className="bg-white px-5 py-3 border-b border-slate-200 shadow-sm flex items-center gap-3 z-20">
                            <span className="text-xs font-black uppercase text-slate-400 whitespace-nowrap"><i className="fas fa-sliders-h mr-1"></i> Thuộc tính:</span>
                            <select 
                                value={activeItem.type} 
                                onChange={e => handleInlineUpdateItem('type', e.target.value)}
                                className="p-2 border border-slate-200 rounded text-sm font-bold text-slate-700 outline-none focus:border-[#14452F] bg-slate-50"
                                title="Loại tài liệu"
                            >
                                <option value="PDF">Tệp PDF</option>
                                <option value="PPT">Slide PPT</option>
                                <option value="VIDEO">Video / Youtube</option>
                            </select>
                            <input 
                                type="text" 
                                value={activeItem.title} 
                                onChange={e => handleInlineUpdateItem('title', e.target.value)}
                                placeholder="Tên bài học..."
                                className="p-2 border border-slate-200 rounded text-sm font-medium w-48 outline-none focus:border-[#14452F]"
                            />
                            <input 
                                type="text" 
                                value={activeItem.url} 
                                onChange={e => handleInlineUpdateItem('url', e.target.value)}
                                placeholder="Dán Link Google Drive hoặc Youtube vào đây để Preview..."
                                className="flex-1 p-2 border border-slate-200 rounded text-sm text-blue-600 font-mono outline-none focus:border-[#14452F]"
                            />
                            <button onClick={handleDeleteItemInline} className="px-3 py-2 bg-red-50 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors" title="Xóa tài liệu này">
                                <i className="fas fa-trash"></i>
                            </button>
                        </div>
                    )}

                    {/* Phần trên: Iframe View */}
                    <div className="flex-1 bg-slate-200 p-4 relative z-10">
                        {activeItem ? (
                            <div className="w-full h-full bg-white rounded-xl shadow-inner overflow-hidden border border-slate-300">
                                {activeItem.url ? (
                                    <iframe src={getEmbedUrl(activeItem.url)} className="w-full h-full border-0" allow="autoplay" allowFullScreen title={activeItem.title}></iframe>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50">
                                        <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mb-4"><i className="fas fa-link text-2xl"></i></div>
                                        <p className="font-bold text-lg text-slate-600 mb-1">Chưa có dữ liệu liên kết</p>
                                        {user.role !== 'student' ? (
                                            <p className="text-sm">Hãy dán Link vào ô phía trên để nội dung hiển thị ngay tại đây.</p>
                                        ) : (
                                            <p className="text-sm">Giáo viên chưa cập nhật tài liệu cho bài học này.</p>
                                        )}
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
                    <div className="h-56 bg-white border-t-2 border-slate-200 p-4 flex flex-col shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-20">
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

    // 2. MÀN HÌNH EDIT (CHỈ DÙNG ĐỂ CẤU HÌNH TÊN VÀ LỚP HỌC)
    if (viewMode === 'EDIT' && activeCourse) {
        return (
            <div className="p-8 max-w-3xl mx-auto space-y-6">
                <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div>
                        <h2 className="text-2xl font-black text-[#14452F] uppercase">Thông Tin Môn Học</h2>
                        <p className="text-slate-500 text-sm">Cài đặt tên môn học và phân công cho Lớp.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setViewMode('LIST')} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200">Hủy</button>
                        <button onClick={handleSaveCourseDB} className="px-6 py-3 bg-[#14452F] text-white font-black rounded-lg hover:bg-[#0f3523] shadow-md"><i className="fas fa-save mr-2"></i> Lưu Cấu Hình</button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tên Môn Học</label>
                        <input type="text" value={activeCourse.title} onChange={e => setActiveCourse({...activeCourse, title: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded outline-none focus:border-[#14452F] font-bold text-lg" placeholder="VD: Lập trình C++ Cơ bản" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Giao cho Lớp học</label>
                        <select value={activeCourse.class_id || ''} onChange={e => setActiveCourse({...activeCourse, class_id: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded outline-none focus:border-[#14452F] font-bold" title="Chọn lớp áp dụng">
                            <option value="">-- Chọn lớp áp dụng (Bỏ trống nếu dạy chung) --</option>
                            {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                        </select>
                    </div>
                    
                    <div className="p-4 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 font-medium text-sm">
                        <i className="fas fa-info-circle mr-2"></i> 
                        Để <b>thêm chương</b> và <b>chèn Link tài liệu</b>, hãy bấm "Lưu Cấu Hình", sau đó ra ngoài danh sách và bấm nút <b>VÀO HỌC</b>. Bạn sẽ được phép soạn giáo trình trực tiếp tại đó!
                    </div>
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
                    <p className="text-slate-500 text-sm">Nền tảng E-Learning với Live Studio chuyên nghiệp.</p>
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
                    <p className="text-slate-500 max-w-md">Hãy tạo môn học, sau đó bấm <b>VÀO HỌC</b> để vào Live Studio thêm Chương và Bài giảng trực tiếp.</p>
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
                                    <div className="flex items-center gap-1"><i className="fas fa-folder text-yellow-500"></i> {(course.config?.modules || []).length} Chương</div>
                                    <div className="flex items-center gap-1"><i className="fas fa-file-alt text-blue-500"></i> {(course.config?.modules || []).reduce((acc, mod) => acc + (mod.items || []).length, 0)} Bài học</div>
                                </div>
                                
                                <div className="mt-auto flex gap-2 pt-4 border-t border-slate-100">
                                    <button onClick={() => { setActiveCourse(course); setActiveItem(null); setViewMode('LEARN'); }} className="flex-1 py-2.5 bg-green-50 text-green-700 font-black rounded-lg hover:bg-green-600 hover:text-white transition-colors border border-green-200 hover:border-green-600 shadow-sm">
                                        <i className="fas fa-play-circle mr-1"></i> VÀO HỌC / SOẠN BÀI
                                    </button>
                                    {user.role !== 'student' && (
                                        <>
                                            <button onClick={() => { setActiveCourse(course); setViewMode('EDIT'); }} className="px-4 py-2.5 bg-slate-50 text-slate-600 font-black rounded-lg hover:bg-slate-200 transition-colors border border-slate-200" title="Cấu hình thông tin">
                                                <i className="fas fa-cog"></i>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); if (course.id) handleDeleteCourse(course.id, course.title); }} 
                                                className="px-4 py-2.5 bg-red-50 text-red-500 font-black rounded-lg hover:bg-red-600 hover:text-white transition-colors border border-red-100" title="Xóa môn học">
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </>
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