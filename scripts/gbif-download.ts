/**
 * Requests a GBIF occurrence download for Santa Catarina and fetches the file.
 *
 * The search API that `sources/gbif.ts` pages through is rate limited and
 * stops after about 11k records, while GBIF holds about 1.7 million for the
 * state. The download API builds the whole set as one file on GBIF's side, and
 * it comes with a DOI that the data has to cite anyway.
 *
 * Needs a free GBIF account: GBIF_USER, GBIF_PWD and GBIF_EMAIL in the
 * environment. GBIF emails GBIF_EMAIL when the file is ready.
 *
 * Usage:
 *   npm run data:gbif-download            request a new download, wait, fetch
 *   npm run data:gbif-download -- --resume  wait for the last request instead
 *
 * Duration: GBIF takes from minutes to an hour to build the file.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { fetchJson, sleep, USER_AGENT } from './sources/http'

const API = 'https://api.gbif.org/v1/occurrence/download'
const OUT_DIR = resolve('data/gbif')
const STATE = resolve(OUT_DIR, 'download.json')
const POLL_MS = 60_000

/**
 * GADM level 1 for Santa Catarina. GBIF assigns it from the coordinates, so it
 * catches records whose free-text `stateProvince` is missing or misspelled,
 * and drops records that name the state but sit outside it.
 */
const SC_GADM_GID = 'BRA.24_1'

interface DownloadStatus {
  key: string
  status: 'PREPARING' | 'RUNNING' | 'SUCCEEDED' | 'CANCELLED' | 'KILLED' | 'FAILED' | 'SUSPENDED' | 'FILE_ERASED'
  doi?: string
  downloadLink?: string
  totalRecords?: number
  size?: number
}

function credentials(): { user: string; pwd: string; email: string } {
  const { GBIF_USER: user, GBIF_PWD: pwd, GBIF_EMAIL: email } = process.env
  if (!user || !pwd || !email) {
    console.error('GBIF_USER, GBIF_PWD and GBIF_EMAIL must be set (free account at gbif.org).')
    process.exit(1)
  }
  return { user, pwd, email }
}

async function requestDownload(): Promise<string> {
  const { user, pwd, email } = credentials()
  const body = {
    creator: user,
    notificationAddresses: [email],
    sendNotification: true,
    format: 'SIMPLE_CSV',
    predicate: {
      type: 'and',
      predicates: [
        { type: 'equals', key: 'GADM_GID', value: SC_GADM_GID },
        { type: 'equals', key: 'HAS_COORDINATE', value: 'true' },
        { type: 'equals', key: 'HAS_GEOSPATIAL_ISSUE', value: 'false' },
        { type: 'equals', key: 'OCCURRENCE_STATUS', value: 'PRESENT' },
      ],
    },
  }

  const res = await fetch(`${API}/request`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${user}:${pwd}`).toString('base64')}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return (await res.text()).trim()
}

async function waitFor(key: string): Promise<DownloadStatus> {
  for (;;) {
    const status = await fetchJson<DownloadStatus>(`${API}/${key}`)
    console.log(`  ${new Date().toISOString().slice(11, 19)}  ${status.status}`)
    if (status.status === 'SUCCEEDED') return status
    if (status.status !== 'PREPARING' && status.status !== 'RUNNING') {
      throw new Error(`download ${key} ended as ${status.status}`)
    }
    await sleep(POLL_MS)
  }
}

async function fetchFile(status: DownloadStatus): Promise<string> {
  const file = resolve(OUT_DIR, `${status.key}.zip`)
  const res = await fetch(status.downloadLink!, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} fetching ${status.downloadLink}`)
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(file))
  return file
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  const resume = process.argv.includes('--resume')

  let key: string
  if (resume) {
    if (!existsSync(STATE)) {
      console.error(`--resume needs ${STATE}; run without it first.`)
      process.exit(1)
    }
    key = JSON.parse(readFileSync(STATE, 'utf8')).key
    console.log(`Resuming download ${key}`)
  } else {
    key = await requestDownload()
    writeFileSync(STATE, JSON.stringify({ key, requestedAt: new Date().toISOString() }, null, 2))
    console.log(`Requested download ${key}: https://www.gbif.org/occurrence/download/${key}`)
  }

  const status = await waitFor(key)
  writeFileSync(STATE, JSON.stringify(status, null, 2))
  console.log(`Ready: ${status.totalRecords} records, DOI ${status.doi}`)

  const file = await fetchFile(status)
  console.log(`Saved ${file}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
