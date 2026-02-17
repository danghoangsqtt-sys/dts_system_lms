import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { databases, APPWRITE_CONFIG, Query, ID } from '../../lib/appwrite';
import { Class, UserProfile } from '../../types';

interface ClassWithTeacher extends Class {
  teacherName?: string;
  teacherEmail?: string;
}

interface ClassManagerProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const ClassManager: React.FC<ClassManagerProps> = ({ onNotify }) => {
  const [classes, setClasses] = useState<ClassWithTeacher[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  const [newClassName, setNewClassName] = useState('');
  const [assignData, setAssignData] = useState({ classId: '', teacherId: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Classes
      const classRes = await databases.listDocuments(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.classes,
        [Query.orderDesc('$createdAt')]
      );

      // 2. Fetch Teachers
      const teacherRes = await databases.listDocuments(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        [Query.equal('role', 'teacher')]
      );

      const teacherMap = new Map<string, any>(teacherRes.documents.map(t => [t.$id, t]));

      const mappedClasses: ClassWithTeacher[] = classRes.documents.map((c: any) => {
        const teacher = c.teacher_id ? teacherMap.get(c.teacher_id) : null;
        return {
            id: c.$id,
            name: c.name,
            teacherId: c.teacher_id,
            isActive: c.is_active,
            createdAt: new Date(c.$createdAt).getTime(),
            teacherName: teacher ? teacher.full_name : 'Chưa gán',
            teacherEmail: teacher ? teacher.email : ''
        };
      });

      const mappedTeachers: UserProfile[] = teacherRes.documents.map((t: any) => ({
        id: t.$id,
        fullName: t.full_name || 'Unknown',
        email: t.email,
        role: t.role,
        status: 'active'
      }));

      setClasses(mappedClasses);
      setTeachers(mappedTeachers);
    } catch (err: any) {
      console.error(err);
      onNotify(err.message || "Lỗi tải dữ liệu lớp học", 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    try {
      await databases.createDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.classes,
        ID.unique(),
        { 
          name: newClassName,
          is_active: true 
        }
      );
      
      onNotify("Đã tạo lớp học mới.", "success");
      setNewClassName('');
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  const handleAssignTeacher = async () => {
      if (!assignData.classId || !assignData.teacherId) {
          onNotify("Vui lòng chọn đầy đủ Lớp và Giảng viên", "warning");
          return;
      }

      try {
          await databases.updateDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.classes,
            assignData.classId,
            { teacher_id: assignData.teacherId }
          );

          onNotify("Phân công giảng viên thành công!", "success");
          setShowAssignModal(false);
          setAssignData({ classId: '', teacherId: '' });
          fetchData();
      } catch (err: any) {
          onNotify(err.message, "error");
      }
  };

  const toggleClassActive = async (id: string, current: boolean) => {
    try {
      await databases.updateDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.classes,
        id,
        { is_active: !current }
      );
      
      setClasses(prev => prev.map(c => c.id === id ? { ...c, isActive: !current } : c));
      onNotify(`Đã ${!current ? 'kích hoạt' : 'tạm dừng'} lớp học.`, "info");
    } catch (err: any) {
      onNotify(err.message, "error");
    }
  };

  return (
    <div className="p-8 animate-fade-in font-[Roboto]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <i className="fas fa-school text-[#14452F]"></i> Quản lý Lớp học
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-8">Cấu trúc tổ chức đào tạo</p>
        </div>
        <div className="flex gap-3">
            <button onClick={() => setShowAssignModal(true)} className="bg-slate-100 text-slate-600 border border-slate-200 px-6 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"><i className="fas fa-user-tag"></i> Phân công</button>
            <button onClick={() => setShowCreateModal(true)} className="bg-[#14452F] text-white px-6 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all flex items-center gap-2 active:scale-95"><i className="fas fa-plus"></i> Khởi tạo Lớp</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/4">Tên Lớp / Mã</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/3">Giảng viên chủ nhiệm</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/4 text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/6 text-right">Điều khiển</th>
                </tr>
            </thead>
            <tbody className="bg-white">
                {classes.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4"><span className="font-black text-slate-800 text-sm">{c.name}</span></td>
                        <td className="px-6 py-4">
                            {c.teacherId ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-[#E8F5E9] text-[#14452F] chamfer-sm flex items-center justify-center font-bold text-xs">{c.teacherName?.charAt(0)}</div>
                                    <div><p className="text-xs font-bold text-slate-700">{c.teacherName}</p></div>
                                </div>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-300 uppercase italic flex items-center gap-2"><i className="fas fa-exclamation-circle"></i> Chưa phân công</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 chamfer-sm text-[9px] font-black uppercase tracking-widest ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.isActive ? 'Active' : 'Paused'}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <button onClick={() => toggleClassActive(c.id, c.isActive)} className={`w-10 h-10 chamfer-sm inline-flex items-center justify-center transition-all ${c.isActive ? 'bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white' : 'bg-[#14452F] text-white hover:bg-[#0F3624]'}`} title={c.isActive ? "Tạm dừng" : "Kích hoạt"}><i className={`fas ${c.isActive ? 'fa-pause' : 'fa-play'}`}></i></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md chamfer-lg p-8 shadow-2xl animate-slide-up border-t-4 border-[#14452F]">
            <div className="mb-8"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tạo Lớp học mới</h3></div>
            <div className="space-y-5">
              <div className="space-y-1"><label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Tên Lớp</label><input required type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-[#14452F] focus:bg-white font-bold text-sm text-slate-800 transition-all" autoFocus placeholder="K65-DTVT-01" /></div>
              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy</button>
                <button onClick={handleCreateClass} className="flex-1 py-3 bg-[#14452F] text-white chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all">Khởi tạo</button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {showAssignModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md chamfer-lg p-8 shadow-2xl animate-slide-up border-t-4 border-blue-600">
            <div className="mb-8"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Phân công Giảng dạy</h3></div>
            <div className="space-y-5">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">1. Chọn Lớp</label><select value={assignData.classId} onChange={e => setAssignData({...assignData, classId: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-blue-600 focus:bg-white font-bold text-sm text-slate-800 transition-all"><option value="">-- Chọn lớp --</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">2. Chọn Giảng viên</label><select value={assignData.teacherId} onChange={e => setAssignData({...assignData, teacherId: e.target.value})} className="w-full p-3 bg-slate-50 border-2 border-slate-200 chamfer-sm outline-none focus:border-blue-600 focus:bg-white font-bold text-sm text-slate-800 transition-all"><option value="">-- Chọn giảng viên --</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></div>
              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy</button>
                <button onClick={handleAssignTeacher} className="flex-1 py-3 bg-blue-600 text-white chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all">Lưu phân công</button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default ClassManager;