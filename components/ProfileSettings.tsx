
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ProfileSettingsProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onNotify }) => {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;
      
      await refreshProfile();
      onNotify("Cập nhật thông tin thành công.", "success");
    } catch (err: any) {
      onNotify(err.message || "Lỗi cập nhật hồ sơ.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user) return;
    
    setLoading(true);
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Math.random().toString(36).substring(2)}.${fileExt}`;

    try {
        // Upload to 'avatars' bucket
        // Lưu ý: Cần tạo bucket 'avatars' trong Supabase và set Policy public/authen
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Update profile
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (updateError) throw updateError;

        setAvatarUrl(publicUrl);
        await refreshProfile();
        onNotify("Đã cập nhật ảnh đại diện.", "success");
    } catch (err: any) {
        onNotify(`Lỗi tải ảnh: ${err.message} (Hãy kiểm tra bucket 'avatars').`, "error");
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const handleChangePassword = async () => {
      if (password !== confirmPassword) {
          onNotify("Mật khẩu xác nhận không khớp.", "warning");
          return;
      }
      if (password.length < 6) {
          onNotify("Mật khẩu phải có ít nhất 6 ký tự.", "warning");
          return;
      }

      setLoading(true);
      try {
          const { error } = await supabase.auth.updateUser({ password: password });
          if (error) throw error;
          
          onNotify("Đổi mật khẩu thành công.", "success");
          setPassword('');
          setConfirmPassword('');
      } catch (err: any) {
          onNotify(err.message, "error");
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
          {/* Left Column: Avatar & Basic Info */}
          <div className="bg-white p-8 chamfer-lg border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-6">
             <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-40 h-40 bg-slate-100 chamfer-xl border-4 border-white shadow-xl overflow-hidden flex items-center justify-center relative">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-5xl font-black text-slate-300">{user?.fullName?.charAt(0)}</span>
                    )}
                    {loading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                            <i className="fas fa-circle-notch fa-spin"></i>
                        </div>
                    )}
                </div>
                <div className="absolute inset-0 bg-black/40 chamfer-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <i className="fas fa-camera text-white text-3xl"></i>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleAvatarChange} 
                    accept="image/*" 
                    className="hidden" 
                />
             </div>
             
             <div>
                 <h2 className="text-xl font-black text-slate-900 uppercase">{user?.fullName}</h2>
                 <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{user?.role}</p>
                 <div className="mt-4 inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 chamfer-sm text-[10px] font-black uppercase tracking-wider border border-green-100">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Active Account
                 </div>
             </div>
          </div>

          {/* Right Column: Edit Forms */}
          <div className="md:col-span-2 space-y-8">
             {/* General Information */}
             <section className="bg-white p-8 chamfer-lg border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#14452F]/5 chamfer-diag -mr-8 -mt-8"></div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                    <i className="fas fa-user-pen text-[#14452F]"></i> Thông tin cơ bản
                </h3>
                
                <div className="space-y-5 relative z-10">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email định danh (Read-only)</label>
                        <input 
                            type="text" 
                            value={user?.email || ''} 
                            disabled 
                            className="w-full p-4 bg-slate-50 border border-slate-200 chamfer-sm font-bold text-slate-500 cursor-not-allowed"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Họ và tên hiển thị</label>
                        <input 
                            type="text" 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)} 
                            className="w-full p-4 bg-white border-2 border-slate-200 chamfer-sm font-bold text-slate-800 outline-none focus:border-[#14452F] transition-all"
                        />
                    </div>
                    <div className="pt-2 flex justify-end">
                        <button 
                            onClick={handleUpdateProfile}
                            disabled={loading}
                            className="bg-[#14452F] text-white px-8 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#0F3624] transition-all disabled:opacity-50"
                        >
                            {loading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Lưu thay đổi'}
                        </button>
                    </div>
                </div>
             </section>

             {/* Security */}
             <section className="bg-white p-8 chamfer-lg border border-slate-200 shadow-sm relative overflow-hidden">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                    <i className="fas fa-shield-halved text-[#14452F]"></i> Bảo mật
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mật khẩu mới</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder="••••••"
                            className="w-full p-4 bg-white border-2 border-slate-200 chamfer-sm font-bold text-slate-800 outline-none focus:border-[#14452F] transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Xác nhận mật khẩu</label>
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            placeholder="••••••"
                            className="w-full p-4 bg-white border-2 border-slate-200 chamfer-sm font-bold text-slate-800 outline-none focus:border-[#14452F] transition-all"
                        />
                    </div>
                </div>
                <div className="pt-6 flex justify-end">
                    <button 
                        onClick={handleChangePassword}
                        disabled={loading || !password}
                        className="bg-red-50 text-red-600 border border-red-100 px-8 py-3 chamfer-sm font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                    >
                        Đổi mật khẩu
                    </button>
                </div>
             </section>
          </div>
       </div>
    </div>
  );
};

export default ProfileSettings;
