export const getParentDirectory = (path) => {
    if (!path) return null

    // 마지막 \ 또는 / 찾기
    const lastSeparator = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))

    if (lastSeparator <= 0) return null // 루트 경로

    // 드라이브 루트 체크 (C:\ 같은 경우)
    const parent = path.substring(0, lastSeparator)
    if (parent.match(/^[A-Za-z]:$/)) return null

    return parent
}
