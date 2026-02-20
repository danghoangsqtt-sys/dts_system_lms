import React, { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { databases, APPWRITE_CONFIG, Query } from '../../lib/appwrite';

export default function StudentApproval() {
    const [students, setStudents] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Tách biệt 2 trạng thái để Admin dễ kiểm soát
    const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED'>('PENDING');

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
            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: 'approved', classId: classId } : s));
            alert("Đã phê duyệt thành công!");
        } catch (error) {
            alert("Lỗi khi phê duyệt!");
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
                            <th className="p-4 font-bold text-slate-600 text-sm w-64">Phân Lớp</th>
                            <th className="p-4 font-bold text-slate-600 text-sm text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayList.length === 0 ? (
                            <tr><td colSpan={4} className="p-10 text-center text-slate-500 font-medium bg-slate-50/50">Không có học viên nào trong danh mục này.</td></tr>
                        ) : (
                            displayList.map(student => (
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
                                        <select 
                                            title="Chọn lớp học"
                                            value={student.classId || ''} 
                                            onChange={(e) => {
                                                setStudents(prev => prev.map(s => s.id === student.id ? { ...s, classId: e.target.value } : s));
                                            }}
                                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#14452F] text-sm font-bold shadow-sm"
                                            disabled={student.status === 'approved'}
                                        >
                                            <option value="">-- Chọn lớp học --</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
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
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}