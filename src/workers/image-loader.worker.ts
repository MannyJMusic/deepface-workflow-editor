// Web Worker for efficient image loading using createImageBitmap
self.onmessage = function (e: MessageEvent) {
  const { url, id } = e.data;

  fetch(url, { mode: 'cors' })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.blob();
    })
    .then(blob => createImageBitmap(blob))
    .then(bitmap => {
      // Transfer the bitmap to the main thread
      self.postMessage({ 
        id, 
        url, 
        bitmap, 
        success: true 
      }, [bitmap]);
    })
    .catch(err => {
      self.postMessage({ 
        id, 
        url, 
        error: err.message, 
        success: false 
      });
    });
};

