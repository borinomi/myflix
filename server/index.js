import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import iconv from 'iconv-lite'
import { VIDEO_FORMATS, IMAGE_FORMATS } from './constants/mediaFormats.js'
import { scanDirectory, scanImages, getFolderTree, getFoldersWithThumbnails } from './services/fileScanner.js'
import { convertSrtToVtt } from './utils/subtitleConverter.js'
import { generateThumbnail, clearThumbnailCache, getCacheStats } from './services/thumbnailCache.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 환경 설정
const isElectron = process.env.ELECTRON_APP_PATH !== undefined
const isProduction = process.env.NODE_ENV === 'production'

const app = express()
const PORT = process.env.PORT || 5000

// config.json 파일 경로
const CONFIG_PATH = path.join(__dirname, '..', 'config.json')

// 기본 설정
const DEFAULT_CONFIG = {
  scanDirectory: path.join(__dirname, '..', 'media')
}

// ============================================================
// 보안 유틸리티 함수
// ============================================================

/**
 * Path Traversal 공격 방어 - 경로가 허용된 디렉토리 내부인지 검증
 * @param {string} requestedPath - 요청된 경로
 * @param {string} allowedBase - 허용된 기본 디렉토리 (없으면 SCAN_DIRECTORY 사용)
 * @returns {{ safe: boolean, resolvedPath: string, error?: string }}
 */
function validatePath(requestedPath, allowedBase = null) {
  try {
    const baseDir = allowedBase || SCAN_DIRECTORY
    const resolved = path.resolve(requestedPath)
    const resolvedBase = path.resolve(baseDir)

    // 경로가 허용된 디렉토리 내부인지 확인
    // 네트워크 경로(\\)도 허용
    const isNetworkPath = resolved.startsWith('\\\\') || resolvedBase.startsWith('\\\\')
    const isInsideBase = resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase

    if (isNetworkPath || isInsideBase) {
      return { safe: true, resolvedPath: resolved }
    }

    // 추가 검증: 상위 디렉토리 이동 패턴 검출
    if (requestedPath.includes('..')) {
      return { safe: false, resolvedPath: resolved, error: '잘못된 경로입니다.' }
    }

    // 네트워크 경로는 별도 처리 (UNC 경로)
    if (resolved.startsWith('\\\\')) {
      return { safe: true, resolvedPath: resolved }
    }

    return { safe: false, resolvedPath: resolved, error: '접근이 허용되지 않은 경로입니다.' }
  } catch (error) {
    return { safe: false, resolvedPath: '', error: '경로 검증 오류' }
  }
}

/**
 * 파일 경로가 허용된 확장자인지 검증
 * @param {string} filePath - 파일 경로
 * @param {string[]} allowedExtensions - 허용된 확장자 배열
 * @returns {boolean}
 */
function validateExtension(filePath, allowedExtensions) {
  const ext = path.extname(filePath).toLowerCase()
  return allowedExtensions.includes(ext)
}

/**
 * MIME 타입 반환
 * @param {string} filePath - 파일 경로
 * @returns {string}
 */
function getVideoMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv'
  }
  return mimeTypes[ext] || 'video/mp4'
}

// ============================================================
// 설정 관리
// ============================================================

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('설정 파일 로드 오류:', error)
  }
  return DEFAULT_CONFIG
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
    console.log('설정이 저장되었습니다:', CONFIG_PATH)
  } catch (error) {
    console.error('설정 파일 저장 오류:', error)
  }
}

// 설정 로드
const config = loadConfig()
let SCAN_DIRECTORY = config.scanDirectory
let videoCache = []

// ============================================================
// 미들웨어
// ============================================================

app.use(cors())
app.use(express.json())

// 프로덕션 환경에서 정적 파일 서빙
if (isProduction || isElectron) {
  const distPath = isElectron
    ? path.join(process.env.RESOURCES_PATH || __dirname, '..', 'dist')
    : path.join(__dirname, '..', 'dist')

  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath))
    console.log('정적 파일 경로:', distPath)
  }
}

// ============================================================
// API 엔드포인트
// ============================================================

// 비디오 목록 조회
app.get('/api/videos', (req, res) => {
  videoCache = scanDirectory(SCAN_DIRECTORY)
  res.json(videoCache)
})

