import { generateThumbnail, getCacheStats, clearThumbnailCache } from './services/thumbnailCache.js'
import path from 'path'

async function testThumbnailCache() {
  console.log('=== 썸네일 캐시 시스템 테스트 ===\n')

  // Test video path (adjust this to a real video file on your system)
  const testVideoPath = 'C:\\Users\\Anhmake\\OneDrive\\문서\\code\\myflix\\media\\test.mp4'

  try {
    console.log('1. 초기 캐시 상태 확인')
    let stats = getCacheStats()
    console.log(`   - 캐시 파일 수: ${stats.fileCount}`)
    console.log(`   - 캐시 크기: ${stats.totalSizeMB} MB`)
    console.log(`   - 캐시 디렉토리: ${stats.cacheDir}\n`)

    console.log('2. 썸네일 생성 테스트')
    console.log(`   - 비디오 경로: ${testVideoPath}`)

    console.time('   - 첫 번째 생성 시간')
    const thumbnail1 = await generateThumbnail(testVideoPath)
    console.timeEnd('   - 첫 번째 생성 시간')
    console.log(`   - 생성된 썸네일: ${thumbnail1}\n`)

    console.log('3. 캐시 히트 테스트 (같은 비디오)')
    console.time('   - 두 번째 생성 시간')
    const thumbnail2 = await generateThumbnail(testVideoPath)
    console.timeEnd('   - 두 번째 생성 시간')
    console.log(`   - 캐시된 썸네일: ${thumbnail2}\n`)

    console.log('4. 캐시 상태 재확인')
    stats = getCacheStats()
    console.log(`   - 캐시 파일 수: ${stats.fileCount}`)
    console.log(`   - 캐시 크기: ${stats.totalSizeMB} MB\n`)

    console.log('5. 캐시 삭제 테스트')
    const deletedCount = clearThumbnailCache()
    console.log(`   - 삭제된 파일 수: ${deletedCount}\n`)

    console.log('6. 삭제 후 캐시 상태')
    stats = getCacheStats()
    console.log(`   - 캐시 파일 수: ${stats.fileCount}`)
    console.log(`   - 캐시 크기: ${stats.totalSizeMB} MB\n`)

    console.log('✅ 모든 테스트 완료')

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message)
  }
}

testThumbnailCache()
