# Bilingual (中/EN) Interface Plan

## Goal
Every visible UI string supports switching between Chinese (zh) and English (en). 
Language preference persists in localStorage. Toggle button in Sidebar + Settings.

## Architecture

### New Files
1. `src/i18n/index.ts` — flat key→{zh,en} translation map for ALL pages
2. `src/contexts/LanguageContext.tsx` — Context + Provider + `useLanguage()` + `useT()` hooks

### Pattern
```tsx
// In any component:
const t = useT();
// Usage:
<button>{t('common.save')}</button>
```

`useT()` returns `(key: string) => string` using current `lang` from context.

### Language Toggle
- **Sidebar**: bottom section, `Languages` icon button (between logout + avatar), tooltip shows "中/EN"
- **Settings page**: new "Language / 语言" row in Appearance section

## Files to Create
| File | Purpose |
|---|---|
| `src/i18n/index.ts` | Complete translations: common, auth, analyze, library, note, distiller, actions, mirror, anticipation, zoom, persp, memory, settings, sidebar |
| `src/contexts/LanguageContext.tsx` | Context + useLanguage + useT hooks |

## Files to Update
| File | Changes |
|---|---|
| `src/App.tsx` | Wrap root with `<LanguageProvider>` |
| `src/components/layout/Sidebar.tsx` | Add Languages toggle button; use `t()` for tooltips |
| `src/components/layout/AppLayout.tsx` | Use `t()` for loading text |
| `src/pages/Auth.tsx` | All form labels, placeholders, buttons |
| `src/pages/Analyze.tsx` | All section labels, tabs, steps, placeholders |
| `src/pages/Library.tsx` | Filter labels, search placeholder, empty state, toasts |
| `src/pages/Note.tsx` | Tab labels, toolbar buttons, empty states |
| `src/pages/Settings.tsx` | All section headers + new Language row |
| `src/pages/Distiller.tsx` | Layer names, button labels, status messages |
| `src/pages/ActionLayer.tsx` | Status labels, filter tabs, placeholders |
| `src/pages/CognitiveMirror.tsx` | Section titles, buttons, descriptions |
| `src/pages/AnticipationLayer.tsx` | Type labels, status labels, buttons |
| `src/components/note/KnowledgeZoom.tsx` | Level names, button labels |
| `src/components/note/PerspectiveSwitch.tsx` | Lens labels, instruction text |
| `src/components/layout/MemoryWakePanel.tsx` | Labels, description text |

## Translation Keys (namespaced)

```ts
// common
'common.save', 'common.cancel', 'common.edit', 'common.delete', 'common.copy',
'common.loading', 'common.generate', 'common.analyze', 'common.back', 'common.search',
'common.filter', 'common.dismiss', 'common.add', 'common.new', ...

// auth
'auth.title', 'auth.subtitle', 'auth.email', 'auth.password', 'auth.signIn', 
'auth.signUp', 'auth.switchToSignUp', 'auth.switchToSignIn', ...

// sidebar
'sidebar.home', 'sidebar.analyze', 'sidebar.distiller', 'sidebar.actions',
'sidebar.mirror', 'sidebar.anticipation', 'sidebar.library', 'sidebar.settings',
'sidebar.newAnalysis', 'sidebar.signOut', 'sidebar.language', ...

// analyze
'analyze.title', 'analyze.subtitle', 'analyze.tabs.*', 'analyze.steps.*',
'analyze.inputPlaceholder.*', 'analyze.analyzing', ...

// library
'library.title', 'library.searchPlaceholder', 'library.filter.*',
'library.empty', 'library.delete', 'library.deleteConfirm', ...

// note
'note.tabs.*', 'note.edit', 'note.save', 'note.copy', 'note.export',
'note.distill', 'note.zoom', 'note.lens', ...

// settings
'settings.title', 'settings.sections.*', 'settings.labels.*', ...

// distiller
'distiller.title', 'distiller.layers.*', 'distiller.steps.*', ...

// actions
'actions.title', 'actions.statuses.*', 'actions.priorities.*', 
'actions.placeholder', 'actions.empty', ...

// mirror
'mirror.title', 'mirror.runAnalysis', 'mirror.sections.*', ...

// anticipation
'anticipation.title', 'anticipation.types.*', 'anticipation.statuses.*', ...

// zoom
'zoom.title', 'zoom.levels.*', ...

// perspective
'persp.title', 'persp.instruction', ...

// memory
'memory.title', 'memory.footer', ...
```

## Verification
1. Toggle language in Sidebar → all UI strings switch immediately
2. Reload page → language persists (localStorage)
3. Auth page, Settings, Library, Note, all AI feature pages all properly bilingual
4. No lint errors
