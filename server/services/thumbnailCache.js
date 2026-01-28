import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { IMAGE_FORMATS } from '../constants/mediaFormats.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// FFmpeg 경로 설정
function setupFfmpegPath() {
  const possiblePaths = []

  // 1. Electron 패키지된 앱 - extraResources 경로
  if (process.env.RESOURCES_PATH) {
    possiblePaths.push(path.join(process.env.RESOURCES_PATH, 'ffmpeg', 'ffmpeg.exe'))
  }

  // 2. 개발 모드 - node_modules/ffmpeg-static
  possiblePaths.push(path.join(__dirname, '..', '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'))

  // 3. Windows 시스템 경로
  possiblePaths.push('C:\\ffmpeg\\bin\\ffmpeg.exe')
  possiblePaths.push('C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe')
  if (process.env.LOCALAPPDATA) {
    possiblePaths.push(path.join(process.env.LOCALAPPDATA, 'ffmpeg', 'bin', 'ffmpeg.exe'))
  }

  // 첫 번째로 존재하는 경로 사용
  for (const ffmpegPath of possiblePaths) {
    if (fs.existsSync(ffmpegPath)) {
      ffmpeg.setFfmpegPath(ffmpegPath)
      console.log('FFmpeg path:', ffmpegPath)
      return true
    }
  }

  console.log('FFmpeg: 경로를 찾지 못함. 시스템 PATH 사용 시도')
  return false
}

// 초기화 시 FFmpeg 경로 설정
setupFfmpegPath()

// Thumbnail cache directory
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'thumbnails')
const THUMBNAIL_WIDTH = 320
const THUMBNAIL_HEIGHT = 180

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
}

/**
 * Generate MD5 hash from video file path
 * @param {string} videoPath - Absolute path to video file
 * @returns {string} MD5 hash
 */
function generateCacheKey(videoPath) {
  return crypto.createHash('md5').update(videoPath).digest('hex')
}

/**
 * Get cache file path for a video
 * @param {string} videoPath - Absolute path to video file
 * @returns {string} Cache file path
 */
function getCachePath(videoPath) {
  const cacheKey = generateCacheKey(videoPath)
  return path.join(CACHE_DIR, `${cacheKey}.jpg`)
}

/**
 * Check if thumbnail exists in cache
 * @param {string} videoPath - Absolute path to video file
 * @returns {string|null} Cache file path if exists, null otherwise
 */
export function getThumbnailFromCache(videoPath) {
  const cachePath = getCachePath(videoPath)

  if (fs.existsSync(cachePath)) {
    return cachePath
  }

  return null
}

/**
 * Find manual thumbnail (image with same base name as video)
 * @param {string} videoPath - Absolute path to video file
 * @returns {string|null} Manual thumbnail path if exists, null otherwise
 */
function findManualThumbnail(videoPath) {
  const videoDir = path.dirname(videoPath)
  const videoExt = path.extname(videoPath)
  const baseName = path.basename(videoPath, videoExt)

  try {
    const files = fs.readdirSync(videoDir)

    for (const file of files) {
      const fileExt = path.extname(file).toLowerCase()
      const fileName = path.basename(file, fileExt)

      if (IMAGE_FORMATS.includes(fileExt) && fileName === baseName) {
        return path.join(videoDir, file)
      }
    }
  } catch (error) {
    console.error('Error finding manual thumbnail:', error)
  }

  return null
}

/**
 * Resize and save image to cache
 * @param {string} imagePath - Source image path
 * @param {string} videoPath - Video path (for cache key)
 * @returns {Promise<string>} Cache file path
 */
async function resizeAndCacheImage(imagePath, videoPath) {
  const cachePath = getCachePath(videoPath)

  await sharp(imagePath)
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 85 })
    .toFile(cachePath)

  return cachePath
}

/**
 * Check if frame is mostly black
 * @param {Buffer} frameBuffer - Image buffer
 * @returns {Promise<boolean>} True if frame is mostly black
 */
async function isBlackFrame(frameBuffer) {
  try {
    const { data, info } = await sharp(frameBuffer).raw().toBuffer({ resolveWithObject: true })

    // Calculate average brightness
    let totalBrightness = 0
    const pixelCount = info.width * info.height

    for (let i = 0; i < data.length; i += info.channels) {
      // Convert RGB to grayscale using luminance formula
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b
      totalBrightness += brightness
    }

    const averageBrightness = totalBrightness / pixelCount

    // Consider frame black if average brightness is below 30 (out of 255)
    return averageBrightness < 30
  } catch (error) {
    console.error('Error checking if frame is black:', error)
    return false
  }
}

