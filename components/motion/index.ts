/**
 * RePal motion primitives — reusable, presentational animation building blocks.
 * All timing/easing comes from `lib/motion/tokens`; every component honors
 * reduced motion. Import from here, e.g.:
 *   import { MotionButton, AnimatedBottomSheet } from "@/components/motion";
 */

export { AnimatedPage, type AnimatedPageProps } from "./AnimatedPage";
export {
  RouteTransitionBoundary,
  type RouteTransitionBoundaryProps,
} from "./RouteTransitionBoundary";
export { AnimatedAppShell, type AnimatedAppShellProps } from "./AnimatedAppShell";
export {
  SharedElementTransition,
  type SharedElementTransitionProps,
} from "./SharedElementTransition";
export {
  AnimatedBottomSheet,
  type AnimatedBottomSheetProps,
} from "./AnimatedBottomSheet";
export { AnimatedDrawer, type AnimatedDrawerProps } from "./AnimatedDrawer";
export { AnimatedModal, type AnimatedModalProps } from "./AnimatedModal";
export {
  AnimatedTabs,
  type AnimatedTabsProps,
  type AnimatedTab,
} from "./AnimatedTabs";
export { AnimatedNumber, type AnimatedNumberProps } from "./AnimatedNumber";
export { AnimatedList, type AnimatedListProps } from "./AnimatedList";
export { MotionButton, type MotionButtonProps } from "./MotionButton";
export { MotionCard, type MotionCardProps } from "./MotionCard";
export {
  AnimatedStatus,
  type AnimatedStatusProps,
  type StatusTone,
} from "./AnimatedStatus";
