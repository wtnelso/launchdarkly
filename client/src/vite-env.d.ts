/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LD_CLIENT_SIDE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
