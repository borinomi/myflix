import { useState, useEffect, useCallback, useRef } from 'react'
import { getParentDirectory } from './utils/pathUtils'
import { useMediaData } from './hooks/useMediaData'
import VideoGrid from './components/VideoGrid'
import VideoPlayer from './components/VideoPlayer'
import ImageViewer from './components/ImageViewer'
import DirectoryInput from './components/DirectoryInput'
import FolderSidebar from './components/FolderSidebar'
import PlayerModeToggle from './components/PlayerModeToggle'
import PhotoModeToggle from './components/PhotoModeToggle'
import FolderViewToggle from './components/FolderViewToggle'
import './App.css'

function App() {
  const {
    videos, setVideos,
    images, setImages,
    folders, setFolders,
    currentDirectory, setCurrentDirectory,
    loading, setLoading,
    fetchVideos, fetchImages, fetchFolders
  } = useMediaData()

  const [selectedVideo, setSelectedVideo] = useState(null)
  const [showDirectoryInput, setShowDirectoryInput] = useState(true)
  const [playerMode, setPlayerMode] = useState('browser')
  const [includePhotos, setIncludePhotos] = useState(false)
  const [showFolders, setShowFolders] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(null)

  const initialized = useRef(false)

  const fetchCurrentDirectory = useCallback(async () => {
    try {
      const response = await fetch('/api/current-directory')
      if (!response.ok) throw new Error('Failed to fetch current directory')

      const data = await response.json()
      if (data.directory) {
        setCurrentDirectory(data.directory)
        // fetchVideos는 useEffect에서 호출되거나 여기서 직접 호출
        fetchVideos(data.directory)
        setShowDirectoryInput(false)

        window.history.replaceState(
          { directory: data.directory },
          '',
          window.location.pathname + window.location.search
        )
      }
    } catch (error) {
      console.error('디렉토리 조회 실패:', error)
    }
  }, [setCurrentDirectory, fetchVideos])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true

      const savedDirectory = localStorage.getItem('defaultDirectory')

      if (savedDirectory) {
        setCurrentDirectory(savedDirectory)
        setShowDirectoryInput(false)
        fetchVideos(savedDirectory)

        fetch('/api/set-directory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ directory: savedDirectory })
        }).catch(err => console.error('디렉토리 설정 오류:', err))

        window.history.replaceState(
          { directory: savedDirectory },
          '',
          window.location.pathname + window.location.search
        )
      } else {
        fetchCurrentDirectory()
      }
    }
  }, [fetchCurrentDirectory, fetchVideos])

  const handleFolderSelect = useCallback((folderPath, skipHistory = false) => {
    setCurrentDirectory(folderPath)
    fetchVideos(folderPath)

    if (!skipHistory) {
      window.history.pushState(
        { directory: folderPath },
        '',
        window.location.pathname + window.location.search
      )
    }
  }, [fetchVideos])

  const handleClosePlayer = useCallback(() => {
    setSelectedVideo(null)
  }, [])

  const handleCloseImageViewer = useCallback(() => {
    setSelectedImageIndex(null)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      if (e.key === 'Backspace') {
        e.preventDefault()

        if (selectedImageIndex !== null) {
          handleCloseImageViewer()
        } else if (selectedVideo) {
          handleClosePlayer()
        } else if (showDirectoryInput) {
          return
        } else {
          const parent = getParentDirectory(currentDirectory)
          if (parent) {
            handleFolderSelect(parent)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentDirectory, showDirectoryInput, selectedVideo, selectedImageIndex, handleFolderSelect, handleClosePlayer, handleCloseImageViewer])

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.directory) {
        setCurrentDirectory(event.state.directory)
        setShowDirectoryInput(false)
        fetchVideos(event.state.directory)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [fetchVideos])

  useEffect(() => {
    if (currentDirectory && includePhotos) {
      fetchImages(currentDirectory)
    } else {
      setImages([])
    }
  }, [currentDirectory, includePhotos, fetchImages])

  useEffect(() => {
    if (currentDirectory && showFolders) {
      fetchFolders(currentDirectory)
    } else {
      setFolders([])
    }
  }, [currentDirectory, showFolders, fetchFolders])

  const handleDirectorySet = useCallback((directory, saveAsDefault = false) => {
    setCurrentDirectory(directory)
    setShowDirectoryInput(false)
    fetchVideos(directory)

    if (saveAsDefault) {
      localStorage.setItem('defaultDirectory', directory)
    }

    window.history.replaceState(
      { directory },
      '',
      window.location.pathname + window.location.search
    )
  }, [fetchVideos])

  const handleChangeDirectory = useCallback(() => {
    setShowDirectoryInput(true)
    setVideos([])
    setImages([])
    setFolders([])
    setSelectedVideo(null)
    setSelectedImageIndex(null)
    setSidebarOpen(false)
  }, [])

  const handleVideoSelect = useCallback(async (video) => {
    if (playerMode === 'desktop') {
      try {
        const response = await fetch('/api/open-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoPath: video.videoPath })
        })

        if (!response.ok) {
          console.error('비디오 실행 실패')
        }
      } catch (error) {
        console.error('비디오 실행 오류:', error)
      }
    } else {
      setSelectedVideo(video)
    }
  }, [playerMode])

  const handleImageSelect = useCallback((image, index) => {
    setSelectedImageIndex(index)
  }, [])

  const handlePlayerModeChange = useCallback((mode) => {
    setPlayerMode(mode)
  }, [])

  const handlePhotoModeToggle = useCallback((include) => {
    setIncludePhotos(include)
  }, [])

  const handleFolderViewToggle = useCallback((show) => {
    setShowFolders(show)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        {currentDirectory && !showDirectoryInput && (
          <button className="hamburger-button" onClick={toggleSidebar}>
            ☰
          </button>
        )}
        <h1>Myflix</h1>
        {currentDirectory && !showDirectoryInput && (
          <div className="header-controls">
            <FolderViewToggle showFolders={showFolders} onToggle={handleFolderViewToggle} />
            <PhotoModeToggle includePhotos={includePhotos} onToggle={handlePhotoModeToggle} />
            <PlayerModeToggle mode={playerMode} onModeChange={handlePlayerModeChange} />
          </div>
        )}
      </header>

      {showDirectoryInput ? (
        <main className="app-main">
          <DirectoryInput
            onDirectorySet={handleDirectorySet}
            currentDirectory={currentDirectory}
          />
        </main>
      ) : (
        <div className="app-content">
          <FolderSidebar
            currentDirectory={currentDirectory}
            onFolderSelect={handleFolderSelect}
            onChangeDirectory={handleChangeDirectory}
            isOpen={sidebarOpen}
            onClose={closeSidebar}
          />
          <main className="app-main">
            {loading ? (
              <div className="loading">로딩 중...</div>
            ) : videos.length === 0 ? (
              <div className="no-videos">
                <p>비디오를 찾을 수 없습니다.</p>
                <button onClick={handleChangeDirectory}>다른 폴더 선택</button>
              </div>
            ) : (
              <VideoGrid
                videos={videos}
                images={includePhotos ? images : []}
                folders={showFolders ? folders : []}
                onVideoSelect={handleVideoSelect}
                onImageSelect={handleImageSelect}
                onFolderSelect={handleFolderSelect}
              />
            )}
          </main>
        </div>
      )}

      {selectedVideo && playerMode === 'browser' && (
        <VideoPlayer video={selectedVideo} onClose={handleClosePlayer} />
      )}

      {selectedImageIndex !== null && (
        <ImageViewer
          images={images}
          currentIndex={selectedImageIndex}
          onClose={handleCloseImageViewer}
        />
      )}
    </div>
  )
}

export default App
