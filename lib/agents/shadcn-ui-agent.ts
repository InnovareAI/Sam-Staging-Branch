/**
 * Specialized ShadCN/UI Agent for Component Management
 * Handles UI component creation, modification, and optimization
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface ShadCNComponent {
  name: string;
  type: 'component' | 'block' | 'example';
  dependencies?: string[];
  files: string[];
  registry: 'shadcn' | 'blocks' | 'custom';
}

export interface ComponentRequest {
  component: string;
  customizations?: {
    styling?: string;
    props?: Record<string, any>;
    variants?: string[];
  };
  integrations?: string[];
}

/**
 * Embedded ShadCN Knowledge Base
 */
const shadcnKnowledgeBase: Record<string, string[]> = {
  form: [
    "Always wrap with <FormField> and <FormItem> for consistency",
    "Use react-hook-form + zod for validation",
    "Always include <FormMessage> for error display"
  ],
  table: [
    "Use @tanstack/react-table for advanced data handling",
    "Separate columns.tsx for type-safe column defs",
    "Support sorting, filtering, pagination from day one"
  ],
  dialog: [
    "Wrap trigger in <DialogTrigger asChild>",
    "Always provide <DialogHeader> with title + description",
    "Use <DialogClose> for safe custom closing buttons"
  ],
  chart: [
    "Import Recharts components (BarChart, LineChart, PieChart)",
    "Define CSS vars for colors: --chart-1, --chart-2",
    "Always include ChartTooltip + ChartLegend"
  ],
  sidebar: [
    "Use SidebarProvider to manage state",
    "Structure: Header → Content → Footer",
    "Add collapse/expand trigger with useSidebar hook"
  ],
  darkmode: [
    "Use next-themes with ThemeProvider",
    "Enable class-based darkMode in tailwind.config",
    "Add theme toggle button with useTheme()"
  ],
  button: [
    "Available variants: default, destructive, outline, secondary, ghost, link",
    "Use asChild prop to render as different element",
    "Combine with icons using lucide-react"
  ],
  input: [
    "Use with <Label> for accessibility",
    "Combine with <FormField> for validation",
    "Support disabled and error states automatically"
  ],
  select: [
    "Wrap with <SelectTrigger> and <SelectContent>",
    "Use <SelectItem> for each option",
    "Support placeholder with <SelectValue>"
  ],
  checkbox: [
    "Always pair with <Label> using htmlFor + id",
    "Use in forms with <FormField> wrapper",
    "Support indeterminate state for mixed selections"
  ],
  sheet: [
    "Perfect for mobile-friendly modals and drawers",
    "Set side prop: left, right, top, bottom",
    "Use <SheetTrigger asChild> pattern"
  ],
  popover: [
    "Great for date pickers and contextual menus",
    "Use <PopoverTrigger asChild> pattern",
    "Control with open/onOpenChange state"
  ],
  dropdown: [
    "Wrap with <DropdownMenu> root component",
    "Use <DropdownMenuTrigger asChild> pattern",
    "Add <DropdownMenuSeparator> between sections"
  ],
  tabs: [
    "Structure: <TabsList> contains <TabsTrigger> elements",
    "Content in <TabsContent> components",
    "Set defaultValue for initial active tab"
  ],
  card: [
    "Structure: <Card> → <CardHeader> → <CardContent> → <CardFooter>",
    "Use <CardTitle> and <CardDescription> in header",
    "Flexible - don't need all sections"
  ],
  badge: [
    "Available variants: default, secondary, destructive, outline",
    "Great for status indicators and tags",
    "Use with icons for enhanced meaning"
  ],
  alert: [
    "Structure: <Alert> → <AlertTitle> → <AlertDescription>",
    "Available variants: default, destructive",
    "Add icons with lucide-react for visual clarity"
  ],
  toast: [
    "Use useToast hook for programmatic toasts",
    "Available variants: default, destructive",
    "Auto-dismiss with configurable duration"
  ]
};

export class ShadCNUIAgent {
  private projectRoot = '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7';
  private componentsPath = '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/components';
  private uiPath = '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/components/ui';
  
