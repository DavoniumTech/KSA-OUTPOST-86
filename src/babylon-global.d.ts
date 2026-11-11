interface Window {
  BABYLON?: any;
}

declare module '*.svg' {
  const source: string;
  export default source;
}
