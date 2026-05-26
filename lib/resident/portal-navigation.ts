export type ResidentPortalNavigationItem = {
  label:
    | "Dashboard"
    | "Payments"
    | "Documents"
    | "Announcements"
    | "Events"
    | "Messages"
    | "Contact Board"
    | "My Property";
  href: string;
};

export const residentPortalNavigationItems: ResidentPortalNavigationItem[] = [
  {
    label: "Dashboard",
    href: "/portal",
  },
  {
    label: "Payments",
    href: "/portal/payments",
  },
  {
    label: "Documents",
    href: "/portal/documents",
  },
  {
    label: "Announcements",
    href: "/portal/announcements",
  },
  {
    label: "Events",
    href: "/portal/events",
  },
  {
    label: "Messages",
    href: "/portal/messages",
  },
  {
    label: "Contact Board",
    href: "/portal/contact-board",
  },
  {
    label: "My Property",
    href: "/portal/my-property",
  },
];
