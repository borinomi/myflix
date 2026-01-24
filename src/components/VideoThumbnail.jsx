import { useState, useEffect, useRef } from 'react'
import './VideoThumbnail.css'

function VideoThumbnail({ video, onSelect }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const thumbnailRef = useRef(null)
  const hasThumbnail = video.thumbnail !== null

  useEffect(() => {
    // 썸네일이 없으면 바로 로드 완료 처리
    if (!hasThumbnail) {
      setImageLoaded(true)
      setIsVisible(true)
      return
    }

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

    if (thumbnailRef.current) {
      observer.observe(thumbnailRef.current)
    }

    return () => {
      if (thumbnailRef.current) {
        observer.unobserve(thumbnailRef.current)
      }
    }
  }, [hasThumbnail])

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const handleClick = () => {
    onSelect(video)
  }

  return (
    <div
      ref={thumbnailRef}
      className="video-thumbnail"
      onClick={handleClick}
    >
      <div className={`thumbnail-image ${imageLoaded ? 'loaded' : ''} ${!hasThumbnail ? 'no-thumbnail' : ''}`}>
        {!imageLoaded && <div className="skeleton" />}
        {hasThumbnail && isVisible ? (
          <img
            src={`/api/thumbnail/${encodeURIComponent(video.thumbnail)}`}
            alt={video.name}
            onLoad={handleImageLoad}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        ) : !hasThumbnail ? (
          <div className="default-thumbnail">
            <div className="video-icon">▶</div>
          </div>
        ) : null}
      </div>
      <div className="thumbnail-info">
        <p className="video-name">{video.name}</p>
      </div>
    </div>
  )
}

export default VideoThumbnail
