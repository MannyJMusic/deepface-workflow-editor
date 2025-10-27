import { useEffect, useRef, useCallback, useState } from 'react';

interface ImageLoadResult {
  id: string;
  url: string;
  bitmap?: ImageBitmap;
  error?: string;
  success: boolean;
}

interface UseImageWorkerOptions {
  maxConcurrent?: number;
  onImageLoaded?: (result: ImageLoadResult) => void;
  onImageError?: (result: ImageLoadResult) => void;
}

export const useImageWorker = (options: UseImageWorkerOptions = {}) => {
  const { maxConcurrent = 5, onImageLoaded, onImageError } = options;
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const pendingRequests = useRef<Map<string, (result: ImageLoadResult) => void>>(new Map());
  const activeRequests = useRef<Set<string>>(new Set());

  // Initialize worker
  useEffect(() => {
    try {
      // Create worker from the worker file
      workerRef.current = new Worker(new URL('../workers/image-loader.worker.ts', import.meta.url), {
        type: 'module'
      });

      workerRef.current.onmessage = (e: MessageEvent<ImageLoadResult>) => {
        const result = e.data;
        const callback = pendingRequests.current.get(result.id);
        
        if (callback) {
          callback(result);
          pendingRequests.current.delete(result.id);
          activeRequests.current.delete(result.id);
        }

        if (result.success) {
          onImageLoaded?.(result);
        } else {
          onImageError?.(result);
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('Worker error:', error);
      };

      setIsWorkerReady(true);
    } catch (error) {
      console.error('Failed to create image worker:', error);
      setIsWorkerReady(false);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [onImageLoaded, onImageError]);

  const loadImage = useCallback((id: string, url: string): Promise<ImageLoadResult> => {
    return new Promise((resolve) => {
      if (!workerRef.current || !isWorkerReady) {
        resolve({
          id,
          url,
          success: false,
          error: 'Worker not ready'
        });
        return;
      }

      // Check if we're at the concurrent limit
      if (activeRequests.current.size >= maxConcurrent) {
        // Queue the request
        pendingRequests.current.set(id, resolve);
        return;
      }

      // Send request to worker
      activeRequests.current.add(id);
      workerRef.current.postMessage({ id, url });
      
      // Set up callback for when the request completes
      pendingRequests.current.set(id, resolve);
    });
  }, [isWorkerReady, maxConcurrent]);

  const preloadImages = useCallback(async (imageRequests: Array<{ id: string; url: string }>) => {
    const promises = imageRequests.map(({ id, url }) => loadImage(id, url));
    return Promise.allSettled(promises);
  }, [loadImage]);

  return {
    loadImage,
    preloadImages,
    isWorkerReady,
    activeRequestsCount: activeRequests.current.size
  };
};
