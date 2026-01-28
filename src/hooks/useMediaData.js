import { useState, useCallback, useRef } from 'react'

export function useMediaData() {
  const [videos, setVideos] = useState([])
  const [images, setImages] = useState([])
  const [folders, setFolders] = useState([])
  const [currentDirectory, setCurrentDirectory] = useState(null)
  const [loading, setLoading] = useState(false)

  // AbortController refs for cancellation
  const videoAbortRef = useRef(null)
  const imageAbortRef = useRef(null)
  const folderAbortRef = useRef(null)

  const fetchVideos = useCallback(async (directory) => {
    // 이전 요청 취소
    if (videoAbortRef.current) {
      videoAbortRef.current.abort()
    }
    videoAbortRef.current = new AbortController()

    setLoading(true)

    try {
      const targetDir = directory || currentDirectory
      if (!targetDir && !directory) {
        setLoading(false)
        return
      }

      const response = await fetch(
        `/api/videos-in-folder?directory=${encodeURIComponent(targetDir)}`,
        { signal: videoAbortRef.current.signal }
      )

      if (!response.ok) throw new Error('Failed to fetch videos')

      const data = await response.json()
      setVideos(data)
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('비디오 목록 로딩 실패:', error)
        setVideos([])
      }
    } finally {
      setLoading(false)
    }
  }, [currentDirectory])

  const fetchImages = useCallback(async (directory) => {
    // 이전 요청 취소
    if (imageAbortRef.current) {
      imageAbortRef.current.abort()
    }
    imageAbortRef.current = new AbortController()

    try {
      const targetDir = directory || currentDirectory
      if (!targetDir && !directory) return

      const response = await fetch(
        `/api/images-in-folder?directory=${encodeURIComponent(targetDir)}`,
        { signal: imageAbortRef.current.signal }
      )

      if (!response.ok) throw new Error('Failed to fetch images')

      const data = await response.json()
      setImages(data)
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('이미지 목록 로딩 실패:', error)
        setImages([])
      }
    }
  }, [currentDirectory])

  const fetchFolders = useCallback(async (directory) => {
    // 이전 요청 취소
    if (folderAbortRef.current) {
      folderAbortRef.current.abort()
    }
    folderAbortRef.current = new AbortController()

    try {
      const targetDir = directory || currentDirectory
      if (!targetDir && !directory) return

      const response = await fetch(
        `/api/folders-in-directory?directory=${encodeURIComponent(targetDir)}`,
        { signal: folderAbortRef.current.signal }
      )

      if (!response.ok) throw new Error('Failed to fetch folders')

      const data = await response.json()
      setFolders(data)
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('폴더 목록 로딩 실패:', error)
        setFolders([])
      }
    }
  }, [currentDirectory])

  return {
    videos,
    setVideos,
    images,
    setImages,
    folders,
    setFolders,
    currentDirectory,
    setCurrentDirectory,
    loading,
    setLoading,
    fetchVideos,
    fetchImages,
    fetchFolders
  }
}
