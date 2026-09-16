import { ListSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton />
      <ListSkeleton />
    </LoadingShell>
  );
}
