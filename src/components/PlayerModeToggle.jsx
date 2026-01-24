import './PlayerModeToggle.css'

function PlayerModeToggle({ mode, onModeChange }) {
  return (
    <div className="player-mode-toggle">
      <label className="toggle-label">재생 모드:</label>
      <div className="toggle-buttons">
        <button
          className={`toggle-btn ${mode === 'browser' ? 'active' : ''}`}
          onClick={() => onModeChange('browser')}
        >
          브라우저
        </button>
        <button
          className={`toggle-btn ${mode === 'desktop' ? 'active' : ''}`}
          onClick={() => onModeChange('desktop')}
        >
          Desktop App
        </button>
      </div>
    </div>
  )
}

export default PlayerModeToggle