  /**
   * Search and install ShadCN components
   */
  async installComponent(request: ComponentRequest): Promise<{
    success: boolean;
    command: string;
    output: string;
    files: string[];
    postInstallTips?: string[];
  }> {
    try {
      // Build shadcn add command with auto-overwrite prevention
      const command = `npx shadcn@latest add ${request.component} --yes`;
      
      console.log(`Installing ShadCN component: ${request.component}`);
      console.log(`Command: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectRoot
      });
      
      // Get list of installed files
      const files = await this.getComponentFiles(request.component);
      const tips = this.getUsageTips(request.component);
      
      return {
        success: true,
        command,
        output: stdout || stderr,
        files,
        postInstallTips: tips
      };
    } catch (error: any) {
      return {
        success: false,
        command: `npx shadcn@latest add ${request.component}`,
        output: error.message,
        files: [],
        postInstallTips: []
      };
    }
  }

  /**
   * Get available ShadCN components
   */
  async getAvailableComponents(): Promise<string[]> {
    const knownComponents = [
      // Form Components
      'form', 'input', 'textarea', 'select', 'checkbox', 'radio-group', 'switch', 'label',
      
      // Layout Components  
      'card', 'dialog', 'sheet', 'popover', 'tabs', 'accordion', 'collapsible',
      'separator', 'aspect-ratio', 'scroll-area',
      
      // Navigation
      'navigation-menu', 'menubar', 'context-menu', 'dropdown-menu',
      'breadcrumb', 'pagination',
      
      // Data Display
      'table', 'badge', 'avatar', 'tooltip', 'alert', 'skeleton', 'progress',
      'calendar', 'date-picker', 'command',
      
      // Feedback
      'alert-dialog', 'toast', 'sonner', 'drawer',
      
      // Input
      'button', 'toggle', 'toggle-group', 'slider', 'range-calendar',
      
      // Utility
      'hover-card', 'resizable', 'chart'
    ];
    
    return knownComponents;
  }

  /**
   * Install multiple components at once
   */
  async installMultipleComponents(components: string[]): Promise<{
    successful: string[];
    failed: { component: string; error: string }[];
    commands: string[];
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as { component: string; error: string }[],
      commands: [] as string[]
    };

    for (const component of components) {
      try {
        const result = await this.installComponent({ component });
        results.commands.push(result.command);
        
        if (result.success) {
          results.successful.push(component);
        } else {
          results.failed.push({ component, error: result.output });
        }
      } catch (error: any) {
        results.failed.push({ component, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get component files after installation
   */
  private async getComponentFiles(componentName: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      // Check in components/ui directory
      const uiFiles = await fs.readdir(this.uiPath).catch(() => []);
      const matchingFiles = uiFiles.filter(file => 
        file.includes(componentName) || 
        componentName.includes(file.replace('.tsx', ''))
      );
      
      files.push(...matchingFiles.map(file => `components/ui/${file}`));
    } catch (error) {
      console.warn('Could not read component files:', error);
    }
    
    return files;
  }

  /**
   * Create custom component based on ShadCN patterns
   */
  async createCustomComponent(config: {
    name: string;
    baseComponent?: string;
    template: string;
    props?: Record<string, any>;
  }): Promise<{ success: boolean; filePath: string; content: string }> {
    const componentName = config.name;
    const fileName = `${componentName.toLowerCase().replace(/([A-Z])/g, '-$1').substring(1)}.tsx`;
    const filePath = path.join(this.componentsPath, fileName);
    
    try {
      await fs.writeFile(filePath, config.template);
      
      return {
        success: true,
        filePath: `components/${fileName}`,
        content: config.template
      };
    } catch (error: any) {
      return {
        success: false,
        filePath: '',
        content: error.message
      };
    }
  }

  /**
   * Optimize component imports and exports
   */
  async optimizeComponentStructure(): Promise<{
    recommendations: string[];
    autoFixes: string[];
  }> {
    const recommendations: string[] = [];
    const autoFixes: string[] = [];
    
    try {
      // Check for index files
      const uiIndexExists = await fs.access(path.join(this.uiPath, 'index.ts')).then(() => true).catch(() => false);
      
      if (!uiIndexExists) {
        recommendations.push('Create components/ui/index.ts for better import organization');
        
        // Auto-create index file
        const uiFiles = await fs.readdir(this.uiPath);
        const tsxFiles = uiFiles.filter(file => file.endsWith('.tsx'));
        
        const indexContent = tsxFiles.map(file => {
          const componentName = file.replace('.tsx', '');
          return `export { default as ${componentName} } from './${componentName}';`;
        }).join('\n');
        
        await fs.writeFile(path.join(this.uiPath, 'index.ts'), indexContent);
        autoFixes.push('Created components/ui/index.ts');
      }
      
      recommendations.push('Consider using absolute imports with @/ alias');
      recommendations.push('Ensure consistent naming conventions (kebab-case for files, PascalCase for components)');
      
    } catch (error) {
      recommendations.push('Error analyzing component structure');
    }
    
    return { recommendations, autoFixes };
  }

  /**
   * Generate component usage documentation
   */
  async generateComponentDocs(componentName: string): Promise<string> {
    const filePath = path.join(this.uiPath, `${componentName}.tsx`);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract props interface
      const propsMatch = content.match(/interface\s+\w*Props[^{]*{([^}]*)}/);
      const propsDoc = propsMatch ? propsMatch[1] : 'No props interface found';
      
      return `
# ${componentName} Component

## Usage
\`\`\`tsx
import { ${componentName} } from '@/components/ui/${componentName}';

<${componentName} />
\`\`\`

## Props
\`\`\`typescript
${propsDoc}
\`\`\`

## File Location
\`components/ui/${componentName}.tsx\`
      `;
    } catch (error) {
      return `Component ${componentName} not found or could not be analyzed.`;
    }
  }

  /**
   * Smart component recommendations based on usage patterns
   */
  async recommendComponents(context: {
    pageType?: 'dashboard' | 'form' | 'landing' | 'auth';
    features?: string[];
    existingComponents?: string[];
  }): Promise<string[]> {
    const { pageType, features = [], existingComponents = [] } = context;
    const recommendations: string[] = [];
    
    // Base recommendations by page type
    const pageTypeComponents = {
      dashboard: ['card', 'table', 'chart', 'badge', 'separator', 'tabs', 'skeleton'],
      form: ['form', 'input', 'textarea', 'select', 'checkbox', 'button', 'label', 'alert'],
      landing: ['button', 'card', 'badge', 'separator', 'aspect-ratio'],
      auth: ['form', 'input', 'button', 'card', 'alert', 'separator']
    };
    
    if (pageType && pageTypeComponents[pageType]) {
      recommendations.push(...pageTypeComponents[pageType]);
    }
    
    // Feature-based recommendations
    const featureComponents: Record<string, string[]> = {
      'data-tables': ['table', 'pagination', 'command', 'popover'],
      'forms': ['form', 'input', 'textarea', 'select', 'checkbox', 'radio-group'],
      'navigation': ['navigation-menu', 'breadcrumb', 'tabs'],
      'modals': ['dialog', 'sheet', 'alert-dialog'],
      'notifications': ['toast', 'sonner', 'alert'],
      'charts': ['chart', 'progress'],
      'calendars': ['calendar', 'date-picker'],
      'menus': ['dropdown-menu', 'context-menu', 'menubar']
    };
    
    features.forEach(feature => {
      if (featureComponents[feature]) {
        recommendations.push(...featureComponents[feature]);
      }
    });
    
    // Remove already existing components
      return [...new Set(recommendations)].filter(comp => !existingComponents.includes(comp));
  }

  /**
   * Get component-specific usage tips and best practices
   */
  private getUsageTips(componentName: string): string[] {
    return this.getKnowledge(componentName);
  }

  /**
   * Fetch knowledge base tips
   */
  getKnowledge(componentName: string): string[] {
    return shadcnKnowledgeBase[componentName] || [
      "No specific KB tips found. Check ShadCN docs if needed."
    ];
  }

  /**
   * Generate complete component implementation examples
   */
  async generateComponentExample(componentName: string, context?: {
    useCase?: string;
    integration?: string[];
    styling?: 'minimal' | 'styled' | 'custom';
  }): Promise<string> {
    const examples: Record<string, string> = {
      'form': `'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
})

export function UserForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Enter username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}`,

      'data-table': `'use client'

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowUpDown } from "lucide-react"

export type Payment = {
  id: string
  amount: number
  status: "pending" | "processing" | "success" | "failed"
  email: string
}

export const columns: ColumnDef<Payment>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting()}>
        Email <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"))
      return \`$\${amount.toFixed(2)}\`
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <div className={\`px-2 py-1 rounded-md text-xs \${
          status === 'success' ? 'bg-green-100 text-green-800' :
          status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          status === 'failed' ? 'bg-red-100 text-red-800' : 
          'bg-blue-100 text-blue-800'
        }\`}>
          {status}
        </div>
      )
    },
  },
]`,

      'dashboard-layout': `import { Sidebar } from "@/components/sidebar"
import { Navbar } from "@/components/navbar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  )
}`,
    };

    return examples[componentName] || `// ${componentName} component example not available`;
  }

  /**
   * Setup dark mode with next-themes
   */
  async setupDarkMode(): Promise<{
    success: boolean;
    steps: string[];
    files: string[];
  }> {
    const steps = [
      'Install next-themes: npm install next-themes',
      'Create theme provider component',
      'Wrap app in layout.tsx with ThemeProvider',
      'Add theme toggle button with useTheme hook',
      'Update tailwind.config.js with darkMode: "class"',
      'Add CSS variables for light/dark themes'
    ];

    const files = [
      'components/providers/theme-provider.tsx',
      'components/theme-toggle.tsx'
    ];

    return {
      success: true,
      steps,
      files
    };
  }

  /**
   * Create responsive grid layouts
   */
  generateResponsiveGrid(items: number, layout: '2-column' | '3-column' | '4-column' | 'dashboard' = 'dashboard'): string {
    const layouts = {
      '2-column': 'grid grid-cols-1 md:grid-cols-2 gap-6',
      '3-column': 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
      '4-column': 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6',
      'dashboard': 'grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4'
    };

    const specialItems = layout === 'dashboard' ? [
      '<!-- First item - spans 2 columns on large screens -->',
      '<div className="lg:col-span-2">',
      '  <!-- Chart or main content -->',
      '</div>',
      '',
      '<!-- Regular items -->',
      ...Array(items - 1).fill(null).map((_, i) => `<div>Item ${i + 2}</div>`)
    ] : Array(items).fill(null).map((_, i) => `<div>Item ${i + 1}</div>`);

    return `<div className="${layouts[layout]}">
  ${specialItems.join('\n  ')}
</div>`;
  }
}

// Singleton instance
export const shadcnUIAgent = new ShadCNUIAgent();

// Helper functions for easy usage
export async function installShadCNComponents(components: string[]) {
  return await shadcnUIAgent.installMultipleComponents(components);
}

export async function getRecommendedComponents(context: Parameters<typeof shadcnUIAgent.recommendComponents>[0]) {
  return await shadcnUIAgent.recommendComponents(context);
}

export async function optimizeUIStructure() {
  return await shadcnUIAgent.optimizeComponentStructure();
}

export async function generateComponentExample(componentName: string, context?: Parameters<typeof shadcnUIAgent.generateComponentExample>[1]) {
  return await shadcnUIAgent.generateComponentExample(componentName, context);
}

// Common component combinations for rapid development
export const COMPONENT_BUNDLES = {
  'basic-dashboard': ['card', 'button', 'badge', 'separator', 'avatar'],
  'advanced-dashboard': ['card', 'button', 'badge', 'separator', 'avatar', 'chart', 'table', 'tabs', 'progress'],
  'form-heavy': ['form', 'input', 'textarea', 'select', 'checkbox', 'radio-group', 'button', 'label', 'alert'],
  'data-tables': ['table', 'pagination', 'command', 'popover', 'dropdown-menu', 'checkbox', 'button'],
  'navigation': ['navigation-menu', 'breadcrumb', 'tabs', 'sheet', 'sidebar'],
  'modals-overlays': ['dialog', 'sheet', 'popover', 'hover-card', 'tooltip', 'alert-dialog'],
  'feedback': ['toast', 'sonner', 'alert', 'progress', 'skeleton'],
  'calendar-dates': ['calendar', 'date-picker', 'popover', 'button'],
  'charts-visualization': ['chart', 'progress', 'badge', 'card', 'separator']
} as const;

// Quick installer for common bundles
export async function installComponentBundle(bundle: keyof typeof COMPONENT_BUNDLES) {
  const components = COMPONENT_BUNDLES[bundle];
  return await installShadCNComponents(components);
}

// Quick access to knowledge base
export function getShadCNKnowledge(componentName: string): string[] {
  return shadcnUIAgent.getKnowledge(componentName);
}

// Smart component installer with knowledge integration
export async function installWithKnowledge(componentName: string) {
  const installResult = await shadcnUIAgent.installComponent({ component: componentName });
  const knowledge = getShadCNKnowledge(componentName);
  
  return {
    ...installResult,
    tips: knowledge,
    summary: `${componentName} installed with ${knowledge.length} usage tips`
  };
}