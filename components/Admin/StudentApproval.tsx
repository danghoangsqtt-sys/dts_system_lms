import React, { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { databases, APPWRITE_CONFIG, Query } from '../../lib/appwrite';

export default function StudentApproval() {
    const [students, setStudents] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Tách biệt 2 trạng thái để Admin dễ kiểm soát
    const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED'>('PENDING');

    // Track pending class changes for approved students (studentId -> newClassId)
    const [pendingClassChanges, setPendingClassChanges] = useState<Record<string, string>>({});
    const [changingClassIds, setChangingClassIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const cls = await databaseService.fetchClasses();
            setClasses(cls || []);

            // Gọi trực tiếp Appwrite để đảm bảo lấy đủ 100% các cột (đặc biệt là created_by)
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.dbId, 
                APPWRITE_CONFIG.collections.profiles, 
                [Query.equal('role', 'student'), Query.orderDesc('$createdAt'), Query.limit(500)]
            );
            
            const mappedStudents = response.documents.map(doc => ({
                id: doc.$id,
                fullName: doc.full_name,
                email: doc.email,
                status: doc.status,
                classId: doc.class_id,
                originalClassId: doc.class_id, // Lưu lớp gốc để so sánh khi thay đổi
                avatarUrl: doc.avatar_url,
                created_by: doc.created_by // Bắt buộc lấy trường này để hiển thị Badge
            }));
            
            setStudents(mappedStudents);
        } catch (error) {
            console.error("Lỗi tải dữ liệu:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (studentId: string, classId: string) => {
        if (!classId) return alert("Vui lòng chọn lớp cho học viên trước khi duyệt!");
        try {
            await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, studentId, {
                status: 'approved',
                class_id: classId
            });
            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: 'approved', classId: classId, originalClassId: classId } : s));
            alert("Đã phê duyệt thành công!");
        } catch (error) {
            alert("Lỗi khi phê duyệt!");
        }
    };

    const handleChangeClass = async (studentId: string, newClassId: string) => {
        if (!newClassId) return alert("Vui lòng chọn lớp mới!");
        setChangingClassIds(prev => new Set(prev).add(studentId));
        try {
            await databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.profiles, studentId, {
                class_id: newClassId
            });
            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, classId: newClassId, originalClassId: newClassId } : s));
            setPendingClassChanges(prev => { const copy = {...prev}; delete copy[studentId]; return copy; });
            alert("Đã chuyển lớp thành công!");
        } catch (error) {
            alert("Lỗi khi chuyển lớp!");
        } finally {
            setChangingClassIds(prev => { const copy = new Set(prev); copy.delete(studentId); return copy; });
        }
    };

    const handleDelete = async (studentId: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa tài khoản này?")) return;
        try {
            await databaseService.deleteUserProfileAndAuth(studentId);
            setStudents(prev => prev.filter(s => s.id !== studentId));
        } catch (error) {
            alert("Lỗi khi xóa!");
        }
    };

    const getClassName = (classId: string | null) => {
        if (!classId) return null;
        const cls = classes.find(c => c.id === classId);
        return cls ? cls.name : null;
    };

    const pendingStudents = students.filter(s => s.status === 'pending');
    const approvedStudents = students.filter(s => s.status === 'approved');
    const displayList = activeTab === 'PENDING' ? pendingStudents : approvedStudents;

    if (loading) return <div className="p-10 text-center"><i className="fas fa-spinner fa-spin text-3xl text-[#14452F]"></i></div>;

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="mb-8">
                <h1 className="text-2xl font-black text-[#14452F] uppercase mb-1">Kiểm duyệt Học viên</h1>
                <p className="text-slate-500 text-sm">Quản lý, phân lớp và theo dõi nguồn gốc tài khoản đăng ký.</p>
            </div>

            {/* THANH ĐIỀU HƯỚNG TABS */}
            <div className="flex gap-4 mb-6 border-b border-slate-200 pb-4">
                <button 
                    onClick={() => setActiveTab('PENDING')}
                    className={`px-6 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${activeTab === 'PENDING' ? 'bg-orange-100 text-orange-700 shadow-sm border border-orange-200' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}
                >
                    <i className="fas fa-user-clock"></i> Chờ phê duyệt ({pendingStudents.length})
                </button>
                <button 
                    onClick={() => setActiveTab('APPROVED')}
                    className={`px-6 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${activeTab === 'APPROVED' ? 'bg-green-100 text-green-700 shadow-sm border border-green-200' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}
                >
                    <i className="fas fa-user-check"></i> Đã phê duyệt ({approvedStudents.length})
                </button>
            </div>

            {/* BẢNG DANH SÁCH */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 font-bold text-slate-600 text-sm">Thông tin Học viên</th>
                            <th className="p-4 font-bold text-slate-600 text-sm text-center">Trạng thái</th>
                            <th className="p-4 font-bold text-slate-600 text-sm w-72">Phân Lớp</th>
                            <th className="p-4 font-bold text-slate-600 text-sm text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayList.length === 0 ? (
                            <tr><td colSpan={4} className="p-10 text-center text-slate-500 font-medium bg-slate-50/50">Không có học viên nào trong danh mục này.</td></tr>
                        ) : (
                            displayList.map(student => {
                                const isApproved = student.status === 'approved';
                                const currentClassName = getClassName(student.originalClassId);
                                const selectedClassId = pendingClassChanges[student.id] ?? student.classId;
                                const hasClassChanged = isApproved && selectedClassId !== student.originalClassId;
                                const isChanging = changingClassIds.has(student.id);

                                return (
                                <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-4">
                                            <img src={student.avatarUrl} alt="avatar" className="w-12 h-12 rounded-full border border-slate-200 shadow-sm" />
                                            <div>
                                                <div className="font-bold text-slate-800 text-base">{student.fullName}</div>
                                                <div className="text-xs text-slate-500 font-medium mb-1.5">{student.email}</div>
                                                
                                                {/* HUY HIỆU NGUỒN GỐC TÀI KHOẢN */}
                                                <div>
                                                    {student.created_by ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100 shadow-sm" title={`Được cấp bởi: ${student.created_by}`}>
                                                            <i className="fas fa-chalkboard-teacher"></i> GV: {student.created_by}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200 shadow-sm">
                                                            <i className="fas fa-globe"></i> Tự đăng ký
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center align-middle">
                                        {student.status === 'pending' ? (
                                            <span className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-xs font-black uppercase tracking-widest border border-orange-200">Chờ Duyệt</span>
                                        ) : (
                                            <span className="px-3 py-1.5 bg-green-100 text-green-600 rounded-lg text-xs font-black uppercase tracking-widest border border-green-200">Đã Duyệt</span>
                                        )}
                                    </td>
                                    <td className="p-4 align-middle">
                                        <div className="space-y-2">
                                            {/* Hiển thị tên lớp hiện tại cho học viên đã duyệt */}
                                            {isApproved && currentClassName && (
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-[#14452F] uppercase tracking-widest">
                                                    <i className="fas fa-school text-xs"></i> Lớp hiện tại: {currentClassName}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <select 
                                                    title="Chọn lớp học"
                                                    value={selectedClassId || ''} 
                                                    onChange={(e) => {
                                                        if (isApproved) {
                                                            // Approved: track pending change, don't commit yet
                                                            setPendingClassChanges(prev => ({...prev, [student.id]: e.target.value}));
                                                        } else {
                                                            // Pending: update local state immediately (commit on approve)
                                                            setStudents(prev => prev.map(s => s.id === student.id ? { ...s, classId: e.target.value } : s));
                                                        }
                                                    }}
                                                    className={`flex-1 p-2.5 bg-white border rounded-lg outline-none focus:border-[#14452F] text-sm font-bold shadow-sm transition-all ${hasClassChanged ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}
                                                >
                                                    <option value="">-- Chọn lớp học --</option>
                                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                                {/* Nút xác nhận chuyển lớp - chỉ hiện khi admin chọn lớp khác */}
                                                {hasClassChanged && (
                                                    <div className="flex gap-1 shrink-0 animate-fade-in">
                                                        <button 
                                                            onClick={() => handleChangeClass(student.id, selectedClassId)}
                                                            disabled={isChanging}
                                                            className="w-9 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center disabled:opacity-50" 
                                                            title="Xác nhận chuyển lớp"
                                                        >
                                                            {isChanging ? <i className="fas fa-spinner fa-spin text-xs"></i> : <i className="fas fa-check text-xs"></i>}
                                                        </button>
                                                        <button 
                                                            onClick={() => setPendingClassChanges(prev => { const copy = {...prev}; delete copy[student.id]; return copy; })}
                                                            className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors flex items-center justify-center" 
                                                            title="Hủy thay đổi"
                                                        >
                                                            <i className="fas fa-undo text-xs"></i>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right align-middle">
                                        {student.status === 'pending' && (
                                            <button onClick={() => handleApprove(student.id, student.classId)} className="w-10 h-10 rounded-lg bg-green-50 text-green-600 hover:bg-green-500 hover:text-white transition-colors border border-green-100 mr-2 shadow-sm" title="Phê duyệt vào lớp">
                                                <i className="fas fa-check"></i>
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(student.id)} className="w-10 h-10 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors border border-red-100 shadow-sm" title="Xóa tài khoản">
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            );})
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}