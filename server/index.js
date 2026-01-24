import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import iconv from 'iconv-lite'
import { VIDEO_FORMATS, IMAGE_FORMATS } from './constants/mediaFormats.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 5000

// config.json 파일 경로
const CONFIG_PATH = path.join(__dirname, '..', 'config.json')

// 기본 설정
const DEFAULT_CONFIG = {
  scanDirectory: path.join(__dirname, '..', 'media')
}

// 설정 로드 함수
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

// 설정 저장 함수
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
    console.log('설정이 저장되었습니다:', CONFIG_PATH)
  } catch (error) {
    console.error('설정 파일 저장 오류:', error)
  }
}

// 미들웨어
app.use(cors())
app.use(express.json())

// 설정 로드
const config = loadConfig()

// 스캔할 폴더 경로 (사용자가 설정)
let SCAN_DIRECTORY = config.scanDirectory

// 비디오 목록 캐시
let videoCache = []

// 파일 스캔 함수
function scanDirectory(directory) {
  const videos = []
  // VIDEO_FORMATS and IMAGE_FORMATS imported from ./constants/mediaFormats.js
  const supportedFormats = VIDEO_FORMATS

  try {
    if (!fs.existsSync(directory)) {
      console.log(`디렉토리가 존재하지 않습니다: ${directory}`)
      return videos
    }

    const files = fs.readdirSync(directory)
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase()
      return supportedFormats.includes(ext)
    })

    videoFiles.forEach(videoFile => {
      const ext = path.extname(videoFile)
      const baseName = path.basename(videoFile, ext)

      const thumbnailFile = files.find(file => {
        const fileExt = path.extname(file).toLowerCase()
        const name = path.basename(file, fileExt)
        return IMAGE_FORMATS.includes(fileExt) && name === baseName
      })

      const subtitleFile = files.find(file => {
        const fileExt = path.extname(file).toLowerCase()
        const name = path.basename(file, fileExt)
        return fileExt === '.srt' && name === baseName
      })

      videos.push({
        name: baseName,
        videoPath: path.join(directory, videoFile),
        thumbnail: thumbnailFile ? path.join(directory, thumbnailFile) : null,
        subtitle: subtitleFile ? path.join(directory, subtitleFile) : null
      })
    })

    console.log(`${videos.length}개의 비디오를 찾았습니다.`)
  } catch (error) {
    console.error('디렉토리 스캔 오류:', error)
  }

  return videos
}

// 이미지 파일 스캔 함수 (비디오 섬네일 제외)
function scanImages(directory) {
  const images = []
  const imageFormats = IMAGE_FORMATS
  const videoFormats = VIDEO_FORMATS

  try {
    if (!fs.existsSync(directory)) {
      return images
    }

    const files = fs.readdirSync(directory)

    // 비디오 파일 이름 목록 (섬네일 제외용)
    const videoNames = new Set()
    files.forEach(file => {
      const ext = path.extname(file).toLowerCase()
      if (videoFormats.includes(ext)) {
        const baseName = path.basename(file, ext)
        videoNames.add(baseName)
      }
    })

    // 이미지 파일 필터링 (비디오 섬네일 제외)
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase()
      if (!imageFormats.includes(ext)) return false

      const baseName = path.basename(file, ext)
      // 비디오와 같은 이름이면 섬네일이므로 제외
      return !videoNames.has(baseName)
    })

    imageFiles.forEach(imageFile => {
      const ext = path.extname(imageFile)
      const baseName = path.basename(imageFile, ext)

      images.push({
        name: baseName,
        imagePath: path.join(directory, imageFile),
        fileName: imageFile
      })
    })

    console.log(`${images.length}개의 독립 이미지를 찾았습니다.`)
  } catch (error) {
    console.error('이미지 스캔 오류:', error)
  }

  return images
}

// 폴더 트리 스캔 함수 (하위 폴더만)
function getFolderTree(directory) {
  const folders = []

  try {
    if (!fs.existsSync(directory)) {
      return folders
    }

    const items = fs.readdirSync(directory, { withFileTypes: true })

    items.forEach(item => {
      if (item.isDirectory()) {
        const fullPath = path.join(directory, item.name)
        folders.push({
          name: item.name,
          path: fullPath
        })
      }
    })

    folders.sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('폴더 트리 스캔 오류:', error)
  }

  return folders
}

// SRT를 WebVTT로 변환하는 함수
function convertSrtToVtt(srtContent) {
  // SRT 포맷을 WebVTT로 변환
  let vttContent = 'WEBVTT\n\n'

  // 줄바꿈 정규화 (Windows/Linux/Mac 모두 지원)
  srtContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // SRT 자막 블록 분리
  const blocks = srtContent.trim().split('\n\n')

  blocks.forEach(block => {
    const lines = block.split('\n')

    // 첫 번째 줄은 번호이므로 제거
    if (lines.length >= 2) {
      const timeLine = lines[1]
      const textLines = lines.slice(2)

      // 타임스탬프의 쉼표를 마침표로 변경 (00:00:01,000 → 00:00:01.000)
      const vttTimeLine = timeLine.replace(/,/g, '.')

      vttContent += vttTimeLine + '\n'
      vttContent += textLines.join('\n') + '\n\n'
    }
  })

  return vttContent
}

