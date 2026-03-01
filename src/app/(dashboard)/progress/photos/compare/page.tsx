import { ComparePhotosClient } from "./compare-photos-client";

interface ComparePhotosPageProps {
  searchParams: Promise<{
    angle?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ComparePhotosPage({ searchParams }: ComparePhotosPageProps) {
  const resolvedSearchParams = await searchParams;
  return <ComparePhotosClient initialAngle={resolvedSearchParams.angle} />;
}
