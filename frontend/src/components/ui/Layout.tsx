/**
 * ENTERPRISE LAYOUT COMPONENTS
 * CSS-only implementation to avoid CSSStyleDeclaration issues
 */

import React from 'react';
import './Layout.css';

// Container Component
export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Container size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Center content */
  centered?: boolean;
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ size = 'xl', centered = false, className = '', children, ...props }, ref) => {
    const containerClasses = [
      'enterprise-container',
      `enterprise-container--${size}`,
      centered && 'enterprise-container--centered',
      className
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={containerClasses} {...props}>
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';

// Page Header Component
export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page title */
  title: string;
  /** Page subtitle */
  subtitle?: string;
  /** Action buttons */
  actions?: React.ReactNode;
  /** Breadcrumb navigation */
  breadcrumb?: React.ReactNode;
}

export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, subtitle, actions, breadcrumb, className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`enterprise-page-header ${className}`} {...props}>
        {breadcrumb && (
          <div className="enterprise-page-header-breadcrumb">
            <div className="enterprise-page-header-breadcrumb-item">
              {breadcrumb}
            </div>
          </div>
        )}
        
        <div>
          <h1 className="enterprise-page-header-title">{title}</h1>
          {subtitle && (
            <p className="enterprise-page-header-subtitle">{subtitle}</p>
          )}
          {children}
        </div>
        
        {actions && (
          <div className="enterprise-page-header-actions">
            {actions}
          </div>
        )}
      </div>
    );
  }
);

PageHeader.displayName = 'PageHeader';

// Stack Component (Vertical)
export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between items */
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ gap = 4, className = '', children, ...props }, ref) => {
    const stackClasses = [
      'enterprise-stack',
      `enterprise-stack--gap-${gap}`,
      className
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={stackClasses} {...props}>
        {children}
      </div>
    );
  }
);

Stack.displayName = 'Stack';

// HStack Component (Horizontal)
export interface HStackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between items */
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
}

export const HStack = React.forwardRef<HTMLDivElement, HStackProps>(
  ({ gap = 4, className = '', children, ...props }, ref) => {
    const hstackClasses = [
      'enterprise-hstack',
      `enterprise-hstack--gap-${gap}`,
      className
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={hstackClasses} {...props}>
        {children}
      </div>
    );
  }
);

HStack.displayName = 'HStack';

// Spacer Component
export interface SpacerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Spacer size */
  size?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 12 | 16 | 20 | 24 | 32;
}

export const Spacer = React.forwardRef<HTMLDivElement, SpacerProps>(
  ({ size, className = '', ...props }, ref) => {
    const spacerClasses = [
      'enterprise-spacer',
      size && `enterprise-spacer--size-${size}`,
      className
    ].filter(Boolean).join(' ');

    return <div ref={ref} className={spacerClasses} {...props} />;
  }
);

Spacer.displayName = 'Spacer';

// Grid Component
export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns */
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  /** Gap between items */
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ cols = 1, gap = 4, className = '', children, ...props }, ref) => {
    const gridClasses = [
      'enterprise-grid',
      `enterprise-grid--cols-${cols}`,
      `enterprise-grid--gap-${gap}`,
      className
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={gridClasses} {...props}>
        {children}
      </div>
    );
  }
);

Grid.displayName = 'Grid';

// Flex Component
export interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Flex direction */
  direction?: 'row' | 'column';
  /** Justify content */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** Align items */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Gap between items */
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
  /** Flex wrap */
  wrap?: boolean;
}

export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
  ({
    direction = 'row',
    justify = 'start',
    align = 'center',
    gap = 4,
    wrap = false,
    className = '',
    children,
    ...props
  }, ref) => {
    const flexClasses = [
      'enterprise-flex',
      `enterprise-flex--direction-${direction}`,
      `enterprise-flex--justify-${justify}`,
      `enterprise-flex--align-${align}`,
      `enterprise-flex--gap-${gap}`,
      wrap && 'enterprise-flex--wrap',
      className
    ].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={flexClasses} {...props}>
        {children}
      </div>
    );
  }
);

Flex.displayName = 'Flex';
