import { useEffect, useState, useRef } from 'react'
import './ImageViewer.css'

function ImageViewer({ images, currentIndex, onClose }) {
  const [index, setIndex] = useState(currentIndex)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  useEffect(() => {
    setIndex(currentIndex)
  }, [currentIndex])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrevious()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [index, images.length])

  const handlePrevious = () => {
    setIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNext = () => {
    setIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('image-viewer-overlay')) {
      onClose()
    }
  }

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const swipeThreshold = 50 // 최소 스와이프 거리 (픽셀)
    const swipeDistance = touchStartX.current - touchEndX.current

    if (Math.abs(swipeDistance) > swipeThreshold) {
      if (swipeDistance > 0) {
        // 왼쪽으로 스와이프 -> 다음 이미지
        handleNext()
      } else {
        // 오른쪽으로 스와이프 -> 이전 이미지
        handlePrevious()
      }
    }

    // 초기화
    touchStartX.current = 0
    touchEndX.current = 0
  }

  if (!images || images.length === 0 || index < 0 || index >= images.length) {
    return null
  }

  const currentImage = images[index]

  return (
    <div className="image-viewer-overlay" onClick={handleBackdropClick}>
      <button className="close-button" onClick={onClose}>
        ✕
      </button>

      {images.length > 1 && (
        <>
          <button className="nav-button prev" onClick={handlePrevious}>
            ‹
          </button>
          <button className="nav-button next" onClick={handleNext}>
            ›
          </button>
        </>
      )}

      <div
        className="image-container"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={`/api/image/${encodeURIComponent(currentImage.imagePath)}`}
          alt={currentImage.name}
        />
        <div className="image-info">
          <p className="image-name">{currentImage.fileName}</p>
          <p className="image-counter">
            {index + 1} / {images.length}
          </p>
        </div>
      </div>
    </div>
  )
}

export default ImageViewer
