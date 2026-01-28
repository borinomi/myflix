import fs from 'fs'
import path from 'path'
import { VIDEO_FORMATS, IMAGE_FORMATS } from '../constants/mediaFormats.js'

// 비디오 파일 스캔
export function scanDirectory(directory) {
    const videos = []

    try {
        if (!fs.existsSync(directory)) {
            console.log(`디렉토리가 존재하지 않습니다: ${directory}`)
            return videos
        }

        const files = fs.readdirSync(directory)
        const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase()
            return VIDEO_FORMATS.includes(ext)
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

// 이미지 파일 스캔 (비디오 섬네일 제외)
export function scanImages(directory) {
    const images = []

    try {
        if (!fs.existsSync(directory)) {
            return images
        }

        const files = fs.readdirSync(directory)

        // 비디오 파일 이름 목록 (섬네일 제외용)
        const videoNames = new Set()
        files.forEach(file => {
            const ext = path.extname(file).toLowerCase()
            if (VIDEO_FORMATS.includes(ext)) {
                const baseName = path.basename(file, ext)
                videoNames.add(baseName)
            }
        })

        // 이미지 파일 필터링 (비디오 섬네일 제외)
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase()
            if (!IMAGE_FORMATS.includes(ext)) return false

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

// 폴더 트리 스캔 (하위 폴더만)
export function getFolderTree(directory) {
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

// 폴더 목록 스캔 (썸네일 포함)
export function getFoldersWithThumbnails(directory) {
    const folders = []

    try {
        if (!fs.existsSync(directory)) {
            return folders
        }

        const items = fs.readdirSync(directory, { withFileTypes: true })

        items.forEach(item => {
            if (item.isDirectory()) {
                const fullPath = path.join(directory, item.name)

                // 폴더 내 첫 번째 파일의 썸네일 찾기
                let thumbnail = null
                try {
                    const subItems = fs.readdirSync(fullPath)

                    // 첫 번째 비디오 파일 찾기
                    const firstVideoFile = subItems.find(file => {
                        const ext = path.extname(file).toLowerCase()
                        return VIDEO_FORMATS.includes(ext)
                    })

                    if (firstVideoFile) {
                        const videoBaseName = path.basename(firstVideoFile, path.extname(firstVideoFile))

                        // 해당 비디오의 썸네일 이미지 찾기
                        const thumbnailFile = subItems.find(file => {
                            const fileExt = path.extname(file).toLowerCase()
                            const name = path.basename(file, fileExt)
                            return IMAGE_FORMATS.includes(fileExt) && name === videoBaseName
                        })

                        if (thumbnailFile) {
                            thumbnail = path.join(fullPath, thumbnailFile)
                        }
                    }
                } catch (err) {
                    console.error(`폴더 내부 스캔 오류 (${item.name}):`, err)
                }

                folders.push({
                    name: item.name,
                    path: fullPath,
                    thumbnail
                })
            }
        })

        folders.sort((a, b) => a.name.localeCompare(b.name))
    } catch (error) {
        console.error('폴더 스캔 오류:', error)
    }

    return folders
}
