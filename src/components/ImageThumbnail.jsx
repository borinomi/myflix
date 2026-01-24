import { useState, useEffect, useRef } from 'react'
import './VideoThumbnail.css'

function ImageThumbnail({ image, index, onSelect }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const thumbnailRef = useRef(null)

  useEffect(() => {
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
  }, [])

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const handleClick = () => {
    onSelect(image, index)
  }

  return (
    <div
      ref={thumbnailRef}
      className="video-thumbnail"
      onClick={handleClick}
    >
      <div className={`thumbnail-image ${imageLoaded ? 'loaded' : ''}`}>
        {!imageLoaded && <div className="skeleton" />}
        {isVisible && (
          <img
            src={`/api/image/${encodeURIComponent(image.imagePath)}`}
            alt={image.name}
            onLoad={handleImageLoad}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        )}
      </div>
      <div className="thumbnail-info">
        <p className="video-name">{image.fileName}</p>
      </div>
    </div>
  )
}

export default ImageThumbnail
