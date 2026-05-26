export type PublicLink = {
  label: string;
  href: string;
  description: string;
};

export type PublicAmenity = {
  name: string;
  description: string;
};

export const communityContent = {
  name: "Spring Meadow Community",
  eyebrow: "Official HOA community website",
  overview:
    "Spring Meadow Community is a neighborhood information hub for public HOA updates, community resources, resident access, and official entry points.",
  homeHighlights: [
    "Official HOA information for visitors, residents, realtors, and vendors.",
    "Public resources without exposing resident, property, payment, board, or private document data.",
    "Clear paths to announcements, events, public documents, contact, dues payment, and login.",
  ],
  resourceLinks: [
    {
      label: "Announcements",
      href: "/announcements",
      description: "Read official public notices when they are published.",
    },
    {
      label: "Events",
      href: "/events",
      description: "Find public community dates, meetings, and planned activities.",
    },
    {
      label: "Documents/Public Resources",
      href: "/documents",
      description: "Access public documents and resources as they become available.",
    },
  ] satisfies PublicLink[],
  entryPoints: [
    {
      label: "Contact the HOA",
      href: "/contact",
      description: "Use the public contact path for general community questions.",
    },
    {
      label: "Pay Dues",
      href: "/pay-dues",
      description: "Start from the public dues entry point when payment features are enabled.",
    },
    {
      label: "Resident Login",
      href: "/login",
      description: "Residents can use the login entry point for future private portal access.",
    },
  ] satisfies PublicLink[],
  amenities: [
    {
      name: "Community pool",
      description: "A shared seasonal amenity for residents and community gatherings.",
    },
    {
      name: "Play and gathering areas",
      description: "Public-facing community information can highlight common amenities without exposing private records.",
    },
    {
      name: "Neighborhood trails and green space",
      description: "Outdoor community features help visitors understand the neighborhood character.",
    },
  ] satisfies PublicAmenity[],
  officialInfo: [
    "Public pages are informational and do not replace resident portal records.",
    "Private resident, property, board, payment, and document details require future authenticated workflows.",
    "Announcements, events, and documents appear publicly only when marked public by authorized HOA users in later stories.",
  ],
};

export const communityContentEmptyState = {
  title: "Community information is being prepared",
  description:
    "The public site remains available while official community overview content is configured.",
};

export function hasCommunityOverviewContent(content = communityContent) {
  return Boolean(content.name && content.overview && content.homeHighlights.length > 0);
}
