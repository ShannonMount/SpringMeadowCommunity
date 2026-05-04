export type PublicNavigationItem = {
  label: string;
  href: string;
};

export const publicNavigationItems: PublicNavigationItem[] = [
  { label: "Home", href: "/" },
  { label: "About/Community Info", href: "/about" },
  { label: "Announcements", href: "/announcements" },
  { label: "Events", href: "/events" },
  { label: "Documents/Public Resources", href: "/documents" },
  { label: "Contact", href: "/contact" },
  { label: "Pay Dues", href: "/pay-dues" },
  { label: "Login", href: "/login" },
];
