import videojs from 'video.js'

const MenuItem = videojs.getComponent('MenuItem')
const originalBuildCSSClass = MenuItem.prototype.buildCSSClass

export class SubtitleSizeItem extends MenuItem {
  constructor(player, options) {
    super(player, options)
    this.fontSize = options.fontSize
    this.controlText(options.label)
  }

  handleClick() {
    const player = this.player_
    player.removeClass('subtitle-small')
    player.removeClass('subtitle-medium')
    player.removeClass('subtitle-large')
    player.addClass(`subtitle-${this.fontSize}`)

    const menu = this.parentComponent_
    menu.children().forEach(child => {
      if (child instanceof SubtitleSizeItem) {
        child.removeClass('vjs-selected')
      }
    })
    this.addClass('vjs-selected')
  }

  buildCSSClass() {
    return 'vjs-menu-item vjs-subtitle-size-item ' + originalBuildCSSClass.call(this)
  }
}

export class SubtitleSizeHeader extends MenuItem {
  constructor(player, options = {}) {
    super(player, {
      ...options,
      selectable: false, // ✅ 핵심: undefined 방지 + 선택 불가
      label: '자막 크기',
    })
  }
  createEl() {
    const el = super.createEl()
    el.className = 'vjs-menu-item vjs-subtitle-size-header'
    el.innerHTML =
      '<span style="color: #999; font-size: 12px; padding: 8px 12px; display: block;">자막 크기</span>'
    return el
  }
  handleClick() {}
}

export const patchSubtitleButton = (button, player) => {
  if (button.__subtitleSizePatched) return
  button.__subtitleSizePatched = true

  const Separator = videojs.getComponent('MenuSeparator')

  // SubsCaps 메뉴 아이템이 만들어질 때마다 우리가 끼워 넣게 패치
  const origCreateItems = button.createItems?.bind(button)
  button.createItems = function () {
    const items = origCreateItems ? origCreateItems() : []

    const header = new SubtitleSizeHeader(player)
    const small = new SubtitleSizeItem(player, { label: '작게', fontSize: 'small' })
    const medium = new SubtitleSizeItem(player, { label: '보통', fontSize: 'medium' })
    const large = new SubtitleSizeItem(player, { label: '크게', fontSize: 'large' })

    return [
      header,
      small,
      medium,
      large,
      Separator ? new Separator(player) : null,
      ...items,
    ].filter(Boolean)
  }

  player.addClass('subtitle-medium')

  // 패치 후 메뉴 갱신(가능하면)
  button.update?.()
}
