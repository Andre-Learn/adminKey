const KEY = 'epen.session';

/**
 * Menyimpan session token bertanda tangan (bukan license key, bukan status lisensi).
 * Token hanya penunjuk: validitas lisensi selalu dicek ulang ke server.
 */
export const sessionStore = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      /* penyimpanan tidak tersedia */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  },
};
