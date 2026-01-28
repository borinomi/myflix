import { app, BrowserWindow, shell, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
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
  const serverPath = isDev
    ? path.join(__dirname, '..', 'server', 'index.js')
    : path.join(process.resourcesPath, 'server', 'index.js')

  console.log('서버 경로:', serverPath)

  if (!fs.existsSync(serverPath)) {
    console.error('서버 파일을 찾을 수 없습니다:', serverPath)
    return null
  }

  const env = {
    ...process.env,
    NODE_ENV: isDev ? 'development' : 'production',
    ELECTRON_APP_PATH: app.getAppPath(),
    RESOURCES_PATH: process.resourcesPath || path.join(__dirname, '..')
  }

  serverProcess = spawn('node', [serverPath], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true
  })

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data.toString().trim()}`)
  })

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error] ${data.toString().trim()}`)
  })

  serverProcess.on('close', (code) => {
    console.log(`서버 프로세스 종료: ${code}`)
    serverProcess = null
  })

  serverProcess.on('error', (error) => {
    console.error('서버 시작 오류:', error)
  })

  return serverProcess
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
    serverProcess.kill()
    serverProcess = null
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 앱 종료 전
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill()
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
