
// @google/genai initialization rules followed: use process.env.API_KEY.
import { GoogleGenAI } from "@google/genai";
import { VectorChunk, PdfMetadata } from "../types";
import * as pdfjsLib from "pdfjs-dist";

import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const parsePdfDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const raw = dateStr.replace(/^D:/, '');
  if (raw.length >= 8) {
    return `${raw.substring(6, 8)}/${raw.substring(4, 6)}/${raw.substring(0, 4)}`;
  }
  return dateStr;
};

/**
 * Lấy API Key từ localStorage
 */
const getApiKey = (): string => {
  const saved = localStorage.getItem('app_settings');
  if (saved) {
    const settings = JSON.parse(saved);
    return settings.manualApiKey || "";
  }
  return "";
};

export const extractDataFromPDF = async (fileOrUrl: File | string): Promise<{ text: string; metadata: PdfMetadata }> => {
  try {
    let data;
    if (typeof fileOrUrl === 'string') {
        const response = await fetch(fileOrUrl);
        const blob = await response.blob();
        data = await blob.arrayBuffer();
    } else {
        data = await fileOrUrl.arrayBuffer();
    }

    const loadingTask = pdfjsLib.getDocument({
      data: data,
      useWorkerFetch: true,
      isEvalSupported: false,
    });
    
    let pdf = await loadingTask.promise;
    let metadata: PdfMetadata = {};
    try {
      const meta = await pdf.getMetadata();
      if (meta?.info) {
        const info = meta.info as any;
        metadata = {
          title: info.Title || '',
          author: info.Author || '',
          creationDate: parsePdfDate(info.CreationDate),
          producer: info.Producer || ''
        };
      }
    } catch (e) {}
    
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return { text: fullText, metadata };
  } catch (error) {
    console.error("[PDF-EXTRACT-ERROR]", error);
    throw error;
  }
};

export const extractTextFromPDF = async (file: File): Promise<string> => {
    const { text } = await extractDataFromPDF(file);
    return text;
}

export const chunkText = (text: string, targetChunkSize: number = 1000, overlap: number = 200): string[] => {
  const cleanText = text.replace(/[ \t]+/g, ' ').trim();
  const paragraphs = cleanText.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";
  
  for (const paragraph of paragraphs) {
    if ((currentChunk.length + paragraph.length) > targetChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = currentChunk.slice(-overlap) + " " + paragraph; 
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
    
    if (currentChunk.length > targetChunkSize * 1.5) {
        const sentences = currentChunk.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [currentChunk];
        currentChunk = "";
        for (const sentence of sentences) {
            if ((currentChunk.length + sentence.length) > targetChunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = currentChunk.slice(-overlap) + sentence;
            } else {
                currentChunk += sentence;
            }
        }
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  return chunks.filter(c => c.length > 60); 
};

export const embedChunks = async (
  docId: string, 
  textChunks: string[],
  onProgress?: (percent: number) => void
): Promise<VectorChunk[]> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Vui lòng nhập API Key trong phần Cài đặt.");
  
  const ai = new GoogleGenAI({ apiKey });
  const vectorChunks: VectorChunk[] = [];

  for (let i = 0; i < textChunks.length; i++) {
    try {
      const response = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: [{ parts: [{ text: textChunks[i] }] }]
      });
      const embedding = response.embeddings?.[0];
      if (embedding?.values) {
        vectorChunks.push({
          id: Math.random().toString(36).substring(7),
          docId: docId,
          text: textChunks[i],
          embedding: embedding.values
        });
      }
    } catch (e: any) {
      if (e.toString().includes('429')) {
        await new Promise(r => setTimeout(r, 4500));
        i--;
        continue;
      }
    }
    if (onProgress) onProgress(Math.round(((i + 1) / textChunks.length) * 100));
  }
  return vectorChunks;
};

const dotProduct = (a: number[], b: number[]) => a.reduce((sum, val, i) => sum + val * b[i], 0);
const magnitude = (a: number[]) => Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));

export const cosineSimilarity = (a: number[], b: number[]) => {
    const magA = magnitude(a);
    const magB = magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    return dotProduct(a, b) / (magA * magB);
};

export const findRelevantChunks = async (
  query: string,
  knowledgeBase: VectorChunk[],
  topK: number = 5
): Promise<VectorChunk[]> => {
  if (knowledgeBase.length === 0) return [];
  
  const apiKey = getApiKey();
  if (!apiKey) return [];
  
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: [{ parts: [{ text: query }] }]
    });
    const queryVector = response.embeddings?.[0]?.values;
    if (!queryVector) return [];

    return knowledgeBase
      .map(chunk => ({ chunk, score: cosineSimilarity(queryVector, chunk.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => item.chunk);
  } catch (e) {
    const lowerQuery = query.toLowerCase();
    return knowledgeBase
      .filter(chunk => chunk.text.toLowerCase().includes(lowerQuery))
      .slice(0, topK);
  }
};
