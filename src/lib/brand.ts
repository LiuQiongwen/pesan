/** Centralized brand constants for Pesta */

export const BRAND = {
  name:        'Pesta',
  nameUpper:   'PESTA',
  tagline:     '个人智能知识管理平台',
  taglineEn:   'Your Personal AI Knowledge Universe',
  description: '捕捉想法，AI 自动整理，构建你的私密知识体系。支持网站、文件、图片、文字、视频多源输入。',
  version:     'v2.0',
  year:        '2026',
  copyright:   '© 2026 Pesta',
  // Storage keys — prefixed with pesta_ (migrates from cosmos_)
  storageKeys: {
    wm:      'pesta_wm_v1',
    layout:  'pesta_wm_layout_v1',
    presets: 'pesta_wm_presets_v1',
    // Legacy keys to migrate from
    legacyWm:  'cosmos_wm_v1',
    legacyPods: 'cosmos_pods_v4',
  },
} as const;
