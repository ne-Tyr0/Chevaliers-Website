import { LoadingShell, PageHeaderSkeleton, ProseSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton />
      <ProseSkeleton lines={4} />
      <ProseSkeleton lines={6} />
    </LoadingShell>
  );
}
