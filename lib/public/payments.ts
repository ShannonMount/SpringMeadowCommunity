export type PublicPaymentSettings = {
  communitySlug: string;
  guestPaymentsEnabled: boolean;
  enabledHeading: string;
  enabledDescription: string;
  disabledHeading: string;
  disabledDescription: string;
};

export const paymentEntryRoutes = {
  entry: "/pay-dues",
  lookup: "/pay-dues/lookup",
  payment: "/pay-dues/payment",
  return: "/pay-dues/return",
  contact: "/contact",
} as const;

export const publicPaymentSettings: PublicPaymentSettings = {
  communitySlug: "spring-meadow-community",
  guestPaymentsEnabled: true,
  enabledHeading: "Start a guest dues payment",
  enabledDescription:
    "Begin from the public lookup entry. The next protected step will collect only the details needed to route you safely.",
  disabledHeading: "Online guest dues are currently unavailable",
  disabledDescription:
    "Use the public contact path for dues questions while online guest payment access is unavailable.",
};

export function getPublicPaymentEntryState(settings = publicPaymentSettings) {
  return {
    communitySlug: settings.communitySlug,
    guestPaymentsEnabled: settings.guestPaymentsEnabled,
    primaryHref: settings.guestPaymentsEnabled ? paymentEntryRoutes.lookup : paymentEntryRoutes.contact,
    primaryLabel: settings.guestPaymentsEnabled
      ? "Start guest payment lookup"
      : "Contact the HOA about dues",
    heading: settings.guestPaymentsEnabled ? settings.enabledHeading : settings.disabledHeading,
    description: settings.guestPaymentsEnabled
      ? settings.enabledDescription
      : settings.disabledDescription,
  };
}

export function getDisabledPaymentGuidance(settings = publicPaymentSettings) {
  return {
    heading: settings.disabledHeading,
    description: settings.disabledDescription,
    contactHref: paymentEntryRoutes.contact,
    contactLabel: "Contact the HOA about dues",
  };
}
