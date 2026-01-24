import { useState } from 'react'
import './DirectoryInput.css'

function DirectoryInput({ onDirectorySet, currentDirectory }) {
  const [directory, setDirectory] = useState(currentDirectory || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saveAsDefault, setSaveAsDefault] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!directory.trim()) {
      setError('경로를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/set-directory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory: directory.trim() })
      })

      const data = await response.json()

      if (response.ok) {
        onDirectorySet(directory.trim(), data.videoCount, saveAsDefault)
      } else {
        setError(data.error || '디렉토리 설정 실패')
      }
    } catch (err) {
      setError('서버 연결 오류')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="directory-input-container">
      <form onSubmit={handleSubmit} className="directory-form">
        <div className="input-group">
          <label htmlFor="directory">비디오 폴더 경로</label>
          <input
            type="text"
            id="directory"
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
            placeholder="예: C:\Users\username\Videos"
            className="directory-input"
            disabled={loading}
          />
        </div>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={saveAsDefault}
              onChange={(e) => setSaveAsDefault(e.target.checked)}
              disabled={loading}
            />
            <span>기본 경로로 저장</span>
          </label>
        </div>
        {error && <div className="error-message">{error}</div>}
        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? '설정 중...' : '폴더 스캔'}
        </button>
      </form>
      <div className="directory-info">
        <p>💡 MP4 파일과 같은 이름의 JPG 파일이 있는 폴더를 선택하세요</p>
        <p>예: video1.mp4 + video1.jpg</p>
      </div>
    </div>
  )
}

export default DirectoryInput
