import { useState, useEffect, useRef } from 'react'
import './FolderThumbnail.css'

function FolderThumbnail({ folder, onSelect }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const thumbnailRef = useRef(null)
  const hasThumbnail = folder.thumbnail !== null

  useEffect(() => {
    // 썸네일이 없으면 바로 로드 완료 처리
    if (!hasThumbnail) {
      setImageLoaded(true)
      setIsVisible(true)
      return
    }

    const node = thumbnailRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px'
      }
    )

    observer.observe(node)

    return () => {
      observer.unobserve(node)
    }
  }, [hasThumbnail])

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const handleClick = () => {
    onSelect(folder.path)
  }

  return (
    <div
      ref={thumbnailRef}
      className="folder-thumbnail"
      onClick={handleClick}
    >
      <div className={`thumbnail-image ${imageLoaded ? 'loaded' : ''} ${!hasThumbnail ? 'no-thumbnail' : ''}`}>
        {!imageLoaded && <div className="skeleton" />}
        {hasThumbnail && isVisible ? (
          <img
            src={`/api/thumbnail/${encodeURIComponent(folder.thumbnail)}`}
            alt={folder.name}
            onLoad={handleImageLoad}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        ) : !hasThumbnail ? (
          <div className="default-thumbnail">
            <div className="folder-icon-large">📁</div>
          </div>
        ) : null}
        <div className="folder-badge">
          <span className="folder-badge-icon">📁</span>
        </div>
      </div>
      <div className="thumbnail-info">
        <p className="folder-name">{folder.name}</p>
      </div>
    </div>
  )
}

export default FolderThumbnail