/**
 * Extract thumbnail from video using ffmpeg
 * @param {string} videoPath - Absolute path to video file
 * @returns {Promise<string>} Cache file path
 */
async function extractThumbnailFromVideo(videoPath) {
  const cachePath = getCachePath(videoPath)
  const tempDir = path.join(CACHE_DIR, 'temp')

  // Create temp directory
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  const timestamp = Date.now()
  const filenamePrefix = `temp_${timestamp}`

  return new Promise((resolve, reject) => {
    // Extract first few frames (within 5 seconds)
    ffmpeg(videoPath)
      .screenshots({
        count: 5,
        timemarks: ['0.5', '1', '2', '3', '5'],
        folder: tempDir,
        filename: `${filenamePrefix}_%i.jpg`,
        size: `${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}`
      })
      .on('end', async () => {
        try {
          // Get all extracted frames
          const tempFiles = fs.readdirSync(tempDir)
            .filter(file => file.startsWith(filenamePrefix))
            .sort()

          if (tempFiles.length === 0) {
            throw new Error('No frames extracted')
          }

          let selectedFrame = null

          // Find first non-black frame
          for (const tempFile of tempFiles) {
            const tempPath = path.join(tempDir, tempFile)
            const frameBuffer = fs.readFileSync(tempPath)

            const isBlack = await isBlackFrame(frameBuffer)

            if (!isBlack) {
              selectedFrame = tempPath
              break
            }
          }

          // If all frames are black, use the second frame
          if (!selectedFrame && tempFiles.length >= 2) {
            selectedFrame = path.join(tempDir, tempFiles[1])
          } else if (!selectedFrame) {
            selectedFrame = path.join(tempDir, tempFiles[0])
          }

          // Move selected frame to cache
          fs.copyFileSync(selectedFrame, cachePath)

          // Clean up temp files
          tempFiles.forEach(tempFile => {
            try {
              fs.unlinkSync(path.join(tempDir, tempFile))
            } catch (err) {
              console.error('Error deleting temp file:', err)
            }
          })

          resolve(cachePath)
        } catch (error) {
          reject(error)
        }
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err)
        reject(err)
      })
  })
}

/**
 * Generate thumbnail for video
 * Priority: Cache > Manual thumbnail > FFmpeg extraction
 * @param {string} videoPath - Absolute path to video file
 * @returns {Promise<string>} Thumbnail file path
 */
export async function generateThumbnail(videoPath) {
  try {
    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found')
    }

    // 1. Check cache first
    const cachedThumbnail = getThumbnailFromCache(videoPath)
    if (cachedThumbnail) {
      console.log(`Thumbnail found in cache: ${videoPath}`)
      return cachedThumbnail
    }

    // 2. Check for manual thumbnail
    const manualThumbnail = findManualThumbnail(videoPath)
    if (manualThumbnail) {
      console.log(`Manual thumbnail found: ${manualThumbnail}`)
      const cachePath = await resizeAndCacheImage(manualThumbnail, videoPath)
      console.log(`Manual thumbnail cached: ${cachePath}`)
      return cachePath
    }

    // 3. Extract from video using FFmpeg
    console.log(`Extracting thumbnail from video: ${videoPath}`)
    const cachePath = await extractThumbnailFromVideo(videoPath)
    console.log(`Thumbnail extracted and cached: ${cachePath}`)
    return cachePath

  } catch (error) {
    console.error('Error generating thumbnail:', error)
    throw error
  }
}

/**
 * Clear all cached thumbnails
 * @returns {number} Number of deleted files
 */
export function clearThumbnailCache() {
  let deletedCount = 0

  try {
    const files = fs.readdirSync(CACHE_DIR)

    files.forEach(file => {
      const filePath = path.join(CACHE_DIR, file)
      const stat = fs.statSync(filePath)

      if (stat.isFile()) {
        fs.unlinkSync(filePath)
        deletedCount++
      }
    })

    console.log(`Cleared ${deletedCount} cached thumbnails`)
  } catch (error) {
    console.error('Error clearing thumbnail cache:', error)
  }

  return deletedCount
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
export function getCacheStats() {
  try {
    const files = fs.readdirSync(CACHE_DIR)
    let totalSize = 0
    let fileCount = 0

    files.forEach(file => {
      const filePath = path.join(CACHE_DIR, file)
      const stat = fs.statSync(filePath)

      if (stat.isFile()) {
        totalSize += stat.size
        fileCount++
      }
    })

    return {
      fileCount,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      cacheDir: CACHE_DIR
    }
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return {
      fileCount: 0,
      totalSize: 0,
      totalSizeMB: '0.00',
      cacheDir: CACHE_DIR
    }
  }
}
