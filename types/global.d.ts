export { };

declare global {
  type Platform = "darwin" | "win32" | "linux" | "unknown";

  interface Window {
    chronosole?: {
      isElectron: boolean;
      platform: Platform;
      selectDirectory?: () => Promise<string | null>;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          allowpopups?: boolean;
          partition?: string;
        },
        HTMLElement
      >;
    }
  }
}
