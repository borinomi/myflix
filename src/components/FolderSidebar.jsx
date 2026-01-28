import { useState, useEffect } from 'react'
import { getParentDirectory } from '../utils/pathUtils'
import './FolderSidebar.css'

function FolderSidebar({ currentDirectory, onFolderSelect, onChangeDirectory, isOpen, onClose }) {
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (currentDirectory) {
      fetchFolders(currentDirectory)
    }
  }, [currentDirectory])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const fetchFolders = async (directory) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/folder-tree?directory=${encodeURIComponent(directory)}`)
      const data = await response.json()
      setFolders(data.folders || [])
    } catch (error) {
      console.error('폴더 트리 로딩 실패:', error)
      setFolders([])
    } finally {
      setLoading(false)
    }
  }

  const handleFolderClick = (folderPath) => {
    onFolderSelect(folderPath)
  }

  const handleBackClick = () => {
    const parent = getParentDirectory(currentDirectory)
    if (parent) {
      onFolderSelect(parent)
    }
  }

  const canGoBack = () => {
    return getParentDirectory(currentDirectory) !== null
  }

  const getCurrentFolderName = () => {
    if (!currentDirectory) return ''
    const parts = currentDirectory.split(/[\\/]/)
    return parts[parts.length - 1] || parts[parts.length - 2] || ''
  }

  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <aside className={`folder-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <button
              className="back-button"
              onClick={handleBackClick}
              disabled={!canGoBack()}
              title="상위 폴더로 (Backspace)"
            >
              ←
            </button>
            <h3>폴더 탐색</h3>
            <div className="current-folder-name">
              <span className="folder-icon-small">📁</span>
              <span className="folder-name-text">{getCurrentFolderName()}</span>
            </div>
          </div>
          <div className="sidebar-header-bottom">
            <span className="current-path" title={currentDirectory}>
              {currentDirectory}
            </span>
            <button className="change-directory-btn" onClick={onChangeDirectory}>
              변경
            </button>
          </div>
        </div>
        <div className="folder-list">
          {loading ? (
            <div className="sidebar-loading">로딩 중...</div>
          ) : folders.length === 0 ? (
            <div className="no-folders">하위 폴더가 없습니다</div>
          ) : (
            <ul>
              {folders.map((folder, index) => (
                <li
                  key={index}
                  onClick={() => handleFolderClick(folder.path)}
                  className="folder-item"
                >
                  <span className="folder-icon">📁</span>
                  <span className="folder-name">{folder.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}

export default FolderSidebar
