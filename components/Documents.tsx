

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentFile, VectorChunk } from '../types';
import { extractDataFromPDF, chunkText, embedChunks } from '../services/documentProcessor';
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const isElectron = navigator.userAgent.toLowerCase().includes(' electron/');
const ipcRenderer = isElectron ? (window as any).require('electron').ipcRenderer : null;

interface DocumentsProps {
  onUpdateKnowledgeBase: (chunks: VectorChunk[]) => void;
  onDeleteDocumentData: (docId: string) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const PdfViewer: React.FC<{ url: string; isFullScreen: boolean; onToggleFullScreen: () => void }> = ({ url, isFullScreen, onToggleFullScreen }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pdf, setPdf] = useState<any>(null);
    const [pageNum, setPageNum] = useState(1);
    const [total, setTotal] = useState(0);
    const [scale, setScale] = useState(1.2); // Tăng tỷ lệ mặc định cho rõ nét
    const [loading, setLoading] = useState(true);

    // Tải tài liệu PDF
    useEffect(() => {
        setLoading(true);
        const loadingTask = pdfjsLib.getDocument(url);
        loadingTask.promise.then((pdfDoc: any) => {
            setPdf(pdfDoc);
            setTotal(pdfDoc.numPages);
            setPageNum(1); // Luôn bắt đầu từ trang 1 khi mở tệp mới
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [url]);

    // Vẽ trang PDF lên màn hình
    useEffect(() => {
        if (!pdf || !canvasRef.current) return;
        
        pdf.getPage(pageNum).then((page: any) => {
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current!;
            const context = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            page.render(renderContext);
        });
    }, [pdf, pageNum, scale]);

    return (
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative group">
            {/* Thanh công cụ (Toolbar) chuyên nghiệp */}
            <div className="bg-slate-800/90 backdrop-blur-md p-3 border-b border-slate-700 flex items-center justify-between z-10 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-700 rounded-lg p-1 shadow-inner">
                        <button onClick={() => setPageNum(Math.max(1, pageNum - 1))} className="w-8 h-8 rounded-md hover:bg-slate-600 text-white transition flex items-center justify-center">
                            <i className="fas fa-chevron-left text-xs"></i>
                        </button>
                        <div className="px-4 flex items-center gap-2 text-xs font-black text-white border-x border-slate-600">
                            <span>TRANG</span>
                            <span className="bg-blue-600 px-2 py-0.5 rounded text-[10px]">{pageNum}</span>
                            <span className="text-slate-400">/ {total}</span>
                        </div>
                        <button onClick={() => setPageNum(Math.min(total, pageNum + 1))} className="w-8 h-8 rounded-md hover:bg-slate-600 text-white transition flex items-center justify-center">
                            <i className="fas fa-chevron-right text-xs"></i>
                        </button>
                    </div>

                    <div className="flex bg-slate-700 rounded-lg p-1">
                        <button onClick={() => setScale(Math.max(0.5, scale - 0.2))} className="w-8 h-8 text-white hover:bg-slate-600 rounded-md transition" title="Thu nhỏ">
                            <i className="fas fa-search-minus text-xs"></i>
                        </button>
                        <button onClick={() => setScale(1.2)} className="px-3 text-[10px] font-bold text-slate-300 hover:text-white transition" title="Reset zoom">
                            {Math.round(scale * 100)}%
                        </button>
                        <button onClick={() => setScale(Math.min(3, scale + 0.2))} className="w-8 h-8 text-white hover:bg-slate-600 rounded-md transition" title="Phóng to">
                            <i className="fas fa-search-plus text-xs"></i>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={onToggleFullScreen} className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center justify-center">
                        <i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i>
                    </button>
                </div>
            </div>

            {/* Vùng hiển thị tài liệu */}
            <div className="flex-1 overflow-auto p-8 flex justify-center custom-scrollbar bg-slate-900">
                {loading ? (
                    <div className="flex flex-col items-center justify-center text-blue-400 gap-4">
                        <i className="fas fa-circle-notch fa-spin text-4xl"></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">Đang tải tài liệu...</span>
                    </div>
                ) : (
                    <div className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-white rounded-sm mb-10 border border-slate-700">
                        <canvas ref={canvasRef} className="max-w-full h-auto" />
                    </div>
                )}
            </div>

            {/* Chỉ báo cuộn hoặc phím tắt */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-blue-600/90 text-[10px] font-black text-white px-4 py-2 rounded-full backdrop-blur-md shadow-2xl border border-blue-400/30">
                    SỬ DỤNG PHÍM MŨI TÊN ĐỂ CHUYỂN TRANG
                </div>
            </div>
        </div>
    );
};

const Documents: React.FC<DocumentsProps> = ({ onUpdateKnowledgeBase, onDeleteDocumentData, onNotify }) => {
  const [docs, setDocs] = useState<DocumentFile[]>(() => {
      const saved = localStorage.getItem('elearning_docs');
      return saved ? JSON.parse(saved) : [];
  });
  const [selectedDoc, setSelectedDoc] = useState<DocumentFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => { localStorage.setItem('elearning_docs', JSON.stringify(docs)); }, [docs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return onNotify("Vui lòng tải tệp PDF.", "error");

    const newDocId = Date.now().toString();
    setIsProcessing(true);
    setProcessingDocId(newDocId);
    setProgress(5);

    try {
        let persistentUrl = URL.createObjectURL(file);
        const { text, metadata } = await extractDataFromPDF(file);
        
        const newDoc: DocumentFile = {
            id: newDocId, name: file.name, type: 'PDF', url: persistentUrl,
            uploadDate: new Date().toLocaleDateString('vi-VN'), isProcessed: false, metadata: metadata
        };
        
        setDocs(prev => [newDoc, ...prev]);
        setSelectedDoc(newDoc);
        
        const chunks = chunkText(text);
        const vectorChunks = await embedChunks(newDocId, chunks, (p) => setProgress(20 + Math.round(p * 0.8)));

        onUpdateKnowledgeBase(vectorChunks);
        setDocs(prev => prev.map(d => d.id === newDocId ? { ...d, isProcessed: true } : d));
        onNotify("Đã lưu và nạp tri thức RAG thành công!", "success");
    } catch (error: any) {
        onNotify(`Lỗi: ${error.message}`, "error");
    } finally {
        setIsProcessing(false);
        setProcessingDocId(null);
        setProgress(0);
    }
  };

  const deleteDoc = (doc: DocumentFile) => {
      if (!window.confirm(`Xóa tài liệu "${doc.name}"?`)) return;
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      onDeleteDocumentData(doc.id);
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
  };

  return (
    <div className="h-full flex flex-col p-8 bg-gray-50/30">
      <div className="flex justify-between items-center mb-8 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
         <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Thư viện Tri thức RAG</h2>
            <p className="text-sm text-gray-500 font-medium italic">Tài liệu PDF được AI phân tích và lưu trữ vector</p>
         </div>
         <label className={`cursor-pointer bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all hover:bg-blue-700 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
            {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-upload"></i>}
            {isProcessing ? "ĐANG HỌC..." : "TẢI GIÁO TRÌNH"}
            <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
         </label>
      </div>

      <div className="flex-1 flex gap-8 min-h-0">
        <div className="w-80 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col overflow-hidden shrink-0">
            <div className="p-6 border-b border-slate-50 bg-gray-50/50 flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Giáo trình ({docs.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {docs.map(doc => (
                    <div key={doc.id} onClick={() => setSelectedDoc(doc)} className={`p-4 rounded-[1.5rem] border-2 cursor-pointer transition-all relative group ${selectedDoc?.id === doc.id ? 'bg-blue-50 border-blue-500/20' : 'bg-white border-transparent'}`}>
                        <button onClick={(e) => {e.stopPropagation(); deleteDoc(doc)}} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1"><i className="fas fa-trash-alt text-[10px]"></i></button>
                        <div className="flex gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${doc.isProcessed ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-500'}`}>
                                <i className={`fas ${doc.id === processingDocId ? 'fa-circle-notch fa-spin' : 'fa-file-pdf'} text-lg`}></i>
                            </div>
                            <div className="overflow-hidden">
                                <p className={`font-black text-sm truncate`}>{doc.name}</p>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${doc.isProcessed ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    {doc.isProcessed ? 'Đã học' : doc.id === processingDocId ? `Học ${progress}%` : 'Đang chờ'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <div className="flex-1 bg-[#111827] rounded-[3rem] border border-gray-800 overflow-hidden flex flex-col relative">
            {selectedDoc ? <PdfViewer url={selectedDoc.url} isFullScreen={isFullScreen} onToggleFullScreen={() => setIsFullScreen(!isFullScreen)} /> : <div className="flex-1 flex items-center justify-center text-gray-500">Chọn tài liệu để xem</div>}
        </div>
      </div>
    </div>
  );
};

export default Documents;
