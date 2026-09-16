import { LoadingShell, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingShell wide>
      <PageHeaderSkeleton eyebrow />
      <TableSkeleton />
    </LoadingShell>
  );
}
