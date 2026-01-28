import { app, BrowserWindow, shell, ipcMain, utilityProcess } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import http from 'http'
import { checkAndNotifyUpdate, checkForUpdates } from './updater.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 개발 모드 여부
const isDev = !app.isPackaged
const PORT = 5000

let mainWindow
let serverProcess

// 로그 파일 경로
const getLogPath = () => path.join(app.getPath('userData'), 'app.log')
const log = (msg) => {
  const line = `${new Date().toISOString()} ${msg}\n`
  console.log(msg)
  try {
    fs.appendFileSync(getLogPath(), line)
  } catch (e) {}
}

// IPC 핸들러 등록
ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('check-for-updates', async () => {
  try {
    return await checkForUpdates()
  } catch (error) {
    return { error: error.message }
  }
})

/**
 * 서버 health check
 * @returns {Promise<boolean>}
 */
function checkServerHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

/**
 * 서버가 준비될 때까지 대기
 * @param {number} maxAttempts - 최대 시도 횟수
 * @param {number} interval - 시도 간격 (ms)
 */
async function waitForServer(maxAttempts = 30, interval = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    const isReady = await checkServerHealth()
    if (isReady) {
      console.log(`서버 준비 완료 (${i + 1}번째 시도)`)
      return true
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  console.error('서버 시작 시간 초과')
  return false
}

/**
 * 서버 시작
 */
function startServer() {
  // 패키징된 앱: app.getAppPath() = resources/app
  // 개발 모드: __dirname = electron/
  const serverPath = isDev
    ? path.join(__dirname, '..', 'server', 'index.js')
    : path.join(app.getAppPath(), 'server', 'index.js')

  log(`서버 경로: ${serverPath}`)
  log(`app.getAppPath(): ${app.getAppPath()}`)
  log(`process.resourcesPath: ${process.resourcesPath}`)

  if (!fs.existsSync(serverPath)) {
    log(`서버 파일을 찾을 수 없습니다: ${serverPath}`)
    return null
  }

  const env = {
    ...process.env,
    NODE_ENV: isDev ? 'development' : 'production',
    ELECTRON_APP_PATH: app.getAppPath(),
    // app.getAppPath() = resources/app (asar: false)
    // process.resourcesPath = resources (extraResources 위치)
    APP_PATH: app.getAppPath(),
    RESOURCES_PATH: process.resourcesPath
  }

  log(`환경변수 APP_PATH: ${env.APP_PATH}`)
  log(`환경변수 RESOURCES_PATH: ${env.RESOURCES_PATH}`)

  // utilityProcess.fork 사용 (Electron 공식 API)
  try {
    serverProcess = utilityProcess.fork(serverPath, [], {
      env,
      stdio: 'pipe',
      serviceName: 'MyFlix-Server'
    })

    serverProcess.stdout?.on('data', (data) => {
      log(`[Server] ${data.toString().trim()}`)
    })

    serverProcess.stderr?.on('data', (data) => {
      log(`[Server Error] ${data.toString().trim()}`)
    })

    serverProcess.on('exit', (code) => {
      log(`서버 프로세스 종료: ${code}`)
      serverProcess = null
    })

    log('서버 프로세스 시작됨')
    return serverProcess
  } catch (error) {
    log(`서버 시작 오류: ${error.message}`)
    return null
  }
}

/**
 * 메인 윈도우 생성
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    show: false,
    backgroundColor: '#141414'
  })

  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadURL(`http://localhost:${PORT}`)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()

    // 프로덕션에서 앱 시작 5초 후 업데이트 확인
    if (!isDev) {
      setTimeout(() => {
        checkAndNotifyUpdate(mainWindow).catch(console.error)
      }, 5000)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * 앱 초기화
 */
async function initialize() {
  // 서버 시작
  startServer()

  // 서버가 준비될 때까지 대기
  const serverReady = await waitForServer()

  if (!serverReady && !isDev) {
    const { dialog } = await import('electron')
    dialog.showErrorBox('서버 오류', '서버를 시작할 수 없습니다. 앱을 다시 시작해주세요.')
    app.quit()
    return
  }

  createWindow()
}

// 앱 준비 완료
app.whenReady().then(() => {
  initialize()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      initialize()
    }
  })
})

// 모든 윈도우 닫힘
app.on('window-all-closed', () => {
  if (serverProcess) {
    try { serverProcess.kill() } catch (e) { log(`서버 종료 오류: ${e.message}`) }
    serverProcess = null
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 앱 종료 전
app.on('before-quit', () => {
  if (serverProcess) {
    try { serverProcess.kill() } catch (e) { log(`서버 종료 오류: ${e.message}`) }
    serverProcess = null
  }
})

// 두 번째 인스턴스 방지
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
