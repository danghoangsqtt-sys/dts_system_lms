
import React, { useState, useEffect } from 'react';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: string;
  link: string;
}

const NewsSection: React.FC = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hàm làm sạch HTML và cắt ngắn văn bản
  const cleanDescription = (html: string): string => {
    const text = html.replace(/<[^>]*>?/gm, ''); // Regex xóa tag HTML
    return text.length > 120 ? text.substring(0, 117) + '...' : text;
  };

  // Hàm định dạng ngày DD/MM/YYYY
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    const fetchNews = async () => {
      setIsLoading(true);
      setError(null);
      
      const vnExpressUrl = `https://api.rss2json.com/v1/api.json?rss_url=https://vnexpress.net/rss/khoa-hoc.rss`;
      const danTriUrl = `https://api.rss2json.com/v1/api.json?rss_url=https://dantri.com.vn/rss/khoa-hoc-cong-nghe.rss`;

      try {
        const [vnRes, dtRes] = await Promise.all([
          fetch(vnExpressUrl).then(res => res.json()),
          fetch(danTriUrl).then(res => res.json())
        ]);

        const vnArticles = (vnRes.items || []).map((item: any) => ({
          id: item.guid || item.link,
          title: item.title,
          summary: cleanDescription(item.description),
          date: item.pubDate,
          source: 'VnExpress',
          link: item.link
        }));

        const dtArticles = (dtRes.items || []).map((item: any) => ({
          id: item.guid || item.link,
          title: item.title,
          summary: cleanDescription(item.description),
          date: item.pubDate,
          source: 'Dân Trí',
          link: item.link
        }));

        // Gộp, sắp xếp theo thời gian và lấy 5 tin mới nhất
        const combined = [...vnArticles, ...dtArticles]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5)
          .map(item => ({
            ...item,
            date: formatDate(item.date)
          }));

        setArticles(combined);
      } catch (err) {
        console.error("[NEWS-FETCH-ERROR]", err);
        setError("Không thể nạp tin tức. Vui lòng kiểm tra kết nối mạng.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, []);

  return (
    <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col min-h-[500px]">
      <div className="flex justify-between items-center mb-10">
        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
          <i className="fas fa-rss text-orange-500"></i> Tin tức Khoa học - Công nghệ
        </h3>
        <button 
          onClick={() => window.open('https://vnexpress.net/khoa-hoc', '_blank')}
          className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 tracking-widest transition"
        >
          Xem thêm <i className="fas fa-external-link-alt ml-1"></i>
        </button>
      </div>

      <div className="space-y-6 flex-1">
        {isLoading ? (
          // Skeleton Loading
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="animate-pulse flex gap-5 p-6 bg-slate-50 rounded-3xl">
              <div className="w-12 h-12 bg-slate-200 rounded-2xl shrink-0"></div>
              <div className="flex-1 space-y-3">
                <div className="h-2 bg-slate-200 rounded w-1/4"></div>
                <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                <div className="h-2 bg-slate-200 rounded w-full"></div>
              </div>
            </div>
          ))
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 opacity-60">
            <i className="fas fa-exclamation-circle text-4xl"></i>
            <p className="text-xs font-black uppercase tracking-widest">{error}</p>
          </div>
        ) : (
          articles.map((item) => (
            <a 
              key={item.id} 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group p-6 rounded-3xl bg-slate-50 border border-transparent hover:border-blue-100 hover:bg-white hover:shadow-xl hover:shadow-blue-500/5 transition-all flex flex-col"
            >
              <div className="flex gap-5">
                <div className={`w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm ${item.source === 'VnExpress' ? 'text-red-800' : 'text-blue-700'}`}>
                  <i className={`fas ${item.source === 'VnExpress' ? 'fa-bolt' : 'fa-microchip'} text-xl transition-transform group-hover:scale-110`}></i>
                </div>
                <div className="space-y-1 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {item.source} • {item.date}
                    </span>
                    <i className="fas fa-arrow-right text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0"></i>
                  </div>
                  <h4 className="font-black text-slate-800 text-sm leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-2">
                    {item.summary}
                  </p>
                </div>
              </div>
            </a>
          ))
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between opacity-40">
        <span className="text-[9px] font-black uppercase tracking-tighter">Powered by VnExpress & Dân Trí RSS</span>
        <div className="flex gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[9px] font-black uppercase">Live Update</span>
        </div>
      </div>
    </div>
  );
};

export default NewsSection;
