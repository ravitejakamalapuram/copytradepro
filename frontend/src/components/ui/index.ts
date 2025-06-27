/**
 * COPYTRADE PRO - ENTERPRISE UI COMPONENT LIBRARY
 * Centralized export for all UI components
 */

// Design System
export { designTokens, getColor, getSpacing } from './design-tokens';
export type { ColorScale, SpacingScale, FontSize, FontWeight } from './design-tokens';

// Core Components
export { default as Button } from './Button';
export type { ButtonProps } from './Button';

export { default as Card, CardHeader, CardContent, CardFooter } from './Card';
export type { CardProps, CardHeaderProps, CardContentProps, CardFooterProps } from './Card';

export { default as Input, Select } from './Input';
export type { InputProps, SelectProps } from './Input';

export { default as Badge, StatusBadge } from './Badge';
export type { BadgeProps, StatusBadgeProps } from './Badge';

export { 
  default as Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHeaderCell, 
  TableCell 
} from './Table';
export type { 
  TableProps, 
  TableHeaderProps, 
  TableBodyProps, 
  TableRowProps, 
  TableHeaderCellProps, 
  TableCellProps 
} from './Table';

// Layout Components
export {
  Container,
  PageHeader,
  Grid,
  Flex,
  Stack,
  HStack,
  Spacer
} from './Layout';
export type {
  ContainerProps,
  PageHeaderProps,
  GridProps,
  FlexProps,
  StackProps,
  HStackProps,
  SpacerProps
} from './Layout';

// Component Library Metadata
export const COMPONENT_LIBRARY_VERSION = '1.0.0';
export const DESIGN_SYSTEM_VERSION = '1.0.0';

/**
 * Enterprise Design System Guidelines
 * 
 * COLORS:
 * - Use semantic color tokens (primary, success, error, etc.)
 * - Maintain consistent contrast ratios
 * - Follow WCAG accessibility guidelines
 * 
 * TYPOGRAPHY:
 * - Use design token font sizes and weights
 * - Maintain consistent line heights
 * - Use system font stack for performance
 * 
 * SPACING:
 * - Use design token spacing scale
 * - Maintain consistent padding and margins
 * - Follow 8px grid system
 * 
 * COMPONENTS:
 * - All components are fully typed with TypeScript
 * - Follow React best practices with forwardRef
 * - Consistent API patterns across components
 * - Accessible by default
 * 
 * USAGE:
 * import { Button, Card, designTokens } from '@/components/ui';
 */
