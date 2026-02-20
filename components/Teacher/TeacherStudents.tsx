import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { databaseService } from '../../services/databaseService';

interface EnrolledStudent {
    id: string;
    fullName: string;
    email: string;
    status: string;
    classId: string;
    className: string; // Helper for display
    avatarUrl?: string;
}

interface TeacherClass {
    id: string;
    name: string;
}

interface TeacherStudentsProps {
    onNotify: (message: string, type: any) => void;
}

const TeacherStudents: React.FC<TeacherStudentsProps> = ({ onNotify }) => {
    const { user } = useAuth();
    
    // Data Isolation States
    const [myClasses, setMyClasses] = useState<TeacherClass[]>([]);
    const [myStudents, setMyStudents] = useState<EnrolledStudent[]>([]);
    
    // UI States
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStudent, setNewStudent] = useState({ fullName: '', email: '', password: '' });
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClass) return alert("Vui lòng chọn một lớp học trước!");
        if (newStudent.password.length < 8) return alert("Mật khẩu phải từ 8 ký tự trở lên!");
        
        try {
            setIsCreating(true);
            const created = await databaseService.createStudentByTeacher({
                ...newStudent,
                classId: selectedClass,
                teacherName: user?.fullName || 'Giáo viên'
            });
            // Thêm className cho hiển thị UI
            const className = myClasses.find(c => c.id === selectedClass)?.name || '';
            setMyStudents(prev => [{ ...created, className, avatarUrl: created.avatarUrl || '' }, ...prev]);
            setShowAddModal(false);
            setNewStudent({ fullName: '', email: '', password: '' });
            onNotify("Đã tạo và phê duyệt tài khoản Học viên thành công!", "success");
        } catch (error: any) {
            alert(error.message || "Lỗi khi tạo tài khoản. Email có thể đã tồn tại!");
        } finally {
            setIsCreating(false);
        }
    };

    useEffect(() => {
        const fetchTeacherData = async () => {
            if (!user?.id) return;
            
            setLoading(true);
            setErrorMsg('');
            setMyClasses([]);
            setMyStudents([]);

            try {
                // BƯỚC 1: Lấy danh sách lớp do giáo viên này phụ trách
                // Hàm này đã được filter server-side bằng query teacher_id
                const classesRaw = await databaseService.fetchClasses(user.id);

                if (!classesRaw || classesRaw.length === 0) {
                    setErrorMsg("Bạn chưa được phân công chủ nhiệm lớp học nào. Vui lòng liên hệ Admin.");
                    setLoading(false);
                    return;
                }

                // Map sang format nhẹ hơn cho state
                const classesList: TeacherClass[] = classesRaw.map((c: any) => ({
                    id: c.$id,
                    name: c.name
                }));
                setMyClasses(classesList);

                // BƯỚC 3: Lấy danh sách học viên của từng lớp
                let allStudents: EnrolledStudent[] = [];
                
                // Dùng Promise.all để fetch song song danh sách học viên của các lớp
                const studentPromises = classesList.map(async (cls) => {
                    const studentsInClass = await databaseService.fetchStudentsByClass(cls.id);
                    // Map thêm tên lớp vào object học viên để hiển thị UI
                    return studentsInClass.map((s: any) => ({
                        id: s.id,
                        fullName: s.fullName,
                        email: s.email,
                        status: s.status,
                        classId: s.classId,
                        className: cls.name,
                        avatarUrl: s.avatarUrl
                    }));
                });

                const results = await Promise.all(studentPromises);
                // Gộp các mảng con thành 1 mảng duy nhất
                allStudents = results.flat();

                setMyStudents(allStudents);

            } catch (err: any) {
                console.error("Data Isolation Error:", err);
                setErrorMsg("Lỗi tải dữ liệu lớp học: " + err.message);
                onNotify("Không thể tải danh sách lớp chủ nhiệm.", "error");
            } finally {
                setLoading(false);
            }
        };

        fetchTeacherData();
    }, [user, onNotify]);

    return (
        <div className="p-10 animate-fade-in space-y-10 max-w-7xl mx-auto font-[Roboto]">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
                        Quản lý Học viên
                    </h2>
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                            Lớp chủ nhiệm:
                        </span>
                        {myClasses.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {myClasses.map(c => (
                                    <span key={c.id} className="text-[10px] font-black text-[#14452F] bg-[#E8F5E9] px-2 py-1 chamfer-sm">
                                        {c.name}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-[10px] italic text-slate-400">---</span>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="bg-slate-50 px-6 py-3 chamfer-sm border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Tổng số:</span>
                        <span className="text-xl font-black text-blue-600">{myStudents.length}</span>
                    </div>
                </div>
            </header>

            {/* CLASS SELECTOR + ADD BUTTON */}
            <div className="flex gap-4 items-center mb-6">
                <select 
                    title="Chọn lớp học"
                    value={selectedClass} 
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="p-3 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#14452F] font-bold min-w-[250px] shadow-sm"
                >
                    <option value="">-- Chọn lớp để xem danh sách --</option>
                    {myClasses.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                </select>
                
                {selectedClass && (
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="px-5 py-3 bg-[#14452F] hover:bg-[#0f3523] text-white rounded-lg font-bold shadow-md transition-all flex items-center gap-2"
                    >
                        <i className="fas fa-user-plus"></i> Cấp Tài Khoản Học Viên
                    </button>
                )}
            </div>

            {/* ERROR STATE */}
            {errorMsg && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-orange-200 bg-orange-50/50 chamfer-lg">
                    <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center text-2xl">
                        <i className="fas fa-exclamation-triangle"></i>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Chưa có dữ liệu lớp học</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">{errorMsg}</p>
                    </div>
                </div>
            )}

            {/* DATA GRID */}
            {!errorMsg && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {loading ? (
                        <div className="col-span-full py-20 text-center space-y-4">
                            <i className="fas fa-circle-notch fa-spin text-3xl text-[#14452F]"></i>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Đang đồng bộ dữ liệu lớp học...</p>
                        </div>
                    ) : myStudents.length === 0 ? (
                        <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                            <i className="fas fa-users-slash text-5xl text-slate-200 mb-6"></i>
                            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Lớp học chưa có học viên nào</p>
                        </div>
                    ) : (
                        myStudents.map(s => (
                            <div key={s.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                                <div className="flex items-center gap-6">
                                    <img src={s.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.fullName)}`} alt={s.fullName} className="w-16 h-16 rounded-2xl object-cover shadow-inner border-2 border-white" />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-slate-800 text-lg leading-tight truncate" title={s.fullName}>
                                            {s.fullName}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-bold mb-2 truncate">{s.email}</p>
                                        
                                        {/* HUY HIỆU NGUỒN GỐC TÀI KHOẢN */}
                                        <div className="mb-2">
                                            {(s as any).created_by ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100">
                                                    <i className="fas fa-chalkboard-teacher"></i> GV: {(s as any).created_by}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                                                    <i className="fas fa-globe"></i> Tự đăng ký
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-white uppercase bg-blue-500 px-2 py-0.5 rounded shadow-sm">
                                                {s.className}
                                            </span>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${(s.status === 'approved' || s.status === 'active') ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {(s.status === 'approved' || s.status === 'active') ? 'Đã duyệt' : 'Chờ duyệt'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {/* View only indicator */}
                                <div className="absolute top-4 right-4 text-slate-200">
                                    <i className="fas fa-id-badge"></i>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* MODAL TẠO HỌC VIÊN CHO GIÁO VIÊN */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleCreateStudent} className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative animate-fade-in-up">
                        <button type="button" onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 text-xl" aria-label="Đóng"><i className="fas fa-times"></i></button>
                        
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3"><i className="fas fa-user-graduate text-2xl"></i></div>
                            <h2 className="text-2xl font-black text-[#14452F]">Cấp Tài Khoản Mới</h2>
                            <p className="text-sm text-slate-500 mt-1">Học viên này sẽ được tự động đưa vào lớp và không cần chờ Admin phê duyệt.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Họ và Tên</label>
                                <input required type="text" value={newStudent.fullName} onChange={e => setNewStudent({...newStudent, fullName: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-lg outline-none focus:border-[#14452F]" placeholder="Nguyễn Văn A" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên Đăng Nhập (Email)</label>
                                <input required type="email" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-lg outline-none focus:border-[#14452F]" placeholder="student1@dhsystem.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu (Tối thiểu 8 ký tự)</label>
                                <input required type="password" minLength={8} value={newStudent.password} onChange={e => setNewStudent({...newStudent, password: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-lg outline-none focus:border-[#14452F]" placeholder="********" />
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy Bỏ</button>
                            <button type="submit" disabled={isCreating} className="flex-[2] py-3 bg-[#14452F] text-white font-black uppercase tracking-widest rounded-xl hover:bg-[#0f3523] shadow-lg disabled:opacity-70 transition-colors">
                                {isCreating ? <i className="fas fa-spinner fa-spin"></i> : "Tạo & Cấp Quyền"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default TeacherStudents;