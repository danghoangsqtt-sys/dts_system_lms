import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentFile, VectorChunk } from '../types';
import { extractDataFromPDF, chunkText, embedChunks } from '../services/documentProcessor';
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { databases, storage, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { useAuth } from '../contexts/AuthContext';
import { databaseService } from '../services/databaseService';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Extend DocumentFile locally to include fileId for cloud operations
interface CloudDocumentFile extends DocumentFile {
    fileId?: string;
    userId?: string;
    isGlobal?: boolean;
}

// Kiểm tra an toàn sự tồn tại của require (Electron) để tránh lỗi Runtime trên Browser
const ipcRenderer = typeof window !== 'undefined' && window.require 
  ? window.require('electron').ipcRenderer 
  : null;

interface DocumentsProps {
  onUpdateKnowledgeBase: (chunks: VectorChunk[]) => void;
  onDeleteDocumentData: (docId: string) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const PdfViewer: React.FC<{ url: string; isFullScreen: boolean; onToggleFullScreen: () => void }> = ({ url, isFullScreen, onToggleFullScreen }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);
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

        return () => {
            loadingTask.destroy();
        };
    }, [url]);

    useEffect(() => {
        if (!pdf || !canvasRef.current) return;

        // Cancel any in-progress render to avoid "Cannot use the same canvas during multiple render() operations"
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
            renderTaskRef.current = null;
        }
        
        let cancelled = false;

        pdf.getPage(pageNum).then((page: any) => {
            if (cancelled || !canvasRef.current) return;

            const viewport = page.getViewport({ scale: scale });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            context!.clearRect(0, 0, canvas.width, canvas.height);

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            const task = page.render(renderContext);
            renderTaskRef.current = task;

            task.promise.then(() => {
                renderTaskRef.current = null;
            }).catch((err: any) => {
                if (err?.name !== 'RenderingCancelledException') {
                    console.error('PDF render error:', err);
                }
                renderTaskRef.current = null;
            });
        });

        return () => {
            cancelled = true;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
                renderTaskRef.current = null;
            }
        };
    }, [pdf, pageNum, scale]);

    return (
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative group">
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

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-blue-600/90 text-[10px] font-black text-white px-4 py-2 rounded-full backdrop-blur-md shadow-2xl border border-blue-400/30">
                    SỬ DỤNG PHÍM MŨI TÊN ĐỂ CHUYỂN TRANG
                </div>
            </div>
        </div>
    );
};

