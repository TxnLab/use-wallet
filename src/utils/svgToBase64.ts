export function svgToBase64(svg: string): string {
  const base64EncodedSvg = btoa(svg)
  return `data:image/svg+xml;base64,${base64EncodedSvg}`
}
