const KEY = 'epen.device_id';
let memoryId: string | null = null;

/** ID acak per browser. Server menyimpan hash-nya saja. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || id.length < 8) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}

export function getPlatform(): string {
  const ua = navigator.userAgent;
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'iOS'
        : /Mac OS X/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Unknown OS';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  return `${browser} di ${os}`;
}
