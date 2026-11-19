// Imported PDFs are kept in IndexedDB: localStorage is far too small for books.
const DB_NAME = "akshara-files";
const DB_VERSION = 1;
const STORE = "pdfs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("This browser cannot store imported PDFs locally."),
    );
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not open local storage."));
      request.onblocked = () =>
        reject(new Error("Local storage is busy. Close other tabs and retry."));
    });
  }
  return dbPromise;
}

export async function savePdfFile(id: string, file: Blob): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save the PDF."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Could not save the PDF."));
  });
}

export async function loadPdfFile(id: string): Promise<Blob | null> {
  const db = await openDatabase();
  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(id);
    request.onsuccess = () => {
      const value = request.result as Blob | undefined;
      resolve(value ?? null);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read the PDF."));
  });
}

export async function deletePdfFile(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    // A missing file is already the desired end state.
  }
}

export async function clearPdfFiles(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    // Nothing stored yet.
  }
}
