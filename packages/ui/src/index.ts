// Public API of @saas/ui — re-exports every shadcn/ui (Base UI) component.
// Components live in src/components/ui/<name>.tsx; modify in place.
// Stories live in apps/storybook/stories/<name>.stories.tsx.

export { cn } from "./cn";
export { brandForeground, brandThemeCss } from "./brand-theme";

export * from "./components/ui/accordion";
export * from "./components/ui/alert";
export * from "./components/ui/alert-dialog";
export * from "./components/ui/aspect-ratio";
export * from "./components/ui/avatar";
export * from "./components/ui/badge";
export * from "./components/ui/breadcrumb";
export * from "./components/ui/button";
export * from "./components/ui/button-group";
export * from "./components/ui/calendar";
export * from "./components/ui/date-picker";
export * from "./components/ui/date-range-picker";
export * from "./components/ui/card";
export * from "./components/ui/carousel";
export * from "./components/ui/chart";
export * from "./components/ui/checkbox";
export * from "./components/ui/collapsible";
export * from "./components/ui/combobox";
export * from "./components/ui/command";
export * from "./components/ui/context-menu";
export * from "./components/ui/dialog";
export * from "./components/ui/direction";
export * from "./components/ui/drawer";
export * from "./components/ui/dropdown-menu";
export * from "./components/ui/dropzone";
export * from "./components/ui/empty";
export * from "./components/ui/field";
export * from "./components/ui/hover-card";
export * from "./components/ui/image-cropper";
export * from "./components/ui/image-gallery";
export * from "./components/ui/input";
export * from "./components/ui/input-group";
export * from "./components/ui/input-otp";
export * from "./components/ui/input-phone";
export * from "./components/ui/input-phone.lib";
export * from "./components/ui/input-phone.countries";
export * from "./icons/flags";
export * from "./components/ui/item";
export * from "./components/ui/kbd";
export * from "./components/ui/label";
export * from "./components/ui/menubar";
export * from "./components/ui/date-wheel-picker";
export * from "./components/ui/date-wheel-picker.lib";
export * from "./components/ui/wheel-picker";
export * from "./components/ui/mode-segmented";
export * from "./components/ui/mode-toggle";
export * from "./components/ui/native-select";
export * from "./components/ui/number-input";
export * from "./components/ui/rich-text-editor";
export * from "./components/ui/segmented-control";
export * from "./components/ui/navigation-menu";
export * from "./components/ui/pagination";
export * from "./components/ui/popover";
export * from "./components/ui/progress";
export * from "./components/ui/radio-group";
export * from "./components/ui/resizable";
export * from "./components/ui/responsive-modal";
export * from "./components/ui/scroll-area";
export * from "./components/ui/select";
export * from "./components/ui/separator";
export * from "./components/ui/sheet";
export * from "./components/ui/sidebar";
export * from "./components/ui/skeleton";
export * from "./components/ui/slider";
export * from "./components/ui/sonner";
export * from "./components/ui/spinner";
export * from "./components/ui/switch";
export * from "./components/ui/table";
export * from "./components/ui/tabs";
export * from "./components/ui/textarea";
export * from "./components/ui/theme-provider";
export * from "./components/ui/toggle";
export * from "./components/ui/toggle-group";
export * from "./components/ui/tooltip";

export { useIsMobile } from "./hooks/use-mobile";
export * from "./components/ui/address-field";
export * from "./components/ui/address-provider";
export * from "./components/ui/store-address-preview";
// Re-export the shared address shape so consumers import it from @saas/ui
// (they already depend on it) without a direct @saas/address dependency.
export type { StoreAddress } from "@saas/address";
export * from "./components/ui/background-picker";
export * from "./components/ui/color-picker";
export * from "./components/ui/icon-picker";
export * from "./components/ui/onboarding-slide";

export { TiltCard } from "./components/ui/tilt-card";
export * from "./components/ui/number-stepper";
export * from "./components/ui/tag-input";
export * from "./components/ui/time-input";
export * from "./components/ui/url-input";

/*
 * beUI — `bunx --bun shadcn add @beui/<name>` against the registry declared in
 * `components.json`. Self-contained over `motion/react`, so they sit beside our
 * Base UI primitives rather than dragging in a second set. See README.md for
 * the edits that must be reapplied after an install.
 */
export {
  AnimatedSidebar,
  AnimatedSidebarClose,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarGroupContent,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarInset,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarMenuSub,
  AnimatedSidebarMenuSubButton,
  AnimatedSidebarMenuSubItem,
  AnimatedSidebarProvider,
  AnimatedSidebarRail,
  AnimatedSidebarTrigger,
  useAnimatedSidebar,
} from "./components/motion/animated-sidebar";
export { NumberTicker, type NumberTickerProps } from "./components/motion/number-ticker";
export { ThemeToggle } from "./components/motion/theme-toggle";
