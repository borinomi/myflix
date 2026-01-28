import VideoThumbnail from './VideoThumbnail'
import ImageThumbnail from './ImageThumbnail'
import FolderThumbnail from './FolderThumbnail'
import './VideoGrid.css'

function VideoGrid({ videos, images = [], folders = [], onVideoSelect, onImageSelect, onFolderSelect }) {
  // 폴더, 비디오, 이미지를 합쳐서 표시
  const items = [
    ...folders.map(f => ({ type: 'folder', data: f })),
    ...videos.map(v => ({ type: 'video', data: v })),
    ...images.map((img, idx) => ({ type: 'image', data: img, index: idx }))
  ]

  return (
    <div className="video-grid">
      {items.map((item, index) => {
        if (item.type === 'folder') {
          return (
            <FolderThumbnail
              key={`folder-${item.data.path || index}`}
              folder={item.data}
              onSelect={onFolderSelect}
            />
          )
        } else if (item.type === 'video') {
          return (
            <VideoThumbnail
              key={`video-${item.data.videoPath || index}`}
              video={item.data}
              onSelect={onVideoSelect}
            />
          )
        } else {
          return (
            <ImageThumbnail
              key={`image-${item.data.imagePath || index}`}
              image={item.data}
              index={item.index}
              onSelect={onImageSelect}
            />
          )
        }
      })}
    </div>
  )
}

export default VideoGrid
