interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly VITE_FIREBASE_GOOGLE_CLIENT_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
