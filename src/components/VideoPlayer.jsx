import { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import './VideoPlayer.css'

function VideoPlayer({ video, onClose }) {
  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 768
    }
    setIsMobile(checkMobile())
  }, [])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  useEffect(() => {
    if (isMobile && videoRef.current) {
      videoRef.current.play().catch(err => {
        console.log('Auto-play prevented:', err)
      })
    }
  }, [video, isMobile])

  useEffect(() => {
    if (isMobile) return

    let timer = null

    if (!playerRef.current && videoRef.current) {
      timer = setTimeout(() => {
        if (!videoRef.current) return

        const player = videojs(videoRef.current, {
          controls: true,
          autoplay: true,
          preload: 'auto',
          fluid: true,
          textTrackSettings: false,
        })

        playerRef.current = player

        if (video.subtitle) {
          player.addRemoteTextTrack({
            kind: 'subtitles',
            src: `/api/subtitle/${encodeURIComponent(video.subtitle)}`,
            srclang: 'ko',
            label: '한국어',
            default: true
          }, false)

          player.ready(() => {
            setTimeout(() => {
              const button = player.controlBar.getChild('SubsCapsButton')
              if (!button) return

              setTimeout(() => {
                const button = player.controlBar.getChild('SubsCapsButton')
                if (!button) return

                import('../utils/videoJsPlugins').then(({ patchSubtitleButton }) => {
                  patchSubtitleButton(button, player)
                })
              }, 100)

            }, 100)
          })
        }
      }, 0)
    }

    return () => {
      if (timer) clearTimeout(timer)

      if (playerRef.current) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [video, isMobile])

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('video-player-overlay')) {
      onClose()
    }
  }

  if (isMobile) {
    return (
      <div className="video-player-overlay" onClick={handleBackdropClick}>
        <div className="video-player-container">
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
          <video
            ref={videoRef}
            controls
            autoPlay
            playsInline
            src={`/api/video/${encodeURIComponent(video.videoPath)}`}
            style={{ width: '100%', height: 'auto', display: 'block', backgroundColor: '#000' }}
          >
            {video.subtitle && (
              <track
                src={`/api/subtitle/${encodeURIComponent(video.subtitle)}`}
                kind="subtitles"
                label="한국어"
                srcLang="ko"
                default
              />
            )}
            비디오를 재생할 수 없습니다.
          </video>
          <div className="video-info">
            <h2>{video.name}</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="video-player-overlay" onClick={handleBackdropClick}>
      <div className="video-player-container">
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
        <div data-vjs-player>
          <video
            ref={videoRef}
            className="video-js vjs-big-play-centered"
            src={`/api/video/${encodeURIComponent(video.videoPath)}`}
          />
        </div>
        <div className="video-info">
          <h2>{video.name}</h2>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
