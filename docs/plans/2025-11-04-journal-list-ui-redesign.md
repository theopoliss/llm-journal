# Journal List Screen UI Redesign

**Date:** 2025-11-04
**Status:** Validated, ready for implementation

## Overview

Simplify the JournalListScreen header and tab bar to create a cleaner, more minimal interface by removing visual clutter and repositioning controls.

## Goals

- Remove horizontal separator between header and tab bar
- Simplify search to icon-only button
- Move sort control from header to tab bar
- Create more breathing room in the header

## Design

### 1. Header Redesign

**Current:**
```
┌─────────────────────────────────┐
│ ← Back                          │
│ Journal Entries                 │
│         [Search] [Newest First] │
└─────────────────────────────────┘
─────────────────────────────────── (separator)
```

**New:**
```
┌─────────────────────────────────┐
│ ← Back                          │
│ Journal Entries            🔍   │
└─────────────────────────────────┘
─────────────────────────────────── (separator)
```

**Changes:**
- Remove "Search" text button → Replace with magnifying glass icon (🔍)
- Position search icon horizontally inline with "Journal Entries" title
- Search icon aligned to far right
- Remove sort button entirely from header
- Keep separator line below header (between header and tabs)

### 2. Tab Bar Redesign

**Current:**
```
───────────────────────────────────── (separator above tabs)
│    All    │   Smart   │  Folders  │
═══════════
```

**New:**
```
All    Smart    Folders              ↕
═══
```

**Changes:**
- **Remove horizontal separator line** above tab bar
- Tabs aligned to left with reduced spacing
- Change from `flex: 1` equal distribution to content-width sizing
- Suggested: 20px horizontal padding per tab (reduced from current)
- Sort icon (↕) positioned on far right of tab bar
- Active tab keeps bottom border indicator

### 3. Sort Icon Behavior

**Visibility:**
- Only visible when "All" tab is active
- Hidden on "Smart" and "Folders" tabs (sorting doesn't apply)

**Interaction:**
- Tap icon → Opens dropdown menu anchored to icon
- Menu options:
  - "Newest First" (with checkmark if active)
  - "Oldest First" (with checkmark if active)
- Same dropdown styling as current sort menu
- Tap outside → Closes menu (backdrop)

**Visual State:**
- Icon indicates menu state (e.g., changes when menu open)
- Maintains minimalist black/white design

**Positioning:**
- Absolute positioned on right edge of tab bar
- Vertically centered with tab text
- ~20px margin from right edge

## Implementation Notes

### Files to Modify

**screens/JournalListScreen.js:**
- Header layout: Remove sort button, replace search text with icon
- Tab bar: Remove flex:1, add fixed padding, align left
- Add sort icon component to tab bar
- Conditional rendering: Show sort icon only when activeTab === LIBRARY_TABS.ALL
- Reposition sort dropdown to anchor to icon instead of header

**Styling:**
- Update `headerControls` to only contain search icon
- New style: `searchIcon` for icon-only button
- Update `tab` styles: Remove flex:1, add paddingHorizontal
- New style: `tabBarSortIcon` for sort icon positioning
- Update `sortMenuDropdown` position to anchor to tab bar icon

### Visual Hierarchy

Before: Header dominates with multiple controls
After: Clean header → Tabs with contextual controls

### Responsive Considerations

- Tab text should not wrap (use appropriate padding to prevent overflow)
- Sort icon should maintain ~20px margin even on smaller screens
- Dropdown menu should stay within viewport bounds

## Success Criteria

- [ ] Header contains only: back button, title, search icon
- [ ] Search icon aligned with title text, positioned right
- [ ] No separator line between header and tab bar
- [ ] Tabs left-aligned with reduced spacing
- [ ] Sort icon appears only on "All" tab
- [ ] Sort icon positioned on right edge of tab bar
- [ ] Dropdown menu functions identically to current behavior
- [ ] Visual design maintains minimalist black/white aesthetic
