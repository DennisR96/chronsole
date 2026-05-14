// types/electron-webview.d.ts
import type React from "react";

declare global {
  interface Window {
    chronosole?: {
      isElectron: boolean;
      platform: NodeJS.Platform;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        allowpopups?: string;
        partition?: string;
        useragent?: string;
        preload?: string;
      };
    }
  }
}

export { };
