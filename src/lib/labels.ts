// Names read by screen readers on buttons and regions that show only an
// icon. The markup carries the English one; French and Chinese pages get
// theirs from the middleware, and scripts that change a label use `label()`.
export const LABELS: Record<string, { fr: string; zh: string }> = {
  Previous: { fr: 'Précédent', zh: '上一张' },
  Next: { fr: 'Suivant', zh: '下一张' },
  'Previous page': { fr: 'Page précédente', zh: '上一页' },
  'Next page': { fr: 'Page suivante', zh: '下一页' },
  'Previous offering': { fr: 'Offrande précédente', zh: '上一盘供品' },
  'Next offering': { fr: 'Offrande suivante', zh: '下一盘供品' },
  Offerings: { fr: 'Offrandes', zh: '供品' },
  Reel: { fr: 'Pellicule', zh: '胶片' },
  Frames: { fr: 'Images', zh: '画面' },
  Collection: { fr: 'Catégories', zh: '作品分类' },
  'Selected work': { fr: 'Mes projets', zh: '我的作品' },
  Language: { fr: 'Langue', zh: '语言' },
  Social: { fr: 'Réseaux', zh: '社交网络' },
  Play: { fr: 'Lecture', zh: '播放' },
  Pause: { fr: 'Pause', zh: '暂停' },
  Mute: { fr: 'Couper le son', zh: '静音' },
  Unmute: { fr: 'Remettre le son', zh: '取消静音' },
  Volume: { fr: 'Volume', zh: '音量' },
  Seek: { fr: 'Avancer dans la vidéo', zh: '播放进度' },
  'Playback speed': { fr: 'Vitesse de lecture', zh: '播放速度' },
  Fullscreen: { fr: 'Plein écran', zh: '全屏' },
  'Exit fullscreen': { fr: 'Quitter le plein écran', zh: '退出全屏' },
  'Zoom in': { fr: 'Zoomer', zh: '放大' },
  'Zoom out': { fr: 'Dézoomer', zh: '缩小' },
  Close: { fr: 'Fermer', zh: '关闭' },
};

/** The label in the page's language (read from <html lang>). */
export function label(en: string): string {
  const lang = document.documentElement.lang;
  const entry = LABELS[en];
  if (!entry) return en;
  return lang === 'fr' ? entry.fr : lang.startsWith('zh') ? entry.zh : en;
}
