import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { ReactElement } from 'react'

type Orientation = 'portrait' | 'landscape'

/** Μετατρέπει ένα DOM node σε PDF (base64, χωρίς το data: prefix), με σωστή
 *  σελιδοποίηση A4. Χρησιμοποιεί html2canvas ώστε τα ελληνικά να αποδίδονται
 *  πάντα σωστά (raster της πραγματικής απόδοσης του browser). */
export async function nodeToPdfBase64(node: HTMLElement, orientation: Orientation = 'portrait'): Promise<string> {
  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: node.scrollWidth,
  })
  const img = canvas.toDataURL('image/jpeg', 0.92)
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgW = pageW
  const imgH = (canvas.height * pageW) / canvas.width
  let heightLeft = imgH
  let position = 0
  pdf.addImage(img, 'JPEG', 0, position, imgW, imgH)
  heightLeft -= pageH
  while (heightLeft > 0) {
    position -= pageH
    pdf.addPage()
    pdf.addImage(img, 'JPEG', 0, position, imgW, imgH)
    heightLeft -= pageH
  }
  const uri = pdf.output('datauristring')
  return uri.slice(uri.indexOf(',') + 1)
}

/** Αποδίδει ένα React element εκτός οθόνης και το μετατρέπει σε PDF (base64). */
export async function elementToPdfBase64(
  element: ReactElement,
  { widthPx = 760, orientation = 'portrait' as Orientation } = {},
): Promise<string> {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${widthPx}px;background:#fff;padding:20px;box-sizing:border-box`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(element))
    // Αναμονή για fonts/εικόνες/layout πριν το html2canvas.
    await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready?.catch(() => {})
    await new Promise((r) => setTimeout(r, 350))
    return await nodeToPdfBase64(host, orientation)
  } finally {
    root.unmount()
    host.remove()
  }
}
