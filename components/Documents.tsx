import React, { useState, useEffect, useRef } from 'react';
import { DocumentFile, VectorChunk } from '../types';
import { extractDataFromPDF, chunkText, embedChunks } from '../services/documentProcessor';
import { databases, APPWRITE_CONFIG, Query } from '../lib/appwrite';
import { useAuth } from '../contexts/AuthContext';
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
    const [scale, setScale] = useState(1.2); 
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const loadingTask = pdfjsLib.getDocument(url);
        loadingTask.promise.then((pdfDoc: any) => {
            setPdf(pdfDoc);
            setTotal(pdfDoc.numPages);
            setPageNum(1); 
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [url]);

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
        <div className={`flex-1 flex flex-col bg-[#0F172A] overflow-hidden relative group chamfer-lg border-2 border-[#14452F] ${isFullScreen ? 'fixed inset-0 z-[9999]' : ''}`}>
            {/* Toolbar overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#14452F]/90 backdrop-blur-md p-2 chamfer-md flex items-center gap-4 z-10 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button onClick={() => setPageNum(Math.max(1, pageNum - 1))} className="w-8 h-8 text-white hover:bg-white/10 chamfer-sm flex items-center justify-center"><i className="fas fa-chevron-left"></i></button>
                <span className="text-white text-xs font-black min-w-[60px] text-center">{pageNum} / {total}</span>
                <button onClick={() => setPageNum(Math.min(total, pageNum + 1))} className="w-8 h-8 text-white hover:bg-white/10 chamfer-sm flex items-center justify-center"><i className="fas fa-chevron-right"></i></button>
                <div className="w-[1px] h-4 bg-white/20"></div>
                <button onClick={() => setScale(Math.max(0.5, scale - 0.2))} className="w-8 h-8 text-white hover:bg-white/10 chamfer-sm"><i className="fas fa-minus"></i></button>
                <button onClick={() => setScale(Math.min(3, scale + 0.2))} className="w-8 h-8 text-white hover:bg-white/10 chamfer-sm"><i className="fas fa-plus"></i></button>
                <div className="w-[1px] h-4 bg-white/20"></div>
                <button onClick={onToggleFullScreen} className="w-8 h-8 text-white hover:bg-white/10 chamfer-sm"><i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i></button>
            </div>

            <div className="flex-1 overflow-auto p-8 flex justify-center custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center text-[#14452F] gap-4">
                        <i className="fas fa-circle-notch fa-spin text-4xl"></i>
                    </div>
                ) : (
                    <div className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-white chamfer-sm">
                        <canvas ref={canvasRef} className="max-w-full h-auto" />
                    </div>
                )}
            </div>
        </div>
    );
};

const Documents: React.FC<DocumentsProps> = ({ onUpdateKnowledgeBase, onDeleteDocumentData, onNotify }) => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocumentFile[]>(() => {
      const saved = localStorage.getItem('elearning_docs');
      return saved ? JSON.parse(saved) : [];
  });
  const [cloudDocs, setCloudDocs] = useState<DocumentFile[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => { localStorage.setItem('elearning_docs', JSON.stringify(docs)); }, [docs]);

  // Fetch Cloud Docs via Appwrite
  useEffect(() => {
    if (user?.role === 'student' && user.classId) {
      const fetchLectures = async () => {
        try {
            const response = await databases.listDocuments(
                APPWRITE_CONFIG.dbId,
                APPWRITE_CONFIG.collections.lectures,
                [Query.equal('shared_with_class_id', user.classId)]
            );
            if (response.documents) {
                setCloudDocs(response.documents.map((l: any) => ({
                    id: `cloud_${l.$id}`, 
                    name: l.title, 
                    type: 'PDF', 
                    url: l.file_url,
                    uploadDate: new Date(l.$createdAt).toLocaleDateString('vi-VN'),
                    isProcessed: true, 
                    metadata: { title: l.title }
                })));
            }
        } catch (error) {
            console.error("Failed to fetch lectures:", error);
        }
      };
      fetchLectures();
    }
  }, [user]);

  const allDocs = [...cloudDocs, ...docs];

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
      if (doc.id.startsWith('cloud_')) return; 
      if (!window.confirm(`Xóa tài liệu "${doc.name}"?`)) return;
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      onDeleteDocumentData(doc.id);
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6 bg-slate-50 font-[Roboto]">
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-6">
        
        {/* LEFT: Viewer (70%) */}
        <div className="flex-1 flex flex-col min-h-[500px]">
            {selectedDoc ? (
                <PdfViewer url={selectedDoc.url} isFullScreen={isFullScreen} onToggleFullScreen={() => setIsFullScreen(!isFullScreen)} />
            ) : (
                <div className="flex-1 chamfer-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-slate-100">
                    <i className="fas fa-book-open text-6xl mb-4 text-[#14452F]/20"></i>
                    <p className="font-bold uppercase tracking-widest text-sm">Chọn tài liệu bên phải để xem</p>
                </div>
            )}
        </div>

        {/* RIGHT: Document List (30%) */}
        <div className="w-full lg:w-96 flex flex-col gap-6">
            
            {/* Header Area for List */}
            <div className="flex items-center justify-between bg-white p-5 chamfer-md border border-slate-200 shadow-sm">
                <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Kệ sách số</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tri thức RAG ({allDocs.length})</p>
                </div>
                <label className={`w-10 h-10 bg-[#14452F] text-white chamfer-sm flex items-center justify-center cursor-pointer hover:bg-[#0F3624] transition-all shadow-lg ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
                    <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                </label>
            </div>

            {/* List Area */}
            <div className="flex-1 bg-white chamfer-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {allDocs.map(doc => {
                        const isCloud = doc.id.startsWith('cloud_');
                        return (
                            <div key={doc.id} onClick={() => setSelectedDoc(doc)} className={`p-4 chamfer-md border cursor-pointer transition-all group relative ${selectedDoc?.id === doc.id ? 'bg-[#14452F] text-white border-[#14452F]' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-md text-slate-700'}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`mt-1 text-lg ${selectedDoc?.id === doc.id ? 'text-green-400' : 'text-[#14452F]'}`}>
                                        <i className={`fas ${doc.id === processingDocId ? 'fa-circle-notch fa-spin' : isCloud ? 'fa-cloud' : 'fa-file-pdf'}`}></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-xs truncate leading-tight mb-1">{doc.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 chamfer-sm ${selectedDoc?.id === doc.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                {doc.metadata?.author || 'DHsystem'}
                                            </span>
                                            {doc.isProcessed && <i className="fas fa-check-circle text-[10px] text-green-500"></i>}
                                        </div>
                                    </div>
                                    {!isCloud && (
                                        <button onClick={(e) => {e.stopPropagation(); deleteDoc(doc)}} className={`text-xs hover:text-red-500 transition-all px-2 ${selectedDoc?.id === doc.id ? 'text-white/50' : 'text-slate-300'}`}>
                                            <i className="fas fa-trash-alt"></i>
                                        </button>
                                    )}
                                </div>
                                {doc.id === processingDocId && (
                                    <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-400 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Documents;