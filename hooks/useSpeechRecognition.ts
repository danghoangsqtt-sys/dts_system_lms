
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Định nghĩa các Interface mở rộng cho Web Speech API
 */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isRecording: boolean;
  transcript: string;
  toggleRecording: () => void;
  stopRecording: () => void;
  resetTranscript: () => void;
  error: string | null;
}

export const useSpeechRecognition = (lang: string = 'vi-VN'): UseSpeechRecognitionReturn => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sử dụng Ref để theo dõi trạng thái mong muốn của người dùng (tránh stale closures trong onend)
  const shouldBeRecordingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognitionClass) {
      console.warn("[DHSYSTEM-VOICE] Web Speech API is not supported in this browser.");
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognitionClass() as SpeechRecognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      console.debug("[DHSYSTEM-VOICE] Recognition started.");
      setIsRecording(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      setTranscript(fullTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("[DHSYSTEM-VOICE] Recognition error:", event.error);
      
      // Không báo lỗi nếu là 'no-speech' (trường hợp im lặng quá lâu) 
      // vì chúng ta sẽ tự động khởi động lại ở onend
      if (event.error !== 'no-speech') {
        setError(`Lỗi nhận diện: ${event.error}`);
      }

      // Nếu gặp lỗi nghiêm trọng (như network), dừng hẳn
      if (event.error === 'network' || event.error === 'not-allowed') {
        shouldBeRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      console.debug("[DHSYSTEM-VOICE] Recognition ended.");
      
      // Cơ chế Keep-alive: Nếu người dùng vẫn muốn ghi âm nhưng browser tự ngắt (do im lặng hoặc timeout)
      if (shouldBeRecordingRef.current) {
        console.debug("[DHSYSTEM-VOICE] Re-starting recognition (Keep-alive)...");
        try {
          recognition.start();
        } catch (e) {
          console.warn("[DHSYSTEM-VOICE] Failed to restart recognition:", e);
        }
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldBeRecordingRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [lang]);

  const toggleRecording = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      console.warn("[DHSYSTEM-VOICE] Cannot toggle: Speech recognition is not supported.");
      return;
    }

    if (isRecording) {
      shouldBeRecordingRef.current = false;
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      shouldBeRecordingRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("[DHSYSTEM-VOICE] Start error (possible state conflict):", e);
        // Nếu đã đang chạy nhưng state bị lệch, reset lại Ref
        if (String(e).includes("already started")) {
            setIsRecording(true);
        }
      }
    }
  }, [isSupported, isRecording]);

  const stopRecording = useCallback(() => {
    shouldBeRecordingRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return { 
    isSupported,
    isRecording, 
    transcript, 
    toggleRecording, 
    stopRecording, 
    resetTranscript, 
    error 
  };
};
