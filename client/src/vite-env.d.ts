/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** LaunchDarkly client-side ID for the environment you are demoing. See client/.env.example. */
  readonly VITE_LD_CLIENT_SIDE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
