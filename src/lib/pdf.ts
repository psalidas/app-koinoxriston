import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { ReactElement } from 'react'

type Orientation = 'portrait' | 'landscape'

/** Μετατρέπει ένα DOM node σε PDF (base64, χωρίς το data: prefix), με σωστή
 *  σελιδοποίηση A4 και περιθώρια σε κάθε σελίδα. Χρησιμοποιεί html2canvas ώστε
 *  τα ελληνικά να αποδίδονται πάντα σωστά. */
export async function nodeToPdfBase64(node: HTMLElement, orientation: Orientation = 'portrait'): Promise<string> {
  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: node.scrollWidth,
  })
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const margin = 8 // mm περιθώριο σε κάθε πλευρά
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const printW = pageW - margin * 2
  const printH = pageH - margin * 2
  // Πόσα pixel της πηγής αντιστοιχούν σε ύψος μίας σελίδας (με βάση το πλάτος).
  const pxPerMm = canvas.width / printW
  const pageSlicePx = printH * pxPerMm

  let srcY = 0
  let firstPage = true
  while (srcY < canvas.height - 1) {
    const sliceH = Math.min(pageSlicePx, canvas.height - srcY)
    const tmp = document.createElement('canvas')
    tmp.width = canvas.width
    tmp.height = Math.ceil(sliceH)
    const ctx = tmp.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tmp.width, tmp.height)
    ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    const sliceImg = tmp.toDataURL('image/jpeg', 0.92)
    const dispH = sliceH / pxPerMm
    if (!firstPage) pdf.addPage()
    pdf.addImage(sliceImg, 'JPEG', margin, margin, printW, dispH)
    srcY += sliceH
    firstPage = false
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
