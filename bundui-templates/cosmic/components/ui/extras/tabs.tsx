'use client';

import * as React from 'react';
import { motion, type Transition } from 'motion/react';

import { cn } from '@/lib/utils';

interface TabsContextType {
  activeValue: string;
  handleValueChange: (value: string) => void;
  registerTrigger: (value: string, node: HTMLElement | null) => void;
  getTrigger: (value: string) => HTMLElement | null;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

const useTabs = (): TabsContextType => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs must be used within a TabsProvider');
  }
  return context;
};

type TabsProps =
  | {
      defaultValue?: string;
      children: React.ReactNode;
      className?: string;
      value?: never;
      onValueChange?: never;
    }
  | {
      value: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
      className?: string;
      defaultValue?: never;
    };

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    { defaultValue, value, onValueChange, children, className, ...props },
    forwardedRef,
  ) => {
    const [activeValue, setActiveValue] = React.useState(defaultValue);
    const triggersRef = React.useRef(new Map<string, HTMLElement>());
    const initialSet = React.useRef(false);
    const isControlled = value !== undefined;

    React.useEffect(() => {
      if (
        !isControlled &&
        activeValue === undefined &&
        triggersRef.current.size > 0 &&
        !initialSet.current
      ) {
        const firstTab = Array.from(triggersRef.current.keys())[0];
        setActiveValue(firstTab);
        initialSet.current = true;
      }
    }, [activeValue, isControlled]);

    const registerTrigger = (value: string, node: HTMLElement | null) => {
      if (node) {
        triggersRef.current.set(value, node);
        if (!isControlled && activeValue === undefined && !initialSet.current) {
          setActiveValue(value);
          initialSet.current = true;
        }
      } else {
        triggersRef.current.delete(value);
      }
    };

    const getTrigger = (value: string): HTMLElement | null => {
      return triggersRef.current.get(value) || null;
    };

    const handleValueChange = (val: string) => {
      if (!isControlled) {
        setActiveValue(val);
      } else {
        onValueChange?.(val);
      }
    };

    const localRef = React.useRef<HTMLDivElement | null>(null);
    React.useImperativeHandle(
      forwardedRef,
      () => localRef.current as HTMLDivElement,
    );

    return (
      <TabsContext.Provider
        value={{
          activeValue: (value ?? activeValue)!,
          handleValueChange,
          registerTrigger,
          getTrigger,
        }}
      >
        <div
          ref={localRef}
          className={cn('flex flex-col gap-2', className)}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = 'Tabs';

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  transition?: Transition;
}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  (
    {
      children,
      className,
      activeClassName,
      transition = {
        type: 'spring',
        bounce: 0,
        stiffness: 200,
        damping: 25,
      },
    },
    forwardedRef,
  ) => {
    const localRef = React.useRef<HTMLDivElement | null>(null);
    const { activeValue, getTrigger } = useTabs();
    const [indicatorStyle, setIndicatorStyle] = React.useState({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    });

    const updateIndicator = React.useCallback(() => {
      if (!localRef.current) return;

      const trigger = getTrigger(activeValue);
      if (!trigger) return;

      const containerRect = localRef.current.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();

      setIndicatorStyle({
        left: triggerRect.left - containerRect.left,
        top: triggerRect.top - containerRect.top,
        width: triggerRect.width,
        height: triggerRect.height,
      });
    }, [activeValue, getTrigger]);

    React.useEffect(() => {
      updateIndicator();
      window.addEventListener('resize', updateIndicator);
      return () => window.removeEventListener('resize', updateIndicator);
    }, [updateIndicator, children]);

    React.useImperativeHandle(
      forwardedRef,
      () => localRef.current as HTMLDivElement,
    );

    return (
      <div ref={localRef} className="relative">
        <div
          role="tablist"
          className={cn(
            'bg-muted text-muted-foreground inline-flex h-10 w-fit items-center justify-center rounded-lg p-[4px]',
            className,
          )}
        >
          {children}
        </div>
        <motion.div
          className={cn(
            'absolute rounded-sm bg-background shadow-sm',
            activeClassName,
          )}
          animate={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            top: indicatorStyle.top,
            height: indicatorStyle.height,
          }}
          transition={transition}
        />
      </div>
    );
  },
);
TabsList.displayName = 'TabsList';

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, children, className }, forwardedRef) => {
    const { activeValue, handleValueChange, registerTrigger } = useTabs();

    const localRef = React.useRef<HTMLButtonElement | null>(null);
    React.useImperativeHandle(
      forwardedRef,
      () => localRef.current as HTMLButtonElement,
    );

    React.useEffect(() => {
      registerTrigger(value, localRef.current);
      return () => registerTrigger(value, null);
    }, [value, registerTrigger]);

    return (
      <motion.button
        role="tab"
        whileTap={{ scale: 0.95 }}
        ref={localRef}
        onClick={() => handleValueChange(value)}
        data-state={activeValue === value ? 'active' : 'inactive'}
        className={cn(
          'inline-flex items-center h-full justify-center whitespace-nowrap rounded-sm px-2 py-1 text-sm font-medium ring-offset-background transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground z-[1]',
          className,
        )}
      >
        {children}
      </motion.button>
    );
  },
);
TabsTrigger.displayName = 'TabsTrigger';

interface TabsContentsProps {
  children: React.ReactNode;
  className?: string;
  transition?: Transition;
}

const TabsContents = React.forwardRef<HTMLDivElement, TabsContentsProps>(
  (
    { children, className, transition = { duration: 0.4, ease: 'easeInOut' } },
    forwardedRef,
  ) => {
    const { activeValue } = useTabs();
    const childrenArray = React.Children.toArray(children);
    const activeIndex = childrenArray.findIndex(
      (child): child is React.ReactElement<{ value: string }> =>
        React.isValidElement(child) &&
        typeof child.props === 'object' &&
        child.props !== null &&
        'value' in child.props &&
        child.props.value === activeValue,
    );

    const localRef = React.useRef<HTMLDivElement | null>(null);
    React.useImperativeHandle(
      forwardedRef,
      () => localRef.current as HTMLDivElement,
    );

    return (
      <div ref={localRef} className={cn('overflow-hidden', className)}>
        <motion.div
          className="flex"
          animate={{ x: activeIndex * -100 + '%' }}
          transition={transition}
        >
          {childrenArray.map((child, index) => (
            <div key={index} className="w-full flex-shrink-0">
              {child}
            </div>
          ))}
        </motion.div>
      </div>
    );
  },
);
TabsContents.displayName = 'TabsContents';

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ children, className }, forwardedRef) => {
    const localRef = React.useRef<HTMLDivElement | null>(null);
    React.useImperativeHandle(
      forwardedRef,
      () => localRef.current as HTMLDivElement,
    );

    return (
      <div role="tabpanel" ref={localRef} className={className}>
        {children}
      </div>
    );
  },
);
TabsContent.displayName = 'TabsContent';

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContents,
  TabsContent,
  useTabs,
  type TabsContextType,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentsProps,
  type TabsContentProps,
};