// 썸네일 이미지 제공 (캐싱 지원)
app.get('/api/thumbnail/:path(*)', async (req, res) => {
  const requestedPath = decodeURIComponent(req.params.path)
  const validation = validatePath(requestedPath)

  if (!validation.safe) {
    return res.status(403).json({ error: validation.error })
  }

  if (!fs.existsSync(validation.resolvedPath)) {
    return res.status(404).send('파일을 찾을 수 없습니다.')
  }

  try {
    const thumbnailPath = await generateThumbnail(validation.resolvedPath)
    res.sendFile(thumbnailPath)
  } catch (error) {
    console.error('썸네일 생성 오류:', error)
    res.status(500).send('썸네일 생성 실패')
  }
})

// 자막 파일 제공 (SRT → WebVTT 변환)
app.get('/api/subtitle/:path(*)', (req, res) => {
  const requestedPath = decodeURIComponent(req.params.path)
  const validation = validatePath(requestedPath)

  if (!validation.safe) {
    return res.status(403).json({ error: validation.error })
  }

  if (!fs.existsSync(validation.resolvedPath)) {
    return res.status(404).send('자막 파일을 찾을 수 없습니다.')
  }

  try {
    const buffer = fs.readFileSync(validation.resolvedPath)
    let srtContent = buffer.toString('utf8')

    if (srtContent.includes('�') || srtContent.includes('\ufffd')) {
      srtContent = iconv.decode(buffer, 'cp949')
    }

    const vttContent = convertSrtToVtt(srtContent)
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8')
    res.send(vttContent)
  } catch (error) {
    console.error('자막 변환 오류:', error)
    res.status(500).send('자막 변환 실패')
  }
})

// 비디오 스트리밍
app.get('/api/video/:path(*)', (req, res) => {
  const requestedPath = decodeURIComponent(req.params.path)
  const validation = validatePath(requestedPath)

  if (!validation.safe) {
    return res.status(403).json({ error: validation.error })
  }

  const videoPath = validation.resolvedPath

  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('비디오를 찾을 수 없습니다.')
  }

  if (!validateExtension(videoPath, VIDEO_FORMATS)) {
    return res.status(400).send('지원되지 않는 비디오 형식입니다.')
  }

  const stat = fs.statSync(videoPath)
  const fileSize = stat.size
  const range = req.headers.range
  const contentType = getVideoMimeType(videoPath)

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunksize = (end - start) + 1
    const file = fs.createReadStream(videoPath, { start, end })

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    })
    file.pipe(res)
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    })
    fs.createReadStream(videoPath).pipe(res)
  }
})

// 스캔 디렉토리 설정
app.post('/api/set-directory', (req, res) => {
  const { directory } = req.body

  if (!directory || typeof directory !== 'string') {
    return res.status(400).json({ error: '유효한 디렉토리를 지정해주세요.' })
  }

  if (!fs.existsSync(directory)) {
    return res.status(400).json({ error: '존재하지 않는 디렉토리입니다.' })
  }

  SCAN_DIRECTORY = directory
  videoCache = scanDirectory(SCAN_DIRECTORY)
  saveConfig({ scanDirectory: directory })

  res.json({ message: '디렉토리가 설정되었습니다.', videoCount: videoCache.length })
})

// 현재 설정된 디렉토리 조회
app.get('/api/current-directory', (req, res) => {
  res.json({ directory: SCAN_DIRECTORY })
})

// 폴더 트리 조회
app.get('/api/folder-tree', (req, res) => {
  const { directory } = req.query
  const targetDir = directory || SCAN_DIRECTORY

  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: '디렉토리를 찾을 수 없습니다.' })
  }

  const folders = getFolderTree(targetDir)
  res.json({ folders, currentDirectory: targetDir })
})

// 특정 폴더의 비디오 목록 조회
app.get('/api/videos-in-folder', (req, res) => {
  const { directory } = req.query

  if (!directory) {
    return res.status(400).json({ error: '디렉토리를 지정해주세요.' })
  }

  if (!fs.existsSync(directory)) {
    return res.status(404).json({ error: '디렉토리를 찾을 수 없습니다.' })
  }

  const videos = scanDirectory(directory)
  res.json(videos)
})

// 특정 폴더의 이미지 목록 조회
app.get('/api/images-in-folder', (req, res) => {
  const { directory } = req.query

  if (!directory) {
    return res.status(400).json({ error: '디렉토리를 지정해주세요.' })
  }

  if (!fs.existsSync(directory)) {
    return res.status(404).json({ error: '디렉토리를 찾을 수 없습니다.' })
  }

  const images = scanImages(directory)
  res.json(images)
})

