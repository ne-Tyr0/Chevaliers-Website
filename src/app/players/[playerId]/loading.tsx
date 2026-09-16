import {
  LoadingShell,
  MatchCardsSkeleton,
  PageHeaderSkeleton,
  StatTilesSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingShell>
      <PageHeaderSkeleton eyebrow />
      <StatTilesSkeleton />
      <MatchCardsSkeleton count={2} />
    </LoadingShell>
  );
}
