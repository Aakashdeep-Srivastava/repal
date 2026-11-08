import RepalLoader from "@/components/brand/RepalLoader";

/**
 * Route-transition loader for the shop journey (shop → product → checkout).
 * Shown by the App Router while a segment in this group is navigating/streaming.
 */
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <RepalLoader size={72} label="Loading" />
    </div>
  );
}
