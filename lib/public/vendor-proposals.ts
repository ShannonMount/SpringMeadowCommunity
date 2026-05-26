export type PublicVendorProposalSettings = {
  communitySlug: string;
  proposalIntakeEnabled: boolean;
  enabledHeading: string;
  enabledDescription: string;
  disabledHeading: string;
  disabledDescription: string;
};

export const vendorProposalRoutes = {
  placeholder: "/vendors",
  futureProposal: "/vendors/proposals",
  contact: "/contact",
} as const;

export const vendorProposalSettings: PublicVendorProposalSettings = {
  communitySlug: "spring-meadow-community",
  proposalIntakeEnabled: false,
  enabledHeading: "Vendor proposal intake",
  enabledDescription:
    "A public proposal entry point is reserved for future vendor service requests when online intake is available.",
  disabledHeading: "Vendor proposal intake is not online yet",
  disabledDescription:
    "Spring Meadow Community is handling vendor and service inquiries through the public contact path while online proposal intake is not available.",
};

export function getVendorProposalPlaceholderState(settings = vendorProposalSettings) {
  return {
    communitySlug: settings.communitySlug,
    proposalIntakeEnabled: settings.proposalIntakeEnabled,
    primaryHref: settings.proposalIntakeEnabled
      ? vendorProposalRoutes.futureProposal
      : vendorProposalRoutes.contact,
    primaryLabel: settings.proposalIntakeEnabled
      ? "Start vendor proposal intake"
      : "Contact the HOA about vendor services",
    heading: settings.proposalIntakeEnabled ? settings.enabledHeading : settings.disabledHeading,
    description: settings.proposalIntakeEnabled
      ? settings.enabledDescription
      : settings.disabledDescription,
  };
}