// 특정 폴더의 하위 폴더 목록 조회 (썸네일 포함)
app.get('/api/folders-in-directory', (req, res) => {
  const { directory } = req.query

  if (!directory) {
    return res.status(400).json({ error: '디렉토리를 지정해주세요.' })
  }

  if (!fs.existsSync(directory)) {
    return res.status(404).json({ error: '디렉토리를 찾을 수 없습니다.' })
  }

  const folders = getFoldersWithThumbnails(directory)
  res.json(folders)
})

// 이미지 파일 제공
app.get('/api/image/:path(*)', (req, res) => {
  const requestedPath = decodeURIComponent(req.params.path)
  const validation = validatePath(requestedPath)

  if (!validation.safe) {
    return res.status(403).json({ error: validation.error })
  }

  if (!fs.existsSync(validation.resolvedPath)) {
    return res.status(404).send('이미지를 찾을 수 없습니다.')
  }

  if (!validateExtension(validation.resolvedPath, IMAGE_FORMATS)) {
    return res.status(400).send('지원되지 않는 이미지 형식입니다.')
  }

  res.sendFile(validation.resolvedPath)
})

// 외부 플레이어로 비디오 열기 (Command Injection 방어)
app.post('/api/open-video', (req, res) => {
  const { videoPath } = req.body

  if (!videoPath || typeof videoPath !== 'string') {
    return res.status(400).json({ error: '비디오 경로를 지정해주세요.' })
  }

  const validation = validatePath(videoPath)
  if (!validation.safe) {
    return res.status(403).json({ error: validation.error })
  }

  if (!fs.existsSync(validation.resolvedPath)) {
    return res.status(404).json({ error: '비디오 파일을 찾을 수 없습니다.' })
  }

  if (!validateExtension(validation.resolvedPath, VIDEO_FORMATS)) {
    return res.status(400).json({ error: '지원되지 않는 비디오 형식입니다.' })
  }

  // Command Injection 방어: spawn 사용 (shell: false)
  let command, args
  switch (process.platform) {
    case 'win32':
      command = 'cmd.exe'
      args = ['/c', 'start', '""', validation.resolvedPath]
      break
    case 'darwin':
      command = 'open'
      args = [validation.resolvedPath]
      break
    case 'linux':
      command = 'xdg-open'
      args = [validation.resolvedPath]
      break
    default:
      return res.status(500).json({ error: '지원되지 않는 OS입니다.' })
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    shell: false
  })

  child.on('error', (error) => {
    console.error('비디오 실행 오류:', error)
    return res.status(500).json({ error: '비디오 실행 실패' })
  })

  child.unref()
  res.json({ message: '비디오를 실행했습니다.' })
})

// 썸네일 캐시 통계 조회
app.get('/api/cache/stats', (req, res) => {
  const stats = getCacheStats()
  res.json(stats)
})

// 썸네일 캐시 삭제
app.delete('/api/cache/clear', (req, res) => {
  const deletedCount = clearThumbnailCache()
  res.json({
    message: '썸네일 캐시가 삭제되었습니다.',
    deletedCount
  })
})

// 헬스 체크 (Electron용)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// SPA 라우팅 - 모든 404를 index.html로 (API 제외)
if (isProduction || isElectron) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      const distPath = isElectron
        ? path.join(process.env.RESOURCES_PATH || __dirname, '..', 'dist')
        : path.join(__dirname, '..', 'dist')
      res.sendFile(path.join(distPath, 'index.html'))
    } else {
      res.status(404).json({ error: 'API not found' })
    }
  })
}

// ============================================================
// 전역 에러 핸들러
// ============================================================

app.use((err, req, res, next) => {
  console.error('서버 오류:', err)
  res.status(500).json({
    error: '서버 내부 오류가 발생했습니다.',
    message: isProduction ? undefined : err.message
  })
})

// 처리되지 않은 Promise rejection 핸들링
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

// ============================================================
// 서버 시작
// ============================================================

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT}에서 실행 중입니다.`)
  console.log(`설정 파일: ${CONFIG_PATH}`)
  console.log(`스캔 디렉토리: ${SCAN_DIRECTORY}`)
  console.log(`환경: ${isProduction ? 'Production' : 'Development'}${isElectron ? ' (Electron)' : ''}`)
  videoCache = scanDirectory(SCAN_DIRECTORY)
})
