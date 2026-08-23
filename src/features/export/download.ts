/**
 * Browser-side file download. Kept separate from `lib/csv.ts` so the CSV
 * serialisation stays pure and testable in a Node environment.
 */

/**
 * Triggers a client-side download of `content` as a file.
 *
 * The BOM matters: Excel on Windows assumes the system codepage for a bare
 * UTF-8 CSV, which mangles the accented characters that appear throughout
 * Brazilian locality names and collector attributions. A UTF-8 BOM makes it
 * decode correctly, and is ignored by everything else that reads CSV.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob(['﻿', content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Revoking synchronously can cancel the download in some browsers; a tick of
  // delay is enough for the navigation to have been queued.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
