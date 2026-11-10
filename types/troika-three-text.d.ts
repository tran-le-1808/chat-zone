declare module "troika-three-text" {
  export function preloadFont(
    options: {
      font?: string;
      characters?: string | string[];
      sdfGlyphSize?: number;
    },
    callback: () => void,
  ): void;
  export function configureTextBuilder(config: Record<string, unknown>): void;
}
