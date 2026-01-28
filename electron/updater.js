import { app, dialog } from 'electron'
import https from 'https'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

// GitHub 저장소 설정 (실제 저장소로 변경 필요)
const GITHUB_OWNER = 'your-username'
const GITHUB_REPO = 'myflix'

/**
 * GitHub Releases에서 최신 버전 확인
 */
export async function checkForUpdates() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'MyFlix-App'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          if (res.statusCode === 404) {
            resolve({
              currentVersion: app.getVersion(),
              latestVersion: null,
              hasUpdate: false,
              message: '릴리즈를 찾을 수 없습니다.'
            })
            return
          }

          const release = JSON.parse(data)
          const latestVersion = release.tag_name?.replace('v', '')
          const currentVersion = app.getVersion()

          // exe 파일과 체크섬 파일 찾기
          const exeAsset = release.assets?.find(a => a.name.endsWith('.exe'))
          const checksumAsset = release.assets?.find(a =>
            a.name.endsWith('.sha256') || a.name.endsWith('.checksum')
          )

          resolve({
            currentVersion,
            latestVersion,
            hasUpdate: latestVersion && compareVersions(latestVersion, currentVersion) > 0,
            downloadUrl: exeAsset?.browser_download_url,
            checksumUrl: checksumAsset?.browser_download_url,
            releaseNotes: release.body,
            releaseName: release.name,
            publishedAt: release.published_at
          })
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('요청 시간 초과'))
    })
    req.end()
  })
}

/**
 * 버전 비교 (semver)
 * @returns {number} 1: a > b, -1: a < b, 0: equal
 */
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0
    if (numA > numB) return 1
    if (numA < numB) return -1
  }
  return 0
}

/**
 * 파일의 SHA256 체크섬 계산
 */
function calculateChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)

    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * URL에서 체크섬 파일 다운로드
 */
async function fetchChecksum(checksumUrl) {
  return new Promise((resolve, reject) => {
    const makeRequest = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          makeRequest(response.headers.location)
          return
        }

        let data = ''
        response.on('data', (chunk) => { data += chunk })
        response.on('end', () => {
          // 체크섬 파일 형식: "hash  filename" 또는 그냥 "hash"
          const checksum = data.trim().split(/\s+/)[0].toLowerCase()
          resolve(checksum)
        })
        response.on('error', reject)
      }).on('error', reject)
    }

    makeRequest(checksumUrl)
  })
}

/**
 * 업데이트 다운로드 및 검증
 */
export async function downloadAndInstallUpdate(downloadUrl, checksumUrl, mainWindow) {
  const tempPath = path.join(app.getPath('temp'), 'MyFlix-Update.exe')

  return new Promise((resolve, reject) => {
    mainWindow?.webContents.send('update-progress', { status: 'downloading', progress: 0 })

    const file = fs.createWriteStream(tempPath)

    const makeRequest = (url) => {
      https.get(url, (response) => {
        // 리다이렉트 처리
        if (response.statusCode === 302 || response.statusCode === 301) {
          makeRequest(response.headers.location)
          return
        }

        const totalSize = parseInt(response.headers['content-length'], 10)
        let downloadedSize = 0

        response.on('data', (chunk) => {
          downloadedSize += chunk.length
          const progress = Math.round((downloadedSize / totalSize) * 100)
          mainWindow?.webContents.send('update-progress', { status: 'downloading', progress })
        })

        response.pipe(file)

        file.on('finish', async () => {
          file.close()

          try {
            mainWindow?.webContents.send('update-progress', { status: 'verifying', progress: 100 })

            // 체크섬 검증
            if (checksumUrl) {
              const expectedChecksum = await fetchChecksum(checksumUrl)
              const actualChecksum = await calculateChecksum(tempPath)

              if (expectedChecksum !== actualChecksum) {
                fs.unlinkSync(tempPath)
                mainWindow?.webContents.send('update-progress', {
                  status: 'error',
                  error: '파일 무결성 검증 실패'
                })
                reject(new Error('체크섬 불일치: 파일이 손상되었거나 변조되었습니다.'))
                return
              }
            }

            mainWindow?.webContents.send('update-progress', { status: 'verified', progress: 100 })

            // 사용자 확인 후 설치
            const result = await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '업데이트 준비 완료',
              message: '업데이트가 다운로드되었습니다.',
              detail: '앱을 다시 시작하여 업데이트를 적용하시겠습니까?',
              buttons: ['지금 재시작', '나중에'],
              defaultId: 0,
              cancelId: 1
            })

            if (result.response === 0) {
              // 설치 실행
              spawn(tempPath, [], {
                detached: true,
                stdio: 'ignore'
              }).unref()

              app.quit()
            }

            resolve()
          } catch (error) {
            fs.unlink(tempPath, () => {})
            reject(error)
          }
        })

        file.on('error', (err) => {
          fs.unlink(tempPath, () => {})
          reject(err)
        })
      }).on('error', (err) => {
        fs.unlink(tempPath, () => {})
        reject(err)
      })
    }

    makeRequest(downloadUrl)
  })
}

/**
 * 업데이트 확인 및 알림
 */
export async function checkAndNotifyUpdate(mainWindow) {
  try {
    const updateInfo = await checkForUpdates()

    if (updateInfo.hasUpdate) {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '업데이트 가능',
        message: `새 버전이 있습니다: v${updateInfo.latestVersion}`,
        detail: `현재 버전: v${updateInfo.currentVersion}\n\n${updateInfo.releaseNotes || ''}`.slice(0, 500),
        buttons: ['지금 업데이트', '나중에'],
        defaultId: 0,
        cancelId: 1
      })

      if (result.response === 0 && updateInfo.downloadUrl) {
        await downloadAndInstallUpdate(
          updateInfo.downloadUrl,
          updateInfo.checksumUrl,
          mainWindow
        )
      }
    }

    return updateInfo
  } catch (error) {
    console.error('업데이트 확인 오류:', error)
    return { error: error.message }
  }
}
