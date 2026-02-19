import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { databases, APPWRITE_CONFIG, Query } from '../../lib/appwrite';
import { UserProfile } from '../../types';
import { createAuthUserAsAdmin } from '../../services/databaseService';

interface StudentWithClass extends UserProfile {
  className?: string;
}

interface StudentApprovalProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const StudentApproval: React.FC<StudentApprovalProps> = ({ onNotify }) => {
  const [students, setStudents] = useState<StudentWithClass[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Student Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState(''); // NEW Field
  const [selectedClassId, setSelectedClassId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [classList, setClassList] = useState<any[]>([]);

  const fetchPendingStudents = async () => {
    setLoading(true);
    try {
      const response = await databases.listDocuments(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        [
            Query.equal('role', 'student'),
            Query.equal('status', 'pending')
        ]
      );

      // Fetch class names
      const classIds = response.documents.map((d: any) => d.class_id).filter(Boolean);
      const classMap = new Map();
      if (classIds.length > 0) {
          const classRes = await databases.listDocuments(
              APPWRITE_CONFIG.dbId,
              APPWRITE_CONFIG.collections.classes,
              [Query.equal('$id', classIds)]
          );
          classRes.documents.forEach(c => classMap.set(c.$id, c.name));
      }

      setStudents(response.documents.map((s: any) => ({
        id: s.$id,
        fullName: s.full_name,
        role: s.role,
        status: s.status,
        classId: s.class_id,
        avatarUrl: s.avatar_url,
        updatedAt: s.$updatedAt ? new Date(s.$updatedAt).getTime() : undefined,
        className: classMap.get(s.class_id) || 'Chưa gán lớp',
        email: s.email || '' 
      })));
    } catch (err: any) {
      console.error(err);
      onNotify('Lỗi tải danh sách học viên', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllClasses = async () => {
      try {
          const response = await databases.listDocuments(
              APPWRITE_CONFIG.dbId,
              APPWRITE_CONFIG.collections.classes,
              [Query.orderDesc('$createdAt'), Query.limit(100)]
          );
          setClassList(response.documents.map((d: any) => ({ id: d.$id, name: d.name })));
      } catch (e) {
          console.error("Error fetching classes", e);
      }
  };

  useEffect(() => {
    fetchPendingStudents();
    fetchAllClasses();
  }, []);

  const approveStudent = async (id: string) => {
    try {
      await databases.updateDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        id,
        { status: 'active' }
      );
      
      onNotify("Đã phê duyệt quyền truy cập.", "success");
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  const handleAddStudent = async () => {
      if (!newStudentName.trim() || !newStudentEmail.trim() || !newStudentPassword.trim()) {
          onNotify("Vui lòng nhập tên, email và mật khẩu.", "warning");
          return;
      }
      
      if (newStudentPassword.length < 8) {
          onNotify("Mật khẩu phải có ít nhất 8 ký tự.", "warning");
          return;
      }

      setIsCreating(true);
      try {
          // 1. Tạo User Identity ở Server Side
          const authUser = await createAuthUserAsAdmin(newStudentEmail, newStudentPassword, newStudentName);
          
          // 2. Tạo Profile Document với ID trùng với Auth User ID
          await databases.createDocument(
              APPWRITE_CONFIG.dbId,
              APPWRITE_CONFIG.collections.profiles,
              authUser.$id, // Use the real Auth ID
              {
                  full_name: newStudentName,
                  email: newStudentEmail,
                  role: 'student',
                  status: 'active', // Auto-activate
                  class_id: selectedClassId || null,
                  avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(newStudentName)}&background=random&color=fff`
              }
          );

          onNotify("Đã tạo tài khoản & hồ sơ học viên thành công.", "success");
          setShowAddModal(false);
          setNewStudentName('');
          setNewStudentEmail('');
          setNewStudentPassword('');
          setSelectedClassId('');
          fetchPendingStudents();
      } catch (err: any) {
          onNotify(err.message, 'error');
      } finally {
          setIsCreating(false);
      }
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <i className="fas fa-user-clock text-[#14452F]"></i> Yêu cầu truy cập
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-8">Danh sách học viên chờ duyệt vào lớp</p>
        </div>
        <div className="flex gap-3">
            <button onClick={() => setShowAddModal(true)} className="bg-[#14452F] text-white px-6 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#0F3624] transition-all flex items-center gap-2 shadow-lg"><i className="fas fa-user-plus"></i> Thêm Học viên mới</button>
            <button onClick={fetchPendingStudents} className="bg-slate-100 text-slate-500 px-6 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"><i className="fas fa-sync-alt"></i> Tải lại</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center"><i className="fas fa-circle-notch fa-spin text-3xl text-[#14452F]"></i></div>
        ) : students.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 gap-4 border-2 border-dashed border-slate-200 chamfer-lg"><i className="fas fa-check-double text-4xl opacity-50"></i><p className="font-black uppercase tracking-widest text-xs">Không có yêu cầu nào đang chờ</p></div>
        ) : (
          students.map(s => (
            <div key={s.id} className="bg-white border-l-4 border-orange-400 p-6 chamfer-md shadow-sm hover:shadow-lg transition-all relative group">
              <div className="flex justify-between items-start mb-4">
                 <div className="w-12 h-12 bg-slate-100 chamfer-sm flex items-center justify-center text-slate-500 font-black uppercase text-lg border border-slate-200">{s.fullName.charAt(0)}</div>
                 <span className="text-[8px] font-black uppercase bg-orange-100 text-orange-600 px-2 py-1 chamfer-sm animate-pulse">Pending</span>
              </div>
              <div className="mb-6">
                 <h4 className="font-black text-slate-800 text-lg uppercase truncate">{s.fullName}</h4>
                 <p className="text-[10px] text-slate-500 mb-1">{s.email}</p>
                 <div className="flex items-center gap-2 mt-2"><i className="fas fa-layer-group text-slate-400 text-xs"></i><span className="text-xs font-bold text-slate-500 uppercase">{s.className}</span></div>
              </div>
              <button onClick={() => approveStudent(s.id)} className="w-full py-3 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#0F3624] transition-all flex items-center justify-center gap-2 shadow-lg"><i className="fas fa-check"></i> Chấp thuận</button>
            </div>
          ))
        )}
      </div>

      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md chamfer-lg p-8 shadow-2xl animate-slide-up border-t-4 border-[#14452F]">
            <div className="mb-8"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thêm Học viên Trực tiếp</h3></div>
            <div className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Họ và Tên</label>
                <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" autoFocus placeholder="Ví dụ: Trần Văn B" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Email Đăng nhập</label>
                <input type="email" value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" placeholder="student@domain.edu.vn" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Mật khẩu Khởi tạo</label>
                <input type="password" value={newStudentPassword} onChange={e => setNewStudentPassword(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" placeholder="Tối thiểu 8 ký tự" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Lớp học</label>
                <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all">
                    <option value="">-- Chọn lớp (Tùy chọn) --</option>
                    {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy</button>
                <button onClick={handleAddStudent} disabled={isCreating} className="flex-1 py-3 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all disabled:opacity-70">{isCreating ? 'Đang tạo...' : 'Tạo & Duyệt ngay'}</button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default StudentApproval;