// SRT를 WebVTT로 변환하는 함수
export function convertSrtToVtt(srtContent) {
    // SRT 포맷을 WebVTT로 변환
    let vttContent = 'WEBVTT\n\n'

    // 줄바꿈 정규화 (Windows/Linux/Mac 모두 지원)
    srtContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // SRT 자막 블록 분리
    const blocks = srtContent.trim().split('\n\n')

    blocks.forEach(block => {
        const lines = block.split('\n')

        // 첫 번째 줄은 번호이므로 제거
        if (lines.length >= 2) {
            const timeLine = lines[1]
            const textLines = lines.slice(2)

            // 타임스탬프의 쉼표를 마침표로 변경 (00:00:01,000 → 00:00:01.000)
            const vttTimeLine = timeLine.replace(/,/g, '.')

            vttContent += vttTimeLine + '\n'
            vttContent += textLines.join('\n') + '\n\n'
        }
    })

    return vttContent
}
