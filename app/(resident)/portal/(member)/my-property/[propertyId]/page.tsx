import {
  ResidentPropertyDetailsView,
  ResidentPropertyUnavailable,
} from "@/components/resident/resident-property-detail-view";
import { getResidentPropertyDetails } from "@/server/services/auth/resident-property-detail";

type ResidentPropertyDetailPageProps = {
  params: Promise<{
    propertyId: string;
  }>;
};

export default async function ResidentPropertyDetailPage({
  params,
}: Readonly<ResidentPropertyDetailPageProps>) {
  const { propertyId } = await params;
  const propertyDetails = await getResidentPropertyDetails(propertyId);

  if (propertyDetails.kind !== "property-details") {
    return <ResidentPropertyUnavailable />;
  }

  return <ResidentPropertyDetailsView result={propertyDetails} />;
}
