import { CardsSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton />
      <CardsSkeleton />
    </LoadingShell>
  );
}
