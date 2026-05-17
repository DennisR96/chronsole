declare module "react-file-icon" {
  import type { ComponentType, SVGProps } from "react";

  export interface FileIconProps extends SVGProps<SVGSVGElement> {
    extension?: string;
    type?: string;
    color?: string;
    labelColor?: string;
    labelTextColor?: string;
    glyphColor?: string;
    gradientColor?: string;
    gradientOpacity?: number;
    foldColor?: string;
    fold?: boolean;
    radius?: number;
  }

  export const FileIcon: ComponentType<FileIconProps>;
  export const defaultStyles: Record<string, Partial<FileIconProps>>;
}
