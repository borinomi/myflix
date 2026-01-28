import './FolderViewToggle.css'

function FolderViewToggle({ showFolders, onToggle }) {
  return (
    <div className="folder-view-toggle">
      <label className="toggle-label">폴더보기:</label>
      <div className="toggle-buttons">
        <button
          className={`toggle-btn ${!showFolders ? 'active' : ''}`}
          onClick={() => onToggle(false)}
        >
          Off
        </button>
        <button
          className={`toggle-btn ${showFolders ? 'active' : ''}`}
          onClick={() => onToggle(true)}
        >
          On
        </button>
      </div>
    </div>
  )
}

export default FolderViewToggle
