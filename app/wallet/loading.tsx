import RepalLoader from "@/components/brand/RepalLoader";

/** Route-transition loader for the wallet page. */
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <RepalLoader size={72} label="Loading wallet" />
    </div>
  );
}