const Documents: React.FC<DocumentsProps> = ({ onUpdateKnowledgeBase, onDeleteDocumentData, onNotify }) => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<CloudDocumentFile[]>([]);
  const [cloudDocs, setCloudDocs] = useState<DocumentFile[]>([]); // Lectures from teacher
  const [selectedDoc, setSelectedDoc] = useState<DocumentFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // TASK 1: Fetch User Documents from Cloud (UPDATED with Role-based Service)
  useEffect(() => {
      const fetchUserDocuments = async () => {
          if (!user?.id) return;
          try {
              // Use centralized service logic with role
              const documents = await databaseService.fetchUserDocuments(user.id, user.role);
              
              const mappedDocs: CloudDocumentFile[] = documents.map((doc: any) => ({
                  id: doc.$id,
                  name: doc.name,
                  type: 'PDF',
                  url: doc.file_url,
                  uploadDate: new Date(doc.$createdAt).toLocaleDateString('vi-VN'),
                  isProcessed: doc.is_processed,
                  fileId: doc.file_id,
                  metadata: { title: doc.name },
                  userId: doc.user_id,
                  isGlobal: doc.is_global
              }));
              
              setDocs(mappedDocs);
          } catch (error) {
              console.error("Lỗi tải tài liệu cá nhân:", error);
          }
      };

      fetchUserDocuments();
  }, [user]);

  // Fetch Cloud Lectures (Existing Logic)
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
      }
      fetchLectures();
    }
  }, [user]);

  const allDocs = [...cloudDocs, ...docs];

  // TASK 2: Upload File Logic
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return onNotify("Vui lòng tải tệp PDF.", "error");
    if (!user?.id) return onNotify("Vui lòng đăng nhập.", "warning");

    setIsProcessing(true);
    setProgress(5);

    try {
        // 1. Upload to Storage
        const uploadResponse = await storage.createFile(
            APPWRITE_CONFIG.buckets.lectures, // Reusing bucket
            ID.unique(),
            file
        );
        const fileId = uploadResponse.$id;
        const fileUrl = storage.getFileView(APPWRITE_CONFIG.buckets.lectures, fileId);

        // 2. Create DB Entry (Pending status)
        // If Admin creates, make it Global
        const isGlobal = user.role === 'admin';
        
        const docRecord = await databases.createDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.user_documents,
            ID.unique(),
            {
                user_id: user.id,
                name: file.name,
                file_id: fileId,
                file_url: fileUrl,
                is_processed: false,
                is_global: isGlobal // Set Global flag
            }
        );

        const newDocId = docRecord.$id;
        setProcessingDocId(newDocId);

        // Update UI immediately
        const newLocalDoc: CloudDocumentFile = {
            id: newDocId,
            name: file.name,
            type: 'PDF',
            url: fileUrl,
            fileId: fileId,
            uploadDate: new Date().toLocaleDateString('vi-VN'),
            isProcessed: false,
            metadata: { title: file.name },
            userId: user.id,
            isGlobal: isGlobal
        };
        setDocs(prev => [newLocalDoc, ...prev]);
        setSelectedDoc(newLocalDoc);

        // 3. Extract & Embed
        // Pass the FILE object directly for local processing (faster/safer than downloading URL)
        const { text, metadata } = await extractDataFromPDF(file); 
        
        const chunks = chunkText(text);
        const vectorChunks = await embedChunks(newDocId, chunks, (p) => setProgress(20 + Math.round(p * 0.8)));

        // 4. Update DB Entry (Processed status)
        await databases.updateDocument(
            APPWRITE_CONFIG.dbId,
            APPWRITE_CONFIG.collections.user_documents,
            newDocId,
            { is_processed: true }
        );

        if (vectorChunks.length > 0) {
            onUpdateKnowledgeBase(vectorChunks);
            setDocs(prev => prev.map(d => d.id === newDocId ? { ...d, isProcessed: true } : d));
            onNotify("Đã lưu và nạp tri thức RAG thành công!", "success");
        } else {
            onNotify("Đã lưu tài liệu. (Cảnh báo: Lỗi Embedding AI - Vui lòng kiểm tra API Key)", "warning");
        }

    } catch (error: any) {
        console.error(error);
        onNotify(`Lỗi: ${error.message}`, "error");
        // Optional: Cleanup if upload failed in DB but succeeded in storage
    } finally {
        setIsProcessing(false);
        setProcessingDocId(null);
        setProgress(0);
    }
  };

  // TASK 3: Delete File Logic
  const deleteDoc = async (doc: CloudDocumentFile) => {
      if (doc.id.startsWith('cloud_')) return;
      if (!window.confirm(`Xóa tài liệu "${doc.name}"?`)) return;

      try {
          // 1. Delete from DB
          await databases.deleteDocument(
              APPWRITE_CONFIG.dbId, 
              APPWRITE_CONFIG.collections.user_documents, 
              doc.id
          );

          // 2. Delete from Storage (if fileId exists)
          if (doc.fileId) {
              await storage.deleteFile(APPWRITE_CONFIG.buckets.lectures, doc.fileId);
          }

          // 3. Update UI & Knowledge Base
          setDocs(prev => prev.filter(d => d.id !== doc.id));
          onDeleteDocumentData(doc.id);
          
          if (selectedDoc?.id === doc.id) setSelectedDoc(null);
          onNotify("Đã xóa tài liệu.", "info");

      } catch (error: any) {
          console.error(error);
          onNotify(`Lỗi xóa tài liệu: ${error.message}`, "error");
      }
  };

  return (
    <div className="h-full flex flex-col p-8 bg-gray-50/30">
      <div className="flex justify-between items-center mb-8 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
         <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Thư viện Tri thức RAG</h2>
            <p className="text-sm text-gray-500 font-medium italic">Tài liệu PDF được AI phân tích và lưu trữ Cloud (Sync)</p>
         </div>
         {user?.role !== 'student' && (
             <label className={`cursor-pointer bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all hover:bg-blue-700 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-upload"></i>}
                {isProcessing ? "ĐANG HỌC..." : "TẢI GIÁO TRÌNH"}
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
             </label>
         )}
      </div>

      <div className="flex-1 flex gap-8 min-h-0">
        <div className="w-80 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col overflow-hidden shrink-0">
            <div className="p-6 border-b border-slate-50 bg-gray-50/50 flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Giáo trình ({allDocs.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {allDocs.map((doc) => {
                    const isCloud = doc.id.startsWith('cloud_');
                    const typedDoc = doc as CloudDocumentFile;
                    return (
                        <div key={doc.id} onClick={() => setSelectedDoc(doc)} className={`p-4 rounded-[1.5rem] border-2 cursor-pointer transition-all relative group ${selectedDoc?.id === doc.id ? 'bg-blue-50 border-blue-500/20' : 'bg-white border-transparent'}`}>
                            {!isCloud && (user?.role === 'admin' || typedDoc.userId === user?.id) && (
                                <button onClick={(e) => {e.stopPropagation(); deleteDoc(typedDoc)}} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1"><i className="fas fa-trash-alt text-[10px]"></i></button>
                            )}
                            <div className="flex gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${doc.id === processingDocId ? 'bg-orange-100 text-orange-500' : isCloud ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                                    <i className={`fas ${doc.id === processingDocId ? 'fa-circle-notch fa-spin' : isCloud ? 'fa-cloud' : 'fa-file-pdf'} text-lg`}></i>
                                </div>
                                <div className="overflow-hidden flex-1">
                                    <p className={`font-black text-sm truncate flex items-center gap-2`}>
                                        {doc.name}
                                        {typedDoc.isGlobal && <span className="bg-blue-100 text-blue-700 text-[9px] px-1 rounded">Chung</span>}
                                    </p>
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${doc.isProcessed || isCloud ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        {doc.isProcessed || isCloud ? 'Đã học' : doc.id === processingDocId ? `Học ${progress}%` : 'Đang chờ'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
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