import './PhotoModeToggle.css'

function PhotoModeToggle({ includePhotos, onToggle }) {
  return (
    <div className="photo-mode-toggle">
      <label className="toggle-label">사진:</label>
      <div className="toggle-buttons">
        <button
          className={`toggle-btn ${!includePhotos ? 'active' : ''}`}
          onClick={() => onToggle(false)}
        >
          미포함
        </button>
        <button
          className={`toggle-btn ${includePhotos ? 'active' : ''}`}
          onClick={() => onToggle(true)}
        >
          포함
        </button>
      </div>
    </div>
  )
}

export default PhotoModeToggle
