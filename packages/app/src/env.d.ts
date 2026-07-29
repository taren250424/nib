declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

declare module "*.svg?raw" {
  const content: string
  export default content
}
