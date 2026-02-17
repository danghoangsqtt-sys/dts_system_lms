/// <reference types="vite/client" />

declare module '*?url' {
  const defaultUrl: string;
  export default defaultUrl;
}

declare module 'pdfjs-dist/build/pdf.worker.mjs?url' {
  const workerUrl: string;
  export default workerUrl;
}