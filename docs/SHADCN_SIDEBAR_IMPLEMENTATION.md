# shadcn Sidebar Implementation - SAM App

## What Was Installed

✅ **shadcn sidebar-07** - Collapsible sidebar with icon mode  
✅ **Component files created:**
- `components/app-sidebar.tsx` - Main sidebar component
- `components/nav-main.tsx` - Main navigation items
- `components/nav-projects.tsx` - Projects/integrations section  
- `components/nav-user.tsx` - User dropdown menu
- `components/team-switcher.tsx` - Workspace switcher
- `components/ui/sidebar.tsx` - Base sidebar primitives
- `components/ui/breadcrumb.tsx` - Breadcrumb navigation
- `components/ui/collapsible.tsx` - Collapsible sections
- `hooks/use-mobile.tsx` - Mobile detection hook

## Navigation Structure

### Main Navigation (`navMain`)
- **Chat** - Main conversation interface
  - New Conversation
  - History
- **Campaigns** - Campaign management
  - Active Campaigns
  - Create Campaign
  - Templates
- **Data Collection** - Prospect management
  - Prospects
  - LinkedIn Search
  - Import CSV
- **Knowledge Base** - Documentation
- **Analytics** - Metrics and reporting
- **Settings** - Configuration
  - Workspace
  - Integrations
  - AI Configuration

### Integrations Section (`integrations`)
- LinkedIn
- Email
- AI Agents

### Admin Section (`adminNav`) - Only for Super Admins
- **Super Admin**
  - User Management
  - Workspaces
  - System Settings

## Usage in Your App

### Basic Usage

```tsx
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"

export default function Layout({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
```

### With User Data and Admin Access

```tsx
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Building2 } from "lucide-react"

export default function Layout({ children }) {
  const user = {
    name: "John Doe",
    email: "john@example.com",
    avatar: "/avatars/john.jpg"
  }

  const workspaces = [
    {
      name: "InnovareAI Workspace",
      logo: Building2,
      plan: "Enterprise"
    }
  ]

  const isSuperAdmin = true // From your auth check

  return (
    <SidebarProvider>
      <AppSidebar 
        user={user}
        workspaces={workspaces}
        isSuperAdmin={isSuperAdmin}
      />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
```

## Features

### Collapsible Sidebar
- Click the hamburger icon to collapse to icon-only mode
- Saves screen space while maintaining access to all features
- Automatically collapses on mobile

### Workspace Switcher
- Switch between workspaces from the top dropdown
- Shows current workspace name and plan
- "Add team" option for creating new workspaces

### User Menu (Footer)
- User profile information
- Quick settings access
- Logout option

### Responsive Design
- Full sidebar on desktop
- Overlay sidebar on mobile
- Touch-friendly interactions

## Customization

### Change Colors
Edit `app/globals.css` sidebar variables:

```css
--sidebar-background: 224 71% 4%;
--sidebar-foreground: 210 40% 98%;
--sidebar-primary: 210 40% 98%;
--sidebar-primary-foreground: 222.2 47.4% 11.2%;
--sidebar-accent: 216 34% 17%;
--sidebar-accent-foreground: 210 40% 98%;
```

### Add New Navigation Items

Edit `components/app-sidebar.tsx`:

```tsx
const data = {
  navMain: [
    // ... existing items
    {
      title: "New Section",
      url: "/new-section",
      icon: YourIcon,
      items: [
        {
          title: "Sub Item",
          url: "/new-section/sub",
        },
      ],
    },
  ],
}
```

### Conditional Navigation

Show different items based on user role:

```tsx
const navItems = user.role === 'admin' 
  ? [...baseNavItems, ...adminNavItems]
  : baseNavItems

<NavMain items={navItems} />
```

## Integration with Existing App

### Step 1: Wrap Your Layout

Replace your current layout in `app/page.tsx` or `app/layout.tsx`:

```tsx
// Before
<div className="flex">
  {/* Your old nav */}
  <main>{children}</main>
</div>

// After
<SidebarProvider>
  <AppSidebar user={user} workspaces={workspaces} isSuperAdmin={isSuperAdmin} />
  <SidebarInset>
    <main>{children}</main>
  </SidebarInset>
</SidebarProvider>
```

### Step 2: Update Navigation Handlers

Replace your old menu item handlers with Next.js navigation:

```tsx
// Old
<button onClick={() => setActiveMenuItem('campaigns')}>
  Campaigns
</button>

// New - handled automatically by sidebar links
// Links in sidebar use Next.js <Link> component
```

### Step 3: Remove Old Navigation Components

Once sidebar is working, remove:
- Old sidebar/menu components
- Menu state management
- Navigation handlers

## Next Steps

1. **Test the sidebar** - Install and verify it works
2. **Integrate with auth** - Pass real user data
3. **Connect workspace switching** - Wire up workspace change handler
4. **Update routing** - Ensure all URLs match your pages
5. **Style customization** - Adjust colors to match brand
6. **Remove old nav** - Clean up legacy navigation code

## Troubleshooting

### Sidebar not showing
- Ensure `<SidebarProvider>` wraps your app
- Check that you imported components from correct paths
- Verify Tailwind config includes shadcn components

### Icons not displaying
- Install lucide-react: `npm install lucide-react`
- Import icons in `app-sidebar.tsx`

### Mobile view issues
- Ensure viewport meta tag is set
- Check `use-mobile` hook is working
- Test with Chrome DevTools mobile emulation

## Resources

- [shadcn/ui Sidebar Docs](https://ui.shadcn.com/docs/components/sidebar)
- [shadcn/ui Blocks](https://ui.shadcn.com/blocks/sidebar)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