// API 엔드포인트

// 비디오 목록 조회
app.get('/api/videos', (req, res) => {
  videoCache = scanDirectory(SCAN_DIRECTORY)
  res.json(videoCache)
})

// 섬네일 이미지 제공
app.get('/api/thumbnail/:path(*)', (req, res) => {
  const thumbnailPath = decodeURIComponent(req.params.path)

  if (!fs.existsSync(thumbnailPath)) {
    return res.status(404).send('섬네일을 찾을 수 없습니다.')
  }

  res.sendFile(thumbnailPath)
})

// 자막 파일 제공 (SRT → WebVTT 변환)
app.get('/api/subtitle/:path(*)', (req, res) => {
  const subtitlePath = decodeURIComponent(req.params.path)

  if (!fs.existsSync(subtitlePath)) {
    return res.status(404).send('자막 파일을 찾을 수 없습니다.')
  }

  try {
    // Buffer로 파일을 읽어서 인코딩 처리
    const buffer = fs.readFileSync(subtitlePath)
    let srtContent = buffer.toString('utf8')

    // UTF-8 디코딩이 실패했는지 확인 (replacement character가 있으면 실패)
    if (srtContent.includes('�') || srtContent.includes('\ufffd')) {
      // CP949(EUC-KR 상위 호환)로 디코딩
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
  const videoPath = decodeURIComponent(req.params.path)

  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('비디오를 찾을 수 없습니다.')
  }

  const stat = fs.statSync(videoPath)
  const fileSize = stat.size
  const range = req.headers.range

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunksize = (end - start) + 1
    const file = fs.createReadStream(videoPath, { start, end })

    // 확장자별 MIME 타입 매핑
    const ext = path.extname(videoPath).toLowerCase()
    let contentType = 'video/mp4'
    if (ext === '.mkv') contentType = 'video/x-matroska'
    else if (ext === '.webm') contentType = 'video/webm'
    else if (ext === '.avi') contentType = 'video/x-msvideo'
    else if (ext === '.mov') contentType = 'video/quicktime'
    else if (ext === '.flv') contentType = 'video/x-flv'
    else if (ext === '.wmv') contentType = 'video/x-ms-wmv'

    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    }
    res.writeHead(206, head)
    file.pipe(res)
  } else {
    // 확장자별 MIME 타입 매핑 (중복 로직이지만 간단히 인라인 처리)
    const ext = path.extname(videoPath).toLowerCase()
    let contentType = 'video/mp4'
    if (ext === '.mkv') contentType = 'video/x-matroska'
    else if (ext === '.webm') contentType = 'video/webm'
    else if (ext === '.avi') contentType = 'video/x-msvideo'
    else if (ext === '.mov') contentType = 'video/quicktime'
    else if (ext === '.flv') contentType = 'video/x-flv'
    else if (ext === '.wmv') contentType = 'video/x-ms-wmv'

    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    }
    res.writeHead(200, head)
    fs.createReadStream(videoPath).pipe(res)
  }
})

// 스캔 디렉토리 설정
app.post('/api/set-directory', (req, res) => {
  const { directory } = req.body

  if (!fs.existsSync(directory)) {
    return res.status(400).json({ error: '존재하지 않는 디렉토리입니다.' })
  }

  SCAN_DIRECTORY = directory
  videoCache = scanDirectory(SCAN_DIRECTORY)

  // config.json에 저장
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

// 이미지 파일 제공
app.get('/api/image/:path(*)', (req, res) => {
  const imagePath = decodeURIComponent(req.params.path)

  if (!fs.existsSync(imagePath)) {
    return res.status(404).send('이미지를 찾을 수 없습니다.')
  }

  res.sendFile(imagePath)
})

// 외부 플레이어로 비디오 열기
app.post('/api/open-video', (req, res) => {
  const { videoPath } = req.body

  if (!videoPath) {
    return res.status(400).json({ error: '비디오 경로를 지정해주세요.' })
  }

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: '비디오 파일을 찾을 수 없습니다.' })
  }

  // Windows에서 기본 프로그램으로 열기
  exec(`start "" "${videoPath}"`, (error) => {
    if (error) {
      console.error('비디오 실행 오류:', error)
      return res.status(500).json({ error: '비디오 실행 실패' })
    }
    res.json({ message: '비디오를 실행했습니다.' })
  })
})

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT}에서 실행 중입니다.`)
  console.log(`설정 파일: ${CONFIG_PATH}`)
  console.log(`스캔 디렉토리: ${SCAN_DIRECTORY}`)
  videoCache = scanDirectory(SCAN_DIRECTORY)
})
