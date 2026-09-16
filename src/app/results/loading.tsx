import {
  LoadingShell,
  MatchCardsSkeleton,
  PageHeaderSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingShell wide>
      <PageHeaderSkeleton eyebrow />
      <MatchCardsSkeleton />
    </LoadingShell>
  );
}
