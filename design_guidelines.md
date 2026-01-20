# Gamefolio Mobile App - Design Guidelines

## Brand Identity

**Purpose**: Gamefolio is a gaming portfolio app where users showcase their gaming achievements, track collections, and connect with other gamers.

**Aesthetic Direction**: Bold/striking with retro-futuristic elements. High contrast dark theme with neon accent pops, creating an immersive gaming aesthetic that feels premium but energetic. The memorable element is the gradient-accented cards with subtle glow effects that make achievements feel rewarding.

**Differentiation**: Unlike generic profile apps, Gamefolio makes every achievement feel like unlocking a trophy through vibrant visual feedback and celebratory micro-interactions.

## Navigation Architecture

**Root Navigation**: Tab Navigation (4 tabs + floating action button)

**Tabs**:
1. **Home** - Dashboard with gaming stats overview
2. **Collection** - Game library grid
3. **Add Game** (Floating Action Button) - Quick add game
4. **Social** - Friends & activity feed
5. **Profile** - User profile & settings

**Authentication**: Required (SSO with Apple Sign-In for iOS, Google Sign-In for Android)

## Screen-by-Screen Specifications

### Login Screen (Stack-only, pre-auth)
- Layout: Full-screen with logo centered in upper third
- Header: None
- Content: App logo/title, SSO buttons vertically stacked, terms/privacy links at bottom
- Safe Area: Top: insets.top + Spacing.xl, Bottom: insets.bottom + Spacing.xl

### Home Screen (Tab 1)
- Layout: Scrollable content with transparent header
- Header: Custom transparent with search icon (right), profile avatar (left)
- Content: Stats cards (games owned, hours played, achievements), recent activity feed, featured game spotlight
- Safe Area: Top: headerHeight + Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- Components: Stat cards with gradient backgrounds, horizontal scrolling recent games, activity list items

### Collection Screen (Tab 2)
- Layout: Grid view (2 columns) with transparent header
- Header: Custom transparent with filter icon (right), sort icon (left)
- Content: Game cards displaying cover art, title, completion percentage
- Empty State: "empty-collection.png" illustration with "Start building your gaming legacy" message
- Safe Area: Top: headerHeight + Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- Components: Grid cards with cover images, progress indicators

### Add Game Screen (Modal from FAB)
- Layout: Scrollable form with standard header
- Header: Default navigation with "Cancel" (left), "Add" (right)
- Content: Search bar, game details form (title, platform, status dropdown, rating)
- Safe Area: Top: Spacing.xl, Bottom: insets.bottom + Spacing.xl
- Components: Search input, dropdown selectors, rating stars, cover image picker

### Social Screen (Tab 3)
- Layout: Scrollable list with transparent header
- Header: Custom transparent with add friend icon (right)
- Content: Friend activity cards showing recent achievements, game additions
- Empty State: "empty-friends.png" illustration with "Connect with gamers" CTA
- Safe Area: Top: headerHeight + Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- Components: Activity feed cards with user avatars, game thumbnails

### Profile Screen (Tab 4)
- Layout: Scrollable content with transparent header
- Header: Custom transparent with settings icon (right)
- Content: User avatar (large), display name, gaming stats summary, achievements showcase grid, sign out button (bottom)
- Safe Area: Top: headerHeight + Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- Components: Avatar (editable), stat badges, achievement grid

### Settings Screen (Stack from Profile)
- Layout: Scrollable form with standard header
- Header: Default navigation with back button (left)
- Content: Grouped settings (Account, Notifications, Appearance), delete account nested under Account
- Safe Area: Top: Spacing.xl, Bottom: insets.bottom + Spacing.xl

## Color Palette

**Primary**: #7C3AED (vibrant purple with energy)
**Primary Variant**: #5B21B6 (deeper purple for pressed states)
**Secondary Accent**: #F59E0B (amber for achievement highlights)
**Background**: #0F0F23 (deep navy-black)
**Surface**: #1A1A2E (elevated dark surface)
**Surface Variant**: #25254A (card backgrounds)
**Text Primary**: #FFFFFF
**Text Secondary**: #9CA3AF
**Success**: #10B981
**Error**: #EF4444

**Gradient**: Linear gradient from Primary to Primary Variant for cards and CTAs

## Typography

**Primary Font**: Rajdhani (Google Font) - bold, gaming-inspired
**Body Font**: Inter (Google Font) - clean, readable

**Type Scale**:
- Hero: Rajdhani Bold 32px
- Title: Rajdhani Bold 24px
- Heading: Rajdhani SemiBold 18px
- Body: Inter Regular 16px
- Caption: Inter Regular 14px
- Label: Inter Medium 12px

## Visual Design

- All cards use gradient backgrounds with 8px border radius
- Floating Action Button: 60px diameter circle with Primary gradient, shadow: offset (0, 2), opacity 0.10, radius 2
- Game cards have subtle glow effect (outer shadow with Primary color at 0.2 opacity)
- Touchable feedback: Scale down to 0.98 on press
- Achievement badges use Secondary Accent with subtle pulse animation

## Assets to Generate

1. **icon.png** - App icon featuring stylized game controller with gradient
2. **splash-icon.png** - Simplified logo mark for launch screen
3. **empty-collection.png** - Illustration of empty trophy case, WHERE USED: Collection screen empty state
4. **empty-friends.png** - Illustration of controllers waiting to connect, WHERE USED: Social screen empty state
5. **avatar-preset-1.png** - Gaming helmet avatar option, WHERE USED: Profile setup
6. **avatar-preset-2.png** - Pixel art character avatar, WHERE USED: Profile setup
7. **avatar-preset-3.png** - Abstract gaming symbol, WHERE USED: Profile setup
8. **welcome-hero.png** - Celebratory gaming illustration, WHERE USED: First launch welcome screen