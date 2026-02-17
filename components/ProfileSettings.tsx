import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { databases, APPWRITE_CONFIG } from '../lib/appwrite';

interface ProfileSettingsProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onNotify }) => {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  
  // Không dùng state avatarUrl để upload nữa, chỉ hiển thị
  const [displayAvatar, setDisplayAvatar] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setDisplayAvatar(user.avatarUrl || '');
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Tự động cập nhật lại link avatar theo tên mới
      const newAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff`;
      
      await databases.updateDocument(
        APPWRITE_CONFIG.dbId,
        APPWRITE_CONFIG.collections.profiles,
        user.id,
        { 
            full_name: fullName,
            avatar_url: newAvatarUrl
        }
      );
      
      await refreshProfile();
      onNotify("Cập nhật thông tin thành công.", "success");
    } catch (err: any) {
      onNotify(err.message || "Lỗi cập nhật hồ sơ.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in space-y-8 font-[Roboto] pb-24">
       <header className="flex items-center gap-4 border-b border-slate-200 pb-6">
          <div className="w-16 h-16 bg-[#14452F] text-white chamfer-sm flex items-center justify-center text-3xl shadow-lg">
             <i className="fas fa-id-card"></i>
          </div>
          <div>
             <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Hồ sơ cá nhân</h1>
             <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Quản lý định danh & bảo mật</p>
          </div>
       </header>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 chamfer-lg border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-6">
             <div className="relative group">
                <div className="w-40 h-40 bg-slate-100 chamfer-xl border-4 border-white shadow-xl overflow-hidden flex items-center justify-center relative">
                    {displayAvatar ? (
                        <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-5xl font-black text-slate-300">{fullName?.charAt(0)}</span>
                    )}
                </div>
                {/* Ẩn chức năng upload, hiển thị thông báo tooltip */}
                <div className="mt-4 text-[10px] text-slate-400 italic">
                    * Ảnh đại diện được tạo tự động theo tên của bạn.
                </div>
             </div>
             
             <div>
                 <h2 className="text-xl font-black text-slate-900 uppercase">{user?.fullName}</h2>
                 <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{user?.role}</p>
                 <div className="mt-4 inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 chamfer-sm text-[10px] font-black uppercase tracking-wider border border-green-100">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Active Account
                 </div>
             </div>
          </div>

          <div className="md:col-span-2 space-y-8">
             <section className="bg-white p-8 chamfer-lg border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#14452F]/5 chamfer-diag -mr-8 -mt-8"></div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                    <i className="fas fa-user-pen text-[#14452F]"></i> Thông tin cơ bản
                </h3>
                
                <div className="space-y-5 relative z-10">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email định danh</label>
                        <input type="text" value={user?.email || ''} disabled className="w-full p-4 bg-slate-50 border border-slate-200 chamfer-sm font-bold text-slate-500 cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Họ và tên hiển thị</label>
                        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full p-4 bg-white border-2 border-slate-200 chamfer-sm font-bold text-slate-800 outline-none focus:border-[#14452F] transition-all" />
                    </div>
                    <div className="pt-2 flex justify-end">
                        <button onClick={handleUpdateProfile} disabled={loading} className="bg-[#14452F] text-white px-8 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all disabled:opacity-50">
                            {loading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Lưu thay đổi'}
                        </button>
                    </div>
                </div>
             </section>
          </div>
       </div>
    </div>
  );
};

export default ProfileSettings;