
/**
 * documentProcessor.ts — Client-Side (Bluebee Architecture)
 * 
 * Embedding calls go directly to Gemini API using user's own API Key.
 * No server proxy needed.
 */

import { VectorChunk, PdfMetadata } from "../types";
import * as pdfjsLib from "pdfjs-dist";
import { GoogleGenAI } from "@google/genai";

import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY_API = 'DTS_GEMINI_API_KEY';

/**
 * Get API Key for embedding — same logic as geminiService
 */
const getApiKey = (): string | undefined => {
  const customKey = localStorage.getItem(STORAGE_KEY_API);
  if (customKey && customKey.trim().length > 0) return customKey;
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
};

const parsePdfDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const raw = dateStr.replace(/^D:/, '');
  if (raw.length >= 8) {
    return `${raw.substring(6, 8)}/${raw.substring(4, 6)}/${raw.substring(0, 4)}`;
  }
  return dateStr;
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

/**
 * Embed text chunks DIRECTLY via Gemini API (no server proxy).
 */
export const embedChunks = async (
  docId: string, 
  textChunks: string[],
  onProgress?: (percent: number) => void
): Promise<VectorChunk[]> => {
  
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Vui lòng nhập Gemini API Key trong Cài đặt để sử dụng tính năng RAG.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const vectorChunks: VectorChunk[] = [];
  
  // Process one by one to avoid rate limits
  for (let i = 0; i < textChunks.length; i++) {
    let retries = 0;
    while (retries < 3) {
      try {
        const response = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: [{ parts: [{ text: textChunks[i] }] }],
        });

        const values = response.embeddings?.[0]?.values;
        if (values && values.length > 0) {
          vectorChunks.push({
            id: Math.random().toString(36).substring(7),
            docId,
            text: textChunks[i],
            embedding: values,
          });
        }
        break;
      } catch (error: any) {
        if (error.toString().includes('429')) {
          retries++;
          await new Promise(r => setTimeout(r, 3000 * retries));
          continue;
        }
        console.error(`Embedding chunk ${i} failed:`, error.message);
        break; // Skip this chunk on non-retryable errors
      }
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / textChunks.length) * 100));
    }
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

/**
 * Find relevant chunks using embedding similarity — DIRECT Gemini call.
 */
export const findRelevantChunks = async (
  query: string,
  knowledgeBase: VectorChunk[],
  topK: number = 5
): Promise<VectorChunk[]> => {
  if (knowledgeBase.length === 0) return [];

  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: [{ parts: [{ text: query }] }],
    });

    const queryVector = response.embeddings?.[0]?.values;
    if (!queryVector || queryVector.length === 0) return [];

    return knowledgeBase
      .map(chunk => ({ chunk, score: cosineSimilarity(queryVector, chunk.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => item.chunk);
  } catch (e: any) {
    console.error("RAG Lookup Error:", e);
    // Fallback to simple keyword search
    const lowerQuery = query.toLowerCase();
    return knowledgeBase
      .filter(chunk => chunk.text.toLowerCase().includes(lowerQuery))
      .slice(0, topK);
  }
};
