function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Environment variable ${name} belum diatur`);
  }
  return value;
}

function secret(name: string): string {
  const value = required(name);
  if (value.length < 32) {
    throw new Error(`${name} harus minimal 32 karakter`);
  }
  return value;
}

/** Semua nilai dibaca lazy agar error konfigurasi muncul sebagai 500 yang jelas di log. */
export const env = {
  get supabaseUrl(): string {
    return required('SUPABASE_URL');
  },
  get serviceRoleKey(): string {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get hashSecret(): string {
    return secret('LICENSE_HASH_SECRET');
  },
  get sessionSecret(): string {
    return secret('SESSION_SECRET');
  },
  get allowedOrigins(): string[] {
    return (process.env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  },
};
