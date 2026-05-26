import {
  ResidentPropertyDetailsView,
  ResidentPropertyUnavailable,
} from "@/components/resident/resident-property-detail-view";
import { getResidentPropertyDetails } from "@/server/services/auth/resident-property-detail";

export default async function ResidentMyPropertyPage() {
  const propertyDetails = await getResidentPropertyDetails();

  if (propertyDetails.kind !== "property-details") {
    return <ResidentPropertyUnavailable />;
  }

  return <ResidentPropertyDetailsView result={propertyDetails} />;
}
