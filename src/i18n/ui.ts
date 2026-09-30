export const languages = { en: 'English', fr: 'Français', zh: '中文' } as const;
export type Lang = keyof typeof languages;

export const ui = {
  en: {
    'site.tagline': '2D visual development artist and animator. Character design, storyboard, concept art.',
    'nav.contact': 'Contact',
    'footer.rights': 'The work here is mine.',
    'footer.usage': 'What you can and cannot do with it',
    'footer.instagram': 'Instagram',
    'project.role': 'Role',
    'project.client': 'For',
    'project.at': 'At',
    'project.next': 'Next',
    'project.allWork': 'All work',
    'meta.description': 'Menghan LI. 2D visual development artist and animator. Character design, storyboard, concept art.',
    'category.commission': 'Commission',
    'category.school': 'School film',
    'category.personal': 'Personal project',
  },
  fr: {
    'site.tagline': 'Artiste en développement visuel 2D et animatrice. Character design, storyboard, concept art.',
    'nav.contact': 'Contact',
    'footer.rights': 'Le travail ici est le mien.',
    'footer.usage': 'Ce que vous pouvez en faire, et ce que vous ne pouvez pas',
    'footer.instagram': 'Instagram',
    'project.role': 'Rôle',
    'project.client': 'Pour',
    'project.at': 'À',
    'project.next': 'Suivant',
    'project.allWork': 'Tous les travaux',
    'meta.description': 'Menghan LI. Artiste en développement visuel 2D et animatrice. Character design, storyboard, concept art.',
    'category.commission': 'Commande',
    'category.school': "Film d'école",
    'category.personal': 'Projet personnel',
  },
  zh: {
    'site.tagline': '二维视觉开发艺术家，动画师。角色设计、分镜、概念设计。',
    'nav.contact': '联系',
    'footer.rights': '这里的作品是我的。',
    'footer.usage': '这些作品可以做什么，不可以做什么',
    'footer.instagram': 'Instagram',
    'project.role': '职责',
    'project.client': '客户',
    'project.at': '制作于',
    'project.next': '下一个',
    'project.allWork': '全部作品',
    'meta.description': '我是 Menghan LI。二维视觉开发艺术家，动画师。角色设计、分镜、概念设计。',
    'category.commission': '委托作品',
    'category.school': '学生短片',
    'category.personal': '个人项目',
  },
} as const;

export type UiKey = keyof (typeof ui)['en'];

// Every piece of UI copy ships in all three languages at once; CSS (driven
// by <html data-lang>) decides which one is visible. See I18nText.astro.
export function trAll(key: UiKey): { en: string; fr: string; zh: string } {
  return { en: ui.en[key], fr: ui.fr[key], zh: ui.zh[key] };
}
